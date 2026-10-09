---
description: "Ultracode 模式：供选择、配置或调试按会话开关的用户和维护者阅读；开启后，大任务通过工作流和并行子代理完成。"
kind: "package-reference"
---

# @deepseek-ai/dsh-ultracode-mode

[English](README.md) | 中文

## 概述

Ultracode 模式要求代理编排大任务，而不是在一个上下文里完成全部工作。开启期间，每次模型请求都会带上部署定义的指引：拆分任务，把相互独立的部分交给并行子代理或工作流脚本，保持主上下文精简，并在汇报前让独立的审查者核对结果。简单请求直接回答。用 `/ultracode` 或 `/ultracode on` 开启，用 `/ultracode off` 关闭，也可以使用 Web 输入框的开关。它与推理强度、模型选择、沙箱模式和审批策略相互独立，并在会话恢复和分叉后保留。

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

Ultracode 适用于能拆成独立部分的大型改动、审计、迁移或调研。常见用法：组合此包并配置指引文本，在工作量足以委派时为会话开启它。

### 何时选择

当并行委派和独立核验值得额外的模型调用时，选择 ultracode。小改动和对话请保持关闭；指引会让代理直接回答这类请求，但该提示词片段在每次请求中仍会消耗 token。指引中点名了 `workflow`、`subagent`、`subagent_fork`、`send_message` 和 `list_agents` 工具，因此请同时组合这些工具，或按部署实际注册的工具名修改文本。

### 最小配置

唯一必需的配置是指引文本；任何其他字段都会在加载时失败。

```yaml
- name: '@deepseek-ai/dsh-ultracode-mode'
  config:
    section: |
      Ultracode is on for this session: orchestrate substantial work with
      parallel subagents and workflows, and verify results before reporting.
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `section` | 必填 | ultracode 开启时作为 `ultracode:policy` 提示词片段渲染的指引 |

随附的 `dsh-base` bundle 和 Web 预设带有默认指引文本。生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-ultracode-mode)完整列出所有可接受字段。

### 切换 ultracode

`/ultracode` 和 `/ultracode on` 开启 ultracode；`/ultracode off` 关闭它。其他参数会返回用法提示，不做任何更改。在两个轮次之间，切换立即生效。轮次运行中，切换从下一步开始生效；在此之前切回原状态会取消这次更改。Web 输入框的开关执行同样的命令。

### 查看 ultracode 状态

界面可以读取 ultracode 是否开启，以及请求的更改是否仍在等待下一步。该状态在所有标签页中一致，并在重启后保留。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

Ultracode 是产品包，而不是能力接缝：它没有可替换的后端，因此状态、指引和命令都在同一个服务 `ctx.ultracodeMode` 中。它不改变工具目录，也不强制执行任何限制；指引只引导代理使用已经组合的工具。

### 持久状态与步骤边界追加

此包持久化一个仅记录于日志、整体替换的事件 `ultracode/mode`，最后一条记录的值就是当前状态。没有打开的轮次时，更改立即追加。轮次打开期间，更改保存在进程内存中，等到下一次被接受的轮内 `agent/pre-step` 才追加该事件；追加失败会记录警告，不会阻塞该步骤，并在下一次被接受的 pre-step 重试。待生效的选择已经会影响所提议步骤的提示词，因此追加之后的请求带有新状态。

### 告知模型

当最近的 `request/header` 告诉模型的是另一种状态时，提交会追加一条来源类型为 `ultracode-mode` 的日志用户通知（"The user turned ultracode on for this session." 或对应的 `off` 形式）。在出现任何请求头之前，提示词片段本身就是唯一的说明。

### 会话投影单元

`ultracode` 单元把 `/ultracode` 命令运行折叠为候选目标，在配对的 `command/done` 时结算，在 `ultracode/mode` 时提交，并派生 `{ active, pending }` 客户端视图。无法解析或未记录的命令输入不会选择任何状态。服务读取此单元和 `turnBoundary` 单元，任一键缺失时都会明确失败。该键从 [`src/types.ts`](src/types.ts) 合并进 `SessionProjectionMap`，卸载插件 fiber 时会注销它。

### 提示词顺序

该片段与 `PLAN_POLICY` 共享顺序 500；顺序相同时按名称排序，因此 `ultracode:policy` 排在 `plan:policy` 之后。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置校验、`ctx.ultracodeMode` 服务、投影单元、`ultracode:policy` 片段、`/ultracode` 命令 |
| [`src/types.ts`](src/types.ts) | `ultracode` 投影键声明和 `UltracodeProjection` 线上值 |
| [`src/client.ts`](src/client.ts) | 类型出口的客户端命名空间再导出 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [workflow/ 包地图](../README.zh.md)——指引所指向的编排工具。
- [ui-ultracode](../../client/ui-ultracode/README.zh.md)——Web 输入框开关。
- [生成的配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-ultracode-mode)——所有可接受的配置字段。
- [dsh-plan-mode](../../plan/plan-mode/README.zh.md)——此包沿用的日志模式写法。

-----

<a id="model-experience"></a>
## 模型体验

### Ultracode 策略系统提示词

#### 模型看到什么

ultracode 开启时，模型在第一方提示词顺序 500 处看到部署配置的 `section` 原文，位于计划模式片段之后；关闭时，该片段不产生文本。

##### 配置示例

```markdown
Ultracode is on for this session: orchestrate substantial work with parallel subagents and workflows, and verify results before reporting.
```

#### Token 影响

关闭时不增加 token；开启时每次请求都加入所配置的片段。随附指引约 300 个 token。编排本身会增加子代理和工作流调用，其开销取决于任务。

#### KV 缓存影响

在 ultracode 保持开启或关闭期间，该片段保持稳定；切换会从顺序 500 起改变系统提示词。

### 人工命令

#### 模型看到什么

`/ultracode`、其参数和结果都不进入模型历史。已提交的切换仅在最近的请求头描述的是另一种状态时追加一条简短的日志用户通知；取消待生效的更改不追加任何内容，因为没有请求观察到它。

#### Token 影响

被告知的切换会增加一条简短且保留的通知；除此之外命令不增加 token。

#### KV 缓存影响

通知追加在可复用前缀之后；此前的片段变化会使顺序 500 之后的缓存失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **指引而非强制**——ultracode 通过文本引导，不要求必须委派，也不检查点名的工具是否存在。
- **工具名写在文本中**——重命名或省略工作流、子代理工具的部署必须相应修改 `section`。
- **待生效的选择只存在于进程内**——如果在轮次最后一次被接受的 pre-step 之后做出选择，而进程在下一次被接受的轮内 pre-step 前退出，该选择会丢失。
- **新建的子代理不继承**——分叉的会话继承已记录的状态，新创建的子代理则从关闭状态开始。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
