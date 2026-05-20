import { tryto } from "@/utils";
import { Hono } from "hono";
import type { Context } from "hono";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { getUid } from "./uid";
import {
    deleteDocumentFile,
    ensureDocDir,
    getDocDir,
    listDocuments,
} from "./chat/tools/document-library";

const api = new Hono();

api.get("/", async (c: Context) => {
    const uid = getUid(c);
    if (!uid) return c.json({ message: "UID 不存在" }, 400);

    const { data: files, error } = await tryto(listDocuments(uid));
    if (error) {
        return c.json({ message: "获取文档列表失败" }, 500);
    }

    return c.json({ files });
});

api.get("/:filename/download", async (c: Context) => {
    const uid = getUid(c);
    if (!uid) return c.json({ message: "UID 不存在" }, 400);

    const rawFilename = c.req.param("filename");
    if (!rawFilename || rawFilename.includes("..") || rawFilename.includes("/")) {
        return c.json({ message: "无效的文件名" }, 400);
    }

    const dir = getDocDir(uid);
    const filepath = path.join(dir, rawFilename);
    if (!filepath.startsWith(dir)) {
        return c.json({ message: "无效的文件名" }, 400);
    }
    if (!existsSync(filepath)) {
        return c.json({ message: "文件未找到" }, 404);
    }

    const { data: content, error } = await tryto(readFile(filepath));
    if (error || !content) {
        return c.json({ message: "读取文件失败" }, 500);
    }

    const ext = path.extname(rawFilename).toLowerCase();
    const contentType =
        ext === ".pdf"
            ? "application/pdf"
            : ext === ".md"
              ? "text/markdown; charset=utf-8"
              : ext === ".html" || ext === ".htm"
                ? "text/html; charset=utf-8"
                : ext === ".json"
                  ? "application/json; charset=utf-8"
                  : ext === ".csv"
                    ? "text/csv; charset=utf-8"
                    : ext === ".txt"
                      ? "text/plain; charset=utf-8"
                      : ext === ".png"
                        ? "image/png"
                        : ext === ".jpg" || ext === ".jpeg"
                          ? "image/jpeg"
                          : "application/octet-stream";

    const isPreview = c.req.query("preview") === "1";
    return c.body(content, 200, {
        "Content-Type": contentType,
        "Content-Disposition": isPreview
            ? `inline`
            : `attachment; filename="${encodeURIComponent(rawFilename)}"`,
    });
});

api.post("/upload", async (c: Context) => {
    const uid = getUid(c);
    if (!uid) return c.json({ message: "UID 不存在" }, 400);

    const body = await c.req.parseBody();
    const file = body["file"] as File | undefined;
    if (!file) return c.json({ message: "未提供文件" }, 400);

    const filename = file.name;
    if (filename.includes("..") || filename.includes("/")) {
        return c.json({ message: "无效的文件名" }, 400);
    }

    const { data: existing } = await tryto(listDocuments(uid));
    const totalSize = existing?.reduce((sum, f) => sum + f.size, 0) ?? 0;
    const MAX_STORAGE = 20 * 1024 * 1024;
    if (totalSize + file.size > MAX_STORAGE) {
        return c.json(
            {
                message: `存储空间不足，每个用户最多 20MB，当前已使用 ${(totalSize / 1024 / 1024).toFixed(1)}MB`,
            },
            413,
        );
    }

    const dir = await ensureDocDir(uid);
    const filepath = path.join(dir, filename);
    if (!filepath.startsWith(dir)) {
        return c.json({ message: "无效的文件名" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await tryto(writeFile(filepath, buffer));
    if (error) {
        return c.json({ message: "上传失败" }, 500);
    }

    return c.json({ message: "上传成功", filename });
});

api.delete("/:filename", async (c: Context) => {
    const uid = getUid(c);
    if (!uid) return c.json({ message: "UID 不存在" }, 400);

    const rawFilename = c.req.param("filename");
    if (!rawFilename || rawFilename.includes("..") || rawFilename.includes("/")) {
        return c.json({ message: "无效的文件名" }, 400);
    }

    const deleted = await deleteDocumentFile(uid, rawFilename);
    if (!deleted) return c.json({ message: "文件未找到" }, 404);

    return c.json({ message: "已删除" });
});

export default api;
