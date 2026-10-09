import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { Session, SessionId, type SessionEvent, type UserMessage } from '@deepseek-ai/dsh-session'
import AgentRegistry, { agentEvents, type Agent, type PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { CommandId } from '@deepseek-ai/dsh-commands/brand'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { turnBoundaryProjectionDefinition } from '@deepseek-ai/dsh-agent-loop'
import UltracodeModeController, { resolveConfig, ultracodeProjectionDefinition } from '../src/index.ts'
import type { UltracodeModeConfig } from '../src/index.ts'
import type { UltracodeUnitState } from '../src/types.ts'

/**
 * Drives the real plugin beside real SystemPrompt, projection, and command
 * services, with fake Agents over real Sessions and scoped contexts. Request
 * boundaries are simulated by dispatching the real `agent/pre-step` waterfall.
 */

const SECTION = 'Test ultracode instructions.'
const CONFIG = { section: SECTION } satisfies UltracodeModeConfig

async function mountProjectionSeam(ctx: Context): Promise<void> {
  await ctx.plugin(SessionProjectionRegistry)
  ctx.sessionProjections.register(turnBoundaryProjectionDefinition)
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await mountProjectionSeam(ctx)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(UltracodeModeController, CONFIG)
  // The `ctx.inject` command child mounts asynchronously once `commands` resolves.
  await new Promise(resolve => setImmediate(resolve))
  return ctx
}

async function agentWithSession(ctx: Context, id = 'agent-1'): Promise<Agent & { session: Session }> {
  const session = Session.create(SessionId(id))
  const agent = {
    id: SessionId(id),
    session,
    options: {},
    inject(message: UserMessage) {
      session.append('user/message', message, { surfaceOp: 'append' })
    },
  } as Partial<Agent> as Agent & { session: Session }
  let scoped!: Context
  await ctx.plugin((inner: Context) => { scoped = createScope(inner, agent).ctx })
  Object.assign(agent, { ctx: scoped })
  ctx.agents.enter(agent, undefined)
  await ctx.agents.announce(agent, 'startup')
  return agent
}

/** Dispatch the pre-step waterfall with an inner decision. */
async function preStep(
  ctx: Context,
  agent: Agent,
  inner: PreStepDecision['kind'] = 'enter',
  signal = new AbortController().signal,
): Promise<PreStepDecision> {
  const message = createUserMessage({ content: [{ type: 'text', text: 'boundary probe' }], source: { kind: 'user' } })
  return agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages: [message], turn: 1, step: 1, signal },
    () => Promise.resolve(inner === 'enter'
      ? { kind: 'enter' as const, messages: [message] }
      : { kind: 'reject' as const, reason: 'test reject' } as PreStepDecision),
  )
}

function openTurn(session: Session): void {
  session.append('turn/start', { turn: 0 })
}

function closeTurn(session: Session): void {
  session.append('turn/end', { turn: 0, reason: { kind: 'completed' } })
}

function header(session: Session): void {
  session.append('request/header', { header: { config: { provider: 'test', model: 'test-model' } }, reason: 'initial' })
}

function modes(session: Session): boolean[] {
  return session.snapshotEvents().flatMap(event => event.type === 'ultracode/mode' ? [event.data.active] : [])
}

function noticeTexts(session: Session): string[] {
  return session.snapshotEvents().flatMap(event =>
    event.type === 'user/message' && event.data.source.kind === 'ultracode-mode'
      ? [event.data.content.map(block => block.type === 'text' ? block.text : '').join('')]
      : [])
}

async function sectionText(ctx: Context, agent?: Agent): Promise<string | undefined> {
  const assembly = await ctx.systemPrompt.assemble(agent === undefined ? undefined : { agent, scope: agent })
  return assembly.sections.find(section => section.name === 'ultracode:policy')?.text
}

function fold(events: readonly SessionEvent[]): UltracodeUnitState {
  return events.reduce(ultracodeProjectionDefinition.apply, ultracodeProjectionDefinition.init())
}

/** Build log events through a real Session so each payload is checked against `SessionEventMap`. */
function events(write: (session: Session) => void): readonly SessionEvent[] {
  const session = Session.create(SessionId('fold'))
  write(session)
  return session.snapshotEvents()
}

