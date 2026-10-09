import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconSparkleRegular } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the input.left list).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { UltracodeToggleInjected } from './index.ts'
import css from './UltracodeToggle.module.css'

/** Full toggle props: runtime share & injected share & the locale seat. */
export type UltracodeToggleProps =
  PropsRuntime<'conversation.input.left'> & InjectFace<UltracodeToggleInjected> & PropsLocale<'ultracode'>

/**
 * Ultracode on/off toggle over the host-computed `ultracode` projection. The
 * pressed state is the effective target (`pending ? !active : active` — a
 * folded host value, not client optimism); a click executes `/ultracode on`
 * or `/ultracode off` toward the opposite state. Nothing renders while the
 * capability is absent.
 */
export function UltracodeToggle({ useProjection, setUltracode, t }: UltracodeToggleProps) {
  const ultracode = useProjection('ultracode')
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  if (ultracode === undefined) return null
  const target = ultracode.pending ? !ultracode.active : ultracode.active

  const toggle = (): void => {
    // No switching guard: it disables the button, so no click arrives.
    setSwitching(true)
    setError(null)
    void setUltracode(!target).then((failure) => {
      if (!aliveRef.current) return
      setSwitching(false)
      setError(failure)
    }, (reason: unknown) => {
      if (!aliveRef.current) return
      setSwitching(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const title = target ? t('toggle.on.title') : t('toggle.off.title')
  return (
    <span className={css.wrap}>
      <button
        type="button"
        className={clsx(css.toggle, target && css.on)}
        aria-pressed={target}
        title={ultracode.pending ? `${title} · ${t('toggle.pending')}` : title}
        disabled={switching}
        onClick={toggle}
      >
        <IconSparkleRegular className={css.glyph} size={14} />
        {t('toggle.label')}
        {ultracode.pending && <span className={css.pendingDot} aria-hidden />}
      </button>
      {error !== null && <span className={css.error} role="status" title={error}>{t('toggle.failed')}</span>}
    </span>
  )
}
