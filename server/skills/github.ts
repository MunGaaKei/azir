const RAW_CONTENT_BASE = "https://raw.githubusercontent.com";
const API_BASE = "https://api.github.com";
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

type SkillRule = {
    name: string;
    content: string;
};

export type RemoteSkillData = {
    name: string;
    description: string;
    repoUrl: string;
    skillMd: string;
    rules: SkillRule[];
};

export class GitHubSkillError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GitHubSkillError";
    }
}

type RepoInfo = {
    owner: string;
    repo: string;
    branch?: string;
    path?: string;
};

/**
 * Parse various GitHub path formats:
 *   owner/repo
 *   owner/repo/branch
 *   owner/repo/branch/path/to/skill
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/branch/path/to/skill
 */
function parseRepoPath(input: string): RepoInfo {
    const trimmed = input.trim().replace(/\/$/, "");

    // Full GitHub URL format: https://github.com/owner/repo/tree/branch/path
    const urlMatch = trimmed.match(
        /^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+?)(?:\/tree\/([^\/\s]+)(?:\/(.+))?)?$/,
    );
    if (urlMatch) {
        return {
            owner: urlMatch[1],
            repo: urlMatch[2],
            branch: urlMatch[3] || undefined,
            path: urlMatch[4] || undefined,
        };
    }

    // Short format: owner/repo[/branch[/path...]]
    const parts = trimmed.split("/");
    if (parts.length < 2) {
        throw new GitHubSkillError(
            `无效的 GitHub 路径: "${input}"。请使用 "owner/repo" 或 "owner/repo/branch/path" 格式。`,
        );
    }

    const result: RepoInfo = {
        owner: parts[0],
        repo: parts[1],
    };

    if (parts.length > 2) {
        result.branch = parts[2];
        if (parts.length > 3) {
            result.path = parts.slice(3).join("/");
        }
    }

    return result;
}

async function fetchRaw(path: string): Promise<string | null> {
    try {
        const res = await fetch(`${RAW_CONTENT_BASE}${path}`);
        if (res.ok) {
            return res.text();
        }
        return null;
    } catch {
        return null;
    }
}

function buildApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
    };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
}

async function fetchSkillMdViaApi(
    info: RepoInfo,
): Promise<{ content: string; branch: string } | null> {
    const branch = info.branch || "main";
    const filepath = info.path ? `/${info.path}/SKILL.md` : "/SKILL.md";
    const url = `${API_BASE}/repos/${info.owner}/${info.repo}/contents${filepath}?ref=${branch}`;

    try {
        const res = await fetch(url, { headers: buildApiHeaders() });
        if (!res.ok) return null;

        const data = (await res.json()) as { content?: string; encoding?: string };
        if (!data.content || data.encoding !== "base64") return null;

        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return { content, branch };
    } catch {
        return null;
    }
}

async function fetchSkillMd(
    info: RepoInfo,
): Promise<{ content: string; branch: string }> {
    const branchesToTry = info.branch ? [info.branch] : ["main", "master"];

    for (const branch of branchesToTry) {
        const basePath = `/${info.owner}/${info.repo}/${branch}${info.path ? `/${info.path}` : ""}/SKILL.md`;

        const content = await fetchRaw(basePath);
        if (content !== null) {
            return { content, branch };
        }

        // Fallback: try GitHub API
        const apiResult = await fetchSkillMdViaApi({ ...info, branch });
        if (apiResult !== null) {
            return apiResult;
        }
    }

    const pathDesc = info.branch
        ? `路径 ${info.owner}/${info.repo}/${info.branch}${info.path ? `/${info.path}` : ""}`
        : `仓库 ${info.owner}/${info.repo}`;
    throw new GitHubSkillError(
        `${pathDesc} 中未找到 SKILL.md 文件。`,
    );
}

function parseFrontmatter(markdown: string) {
    const match = markdown.match(FRONTMATTER_RE);
    if (!match) {
        return {
            attributes: {} as Record<string, string>,
            body: markdown,
        };
    }

    const attributes = Object.fromEntries(
        match[1]
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const index = line.indexOf(":");
                if (index === -1) {
                    return [line, ""];
                }
                const key = line.slice(0, index).trim();
                const rawValue = line.slice(index + 1).trim();
                return [key, rawValue.replace(/^['"]|['"]$/g, "")];
            }),
    );

    return {
        attributes,
        body: markdown.slice(match[0].length),
    };
}

async function listRuleFiles(info: RepoInfo): Promise<string[]> {
    const branch = info.branch || "main";
    const subpath = info.path ? `/${info.path}` : "";
    const url = `${API_BASE}/repos/${info.owner}/${info.repo}/contents${subpath}/rules?ref=${branch}`;
    try {
        const headers: Record<string, string> = {
            Accept: "application/vnd.github.v3+json",
        };
        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
        }
        const res = await fetch(url, { headers });
        if (!res.ok) {
            return [];
        }
        const files = (await res.json()) as Array<{ name: string; download_url: string }>;
        return files
            .filter((f) => f.name.endsWith(".md"))
            .map((f) => f.download_url);
    } catch {
        return [];
    }
}

async function fetchRuleContent(downloadUrl: string): Promise<{
    name: string;
    content: string;
} | null> {
    try {
        const res = await fetch(downloadUrl);
        if (!res.ok) {
            return null;
        }
        const name = downloadUrl.split("/").pop()?.replace(/\.md$/i, "") ?? "unknown";
        return {
            name,
            content: normalizeNewlines((await res.text()).trim()),
        };
    } catch {
        return null;
    }
}

function normalizeNewlines(value: string) {
    return value.replace(/\r\n/g, "\n");
}

export async function fetchSkillFromGitHub(
    repoUrl: string,
): Promise<RemoteSkillData> {
    const info = parseRepoPath(repoUrl);

    const { content: rawSkillMd, branch } = await fetchSkillMd(info);
    const { attributes } = parseFrontmatter(rawSkillMd);

    const repoName = info.repo.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const name = attributes.name?.trim() || repoName;
    const description = attributes.description?.trim() || `${name} skill`;

    const ruleUrls = await listRuleFiles({ ...info, branch });
    const ruleResults = await Promise.allSettled(
        ruleUrls.map((url) => fetchRuleContent(url)),
    );
    const rules = ruleResults
        .filter(
            (r): r is PromiseFulfilledResult<{ name: string; content: string }> =>
                r.status === "fulfilled" && r.value !== null,
        )
        .map((r) => r.value);

    // Build a normalized repo URL
    const normalizedUrl = `https://github.com/${info.owner}/${info.repo}${info.path ? `/tree/${branch}/${info.path}` : ""}`;

    return {
        name,
        description,
        repoUrl: normalizedUrl,
        skillMd: rawSkillMd,
        rules,
    };
}