describe('resolveConfig', () => {
  it('requires a string, non-empty section and rejects unknown keys', () => {
    expect(() => resolveConfig({} as UltracodeModeConfig)).toThrow('needs a string `section`')
    expect(() => resolveConfig({ section: '  ' })).toThrow('needs a non-empty `section`')
    expect(() => resolveConfig({ section: SECTION, order: 5 } as UltracodeModeConfig))
      .toThrow('unknown key(s) order — config is { section }')
    const resolved = resolveConfig(CONFIG)
    expect(resolved).toEqual(CONFIG)
    expect(resolved).not.toBe(CONFIG)
  })

  it('fails plugin load without a configured section', async () => {
    const ctx = new Context()
    await mountProjectionSeam(ctx)
    await ctx.plugin(SystemPrompt)
    const fiber = ctx.plugin(UltracodeModeController)
    await expect(fiber).rejects.toThrow('needs a non-empty `section`')
  })
})

describe('the ultracode projection', () => {
  const runId = CommandId('run-1')
  const otherId = CommandId('run-2')

  it('folds selections, settlements, mode events, and headers', () => {
    expect(fold([])).toEqual({ active: false, wanted: null, running: null, activeAtLastHeader: null })
    const pending = fold(events(s => s.append('command/run', { commandId: runId, name: 'ultracode', args: ' on ', source: { kind: 'user' } })))
    expect(pending.running).toEqual({ commandId: runId, wanted: true })
    expect(ultracodeProjectionDefinition.wire.view(pending)).toEqual({ active: false, pending: true })

    const settled = fold(events((s) => {
      s.append('command/run', { commandId: runId, name: 'ultracode', args: '', source: { kind: 'user' } })
      s.append('command/done', { commandId: otherId, kind: 'success' })
      s.append('command/done', { commandId: runId, kind: 'success' })
    }))
    expect(settled).toMatchObject({ wanted: true, running: null })
    expect(ultracodeProjectionDefinition.wire.view(settled)).toEqual({ active: false, pending: true })

    const committed = fold(events((s) => {
      s.append('command/run', { commandId: runId, name: 'ultracode', args: 'on', source: { kind: 'user' } })
      s.append('command/done', { commandId: runId, kind: 'success' })
      s.append('ultracode/mode', { active: true })
      s.append('request/header', { header: { config: { provider: 'test', model: 'test-model' } }, reason: 'initial' })
      s.append('turn/start', { turn: 0 })
    }))
    expect(committed).toEqual({ active: true, wanted: null, running: null, activeAtLastHeader: true })
    expect(ultracodeProjectionDefinition.wire.view(committed)).toEqual({ active: true, pending: false })
  })

  it('drops failed, redundant, unparsable, unrecorded, and foreign commands', () => {
    const failed = fold(events((s) => {
      s.append('command/run', { commandId: runId, name: 'ultracode', args: 'on', source: { kind: 'user' } })
      s.append('command/done', { commandId: runId, kind: 'error', text: 'no' })
    }))
    expect(ultracodeProjectionDefinition.wire.view(failed)).toEqual({ active: false, pending: false })
    const redundant = fold(events((s) => {
      s.append('command/run', { commandId: runId, name: 'ultracode', args: 'off', source: { kind: 'user' } })
      s.append('command/done', { commandId: runId, kind: 'success' })
    }))
    expect(redundant.wanted).toBeNull()
    const runs = events((s) => {
      s.append('command/run', { commandId: runId, name: 'ultracode', args: 'maybe', source: { kind: 'user' } })
      s.append('command/run', { commandId: runId, name: 'ultracode', source: { kind: 'user' } })
      s.append('command/run', { commandId: runId, name: 'plan', args: 'on', source: { kind: 'user' } })
    })
    for (const run of runs) expect(fold([run]).running).toBeNull()
  })

  it('validates checkpointed state, branding the command id', () => {
    const parsed = ultracodeProjectionDefinition.stateSchema.parse({
      active: true, wanted: false, running: { commandId: 'c', wanted: false }, activeAtLastHeader: null,
    })
    expect(parsed.running?.commandId).toBe('c')
    expect(() => ultracodeProjectionDefinition.stateSchema.parse({ active: true })).toThrow()
  })

  it('serves the client view through the registry and leaves with the plugin fiber', async () => {
    const ctx = new Context()
    await mountProjectionSeam(ctx)
    await ctx.plugin(SystemPrompt)
    const fiber = await ctx.plugin(UltracodeModeController, CONFIG)
    const session = Session.create(SessionId('projection'))
    session.append('ultracode/mode', { active: true })
    expect(ctx.sessionProjections.snapshot(session).values.ultracode).toEqual({ active: true, pending: false })
    await fiber.dispose()
    expect('ultracode' in ctx.sessionProjections.snapshot(session).values).toBe(false)
    expect(ctx.get('ultracodeMode')).toBeUndefined()
  })
})

