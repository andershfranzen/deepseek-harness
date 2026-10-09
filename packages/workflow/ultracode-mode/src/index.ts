/**
 * Ultracode is logged per-agent orchestration state: while active, a
 * deployment-owned guidance section in each model request asks the agent to
 * carry substantial work through the workflow and subagent tools, and
 * `/ultracode [on|off]` lets a user switch it. It is independent of reasoning
 * effort, model choice, sandbox mode, and approval policy, and changes no tool
 * catalog.
 *
 * The `ultracode` projection folds the session log, so resume and fork
 * restore the state. User selections made during an open turn remain pending
 * until the next accepted in-turn pre-step, which appends `ultracode/mode`;
 * between turns a selection commits immediately.
 *
 * See packages/workflow/ultracode-mode/README.md.
 *
 * @module @deepseek-ai/dsh-ultracode-mode
 */

import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { Context, Service } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import type { Session, UserMessage } from '@deepseek-ai/dsh-session'
import { brandString } from '@deepseek-ai/dsh-brand'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import type { CommandDefinitionId, CommandId } from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { UltracodeProjection, UltracodeUnitState } from './types.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /**
     * Notice that the user switched ultracode while a request header described
     * the other state. Readers preserve the content without this producer; no
     * fold reads the kind.
     * @persistenceAttribution
     */
    'ultracode-mode': { kind: 'ultracode-mode' } & ContextFormed
  }
}
export type * from './types.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Whether ultracode is in force from this point on: log-only, non-surface,
     * whole-value replace. The last `ultracode/mode` wins; a log with none
     * folds to inactive through the projection unit's fold.
     */
    'ultracode/mode': { active: boolean }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    ultracodeMode: UltracodeModeController
  }
}

/** The slash command name, without the leading slash. */
export const ULTRACODE_COMMAND = 'ultracode'

/** Deployment-owned ultracode guidance. */
export interface UltracodeModeConfig {
  /** Guidance rendered as the `ultracode:policy` prompt section while ultracode is active. */
  section: string
}

/**
 * Validate deployment-owned ultracode guidance. Missing, blank, non-string,
 * or unknown fields fail at plugin load rather than being ignored.
 *
 * @param config Raw plugin config.
 * @returns A detached validated config.
 */
export function resolveConfig(config: UltracodeModeConfig): UltracodeModeConfig {
  const section = (config as Partial<UltracodeModeConfig>).section
  if (typeof section !== 'string') {
    throw new Error('UltracodeModeConfig needs a string `section`')
  }
  if (section.trim() === '') {
    throw new Error('UltracodeModeConfig needs a non-empty `section`')
  }
  const unknown = Object.keys(config).filter(key => key !== 'section')
  if (unknown.length > 0) {
    throw new Error(`UltracodeModeConfig has unknown key(s) ${unknown.join(', ')} — config is { section }`)
  }
  return { section }
}

/**
 * Parse `/ultracode` input.
 * @param rawInput The command's verbatim input.
 * @returns the selected state, or undefined for input other than empty, `on`, or `off`.
 */
function parseSelection(rawInput: string): boolean | undefined {
  const value = rawInput.trim()
  if (value === '' || value === 'on') return true
  if (value === 'off') return false
  return undefined
}

/**
 * Settle the running `/ultracode` command: a successful selection that differs from the logged mode stays wanted.
 * @param state - fold state whose running command just settled.
 * @param wanted - the settled command's requested mode.
 * @param succeeded - whether the command settled successfully.
 * @returns state with the command cleared and any outstanding selection recorded.
 */
function settleCommand(state: UltracodeUnitState, wanted: boolean, succeeded: boolean): UltracodeUnitState {
  return { ...state, wanted: succeeded && wanted !== state.active ? wanted : null, running: null }
}

const ultracodeUnitStateSchema: ZodType<UltracodeUnitState> = zod.object({
  active: zod.boolean(),
  wanted: zod.boolean().nullable(),
  running: zod.object({
    commandId: zod.string().transform(value => brandString<CommandId>(value)),
    wanted: zod.boolean(),
  }).strict().nullable(),
  activeAtLastHeader: zod.boolean().nullable(),
}).strict()

