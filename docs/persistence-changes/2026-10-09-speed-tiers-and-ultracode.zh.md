---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-09-speed-tiers-and-ultracode

[English](2026-10-09-speed-tiers-and-ultracode.md) | 中文

## 概述

为 model/selection 和 request/header 配置新增可选的速度档位字段，并新增 ultracode/mode 事件和 ultracode-mode 消息来源类型。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-09-speed-tiers-and-ultracode
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-09-21-user-question-reply"
    after: "b03588c595acd07dcbd87d1efdf9b05b985ca4fe9568e008e9ac1601dbb0d349"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-09-21-user-question-reply"
    after: "86ff77840b4f6c616ca04a8db0f93dd2322c1a8acb2c80bc4b5eebe990c2f409"
    decision: same-version
  - root: "event:model/selection"
    previous: "2026-09-11-initial"
    after: "67f22ce1dded9429ffdd79746f678358c82de680c1e4e0fa1fad00cd4c2c7768"
    decision: same-version
  - root: "event:request/header"
    previous: "2026-09-16-session-format-v4"
    after: "1548b3c273f8d8c673885c03efff056e1e9c03a4ad8f61891316d5110d34b648"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-09-21-user-question-reply"
    after: "918997262d836c4cbe1f8e6bc56bd70a5880234d0f790bddd24ecfeaeb0a18f4"
    decision: same-version
  - root: "event:ultracode/mode"
    previous: null
    after: "96b4ea64e857dd4d4e7e22b814ab3922e792e72d0cbb34c81fd912e6d1327416"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-09-21-user-question-reply"
    after: "f92d57588ded5fcde3d2992be4c0a1c7e2b59e64517229df40fb63c07ea256c5"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

已有日志仍然有效。speed 是可选字段，缺省表示标准档位，因此旧日志按原样回放。ultracode/mode 是新的整值事件，只有带 dsh-ultracode-mode 的构建会写入。ultracode-mode 来源类型仅用于归属：读取方在没有写入方时保留通知文本，且没有任何折叠读取该类型。

<a id="verification"></a>
## 验证

dsh-llm、dsh-llm-pi-ai、agent、agent-loop、session-controller、subagent、acp 和 ultracode-mode 的聚焦 vitest 测试通过，其中包括 session-controller 从目录到投影的速度往返测试，以及经 Loader 启动的 ultracode-mode 组合测试。

<a id="dev-note"></a>
## 开发备注

无。
