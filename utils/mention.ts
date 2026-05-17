export type MentionOption = {
    label: string;
    value: number;
};

export type MentionSegment =
    | {
          type: "text";
          content: string;
      }
    | {
          type: "mention";
          id: number;
          label: string;
      };

const MENTION_TOKEN_PREFIX = "__AZIR_MENTION__";
const MENTION_TAG_PATTERN =
    /<span\b(?=[^>]*\bi-memtion-tag\b)(?=[^>]*\bdata-memtion-value=(["'])(\d+)\1)[^>]*><\/span>/gi;
const LINE_BREAK_TAG_PATTERN = /<br\s*\/?>/gi;
const BLOCK_END_TAG_PATTERN = /<\/(div|p|li|h[1-6])>/gi;
const TAG_PATTERN = /<[^>]+>/g;
const HTML_ENTITY_MAP: Record<string, string> = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
};

function decodeHtmlEntities(input: string) {
    return input.replace(
        /&nbsp;|&lt;|&gt;|&amp;|&quot;|&#39;/g,
        (entity) => HTML_ENTITY_MAP[entity] ?? entity,
    );
}

function stripRichText(input: string) {
    return decodeHtmlEntities(
        input
            .replace(LINE_BREAK_TAG_PATTERN, "\n")
            .replace(BLOCK_END_TAG_PATTERN, "\n")
            .replace(TAG_PATTERN, ""),
    );
}

function uniqNumbers(values: number[]) {
    return Array.from(new Set(values));
}

function normalizeWhitespace(input: string) {
    return input
        .trim()
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n");
}

function mergeTextSegments(segments: MentionSegment[]) {
    const merged: MentionSegment[] = [];

    for (const segment of segments) {
        if (!segment.type) {
            continue;
        }

        const previous = merged.at(-1);
        if (segment.type === "text" && previous?.type === "text") {
            previous.content += segment.content;
            continue;
        }

        merged.push(segment);
    }

    return merged;
}

function parsePlainTextMentions(
    input: string,
    mentionOptions: MentionOption[],
): MentionSegment[] {
    const options = [...mentionOptions].sort(
        (left, right) => right.label.length - left.label.length,
    );
    const segments: MentionSegment[] = [];
    let textBuffer = "";
    let index = 0;

    const flushTextBuffer = () => {
        if (!textBuffer) {
            return;
        }

        segments.push({
            type: "text",
            content: textBuffer,
        });
        textBuffer = "";
    };

    while (index < input.length) {
        if (input[index] !== "@") {
            textBuffer += input[index];
            index += 1;
            continue;
        }

        const matchedOption = options.find((option) =>
            input.slice(index + 1).startsWith(option.label),
        );
        if (!matchedOption) {
            textBuffer += input[index];
            index += 1;
            continue;
        }

        flushTextBuffer();
        segments.push({
            type: "mention",
            id: matchedOption.value,
            label: matchedOption.label,
        });
        index += matchedOption.label.length + 1;
    }

    flushTextBuffer();

    return segments;
}

export function extractMentionIdsFromMarkup(input: string) {
    return uniqNumbers(
        Array.from(
            input.matchAll(
                new RegExp(
                    MENTION_TAG_PATTERN.source,
                    MENTION_TAG_PATTERN.flags,
                ),
            ),
            (match) => Number(match[2]),
        ).filter((id) => Number.isFinite(id)),
    );
}

export function resolveMentionPayload(
    input: string,
    mentionOptions: MentionOption[],
) {
    const markupMentionIds = extractMentionIdsFromMarkup(input);
    const plainMentionIds = mentionOptions
        .filter((option) => input.includes(`@${option.label}`))
        .map((option) => option.value);

    const prompt = mentionOptions
        .reduce(
            (text, option) => text.replaceAll(`@${option.label}`, " "),
            stripRichText(input.replace(MENTION_TAG_PATTERN, " ")),
        )
        .trim()
        .replace(/[^\S\n]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n");

    return {
        agentIds: uniqNumbers([...markupMentionIds, ...plainMentionIds]),
        displayContent: normalizeWhitespace(input),
        prompt,
    };
}

export function parseMentionContent(
    input: string,
    mentionOptions: MentionOption[],
): MentionSegment[] {
    const labelById = new Map(
        mentionOptions.map((option) => [option.value, option.label]),
    );
    const tokenized = input.replace(
        MENTION_TAG_PATTERN,
        (_match, _quote, id) => `${MENTION_TOKEN_PREFIX}${id}__`,
    );
    const normalized = normalizeWhitespace(stripRichText(tokenized));
    const parts = normalized.split(
        new RegExp(`(${MENTION_TOKEN_PREFIX}\\d+__)`, "g"),
    );
    const segments: MentionSegment[] = [];

    for (const part of parts) {
        if (!part) {
            continue;
        }

        const mentionId = part.startsWith(MENTION_TOKEN_PREFIX)
            ? Number(part.slice(MENTION_TOKEN_PREFIX.length, part.length - 2))
            : Number.NaN;

        if (Number.isFinite(mentionId)) {
            segments.push({
                type: "mention",
                id: mentionId,
                label: labelById.get(mentionId) ?? String(mentionId),
            });
            continue;
        }

        segments.push(...parsePlainTextMentions(part, mentionOptions));
    }

    const normalizedSegments = mergeTextSegments(segments);

    return normalizedSegments.length
        ? normalizedSegments
        : [
              {
                  type: "text",
                  content: normalized,
              },
          ];
}
