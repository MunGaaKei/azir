import { tryto } from "@/utils";
import { tool } from "@openai/agents";
import {
    mkdir,
    readFile,
    readdir,
    stat,
    unlink,
    writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type DocFileInfo = {
    filename: string;
    size: number;
    type: string;
    modifiedAt: string;
};

export function getDocDir(uid: string): string {
    return path.join(tmpdir(), "azir-docs", uid);
}

export async function ensureDocDir(uid: string): Promise<string> {
    const dir = getDocDir(uid);
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
    return dir;
}

function isSafe(filename: string): boolean {
    return !filename.includes("..") && !filename.includes("/");
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function listDocuments(uid: string): Promise<DocFileInfo[]> {
    const dir = await ensureDocDir(uid);
    const entries = await readdir(dir);
    const files: DocFileInfo[] = [];

    for (const entry of entries) {
        const filepath = path.join(dir, entry);
        const { data: stats } = await tryto(stat(filepath));
        if (!stats || !stats.isFile()) continue;

        const ext = path.extname(entry).toLowerCase();
        const typeMap: Record<string, string> = {
            ".md": "text/markdown",
            ".txt": "text/plain",
            ".pdf": "application/pdf",
            ".json": "application/json",
            ".csv": "text/csv",
            ".html": "text/html",
            ".xml": "application/xml",
            ".yml": "application/x-yaml",
            ".yaml": "application/x-yaml",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        };

        files.push({
            filename: entry,
            size: stats.size,
            type: typeMap[ext] || "application/octet-stream",
            modifiedAt: stats.mtime.toISOString(),
        });
    }

    files.sort(
        (a, b) =>
            new Date(b.modifiedAt).getTime() -
            new Date(a.modifiedAt).getTime(),
    );
    return files;
}

async function extractPdfText(filepath: string): Promise<string | null> {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = await readFile(filepath);
    const doc = await getDocument({ data: new Uint8Array(data) }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((item) => (item as { str: string }).str).join(" ");
        pages.push(text);
    }

    await doc.destroy();
    return pages.join("\n\n");
}

export async function readDocument(
    uid: string,
    filename: string,
): Promise<string | null> {
    if (!isSafe(filename)) return null;

    const dir = getDocDir(uid);
    const filepath = path.join(dir, filename);
    if (!filepath.startsWith(dir)) return null;
    if (!existsSync(filepath)) return null;

    const ext = path.extname(filename).toLowerCase();
    const textExtensions = new Set([
        ".md", ".txt", ".json", ".csv", ".html", ".xml",
        ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
        ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs",
        ".java", ".css", ".scss", ".sql", ".sh", ".bash",
        ".log", ".env", ".gitignore",
    ]);

    if (textExtensions.has(ext)) {
        const { data } = await tryto(readFile(filepath, "utf-8"));
        return data ?? null;
    }

    if (ext === ".pdf") {
        const { data: text } = await tryto(extractPdfText(filepath));
        return text ?? null;
    }

    if (ext === ".html" || ext === ".htm") {
        const { data } = await tryto(readFile(filepath, "utf-8"));
        if (!data) return null;
        return data
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    return null;
}

export async function saveDocument(
    uid: string,
    filename: string,
    content: string,
): Promise<boolean> {
    if (!isSafe(filename)) return false;

    const dir = await ensureDocDir(uid);
    const filepath = path.join(dir, filename);
    if (!filepath.startsWith(dir)) return false;

    const { error } = await tryto(writeFile(filepath, content, "utf-8"));
    return !error;
}

export async function deleteDocumentFile(
    uid: string,
    filename: string,
): Promise<boolean> {
    if (!isSafe(filename)) return false;

    const dir = getDocDir(uid);
    const filepath = path.join(dir, filename);
    if (!filepath.startsWith(dir)) return false;
    if (!existsSync(filepath)) return false;

    const { error } = await tryto(unlink(filepath));
    return !error;
}

type CJKFont = {
    path: string;
};

function findCJKFont(): CJKFont | null {
    const candidates = [
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ];

    for (const fp of candidates) {
        if (existsSync(fp)) return { path: fp };
    }
    return null;
}

export async function generatePdfDocument(
    uid: string,
    filename: string,
    markdownContent: string,
): Promise<{ success: boolean; filepath?: string; error?: string }> {
    if (!isSafe(filename)) {
        return { success: false, error: "无效的文件名" };
    }

    if (!filename.toLowerCase().endsWith(".pdf")) {
        return { success: false, error: "文件名必须以 .pdf 结尾" };
    }

    const dir = await ensureDocDir(uid);
    const filepath = path.join(dir, filename);
    if (!filepath.startsWith(dir)) {
        return { success: false, error: "无效的文件名" };
    }

    const { data, error } = await tryto(async () => {
        const doc = await PDFDocument.create();
        doc.registerFontkit(fontkit);

        const helvetica = await doc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await doc.embedFont(
            StandardFonts.HelveticaBold,
        );
        const courier = await doc.embedFont(StandardFonts.Courier);

        const cjkFontPath = findCJKFont();
        let bodyFont = helvetica;
        let boldFont = helveticaBold;
        if (cjkFontPath) {
            try {
                const fontBytes = await readFile(cjkFontPath.path);
                bodyFont = await doc.embedFont(fontBytes, {
                    subset: true,
                });
                boldFont = bodyFont;
            } catch {
                // Fall back to standard fonts
            }
        }

        const BODY_SIZE = 12;
        const MARGIN = 56;
        const [PAGE_W, PAGE_H] = PageSizes.A4;

        let page = doc.addPage(PageSizes.A4);
        let cursorY = PAGE_H - MARGIN;

        function drawLine(
            text: string,
            font: typeof helvetica,
            size: number,
            opts?: { indent?: number; color?: [number, number, number] },
        ) {
            const indent = opts?.indent ?? 0;
            const maxWidth = PAGE_W - MARGIN * 2 - indent;
            const color = opts?.color ? rgb(...opts.color) : rgb(0, 0, 0);

            let line = "";
            for (const ch of text) {
                const test = line + ch;
                if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
                    page.drawText(line, {
                        x: MARGIN + indent,
                        y: cursorY - size,
                        size,
                        font,
                        color,
                    });
                    cursorY -= size * 1.5;
                    if (cursorY < MARGIN) {
                        page = doc.addPage(PageSizes.A4);
                        cursorY = PAGE_H - MARGIN;
                    }
                    line = ch;
                } else {
                    line = test;
                }
            }
            if (line) {
                page.drawText(line, {
                    x: MARGIN + indent,
                    y: cursorY - size,
                    size,
                    font,
                    color,
                });
                cursorY -= size * 1.5;
            }
        }

        let inCodeBlock = false;
        for (const line of markdownContent.split("\n")) {
            if (cursorY < MARGIN + 20) {
                page = doc.addPage(PageSizes.A4);
                cursorY = PAGE_H - MARGIN;
            }

            if (line.startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }

            if (inCodeBlock) {
                page.drawText(line, {
                    x: MARGIN + 12,
                    y: cursorY - (BODY_SIZE - 1),
                    size: BODY_SIZE - 1,
                    font: courier,
                    color: rgb(0.2, 0.2, 0.2),
                });
                cursorY -= (BODY_SIZE - 1) * 1.4;
                continue;
            }

            if (line.startsWith("# ")) {
                drawLine(line.slice(2).trim(), boldFont, 24);
                cursorY -= 2;
            } else if (line.startsWith("## ")) {
                drawLine(line.slice(3).trim(), boldFont, 20);
            } else if (line.startsWith("### ")) {
                drawLine(line.slice(4).trim(), boldFont, 16);
            } else if (line.startsWith("- ") || line.startsWith("* ")) {
                drawLine(`• ${line.slice(2).trim()}`, bodyFont, BODY_SIZE, {
                    indent: 12,
                });
            } else if (line.trim()) {
                drawLine(line.trim(), bodyFont, BODY_SIZE);
            } else {
                cursorY -= BODY_SIZE * 0.6;
            }
        }

        const pdfBytes = await doc.save({ useObjectStreams: false });
        await writeFile(filepath, Buffer.from(pdfBytes));

        return { success: true, filepath };
    });

    if (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "PDF 生成失败",
        };
    }

    return data ?? { success: false, error: "PDF 生成失败" };
}

export function createListDocumentsTool(uid: string) {
    return tool({
        name: "list_documents",
        description:
            "列出用户文档库中的所有文档。包括文档名、大小、修改时间。适合在需要查看用户有哪些可用文档时调用。",
        parameters: z.object({}).strict(),
        async execute() {
            const { data, error } = await tryto(listDocuments(uid));

            if (error) {
                return `获取文档列表失败：${error instanceof Error ? error.message : "未知错误"}`;
            }

            if (!data || data.length === 0) {
                return "文档库为空，暂无任何文档。";
            }

            const lines = data.map(
                (f, i) =>
                    `${i + 1}. ${f.filename}（${formatFileSize(f.size)}，${new Date(f.modifiedAt).toLocaleString()}）`,
            );

            return `文档库中共 ${data.length} 个文档：\n${lines.join("\n")}`;
        },
    });
}

export function createReadDocumentTool(uid: string) {
    return tool({
        name: "read_document",
        description:
            "读取文档库中指定文档的完整内容。支持 PDF、Word、Excel、文本文件等多种格式。适合需要分析文档内容、提取信息或参考文档回答用户时调用。先调用 list_documents 查看可用文档。",
        parameters: z
            .object({
                filename: z
                    .string()
                    .trim()
                    .min(1)
                    .describe("要读取的文件名（包含扩展名），如 report.pdf"),
            })
            .strict(),
        async execute({ filename }) {
            const content = await readDocument(uid, filename);
            if (content === null) {
                const files = await listDocuments(uid);
                const available =
                    files.length > 0
                        ? files.map((f) => `- ${f.filename}`).join("\n")
                        : "文档库为空";

                return `找不到文件 "${filename}"。当前文档库中的文件：\n${available}`;
            }

            const MAX_LENGTH = 100_000;
            if (content.length > MAX_LENGTH) {
                return `文件 "${filename}" 内容过长（共 ${content.length} 字符），已截取前 ${MAX_LENGTH} 字符：\n\n${content.slice(0, MAX_LENGTH)}\n\n---\n⚠️ 文件内容已截断，仅显示前 ${MAX_LENGTH} 字符。`;
            }

            return `文件 "${filename}" 的内容如下：\n\n${content}`;
        },
    });
}

export function createSaveDocumentTool(uid: string) {
    return tool({
        name: "save_document",
        description:
            "将内容保存到用户的文档库中。适合生成并保存 Markdown 笔记、报告、代码文件等文本文件。如果需要生成 PDF 请使用 generate_pdf 工具。",
        parameters: z
            .object({
                filename: z
                    .string()
                    .trim()
                    .min(1)
                    .describe("文件名（包含扩展名），如 notes.md"),
                content: z.string().describe("文件内容（文本格式）"),
            })
            .strict(),
        async execute({ filename, content }) {
            const ok = await saveDocument(uid, filename, content);
            if (ok) {
                return `文件 "${filename}" 已成功保存到文档库。`;
            }
            return `保存文件 "${filename}" 失败，请检查文件名是否合法。`;
        },
    });
}

export function createGeneratePdfTool(uid: string) {
    return tool({
        name: "generate_pdf",
        description:
            "根据 Markdown 内容生成 PDF 文件并保存到用户文档库中。适合生成正式报告、文档、简历等需要 PDF 格式的场景。生成的内容会保存到用户的文档库中，用户可以通过前端下载。",
        parameters: z
            .object({
                filename: z
                    .string()
                    .trim()
                    .min(1)
                    .describe(
                        "PDF 文件名，必须以 .pdf 结尾，如 report.pdf",
                    ),
                content: z
                    .string()
                    .describe(
                        "文件内容（Markdown 格式），支持标题、列表、代码块等 Markdown 语法",
                    ),
            })
            .strict(),
        async execute({ filename, content }) {
            const result = await generatePdfDocument(
                uid,
                filename,
                content,
            );
            if (result.success) {
                return `PDF 文件 "${filename}" 已成功生成并保存到文档库。`;
            }
            return `生成 PDF 失败：${result.error || "未知错误"}`;
        },
    });
}
