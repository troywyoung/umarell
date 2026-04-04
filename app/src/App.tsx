import { useState, useEffect, useRef } from "react";
import { GoogleLogin } from "@react-oauth/google";
import type { Observation, HardFactItem } from "./types";
import { useObservations } from "./hooks/useObservations";
import { API } from "./config";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("sm_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// ─── Rotating placeholder text ───────────────────────────────────────────

const PLACEHOLDERS = [
  // Dares
  "What hill are you dying on?",
  "Drop your hottest take\u2026",
  "Say something controversial\u2026",
  "What's everyone getting wrong?",
  "Convince me\u2026",
  "What do you believe that nobody agrees with?",
  "Defend the indefensible\u2026",
  "What's obvious to you but invisible to others?",
  // Example theses
  "e.g. AI will replace 50% of white collar jobs by 2030",
  "e.g. Remote work makes teams worse at innovation",
  "e.g. TikTok is the new Google for Gen Z",
  "e.g. The housing market is about to crash",
  "e.g. Most startups would be better off with no VC money",
  "e.g. College degrees will be worthless in 10 years",
  "e.g. China will overtake the US economy by 2035",
  "e.g. Social media is a net negative for society",
];

function getRandomPlaceholder() {
  return PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];
}


// ─── Burst Icon ───────────────────────────────────────────────────────────

function BurstIcon({ size = 20, white = false, className, style }: { size?: number; color?: string; white?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/scribble-transparent.png"
      width={size}
      height={size}
      className={className}
      style={{
        flexShrink: 0,
        mixBlendMode: "screen",
        display: "block",
        filter: white ? "grayscale(1) brightness(8)" : undefined,
        ...style,
      }}
    />
  );
}


// ─── Animated Scribble — rAF driven, runs forever, new path each cycle ───────
function generateScribblePath(): string {
  const r = () => Math.random();
  // Endpoints stay well inside — gives control-point bulge room to breathe
  const clamp = (v: number, lo = 14, hi = 86) => Math.max(lo, Math.min(hi, v));
  const clampCtrl = (v: number) => Math.max(4, Math.min(96, v));
  let x = 34 + r() * 32;
  let y = 34 + r() * 32;
  const segs: string[] = [`M${x.toFixed(1)},${y.toFixed(1)}`];
  const count = 42 + Math.floor(r() * 20); // 42–62 segments — very dense
  for (let i = 0; i < count; i++) {
    const mode = r();
    let tx: number, ty: number;
    if (mode < 0.3) {
      // Dash to edge zone
      const angle = r() * Math.PI * 2;
      const dist = 24 + r() * 36;
      tx = clamp(50 + Math.cos(angle) * dist);
      ty = clamp(50 + Math.sin(angle) * dist);
    } else if (mode < 0.55) {
      // Dart to random interior
      tx = clamp(18 + r() * 64);
      ty = clamp(18 + r() * 64);
    } else if (mode < 0.78) {
      // Reverse — cross back roughly toward opposite side (forces crossings)
      tx = clamp(100 - x + (r() - 0.5) * 28);
      ty = clamp(100 - y + (r() - 0.5) * 28);
    } else {
      // Short local scribble — tight cluster
      tx = clamp(x + (r() - 0.5) * 38);
      ty = clamp(y + (r() - 0.5) * 38);
    }
    // Wild control points — very large spread, random flip direction
    const spread = 130;
    const f1 = r() > 0.5 ? -1 : 1;
    const f2 = r() > 0.5 ? -1 : 1;
    const c1x = clampCtrl(x + f1 * r() * spread);
    const c1y = clampCtrl(y + (r() - 0.5) * spread);
    const c2x = clampCtrl(tx + (r() - 0.5) * spread);
    const c2y = clampCtrl(ty + f2 * r() * spread);
    segs.push(`C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`);
    x = tx; y = ty;
  }
  return segs.join(" ");
}

function AnimatedScribble({ size = 80 }: { size?: number }) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const DURATION = 8000;
    let start: number | null = null;
    let raf: number;
    el.setAttribute("d", generateScribblePath());
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = (now - start) / DURATION;
      if (progress >= 1) {
        // Swap to new path, keep drawing — no fade, no pause
        el.setAttribute("d", generateScribblePath());
        el.style.strokeDashoffset = "1";
        start = now;
      } else {
        el.style.strokeDashoffset = String(1 - progress);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    // viewBox extends 8px beyond the 0–100 coord space on all sides — stroke never clips
    <svg width={size} height={size} viewBox="-8 -8 116 116" style={{ display: "block" }}>
      <path
        ref={pathRef}
        pathLength="1"
        fill="none"
        stroke="#FF00AE"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: "1", strokeDashoffset: "1" } as React.CSSProperties}
        d=""
      />
    </svg>
  );
}

// ─── Steelman Icon (SVG) — geometric wireframe mesh ─────────────────────

// Nodes and edges — organic, asymmetric constellation
const MESH_NODES: [number, number][] = [
  // scattered outer points
  [3, 8],     // 0
  [10, 1],    // 1
  [21, 2],    // 2
  [30, 7],    // 3
  [28, 18],   // 4
  [31, 27],   // 5
  [22, 31],   // 6
  [12, 29],   // 7
  [2, 24],    // 8
  [1, 16],    // 9
  // inner cluster — offset from center
  [8, 11],    // 10
  [17, 7],    // 11
  [24, 12],   // 12
  [20, 20],   // 13
  [13, 22],   // 14
  [7, 18],    // 15
  // core
  [15, 14],   // 16
  [11, 15],   // 17
  // outliers — asymmetric tendrils
  [27, 1],    // 18
  [5, 30],    // 19
  [18, 27],   // 20
];

const MESH_EDGES: [number, number][] = [
  // outer connections (not a neat ring — skip some, cross others)
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0],
  // tendrils
  [2,18],[18,3],[7,19],[19,8],[6,20],[20,14],
  // outer to inner
  [0,10],[1,11],[3,12],[4,13],[5,13],[7,14],[8,15],[9,15],
  // inner mesh — triangulated loosely
  [10,11],[11,12],[12,13],[13,14],[14,15],[15,10],
  [10,16],[11,16],[12,16],[13,16],[14,17],[15,17],[16,17],
  // cross-bracing
  [10,17],[12,4],[14,7],[11,2],[15,9],[13,20],[1,10],
];

