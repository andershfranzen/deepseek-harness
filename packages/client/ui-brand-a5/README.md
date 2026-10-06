---
description: "a5 brand mark for the Web client's sidebar and conversation hero, replacing the whale; for users and maintainers choosing brand presentation."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-a5

English | [中文](README.zh.md)

## Summary

This package replaces the whale mark in the sidebar and on the blank-conversation hero with the a5 mark from [afive.dk](https://afive.dk/). It applies in every client build profile and leaves the sidebar name, the browser title, and the Chat running indicator unchanged. It has no runtime state and does not affect model requests.

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

The Web app bundle mounts this plugin by default as the `ui-brand-a5` row. Remove or disable that row to restore the whale. The mark renders in the surrounding text color, so it follows the light and dark themes.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The mark is one SVG fill path: the Instrument Serif Italic "a" followed by the Instrument Serif Regular "5", dropped 0.2em at -0.025em tracking, matching the afive.dk headline. Outlines come from Instrument Serif under the SIL Open Font License 1.1, so the browser loads no web font. Each occupant registers at priority -1 through its own `ctx.slots.inject()`, so it shadows the `dsh-client-ui-brand-official` sidebar mark in `official` builds and installs whenever its declaring entry mounts. The browser half is [`src/client/index.ts`](src/client/index.ts); the node half is an empty Loader seat.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages for the slots this package occupies and the brand package it shadows.

- [ui-sidebar](../ui-sidebar/README.md) — declares `sidebar.brand.mark`.
- [ui-conversation](../ui-conversation/README.md) — declares `conversation.hero.brand.mark`.
- [ui-brand-official](../ui-brand-official/README.md) — the official sidebar mark and name.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits are current package constraints, not a task backlog.

- **Unslotted whales remain** — the Chat running indicator and the full `BrandWordmark` draw the whale directly rather than through a slot.
- **No hover animation** — the hero applies its sway animation to the a5 mark, but the whale's swim morph belongs to the fallback only.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