describe('ctx.ultracodeMode: get/set', () => {
  it('does not activate without the projection registry', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(UltracodeModeController, CONFIG)
    expect(ctx.get('ultracodeMode')).toBeUndefined()
  })

  it('fails when a required projection is absent', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(UltracodeModeController, CONFIG)
    const agent = await agentWithSession(ctx)
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: false })
    expect(() => ctx.ultracodeMode.set(agent, true)).toThrow('requires the turnBoundary session projection')
    vi.spyOn(ctx.sessionProjections, 'stateOf').mockReturnValue(undefined)
    expect(() => ctx.ultracodeMode.get(agent)).toThrow('requires the ultracode session projection')
  })

  it('commits between turns and narrates only after a header described the other state', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    expect(ctx.ultracodeMode.set(agent, true)).toBe('committed')
    expect(noticeTexts(agent.session)).toEqual([])
    header(agent.session)
    expect(ctx.ultracodeMode.set(agent, true)).toBe('noop')
    expect(ctx.ultracodeMode.set(agent, false)).toBe('committed')
    expect(modes(agent.session)).toEqual([true, false])
    expect(noticeTexts(agent.session)).toEqual(['The user turned ultracode off for this session.'])
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: false })
  })

  it('queues during an open turn, and a reversal cancels without logging', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    openTurn(agent.session)
    expect(ctx.ultracodeMode.set(agent, true)).toBe('queued')
    expect(ctx.ultracodeMode.set(agent, true)).toBe('noop')
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: false, pending: true })
    closeTurn(agent.session)
    expect(ctx.ultracodeMode.set(agent, false)).toBe('cancelled')
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: false })
    expect(modes(agent.session)).toEqual([])
  })
})

describe('the pre-step commit', () => {
  it('appends a pending selection at an accepted pre-step and narrates the switch', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    header(agent.session)
    openTurn(agent.session)
    ctx.ultracodeMode.set(agent, true)
    expect(modes(agent.session)).toEqual([])
    const decision = await preStep(ctx, agent)
    expect(modes(agent.session)).toEqual([true])
    expect(decision.kind === 'enter' && decision.messages.map(message => message.source.kind))
      .toEqual(['user', 'ultracode-mode'])
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: true })
    // Nothing pending: a later pre-step is inert.
    expect(await preStep(ctx, agent)).toMatchObject({ kind: 'enter' })
    expect(modes(agent.session)).toEqual([true])
  })

  it('commits silently before the first header', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    openTurn(agent.session)
    ctx.ultracodeMode.set(agent, true)
    const decision = await preStep(ctx, agent)
    expect(decision.kind === 'enter' && decision.messages).toHaveLength(1)
    expect(modes(agent.session)).toEqual([true])
  })

  it('keeps the selection pending across rejected or aborted steps', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    openTurn(agent.session)
    ctx.ultracodeMode.set(agent, true)
    expect(await preStep(ctx, agent, 'reject')).toMatchObject({ kind: 'reject' })
    const aborted = new AbortController()
    aborted.abort()
    await preStep(ctx, agent, 'enter', aborted.signal)
    expect(modes(agent.session)).toEqual([])
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: false, pending: true })
  })

  it('drops a selection the log already reached', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    openTurn(agent.session)
    ctx.ultracodeMode.set(agent, true)
    agent.session.append('ultracode/mode', { active: true })
    await preStep(ctx, agent)
    expect(modes(agent.session)).toEqual([true])
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: true })
  })

  it('contains an append failure and retries at the next accepted pre-step', async () => {
    const ctx = await setup()
    const warn = vi.fn()
    ctx.logger.warn = warn
    const agent = await agentWithSession(ctx)
    openTurn(agent.session)
    ctx.ultracodeMode.set(agent, true)
    const append = vi.spyOn(agent.session, 'append').mockImplementationOnce(() => {
      throw new Error('backend gone')
    })
    expect(await preStep(ctx, agent)).toMatchObject({ kind: 'enter' })
    expect(warn).toHaveBeenCalledOnce()
    expect(ctx.ultracodeMode.get(agent)).toEqual({ active: false, pending: true })
    append.mockRestore()
    await preStep(ctx, agent)
    expect(modes(agent.session)).toEqual([true])
  })

  it('removes the pre-step commit with the plugin fiber', async () => {
    const ctx = new Context()
    await mountProjectionSeam(ctx)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(AgentRegistry)
    const fiber = await ctx.plugin(UltracodeModeController, CONFIG)
    const agent = await agentWithSession(ctx)
    openTurn(agent.session)
    ctx.ultracodeMode.set(agent, true)
    await fiber.dispose()
    await preStep(ctx, agent)
    expect(modes(agent.session)).toEqual([])
  })
})

