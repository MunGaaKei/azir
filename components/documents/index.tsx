import request from "@/server/request";
import {
    Button,
    List,
    Loading,
    Message,
    Popconfirm,
    Popup,
    Upload,
    usePreview,
} from "@ioca/react";
import { code as codePlugin } from "@streamdown/code";
import {
    BookAudio,
    CloudBackup,
    Download,
    Eye,
    HardDrive,
    Trash2,
    Upload as UploadIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { MarkdownComponents } from "../messages/markdown";
import cssMd from "../messages/markdown.module.css";
import css from "./index.module.css";

export type DocFileInfo = {
    filename: string;
    size: number;
    type: string;
    modifiedAt: string;
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ",") {
                current.push(field);
                field = "";
            } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
                if (ch === "\r") i++;
                current.push(field);
                field = "";
                if (current.length > 0 && current.some((c) => c !== "")) {
                    rows.push(current);
                }
                current = [];
            } else if (ch === "\r") {
                current.push(field);
                field = "";
                if (current.length > 0 && current.some((c) => c !== "")) {
                    rows.push(current);
                }
                current = [];
            } else {
                field += ch;
            }
        }
    }
    if (field || current.length > 0) {
        current.push(field);
        if (current.length > 0 && current.some((c) => c !== "")) {
            rows.push(current);
        }
    }
    return rows;
}