/** Wire payload schema of the `ultracode` projection. */
const ultracodeProjectionSchema: ZodType<UltracodeProjection> = zod.object({
  active: zod.boolean(),
  pending: zod.boolean(),
})

/** Projection of logged `/ultracode` selections and committed mode. */
export const ultracodeProjectionDefinition = {
  key: 'ultracode',
  stateVersion: 1,
  stateSchema: ultracodeUnitStateSchema,
  init: () => ({ active: false, wanted: null, running: null, activeAtLastHeader: null }),
  apply: (state, event) => {
    if (event.type === 'command/run' && event.data.name === ULTRACODE_COMMAND) {
      // Unparsable input settles as an error and never selects a state.
      const wanted = event.data.args === undefined ? undefined : parseSelection(event.data.args)
      if (wanted === undefined) return state
      return { ...state, running: { commandId: event.data.commandId, wanted } }
    }
    if (event.type === 'command/done' && event.data.commandId === state.running?.commandId) {
      return settleCommand(state, state.running.wanted, event.data.kind === 'success')
    }
    if (event.type === 'ultracode/mode') {
      return { ...state, active: event.data.active, wanted: null }
    }
    if (event.type === 'request/header') {
      return { ...state, activeAtLastHeader: state.active }
    }
    return state
  },
  wire: {
    viewSchema: ultracodeProjectionSchema,
    view: (state) => {
      const wanted = state.running?.wanted ?? state.wanted
      return { active: state.active, pending: wanted !== null && wanted !== state.active }
    },
  },
} satisfies ProjectionDefinition<'ultracode', UltracodeUnitState>

/**
 * `ctx.ultracodeMode`: owns logged ultracode state, applies and narrates a
 * selected state at the next accepted in-turn pre-step, contributes the
 * `ultracode:policy` section, and registers `/ultracode` when a command
 * registry is composed. Client carriers expose the projection's
 * `{ active, pending }` view.
 */
export class UltracodeModeController extends Service {
  static inject = ['systemPrompt', 'sessionProjections']

  /** Validated deployment-owned guidance. */
  private readonly section: string

  /** Latest selection per session awaiting the next accepted in-turn pre-step. */
  private readonly pendingIntents = new WeakMap<Session, boolean>()

  constructor(ctx: Context, config: UltracodeModeConfig = { section: '' }) {
    super(ctx, 'ultracodeMode')
    this.section = resolveConfig(config).section
    // Pre-step is outside Session.append publication, so it can append the
    // log-only mode event inside an open turn. A failed append stays pending
    // for a later accepted in-turn pre-step and never blocks the step.
    ctx.on('agent/pre-step', async ({ agent, signal }, next): Promise<PreStepDecision> => {
      const decision = await next()
      const session = agent.session
      const pending = this.pendingIntents.get(session)
      if (decision.kind === 'reject' || signal.aborted || pending === undefined) return decision
      if (pending === this.loggedActive(session)) {
        this.pendingIntents.delete(session)
        return decision
      }
      const narration = this.narration(session, pending)
      try {
        session.append('ultracode/mode', { active: pending })
      } catch (error) {
        ctx.logger.warn('dsh-ultracode-mode: failed to append selected ultracode mode at step start: %o', error)
        return decision
      }
      // Delete only after the append lands so a later accepted pre-step retries a failed write.
      this.pendingIntents.delete(session)
      return narration === undefined ? decision : { ...decision, messages: [...decision.messages, narration] }
    })

    // Equal orders sort by name, so this section follows `plan:policy`
    // directly without a dedicated central slot.
    ctx.systemPrompt.section({
      name: 'ultracode:policy',
      order: ctx.systemPrompt.getSectionOrder('PLAN_POLICY'),
      text: (context) => {
        if (context.agent === undefined) return ''
        const pending = this.pendingIntents.get(context.agent.session)
        return (pending ?? this.loggedActive(context.agent.session)) ? this.section : ''
      },
    })

    ctx.sessionProjections.register(ultracodeProjectionDefinition)

    // The command child activates only when a command registry is composed.
    ctx.inject(['commands'], (commandCtx) => {
      commandCtx.commands.register({
        definitionId: brandString<CommandDefinitionId>('@deepseek-ai/dsh-ultracode-mode'),
        name: ULTRACODE_COMMAND,
        description: 'Turn ultracode orchestration on or off',
        input: { hint: '[on|off]' },
        handler: ({ agent, rawInput }) => {
          const target = parseSelection(rawInput)
          if (target === undefined) {
            return { kind: 'error', text: 'Usage: /ultracode [on|off]' }
          }
          const outcome = this.set(agent, target)
          return { kind: 'success', text: this.outcomeText(agent.session, target, outcome) }
        },
      })
    })
  }

