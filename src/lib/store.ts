import { useEffect, useState, useCallback } from "react";

export type BackgroundType = "solid" | "gradient" | "image";
export type Template = "centered-card" | "full-bleed" | "lower-third" | "cinematic";
export type Animation = "fade" | "fade-up" | "zoom-soft" | "instant";

export type ChurchSettings = {
  church_name: string;
  tagline: string;
  logo_url: string;
  show_logo: boolean;
  show_church_name: boolean;
  // colors
  primary_color: string;
  secondary_color: string;
  background_color: string;
  background_type: BackgroundType;
  gradient_end: string;
  background_image: string;
  blur_level: number;
  dark_overlay: boolean;
  text_color: string;
  reference_color: string;
  // typography
  verse_font: string;
  reference_font: string;
  font_size_verse: number;
  text_alignment: "left" | "center" | "right";
  text_shadow: boolean;
  // layout
  template: Template;
  animation: Animation;
  show_translation_badge: boolean;
  show_powered_by: boolean;
  // translation
  translation: string;
  red_letter_mode: boolean;
  // API keys
  apibible_key: string;
};

export const DEFAULT_SETTINGS: ChurchSettings = {
  church_name: "Grace Chapel International",
  tagline: "Where Faith Comes Alive",
  logo_url: "",
  show_logo: true,
  show_church_name: true,
  primary_color: "#1A237E",
  secondary_color: "#FFD700",
  background_color: "#0D0D0D",
  background_type: "gradient",
  gradient_end: "#1A237E",
  background_image: "",
  blur_level: 2,
  dark_overlay: true,
  text_color: "#FFFFFF",
  reference_color: "#FFD700",
  verse_font: "Cinzel",
  reference_font: "Inter",
  font_size_verse: 52,
  text_alignment: "center",
  text_shadow: true,
  template: "centered-card",
  animation: "fade-up",
  show_translation_badge: true,
  show_powered_by: true,
  translation: "KJV",
  red_letter_mode: true,
  apibible_key: "",
};

const SETTINGS_KEY = "wordflow:settings";
const VERSE_KEY = "wordflow:active-verse";
const CHANNEL = "wordflow";

export type ActiveVerse = {
  reference: string;
  text: string | null;
  translation: string;
  spoken_by_jesus?: boolean;
  visible: boolean;
  ts: number;
};

const EMPTY_VERSE: ActiveVerse = {
  reference: "",
  text: null,
  translation: "KJV",
  visible: false,
  ts: 0,
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<ChurchSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(readJSON(SETTINGS_KEY, DEFAULT_SETTINGS));
    const channel = new BroadcastChannel(CHANNEL);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "settings") setSettings(e.data.payload);
    };
    channel.addEventListener("message", onMsg);
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY && e.newValue) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) });
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      channel.removeEventListener("message", onMsg);
      channel.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<ChurchSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        const ch = new BroadcastChannel(CHANNEL);
        ch.postMessage({ type: "settings", payload: next });
        ch.close();
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return { settings, update };
}

export function useActiveVerse() {
  const [verse, setVerse] = useState<ActiveVerse>(EMPTY_VERSE);

  useEffect(() => {
    setVerse(readJSON(VERSE_KEY, EMPTY_VERSE));
    const channel = new BroadcastChannel(CHANNEL);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "verse") setVerse(e.data.payload);
    };
    channel.addEventListener("message", onMsg);
    const onStorage = (e: StorageEvent) => {
      if (e.key === VERSE_KEY && e.newValue) {
        try {
          setVerse(JSON.parse(e.newValue));
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      channel.removeEventListener("message", onMsg);
      channel.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return verse;
}

export function broadcastVerse(verse: ActiveVerse) {
  try {
    localStorage.setItem(VERSE_KEY, JSON.stringify(verse));
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ type: "verse", payload: verse });
    ch.close();
  } catch {
    /* noop */
  }
}
