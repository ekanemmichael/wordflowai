import { useEffect, useState } from "react";
import type { ChurchSettings, ActiveVerse } from "@/lib/store";

type Props = {
  settings: ChurchSettings;
  verse: ActiveVerse;
  /** When true, scales typography down for in-app preview */
  preview?: boolean;
};

function buildBackground(s: ChurchSettings): React.CSSProperties {
  if (s.background_type === "gradient") {
    return {
      background: `linear-gradient(135deg, ${s.background_color} 0%, ${s.gradient_end} 100%)`,
    };
  }
  if (s.background_type === "image" && s.background_image) {
    return {
      backgroundImage: `url(${s.background_image})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: s.background_color };
}

/** Color Jesus' words: bible-api wraps red-letter portions? Not reliable.
 *  Approximate: if reference is in a Gospel and spoken_by_jesus flag set. */
function VerseText({
  text,
  redLetter,
  color,
}: {
  text: string;
  redLetter: boolean;
  color: string;
}) {
  if (!redLetter) return <>{text}</>;
  // Simple heuristic: color quoted speech in secondary color
  const parts = text.split(/(["“][^"”]+["”])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^["“]/.test(p) ? (
          <span key={i} style={{ color }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function VerseSlide({ settings: s, verse, preview = false }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, [verse.ts, verse.reference, verse.visible]);

  const visible = verse.visible && (verse.text || verse.reference);

  const verseSize = preview
    ? Math.max(18, Math.min(s.font_size_verse * 0.45, 28))
    : s.font_size_verse;
  const refSize = preview ? 16 : Math.max(20, s.font_size_verse * 0.42);

  const anim =
    s.animation === "instant"
      ? ""
      : s.animation === "fade"
        ? "transition-opacity duration-700"
        : s.animation === "zoom-soft"
          ? "transition-all duration-700 ease-out"
          : "transition-all duration-700 ease-out";

  const animState =
    !mounted && s.animation !== "instant"
      ? s.animation === "fade-up"
        ? "opacity-0 translate-y-6"
        : s.animation === "zoom-soft"
          ? "opacity-0 scale-95"
          : "opacity-0"
      : "opacity-100 translate-y-0 scale-100";

  const textStyle: React.CSSProperties = {
    color: s.text_color,
    fontFamily: `"${s.verse_font}", serif`,
    fontSize: `${verseSize}px`,
    lineHeight: 1.4,
    textAlign: s.text_alignment,
    textShadow: s.text_shadow ? "0 2px 24px rgba(0,0,0,0.6)" : undefined,
    fontWeight: 400,
  };

  const refStyle: React.CSSProperties = {
    color: s.reference_color,
    fontFamily: `"${s.reference_font}", system-ui, sans-serif`,
    fontSize: `${refSize}px`,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontWeight: 600,
  };

  const containerPad = preview ? "p-6" : "p-16";

  const Body = () => (
    <div className={`flex flex-col gap-6 ${alignClass(s.text_alignment)} max-w-5xl`}>
      {s.template === "lower-third" ? null : (
        <div style={refStyle} className="opacity-90">
          {verse.reference || "—"}
          {s.show_translation_badge && verse.translation ? (
            <span
              className="ml-3 rounded-full px-3 py-1 text-[0.6em] tracking-widest"
              style={{
                background: s.secondary_color,
                color: s.background_color,
              }}
            >
              {verse.translation}
            </span>
          ) : null}
        </div>
      )}
      <div style={textStyle}>
        {verse.text ? (
          <VerseText
            text={verse.text}
            redLetter={s.red_letter_mode}
            color={s.secondary_color}
          />
        ) : (
          <span className="opacity-60 italic">
            {verse.reference
              ? "Looking up verse…"
              : "Awaiting the next reference"}
          </span>
        )}
      </div>
      {s.template === "lower-third" && verse.reference ? (
        <div style={refStyle} className="opacity-90">
          {verse.reference}
          {s.show_translation_badge ? (
            <span
              className="ml-3 rounded-full px-3 py-1 text-[0.6em] tracking-widest"
              style={{
                background: s.secondary_color,
                color: s.background_color,
              }}
            >
              {verse.translation}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const bg = buildBackground(s);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ ...bg, color: s.text_color }}
    >
      {s.background_type === "image" && s.dark_overlay ? (
        <div className="absolute inset-0 bg-black/55" />
      ) : null}
      {s.background_type === "image" && s.blur_level > 0 ? (
        <style>{`.bg-blur-layer{backdrop-filter:blur(${s.blur_level}px)}`}</style>
      ) : null}

      {/* Header: logo + church name */}
      {(s.show_logo && s.logo_url) || s.show_church_name ? (
        <div
          className={`absolute ${preview ? "top-3 left-3" : "top-8 left-10"} z-10 flex items-center gap-3`}
        >
          {s.show_logo && s.logo_url ? (
            <img
              src={s.logo_url}
              alt={s.church_name}
              className={preview ? "h-7" : "h-12"}
              style={{ opacity: 0.9 }}
            />
          ) : null}
          {s.show_church_name ? (
            <div className="leading-tight">
              <div
                style={{
                  fontFamily: `"${s.reference_font}", sans-serif`,
                  color: s.text_color,
                  fontSize: preview ? 11 : 16,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {s.church_name}
              </div>
              {s.tagline ? (
                <div
                  style={{
                    fontFamily: `"${s.reference_font}", sans-serif`,
                    color: s.secondary_color,
                    fontSize: preview ? 9 : 12,
                    opacity: 0.85,
                  }}
                >
                  {s.tagline}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Slide body */}
      <div
        className={`relative z-10 flex h-full w-full items-center justify-center ${containerPad} ${anim} ${animState} ${visible ? "" : "opacity-0"}`}
      >
        {s.template === "centered-card" ? (
          <div
            className="rounded-2xl px-12 py-10"
            style={{
              background: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(6px)",
              border: `1px solid ${s.secondary_color}33`,
            }}
          >
            <Body />
          </div>
        ) : (
          <Body />
        )}
      </div>

      {s.show_powered_by ? (
        <div
          className={`absolute ${preview ? "bottom-2 right-3 text-[9px]" : "bottom-6 right-8 text-xs"} z-10 opacity-40`}
          style={{
            color: s.text_color,
            fontFamily: `"${s.reference_font}", sans-serif`,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Powered by WordFlow
        </div>
      ) : null}
    </div>
  );
}

function alignClass(a: "left" | "center" | "right") {
  if (a === "left") return "items-start text-left";
  if (a === "right") return "items-end text-right";
  return "items-center text-center";
}