  /**
   * Read the logged ultracode state and any selected state awaiting the next
   * accepted in-turn pre-step.
   *
   * @param agent The agent to read.
   * @returns Current logged state plus a pending selection, when present.
   */
  get(agent: Agent): { active: boolean; pending?: boolean } {
    const active = this.loggedActive(agent.session)
    const pending = this.pendingIntents.get(agent.session)
    return pending === undefined ? { active } : { active, pending }
  }

  /**
   * Select whether ultracode should be active. Between turns the method
   * appends the change immediately because no in-turn pre-step will run until
   * another prompt starts a turn. During an open turn the selection remains
   * pending until the next accepted in-turn pre-step. Repeated selection of
   * the current or already-pending state is a no-op.
   *
   * @param agent The agent to switch.
   * @param active Whether ultracode should be active.
   * @returns what happened: `committed` (logged now), `queued` (awaiting the
   * next accepted in-turn pre-step), `cancelled` (an opposite pending selection
   * was cleared; the logged state already matches), or `noop` (already in that
   * state).
   */
  set(agent: Agent, active: boolean): 'committed' | 'queued' | 'cancelled' | 'noop' {
    const session = agent.session
    const logged = this.loggedActive(session)
    const target = this.pendingIntents.get(session) ?? logged
    if (active === target) return 'noop'
    if (active === logged) {
      this.pendingIntents.delete(session)
      return 'cancelled'
    }
    if (this.hasOpenTurn(session)) {
      this.pendingIntents.set(session, active)
      return 'queued'
    }
    session.append('ultracode/mode', { active })
    this.pendingIntents.delete(session)
    const narration = this.narration(session, active)
    if (narration !== undefined) agent.inject(narration)
    return 'committed'
  }

  /** Render the user-facing command result for one selection outcome. */
  private outcomeText(session: Session, target: boolean, outcome: 'committed' | 'queued' | 'cancelled' | 'noop'): string {
    const queued = target
      ? 'Turning ultracode on (applies from the next step). Use /ultracode off to leave.'
      : 'Turning ultracode off (applies from the next step).'
    switch (outcome) {
      case 'committed':
        return target ? 'Ultracode on. Use /ultracode off to leave.' : 'Ultracode off.'
      case 'queued':
        return queued
      case 'cancelled':
        return target ? 'Ultracode exit cancelled.' : 'Ultracode entry cancelled.'
      case 'noop':
        // A selection still awaiting the next accepted pre-step repeats the
        // queued wording; only a logged state reads idempotent.
        if (this.loggedActive(session) !== target) return queued
        return target ? 'Ultracode is already on.' : 'Ultracode is already off.'
    }
  }

  private loggedActive(session: Session): boolean {
    return this.ultracodeState(session).active
  }

  private hasOpenTurn(session: Session): boolean {
    const state = this.ctx.sessionProjections.stateOf(session, 'turnBoundary')
    if (state === undefined) throw new Error('ultracode-mode requires the turnBoundary session projection')
    return state.openTurnStartSeq !== null
  }

  /** Read the required ultracode projection state or fail at the first service access. */
  private ultracodeState(session: Session): UltracodeUnitState {
    const state = this.ctx.sessionProjections.stateOf(session, 'ultracode')
    if (state === undefined) throw new Error('ultracode-mode requires the ultracode session projection')
    return state
  }

  /** Build a user-switch notice when the last logged header described the other mode. */
  private narration(session: Session, target: boolean): UserMessage | undefined {
    const told = this.ultracodeState(session).activeAtLastHeader
    if (told === null || told === target) return
    const text = target
      ? 'The user turned ultracode on for this session.'
      : 'The user turned ultracode off for this session.'
    return createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'ultracode-mode', form: 'notice', summary: text },
    })
  }
}

export default UltracodeModeController
