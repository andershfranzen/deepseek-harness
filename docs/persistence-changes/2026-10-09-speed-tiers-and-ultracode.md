---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-09-speed-tiers-and-ultracode

English | [中文](2026-10-09-speed-tiers-and-ultracode.zh.md)

## Summary

Adds optional speed tier fields to model/selection and request/header config, the ultracode/mode event, and the ultracode-mode message source kind.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

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
## Compatibility

Existing logs remain valid. speed is optional and absent means the standard tier, so older logs replay unchanged. ultracode/mode is a new whole-value event that only builds with dsh-ultracode-mode write. The ultracode-mode source kind is attribution-only: readers preserve the notice text without the producer, and no fold reads the kind.

<a id="verification"></a>
## Verification

Focused vitest suites for dsh-llm, dsh-llm-pi-ai, agent, agent-loop, session-controller, subagent, acp, and ultracode-mode pass, including a session-controller catalog-to-projection speed round trip and a Loader-booted ultracode-mode composition.

<a id="dev-note"></a>
## Dev Note

None.
