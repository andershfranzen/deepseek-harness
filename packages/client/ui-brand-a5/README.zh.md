---
description: "Web 客户端侧栏与会话首屏的 a5 品牌标志，替换鲸鱼；供选择品牌呈现的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-a5

[English](README.md) | 中文

## 概述

本包用 [afive.dk](https://afive.dk/) 的 a5 标志替换侧栏与空白会话首屏中的鲸鱼标志。它在所有客户端构建 profile 中生效，不改变侧栏名称、浏览器标题与 Chat 运行指示器。本包不保留运行时状态，也不影响模型请求。

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

Web 应用包默认以 `ui-brand-a5` 行挂载本插件。移除或禁用该行即可恢复鲸鱼。标志使用周围文字颜色渲染，因此跟随浅色与深色主题。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

标志是一条 SVG 填充路径：Instrument Serif Italic 的 "a" 后接 Instrument Serif Regular 的 "5"，"5" 下移 0.2em，字距 -0.025em，与 afive.dk 标题一致。轮廓来自 SIL Open Font License 1.1 授权的 Instrument Serif，因此浏览器不加载任何网络字体。每个填充通过各自的 `ctx.slots.inject()` 以 priority -1 注册，因此在 `official` 构建中遮蔽 `dsh-client-ui-brand-official` 的侧栏标志，并在其声明 entry 挂载时安装。浏览器部分是 [`src/client/index.ts`](src/client/index.ts)；node 部分是空的 Loader 座位。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

阅读这些页面了解本包占据的 slot 及其遮蔽的品牌包。

- [ui-sidebar](../ui-sidebar/README.zh.md) — 声明 `sidebar.brand.mark`。
- [ui-conversation](../ui-conversation/README.zh.md) — 声明 `conversation.hero.brand.mark`。
- [ui-brand-official](../ui-brand-official/README.zh.md) — 官方侧栏标志与名称。

-----

<a id="model-experience"></a>
## 模型体验

无，本包只提供浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制是当前的包约束，而非任务清单。

- **未经 slot 的鲸鱼仍然存在** — Chat 运行指示器与完整的 `BrandWordmark` 直接绘制鲸鱼，而不经过 slot。
- **没有悬停变形** — 首屏会对 a5 标志应用摇摆动画，但鲸鱼的游动变形只属于回退。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
