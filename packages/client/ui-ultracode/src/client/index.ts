/** Composer ultracode toggle: switches the session's ultracode mode through `/ultracode`. */
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the ui-conversation SlotMap merge (the input.left list).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the slot registry's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the `ultracode` SessionProjectionMap merge for useProjection.
import type {} from '@deepseek-ai/dsh-ultracode-mode/client'
import { UltracodeToggle } from './UltracodeToggle.tsx'
import { en, zh, type UltracodeKey } from './locales.ts'

export type { UltracodeKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The composer ultracode toggle's copy. */
    ultracode: UltracodeKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'ultracode'

/** Injected business face of the composer ultracode toggle. */
export interface UltracodeToggleInjected {
  /**
   * Select ultracode on or off by executing `/ultracode on` or `/ultracode off`.
   * @param active - the selected state.
   * @returns null on admitted execution; a user-visible failure line otherwise.
   */
  setUltracode: (active: boolean) => Promise<string | null>
}

/** Services for the composer toggle. */
export const inject = ['slots', 'remote', 'remote.commands', 'locale']

/**
 * Register the ultracode toggle into the composer's left control list.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ultracode: dictionaries')
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: '@deepseek-ai/dsh-client-ui-ultracode',
    locale: NS,
    inject: (sessionId: SessionId): UltracodeToggleInjected => ({
      // Failure strings stay English (error-surface policy: not localized).
      setUltracode: async (active) => {
        const line = active ? '/ultracode on' : '/ultracode off'
        const result = await ctx.remote.commands.execute(sessionId, line, [])
        if (!result.ok) return `${result.error.message} (${result.error.code})`
        if (result.value === undefined) return `unknown command: ${line}`
        if (result.value.result.kind === 'error') return result.value.result.text
        return null
      },
    }),
  }, UltracodeToggle))
}
