---
name: ioca-components
description: When the user's project has @ioca/react installed, use these components to build React UIs. Provides import patterns, type imports, and documentation URLs for all available components.
---

# ioca-components

## Purpose

Guide AI to prioritize `@ioca/react` components when building React UIs in projects that depend on it. Provides an accurate component inventory, type definition paths, and documentation URLs to avoid reinventing the wheel or hallucinating non-existent APIs.

## When To Use

- User asks to build React components/pages and `package.json` includes `@ioca/react`
- User asks about available components or component Props types

## Inputs

- Functional description or design spec of the target component
- Props or data structures the component needs to accept

## Workflow

1. **Verify environment** — Check `package.json` for `@ioca/react` dependency; abort if not found
2. **Match component** — Look up the component table below for a match based on functional requirements
3. **Check types** — Get the type path from the table, open the type file to confirm the Props interface
4. **Import & code** — Import components and types according to rules, implement functionality
5. **Verify docs** — When unsure about API usage, click the doc link for detailed reference
6. **No match** — If no component in the table fits, fall back to custom implementation

## Rules

See [rules.md](./rules.md).

## Import Syntax

```tsx
import { Button, Select, Modal } from "@ioca/react";
import type { IButton } from "@ioca/react/components/button/type";
import type { ISelect } from "@ioca/react/components/select/type";
```

## Complete Component List

