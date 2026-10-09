---
description: "Web GUI 的 Ultracode 开关：在输入框中显示并切换会话 ultracode 模式的控件；供 ultracode 的用户和维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-ultracode

[English](README.md) | 中文

## 概述

Ultracode 模式要求代理通过工作流和并行子代理编排大任务。本包在 Web 输入框中添加一个 Ultracode 开关，位于访问模式和计划控件旁边。点击即可为当前会话开启或关闭 ultracode；开启期间按钮保持高亮。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

将此插件与 `ui-conversation` 和 `dsh-ultracode-mode` 一起挂载。之后每个会话的输入框左侧控件行都会显示该开关；没有 ultracode 模式的主机，或尚无会话的草稿，不显示任何内容。

### 开关显示什么

按钮显示一个闪光图标和标签“Ultracode”。关闭时为中性色，开启时为蓝色，并以按下状态向辅助技术报告。轮次运行中做出的更改在等待下一步时，按钮已经显示所请求的状态并加一个小圆点，提示文字说明更改从下一步开始生效。输入 `/ultracode on` 或 `/ultracode off` 也会以同样方式更新开关。

### 失败

准入失败（未知命令、业务错误或传输故障）会在按钮旁显示行内错误，按钮保持主机报告的状态。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

开关加入由 conversation 声明的 `conversation.input.left` 列表；node 半部是空的 apply（花名册行）。它通过标准套件的 `useProjection` 读取 `ultracode` 投影：按下状态为 `pending ? !active : active`，这是主机折叠出的值而非客户端乐观状态，因此到达的帧会双向纠正按钮。注入面只有一个动词 `setUltracode`，它通过 `ctx.remote.commands.execute` 执行 `/ultracode on` 或 `/ultracode off`，并把准入和命令失败映射为行内错误。文案位于 `ultracode` 语言命名空间。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [dsh-ultracode-mode](../../workflow/ultracode-mode/README.zh.md)——负责 ultracode 状态、`/ultracode` 命令、投影和策略片段。
- [ui-conversation](../ui-conversation/README.zh.md)——声明输入框的 `conversation.input.left` 列表。
- [客户端包地图](../README.zh.md)——相邻的浏览器 UI 包。

-----

<a id="model-experience"></a>
## 模型体验

间接影响，通过开关发出的 `/ultracode on` 和 `/ultracode off` 命令行：`dsh-ultracode-mode` 负责这些命令所驱动的模型可见策略片段、切换通知和日志状态。

#### KV 缓存影响

切换 ultracode 会改变 `ultracode:policy` 系统提示词片段，从而改变请求前缀；开关本身不添加提示词内容。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **没有输入框锁定**——左侧控件列表不接收 `locked` 所有者属性，因此输入框锁定时开关仍可点击；主机仍只会从下一步开始应用轮次中的更改。
- **开关属于默认输入框**——计划评审等占用整个输入框的交互会暂时替换 InputBar 及其开关。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