describe('the ultracode:policy section', () => {
  it('renders the configured guidance only while the effective state is on', async () => {
    const ctx = await setup()
    expect(await sectionText(ctx)).toBe('')
    const agent = await agentWithSession(ctx)
    expect(await sectionText(ctx, agent)).toBe('')
    openTurn(agent.session)
    ctx.ultracodeMode.set(agent, true)
    // A pending selection shapes the proposed step's assembly.
    expect(await sectionText(ctx, agent)).toBe(SECTION)
    await preStep(ctx, agent)
    expect(await sectionText(ctx, agent)).toBe(SECTION)
    ctx.ultracodeMode.set(agent, false)
    expect(await sectionText(ctx, agent)).toBe('')
  })

  it('leaves the assembly with the plugin fiber', async () => {
    const ctx = new Context()
    await mountProjectionSeam(ctx)
    await ctx.plugin(SystemPrompt)
    const fiber = await ctx.plugin(UltracodeModeController, CONFIG)
    expect(await sectionText(ctx)).toBe('')
    await fiber.dispose()
    expect(await sectionText(ctx)).toBeUndefined()
  })
})

describe('/ultracode', () => {
  async function run(ctx: Context, agent: Agent, line: string) {
    return (await ctx.commands.execute(agent, line, [], new AbortController().signal))?.result
  }

  it('registers only beside a command registry', async () => {
    const ctx = new Context()
    await mountProjectionSeam(ctx)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(UltracodeModeController, CONFIG)
    expect(ctx.get('commands')).toBeUndefined()
    await ctx.plugin(CommandRuntime)
    await new Promise(resolve => setImmediate(resolve))
    const agent = await agentWithSession(ctx)
    expect(ctx.commands.list(agent)).toEqual([{
      definitionId: '@deepseek-ai/dsh-ultracode-mode',
      name: 'ultracode',
      description: 'Turn ultracode orchestration on or off',
      input: { hint: '[on|off]' },
    }])
  })

  it('switches between turns with immediate wording', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    expect(await run(ctx, agent, '/ultracode off')).toEqual({ kind: 'success', text: 'Ultracode is already off.' })
    expect(await run(ctx, agent, '/ultracode')).toEqual({ kind: 'success', text: 'Ultracode on. Use /ultracode off to leave.' })
    expect(await run(ctx, agent, '/ultracode on')).toEqual({ kind: 'success', text: 'Ultracode is already on.' })
    expect(await run(ctx, agent, '/ultracode off')).toEqual({ kind: 'success', text: 'Ultracode off.' })
    expect(await run(ctx, agent, '/ultracode maybe')).toEqual({ kind: 'error', text: 'Usage: /ultracode [on|off]' })
    expect(modes(agent.session)).toEqual([true, false])
    expect(ctx.sessionProjections.snapshot(agent.session).values.ultracode).toEqual({ active: false, pending: false })
  })

  it('queues, repeats, and cancels selections during an open turn', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    openTurn(agent.session)
    const queuedOn = { kind: 'success', text: 'Turning ultracode on (applies from the next step). Use /ultracode off to leave.' }
    expect(await run(ctx, agent, '/ultracode on')).toEqual(queuedOn)
    expect(ctx.sessionProjections.snapshot(agent.session).values.ultracode).toEqual({ active: false, pending: true })
    expect(await run(ctx, agent, '/ultracode on')).toEqual(queuedOn)
    expect(await run(ctx, agent, '/ultracode off')).toEqual({ kind: 'success', text: 'Ultracode entry cancelled.' })
    expect(ctx.sessionProjections.snapshot(agent.session).values.ultracode).toEqual({ active: false, pending: false })

    agent.session.append('ultracode/mode', { active: true })
    const queuedOff = { kind: 'success', text: 'Turning ultracode off (applies from the next step).' }
    expect(await run(ctx, agent, '/ultracode off')).toEqual(queuedOff)
    expect(await run(ctx, agent, '/ultracode off')).toEqual(queuedOff)
    expect(await run(ctx, agent, '/ultracode on')).toEqual({ kind: 'success', text: 'Ultracode exit cancelled.' })
    expect(modes(agent.session)).toEqual([true])
  })

  it('removes the command when the plugin is disposed', async () => {
    const ctx = new Context()
    await mountProjectionSeam(ctx)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(CommandRuntime)
    const fiber = await ctx.plugin(UltracodeModeController, CONFIG)
    await new Promise(resolve => setImmediate(resolve))
    const agent = await agentWithSession(ctx)
    expect(ctx.commands.list(agent).map(command => command.name)).toEqual(['ultracode'])
    await fiber.dispose()
    expect(ctx.commands.list(agent)).toEqual([])
  })
})
