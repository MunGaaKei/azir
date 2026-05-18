# Rules

## Core Principles

1. **Prefer library components** — Use components from the table directly; do not reimplement the same functionality
2. **Type safety** — Always import types from `@ioca/react/components/{name}/type`
3. **Import on demand** — Only import what you need; rely on ES Module tree-shaking
4. **Props fidelity** — Follow type definitions strictly; do not invent non-existent props
5. **Compound components** — Some components expose sub-components as static properties (e.g. `Button.Toggle`, `Form.Field`); verify via type definitions before use
6. **Imperative APIs** — `Message`, `Modal` etc. are called imperatively, not rendered as JSX

## Never

- Never guess prop names — always check `type.ts`
- Never use `Form.Item` — Form's child component is `Form.Field`
- Never render `Message` as JSX — `Message.success(content)` is a function call
- Never use `data` as the Select option prop — Select uses `options`
- Never invent event callbacks or sub-components that don't exist in the type definitions
- Never import components not listed in the component table
- Never use `Modal` directly as JSX — use imperative APIs like `Modal.confirm()`
- Never override `@ioca/react` component styles directly — use component Props for customization

## Compound Components

Some components expose sub-components as static properties. Verify type definitions before use:

| Parent | Child | Purpose |
|--------|-------|---------|
| `Button` | `Button.Toggle` | Toggle button |
| `Button` | `Button.Group` | Button group |
| `Button` | `Button.Confirm` | Confirm button |
| `Form` | `Form.Field` | Form field wrapper |
| `Form` | `Form.useForm` | Form instance Hook |
| `Form` | `Form.useConfig` | Form config Hook |
| `Input` | `Input.Textarea` | Textarea |
| `Input` | `Input.Number` | Number input |
| `Input` | `Input.Range` | Range input |
| `Tabs` | `Tabs.Item` | Tab item |

## Props Quick Reference

To inspect component Props, open the corresponding type file:

```
@ioca/react/components/{name}/type.ts  →  interface I{Name}
```

Example: `@ioca/react/components/button/type` → `IButton`
