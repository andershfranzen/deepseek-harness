/**
 * REAL-composition coverage: a test-only cordis.yml carrying the shipped
 * ultracode row boots through the vendored Loader beside the real agent loop,
 * command registry, and system prompt. Only the model is scripted. The
 * configured guidance reaches the request system message exactly while
 * ultracode is on, and `/ultracode` drives the logged state.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader, { type ModuleLoaderV2 } from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime, { createUserMessage, type GenerateOptions, type RequestMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import UltracodeModeController from '@deepseek-ai/dsh-ultracode-mode'
import { MockAdapter, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const SECTION = 'Ultracode composed guidance: fan out with workflow and subagent.'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function boot(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-ultracode-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-llm'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-agent-loop'",
    '  config:',
    '    agents: []',
    "- name: '@deepseek-ai/dsh-commands'",
    '- id: ultracode-mode',
    "  name: '@deepseek-ai/dsh-ultracode-mode'",
    '  config:',
    '    section: |',
    `      ${SECTION}`,
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-llm', LlmRuntime],
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-agent-loop', AgentLoop],
    ['@deepseek-ai/dsh-commands', CommandRuntime],
    ['@deepseek-ai/dsh-ultracode-mode', UltracodeModeController],
  ])
  const internal: ModuleLoaderV2 = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
    loadCache: new Map(),
    register(): never { throw new Error('unexpected module hook registration') },
    getOrCreateModuleJob(): never { throw new Error('unexpected module job creation') },
    resolveSync(): never { throw new Error('unexpected synchronous module resolution') },
    load(): never { throw new Error('unexpected module load') },
  }
  ctx.loader.internal = internal
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  return ctx
}

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
}

function textOf(message: RequestMessage): string {
  return message.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

function requestSystem(options: GenerateOptions | undefined): string {
  const head = options?.messages[0]
  if (head?.role !== 'system') throw new Error('the request does not lead with a system message')
  return textOf(head)
}

async function prompt(ctx: Context, agent: Agent, text: string): Promise<void> {
  const idle = waitForIdle(ctx, agent)
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
  await idle
}

describe('ultracode-mode real Loader composition through cordis.yml', () => {
  it('carries the configured guidance only while /ultracode has it on', async () => {
    const ctx = await boot()
    const unloaded = [...ctx.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])

    const adapter = new MockAdapter([
      textResponse('Default turn.'),
      textResponse('Ultracode turn.'),
      textResponse('Back to default.'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const agent = await ctx.agentLoop.create(SessionId('ultracode-loader'), { provider: 'mock', model: 'mock' })
    const signal = new AbortController().signal
    expect(ctx.commands.list(agent).map(command => command.name)).toContain('ultracode')

    await prompt(ctx, agent, 'hello')
    expect(requestSystem(adapter.requests[0])).not.toContain(SECTION)

    const on = await ctx.commands.execute(agent, '/ultracode on', [], signal)
    expect(on?.result).toEqual({ kind: 'success', text: 'Ultracode on. Use /ultracode off to leave.' })
    expect(ctx.sessionProjections.snapshot(agent.session).values.ultracode).toEqual({ active: true, pending: false })
    await prompt(ctx, agent, 'refactor the repository')
    expect(requestSystem(adapter.requests[1])).toContain(SECTION)
    // The model already saw the default-mode header, so the switch is narrated.
    const ultracodeRequest = adapter.requests[1]?.messages.map(textOf) ?? []
    expect(ultracodeRequest).toContain('The user turned ultracode on for this session.')

    const off = await ctx.commands.execute(agent, '/ultracode off', [], signal)
    expect(off?.result).toEqual({ kind: 'success', text: 'Ultracode off.' })
    await prompt(ctx, agent, 'thanks')
    expect(requestSystem(adapter.requests[2])).not.toContain(SECTION)

    const modes = agent.session.snapshotEvents()
      .filter(event => event.type === 'ultracode/mode')
      .map(event => event.type === 'ultracode/mode' && event.data.active)
    expect(modes).toEqual([true, false])
  }, 30_000)
})
