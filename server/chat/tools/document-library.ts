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
import { createWriteStream, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { MarkItDown } from "markitdown-ts";

const cjsRequire = createRequire(import.meta.url);
const PDFDocument = cjsRequire("pdfkit") as typeof import("pdfkit");

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
            new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
    );
    return files;
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

    // Use markitdown-ts for PDF, Office docs, etc.
    const { data: mdResult } = await tryto(async () => {
        const markitdown = new MarkItDown();
        const result = await markitdown.convert(filepath);
        return result?.text_content ?? null;
    });

    return mdResult ?? null;
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
    regular: string;
    bold: string;
};

function findCJKFont(): CJKFont | null {
    const candidates: CJKFont[] = [
        // macOS
        {
            path: "/System/Library/Fonts/Hiragino Sans GB.ttc",
            regular: "HiraginoSansGB-W3",
            bold: "HiraginoSansGB-W6",
        },
        {
            path: "/System/Library/Fonts/AppleSDGothicNeo.ttc",
            regular: "AppleSDGothicNeo-Regular",
            bold: "AppleSDGothicNeo-Bold",
        },
        {
            path: "/System/Library/Fonts/STHeiti Medium.ttc",
            regular: "STHeitiSC-Medium",
            bold: "STHeitiSC-Medium",
        },
        // Linux
        {
            path: "/usr/share/fonts/truetype/wqy/wqy-microhei.ttf",
            regular: "WenQuanYi Micro Hei",
            bold: "WenQuanYi Micro Hei",
        },
        {
            path: "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            regular: "NotoSansCJK-Regular",
            bold: "NotoSansCJK-Bold",
        },
    ];

    for (const font of candidates) {
        if (existsSync(font.path)) {
            return font;
        }
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

    const { data, error } = await tryto(
        () =>
            new Promise<{ success: boolean; filepath: string }>(
                (resolve, reject) => {
                    const doc = new PDFDocument({
                        info: {
                            Title: filename,
                            Creator: "Azir Document Library",
                        },
                    });
                    const stream = createWriteStream(filepath);

                    stream.on("finish", () =>
                        resolve({ success: true, filepath }),
                    );
                    stream.on("error", reject);

                    doc.pipe(stream);

                    const cjkFont = findCJKFont();
                    let hasCJK = false;
                    if (cjkFont) {
                        try {
                            doc.registerFont("CJK", cjkFont.path, cjkFont.regular);
                            doc.registerFont(
                                "CJK-Bold",
                                cjkFont.path,
                                cjkFont.bold,
                            );
                            hasCJK = true;
                        } catch {
                            // Fall back to Helvetica
                        }
                    }

                    const BODY = hasCJK ? "CJK" : "Helvetica";
                    const BOLD = hasCJK ? "CJK-Bold" : "Helvetica-Bold";
                    const BODY_SIZE = 12;

                    let inCodeBlock = false;
                    const lines = markdownContent.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("```")) {
                            inCodeBlock = !inCodeBlock;
                            if (inCodeBlock) {
                                doc.font("Courier")
                                    .fillColor("#333")
                                    .fontSize(BODY_SIZE);
                            } else {
                                doc.fillColor("#000")
                                    .font(BODY)
                                    .fontSize(BODY_SIZE);
                            }
                            continue;
                        }

                        if (inCodeBlock) {
                            doc.font("Courier").fontSize(BODY_SIZE - 1);
                            doc.text(line, { paragraphGap: 1 });
                            continue;
                        }

                        if (line.startsWith("# ")) {
                            doc.fontSize(24).font(BOLD);
                            doc.text(line.slice(2).trim(), { paragraphGap: 8 });
                            doc.fontSize(BODY_SIZE).font(BODY);
                        } else if (line.startsWith("## ")) {
                            doc.fontSize(20).font(BOLD);
                            doc.text(line.slice(3).trim(), { paragraphGap: 6 });
                            doc.fontSize(BODY_SIZE).font(BODY);
                        } else if (line.startsWith("### ")) {
                            doc.fontSize(16).font(BOLD);
                            doc.text(line.slice(4).trim(), { paragraphGap: 4 });
                            doc.fontSize(BODY_SIZE).font(BODY);
                        } else if (line.startsWith("- ") || line.startsWith("* ")) {
                            doc.text(`  • ${line.slice(2).trim()}`, {
                                indent: 12,
                                paragraphGap: 2,
                            });
                        } else if (line.trim()) {
                            doc.text(line.trim(), {
                                align: "justify",
                                paragraphGap: 4,
                            });
                        } else {
                            doc.moveDown(0.5);
                        }
                    }

                    doc.end();
                },
            ),
    );

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
                content: z
                    .string()
                    .describe("文件内容（文本格式）"),
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
                    .describe("PDF 文件名，必须以 .pdf 结尾，如 report.pdf"),
                content: z
                    .string()
                    .describe("文件内容（Markdown 格式），支持标题、列表、代码块等 Markdown 语法"),
            })
            .strict(),
        async execute({ filename, content }) {
            const result = await generatePdfDocument(uid, filename, content);
            if (result.success) {
                return `PDF 文件 "${filename}" 已成功生成并保存到文档库。`;
            }
            return `生成 PDF 失败：${result.error || "未知错误"}`;
        },
    });
}
