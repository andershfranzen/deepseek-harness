---
description: "Ultracode toggle for the Web GUI: the composer control that shows and switches a session's ultracode mode; for users and maintainers of ultracode."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-ultracode

English | [中文](README.zh.md)

## Summary

Ultracode mode asks the agent to orchestrate substantial work through workflows and parallel subagents. This package adds an Ultracode toggle to the Web composer, next to the access-mode and plan controls. Click it to turn ultracode on or off for the current session; the button stays highlighted while ultracode is on.

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

Mount this plugin beside `ui-conversation` and `dsh-ultracode-mode`. The toggle then appears in the composer's left control row for every session; a host without ultracode mode, or a Draft with no session, shows nothing.

### What the toggle shows

The button shows a sparkle glyph and the label "Ultracode". It is neutral while ultracode is off and blue while it is on, and reports its state as a pressed toggle to assistive technology. While a change made during a running turn waits for the next step, the button already shows the requested state, adds a small dot, and its tooltip says the change applies from the next step. Typing `/ultracode on` or `/ultracode off` updates the toggle the same way.

### Failures

Admission failures (an unknown command, a business error, or a transport fault) surface as an inline error beside the button, and the button keeps the state the host reports.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The toggle joins the conversation-declared `conversation.input.left` list; the node half is an empty apply (the roster row). It reads the `ultracode` projection through the standard-kit `useProjection`: the pressed state is `pending ? !active : active`, a folded host value rather than client optimism, so an arriving frame corrects the button either way. The injected face carries one verb, `setUltracode`, which executes `/ultracode on` or `/ultracode off` through `ctx.remote.commands.execute` and maps admission and command failures to an inline error line. Copy lives in the `ultracode` locale namespace.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [dsh-ultracode-mode](../../workflow/ultracode-mode/README.md) — owns ultracode state, the `/ultracode` command, the projection, and the policy section.
- [ui-conversation](../ui-conversation/README.md) — declares the composer's `conversation.input.left` list.
- [Client package map](../README.md) — adjacent browser UI packages.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the `/ultracode on` and `/ultracode off` command lines the toggle dispatches: `dsh-ultracode-mode` owns the model-visible policy section, the switch notice, and the logged state those lines drive.

#### KV Cache effect

Switching ultracode changes the `ultracode:policy` system-prompt section and therefore the request prefix; the toggle itself adds no prompt content.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No composer lock** — the left control list receives no `locked` owner prop, so the toggle stays clickable while the composer is locked; the host still applies a mid-turn change only from the next step.
- **The toggle belongs to the default composer** — a whole-composer interaction such as plan review temporarily replaces the InputBar and its toggle.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
