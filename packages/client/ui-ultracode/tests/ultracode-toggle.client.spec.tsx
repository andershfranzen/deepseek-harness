// @vitest-environment jsdom
/**
 * UltracodeToggle over the `ultracode` projection: nothing renders while the
 * capability is absent; otherwise the pressed state follows the effective
 * target, a click selects the opposite state once, and failures show inline
 * until the projection moves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { UltracodeProjection } from '@deepseek-ai/dsh-ultracode-mode/client'
import { UltracodeToggle, type UltracodeToggleProps } from '../src/client/UltracodeToggle.tsx'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t: UltracodeToggleProps['t'] = makeTranslate(zh, commonZh)

function setup(
  ultracode: UltracodeProjection | undefined,
  setUltracode = vi.fn((_active: boolean) => Promise.resolve<string | null>(null)),
) {
  const store = createSnapshotStore<{ value: UltracodeProjection | undefined }>({ value: ultracode })
  const select = bindSnapshotSelector(store)
  const useProjection: UltracodeToggleProps['useProjection'] = (_key: string) => select(s => s.value)
  const props = { useProjection, setUltracode, t } as Partial<UltracodeToggleProps> as UltracodeToggleProps
  const view = render(<UltracodeToggle {...props} />)
  return { store, setUltracode, view }
}

const toggle = () => screen.getByRole('button', { name: 'Ultracode' })

describe('UltracodeToggle', () => {
  it('renders nothing while the capability is absent', () => {
    const { view } = setup(undefined)
    expect(view.container.innerHTML).toBe('')
  })

  it('shows the effective target as the pressed state', () => {
    setup({ active: false, pending: false })
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(toggle().title).toBe(zh['toggle.off.title'])
    cleanup()
    setup({ active: true, pending: false })
    expect(toggle().getAttribute('aria-pressed')).toBe('true')
    expect(toggle().title).toBe(zh['toggle.on.title'])
    cleanup()
    // A pending exit already reads off and says when it applies.
    setup({ active: true, pending: true })
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(toggle().title).toBe(`${zh['toggle.off.title']} · ${zh['toggle.pending']}`)
  })

  it('selects the opposite state once and follows the projection', async () => {
    let resolve!: (value: string | null) => void
    const setUltracode = vi.fn((_active: boolean) => new Promise<string | null>((done) => { resolve = done }))
    const { store } = setup({ active: false, pending: false }, setUltracode)
    fireEvent.click(toggle())
    expect(setUltracode).toHaveBeenCalledExactlyOnceWith(true)
    expect((toggle() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(toggle())
    expect(setUltracode).toHaveBeenCalledOnce()
    resolve(null)
    store.set({ value: { active: false, pending: true } })
    await waitFor(() => { expect(toggle().getAttribute('aria-pressed')).toBe('true') })
    expect((toggle() as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(toggle())
    expect(setUltracode).toHaveBeenLastCalledWith(false)
  })

  it('shows a returned or thrown failure inline', async () => {
    const setUltracode = vi.fn((_active: boolean) => Promise.resolve<string | null>('unknown command: /ultracode on'))
    setup({ active: false, pending: false }, setUltracode)
    fireEvent.click(toggle())
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe(zh['toggle.failed'])
    expect(status.title).toBe('unknown command: /ultracode on')

    setUltracode.mockRejectedValueOnce(new Error('transport down'))
    fireEvent.click(toggle())
    await waitFor(() => { expect(screen.getByRole('status').title).toBe('transport down') })
    setUltracode.mockRejectedValueOnce('plain failure')
    fireEvent.click(toggle())
    await waitFor(() => { expect(screen.getByRole('status').title).toBe('plain failure') })
  })

  it('ignores a settlement after unmount', async () => {
    let resolve!: (value: string | null) => void
    let reject!: (reason: unknown) => void
    const setUltracode = vi.fn()
      .mockImplementationOnce(() => new Promise<string | null>((done) => { resolve = done }))
      .mockImplementationOnce(() => new Promise<string | null>((_done, fail) => { reject = fail }))
    const first = setup({ active: false, pending: false }, setUltracode)
    fireEvent.click(toggle())
    first.view.unmount()
    resolve('late')
    const second = setup({ active: false, pending: false }, setUltracode)
    fireEvent.click(toggle())
    second.view.unmount()
    reject(new Error('late'))
    await Promise.resolve()
    expect(setUltracode).toHaveBeenCalledTimes(2)
  })
})
