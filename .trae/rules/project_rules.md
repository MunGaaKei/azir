# agentm 项目约定（Vike）

本项目所有与 Vike 相关的用法与配置以官方文档为准：https://vike.dev/

## 目录结构

- pages/：所有页面与 Vike 的 + 文件（+Page.tsx、+config.ts、+Layout.tsx、+Head.tsx、+data.ts 等）
- +server.ts：服务端入口（推荐方式），用于集成后端框架（本项目使用 Hono）

## 组件使用文档

使用@ioca/react组件库

- 引入 import { Button, Form, Input } from "@ioca/react";
- 文档：https://ioca-react.vercel.app/docs/<name>

## 后端（Hono）

- 使用 `+server.ts` + `@vikejs/hono` 集成 Vike，并在同一个 Hono 实例上挂载自定义 API 路由（例如 `/api/*`）。

## 校验

- TypeScript：`pnpm -s exec tsc --noEmit --pretty false`
