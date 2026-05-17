import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const DetectionSchema = z.object({
  references: z
    .array(
      z.object({
        reference: z
          .string()
          .describe('Canonical reference, e.g. "John 3:16" or "Romans 8:28-30"'),
        book: z.string().describe("Normalized book name, e.g. 'John', '1 Corinthians', 'Psalm'"),
        chapter: z.number().int().describe("Chapter number. Use 1 if unknown."),
        verse_start: z.number().int().describe("First verse, or 0 if no specific verse"),
        verse_end: z.number().int().describe("Last verse, or 0 if single/none"),
        detection_method: z.enum(["explicit", "implied", "quotation"]),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    ),
});

type Detection = z.infer<typeof DetectionSchema>["references"][number];

export type ResolvedVerse = Detection & {
  text: string | null;
  translation: string;
  fetched: boolean;
  error?: string;
};

// bible-api.com supports KJV (default) and WEB free of charge
const SUPPORTED_FREE = new Set(["kjv", "web"]);

async function fetchVerseText(
  reference: string,
  translation: string,
): Promise<{ text: string | null; usedTranslation: string; error?: string }> {
  const lower = translation.toLowerCase();
  const tparam = SUPPORTED_FREE.has(lower) ? lower : "kjv";
  const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${tparam}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        text: null,
        usedTranslation: tparam.toUpperCase(),
        error: `Lookup failed (${res.status})`,
      };
    }
    const json = (await res.json()) as { text?: string; error?: string };
    if (json.error || !json.text) {
      return {
        text: null,
        usedTranslation: tparam.toUpperCase(),
        error: json.error ?? "No text returned",
      };
    }
    return {
      text: json.text.trim().replace(/\s+/g, " "),
      usedTranslation: tparam.toUpperCase(),
    };
  } catch (err) {
    return {
      text: null,
      usedTranslation: tparam.toUpperCase(),
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export const detectVerses = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(2).max(4000),
      translation: z.string().default("KJV"),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { references: [] as ResolvedVerse[], error: "Missing AI key" };
    }
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const systemPrompt = `You are WordFlow, a Bible reference detector for live sermons.
Analyze the provided sermon text and extract every Bible reference the preacher is making.

Detect THREE kinds of references:
1. EXPLICIT: "John 3:16", "Romans chapter 8 verse 28", "First Corinthians 13:4-7".
2. IMPLIED: "Turn to the book of Ephesians", "Paul writes to the Philippians" (chapter unknown — return chapter 1, verses null).
3. QUOTATION: Well-known verse text quoted without a reference (e.g. "For God so loved the world..." → John 3:16).

Rules:
- Normalize book names ("Revelations" → "Revelation", "1st John" → "1 John", "Psalms 23" → "Psalm 23").
- Only return references you are reasonably sure of. Skip vague mentions.
- Set detection_method accurately and confidence honestly.
- Return AT MOST the 3 most recent / most clearly cited references.
- If no Bible reference is present, return an empty array.
- Never fabricate or invent verses.`;

    let detection: z.infer<typeof DetectionSchema>;
    try {
      const result = await generateObject({
        model,
        system: systemPrompt,
        prompt: `Sermon text:\n"""${data.text}"""`,
        schema: DetectionSchema,
        mode: "json",
      });
      detection = result.object;
    } catch (err) {
      return {
        references: [] as ResolvedVerse[],
        error: err instanceof Error ? err.message : "Detection failed",
      };
    }

    const refs = detection.references.slice(0, 3);
    const resolved: ResolvedVerse[] = await Promise.all(
      refs.map(async (r) => {
        if (!r.verse_start || r.verse_start <= 0) {
          // Implied — no specific verses, skip text fetch
          return {
            ...r,
            verse_start: null,
            verse_end: null,
            text: null,
            translation: data.translation,
            fetched: false,
          };
        }

        const lookupRef =
          r.verse_end && r.verse_end !== r.verse_start
            ? `${r.book} ${r.chapter}:${r.verse_start}-${r.verse_end}`
            : `${r.book} ${r.chapter}:${r.verse_start}`;
        const { text, usedTranslation, error } = await fetchVerseText(
          lookupRef,
          data.translation,
        );
        return {
          ...r,
          text,
          translation: usedTranslation,
          fetched: text != null,
          error,
        };
      }),
    );

    return { references: resolved, error: null as string | null };
  });
