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

// bible-api.com supports KJV and WEB free of charge
const BIBLE_API_FREE = new Set(["kjv", "web"]);

// API.Bible (api.bible) Bible IDs for common translations
const APIBIBLE_IDS: Record<string, string> = {
  NIV: "06125adad2d5898a-01",
  ESV: "f421fe261da7624f-01",
  NLT: "65eec8e0b60e656b-01",
  NKJV: "de4e12af7f28f599-01",
  KJV: "de4e12af7f28f599-02",
  WEB: "9879dbb7cfe39e4d-01",
};

// USFM book codes required by API.Bible
const BOOK_CODES: Record<string, string> = {
  Genesis: "GEN", Exodus: "EXO", Leviticus: "LEV", Numbers: "NUM",
  Deuteronomy: "DEU", Joshua: "JOS", Judges: "JDG", Ruth: "RUT",
  "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
  "1 Chronicles": "1CH", "2 Chronicles": "2CH", Ezra: "EZR", Nehemiah: "NEH",
  Esther: "EST", Job: "JOB", Psalm: "PSA", Psalms: "PSA",
  Proverbs: "PRO", Ecclesiastes: "ECC", "Song of Solomon": "SNG",
  "Song of Songs": "SNG", Isaiah: "ISA", Jeremiah: "JER",
  Lamentations: "LAM", Ezekiel: "EZK", Daniel: "DAN", Hosea: "HOS",
  Joel: "JOL", Amos: "AMO", Obadiah: "OBA", Jonah: "JON",
  Micah: "MIC", Nahum: "NAM", Habakkuk: "HAB", Zephaniah: "ZEP",
  Haggai: "HAG", Zechariah: "ZEC", Malachi: "MAL",
  Matthew: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN",
  Acts: "ACT", Romans: "ROM",
  "1 Corinthians": "1CO", "2 Corinthians": "2CO",
  Galatians: "GAL", Ephesians: "EPH", Philippians: "PHP", Colossians: "COL",
  "1 Thessalonians": "1TH", "2 Thessalonians": "2TH",
  "1 Timothy": "1TI", "2 Timothy": "2TI",
  Titus: "TIT", Philemon: "PHM", Hebrews: "HEB", James: "JAS",
  "1 Peter": "1PE", "2 Peter": "2PE",
  "1 John": "1JN", "2 John": "2JN", "3 John": "3JN",
  Jude: "JUD", Revelation: "REV",
};

async function fetchViaBibleApi(
  reference: string,
  translation: string,
): Promise<{ text: string | null; usedTranslation: string; error?: string }> {
  const tparam = translation.toLowerCase();
  const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${tparam}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { text: null, usedTranslation: tparam.toUpperCase(), error: `Lookup failed (${res.status})` };
    }
    const json = (await res.json()) as { text?: string; error?: string };
    if (json.error || !json.text) {
      return { text: null, usedTranslation: tparam.toUpperCase(), error: json.error ?? "No text returned" };
    }
    return { text: json.text.trim().replace(/\s+/g, " "), usedTranslation: tparam.toUpperCase() };
  } catch (err) {
    return { text: null, usedTranslation: tparam.toUpperCase(), error: err instanceof Error ? err.message : "Network error" };
  }
}

async function fetchViaApiBible(
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
  translation: string,
  apiKey: string,
): Promise<{ text: string | null; usedTranslation: string; error?: string }> {
  const upper = translation.toUpperCase();
  const bibleId = APIBIBLE_IDS[upper];
  if (!bibleId) {
    return { text: null, usedTranslation: upper, error: `Translation ${upper} not configured` };
  }
  const bookCode = BOOK_CODES[book];
  if (!bookCode) {
    return { text: null, usedTranslation: upper, error: `Unknown book: ${book}` };
  }

  const hasRange = verseEnd && verseEnd !== verseStart;
  const baseParams = "content-type=text&include-verse-numbers=false&include-verse-spans=false&include-titles=false";

  let url: string;
  if (hasRange) {
    const passageId = `${bookCode}.${chapter}.${verseStart}-${bookCode}.${chapter}.${verseEnd}`;
    url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}?${baseParams}`;
  } else {
    const verseId = `${bookCode}.${chapter}.${verseStart}`;
    url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/verses/${encodeURIComponent(verseId)}?${baseParams}`;
  }

  try {
    const res = await fetch(url, { headers: { "api-key": apiKey } });
    if (!res.ok) {
      return { text: null, usedTranslation: upper, error: `API.Bible error (${res.status})` };
    }
    const json = (await res.json()) as { data?: { content?: string } };
    const raw = json.data?.content ?? "";
    const text = raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) {
      return { text: null, usedTranslation: upper, error: "Empty response from API.Bible" };
    }
    return { text, usedTranslation: upper };
  } catch (err) {
    return { text: null, usedTranslation: upper, error: err instanceof Error ? err.message : "Network error" };
  }
}

async function fetchVerseText(
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
  translation: string,
  apibibleKey?: string,
): Promise<{ text: string | null; usedTranslation: string; error?: string }> {
  const lower = translation.toLowerCase();

  // Use free bible-api.com for KJV and WEB
  if (BIBLE_API_FREE.has(lower)) {
    const ref =
      verseEnd && verseEnd !== verseStart
        ? `${book} ${chapter}:${verseStart}-${verseEnd}`
        : `${book} ${chapter}:${verseStart}`;
    return fetchViaBibleApi(ref, translation);
  }

  // Use API.Bible for premium translations if a key is supplied
  if (apibibleKey) {
    return fetchViaApiBible(book, chapter, verseStart, verseEnd, translation, apibibleKey);
  }

  // No key — fall back to KJV so the display is never empty
  const ref =
    verseEnd && verseEnd !== verseStart
      ? `${book} ${chapter}:${verseStart}-${verseEnd}`
      : `${book} ${chapter}:${verseStart}`;
  const result = await fetchViaBibleApi(ref, "kjv");
  return { ...result, usedTranslation: "KJV (fallback — add API.Bible key for " + translation + ")" };
}

export const detectVerses = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(2).max(4000),
      translation: z.string().default("KJV"),
      apibible_key: z.string().optional(),
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
          return {
            ...r,
            verse_start: null,
            verse_end: null,
            text: null,
            translation: data.translation,
            fetched: false,
          };
        }

        const verseEnd = r.verse_end && r.verse_end !== r.verse_start ? r.verse_end : null;
        const { text, usedTranslation, error } = await fetchVerseText(
          r.book,
          r.chapter,
          r.verse_start,
          verseEnd,
          data.translation,
          data.apibible_key,
        );
        return {
          ...r,
          verse_start: r.verse_start,
          verse_end: verseEnd,
          text,
          translation: usedTranslation,
          fetched: text != null,
          error,
        };
      }),
    );

    return { references: resolved, error: null as string | null };
  });
