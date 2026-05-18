// All detection and verse fetching runs entirely in the browser.
// No server round-trip needed for the core path.

export type ResolvedVerse = {
  reference: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  text: string | null;
  translation: string;
  detection_method: "explicit" | "implied" | "quotation";
  confidence: "high" | "medium" | "low";
  fetched: boolean;
  error?: string;
};

// ─── Book aliases ─────────────────────────────────────────────────────────────

const ALIASES: Record<string, string> = {
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

const APIBIBLE_IDS: Record<string, string> = {
  NIV: "06125adad2d5898a-01",
  ESV: "f421fe261da7624f-01",
  NLT: "65eec8e0b60e656b-01",
  NKJV: "de4e12af7f28f599-01",
  KJV: "de4e12af7f28f599-02",
  WEB: "9879dbb7cfe39e4d-01",
};

const FREE = new Set(["kjv", "web"]);
const APIBIBLE_KEY = "zSVRj_oOL2SSZg3s8y415";

// ─── In-memory verse cache ────────────────────────────────────────────────────

const cache = new Map<string, string>();

// ─── Regex detection ──────────────────────────────────────────────────────────

function normalizeOrdinals(t: string) {
  return t
    .replace(/\bfirst\b/gi, "1").replace(/\bsecond\b/gi, "2").replace(/\bthird\b/gi, "3")
    .replace(/\b1st\b/gi, "1").replace(/\b2nd\b/gi, "2").replace(/\b3rd\b/gi, "3");
}

type RawRef = { reference: string; book: string; chapter: number; verse_start: number; verse_end: number };

export function detectExplicit(text: string): RawRef[] {
  const t = normalizeOrdinals(text);
  const results: RawRef[] = [];
  const seen = new Set<string>();

  const shortRef = /\b((?:[123]\s+)?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\b/g;
  const verboseRef = /\b((?:[123]\s+)?[A-Za-z]+)\s+chapter\s+(\d+)[,\s]+verses?\s+(\d+)(?:\s*(?:through|to|-|–)\s*(\d+))?\b/gi;

  for (const pattern of [shortRef, verboseRef]) {
    for (const m of t.matchAll(pattern)) {
      const book = ALIASES[m[1].toLowerCase().trim()];
      if (!book) continue;
      const chapter = parseInt(m[2]);
      const vs = parseInt(m[3]);
      const ve = m[4] ? parseInt(m[4]) : 0;
      const reference = ve ? `${book} ${chapter}:${vs}-${ve}` : `${book} ${chapter}:${vs}`;
      if (seen.has(reference)) continue;
      seen.add(reference);
      results.push({ reference, book, chapter, verse_start: vs, verse_end: ve });
    }
  }
  return results.slice(0, 3);
}

// ─── Verse fetching ───────────────────────────────────────────────────────────

async function fetchFree(reference: string, translation: string): Promise<string | null> {
  const key = `free:${translation}:${reference}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation.toLowerCase()}`,
    );
    if (!res.ok) return null;
    const json = await res.json() as { text?: string };
    const text = json.text?.trim().replace(/\s+/g, " ") ?? null;
    if (text) cache.set(key, text);
    return text;
  } catch { return null; }
}

async function fetchApiBible(
  book: string, chapter: number, vs: number, ve: number | null, translation: string,
): Promise<string | null> {
  const upper = translation.toUpperCase();
  const key = `api:${upper}:${book}${chapter}:${vs}-${ve}`;
  if (cache.has(key)) return cache.get(key)!;

  const bibleId = APIBIBLE_IDS[upper];
  const bookCode = BOOK_CODES[book];
  if (!bibleId || !bookCode) return null;

  const params = "content-type=text&include-verse-numbers=false&include-verse-spans=false&include-titles=false";
  const url = ve
    ? `https://rest.api.bible/v1/bibles/${bibleId}/passages/${encodeURIComponent(`${bookCode}.${chapter}.${vs}-${bookCode}.${chapter}.${ve}`)}?${params}`
    : `https://rest.api.bible/v1/bibles/${bibleId}/verses/${encodeURIComponent(`${bookCode}.${chapter}.${vs}`)}?${params}`;

  try {
    const res = await fetch(url, { headers: { "api-key": APIBIBLE_KEY } });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { content?: string } };
    const text = (json.data?.content ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) cache.set(key, text);
    return text || null;
  } catch { return null; }
}

async function fetchVerse(
  book: string, chapter: number, vs: number, ve: number | null, translation: string,
): Promise<{ text: string | null; usedTranslation: string }> {
  const lower = translation.toLowerCase();

  if (FREE.has(lower)) {
    const ref = ve ? `${book} ${chapter}:${vs}-${ve}` : `${book} ${chapter}:${vs}`;
    const text = await fetchFree(ref, translation);
    return { text, usedTranslation: translation.toUpperCase() };
  }

  // Try premium translation via API.Bible
  const text = await fetchApiBible(book, chapter, vs, ve, translation);
  if (text) return { text, usedTranslation: translation.toUpperCase() };

  // Fall back to KJV
  const ref = ve ? `${book} ${chapter}:${vs}-${ve}` : `${book} ${chapter}:${vs}`;
  const fallback = await fetchFree(ref, "kjv");
  return { text: fallback, usedTranslation: "KJV" };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function detectAndFetch(text: string, translation: string): Promise<ResolvedVerse[]> {
  const refs = detectExplicit(text);
  if (refs.length === 0) return [];

  return Promise.all(refs.map(async (r) => {
    const ve = r.verse_end && r.verse_end !== r.verse_start ? r.verse_end : null;
    const { text: verseText, usedTranslation } = await fetchVerse(
      r.book, r.chapter, r.verse_start, ve, translation,
    );
    return {
      reference: r.reference,
      book: r.book,
      chapter: r.chapter,
      verse_start: r.verse_start,
      verse_end: ve,
      text: verseText,
      translation: usedTranslation,
      detection_method: "explicit" as const,
      confidence: "high" as const,
      fetched: verseText !== null,
    };
  }));
}
