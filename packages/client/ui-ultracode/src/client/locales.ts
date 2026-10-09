/** `ultracode` namespace dictionaries (the composer ultracode toggle's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'toggle.label': 'Ultracode',
  'toggle.on.title': 'Ultracode 已开启：大任务会拆分给工作流和并行子代理。点击关闭（/ultracode off）',
  'toggle.off.title': 'Ultracode 已关闭。点击开启，让大任务通过工作流和并行子代理完成（/ultracode on）',
  'toggle.pending': '将从下一步开始生效',
  'toggle.failed': '切换 Ultracode 失败',
} satisfies Record<string, string>

/** The ultracode namespace key union. */
export type UltracodeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'toggle.label': 'Ultracode',
  'toggle.on.title': 'Ultracode on: substantial work is split across workflows and parallel subagents. Click to turn off (/ultracode off)',
  'toggle.off.title': 'Ultracode off. Click to orchestrate substantial work through workflows and parallel subagents (/ultracode on)',
  'toggle.pending': 'Applies from the next step',
  'toggle.failed': 'Failed to switch ultracode',
} satisfies Record<UltracodeKey, string>
