---
name: "ioca-react-component-usage"
description: "Guides usage of @ioca/react components by mining this repo’s exports, types, and docs demos. Invoke when user asks how to use any ioca-react component or hook."
---

# IOCA React Component Usage

Use this skill to answer “How do I use X?” questions for this component library by grounding the answer in the repository’s actual exports, props types, and docs demos.
Check the api from dev documentation: https://ioca-react.vercel.app/docs/button(https://ioca-react.vercel.app/docs/${component})

## Fast Navigation Cheatsheet

- Component list / public exports: `@ioca/react`
- Docs page: `https://ioca-react.vercel.app/docs/<name>`
- Docs demos + API: `https://ioca-react.vercel.app/docs/<name>`

### Example: “How to use Input?”

Grounding path:

- Demos + API: `https://ioca-react.vercel.app/docs/input`
- Types: `@ioca/react/components/<name>/type`

Answer format:

- Import: `import { Input } from "@ioca/react";`
- Example: show `Input`, `Input.Number`, `Input.Range`, `Input.Textarea` patterns mirroring the docs demos.

### Example: “How to open a Modal?”

Answer format:

- Controlled `visible` example with `Button` triggering `setVisible(true)` and `Modal` closing via `onClose`.