const CsvPreview = memo(function CsvPreview({
    rows,
}: {
    rows: string[][];
}) {
    if (rows.length === 0) {
        return <div className="color-5 py-8 ta-center">空表格</div>;
    }

    const [header, ...body] = rows;

    return (
        <div className={css.csvWrapper}>
            <table className={css.csvTable}>
                <thead>
                    <tr>
                        {header.map((cell, i) => (
                            <th key={i}>{cell}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

async function downloadFile(filename: string) {
    const res = await fetch(
        `/api/docs/${encodeURIComponent(filename)}/download`,
    );
    if (!res.ok) {
        Message.error("下载失败");
        return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const FileItem = memo(function FileItem({
    file,
    onDelete,
    onPreview,
}: {
    file: DocFileInfo;
    onDelete: (filename: string) => void;
    onPreview: (file: DocFileInfo) => void;
}) {
    return (
        <List.Item className={css.item}>
            <a
                className={css.name}
                onClick={() => {
                    void navigator.clipboard.writeText(file.filename);
                    Message.info("已复制文件名");
                }}
            >
                {file.filename}
            </a>
            <i className="color-5 font-sm mr-4">
                [{formatFileSize(file.size)}]
            </i>
            <div className={css.actions}>
                <Popconfirm
                    icon={null}
                    content="确定删除"
                    okButtonProps={{ className: "bg-error" }}
                    onOk={() => void onDelete(file.filename)}
                >
                    <Button flat square size="small">
                        <Trash2 size={16} />
                    </Button>
                </Popconfirm>
                <Button
                    flat
                    square
                    size="small"
                    onClick={() => void onPreview(file)}
                >
                    <Eye size={16} />
                </Button>
            </div>
            <Button
                flat
                square
                size="small"
                onClick={() => void downloadFile(file.filename)}
            >
                <Download size={16} />
            </Button>
        </List.Item>
    );
});

const Content = memo(function Content({
    files,
    loading,
    onDelete,
    onPreview,
}: {
    files: DocFileInfo[];
    loading: boolean;
    onDelete: (filename: string) => void;
    onPreview: (file: DocFileInfo) => void;
}) {
    if (loading) return <Loading className="py-12" />;

    if (files.length === 0) {
        return (
            <div className="flex my-40">
                <HardDrive size={40} className="mg-auto color-5" />
            </div>
        );
    }

    return (
        <List className={css.list}>
            {files.map((file) => (
                <FileItem
                    key={file.filename}
                    file={file}
                    onDelete={onDelete}
                    onPreview={onPreview}
                />
            ))}
        </List>
    );
});

export default function Documents() {
    const [visible, setVisible] = useState(false);
    const [files, setFiles] = useState<DocFileInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [draggingOver, setDraggingOver] = useState(false);
    const [uploadKey, setUploadKey] = useState(0);
    const hasFetched = useRef(false);
    const dragCounter = useRef(0);
    const preview = usePreview();

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await request<{ files: DocFileInfo[] }>("/api/docs");
            setFiles(res?.files ?? []);
        } catch {
            // fetch failure leaves existing files displayed
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible && !hasFetched.current) {
            hasFetched.current = true;
            void refresh();
        }
    }, [visible, refresh]);

    const handleVisibleChange = useCallback((v: boolean) => {
        setVisible(v);
        if (v) hasFetched.current = false;
    }, []);

    const doUpload = useCallback(
        async (file: File) => {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", file);
            try {
                const res = await fetch("/api/docs/upload", {
                    method: "POST",
                    body: formData,
                });
                if (!res.ok) {
                    const data = (await res.json()) as { message?: string };
                    Message.error(data.message || "上传失败");
                    return;
                }
                Message.info("上传成功");
                setUploadKey((k) => k + 1);
                void refresh();
            } catch {
                Message.error("上传失败");
            } finally {
                setUploading(false);
            }
        },
        [refresh],
    );

    const handleUpload = useCallback(
        (_files: unknown[], changed: unknown[]) => {
            const file = changed[0] as File | undefined;
            if (file) void doUpload(file);
        },
        [doUpload],
    );

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items.length > 0) setDraggingOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) setDraggingOver(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDraggingOver(false);
            dragCounter.current = 0;
            const file = e.dataTransfer.files[0];
            if (file) void doUpload(file);
        },
        [doUpload],
    );

    const handleDelete = useCallback(async (filename: string) => {
        try {
            const res = await fetch(
                `/api/docs/${encodeURIComponent(filename)}`,
                { method: "DELETE" },
            );
            if (!res.ok) {
                Message.error("删除失败");
                return;
            }
            setFiles((prev) => prev.filter((f) => f.filename !== filename));
            Message.info("已删除");
        } catch {
            Message.error("删除失败");
        }
    }, []);

    const handlePreview = useCallback(
        async (file: DocFileInfo) => {
            const url = `/api/docs/${encodeURIComponent(file.filename)}/download`;

            if (file.type === "application/pdf") {
                window.open(`${url}?preview=1`, "_blank");
                return;
            }

            if (file.type.startsWith("image/")) {
                preview({ items: [{ src: url, name: file.filename }] });
                return;
            }

            try {
                const res = await fetch(url);
                const text = await res.text();
                const nameLower = file.filename.toLowerCase();
                const isMd = nameLower.endsWith(".md");
                const isCsv = nameLower.endsWith(".csv");

                preview({
                    items: [{ src: url, name: file.filename }],
                    controls: false,
                    renderFile: () => {
                        if (isCsv) {
                            const rows = parseCsv(text);
                            return (
                                <div className={css.preview}>
                                    <CsvPreview rows={rows} />
                                </div>
                            );
                        }
                        return (
                            <div className={css.preview}>
                                {isMd ? (
                                    <Streamdown
                                        className={cssMd.markdown}
                                        components={MarkdownComponents}
                                        plugins={{ code: codePlugin }}
                                    >
                                        {text}
                                    </Streamdown>
                                ) : (
                                    text
                                )}
                            </div>
                        );
                    },
                });
            } catch {
                Message.error("加载失败");
            }
        },
        [preview],
    );

    return (
        <Popup
            trigger="click"
            onVisibleChange={handleVisibleChange}
            content={
                <div
                    className={css.container}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {draggingOver && (
                        <div className={css.dropOverlay}>
                            <UploadIcon size={32} />
                            <span>释放以上传文件</span>
                        </div>
                    )}
                    <div className={css.header}>
                        <BookAudio size={20} />
                        <b>文档库</b>

                        <i className="ml-auto color-5 font-sm">
                            [
                            {formatFileSize(
                                files.reduce((s, f) => s + f.size, 0),
                            )}{" "}
                            / 20MB]
                        </i>
                        <Upload key={uploadKey} onFilesChange={handleUpload}>
                            <Button flat size="small" loading={uploading}>
                                <UploadIcon size={16} /> 上传
                            </Button>
                        </Upload>

                        <Button
                            flat
                            square
                            size="small"
                            onClick={refresh}
                            disabled={loading}
                        >
                            <CloudBackup size={16} />
                        </Button>
                    </div>

                    <Content
                        files={files}
                        loading={loading}
                        onDelete={handleDelete}
                        onPreview={handlePreview}
                    />
                </div>
            }
        >
            <Button flat square>
                <HardDrive size={24} />
            </Button>
        </Popup>
    );
}
