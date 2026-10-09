---
description: "Ultracode mode for users and maintainers choosing, configuring, or debugging the per-session switch that steers substantial work through workflows and parallel subagents."
kind: "package-reference"
---

# @deepseek-ai/dsh-ultracode-mode

English | [中文](README.zh.md)

## Summary

Ultracode mode asks an agent to orchestrate substantial work instead of doing all of it in one context. While it is on, every model request carries deployment-defined guidance: break the task down, send independent pieces to parallel subagents or a workflow script, keep the main context small, and have independent reviewers check results before reporting. Trivial requests get direct answers. Turn it on with `/ultracode` or `/ultracode on`, turn it off with `/ultracode off`, or use the Web composer toggle. It is independent of reasoning effort, model choice, sandbox mode, and approval policy, and it survives session resume and forks.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Use ultracode for large changes, audits, migrations, or research that split into independent pieces. The common path: compose the package with its guidance text, then switch it on for a session when the work is big enough to delegate.

### When to choose it

Choose ultracode when parallel delegation and independent verification are worth their extra model calls. Leave it off for small edits and conversations; the guidance tells the agent to answer those directly, but the section still costs tokens on every request. The guidance names the `workflow`, `subagent`, `subagent_fork`, `send_message`, and `list_agents` tools, so compose those tools beside it or adjust the text to the tool names your deployment registers.

### Minimal configuration

The only required configuration is the guidance text; any other field fails at load.

```yaml
- name: '@deepseek-ai/dsh-ultracode-mode'
  config:
    section: |
      Ultracode is on for this session: orchestrate substantial work with
      parallel subagents and workflows, and verify results before reporting.
```

| Field | Default | Meaning |
|---|---|---|
| `section` | required | Guidance rendered as the `ultracode:policy` prompt section while ultracode is on |

The shipped `dsh-base` bundle and the Web presets carry the default guidance text. The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-ultracode-mode) is the exhaustive source for every accepted field.

### Switching ultracode

`/ultracode` and `/ultracode on` turn ultracode on; `/ultracode off` turns it off. Any other argument fails with a usage line and changes nothing. Between turns the switch takes effect immediately. During a running turn it applies from the next step, and switching back before then cancels the change. The Web composer toggle runs the same commands.

### Observing ultracode state

Interfaces read whether ultracode is on and whether a requested change is still waiting for the next step. The state is the same in every tab and survives restarts.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design philosophy

Ultracode is a product package, not a capability seam: it has no swappable backend, so the state, guidance, and command live in one service, `ctx.ultracodeMode`. It changes no tool catalog and enforces nothing; the guidance steers the agent toward tools that are already composed.

### Durable state and step-boundary appends

The package persists one log-only whole-value event, `ultracode/mode`, and the last logged value is the state. A change appends immediately when no turn is open. During an open turn it stays pending in process memory until the next accepted in-turn `agent/pre-step`, which appends the event; a failed append is logged as a warning, never blocks the step, and is retried at the next accepted pre-step. A pending selection already shapes the proposed step's prompt, so the request that follows the append carries the new state.

### Narration

When the latest `request/header` told the model the other state, the commit adds one logged user notice with source kind `ultracode-mode` ("The user turned ultracode on for this session." or the `off` form). Before any request header, the section itself is the only statement.

### Session projection unit

The `ultracode` unit folds `/ultracode` command runs into a candidate target, settles it on the paired `command/done`, commits on `ultracode/mode`, and derives the `{ active, pending }` client view. Unparsable or unrecorded command input never selects a state. The service reads this unit and the `turnBoundary` unit and fails explicitly if either key is absent. The key merges into `SessionProjectionMap` from [`src/types.ts`](src/types.ts), and unloading the plugin fiber unregisters it.

### Prompt order

The section shares the `PLAN_POLICY` order (500); equal orders sort by name, so `ultracode:policy` follows `plan:policy`.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: config validation, the `ctx.ultracodeMode` service, projection unit, `ultracode:policy` section, `/ultracode` command |
| [`src/types.ts`](src/types.ts) | The `ultracode` projection-key declaration and `UltracodeProjection` wire value |
| [`src/client.ts`](src/client.ts) | Client-namespace re-export of the types outlet |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [workflow/ package map](../README.md) — the orchestration tools the guidance points at.
- [ui-ultracode](../../client/ui-ultracode/README.md) — the Web composer toggle.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-ultracode-mode) — every accepted config field.
- [dsh-plan-mode](../../plan/plan-mode/README.md) — the logged-mode pattern this package follows.

-----

<a id="model-experience"></a>
## Model Experience

### Ultracode policy system prompt

#### What the model sees

While ultracode is on, the model sees the deployment's exact `section` text at first-party prompt order 500, after any plan-mode section; while it is off, the section contributes no text.

##### Configuration example

```markdown
Ultracode is on for this session: orchestrate substantial work with parallel subagents and workflows, and verify results before reporting.
```

#### Token effect

Off adds no tokens; on adds the configured section to every request. The shipped guidance is about 300 tokens. Orchestration itself adds subagent and workflow calls whose cost depends on the task.

#### KV Cache effect

The section is stable while ultracode stays on or off, but switching changes the system prompt from order 500 onward.

### Human command

#### What the model sees

`/ultracode`, its arguments, and its results stay outside model history. A committed switch adds one short logged user notice only when the last request header described the other state; cancelling a pending change adds none because no request observed it.

#### Token effect

A narrated switch adds one short retained notice; otherwise the command adds no tokens.

#### KV Cache effect

The notice is appended after the reusable prefix; the earlier section change invalidates the cache from order 500 onward.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Guidance, not enforcement** — ultracode steers through text; it does not require delegation or check that the named tools exist.
- **Tool names live in the text** — a deployment that renames or omits the workflow or subagent tools must edit `section` to match.
- **Pending selections are process-local** — a selection made after the turn's final accepted pre-step is lost if the process exits before another accepted in-turn pre-step.
- **Not inherited by spawned agents** — forked sessions inherit the logged state, while newly spawned subagents begin with ultracode off.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
