"use client";

import { useRef, useState } from "react";
import { Sparkles, Mic, BookOpen, Zap, Upload, X, ArrowRight } from "lucide-react";

type OnboardData = { church_name: string; tagline: string; logo_url: string };

export default function LandingPage({ onEnter }: { onEnter: (d: OnboardData) => void }) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logo, setLogo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 650));
    onEnter({
      church_name: name.trim(),
      tagline: tagline.trim() || "Where Faith Comes Alive",
      logo_url: logo,
    });
  };

  return (
    <div className="relative min-h-screen bg-[#07070c] text-white overflow-hidden flex flex-col">
      {/* ── Custom keyframes ─────────────────────────────────────────── */}
      <style>{`
        @keyframes orb-a {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(40px,-28px) scale(1.07); }
          66%      { transform: translate(-22px,18px) scale(0.96); }
        }
        @keyframes orb-b {
          0%,100% { transform: translate(0,0) scale(1); }
          42%      { transform: translate(-50px,34px) scale(1.1); }
          74%      { transform: translate(28px,-38px) scale(0.93); }
        }
        @keyframes orb-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(32px,36px) scale(1.05); }
        }
        @keyframes fu {
          from { opacity:0; transform:translateY(26px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes fi { from{opacity:0} to{opacity:1} }
        @keyframes shimmer {
          0%   { background-position:-220% center; }
          100% { background-position: 220% center; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes ping-ring {
          75%,100% { transform:scale(2); opacity:0; }
        }
        .orb-a { animation: orb-a 20s ease-in-out infinite; }
        .orb-b { animation: orb-b 26s ease-in-out infinite; }
        .orb-c { animation: orb-c 17s ease-in-out infinite; }
        .orb-d { animation: orb-a 31s ease-in-out infinite reverse; }
        .orb-e { animation: orb-b 23s ease-in-out infinite 8s; }
        .fu    { animation: fu 0.78s cubic-bezier(0.16,1,0.3,1) both; }
        .fi    { animation: fi 0.9s ease both; }
        .d0  { animation-delay:0.05s; }
        .d1  { animation-delay:0.15s; }
        .d2  { animation-delay:0.27s; }
        .d3  { animation-delay:0.40s; }
        .d4  { animation-delay:0.54s; }
        .d5  { animation-delay:0.68s; }
        .d6  { animation-delay:0.84s; }
        .d7  { animation-delay:1.00s; }
        .shimmer-btn {
          background: linear-gradient(110deg,#f59e0b 35%,#fde68a 50%,#f59e0b 65%);
          background-size: 260% auto;
        }
        .shimmer-btn:hover:not(:disabled) { animation: shimmer 1.1s linear infinite; }
        .spin-sm { animation: spin 0.75s linear infinite; }
        .ping-dot::before {
          content:'';
          position:absolute;inset:0;
          border-radius:9999px;
          background:currentColor;
          animation: ping-ring 1.2s cubic-bezier(0,0,0.2,1) infinite;
          opacity:0.5;
        }
      `}</style>

      {/* ── Ambient background ──────────────────────────────────────── */}
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="orb-a absolute -top-[10%] left-[10%] w-[600px] h-[600px] rounded-full bg-amber-500/[0.07] blur-[130px]" />
        <div className="orb-b absolute top-[22%] -right-[6%] w-[450px] h-[450px] rounded-full bg-amber-600/[0.065] blur-[140px]" />
        <div className="orb-c absolute bottom-[5%] -left-[4%] w-[500px] h-[500px] rounded-full bg-amber-400/[0.055] blur-[115px]" />
        <div className="orb-d absolute -bottom-[14%] right-[16%] w-[400px] h-[400px] rounded-full bg-yellow-500/[0.06] blur-[110px]" />
        <div className="orb-e absolute top-[52%] left-[46%] w-[280px] h-[280px] rounded-full bg-amber-300/[0.04] blur-[95px]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#07070c]/60" />
      </div>

      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <nav className="fi d0 relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-amber-400/30 blur-md" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
          </div>
          <span className="font-bold text-sm tracking-tight">WordFlow</span>
        </div>
        <span className="text-[11px] text-white/25 border border-white/[0.08] rounded-full px-3.5 py-1.5">
          Built for churches
        </span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-16 px-8 py-12 max-w-6xl mx-auto w-full">

        {/* Left: copy */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-lg">

          {/* Live pill */}
          <div className="fu d1 inline-flex items-center gap-2.5 border border-amber-500/20 bg-amber-500/[0.07] rounded-full px-4 py-2 text-[11px] text-amber-400 font-medium mb-7 shadow-[0_0_28px_rgba(245,158,11,0.07)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            Live Scripture · Zero signup
          </div>

          {/* Headline */}
          <h1
            className="fu d2 font-black leading-[0.90] tracking-tight mb-6"
            style={{ fontSize: "clamp(52px, 8vw, 104px)" }}
          >
            <span className="block bg-gradient-to-b from-white via-white to-white/55 bg-clip-text text-transparent">
              Word
            </span>
            <span className="block bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 bg-clip-text text-transparent">
              Flow
            </span>
          </h1>

          {/* Body */}
          <p className="fu d3 text-white/45 text-lg leading-relaxed mb-8 max-w-md">
            Every Bible verse the pastor mentions appears on the projector{" "}
            <span className="text-white/70 font-medium">before the congregation can reach for their phone</span>. No
            media team scramble. No manual lookup.
          </p>

          {/* Feature list */}
          <ul className="fu d4 space-y-3">
            {[
              { icon: Zap,      label: "Detects references in under 120ms" },
              { icon: Mic,      label: "Mic-powered — just preach naturally" },
              { icon: BookOpen, label: "KJV · NIV · ESV · NLT · NKJV + more" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/40">
                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-amber-400/[0.08] border border-amber-400/15 flex items-center justify-center">
                  <Icon className="w-3 h-3 text-amber-400/70" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          {/* Social proof note */}
          <div className="fu d5 flex items-center gap-4 mt-10 text-[11px] text-white/20">
            <span>Free forever</span>
            <span className="w-px h-3 bg-white/10" />
            <span>Chrome &amp; Edge</span>
            <span className="w-px h-3 bg-white/10" />
            <span>Stays in your browser</span>
          </div>
        </div>

        {/* Right: setup card */}
        <div className="fu d4 w-full max-w-sm flex-shrink-0">
          <div
            className="rounded-2xl border border-white/[0.09] bg-white/[0.03] backdrop-blur-2xl p-8"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 0 40px 120px rgba(0,0,0,0.7)" }}
          >
            <p className="text-[10px] font-bold tracking-[0.35em] uppercase text-white/25 mb-7">
              Set up your church
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Logo upload */}
              {logo ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3">
                  <img src={logo} alt="logo" className="h-9 w-auto rounded object-contain flex-shrink-0" />
                  <span className="flex-1 text-xs text-white/35 truncate">Logo ready</span>
                  <button
                    type="button"
                    onClick={() => { setLogo(""); if (inputRef.current) inputRef.current.value = ""; }}
                    className="text-white/25 hover:text-white/60 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { setDragging(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); e.preventDefault(); }}
                  className={`w-full rounded-xl border border-dashed py-6 flex flex-col items-center gap-2.5 transition-all duration-200 ${
                    dragging
                      ? "border-amber-400/50 bg-amber-400/[0.07]"
                      : "border-white/12 bg-white/[0.02] hover:border-white/22 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                    dragging ? "bg-amber-400/15 border-amber-400/30" : "bg-white/[0.05] border-white/[0.09]"
                  }`}>
                    <Upload className={`w-4 h-4 transition-colors ${dragging ? "text-amber-400" : "text-white/25"}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/30">Upload church logo</p>
                    <p className="text-[10px] text-white/15 mt-0.5">PNG · JPG · SVG · optional</p>
                  </div>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
              />

              {/* Church name */}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Church name *"
                required
                className="w-full rounded-xl border border-white/[0.09] bg-white/[0.035] text-sm text-white placeholder:text-white/22 px-4 py-3.5 focus:outline-none focus:border-amber-400/35 focus:bg-white/[0.06] transition-all"
              />

              {/* Tagline */}
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Tagline (optional)"
                className="w-full rounded-xl border border-white/[0.09] bg-white/[0.035] text-sm text-white placeholder:text-white/22 px-4 py-3.5 focus:outline-none focus:border-amber-400/35 focus:bg-white/[0.06] transition-all"
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={!name.trim() || submitting}
                className="shimmer-btn w-full rounded-xl py-4 text-sm font-bold text-black flex items-center justify-center gap-2 mt-1 disabled:opacity-40 disabled:cursor-not-allowed transition-shadow duration-300 shadow-[0_4px_28px_rgba(245,158,11,0.22)] hover:shadow-[0_4px_44px_rgba(245,158,11,0.38)]"
              >
                {submitting ? (
                  <>
                    <span className="spin-sm w-4 h-4 rounded-full border-2 border-black/25 border-t-black" />
                    Setting up…
                  </>
                ) : (
                  <>
                    Enter WordFlow
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-[10px] text-white/18 mt-5 leading-relaxed">
              No account · No password · Data stays on your device
            </p>
          </div>

          {/* Below-card note */}
          <div className="fu d6 flex items-center justify-center gap-1.5 mt-5 text-[11px] text-white/20">
            <span>Already set up?</span>
            <button
              type="button"
              onClick={() => onEnter({ church_name: "My Church", tagline: "Where Faith Comes Alive", logo_url: "" })}
              className="text-amber-400/50 hover:text-amber-400/80 transition-colors underline underline-offset-2"
            >
              Skip setup
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom feature strip ────────────────────────────────────── */}
      <div className="fu d7 relative z-10 border-t border-white/[0.05] px-8 py-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8">
          {[
            "Detects explicit Bible references",
            "Auto-switches translation on pastor's cue",
            "Cross-tab sync to projector screen",
            "Works entirely offline after first load",
          ].map((f) => (
            <span key={f} className="flex items-center gap-2 text-[11px] text-white/22">
              <span className="w-1 h-1 rounded-full bg-amber-400/40" />
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
