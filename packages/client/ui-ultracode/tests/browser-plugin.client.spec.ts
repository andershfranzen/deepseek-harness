/**
 * ui-ultracode browser half on a real SlotRegistry: the plugin joins the
 * conversation-declared `conversation.input.left` list with the toggle, the
 * injected face executes `/ultracode on|off` and folds admission outcomes
 * into null (admitted) or a user-visible failure line, and teardown empties
 * the list (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { RemoteError } from '@deepseek-ai/dsh-client-test-runtime'
import { UltracodeToggle } from '../src/client/UltracodeToggle.tsx'
import type { UltracodeToggleInjected } from '../src/client/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'

const SID = 's-ultracode' as SessionId

async function bench(declare = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const declareRoot = () => slots.register({
    name: 'root', children: { 'conversation.input.left': { kind: 'list', scope: 'session' } },
  } as never, () => null)
  if (declare) declareRoot()
  const execute = vi.fn((_sessionId: SessionId, _line: string, _attachments: readonly never[]) =>
    Promise.resolve({ ok: true, value: { commandId: 'c1', result: { kind: 'success' as const } } }))
  const commandsRemote = { execute }
  ctx.provide('remote', { commands: commandsRemote })
  ctx.provide('remote.commands', commandsRemote)
  ctx.provide('locale', new LocaleRuntime(ctx))
  return { ctx, slots, execute, declareRoot }
}

describe('ui-ultracode browser apply', () => {
  it('keeps the node half inert', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })

  it('waits for the composer declaration before registering', async () => {
    const b = await bench(false)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('conversation.input.left')).toHaveLength(0)
    b.declareRoot()
    await Promise.resolve()
    expect(b.slots.entries('conversation.input.left')).toHaveLength(1)
    await fiber.dispose()
  })

  it('registers the toggle, executes /ultracode, and unregisters on teardown', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = b.slots.entries('conversation.input.left')[0]!
    expect(entry.component).toBe(UltracodeToggle)
    const resolve = entry.inject as NonNullable<typeof entry.inject> & ((id: SessionId) => UltracodeToggleInjected)
    const injected = resolve(SID)

    await expect(injected.setUltracode(true)).resolves.toBeNull()
    expect(b.execute).toHaveBeenLastCalledWith(SID, '/ultracode on', [])
    await expect(injected.setUltracode(false)).resolves.toBeNull()
    expect(b.execute).toHaveBeenLastCalledWith(SID, '/ultracode off', [])

    b.execute.mockResolvedValueOnce({
      ok: false,
      error: new RemoteError('session/not-found', 'gone', { sessionId: SID }),
    } as never)
    await expect(injected.setUltracode(true)).resolves.toBe('gone (session/not-found)')

    // Unmatched admission (ultracode-mode not composed host-side).
    b.execute.mockResolvedValueOnce({ ok: true, value: undefined } as never)
    await expect(injected.setUltracode(true)).resolves.toBe('unknown command: /ultracode on')

    b.execute.mockResolvedValueOnce({ ok: true, value: { commandId: 'c2', result: { kind: 'error', text: 'Usage: /ultracode [on|off]' } } } as never)
    await expect(injected.setUltracode(true)).resolves.toBe('Usage: /ultracode [on|off]')

    expect(b.ctx.locale.bind('ultracode')('toggle.label')).toBe('Ultracode')
    await fiber.dispose()
    expect(b.slots.entries('conversation.input.left')).toHaveLength(0)
  })
})