| Category | Component | Import Name | Type Path | Docs |
|----------|-----------|-------------|-----------|------|
| General | Button | `Button` | `@ioca/react/components/button/type` → `IButton` | [docs](https://ioca-react.vercel.app/docs/button) |
| General | Icon | `Icon` | `@ioca/react/components/icon/type` → `IIcon` | [docs](https://ioca-react.vercel.app/docs/icon) |
| General | Tag | `Tag` | `@ioca/react/components/tag/type` → `ITag` | [docs](https://ioca-react.vercel.app/docs/tag) |
| General | Text | `Text` | `@ioca/react/components/text/type` → `IText` | [docs](https://ioca-react.vercel.app/docs/text) |
| Layout | Card | `Card` | `@ioca/react/components/card/type` → `ICard` | [docs](https://ioca-react.vercel.app/docs/card) |
| Layout | Flex | `Flex` | `@ioca/react/components/flex/type` → `IFlex` | [docs](https://ioca-react.vercel.app/docs/flex) |
| Layout | River | `River` | `@ioca/react/components/river/type` → `IRiver` | [docs](https://ioca-react.vercel.app/docs/river) |
| Layout | Description | `Description` | `@ioca/react/components/description/type` → `IDescription` | [docs](https://ioca-react.vercel.app/docs/description) |
| Layout | Collapse | `Collapse` | `@ioca/react/components/collapse/type` → `ICollapse` | [docs](https://ioca-react.vercel.app/docs/collapse) |
| Layout | Tabs | `Tabs` | `@ioca/react/components/tabs/type` → `ITabs` | [docs](https://ioca-react.vercel.app/docs/tabs) |
| Layout | Step | `Step` | `@ioca/react/components/step/type` → `IStep` | [docs](https://ioca-react.vercel.app/docs/step) |
| Layout | List | `List` | `@ioca/react/components/list/type` → `IList` | [docs](https://ioca-react.vercel.app/docs/list) |
| Layout | Swiper | `Swiper` | `@ioca/react/components/swiper/type` → `ISwiper` | [docs](https://ioca-react.vercel.app/docs/swiper) |
| Layout | Scroll | `Scroll` | `@ioca/react/components/scroll/type` → `IScroll` | [docs](https://ioca-react.vercel.app/docs/scroll) |
| Layout | Resizable | `Resizable` | `@ioca/react/components/resizable/type` → `IResizable` | [docs](https://ioca-react.vercel.app/docs/resizable) |
| Navigation | Affix | `Affix` | `@ioca/react/components/affix/type` → `IAffix` | [docs](https://ioca-react.vercel.app/docs/affix) |
| Navigation | Dropdown | `Dropdown` | `@ioca/react/components/dropdown/type` → `IDropdown` | [docs](https://ioca-react.vercel.app/docs/dropdown) |
| Navigation | Pagination | `Pagination` | `@ioca/react/components/pagination/type` → `IPagination` | [docs](https://ioca-react.vercel.app/docs/pagination) |
| Data Entry | Input | `Input` | `@ioca/react/components/input/type` → `IInput` | [docs](https://ioca-react.vercel.app/docs/input) |
| Data Entry | Select | `Select` | `@ioca/react/components/select/type` → `ISelect` | [docs](https://ioca-react.vercel.app/docs/select) |
| Data Entry | Checkbox | `Checkbox` | `@ioca/react/components/checkbox/type` → `ICheckbox` | [docs](https://ioca-react.vercel.app/docs/checkbox) |
| Data Entry | Radio | `Radio` | `@ioca/react/components/radio/type` → `IRadio` | [docs](https://ioca-react.vercel.app/docs/radio) |
| Data Entry | Form | `Form` | `@ioca/react/components/form/type` → `IForm` | [docs](https://ioca-react.vercel.app/docs/form) |
| Data Entry | DatePicker | `DatePicker` | `@ioca/react/components/picker/type` → `IDatePicker` | [docs](https://ioca-react.vercel.app/docs/date-picker) |
| Data Entry | TimePicker | `TimePicker` | `@ioca/react/components/picker/type` → `ITimePicker` | [docs](https://ioca-react.vercel.app/docs/time-picker) |
| Data Entry | ColorPicker | `ColorPicker` | `@ioca/react/components/picker/type` → `IColorPicker` | [docs](https://ioca-react.vercel.app/docs/color-picker) |
| Data Entry | Editor | `Editor` | `@ioca/react/components/editor/type` → `IEditor` | [docs](https://ioca-react.vercel.app/docs/editor) |
| Data Entry | Upload | `Upload` | `@ioca/react/components/upload/type` → `IUpload` | [docs](https://ioca-react.vercel.app/docs/upload) |
| Data Display | Badge | `Badge` | `@ioca/react/components/badge/type` → `IBadge` | [docs](https://ioca-react.vercel.app/docs/badge) |
| Data Display | Datagrid | `Datagrid` | `@ioca/react/components/datagrid/type` → `IDatagrid` | [docs](https://ioca-react.vercel.app/docs/datagrid) |
| Data Display | Tree | `Tree` | `@ioca/react/components/tree/type` → `ITree` | [docs](https://ioca-react.vercel.app/docs/tree) |
| Data Display | Progress | `Progress` | `@ioca/react/components/progress/type` → `IProgress` | [docs](https://ioca-react.vercel.app/docs/progress) |
| Data Display | Image | `Image` | `@ioca/react/components/image/type` → `IImage` | [docs](https://ioca-react.vercel.app/docs/image) |
| Data Display | Video | `Video` | `@ioca/react/components/video/type` → `IVideo` | [docs](https://ioca-react.vercel.app/docs/video) |
| Feedback | Modal | `Modal` | `@ioca/react/components/modal/type` → `IModal` | [docs](https://ioca-react.vercel.app/docs/modal) |
| Feedback | Drawer | `Drawer` | `@ioca/react/components/drawer/type` → `IDrawer` | [docs](https://ioca-react.vercel.app/docs/drawer) |
| Feedback | Popup | `Popup` | `@ioca/react/components/popup/type` → `IPopup` | [docs](https://ioca-react.vercel.app/docs/popup) |
| Feedback | Popconfirm | `Popconfirm` | `@ioca/react/components/popconfirm/type` → `IPopconfirm` | [docs](https://ioca-react.vercel.app/docs/popconfirm) |
| Feedback | Message | `Message` | `@ioca/react/components/message/type` → `IMessage` | [docs](https://ioca-react.vercel.app/docs/message) |
| Feedback | Loading | `Loading` | `@ioca/react/components/loading/type` → `ILoading` | [docs](https://ioca-react.vercel.app/docs/loading) |

## Hooks

| Hook | Import | Docs |
|------|--------|------|
| Image/file preview | `usePreview` | [docs](https://ioca-react.vercel.app/docs/use-preview) |
| Theme switching | `useTheme` | [docs](https://ioca-react.vercel.app/docs/use-theme) |

## Utility CSS Classes

`@ioca/react` provides utility CSS classes for common styling needs. Refer to the official docs — never invent class names.

- **Helper classes** (spacing, typography, layout utilities): https://ioca-react.vercel.app/docs/helper
- **Color classes** (text, background, border colors): https://ioca-react.vercel.app/docs/colors

## Output Format

```tsx
import { ComponentA, ComponentB } from "@ioca/react";
import type { IComponentA } from "@ioca/react/components/component-a/type";
import type { IComponentB } from "@ioca/react/components/component-b/type";

// component implementation...
```

## Examples

See ready-to-use examples in [examples/](./examples):

| Example | File | Components Used |
|---------|------|-----------------|
| Delete Confirmation | [delete-action.tsx](./examples/delete-action.tsx) | Popconfirm + Button + Message |
| User Form | [user-form.tsx](./examples/user-form.tsx) | Form + Form.Field + Input + Select + Button |
| User List | [user-list.tsx](./examples/user-list.tsx) | Datagrid + Badge + Tag |
| Login Modal | [login-modal.tsx](./examples/login-modal.tsx) | Modal + Input + Button + Message |
| Settings Tabs | [settings-tabs.tsx](./examples/settings-tabs.tsx) | Tabs + Tabs.Item + Select + Input.Textarea + Button |
