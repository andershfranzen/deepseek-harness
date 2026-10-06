/** a5 occupants for the sidebar and conversation-hero brand-mark slots. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { A5Mark } from './A5Mark.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Shadowing rank below the default 0, so the a5 mark wins over the official
 * occupant in builds where both register.
 */
const A5_PRIORITY = -1

/**
 * Fill each brand-mark slot while its declaration is live. The sidebar and
 * hero declarations collapse independently, so each mark installs on its own.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.register({ name: 'sidebar.brand.mark', priority: A5_PRIORITY }, A5Mark))
  ctx.slots.inject('conversation.hero.brand.mark', () =>
    ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: A5_PRIORITY }, A5Mark))
}
