import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const DetectionSchema = z.object({
  references: z.array(
    z.object({
      reference: z.string().describe('Canonical reference, e.g. "John 3:16"'),
      book: z.string().describe("Normalized book name, e.g. 'John', '1 Corinthians'"),
      chapter: z.number().int(),
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

// ─── Book name aliases ────────────────────────────────────────────────────────

const BOOK_ALIASES: Record<string, string> = {
  // OT
  gen: "Genesis", genesis: "Genesis",
  exo: "Exodus", exod: "Exodus", exodus: "Exodus",
  lev: "Leviticus", leviticus: "Leviticus",
  num: "Numbers", numbers: "Numbers",
  deu: "Deuteronomy", deut: "Deuteronomy", deuteronomy: "Deuteronomy",
  jos: "Joshua", josh: "Joshua", joshua: "Joshua",
  jdg: "Judges", judg: "Judges", judges: "Judges",
  rut: "Ruth", ruth: "Ruth",
  "1 sam": "1 Samuel", "1sam": "1 Samuel", "1 samuel": "1 Samuel",
  "2 sam": "2 Samuel", "2sam": "2 Samuel", "2 samuel": "2 Samuel",
  "1 ki": "1 Kings", "1ki": "1 Kings", "1 kings": "1 Kings",
  "2 ki": "2 Kings", "2ki": "2 Kings", "2 kings": "2 Kings",
  "1 ch": "1 Chronicles", "1chr": "1 Chronicles", "1 chronicles": "1 Chronicles",
  "2 ch": "2 Chronicles", "2chr": "2 Chronicles", "2 chronicles": "2 Chronicles",
  ezr: "Ezra", ezra: "Ezra",
  neh: "Nehemiah", nehemiah: "Nehemiah",
  est: "Esther", esther: "Esther",
  job: "Job",
  ps: "Psalm", psa: "Psalm", pss: "Psalm", psalm: "Psalm", psalms: "Psalm",
  pro: "Proverbs", prov: "Proverbs", proverbs: "Proverbs",
  ecc: "Ecclesiastes", eccl: "Ecclesiastes", ecclesiastes: "Ecclesiastes",
  "song of solomon": "Song of Solomon", "song of songs": "Song of Solomon",
  sos: "Song of Solomon", sng: "Song of Solomon",
  isa: "Isaiah", isaiah: "Isaiah",
  jer: "Jeremiah", jeremiah: "Jeremiah",
  lam: "Lamentations", lamentations: "Lamentations",
  eze: "Ezekiel", ezek: "Ezekiel", ezekiel: "Ezekiel",
  dan: "Daniel", daniel: "Daniel",
  hos: "Hosea", hosea: "Hosea",
  joe: "Joel", joel: "Joel",
  amo: "Amos", amos: "Amos",
  oba: "Obadiah", obadiah: "Obadiah",
  jon: "Jonah", jonah: "Jonah",
  mic: "Micah", micah: "Micah",
  nah: "Nahum", nahum: "Nahum",
  hab: "Habakkuk", habakkuk: "Habakkuk",
  zep: "Zephaniah", zeph: "Zephaniah", zephaniah: "Zephaniah",
  hag: "Haggai", haggai: "Haggai",
  zec: "Zechariah", zech: "Zechariah", zechariah: "Zechariah",
  mal: "Malachi", malachi: "Malachi",
  // NT
  mat: "Matthew", matt: "Matthew", matthew: "Matthew",
  mrk: "Mark", mark: "Mark",
  luk: "Luke", luke: "Luke",
  jhn: "John", john: "John", jn: "John",
  act: "Acts", acts: "Acts",
  rom: "Romans", romans: "Romans",
  "1 cor": "1 Corinthians", "1cor": "1 Corinthians", "1 corinthians": "1 Corinthians",
  "2 cor": "2 Corinthians", "2cor": "2 Corinthians", "2 corinthians": "2 Corinthians",
  gal: "Galatians", galatians: "Galatians",
  eph: "Ephesians", ephesians: "Ephesians",
  php: "Philippians", phil: "Philippians", philippians: "Philippians",
  col: "Colossians", colossians: "Colossians",
  "1 th": "1 Thessalonians", "1thess": "1 Thessalonians", "1 thessalonians": "1 Thessalonians",
  "2 th": "2 Thessalonians", "2thess": "2 Thessalonians", "2 thessalonians": "2 Thessalonians",
  "1 ti": "1 Timothy", "1tim": "1 Timothy", "1 timothy": "1 Timothy",
  "2 ti": "2 Timothy", "2tim": "2 Timothy", "2 timothy": "2 Timothy",
  tit: "Titus", titus: "Titus",
  phm: "Philemon", philemon: "Philemon",
  heb: "Hebrews", hebrews: "Hebrews",
  jas: "James", james: "James",
  "1 pe": "1 Peter", "1pet": "1 Peter", "1 peter": "1 Peter",
  "2 pe": "2 Peter", "2pet": "2 Peter", "2 peter": "2 Peter",
  "1 jn": "1 John", "1john": "1 John", "1 john": "1 John",
  "2 jn": "2 John", "2john": "2 John", "2 john": "2 John",
  "3 jn": "3 John", "3john": "3 John", "3 john": "3 John",
  jud: "Jude", jude: "Jude",
  rev: "Revelation", revelation: "Revelation", revelations: "Revelation",
};

function lookupBook(raw: string): string | null {
  return BOOK_ALIASES[raw.toLowerCase().trim()] ?? null;
}

function normalizeOrdinals(text: string): string {
  return text
    .replace(/\bfirst\b/gi, "1")
    .replace(/\bsecond\b/gi, "2")
    .replace(/\bthird\b/gi, "3")
    .replace(/\b1st\b/gi, "1")
    .replace(/\b2nd\b/gi, "2")
    .replace(/\b3rd\b/gi, "3");
}

function dedup(refs: Detection[]): Detection[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    if (seen.has(r.reference)) return false;
    seen.add(r.reference);
    return true;
  });
}

// ─── Regex-based explicit reference detector ──────────────────────────────────
// Used as primary detector (or fallback when no AI key is set)

function detectExplicitRefs(text: string): Detection[] {
  const t = normalizeOrdinals(text);
  const results: Detection[] = [];

  // Pattern 1: "Book Ch:V" or "Book Ch:V-V"  e.g. "John 3:16", "1 Cor 13:4-7"
  const shortRef =
    /\b((?:[123]\s+)?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\b/g;

  // Pattern 2: "Book chapter X verse Y" / "Book chapter X verses Y-Z"
  const verboseRef =
    /\b((?:[123]\s+)?[A-Za-z]+)\s+chapter\s+(\d+)[,\s]+verses?\s+(\d+)(?:\s*(?:through|to|-|–)\s*(\d+))?\b/gi;

  for (const pattern of [shortRef, verboseRef]) {
    for (const m of t.matchAll(pattern)) {
      const book = lookupBook(m[1]);
      if (!book) continue;
      const chapter = parseInt(m[2]);
      const vs = parseInt(m[3]);
      const ve = m[4] ? parseInt(m[4]) : 0;
      results.push({
        reference: ve ? `${book} ${chapter}:${vs}-${ve}` : `${book} ${chapter}:${vs}`,
        book,
        chapter,
        verse_start: vs,
        verse_end: ve,
        detection_method: "explicit",
        confidence: "high",
      });
    }
  }

  return dedup(results).slice(0, 3);
}

// ─── Bible text fetchers ──────────────────────────────────────────────────────

const BIBLE_API_FREE = new Set(["kjv", "web"]);

const APIBIBLE_IDS: Record<string, string> = {
  NIV: "06125adad2d5898a-01",
  ESV: "f421fe261da7624f-01",
  NLT: "65eec8e0b60e656b-01",
  NKJV: "de4e12af7f28f599-01",
  KJV: "de4e12af7f28f599-02",
  WEB: "9879dbb7cfe39e4d-01",
};

const BOOK_CODES: Record<string, string> = {
  Genesis: "GEN", Exodus: "EXO", Leviticus: "LEV", Numbers: "NUM",
  Deuteronomy: "DEU", Joshua: "JOS", Judges: "JDG", Ruth: "RUT",
  "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
  "1 Chronicles": "1CH", "2 Chronicles": "2CH", Ezra: "EZR", Nehemiah: "NEH",
  Esther: "EST", Job: "JOB", Psalm: "PSA", Proverbs: "PRO",
  Ecclesiastes: "ECC", "Song of Solomon": "SNG", Isaiah: "ISA",
  Jeremiah: "JER", Lamentations: "LAM", Ezekiel: "EZK", Daniel: "DAN",
  Hosea: "HOS", Joel: "JOL", Amos: "AMO", Obadiah: "OBA", Jonah: "JON",
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
    if (!res.ok) return { text: null, usedTranslation: tparam.toUpperCase(), error: `Lookup failed (${res.status})` };
    const json = (await res.json()) as { text?: string; error?: string };
    if (json.error || !json.text) return { text: null, usedTranslation: tparam.toUpperCase(), error: json.error ?? "No text" };
    return { text: json.text.trim().replace(/\s+/g, " "), usedTranslation: tparam.toUpperCase() };
  } catch (err) {
    return { text: null, usedTranslation: tparam.toUpperCase(), error: err instanceof Error ? err.message : "Network error" };
  }
}

async function fetchViaApiBible(
  book: string, chapter: number, verseStart: number, verseEnd: number | null,
  translation: string, apiKey: string,
): Promise<{ text: string | null; usedTranslation: string; error?: string }> {
  const upper = translation.toUpperCase();
  const bibleId = APIBIBLE_IDS[upper];
  if (!bibleId) return { text: null, usedTranslation: upper, error: `Translation ${upper} not configured` };
  const bookCode = BOOK_CODES[book];
  if (!bookCode) return { text: null, usedTranslation: upper, error: `Unknown book: ${book}` };

  const params = "content-type=text&include-verse-numbers=false&include-verse-spans=false&include-titles=false";
  const hasRange = verseEnd && verseEnd !== verseStart;
  const url = hasRange
    ? `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${encodeURIComponent(`${bookCode}.${chapter}.${verseStart}-${bookCode}.${chapter}.${verseEnd}`)}?${params}`
    : `https://api.scripture.api.bible/v1/bibles/${bibleId}/verses/${encodeURIComponent(`${bookCode}.${chapter}.${verseStart}`)}?${params}`;

  try {
    const res = await fetch(url, { headers: { "api-key": apiKey } });
    if (!res.ok) return { text: null, usedTranslation: upper, error: `API.Bible error (${res.status})` };
    const json = (await res.json()) as { data?: { content?: string } };
    const text = (json.data?.content ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) return { text: null, usedTranslation: upper, error: "Empty response" };
    return { text, usedTranslation: upper };
  } catch (err) {
    return { text: null, usedTranslation: upper, error: err instanceof Error ? err.message : "Network error" };
  }
}

async function fetchVerseText(
  book: string, chapter: number, verseStart: number, verseEnd: number | null,
  translation: string, apibibleKey?: string,
): Promise<{ text: string | null; usedTranslation: string; error?: string }> {
  const lower = translation.toLowerCase();
  if (BIBLE_API_FREE.has(lower)) {
    const ref = verseEnd && verseEnd !== verseStart
      ? `${book} ${chapter}:${verseStart}-${verseEnd}`
      : `${book} ${chapter}:${verseStart}`;
    return fetchViaBibleApi(ref, translation);
  }
  if (apibibleKey) {
    return fetchViaApiBible(book, chapter, verseStart, verseEnd, translation, apibibleKey);
  }
  // No key for premium translation — fall back to KJV
  const ref = verseEnd && verseEnd !== verseStart
    ? `${book} ${chapter}:${verseStart}-${verseEnd}`
    : `${book} ${chapter}:${verseStart}`;
  const result = await fetchViaBibleApi(ref, "kjv");
  return { ...result, usedTranslation: "KJV" };
}

async function resolveDetections(
  refs: Detection[],
  translation: string,
  apibibleKey?: string,
): Promise<ResolvedVerse[]> {
  return Promise.all(
    refs.map(async (r) => {
      if (!r.verse_start || r.verse_start <= 0) {
        return { ...r, verse_start: null, verse_end: null, text: null, translation, fetched: false };
      }
      const verseEnd = r.verse_end && r.verse_end !== r.verse_start ? r.verse_end : null;
      const { text, usedTranslation, error } = await fetchVerseText(
        r.book, r.chapter, r.verse_start, verseEnd, translation, apibibleKey,
      );
      return { ...r, verse_start: r.verse_start, verse_end: verseEnd, text, translation: usedTranslation, fetched: text != null, error };
    }),
  );
}

// ─── Server function ──────────────────────────────────────────────────────────

export const detectVerses = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(2).max(4000),
      translation: z.string().default("KJV"),
      apibible_key: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const aiKey = process.env.LOVABLE_API_KEY;

    // ── No AI key: use regex detection for explicit references ──
    if (!aiKey) {
      const refs = detectExplicitRefs(data.text);
      if (refs.length === 0) {
        return { references: [] as ResolvedVerse[], error: null, mode: "regex" };
      }
      const resolved = await resolveDetections(refs, data.translation, data.apibible_key);
      return { references: resolved, error: null, mode: "regex" };
    }

    // ── AI key present: use Gemini for full detection (explicit + implied + quotations) ──
    const gateway = createLovableAiGatewayProvider(aiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const systemPrompt = `You are WordFlow, a Bible reference detector for live sermons.
Analyze the sermon text and extract every Bible reference the preacher is making.

Detect THREE kinds:
1. EXPLICIT: "John 3:16", "Romans chapter 8 verse 28", "First Corinthians 13:4-7"
2. IMPLIED: "Turn to Ephesians", "Paul writes to the Philippians" (use chapter 1, verse 0)
3. QUOTATION: Well-known text quoted without a reference ("For God so loved the world" → John 3:16)

Rules:
- Normalize book names ("Revelations" → "Revelation", "Psalms 23" → "Psalm 23")
- Be conservative — only return references you are sure of
- Return AT MOST 3 most recent / clearly cited references
- If no reference, return empty array
- Never fabricate verses`;

    try {
      const result = await generateObject({ model, system: systemPrompt, prompt: `Sermon:\n"""${data.text}"""`, schema: DetectionSchema });
      const refs = result.object.references.slice(0, 3);
      const resolved = await resolveDetections(refs, data.translation, data.apibible_key);
      return { references: resolved, error: null, mode: "ai" };
    } catch (err) {
      // AI failed — fall back to regex so the display never goes dark
      const refs = detectExplicitRefs(data.text);
      const resolved = await resolveDetections(refs, data.translation, data.apibible_key);
      return {
        references: resolved,
        error: err instanceof Error ? err.message : "AI detection failed — using regex fallback",
        mode: "regex-fallback",
      };
    }
  });