function SteelManIcon({ size = 24, animate = false, animateCount, color = "#FFF" }: { size?: number; animate?: boolean; animateCount?: number; color?: string }) {
  const isAnimated = animate || animateCount != null;
  const id = isAnimated ? "sm-anim" : "sm-static";
  const nodeCount = MESH_NODES.length;
  const edgeCount = MESH_EDGES.length;
  // Slow build: edges over ~3s, nodes over ~2.5s, then red highlight travels
  const edgeDelay = (i: number) => (i * (3 / edgeCount)).toFixed(2);
  const nodeDelay = (i: number) => (0.5 + i * (2.5 / nodeCount)).toFixed(2);
  // Red highlight: one node at a time cycles through, 0.3s each
  const highlightDuration = nodeCount * 0.3;
  const redIter = animateCount ?? (animate ? "infinite" : 0);

  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -1 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      {/* Edges */}
      {MESH_EDGES.map(([a, b], i) => {
        const [x1, y1] = MESH_NODES[a];
        const [x2, y2] = MESH_NODES[b];
        return (
          <line
            key={`${id}-e${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={0.7}
            style={isAnimated ? {
              opacity: 0,
              animation: `meshFadeIn 0.8s ease forwards`,
              animationDelay: `${edgeDelay(i)}s`,
            } : undefined}
          />
        );
      })}
      {/* Nodes — black base */}
      {MESH_NODES.map(([cx, cy], i) => (
        <circle
          key={`${id}-n${i}`}
          cx={cx} cy={cy}
          r={1.3}
          fill={color}
          style={isAnimated ? {
            opacity: 0,
            animation: `meshNodePop 0.5s ease forwards`,
            animationDelay: `${nodeDelay(i)}s`,
          } : undefined}
        />
      ))}
      {/* Red highlight nodes — overlay that pulses one at a time */}
      {isAnimated && redIter !== 0 && MESH_NODES.map(([cx, cy], i) => {
        return (
          <circle
            key={`${id}-r${i}`}
            cx={cx} cy={cy}
            r={1.8}
            fill="#FF00AE"
            style={{
              opacity: 0,
              animation: `meshRedPing 0.4s ease ${redIter}`,
              animationDelay: `${(3.5 + i * (highlightDuration / nodeCount)).toFixed(2)}s`,
            }}
          />
        );
      })}
      {isAnimated && (
        <style>{`
          @keyframes meshFadeIn {
            from { opacity: 0; } to { opacity: 0.55; }
          }
          @keyframes meshNodePop {
            from { opacity: 0; } to { opacity: 1; }
          }
          @keyframes meshRedPing {
            0% { opacity: 0; r: 1.3; }
            30% { opacity: 0.9; r: 2.2; }
            100% { opacity: 0; r: 1.3; }
          }
        `}</style>
      )}
    </svg>
  );
}

// ─── Evidence type badge ──────────────────────────────────────────────────

const EVIDENCE_COLORS: Record<string, { bg: string; color: string }> = {
  Empirical:     { bg: "#E8F5E9", color: "#2E7D32" },
  Observational: { bg: "#E3F2FD", color: "#1565C0" },
  Anecdotal:     { bg: "#FFF8E1", color: "#E65100" },
  Speculative:   { bg: "#F3E5F5", color: "#6A1B9A" },
};

function EvidenceBadge({ value, size = "sm" }: { value?: string; size?: "sm" | "lg" }) {
  if (!value) return null;
  const c = EVIDENCE_COLORS[value] || { bg: "#F0F0ED", color: "#666" };
  return (
    <span style={{
      display: "inline-block",
      background: c.bg, color: c.color,
      fontSize: size === "lg" ? 11 : 8, fontWeight: size === "lg" ? 700 : 600,
      padding: size === "lg" ? "3px 9px" : "1px 6px", borderRadius: 100, letterSpacing: 0.3,
    }}>
      {value}
    </span>
  );
}

const SCORE_ROWS = [
  { range: "95–100", label: "Undeniable",     color: "#FF2FA3", desc: "Factually established. No credible counter." },
  { range: "80–94",  label: "Holds Water",    color: "#4CAF50", desc: "Strong case, evidence clearly supports it." },
  { range: "60–79",  label: "Fighting Words", color: "#E8813A", desc: "Reasonable argument, genuinely contestable." },
  { range: "41–59",  label: "Jury\u2019s Out",color: "#E7B84B", desc: "Could go either way — needs more evidence." },
  { range: "21–40",  label: "Weak Signal",    color: "#3D5A9E", desc: "Thin support, vague or poorly evidenced." },
  { range: "0–20",   label: "Unpersuasive",   color: "#5A6B8C", desc: "Goes against available evidence or incoherent." },
];

function ScoreInfoRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {SCORE_ROWS.map(({ range, label, color, desc }) => (
        <div key={range} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color, width: 52, flexShrink: 0 }}>{range}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}> — {desc}</span>
        </div>
      ))}
    </div>
  );
}

// Mobile: slides up from bottom
function ScoreInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 999,
        background: "#1C1C1C", borderRadius: "18px 18px 0 0",
        padding: "20px 20px 40px",
        border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#FF00AE", letterSpacing: 1, textTransform: "uppercase" }}>Take Strength Score</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", padding: "0 0 0 12px", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, margin: "0 0 16px" }}>
          A conviction score. Verifiable facts score near 100. Demonstrably false claims score near 0. Opinions land in the middle based on how well-evidenced and defensible the argument is.
        </p>
        <ScoreInfoRows />
      </div>
    </>
  );
}

// Desktop: anchored popover card below the trigger
function ScoreInfoPopover({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 98, background: "transparent" }} />
      <div style={{
        position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 99,
        background: "#1C1C1C", borderRadius: 14,
        padding: "16px 18px 18px",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        width: 310, minWidth: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#FF00AE", letterSpacing: 1, textTransform: "uppercase" }}>Take Strength Score</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 18, cursor: "pointer", padding: "0 0 0 12px", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: "0 0 14px" }}>
          A conviction score. Verifiable facts score near 100. Demonstrably false claims score near 0. Opinions land in the middle based on how well-evidenced and defensible the argument is.
        </p>
        <ScoreInfoRows />
      </div>
    </>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

function getScoreColor(v: number): string {
  if (v <= 20) return "#5A6B8C";
  if (v <= 40) return "#3D5A9E";
  if (v <= 59) return "#E7B84B";
  if (v <= 79) return "#E8813A";
  if (v <= 94) return "#4CAF50";
  return "#FF2FA3";
}

function getScoreTier(v: number): { label: string } {
  if (v <= 20) return { label: "Unpersuasive" };
  if (v <= 40) return { label: "Weak Signal" };
  if (v <= 59) return { label: "Jury\u2019s Out" };
  if (v <= 79) return { label: "Fighting Words" };
  if (v <= 94) return { label: "Holds Water" };
  return { label: "Undeniable" };
}

function ScoreBadge({ value, size = "md", dark = false, animate = false }: { value?: number; size?: "sm" | "md" | "lg"; dark?: boolean; animate?: boolean }) {
  if (value == null) return null;
  const target = Math.round(value);
  const accent = getScoreColor(target);
  const dim = size === "sm" ? 40 : size === "lg" ? 48 : 32;
  const fontSize = size === "sm" ? 14 : size === "lg" ? 17 : 11;
  const r = (dim - 4) / 2;
  const circ = 2 * Math.PI * r;

  // Animation state
  const [displayVal, setDisplayVal] = useState(animate ? 0 : target);
  const [animPct, setAnimPct] = useState(animate ? 0 : target / 100);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) { setDisplayVal(target); setAnimPct(target / 100); return; }
    setDisplayVal(0); setAnimPct(0);
    startRef.current = null;
    const duration = 1440;
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(Math.round(eased * target));
      setAnimPct(eased * target / 100);
      if (progress < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [animate, target]);

  const currentColor = animate ? getScoreColor(displayVal) : accent;
  const pct = animate ? animPct : target / 100;

  return (
    <div style={{ position: "relative", width: dim, height: dim, flexShrink: 0 }}>
      <svg width={dim} height={dim} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"} strokeWidth={4.4} />
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={currentColor} strokeWidth={4.4}
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize, fontWeight: 800, color: dark ? "#1A1A1A" : "#FFF", lineHeight: 1, letterSpacing: -0.5 }}>{displayVal}</span>
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  // Ensure UTC parsing — append Z if no timezone offset present
  const normalized = /[Z+\-]\d*$/.test(iso.trim()) ? iso : iso + "Z";
  const diff = Date.now() - new Date(normalized).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const date = new Date(normalized);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(!sameYear && { year: "numeric" }) });
}


// ─── About ────────────────────────────────────────────────────────────────

function AboutView({ onBack }: { onBack: () => void }) {
  const bullet = (text: string) => (
    <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
      <span style={{ color: "#FF00AE", fontSize: 16, lineHeight: 1.5, flexShrink: 0 }}>—</span>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#12102B", padding: "0 0 60px" }}>
      <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#FFF", letterSpacing: -0.4 }}>Everyone has a take. This is a place to share yours.</span>
      </div>
      <div style={{ padding: "28px 24px 0" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#FF00AE", letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 20px" }}>How it works</p>
        {bullet("Hit 'what's yours?' and drop anything — a URL, a hot take, a half-formed idea. The AI steelmans it: sharpest thesis, best evidence, most defensible form.")}
        {bullet("Every take gets a conviction score from 0–100. Verifiably true → near 100. Demonstrably false → near 0. Opinions land in the middle based on how well they hold up.")}
        {bullet("Disagree? Challenge it. Submit your counter-argument and the AI steelmans that too. The feed becomes a live debate board.")}
        {bullet("Each week, takes from the latest People vs Algorithms episode drop into the feed — ready to read, challenge, or riff on.")}
        {bullet("Hit 'PvA Take' on any post to get a reaction in the voice of the show. Opinionated, connected to bigger patterns, not neutral.")}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#FF00AE", letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 20px" }}>Why it's interesting</p>
          {bullet("Most people argue against the weakest version of ideas they disagree with. This forces the opposite — understand the best case before you push back.")}
          {bullet("The conviction score keeps you honest. A bold take with weak evidence gets called out. A modest take with strong evidence gets its due.")}
          {bullet("It's a thinking tool, not a content feed. The goal is to make you a sharper reader of whatever you're already paying attention to.")}
        </div>
      </div>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────

function HomeView({ observations, loading, onCapture, onSelect, authUser, onSignOut, onAbout }: {
  observations: Observation[];
  loading: boolean;
  onCapture: () => void;
  onSelect: (o: Observation) => void;
  authUser: AuthUser;
  onSignOut: () => void;
  onAbout: () => void;
}) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 120, minHeight: "100vh", position: "relative", background: "#12102B" }}>

      {/* Top bar: what is it? left, avatar right */}
      <div style={{ position: "absolute", top: 13, left: 20, right: 20, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
        <button onClick={onAbout} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <span style={{ fontSize: window.innerWidth < 600 ? 11 : 9, fontWeight: 800, color: "#FFF", fontFamily: "inherit", textDecoration: "underline", textDecorationColor: "#FFF" }}>what is it?</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {loading && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Refreshing…</span>}
          {authUser.avatar
            ? <img src={authUser.avatar} onClick={onSignOut} title={`Signed in as ${authUser.name} — tap to sign out`} style={{ width: 30, height: 30, borderRadius: "50%", cursor: "pointer", border: "2px solid rgba(255,255,255,0.4)" }} />
            : <button onClick={onSignOut} style={{ fontSize: 11, color: "#FF00AE", background: "none", border: "1px solid rgba(255,0,174,0.35)", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", padding: "4px 10px", letterSpacing: -0.2 }}>Sign in</button>
          }
        </div>
      </div>

      {/* Scribble cropped 20% at top, logo flush below */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BurstIcon size={100} style={{ marginTop: 5 }} />
        <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: -1.5, color: "#FFF", marginTop: -14, fontFamily: "'Besley', serif" }}>
          <span style={{ color: "#FF00AE" }}>hot</span>take
        </span>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .topic-pills::-webkit-scrollbar { display: none; }
      `}</style>

<div style={{ padding: "6px 16px 0", position: "relative", zIndex: 1 }}>
        {observations.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "48px 24px 0" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#FFF", letterSpacing: -0.5, margin: "0 0 10px" }}>Drop your first take.</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: "0 0 28px" }}>Paste a URL, share a claim, or describe an idea. We'll build the strongest case for it.</p>
            <button onClick={onCapture} style={{ background: "#FF00AE", color: "#fff", border: "none", borderRadius: 100, padding: "14px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: -0.3, WebkitTapHighlightColor: "transparent" }}>＋ Drop a hot take</button>
          </div>
        )}
        {observations.length === 0 && !loading ? null : (() => {
          const topLevel = [...observations]
            .filter(o => !o.parent_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const challengeMap = new Map<string, Observation[]>();
          observations.filter(o => !!o.parent_id).forEach(c => {
            const arr = challengeMap.get(c.parent_id!) || [];
            arr.push(c);
            challengeMap.set(c.parent_id!, arr);
          });

          // Build topic pills from raw tags — top 8 by frequency
          const tagCounts = new Map<string, number>();
          topLevel.forEach(o => {
            (o.tags || []).forEach((tag: string) => {
              if (tag && tag.trim()) tagCounts.set(tag.trim(), (tagCounts.get(tag.trim()) || 0) + 1);
            });
          });
          const availableTopics = [...tagCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([tag]) => tag);

          // All posts in chronological order — episode posts dispersed in feed, not pinned
          const filteredPosts = !selectedTopic || selectedTopic === "__all__"
            ? topLevel
            : selectedTopic === "PvA"
              ? topLevel.filter(o => !!o.episode_tag)
              : topLevel.filter(o => (o.tags || []).includes(selectedTopic));

          const renderCard = (obs: Observation) => {
            let firstBullet = "";
            try {
              const parsed = JSON.parse(obs.summary || "");
              firstBullet = parsed.bottom_line || (Array.isArray(parsed.bullets) ? parsed.bullets[0] : "") || "";
            } catch {
              const lines = (obs.summary || "").split(/\n+/).map((l: string) => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);
              firstBullet = lines[0] || "";
            }
            return (
              <div
                key={obs.id}
                onClick={() => onSelect(obs)}
                style={{
                  borderRadius: 10, position: "relative",
                  background: obs.episode_tag ? "#F5F0E8" : "#FFF",
                  border: "none",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  cursor: "pointer", overflow: "hidden",
                }}
              >
                {obs.episode_tag && (
                  <p style={{ fontSize: 8, fontWeight: 700, color: "#FF00AE", margin: 0, padding: "7px 12px 0", letterSpacing: 0.8, textTransform: "uppercase", lineHeight: 1 }}>{obs.episode_title || "PvA"}</p>
                )}
                {obs.user_name && !obs.episode_tag && (
                  <p style={{ fontSize: 9, fontWeight: 600, color: "#999", margin: 0, padding: "8px 12px 0", letterSpacing: -0.2, lineHeight: 1 }}>{obs.user_name}</p>
                )}
                {/* Score — top right corner */}
                <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1 }}>
                  <ScoreBadge value={obs.score} size="sm" dark />
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: (obs.user_name || obs.episode_tag) ? "4px 12px 6px 12px" : "10px 12px 6px 12px", paddingRight: 60 }}>
                  {obs.image_data && (
                    <img
                      src={`data:${obs.image_media_type || "image/jpeg"};base64,${obs.image_data}`}
                      style={{ width: 65, height: 65, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                    />
                  )}
                  <p style={{
                    fontSize: window.innerWidth < 600 ? 15 : 12, fontWeight: 700,
                    color: "#1A1A1A", lineHeight: 1.4, margin: 0, letterSpacing: -0.3, flex: 1,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
                  }}>
                    {obs.thesis || obs.raw_input}
                  </p>
                </div>
                {firstBullet && (
                  <p style={{
                    fontSize: 10, color: "#555", lineHeight: 1.55,
                    margin: 0, padding: "0 12px 10px 12px",
                  }}>
                    {firstBullet}
                  </p>
                )}
                {(obs.status === "formatting" || obs.status === "researching") && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px 8px" }}>
                    <SteelManIcon size={14} animate />
                    <span style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>
                      {obs.status === "formatting" ? "Formatting\u2026" : "Researching\u2026"}
                    </span>
                  </div>
                )}
                <div style={{
                  display: "flex", alignItems: "center",
                  padding: "6px 12px 10px",
                  borderTop: "1px solid #F5F5F2",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", alignContent: "flex-start", gap: 5, flexWrap: "wrap", flex: 1 }}>
                    <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.7)", letterSpacing: 0.2 }}>{timeAgo(obs.created_at)}</span>
                    <EvidenceBadge value={obs.evidence_type} />
                    {obs.tags?.map((tag: string) => (
                      <span key={tag} style={{ fontSize: 8, color: "#888", background: "#F0F0ED", borderRadius: 100, padding: "1px 6px" }}>{tag}</span>
                    ))}
                  </div>
                  {obs.status === "complete" && obs.thesis && (
                    <ShareButton obsId={obs.id} onClick={(e) => e.stopPropagation()} />
                  )}
                </div>
              </div>
            );
          };

          const renderChallenge = (c: Observation) => (
            <div
              key={c.id}
              onClick={() => onSelect(c)}
              style={{
                borderRadius: 10, background: "#EEF4FF",
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                padding: "10px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <p style={{ fontSize: 11, color: "#1A1A1A", fontWeight: 600, margin: 0, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", flex: 1 } as React.CSSProperties}>
                <span style={{ fontWeight: 800, color: "#2C5ABA" }}>Challenge: </span>{c.thesis || c.raw_input}
              </p>
            </div>
          );

          const renderPost = (obs: Observation) => {
            const children = (challengeMap.get(obs.id) || [])
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return (
              <div key={obs.id} style={{ marginBottom: 10 }}>
                {renderCard(obs)}
                {children.map(c => (
                  <div key={c.id} style={{ marginTop: 4 }}>{renderChallenge(c)}</div>
                ))}
              </div>
            );
          };

          return (
            <>
              {/* Topic pills */}
              <div
                  className="topic-pills"
                  style={{
                    display: "flex", gap: 8, overflowX: "auto",
                    padding: "14px 0 10px",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  } as React.CSSProperties}
                >
                  {/* All pill */}
                  <button
                    onClick={() => setSelectedTopic(selectedTopic === "__all__" ? null : "__all__")}
                    style={{
                      flexShrink: 0,
                      background: selectedTopic === "__all__" ? "rgba(255,255,255,0.15)" : "transparent",
                      border: selectedTopic === "__all__" ? "1.5px solid rgba(255,255,255,0.6)" : "1.5px solid rgba(255,255,255,0.2)",
                      borderRadius: 6, padding: "4px 11px",
                      fontSize: 11, fontWeight: 700,
                      color: selectedTopic === "__all__" ? "#FFF" : "rgba(255,255,255,0.55)",
                      cursor: "pointer", WebkitTapHighlightColor: "transparent",
                      fontFamily: "inherit",
                    }}
                  >
                    Recent
                  </button>

                  {/* PvA pill — always visible */}
                  <button
                    onClick={() => setSelectedTopic(selectedTopic === "PvA" ? null : "PvA")}
                    style={{
                      flexShrink: 0,
                      background: selectedTopic === "PvA" ? "#FF00AE" : "rgba(255,0,174,0.15)",
                      border: selectedTopic === "PvA" ? "1.5px solid #FF00AE" : "1.5px solid rgba(255,0,174,0.4)",
                      borderRadius: 6, padding: "4px 11px",
                      fontSize: 11, fontWeight: 700,
                      color: selectedTopic === "PvA" ? "#FFF" : "#FF00AE",
                      cursor: "pointer", WebkitTapHighlightColor: "transparent",
                      fontFamily: "inherit",
                    }}
                  >
                    PvA
                  </button>
                  {availableTopics.map(topic => (
                    <button
                      key={topic}
                      onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
                      style={{
                        flexShrink: 0,
                        background: selectedTopic === topic ? "rgba(255,255,255,0.15)" : "transparent",
                        border: selectedTopic === topic ? "1.5px solid rgba(255,255,255,0.6)" : "1.5px solid rgba(255,255,255,0.2)",
                        borderRadius: 6, padding: "4px 11px",
                        fontSize: 11, fontWeight: 700,
                        color: selectedTopic === topic ? "#FFF" : "rgba(255,255,255,0.55)",
                        cursor: "pointer", WebkitTapHighlightColor: "transparent",
                        fontFamily: "inherit",
                      }}
                    >
                      {topic}
                    </button>
                  ))}
              </div>

              {/* Unified chronological feed — episode posts dispersed in order */}
              {filteredPosts.length > 0
                ? <div style={{ paddingTop: 4 }}>{filteredPosts.map(renderPost)}</div>
                : selectedTopic && (
                  <div style={{ textAlign: "center", padding: "48px 24px 0" }}>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                      {selectedTopic === "PvA" ? "No PvA episodes yet." : `No takes tagged "${selectedTopic}" yet.`}
                    </p>
                  </div>
                )
              }
            </>
          );
        })()}
      </div>

      {/* Idea Button */}
      <button
        onClick={onCapture}
        className="pva-fab"
        style={{
          position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)",
          width: 68, height: 68, borderRadius: "50%",
          background: "#FF00AE", border: "none", outline: "4px solid rgba(255,0,174,0.5)", outlineOffset: 0, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 12px rgba(229,57,53,0.4)", zIndex: 2,
          WebkitTapHighlightColor: "transparent",
          animation: "fabPulse 2s ease-in-out infinite",
          flexDirection: "column", gap: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", letterSpacing: -0.5, lineHeight: 1.15, fontFamily: "inherit" }}>what's</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", letterSpacing: -0.5, lineHeight: 1.15, fontFamily: "inherit" }}>yours?</span>
        <style>{`
          @keyframes fabPulse {
            0%, 100% { transform: translateX(-50%) scale(1); }
            50% { transform: translateX(-50%) scale(1.08); }
          }
        `}</style>
      </button>
    </div>
  );
}

// ─── Capture ──────────────────────────────────────────────────────────────

function CaptureView({ onSubmit, onSubmitImage, onBack, parentObs }: {
  onSubmit: (text: string) => Promise<void>;
  onSubmitImage: (b64: string, mediaType: string, context?: string) => Promise<void>;
  onBack: () => void;
  parentObs?: Observation | null;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ b64: string; mediaType: string } | null>(null);
  const [placeholder] = useState(() => getRandomPlaceholder());
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listeningRef = useRef(false);

  // Auto-resize textarea to fit content
  const autoResize = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const startRec = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript);
      setText(parts.join(" ").trim());
      setTimeout(autoResize, 0);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed") setError("Mic not available \u2014 type your take below.");
      listeningRef.current = false;
      setListening(false);
    };
    rec.onend = () => {
      if (listeningRef.current) {
        try { rec.start(); } catch { listeningRef.current = false; setListening(false); }
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch { setError("Could not start microphone."); return; }
  };

  const toggleVoice = () => {
    if (listening) {
      listeningRef.current = false;
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Voice not available \u2014 type your take below."); return; }
    listeningRef.current = true;
    setListening(true);
    setError("");
    startRec();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const resized = canvas.toDataURL("image/jpeg", 0.85);
        setImagePreview(resized);
        setImageMeta({ b64: resized.split(",")[1], mediaType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      if (imageMeta) {
        await onSubmitImage(imageMeta.b64, imageMeta.mediaType, text.trim() || undefined);
      } else if (url.trim() && text.trim()) {
        // Both URL and text — combine so the AI gets full context
        await onSubmit(`URL: ${url.trim()}\n\n${text.trim()}`);
      } else if (url.trim()) {
        await onSubmit(url.trim());
      } else if (text.trim()) {
        await onSubmit(text.trim());
      }
    } catch (e: any) {
      setError(e?.message || "Failed to connect to API.");
      setSubmitting(false);
    }
  };

  const canSubmit = (!!imageMeta || !!text.trim() || !!url.trim()) && !submitting;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#12102B" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          Cancel
        </button>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#FFF", letterSpacing: -0.5, margin: "0 0 6px" }}>
        {parentObs ? "What's your counter?" : "Let it rip."}
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 24px", lineHeight: 1.5 }}>
        {parentObs ? "Drop your counter-argument. We'll sharpen it." : "Drop a hot take. We'll build the strongest case for it."}
      </p>
      {parentObs && (
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 6px" }}>ORIGINAL HOT TAKE</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#FFF", margin: "0 0 8px", lineHeight: 1.4 }}>{parentObs.thesis || parentObs.raw_input}</p>
          {parentObs.summary && (
            <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.5, maxHeight: 120, overflow: "auto" }}>
              {parentObs.summary}
            </p>
          )}
        </div>
      )}

      {/* Single text input — always visible, auto-expands */}
      <div style={{
        background: "#FFF", borderRadius: 16, padding: "14px 16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12,
        border: listening ? "1.5px solid #6666CC" : "1.5px solid transparent",
        transition: "border-color 0.2s",
      }}>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          placeholder={listening ? "Listening\u2026" : placeholder}
          rows={3}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          style={{
            width: "100%", border: "none", outline: "none",
            fontSize: 16, color: "#1A1A1A", lineHeight: 1.6,
            resize: "none", fontFamily: "inherit", boxSizing: "border-box",
            overflow: "hidden", minHeight: 72,
          }}
        />
        {listening && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <ProcessingDots />
            <span style={{ fontSize: 12, color: "#6666CC", fontWeight: 600 }}>Listening…</span>
          </div>
        )}
      </div>

      {/* URL input */}
      {(() => {
        const isXUrl = /^https?:\/\/(www\.)?(x\.com|twitter\.com)/.test(url.trim());
        return (
          <>
            <div style={{
              background: "#FFF", borderRadius: 12, padding: "10px 14px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: isXUrl ? 6 : 12,
              display: "flex", alignItems: "center", gap: 8,
              border: isXUrl ? "1.5px solid #FFD700" : url.trim() ? "1.5px solid #FF00AE" : "1.5px solid transparent",
              transition: "border-color 0.2s",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, opacity: 0.5 }}>{"\uD83D\uDD17"}</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Add a link (optional)"
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: 16, color: "#1A1A1A", fontFamily: "inherit",
                  background: "transparent",
                }}
              />
              {url.trim() && (
                <button onClick={() => setUrl("")} style={{ background: "none", border: "none", color: "#CCC", fontSize: 16, cursor: "pointer", padding: 0 }}>&times;</button>
              )}
            </div>
            {isXUrl && (
              <p style={{ fontSize: 12, color: "#FFD700", margin: "0 0 12px 4px", lineHeight: 1.4 }}>
                X posts can't be fetched automatically — paste the tweet text in the field above instead.
              </p>
            )}
          </>
        );
      })()}

      {/* Image preview */}
      {imagePreview && (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <img src={imagePreview} alt="Preview" style={{ width: "100%", borderRadius: 16, maxHeight: 200, objectFit: "cover" }} />
          <button
            onClick={() => { setImagePreview(null); setImageMeta(null); if (fileRef.current) fileRef.current.value = ""; }}
            style={{
              position: "absolute", top: 10, right: 10,
              background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
              width: 30, height: 30, color: "#fff", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >&times;</button>
        </div>
      )}

      {/* Action buttons row: mic + screenshot */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <button
          onClick={toggleVoice}
          style={{
            flex: 1, padding: "14px 0", borderRadius: 14, border: "none", cursor: "pointer",
            background: listening ? "#FFF" : "rgba(255,255,255,0.08)",
            color: listening ? "#12102B" : "rgba(255,255,255,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{ fontSize: 18 }}>{listening ? "\u23F9" : "\uD83C\uDFA4"}</span>
          {listening ? "Stop" : "Speak"}
        </button>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            flex: 1, padding: "14px 0", borderRadius: 14, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{ fontSize: 18 }}>🖼️</span>
          Screenshot
        </button>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", margin: "0 0 14px", letterSpacing: 0.1 }}>
        Screenshot a headline, tweet, chart, or stat
      </p>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: "100%",
          background: canSubmit ? "#FF00AE" : "rgba(255,255,255,0.15)",
          color: "#FFF", border: "none", borderRadius: 14,
          padding: "16px 0", fontSize: 16, fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed",
          letterSpacing: -0.2, fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {submitting ? "Submitting\u2026" : canSubmit ? "Sharpen this \u2192" : "Type your take above"}
      </button>

      {error && (
        <div style={{ marginTop: 12, background: "#FFF0EE", borderRadius: 10, padding: "12px 14px", border: "1px solid #F5C6C0" }}>
          <p style={{ fontSize: 13, color: "#FF00AE", margin: 0, lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Output ───────────────────────────────────────────────────────────────

function OutputView({ obs: initialObs, onBack, onDelete, onResubmit, onChallenge, pollObservation, requestCounterpoint, requestPvaTake, authUserId, isAdmin }: {
  obs: Observation;
  onBack: () => void;
  onDelete: (id: string) => Promise<void>;
  onResubmit: (obsId: string, text: string, imageData?: string, imageMediaType?: string) => Promise<void>;
  onChallenge: (obs: Observation) => void;
  pollObservation: (id: string) => Promise<Observation | null>;
  requestCounterpoint: (id: string) => Promise<import("./types").Counterpoint | null>;
  requestPvaTake: (id: string, voice?: string) => Promise<import("./types").PvaTake | null>;
  authUserId?: string;
  isAdmin?: boolean;
}) {
  const [obs, setObs] = useState(initialObs);
  const [counterpointLoading, setCounterpointLoading] = useState(false);
  const [counterpointError, setCounterpointError] = useState(false);
  const [pvaLoading, setPvaLoading] = useState(false);
  const [pvaError, setPvaError] = useState(false);
  const [activeTab, setActiveTab] = useState<"hottake" | "coldshower" | "pva">("hottake");
  const [, setFlashCounterpoint] = useState(false);
  const [flashPva, setFlashPva] = useState(false);
  const steelmanRef = useRef<HTMLDivElement>(null);
  const counterpointRef = useRef<HTMLDivElement>(null);
  const pvaRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [challenges, setChallenges] = useState<Observation[]>([]);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const isMobile = useIsMobile();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveNullsRef = useRef(0);

  useEffect(() => {
    setObs(initialObs);
    setEditMode(false);
    setCounterpointLoading(false);
    setCounterpointError(false);
    setPvaLoading(false);
    setPvaError(false);
    setActiveTab("hottake");
    // Fetch challenges
    fetch(`${API}/observations/${initialObs.id}/challenges`, { headers: authHeaders() })
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setChallenges(data); }).catch(() => {});
  }, [initialObs.id]);

  useEffect(() => {
    if (obs.status === "complete" || obs.status === "error") return;
    consecutiveNullsRef.current = 0;
    pollRef.current = setInterval(async () => {
      const updated = await pollObservation(obs.id);
      if (updated) {
        consecutiveNullsRef.current = 0;
        setObs(updated);
        if (updated.status === "complete" || updated.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } else {
        consecutiveNullsRef.current += 1;
        // Only go back after 3 consecutive nulls (7.5s) — guards against transient errors
        if (consecutiveNullsRef.current >= 3) {
          if (pollRef.current) clearInterval(pollRef.current);
          onBack();
        }
      }
    }, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [obs.id, obs.status]);

  const scrollToAndFlash = (ref: React.RefObject<HTMLDivElement | null>, setFlash: (v: boolean) => void) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFlash(true);
      setTimeout(() => setFlash(false), 3000);
    }, 80);
  };

  const handleCounterpoint = async () => {
    if (obs.stress_test && "strength" in obs.stress_test) {
      scrollToAndFlash(counterpointRef, setFlashCounterpoint);
      return;
    }
    setCounterpointError(false);
    setCounterpointLoading(true);
    const result = await requestCounterpoint(obs.id);
    setCounterpointLoading(false);
    if (result) {
      const updated = await pollObservation(obs.id);
      if (updated) setObs(updated);
      else setObs((p) => ({ ...p, stress_test: result }));
      scrollToAndFlash(counterpointRef, setFlashCounterpoint);
    } else {
      setCounterpointError(true);
    }
  };

  const handlePvaTake = async () => {
    if (obs.pva_take) {
      scrollToAndFlash(pvaRef, setFlashPva);
      return;
    }
    setPvaError(false);
    setPvaLoading(true);
    const result = await requestPvaTake(obs.id);
    setPvaLoading(false);
    if (result) {
      setObs((p) => ({ ...p, pva_take: result }));
      scrollToAndFlash(pvaRef, setFlashPva);
    } else {
      setPvaError(true);
    }
  };

  const handleResubmit = async () => {
    if (!editText.trim() || resubmitting) return;
    setResubmitting(true);
    try {
      await onResubmit(obs.id, editText.trim(), obs.image_data, obs.image_media_type);
    } catch {
      setResubmitting(false);
    }
  };

  const isProcessing = obs.status === "formatting" || obs.status === "researching" || resubmitting;
  const isImage = obs.input_type === "screenshot" || obs.input_type === "photo";
  const isOwner = (obs.user_id && obs.user_id === authUserId) || !!isAdmin;

  // Parse summary — handles new JSON format {bottom_line, hard_facts, bullets} and legacy plain text
  let steelBottomLine = "";
  let steelHardFacts: string[] = [];
  let steelBullets: string[] = [];
  try {
    const parsed = JSON.parse(obs.summary || "");
    steelBottomLine = parsed.bottom_line || "";
    steelHardFacts = Array.isArray(parsed.hard_facts) ? parsed.hard_facts : [];
    steelBullets = Array.isArray(parsed.bullets) ? parsed.bullets : [];
  } catch {
    steelBullets = (obs.summary || "").split(/\n+/).map(l => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);
    steelBottomLine = steelBullets.shift() || "";
  }

  // Parse counterpoint from stress_test field
  const counterpoint = obs.stress_test && "strength" in obs.stress_test ? obs.stress_test as import("./types").Counterpoint : null;

  if (obs.status === "error") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px", background: "#12102B", minHeight: "100vh" }}>
        <div style={{ padding: "14px 0" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>&lsaquo; Back</button>
        </div>
        <div style={{ marginTop: 60, textAlign: "center" }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>{"\u26A0\uFE0F"}</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#FFF", margin: "0 0 8px" }}>Analysis failed</p>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, margin: "0 0 28px" }}>
            {obs.error_detail?.includes("PAYWALL")
              ? "This article is paywalled. Paste the text directly instead."
              : obs.error_detail?.includes("529") || obs.error_detail?.includes("overloaded")
              ? "API is temporarily overloaded. Try again in a moment."
              : obs.error_detail?.includes("401") || obs.error_detail?.includes("auth")
              ? "Check that the API key is set correctly."
              : obs.error_detail || "Something went wrong. Try again."}
          </p>
          <button onClick={onBack} style={{ background: "#FFF", color: "#12102B", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>
      </div>
    );
  }

  // Share handled by ShareButton component

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80, background: "#12102B", minHeight: "100vh" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>&lsaquo; Back</button>
          {obs.status === "complete" && obs.thesis && (
            <>
              <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }} />
              <ShareButton obsId={obs.id} />
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {obs.user_name && <span style={{ fontSize: 12, fontWeight: 600, color: "#AAA" }}>{obs.user_name}</span>}
          {isOwner && (
            deleteConfirm ? (
              <>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{ background: "none", border: "none", fontSize: 12, color: "#666", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >cancel</button>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    await onDelete(obs.id);
                    onBack();
                  }}
                  disabled={deleting}
                  style={{ background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "#FF00AE", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >{deleting ? "deleting…" : "delete"}</button>
              </>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, opacity: 0.35, WebkitTapHighlightColor: "transparent" }}
                title="Delete"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
            )
          )}
        </div>
      </div>

      <div style={{ padding: "24px 20px 0" }}>

        {/* Uploaded image (shown at top when available) */}
        {obs.image_data && (
          <div style={{ marginBottom: 16 }}>
            <img
              src={`data:${obs.image_media_type || "image/jpeg"};base64,${obs.image_data}`}
              alt="Uploaded"
              style={{ width: "100%", aspectRatio: "1", borderRadius: 14, objectFit: "cover" }}
            />
          </div>
        )}

        {/* While processing: show full original input + step progress */}
        {isProcessing && (
          <>
            {/* Original observation */}
            {!isImage && obs.raw_input && obs.raw_input !== "image" && (
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, width: "100%", boxSizing: "border-box", overflow: "hidden" }}>
                {obs.input_type === "url" ? (() => {
                  let domain = obs.raw_input;
                  try { domain = new URL(obs.raw_input).hostname.replace(/^www\./, ""); } catch {}
                  return (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 8px" }}>Source</p>
                      <a href={obs.raw_input} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#FF00AE", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{domain}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>↗</span>
                      </a>
                    </>
                  );
                })() : (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> Your observation</p>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.65, margin: 0 }}>{obs.raw_input}</p>
                  </>
                )}
              </div>
            )}

            {/* Step progress — scribble draws itself */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "30px 0 28px" }}>
              <AnimatedScribble size={52} />
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#FFF", margin: "0 0 4px" }}>
                  {resubmitting ? "Resubmitting\u2026" : obs.status === "formatting" ? "Reading your take\u2026" : "Building the case\u2026"}
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>This usually takes a few seconds</p>
              </div>
            </div>
          </>
        )}

        {/* Source URL — shown at top when post came from a URL */}
        {obs.status === "complete" && obs.input_type === "url" && obs.raw_input && (() => {
          let domain = obs.raw_input;
          try { domain = new URL(obs.raw_input).hostname.replace(/^www\./, ""); } catch {}
          return (
            <a href={obs.raw_input} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 16 }}>
              <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} width={14} height={14} style={{ borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#FF00AE", fontWeight: 600 }}>{domain}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>↗</span>
            </a>
          );
        })()}

        {/* Score row + Devil's Advocate button */}
        {obs.status === "complete" && obs.score != null && (() => {
          const v = Math.round(obs.score);
          const tier = getScoreTier(v);
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                <ScoreBadge value={obs.score} size="lg" animate />
                <span style={{ fontSize: 16, fontWeight: 800, color: getScoreColor(v), letterSpacing: -0.3 }}>
                  {tier.label}
                </span>
                <button
                  onClick={() => setShowScoreInfo(sv => !sv)}
                  style={{
                    background: showScoreInfo ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "50%", width: 18, height: 18,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                    color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 800,
                    flexShrink: 0, lineHeight: 1,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >?</button>
                {showScoreInfo && (isMobile ? <ScoreInfoSheet onClose={() => setShowScoreInfo(false)} /> : <ScoreInfoPopover onClose={() => setShowScoreInfo(false)} />)}
              </div>
              <button
                onClick={() => { setActiveTab("coldshower"); handleCounterpoint(); }}
                style={{
                  background: "transparent", border: "1.5px solid #FF00AE",
                  borderRadius: 10, padding: "8px 14px",
                  cursor: "pointer", fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,174,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FF00AE", letterSpacing: -0.2, display: "inline-flex", alignItems: "center", gap: 5 }}>Devil&rsquo;s Advocate <span style={{ fontSize: 12, lineHeight: 1 }}>&rsaquo;</span></span>
              </button>
            </div>
          );
        })()}

        {/* Thesis — no label */}
        {obs.status === "complete" && obs.thesis && obs.thesis !== "image" && (
          <div style={{ marginBottom: 16 }}>
            {editMode ? (
              <div>
                <textarea
                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                  value={editText}
                  onChange={(e) => { setEditText(e.target.value); const t = e.target; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                  autoFocus
                  style={{
                    width: "100%", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 12,
                    padding: "12px 14px", fontSize: 20, color: "#1A1A1A", fontWeight: 700,
                    lineHeight: 1.4, resize: "none", fontFamily: "inherit",
                    boxSizing: "border-box", outline: "none", letterSpacing: -0.4,
                    overflow: "hidden",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => setEditMode(false)}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 10,
                      border: "1.5px solid rgba(255,255,255,0.15)", background: "transparent",
                      color: "#888", fontSize: 14, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >Cancel</button>
                  <button
                    onClick={handleResubmit}
                    disabled={!editText.trim() || resubmitting}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 10,
                      border: "none", background: editText.trim() && !resubmitting ? "#FF00AE" : "rgba(255,255,255,0.15)",
                      color: "#FFF", fontSize: 14, fontWeight: 700,
                      cursor: editText.trim() && !resubmitting ? "pointer" : "not-allowed",
                      fontFamily: "inherit",
                    }}
                  >{resubmitting ? "Submitting\u2026" : "Resubmit \u2192"}</button>
                </div>
              </div>
            ) : (
              <h1
                onClick={isOwner ? () => { setEditMode(true); setEditText(obs.thesis || obs.raw_input || ""); } : undefined}
                style={{
                  fontSize: 20, fontWeight: 700, color: "#FFF", lineHeight: 1.4,
                  letterSpacing: -0.4, margin: 0,
                  cursor: isOwner ? "pointer" : "default",
                  borderBottom: "none",
                  paddingBottom: 0,
                }}
                title={isOwner ? "Tap to edit & resubmit" : undefined}
              >{obs.thesis}</h1>
            )}
          </div>
        )}

        {/* Hot Take content — always visible */}
        {obs.status === "complete" && (steelBottomLine || steelHardFacts.length > 0 || steelBullets.length > 0) && (
          <div ref={steelmanRef}>
            {steelBottomLine && (
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#FF00AE", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> Hot Take</p>
                <p style={{ fontSize: 16, color: "#FFF", lineHeight: 1.55, margin: 0, fontWeight: 600 }}>{steelBottomLine}</p>
              </div>
            )}

            {steelBullets.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 10px" }}>The Case</p>
                {steelBullets.map((bullet, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 18, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{"\u2022"}</span>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0 }}>{bullet}</p>
                  </div>
                ))}
              </>
            )}

            {steelHardFacts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,200,50,0.7)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 10px" }}>Hard Facts</p>
                {steelHardFacts.map((fact, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <span style={{ color: "rgba(255,200,50,0.8)", fontWeight: 800, fontSize: 13, lineHeight: 1, marginTop: 3, flexShrink: 0 }}>—</span>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 1.6, margin: 0, fontVariantNumeric: "tabular-nums" }}><HardFact item={fact} /></p>
                  </div>
                ))}
              </div>
            )}

            {obs.sources && obs.sources.length > 0 && (
              <p style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, margin: "20px 0 8px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginRight: 6 }}>Sources</span>
                {obs.sources.map((src, i) => (
                  <span key={i}>
                    {i > 0 && <span style={{ margin: "0 4px" }}>·</span>}
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,200,50,1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                    >{src.title || new URL(src.url).hostname}</a>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        {/* Cold Shower — shown when triggered via Devil's Advocate */}
        {obs.status === "complete" && activeTab === "coldshower" && (() => {
          if (counterpointLoading) return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
              <ProcessingDots color="#FF00AE" /><span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Generating cold shower…</span>
            </div>
          );
          if (counterpointError) return (
            <div style={{ background: "rgba(255,0,174,0.1)", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,0,174,0.3)" }}>
              <p style={{ fontSize: 14, color: "#FF00AE", margin: 0, lineHeight: 1.5 }}>Cold shower failed. Try again.</p>
            </div>
          );
          if (!counterpoint) return (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>Loading…</p>
            </div>
          );
          const cpHardFacts = Array.isArray(counterpoint.hard_facts) ? counterpoint.hard_facts : [];
          return (
            <div ref={counterpointRef}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#FF00AE", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> Devil&rsquo;s Advocate</p>
                <p style={{ fontSize: 15, color: "#FFF", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{counterpoint.bottom_line}</p>
              </div>
              {counterpoint.bullets.length > 0 && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 10px" }}>The Case Against</p>
                  {counterpoint.bullets.map((bullet, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                      <span style={{ color: "#FF00AE", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>{"\u2212"}</span>
                      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0 }}>{bullet}</p>
                    </div>
                  ))}
                </>
              )}
              {cpHardFacts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,200,50,0.7)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 10px" }}>Hard Facts</p>
                  {cpHardFacts.map((fact, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                      <span style={{ color: "rgba(255,200,50,0.8)", fontWeight: 800, fontSize: 13, lineHeight: 1, marginTop: 3, flexShrink: 0 }}>—</span>
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 1.6, margin: 0, fontVariantNumeric: "tabular-nums" }}><HardFact item={fact} /></p>
                    </div>
                  ))}
                </div>
              )}
              {counterpoint.verdict && (
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>{counterpoint.verdict}</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* PvA Take tab content */}
        {obs.status === "complete" && activeTab === "pva" && (() => {
          if (pvaLoading) return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
              <ProcessingDots color="#FF00AE" /><span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Generating PvA take…</span>
            </div>
          );
          if (pvaError) return (
            <div style={{ background: "rgba(255,0,174,0.1)", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,0,174,0.3)" }}>
              <p style={{ fontSize: 14, color: "#FF00AE", margin: 0, lineHeight: 1.5 }}>PvA take failed. Try again.</p>
            </div>
          );
          const take = obs.pva_take;
          if (!take) return (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>Loading…</p>
            </div>
          );
          const pvaBullets = Array.isArray(take.bullets) ? take.bullets : [];
          const pvaBottomLine = take.bottom_line || take.tldr || "";
          return (
            <div ref={pvaRef}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}>{flashPva && <PulsingDot />} PvA Take</p>
                <p style={{ fontSize: 15, color: "#FFF", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{pvaBottomLine}</p>
              </div>
              {pvaBullets.map((bullet, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#FF00AE", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>{"\u2022"}</span>
                  <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0 }}>{bullet}</p>
                </div>
              ))}
              {take.tldr && take.tldr !== pvaBottomLine && (
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>{take.tldr}</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Bottom CTAs — PvA + Disagree */}
        {obs.status === "complete" && (
          <div style={{ margin: "24px 0 8px", display: "flex", flexDirection: "column", gap: 8 }}>
            {/* PvA Take */}
            <button
              onClick={() => { setActiveTab("pva"); handlePvaTake(); }}
              style={{
                width: "100%", padding: "15px 20px",
                borderRadius: 12,
                border: "1.5px solid rgba(255,255,255,0.13)",
                background: "rgba(255,255,255,0.04)",
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
                WebkitTapHighlightColor: "transparent",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,174,0.08)"; e.currentTarget.style.borderColor = "rgba(255,0,174,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)"; }}
            >
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#FFF", margin: "0 0 2px", letterSpacing: -0.2 }}>PvA Take</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>What would the PvA hosts say?</p>
              </div>
            </button>
            {/* Disagree */}
            {!obs.parent_id && (
              <button
                onClick={() => onChallenge(obs)}
                style={{
                  width: "100%", padding: "15px 20px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(255,255,255,0.13)",
                  background: "rgba(255,255,255,0.04)",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 6,
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,174,0.08)"; e.currentTarget.style.borderColor = "rgba(255,0,174,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)"; }}
              >
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#FFF", margin: "0 0 2px", letterSpacing: -0.2 }}>Disagree?</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>Submit your counter-argument</p>
                </div>
              </button>
            )}
          </div>
        )}


        {/* Challenges from other users */}
        {challenges.length > 0 && (
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: 0.8, textTransform: "uppercase", margin: "0 0 14px" }}>
              {challenges.length === 1 ? "1 Challenge" : `${challenges.length} Challenges`}
            </p>
            {challenges.map(c => (
              <div key={c.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "14px 16px", marginBottom: 10, borderLeft: "3px solid rgba(255,0,174,0.5)" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#FFF", margin: "0 0 6px", lineHeight: 1.5 }}>{c.thesis || c.raw_input}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {c.score != null && <ScoreBadge value={c.score} size="sm" />}
                  {c.user_name && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{c.user_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Model indicator */}
      {obs.model_used && (
        <p style={{ textAlign: "center", fontSize: 10, color: "#C0C0B8", padding: "20px 0 0", margin: 0 }}>
          Powered by {obs.model_used}
        </p>
      )}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────

function HardFact({ item }: { item: HardFactItem | string }) {
  if (typeof item === "string") {
    // legacy string format — strip inline source if present
    const match = item.match(/^(.*?)(\s*\([^)]+\))$/);
    if (!match) return <>{item}</>;
    return <>{match[1]}<span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontStyle: "italic" }}>{match[2]}</span></>;
  }
  return (
    <>
      {item.fact}{" "}
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontStyle: "italic" }}>({item.source})</span>
    </>
  );
}


function PulsingDot() {
  return (
    <>
      <span style={{
        display: "inline-block", width: 7, height: 7, borderRadius: "50%",
        background: "#FF00AE", flexShrink: 0,
        animation: "redDotPulse 2s ease-in-out infinite",
      }} />
      <style>{`
        @keyframes redDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
      `}</style>
    </>
  );
}

function ShareButton({ obsId, onClick, prominent = false }: { obsId: string; onClick?: (e: React.MouseEvent) => void; prominent?: boolean }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}#obs/${obsId}`;
  const shareText = "Someone shared a hot take with you. Check it out:";
  const fullText = `${shareText}\n${shareUrl}`;

  const handleShare = async (e: React.MouseEvent) => {
    onClick?.(e);
    e.stopPropagation();
    if (navigator.share) {
      try { await navigator.share({ text: shareText, url: shareUrl }); } catch { /* cancelled */ }
      return;
    }
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (prominent) {
    return (
      <button
        onClick={handleShare}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "none", border: "none", cursor: "pointer", padding: "4px 0",
          color: copied ? "#FF00AE" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
          transition: "color 0.2s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        {copied ? "Copied!" : "Share"}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "none", border: "none", cursor: "pointer", padding: 0,
        color: copied ? "#FF00AE" : "#666", fontSize: 10, fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        transition: "color 0.2s",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied ? "Copied!" : ""}
    </button>
  );
}

function ProcessingDots({ color = "#6666CC" }: { color?: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: "50%", background: color,
            display: "inline-block",
            animation: "pulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────

type View = "home" | "capture" | "output" | "about";

interface AuthUser { id: string; name: string; avatar: string | null; is_admin?: boolean; }

function getTokenIsAdmin(): boolean {
  try {
    const token = localStorage.getItem("sm_token");
    if (!token) return false;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return !!payload.is_admin;
  } catch { return false; }
}

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("sm_user") || "null"); } catch { return null; }
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Refresh auth from server on startup to pick up is_admin and other changes
  useEffect(() => {
    const token = localStorage.getItem("sm_token");
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const user = { id: data.id, name: data.name, avatar: data.avatar, is_admin: data.is_admin };
          localStorage.setItem("sm_user", JSON.stringify(user));
          setAuthUser(user);
        }
      })
      .catch(() => {});
  }, []);

  const handleAnonLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      let anonId = localStorage.getItem("anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("anon_id", anonId);
      }
      const res = await fetch(`${API}/auth/anon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anon_id: anonId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
      localStorage.setItem("sm_token", data.token);
      localStorage.setItem("sm_user", JSON.stringify(data.user));
      setAuthUser(data.user);
    } catch (e: any) {
      setAuthError(e.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
      localStorage.setItem("sm_token", data.token);
      localStorage.setItem("sm_user", JSON.stringify(data.user));
      setAuthUser(data.user);
    } catch (e: any) {
      setAuthError(e.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("sm_token");
    localStorage.removeItem("sm_user");
    setAuthUser(null);
  };

  const { observations, loading, fetchObservations, submitObservation, editObservation, pollObservation, requestCounterpoint, requestPvaTake, deleteObservation } = useObservations();
  const [view, setView] = useState<View>("home");
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [outputKey, setOutputKey] = useState(0);
  const [challengingObs, setChallengingObs] = useState<Observation | null>(null);

  useEffect(() => {
    if (!authUser) return;
    fetchObservations().then(() => {
      // Deep link: #obs/<id> opens that observation
      const hash = window.location.hash;
      const match = hash.match(/^#obs\/(.+)$/);
      if (match) {
        const id = match[1];
        pollObservation(id).then((obs) => {
          if (obs) {
            setSelectedObs(obs);
            setView("output");
          }
        });
      }
    });
  }, [authUser]);

  // Browser back button support
  useEffect(() => {
    const handlePop = () => {
      setView("home");
      setSelectedObs(null);
      window.history.replaceState(null, "", window.location.pathname);
      setTimeout(() => window.scrollTo(0, 0), 0);
      fetchObservations();
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Show login screen if not authenticated
  if (!authUser) {
    return (
      <div style={{ minHeight: "100dvh", background: "#12102B", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, position: "relative" }}>
  
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, position: "relative", zIndex: 1 }}>
          <BurstIcon size={130} />
          <span style={{ fontSize: 25, fontWeight: 900, letterSpacing: -1.5, color: "#FFF", marginTop: -18, fontFamily: "'Besley', serif" }}>
            <span style={{ color: "#FF00AE" }}>hot</span>take
          </span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 40px", textAlign: "center", lineHeight: 1.7, letterSpacing: -0.1, position: "relative", zIndex: 1 }}>
          Drop a hot take.<br />
          We build the strongest case for it.<br />
          We stress test it.<br />
          To see if it holds up.
        </p>
        {authLoading
          ? <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Signing in…</p>
          : <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setAuthError("Google sign-in failed")} theme="filled_black" shape="rectangular" text="continue_with" size="large" />
        }
        {authError && <p style={{ color: "#FF00AE", fontSize: 13, marginTop: 16, textAlign: "center" }}>{authError}</p>}
        <button
          onClick={handleAnonLogin}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.28)", fontSize: 12, cursor: "pointer", marginTop: 28, padding: 0, textDecoration: "underline", fontFamily: "inherit", letterSpacing: -0.2 }}
        >
          Just Let Me See It
        </button>
      </div>
    );
  }

  const navigateTo = (nextView: View, obs?: Observation) => {
    const url = nextView === "output" && obs ? `#obs/${obs.id}` : window.location.pathname;
    window.history.pushState({ view: nextView }, "", url);
    if (obs) setSelectedObs(obs);
    setView(nextView);
    setTimeout(() => window.scrollTo(0, 0), 0);
  };

  const handleChallenge = (obs: Observation) => {
    setChallengingObs(obs);
    navigateTo("capture");
  };

  const handleSubmit = async (text: string) => {
    const obs = await submitObservation(
      text,
      text.startsWith("http") ? "url" : "text",
      undefined,
      undefined,
      challengingObs?.id,
      challengingObs ? "counter" : undefined,
    );
    setChallengingObs(null);
    navigateTo("output", obs);
  };

  const handleSubmitImage = async (b64: string, mediaType: string, context?: string) => {
    const obs = await submitObservation(
      context || "image",
      "screenshot",
      b64,
      mediaType,
      challengingObs?.id,
      challengingObs ? "counter" : undefined,
    );
    setChallengingObs(null);
    navigateTo("output", obs);
  };

  const handleResubmit = async (obsId: string, text: string, imageData?: string, imageMediaType?: string) => {
    const inputType = imageData ? "screenshot" : (text.startsWith("http") ? "url" : "text");
    const obs = await editObservation(obsId, text, inputType, imageData, imageMediaType);
    setSelectedObs(obs);
    setOutputKey((k) => k + 1); // force OutputView remount with fresh state
  };

  if (view === "about") {
    return <AboutView onBack={() => setView("home")} />;
  }

  if (view === "capture") {
    return (
      <CaptureView
        onSubmit={handleSubmit}
        onSubmitImage={handleSubmitImage}
        onBack={() => {
          setChallengingObs(null);
          setView("home");
          window.history.replaceState(null, "", window.location.pathname);
          setTimeout(() => window.scrollTo(0, 0), 0);
        }}
        parentObs={challengingObs}
      />
    );
  }

  if (view === "output" && selectedObs) {
    return (
      <OutputView
        key={outputKey}
        obs={selectedObs}
        onBack={() => { setView("home"); window.history.replaceState(null, "", window.location.pathname); fetchObservations(); setTimeout(() => window.scrollTo(0, 0), 0); }}
        onDelete={async (id) => { await deleteObservation(id); fetchObservations(); }}
        onResubmit={handleResubmit}
        onChallenge={handleChallenge}
        pollObservation={pollObservation}
        requestCounterpoint={requestCounterpoint}
        requestPvaTake={requestPvaTake}
        authUserId={authUser.id}
        isAdmin={!!authUser.is_admin || getTokenIsAdmin()}
      />
    );
  }

  return (
    <HomeView
      observations={observations}
      loading={loading}
      onCapture={() => navigateTo("capture")}
      onSelect={(o) => navigateTo("output", o)}
      authUser={authUser}
      onSignOut={handleSignOut}
      onAbout={() => setView("about")}
    />
  );
}
