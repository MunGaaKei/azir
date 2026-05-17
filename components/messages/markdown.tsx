import { Button } from "@ioca/react";
import type { ThemeInput } from "@streamdown/code";
import { code as codePlugin } from "@streamdown/code";
import { ArrowDownToLine, Check, Copy } from "lucide-react";
import {
    Children,
    isValidElement,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { Components, useIsCodeFenceIncomplete } from "streamdown";
import { downloadTextFile } from "./download";
import css from "./markdown.module.css";

const LANG_ALIASES: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    rs: "rust",
    cs: "csharp",
    sh: "shell",
    docker: "dockerfile",
    plain: "plaintext",
    txt: "text",
};

const THEMES = ["github-light", "github-dark"] as const;

type HighlightToken = {
    bgColor?: string;
    color?: string;
    content: string;
    htmlStyle?: Record<string, string>;
};

type TokensResult = {
    bg?: string;
    fg?: string;
    rootStyle?: string;
    tokens: HighlightToken[][];
};

export function CodeBlock({
    code,
    language: rawLanguage,
}: {
    code: string;
    language: string;
}) {
    const isIncomplete = useIsCodeFenceIncomplete();
    const mountedRef = useRef(true);
    const [result, setResult] = useState<TokensResult | null>(null);
    const [copied, setCopied] = useState(false);
    const language = (LANG_ALIASES[rawLanguage] ?? rawLanguage) || "text";
    const trimmedCode = useMemo(() => code.replace(/\n+$/, ""), [code]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (isIncomplete || !trimmedCode) {
            setResult(null);
            return;
        }

        codePlugin.highlight(
            {
                code: trimmedCode,
                language: language as any,
                themes: THEMES as [ThemeInput, ThemeInput],
            },
            (tokens) => {
                if (mountedRef.current) {
                    setResult(tokens as unknown as TokensResult);
                }
            },
        );
    }, [trimmedCode, language, isIncomplete]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const handleCopy = useCallback(async () => {
        if (!trimmedCode.trim()) return;
        try {
            await navigator.clipboard.writeText(trimmedCode);
            setCopied(true);
        } catch {
            // silently fail
        }
    }, [trimmedCode]);

    const handleDownload = useCallback(() => {
        if (!trimmedCode.trim()) return;
        const ext = language.replace(/[^a-z0-9]/g, "") || "txt";
        downloadTextFile({
            content: trimmedCode,
            filename: `snippet.${ext}`,
            mime: "text/plain",
            onError: () => {},
        });
    }, [trimmedCode, language]);

    return (
        <div className={css.codeBlock}>
            <div className={css.codeHeader}>
                <i className={css.codeLanguage}>{rawLanguage || "text"}</i>
                <div className={css.codeActions}>
                    <Button
                        type="button"
                        flat
                        square
                        onClick={handleDownload}
                        aria-label="下载"
                    >
                        <ArrowDownToLine size={16} />
                    </Button>
                    <Button
                        type="button"
                        flat
                        square
                        onClick={() => void handleCopy()}
                        aria-label="复制"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                </div>
            </div>
            {result ? (
                <div className={css.codeBody}>
                    <CodeBlockBody result={result} />
                </div>
            ) : (
                <pre className={css.codeBody}>
                    <code>{trimmedCode}</code>
                </pre>
            )}
        </div>
    );
}

function CodeBlockBody({ result }: { result: TokensResult }) {
    return (
        <pre
            className={css.highlightedPre}
            style={
                {
                    "--highlight-bg": result.bg || "transparent",
                    "--highlight-fg": result.fg || "inherit",
                } as React.CSSProperties
            }
        >
            <code>
                {result.tokens.map((line, i) => (
                    <span key={i} className={css.codeLine}>
                        {line.length > 0
                            ? line.map((token, j) => (
                                  <span
                                      key={j}
                                      style={
                                          {
                                              color: token.color || undefined,
                                              ...(token.htmlStyle || {}),
                                          } as React.CSSProperties
                                      }
                                  >
                                      {token.content}
                                  </span>
                              ))
                            : "\n"}
                        {i < result.tokens.length - 1 ? "\n" : ""}
                    </span>
                ))}
            </code>
        </pre>
    );
}

function extractTextContent(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(extractTextContent).join("");
    }
    if (isValidElement<{ children?: ReactNode }>(node)) {
        return extractTextContent(node.props.children);
    }
    return "";
}

function getCodeLanguage(node: ReactNode): string {
    if (!isValidElement<{ className?: string }>(node)) return "";
    const className = node.props.className ?? "";
    const match = className.match(/language-([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? "";
}

export const MarkdownComponents = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    h5: "h5",
    h6: "h6",
    p: "p",
    strong: "strong",
    em: "em",
    ul: "ul",
    ol: "ol",
    li: "li",
    a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noreferrer">
            {children}
        </a>
    ),
    blockquote: "blockquote",
    table: "table",
    thead: "thead",
    tbody: "tbody",
    tr: "tr",
    th: "th",
    td: "td",
    img: "img",
    hr: "hr",
    sup: "sup",
    sub: "sub",
    section: "section",
    div: "div",
    pre: ({ children }) => {
        const child = Children.toArray(children)[0] ?? null;
        if (!isValidElement(child)) return <pre>{children}</pre>;
        const code = extractTextContent(child).replace(/\n+$/, "");
        const language = getCodeLanguage(child) || "text";
        return <CodeBlock code={code} language={language} />;
    },
} satisfies Components;
