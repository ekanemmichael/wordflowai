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

export type ResolvedVerse = Omit<Detection, "verse_start" | "verse_end"> & {
  verse_start: number | null;
  verse_end: number | null;
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
Analyze the sermon text and surface every Bible passage the preacher is referencing — whether they CITE it, ALLUDE to it, or QUOTE it (even partially or paraphrased).

Detect FOUR kinds of references:
1. EXPLICIT: "John 3:16", "Romans chapter 8 verse 28", "First Corinthians 13 verses 4 through 7", "the 23rd Psalm".
2. IMPLIED / BOOK MENTION: "Turn to Ephesians", "Paul writes to the Philippians" — chapter unknown, return chapter 1 and verse_start 0.
3. QUOTATION: Recognizable Bible text spoken WITHOUT a reference. Examples:
   - "For God so loved the world that he gave his only begotten Son" → John 3:16
   - "The Lord is my shepherd, I shall not want" → Psalm 23:1
   - "I can do all things through Christ" → Philippians 4:13
   - "In the beginning God created the heavens and the earth" → Genesis 1:1
   - "All things work together for good" → Romans 8:28
   - "Faith is the substance of things hoped for" → Hebrews 11:1
4. PARAPHRASE: A clearly recognizable rewording of a specific verse. Only match if you are confident which exact verse it maps to.

Rules:
- Be GENEROUS with QUOTATION detection — even 5-8 distinctive words from a famous verse should be caught.
- Be CONSERVATIVE with PARAPHRASE — only when the wording maps to one specific verse.
- Prioritize the MOST RECENT references in the text (end of input = what the preacher just said).
- Normalize book names ("Revelations" → "Revelation", "1st John" → "1 John", "Psalms 23" → "Psalm 23", "Saint John" → "John").
- Set detection_method honestly: explicit / implied / quotation. Use "quotation" for paraphrases too.
- Set confidence honestly (high = certain, medium = likely, low = guess — skip lows unless explicit).
- Return AT MOST the 3 most recent / most clearly cited references, newest last.
- If no Bible reference is present, return an empty array.
- NEVER invent a verse. If unsure of the exact verse but sure of the book/chapter, return verse_start 0.`;

    let detection: z.infer<typeof DetectionSchema>;
    try {
      const result = await generateObject({
        model,
        system: systemPrompt,
        prompt: `Sermon text:\n"""${data.text}"""`,
        schema: DetectionSchema,
        
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
