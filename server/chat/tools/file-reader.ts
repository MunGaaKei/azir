import { tryto } from "@/utils";
import { tool } from "@openai/agents";
import { readFile, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export type UploadedFileInfo = {
	filename: string;
	filepath: string;
	type: string;
	size: number;
};

/** requestId -> uploaded files */
const uploadedFilesMap = new Map<string, UploadedFileInfo[]>();

export function getUploadedFiles(requestId: string): UploadedFileInfo[] {
	return uploadedFilesMap.get(requestId) ?? [];
}

export function setUploadedFiles(requestId: string, files: UploadedFileInfo[]) {
	uploadedFilesMap.set(requestId, files);
}

export async function cleanupUploadedFiles(requestId: string) {
	const files = uploadedFilesMap.get(requestId);
	if (!files) {
		return;
	}

	uploadedFilesMap.delete(requestId);

	if (files.length === 0) {
		return;
	}

	await Promise.allSettled(
		files.map(async (file) => {
			await tryto(unlink(file.filepath));
		}),
	);

	await tryto(rmdir(path.dirname(files[0].filepath)));
}

const TEXT_EXTENSIONS = new Set([
	".txt",
	".md",
	".mdx",
	".json",
	".csv",
	".tsv",
	".log",
	".xml",
	".yaml",
	".yml",
	".toml",
	".ini",
	".cfg",
	".conf",
	".env",
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".py",
	".rb",
	".go",
	".rs",
	".java",
	".kt",
	".swift",
	".c",
	".cpp",
	".h",
	".hpp",
	".css",
	".scss",
	".less",
	".html",
	".htm",
	".svg",
	".sql",
	".sh",
	".bash",
	".zsh",
	".ps1",
	".bat",
	".cmd",
	".r",
	".lua",
	".php",
	".pl",
	".pm",
	".vue",
	".svelte",
	".astro",
	".gradle",
	".properties",
	".lock",
	".gitignore",
	".dockerfile",
	".makefile",
]);

const TEXT_MIMES = [
	"text/",
	"application/json",
	"application/xml",
	"application/yaml",
	"application/javascript",
	"application/typescript",
	"application/x-sh",
];

function getExtension(filename: string): string {
	const idx = filename.lastIndexOf(".");
	if (idx < 0) return "";
	return filename.slice(idx).toLowerCase();
}

function isTextFile(filename: string, mimeType: string): boolean {
	const ext = getExtension(filename);
	if (TEXT_EXTENSIONS.has(ext)) return true;
	const normalizedMime = mimeType.toLowerCase();
	return TEXT_MIMES.some((prefix) => normalizedMime.startsWith(prefix));
}

function isPdfFile(filename: string, mimeType: string): boolean {
	return (
		getExtension(filename) === ".pdf" ||
		mimeType.toLowerCase() === "application/pdf"
	);
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createReadUploadedFileTool(requestId: string) {
	return tool({
		name: "read_uploaded_file",
		description:
			"读取用户上传的文件内容。适用于分析文档、查看代码、阅读文本资料等场景。支持文本文件直接读取，PDF 文件提取文字内容。",
		parameters: z
			.object({
				filename: z
					.string()
					.trim()
					.min(1)
					.describe(
						"要读取的文件名（包括扩展名），必须是用户上传过的文件之一",
					),
			})
			.strict(),
		async execute({ filename }) {
			const files = uploadedFilesMap.get(requestId);
			if (!files || files.length === 0) {
				return "当前没有上传任何文件。请先让用户上传文件。";
			}

			const file = files.find(
				(f) =>
					f.filename === filename ||
					f.filename.endsWith(`/${filename}`),
			);
			if (!file) {
				const availableFiles = files
					.map((f) => `- ${f.filename} (${formatFileSize(f.size)})`)
					.join("\n");
				return `找不到文件 "${filename}"。用户上传了以下文件：\n${availableFiles}`;
			}

			const { data, error } = await tryto(async () => {
				if (isTextFile(file.filename, file.type)) {
					const content = await readFile(file.filepath, "utf-8");
					const MAX_LENGTH = 100_000;
					if (content.length > MAX_LENGTH) {
						return `文件 "${file.filename}" 内容过长（共 ${content.length} 字符），已截取前 ${MAX_LENGTH} 字符：\n\n${content.slice(0, MAX_LENGTH)}\n\n---\n⚠️ 文件内容已截断，仅显示了前 ${MAX_LENGTH} 字符。`;
					}
					return `文件 "${file.filename}" 的内容如下：\n\n${content}`;
				}

				if (isPdfFile(file.filename, file.type)) {
					const pdfResult = await tryto<{ stdout: string }>(
						async () => {
							const { execa } = await import("execa");
							const result = await execa("python3", [
								"-c",
								[
									"import sys",
									"from pypdf import PdfReader",
									`r = PdfReader("${file.filepath.replace(/"/g, '\\"')}")`,
									"print(f'总页数: {len(r.pages)}')",
									"print('---')",
									"",
									"for i, p in enumerate(r.pages):",
									"    text = (p.extract_text() or '').strip()",
									"    if text:",
									"        print(f'--- 第 {i+1} 页 ---')",
									"        print(text)",
									"    else:",
									"        print(f'(第 {i+1} 页无文本内容)')",
								].join("\n"),
							]);
							return {
								stdout: result.stdout,
							};
						},
					);

					if (pdfResult.error || !pdfResult.data) {
						return `文件 "${file.filename}" 是 PDF 格式。服务器尝试提取文本失败，需要安装 pypdf（pip install pypdf）来启用 PDF 文本提取功能。文件信息：${file.filename}，大小：${formatFileSize(file.size)}。你可以让用户提供文本版本或安装依赖后重试。`;
					}

					return `文件 "${file.filename}"（PDF）的内容如下：\n\n${pdfResult.data.stdout}`;
				}

				return `文件 "${file.filename}" 的类型（${file.type}）暂不支持读取。目前支持：文本文件和 PDF 文件。文件大小：${formatFileSize(file.size)}。`;
			});

			if (error) {
				return `读取文件 "${file.filename}" 时出错：${error instanceof Error ? error.message : "未知错误"}`;
			}

			return data;
		},
	});
}

export function buildFileContextPrompt(files: UploadedFileInfo[]): string {
	if (!files || files.length === 0) {
		return "";
	}

	const fileList = files
		.map(
			(f, i) =>
				`${i + 1}. ${f.filename}（${formatFileSize(f.size)}${isTextFile(f.filename, f.type) ? "，文本文件" : isPdfFile(f.filename, f.type) ? "，PDF 文档" : ""}）`,
		)
		.join("\n");

	return [
		"",
		`用户上传了以下 ${files.length} 个文件。你必须调用 \`read_uploaded_file\` 工具读取文件真实内容，禁止凭文件名猜测内容：`,
		fileList,
		"使用方式：调用 read_uploaded_file 工具，参数 filename 指定要读取的文件名（包含扩展名）。每次只能读取一个文件，如有多个文件请多次调用。",
		"",
	].join("\n");
}
