/**
 * Pure types of the ultracode domain: the one home of the `ultracode`
 * projection-key declaration, free of this package's host-side value imports.
 * `./types` serves host consumers and `./client` re-exports the same content
 * for client aggregates.
 *
 * @module @deepseek-ai/dsh-ultracode-mode/types
 */

import type { CommandId } from '@deepseek-ai/dsh-commands/brand'

/**
 * The ultracode projection's wire value. `active` is the logged state in
 * force (the last `ultracode/mode`, inactive before the first); `pending` is
 * true while a logged `/ultracode` selection targets a state other than
 * `active`, has not failed through its paired `command/done`, and no later
 * `ultracode/mode` event has recorded that state. Capability absence
 * (ultracode-mode not composed) is the key's absence, never a value.
 */
export interface UltracodeProjection {
  active: boolean
  pending: boolean
}

/** Host state used to derive {@link UltracodeProjection}. */
export interface UltracodeUnitState {
  /** Logged ultracode mode. */
  active: boolean
  /** The selection's target mode; null when no selection is outstanding. */
  wanted: boolean | null
  /** The latest `/ultracode` command awaiting its paired settlement. */
  running: { commandId: CommandId; wanted: boolean } | null
  /** Active state recorded by the latest `request/header`, or null. */
  activeAtLastHeader: boolean | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Host ultracode fold state. */
    ultracode: UltracodeUnitState
  }
  interface SessionProjectionMap {
    /** Ultracode mode folded from the `/ultracode` command lifecycle and `ultracode/mode` events. */
    ultracode: UltracodeProjection
  }
}
