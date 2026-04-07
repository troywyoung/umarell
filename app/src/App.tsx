import { useState, useEffect, useRef, Fragment } from "react";
import { GoogleLogin } from "@react-oauth/google";
import type { Observation, HardFactItem } from "./types";
import { useObservations } from "./hooks/useObservations";
import { API } from "./config";
import { useInstanceConfig } from "./contexts/InstanceContext";
import AdminPanel from "./AdminPanel";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("sm_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// ─── Rotating placeholder text ───────────────────────────────────────────

// Default placeholders — used as fallback if config is not loaded
const DEFAULT_PLACEHOLDERS = [
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

function getRandomPlaceholder(placeholders: string[] = DEFAULT_PLACEHOLDERS) {
  return placeholders[Math.floor(Math.random() * placeholders.length)];
}

const DEFAULT_RESPONSE_PLACEHOLDERS = [
  "Agree? Destroy it.",
  "Wrong. Here's why…",
  "This is more complicated than it looks.",
  "You're missing the point.",
  "Actually, this is exactly right.",
  "Hot take on the hot take…",
  "The real story is…",
  "I've been thinking about this and…",
  "Everyone's wrong about this.",
  "This is the take nobody wants to hear.",
  "Here's what the data actually says…",
  "The thing that makes this interesting…",
  "Counterpoint:",
  "This ages badly because…",
  "Strong disagree, and here's the receipts.",
];

function getRandomResponsePlaceholder(responsePlaceholders: string[] = DEFAULT_RESPONSE_PLACEHOLDERS) {
  return responsePlaceholders[Math.floor(Math.random() * responsePlaceholders.length)];
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
  const durationRef = useRef(8000);

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const nextCycle = () => {
      // Vary duration 6–11s and strokeWidth 2–3.5 each loop
      durationRef.current = 6000 + Math.random() * 5000;
      el.setAttribute("d", generateScribblePath());
      el.setAttribute("stroke-width", (2 + Math.random() * 1.5).toFixed(1));
      el.style.strokeDashoffset = "1";
    };
    nextCycle();
    let start: number | null = null;
    let raf: number;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = (now - start) / durationRef.current;
      if (progress >= 1) {
        nextCycle();
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
    <svg width={size} height={size} viewBox="-8 -8 116 116" style={{ display: "block", marginRight: -2 }}>
      <path
        ref={pathRef}
        pathLength="1"
        fill="none"
        stroke="var(--color-accent, #FF00AE)"
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
            fill="var(--color-accent, #FF00AE)"
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
    <div style={{ display: "grid", gridTemplateColumns: "46px 86px 1fr", gap: "7px 8px", alignItems: "baseline" }}>
      {SCORE_ROWS.map(({ range, label, color, desc }) => (
        <Fragment key={range}>
          <span style={{ fontSize: 10, fontWeight: 800, color }}>{range}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{desc}</span>
        </Fragment>
      ))}
    </div>
  );
}

function HotTakeInfoRow() {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: "#FF00AE", letterSpacing: 0.8, textTransform: "uppercase", margin: "0 0 4px" }}>🔥 Hot Take</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
        A high-score take that's also highly brazen — well-evidenced but challenges widely held beliefs.
      </p>
    </div>
  );
}

// Mobile: slides up from bottom
function ScoreInfoSheet({ onClose, isHotTake }: { onClose: () => void; isHotTake?: boolean }) {
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
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-accent, #FF00AE)", letterSpacing: 1, textTransform: "uppercase" }}>Take Strength Score</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", padding: "0 0 0 12px", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, margin: "0 0 14px" }}>
          A conviction score. Verifiable facts score near 100. Demonstrably false claims score near 0. Opinions land in the middle based on how well-evidenced and defensible the argument is.
        </p>
        {isHotTake && <HotTakeInfoRow />}
        <ScoreInfoRows />
      </div>
    </>
  );
}

// Desktop: anchored popover card below the trigger
function ScoreInfoPopover({ onClose, isHotTake }: { onClose: () => void; isHotTake?: boolean }) {
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
          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--color-accent, #FF00AE)", letterSpacing: 1, textTransform: "uppercase" }}>Take Strength Score</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 18, cursor: "pointer", padding: "0 0 0 12px", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: "0 0 12px" }}>
          A conviction score. Verifiable facts score near 100. Demonstrably false claims score near 0. Opinions land in the middle based on how well-evidenced and defensible the argument is.
        </p>
        {isHotTake && <HotTakeInfoRow />}
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

function ScoreBadge({ value, size = "md", dark = false, animate = false, isHotTake = false, obsId, hideLabel = false, emojiDelay = 360, emojiAnim = "hotGrow", emojiDuration = "0.55s", emojiEasing = "cubic-bezier(0.34,1.56,0.64,1)", skipObserver = false }: { value?: number; size?: "sm" | "md" | "lg" | "xl"; dark?: boolean; animate?: boolean; isHotTake?: boolean; obsId?: string; hideLabel?: boolean; emojiDelay?: number; emojiAnim?: string; emojiDuration?: string; emojiEasing?: string; skipObserver?: boolean }) {
  if (value == null) return null;
  const target = Math.round(value);
  const accent = getScoreColor(target);
  const dim = size === "sm" ? 40 : size === "lg" ? 43 : size === "xl" ? 52 : 32;
  const fontSize = size === "sm" ? 14 : size === "lg" ? 15 : size === "xl" ? 19 : 11;
  const r = (dim - 4) / 2;
  const circ = 2 * Math.PI * r;
  const PINK = "#FF00AE";

  const HOT_EMOJIS = ["🥵","🤯","🫣","😤","💥","🫠","😈","☄️","🌋","🤬","⚡","😱","💀","🌪️","😡","🚨","🤘"];
  const emojiIdx = obsId ? obsId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % HOT_EMOJIS.length : Math.floor(Math.random() * HOT_EMOJIS.length);
  const emojiRef = useRef(HOT_EMOJIS[emojiIdx]);
  const badgeRef = useRef<HTMLDivElement>(null);

  const [displayVal, setDisplayVal] = useState(0);
  const [animPct, setAnimPct] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [inView, setInView] = useState(false);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (skipObserver) { setTimeout(() => setInView(true), 120); return; }
    const el = badgeRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          obs.disconnect();
          setTimeout(() => setInView(true), 120);
        }
      },
      { threshold: 1.0, rootMargin: "0px 0px -80px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [skipObserver]);

  useEffect(() => {
    if (!inView) return;
    if (!animate) { setDisplayVal(target); setAnimPct(target / 100); setShowEmoji(isHotTake); return; }
    setDisplayVal(0); setAnimPct(0); setShowEmoji(false);
    startRef.current = null;
    const duration = 1440;
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(Math.round(eased * target));
      setAnimPct(eased * target / 100);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else if (isHotTake) {
        setTimeout(() => setShowEmoji(true), emojiDelay);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [animate, target, isHotTake, inView]);

  const currentColor = showEmoji ? PINK : (animate ? getScoreColor(displayVal) : accent);
  const pct = showEmoji ? 1 : (animate ? animPct : target / 100);

  return (
    <div ref={badgeRef} style={{ position: "relative", width: dim, height: dim, flexShrink: 0, overflow: "visible" }}>
      <svg width={dim} height={dim} style={{ transform: "rotate(-90deg)", transition: showEmoji ? "stroke 0.4s ease" : "none" }}>
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"} strokeWidth={size === "lg" || size === "xl" ? 4.4 : 3.4} />
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={currentColor} strokeWidth={size === "lg" || size === "xl" ? 4.4 : 3.4}
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: showEmoji ? "stroke 0.4s ease, stroke-dasharray 0.4s ease" : "none" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize, fontWeight: 800, color: dark ? "#1A1A1A" : "#FFF", lineHeight: 1, letterSpacing: -0.5 }}>{displayVal}</span>
      </div>
      {showEmoji && (
        <>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, animation: `${emojiAnim} ${emojiDuration} ${emojiEasing} 16ms both`, willChange: "transform, opacity" }}>
            <div style={{ fontSize: dim * 1.13, lineHeight: 1, userSelect: "none" }}>{emojiRef.current}</div>
          </div>
          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, textAlign: "center", zIndex: 2, animation: `${emojiAnim} ${emojiDuration} ${emojiEasing} 16ms both` }}>
            {!hideLabel && <p style={{ fontSize: 6, fontWeight: 800, color: "#FF00AE", margin: "0 0 3px", letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" }}>Hot Take</p>}
          </div>
        </>
      )}
    </div>
  );
}

function AudioTake({ src, btnColor = "#2C5ABA", durationSecs = 0 }: { src: string; btnColor?: string; durationSecs?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(durationSecs);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
      <audio ref={audioRef} src={src} playsInline preload="auto"
        onTimeUpdate={() => { const a = audioRef.current; if (a) setProgress(a.currentTime / (a.duration || 1)); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => setPlaying(false)}
      />
      <button onClick={toggle} style={{ background: btnColor, border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
        <svg width={10} height={10} viewBox="0 0 10 10" fill="#FFF">
          {playing
            ? <><rect x="1.5" y="1" width="2.5" height="8" rx="1"/><rect x="6" y="1" width="2.5" height="8" rx="1"/></>
            : <polygon points="1.5,0.5 9.5,5 1.5,9.5"/>}
        </svg>
      </button>
      <div style={{ flex: 1, height: 3, background: `${btnColor}55`, borderRadius: 2, position: "relative", cursor: "pointer" }}
        onClick={e => { e.stopPropagation(); const a = audioRef.current; if (!a) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - r.left) / r.width) * a.duration; }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, background: btnColor, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color: "var(--color-secondary-text, #888)", flexShrink: 0 }}>{fmt(duration > 0 ? duration - duration * progress : 0)}</span>
    </div>
  );
}


function timeAgo(iso: string) {
  // Ensure UTC parsing — handle bare timestamps (append Z) and +HH:MM offset from Postgres
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(iso.trim()) ? iso : iso.trim() + "Z";
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
      <span style={{ color: "var(--color-accent, #FF00AE)", fontSize: 16, lineHeight: 1.5, flexShrink: 0 }}>—</span>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
  return (
    <div style={{ maxWidth: "var(--max-content-width, 480px)", margin: "0 auto", minHeight: "100vh", background: "transparent", padding: "0 0 60px" }}>
      <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 900, color: "#FFF", letterSpacing: -0.6, lineHeight: 1 }}>Your takes, stress-tested.</span>
      </div>
      <div style={{ padding: "28px 24px 0" }}>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.9)", lineHeight: 1.65, margin: "0 0 28px", letterSpacing: -0.2 }}>
          A feed of hot takes — sharpened by AI, scored for conviction, and open for debate. Brought to you by the folks at People vs Algorithms.
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-accent, #FF00AE)", letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 20px" }}>How it works</p>
        {bullet("Drop a hot take, paste a link, or type out a half-formed opinion. AI sharpens it into its most defensible form and builds the case for it.")}
        {bullet("Every take gets a conviction score from 0–100 — how well does the evidence actually hold up? You see the number before you decide whether to push back.")}
        {bullet("Hit Devil's Advocate on any take to get the strongest possible case against it.")}
        {bullet("Disagree? Challenge it. Your counter gets the same treatment. The feed becomes a live record of the argument.")}
        {bullet("Add your take directly in the feed — type it or record it. It stays with the post.")}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0, letterSpacing: -0.1 }}>
            Most takes sound better before anyone pushes back. This is the push back.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────

function HomeView({ observations, loading, onCapture, onSelect, authUser, onSignOut, onAbout, onOpenAdmin, onRefresh }: {
  observations: Observation[];
  loading: boolean;
  onCapture: () => void;
  onSelect: (o: Observation) => void;
  authUser: AuthUser;
  onSignOut: () => void;
  onAbout: () => void;
  onOpenAdmin?: () => void;
  onRefresh: () => void;
}) {
  const { config } = useInstanceConfig();
  const [selectedTopic, setSelectedTopic] = useState<string | null>("__top__");
  const [jokeMap, setJokeMap] = useState<Record<string, string>>({});
  const [jokeLoading, setJokeLoading] = useState<Set<string>>(new Set());
  const [yourTakeInput, setYourTakeInput] = useState<Set<string>>(new Set());
  const [yourTakeDraft, setYourTakeDraft] = useState<Record<string, string>>({});
  const [yourTakePlaceholder, setYourTakePlaceholder] = useState<Record<string, string>>({});
  type TakeEntry = { id: string; text?: string; audioB64?: string; durationSecs?: number; userId: string; userName: string; createdAt: string };
  const [yourTakeMap, setYourTakeMap] = useState<Record<string, TakeEntry[]>>({});
  const [expandedTakes, setExpandedTakes] = useState<Set<string>>(new Set());
  const [expandedTakeText, setExpandedTakeText] = useState<Set<string>>(new Set());
  const [recording, setRecording] = useState<string | null>(null);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [showCollectionInfo, setShowCollectionInfo] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const takesLoadedRef = useRef<Set<string>>(new Set());

  // Load takes from API for all visible observations
  useEffect(() => {
    const ids = observations.map(o => o.id).filter(id => !takesLoadedRef.current.has(id));
    if (ids.length === 0) return;
    ids.forEach(id => takesLoadedRef.current.add(id));
    Promise.all(ids.map(id =>
      fetch(`${API}/observations/${id}/takes`, { headers: authHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then(takes => ({ id, takes: (takes as Array<{ id: string; text?: string; audio_b64?: string; duration_secs?: number; user_id?: string; user_name?: string; created_at: string }>).map(t => ({
          id: t.id, text: t.text, audioB64: t.audio_b64, durationSecs: t.duration_secs,
          userId: t.user_id || "", userName: t.user_name || "Anonymous", createdAt: t.created_at,
        })) }))
        .catch(() => ({ id, takes: [] as TakeEntry[] }))
    )).then(results => {
      setYourTakeMap(prev => {
        const next = { ...prev };
        for (const r of results) { if (r.takes.length > 0) next[r.id] = r.takes; }
        return next;
      });
    });
  }, [observations]);

  const toggleYourTake = (obsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setJokeMap(m => { const n = { ...m }; delete n[obsId]; return n; });
    setYourTakeInput(s => {
      const n = new Set(s);
      if (n.has(obsId)) { n.delete(obsId); } else {
        n.add(obsId);
        setYourTakePlaceholder(p => p[obsId] ? p : { ...p, [obsId]: getRandomResponsePlaceholder(config?.ui_copy?.response_placeholders) });
      }
      return n;
    });
  };

  const submitYourTake = async (obsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = yourTakeDraft[obsId]?.trim();
    if (!text) return;
    try {
      const resp = await fetch(`${API}/observations/${obsId}/takes`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) throw new Error("Failed");
      const t = await resp.json();
      const entry: TakeEntry = { id: t.id, text: t.text, audioB64: t.audio_b64, durationSecs: t.duration_secs, userId: t.user_id || "", userName: t.user_name || "Anonymous", createdAt: t.created_at };
      setYourTakeMap(prev => ({ ...prev, [obsId]: [...(prev[obsId] || []), entry] }));
    } catch { /* silent */ }
    setYourTakeDraft(d => ({ ...d, [obsId]: "" }));
    setYourTakeInput(s => { const n = new Set(s); n.delete(obsId); return n; });
  };

  const startRecording = async (obsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
        .find(t => MediaRecorder.isTypeSupported(t)) || "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        const capturedSecs = recordingSecs;
        reader.onloadend = async () => {
          const audioB64 = (reader.result as string);
          try {
            const resp = await fetch(`${API}/observations/${obsId}/takes`, {
              method: "POST", headers: authHeaders(),
              body: JSON.stringify({ audio_b64: audioB64, duration_secs: capturedSecs }),
            });
            if (!resp.ok) throw new Error("Failed");
            const t = await resp.json();
            const entry: TakeEntry = { id: t.id, text: t.text, audioB64: t.audio_b64, durationSecs: t.duration_secs, userId: t.user_id || "", userName: t.user_name || "Anonymous", createdAt: t.created_at };
            setYourTakeMap(prev => ({ ...prev, [obsId]: [...(prev[obsId] || []), entry] }));
          } catch { /* silent */ }
        };
        reader.readAsDataURL(blob);
        setYourTakeInput(s => { const n = new Set(s); n.delete(obsId); return n; });
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecording(null);
        setRecordingSecs(0);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(obsId);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000);
    } catch (err) {
      setRecording(null);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
        alert("Microphone access was denied. Please allow microphone permission in your browser settings and try again.");
      } else if (msg.includes("NotFound") || msg.includes("Requested device not found")) {
        alert("No microphone found on this device.");
      } else {
        alert(`Could not start recording: ${msg}`);
      }
    }
  };

  const stopRecording = (e: React.MouseEvent) => {
    e.stopPropagation();
    mediaRecorderRef.current?.stop();
  };

  const fetchJoke = async (obsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setYourTakeInput(s => { const n = new Set(s); n.delete(obsId); return n; });
    if (jokeMap[obsId] || jokeLoading.has(obsId)) {
      if (jokeMap[obsId]) {
        setJokeMap(m => { const n = { ...m }; delete n[obsId]; return n; });
      }
      return;
    }
    setJokeLoading(s => new Set(s).add(obsId));
    try {
      const res = await fetch(`${API}/observations/${obsId}/joke`, { method: "POST" });
      const data = await res.json();
      setJokeMap(m => ({ ...m, [obsId]: data.joke }));
    } finally {
      setJokeLoading(s => { const n = new Set(s); n.delete(obsId); return n; });
    }
  };

  return (
    <div style={{ maxWidth: "var(--max-content-width, 480px)", margin: "0 auto", paddingBottom: 120, minHeight: "100vh", position: "relative", background: "transparent" }}>

      {/* Top bar: what is this? left, avatar right */}
      <div style={{ position: "absolute", top: 13, left: 20, right: 20, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
        <button onClick={onAbout} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <span style={{ fontSize: window.innerWidth < 600 ? 11 : 9, fontWeight: 800, color: "#FFF", fontFamily: "inherit", textDecoration: "underline", textDecorationColor: "#FFF" }}>what is this?</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {loading && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Refreshing…</span>}
          {authUser.is_admin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              style={{
                fontSize: 11,
                color: "var(--color-accent, #FF00AE)",
                background: "none",
                border: "1px solid rgba(255,0,174,0.35)",
                borderRadius: 20,
                cursor: "pointer",
                fontFamily: "inherit",
                padding: "4px 10px",
                letterSpacing: -0.2
              }}
            >
              Admin
            </button>
          )}
          {authUser.avatar
            ? <img src={authUser.avatar} onClick={onSignOut} title={`Signed in as ${authUser.name} — tap to sign out`} style={{ width: 30, height: 30, borderRadius: "50%", cursor: "pointer", border: "2px solid rgba(255,255,255,0.4)" }} />
            : <button onClick={onSignOut} style={{ fontSize: 11, color: "var(--color-accent, #FF00AE)", background: "none", border: "1px solid rgba(255,0,174,0.35)", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", padding: "4px 10px", letterSpacing: -0.2 }}>Sign in</button>
          }
        </div>
      </div>

      {/* Branding */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "44px 0 2px" }}>
        <span style={{ fontSize: 27, fontWeight: 400, letterSpacing: "var(--letter-spacing-headline, -1.5px)", fontFamily: "var(--font-display, 'Besley', serif)", lineHeight: 1 }}><span style={{ color: "var(--color-accent, #FF00AE)" }}>hot</span><span style={{ color: "#FFF" }}>take</span></span>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .topic-pills::-webkit-scrollbar { display: none; }
        @keyframes recPulse { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        @keyframes yellowPulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
        @keyframes scoreLabelFadeIn { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
        @keyframes hotGrow { 0% { opacity:0; transform:scale(0.2); } 60% { opacity:1; transform:scale(1.35); } 100% { opacity:1; transform:scale(1); } }
        @keyframes detailEmojiPop { 0% { opacity:0; transform:scale(0); } 50% { opacity:1; transform:scale(1.3); } 70% { opacity:1; transform:scale(1.3); } 100% { opacity:1; transform:scale(1); } }
      `}</style>

<div style={{ padding: "6px 16px 0", position: "relative", zIndex: 1 }}>
        {observations.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "48px 24px 0" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#FFF", letterSpacing: -0.5, margin: "0 0 10px" }}>Drop your first take.</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: "0 0 28px" }}>Paste a URL, share a claim, or describe an idea. We'll build the strongest case for it.</p>
            <button onClick={onCapture} style={{ background: "var(--color-accent, #FF00AE)", color: "#fff", border: "none", borderRadius: 80, padding: "14px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: -0.3, WebkitTapHighlightColor: "transparent" }}>＋ Drop a hot take</button>
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

          // All posts in chronological order — pinned posts always float to top
          const rankScore = (o: Observation) => {
            if (o.pinned) return Infinity;
            const hoursAgo = (Date.now() - new Date(o.created_at).getTime()) / 3600000;
            const takes = (yourTakeMap[o.id] || []).length;
            const challenges = (challengeMap.get(o.id) || []).length;
            const engagementBoost = 1 + (takes * 0.2) + (challenges * 0.5);
            return (o.score || 0) * engagementBoost / Math.pow(hoursAgo + 2, 0.8);
          };
          const pinnedFirst = (arr: Observation[]) => [...arr].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
          const hotTakes = topLevel.filter(o => o.is_hot_take);
          const filteredPosts = selectedTopic === "__top__"
            ? [...topLevel].sort((a, b) => rankScore(b) - rankScore(a))
            : selectedTopic === "__hot__"
              ? [...hotTakes].sort((a, b) => (b.score || 0) - (a.score || 0))
              : !selectedTopic || selectedTopic === "__all__"
                ? pinnedFirst(topLevel)
                : selectedTopic === "PvA"
                  ? pinnedFirst(topLevel.filter(o => !!o.episode_tag))
                  : pinnedFirst(topLevel.filter(o => (o.tags || []).includes(selectedTopic)));

          const renderCard = (obs: Observation) => {
            let bullets: string[] = [];
            try {
              const parsed = JSON.parse(obs.summary || "");
              if (Array.isArray(parsed.bullets) && parsed.bullets.length > 0) {
                bullets = parsed.bullets.slice(0, 3);
              } else if (parsed.bottom_line) {
                bullets = [parsed.bottom_line];
              }
            } catch {
              bullets = (obs.summary || "").split(/\n+/).map((l: string) => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean).slice(0, 3);
            }
            const isCollection = !!obs.episode_tag;
            return (
              <div
                key={obs.id}
                onClick={() => onSelect(obs)}
                style={{
                  borderRadius: 8, position: "relative",
                  background: isCollection ? "var(--color-collection-card-bg, #F5F0E8)" : "var(--color-card-bg, #FFF)",
                  border: "none",
                  boxShadow: "var(--shadow-card, 0 1px 6px rgba(0,0,0,0.06))",
                  cursor: "pointer", overflow: "hidden",
                }}
              >
                {(obs.user_name || authUser?.is_admin) && (
                  <p style={{ fontSize: window.innerWidth < 600 ? 6 : 9, fontWeight: 600, color: isCollection ? "var(--color-accent, #FF00AE)" : "#999", margin: 0, padding: "8px 12px 0", letterSpacing: -0.2, lineHeight: 1, display: "flex", alignItems: "center", gap: 4 }}>
                    {obs.user_name && <span>{obs.user_name}</span>}
                    {obs.episode_tag && (() => { const eps = topLevel.filter((o: Observation) => o.episode_tag === obs.episode_tag); const idx = eps.findIndex((o: Observation) => o.id === obs.id) + 1; return idx > 0 ? <span style={{ fontWeight: 400, color: "#999", opacity: 0.6 }}>({idx}/{eps.length})</span> : null; })()}
                    {authUser?.is_admin && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await fetch(`${API}/hot-takes/observations/${obs.id}/pin`, { method: "PATCH", headers: authHeaders() });
                          onRefresh();
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: 9, opacity: obs.pinned ? 1 : 0.3, lineHeight: 1 }}
                        title={obs.pinned ? "Unpin" : "Pin to top"}
                      >📌</button>
                    )}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: obs.user_name ? "4px 12px 6px 12px" : "10px 12px 6px 12px" }}>
                    {obs.image_data && (
                      <img
                        src={`data:${obs.image_media_type || "image/jpeg"};base64,${obs.image_data}`}
                        style={{ width: 65, height: 65, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ float: "right", marginLeft: 8, marginBottom: 2, textAlign: "center" }}>
                        <ScoreBadge value={obs.score} size="sm" dark animate={!!obs.is_hot_take} isHotTake={obs.is_hot_take} obsId={obs.id} />
                      </div>
                      <p style={{
                        fontSize: "var(--font-size-card-headline, 14px)", fontWeight: 700,
                        color: "var(--color-dark-text, #1A1A1A)", lineHeight: 1.2, margin: 0, letterSpacing: -0.3,
                      }}>
                        {obs.thesis || obs.raw_input}
                      </p>
                      {/* Author link — news bundle cards only */}
                      {obs.context && (obs.episode_tag?.startsWith('nyt-opinion') || obs.episode_tag?.startsWith('wsj-opinion')) && (() => {
                        const sourceUrl = obs.sources?.[0]?.url;
                        return (
                          <a
                            href={sourceUrl || '#'}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 5, fontSize: 11, fontWeight: 600, color: "var(--color-accent, #FF00AE)", textDecoration: "underline", textDecorationColor: "rgba(255,0,174,0.4)", textUnderlineOffset: 2 }}
                          >
                            {obs.context}
                            <svg width={9} height={9} viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
                              <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                {yourTakeInput.has(obs.id) && (
                  <div onClick={e => e.stopPropagation()} style={{ padding: "4px 12px 10px" }}>
                    <textarea
                      autoFocus
                      value={yourTakeDraft[obs.id] || ""}
                      onChange={e => setYourTakeDraft(d => ({ ...d, [obs.id]: e.target.value }))}
                      placeholder={yourTakePlaceholder[obs.id] || config?.ui_copy?.labels?.say_your_take || "Say your take…"}
                      rows={3}
                      style={{
                        width: "100%", boxSizing: "border-box", resize: "none",
                        fontSize: 13, fontFamily: "inherit", lineHeight: 1.45,
                        border: "1px solid #E0E0DC", borderRadius: 8,
                        padding: "8px 10px", outline: "none", color: "var(--color-dark-text, #1A1A1A)",
                        background: "#FAFAF8",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        onClick={(e) => submitYourTake(obs.id, e)}
                        style={{
                          flex: 1, background: "#1A1A1A", color: "#FFF", border: "none",
                          borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", WebkitTapHighlightColor: "transparent",
                        }}
                      >Submit</button>
                      <button
                        onClick={recording === obs.id ? stopRecording : (e) => startRecording(obs.id, e)}
                        style={{
                          background: recording === obs.id ? "var(--color-accent, #FF00AE)" : "#F0F0ED",
                          color: recording === obs.id ? "#FFF" : "#555",
                          border: "none", borderRadius: 8, padding: "8px 14px",
                          fontSize: 12, fontWeight: 700, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 6,
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        {recording === obs.id ? (
                          <>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-card-bg, #FFF)", animation: "recPulse 1s ease-in-out infinite", display: "inline-block" }} />
                            {`${Math.floor(recordingSecs/60)}:${String(recordingSecs%60).padStart(2,"0")}`} Stop
                          </>
                        ) : "🎙 Record"}
                      </button>
                    </div>
                  </div>
                )}
                {bullets.length > 0 && (
                  <div style={{ padding: "0 12px 10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {bullets.map((b, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ fontSize: window.innerWidth < 600 ? 12 : 11, color: "var(--color-secondary-text, #888)", marginTop: 2, flexShrink: 0 }}>•</span>
                        <span style={{ fontSize: window.innerWidth < 600 ? 12 : 11, color: "#555", lineHeight: 1.4 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                )}
                {jokeMap[obs.id] && (
                  <div style={{
                    margin: "0 12px 10px 12px",
                    borderLeft: "3px solid #FF00AE",
                    paddingLeft: 10,
                    paddingTop: 6,
                    paddingBottom: 6,
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "var(--color-accent, #FF00AE)", letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Brian's take</span>
                    <p style={{
                      fontSize: window.innerWidth < 600 ? 13 : 11,
                      fontWeight: 600, color: "var(--color-dark-text, #1A1A1A)", lineHeight: 1.45,
                      margin: 0, letterSpacing: -0.2, fontStyle: "italic",
                    }}>
                      {jokeMap[obs.id]}
                    </p>
                  </div>
                )}
                {(obs.status === "formatting" || obs.status === "researching") && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px 8px" }}>
                    <SteelManIcon size={14} animate />
                    <span style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>
                      {obs.status === "formatting" ? "Formatting\u2026" : "Researching\u2026"}
                    </span>
                  </div>
                )}
                {(() => {
                  const myTakes = yourTakeMap[obs.id] || [];
                  if (myTakes.length === 0) return null;
                  const visible = expandedTakes.has(obs.id) ? myTakes : myTakes.slice(0, 3);
                  return (
                    <div style={{ borderTop: "2px solid #F0EDE8", margin: "0 12px", paddingTop: 8, paddingBottom: 4 }}>
                      {visible.map((t, idx) => {
                        const abbrev = (t.userName || "").split(" ").map((w: string, i: number) => i === 0 ? w : w[0] + ".").join(" ").slice(0, 14);
                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingTop: idx === 0 ? 0 : 8, marginBottom: 8, borderTop: idx === 0 ? "none" : "1px solid #F5F5F2" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {t.audioB64 ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 8, fontWeight: 700, color: "#666", letterSpacing: -0.2, flexShrink: 0 }}>{abbrev}</span>
                                  <span style={{ fontSize: 8, color: "#BBB", flexShrink: 0 }}>|</span>
                                  <span style={{ fontSize: 8, color: "#AAA", letterSpacing: -0.2, flexShrink: 0 }}>{timeAgo(t.createdAt)}</span>
                                  <span style={{ fontSize: 8, color: "#BBB", flexShrink: 0 }}>|</span>
                                  <div style={{ flex: 1 }}><AudioTake src={t.audioB64} btnColor="#C8C4BC" durationSecs={t.durationSecs ?? 0} /></div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: "flex", gap: 5, alignItems: "baseline", marginBottom: 2 }}>
                                    <span style={{ fontSize: 8, fontWeight: 700, color: "#555", letterSpacing: -0.2 }}>{abbrev}</span>
                                    <span style={{ fontSize: 8, color: "#BBB", letterSpacing: -0.2 }}>{timeAgo(t.createdAt)}</span>
                                  </div>
                                  <p onClick={e => { e.stopPropagation(); setExpandedTakeText(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; }); }} style={{ fontSize: window.innerWidth < 600 ? 12 : 11, color: "#555", margin: 0, lineHeight: 1.4, cursor: "pointer", ...(expandedTakeText.has(t.id) ? {} : { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }) } as React.CSSProperties}>{t.text}</p>
                                </>
                              )}
                            </div>
                            {t.userId === authUser.id && (
                              <button
                                onClick={e => { e.stopPropagation(); fetch(`${API}/takes/${t.id}`, { method: "DELETE", headers: authHeaders() }).catch(() => {}); setYourTakeMap(prev => ({ ...prev, [obs.id]: (prev[obs.id] || []).filter((x: {id: string}) => x.id !== t.id) })); }}
                                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#CCC", flexShrink: 0, display: "flex", alignItems: "center", alignSelf: "center", WebkitTapHighlightColor: "transparent" }}
                              >
                                <svg width={10} height={11} viewBox="0 0 10 11" fill="none" stroke="currentColor" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="1" y1="2.5" x2="9" y2="2.5"/>
                                  <path d="M3.5 2.5V1.5h3v1"/>
                                  <path d="M2 2.5l.5 7h5l.5-7"/>
                                  <line x1="4" y1="5" x2="4" y2="8"/>
                                  <line x1="6" y1="5" x2="6" y2="8"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {myTakes.length > 3 && (
                        <div
                          onClick={e => { e.stopPropagation(); setExpandedTakes(s => { const n = new Set(s); n.has(obs.id) ? n.delete(obs.id) : n.add(obs.id); return n; }); }}
                          style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.35)", cursor: "pointer", paddingBottom: 4, letterSpacing: -0.2 }}
                        >
                          {expandedTakes.has(obs.id) ? "Show less" : `+${myTakes.length - 3} more`}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{
                  display: "flex", alignItems: "center",
                  padding: "6px 12px 10px",
                  borderTop: "1px solid #F5F5F2",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.5)", letterSpacing: -0.2 }}>{timeAgo(obs.created_at)}</span>
                    {obs.status === "complete" && (<>
                      <span style={{ fontSize: 8, color: "rgba(0,0,0,0.2)" }}>|</span>
                      <button
                        onClick={(e) => toggleYourTake(obs.id, e)}
                        style={{
                          cursor: "pointer",
                          fontSize: 8, fontWeight: 800, letterSpacing: -0.2,
                          color: yourTakeInput.has(obs.id) ? "var(--color-accent, #FF00AE)" : "rgba(255,0,174,0.6)",
                          WebkitTapHighlightColor: "transparent",
                          display: "flex", alignItems: "center", gap: 3,
                          background: yourTakeInput.has(obs.id) ? "rgba(255,0,174,0.1)" : "rgba(255,0,174,0.05)",
                          border: `1px solid ${yourTakeInput.has(obs.id) ? "rgba(255,0,174,0.5)" : "rgba(255,0,174,0.25)"}`,
                          borderRadius: 20, padding: "3px 7px",
                        }}
                      ><span style={{
                          width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                          background: "var(--color-accent, #FF00AE)",
                          animation: "yellowPulse 1.2s ease-in-out infinite",
                        }} />Add your take</button>
                      <span style={{ fontSize: 8, color: "rgba(0,0,0,0.2)" }}>|</span>
                      <button
                        onClick={(e) => fetchJoke(obs.id, e)}
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          fontSize: 8, fontWeight: 600, letterSpacing: -0.2,
                          color: jokeMap[obs.id] ? "var(--color-accent, #FF00AE)" : "rgba(0,0,0,0.55)",
                          opacity: jokeLoading.has(obs.id) ? 0.4 : 1,
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >{jokeLoading.has(obs.id) ? "thinking…" : "Brian's take"}</button>
                    </>)}
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
                borderRadius: 8, background: "#EEF4FF",
                boxShadow: "var(--shadow-card, 0 1px 6px rgba(0,0,0,0.06))",
                padding: "10px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <p style={{ fontSize: 11, color: "var(--color-dark-text, #1A1A1A)", fontWeight: 600, margin: 0, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", flex: 1 } as React.CSSProperties}>
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

          // Build episode bundles — pinned bundles stay together and float to top
          const episodePostsMap = new Map<string, Observation[]>();
          filteredPosts.forEach(o => {
            if (!o.episode_tag) return;
            const g = episodePostsMap.get(o.episode_tag) || [];
            g.push(o);
            episodePostsMap.set(o.episode_tag, g);
          });

          const renderEpisodeBundle = (tag: string, posts: Observation[]) => {
            const isExpanded = expandedEpisodes.has(tag);
            const orderedPosts = [...posts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const first = orderedPosts[0];
            const dateStr = new Date(first.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const podcastName = first.user_name || null;
            const episodeUrl = first.sources?.find((s: {url: string; title: string}) => s.title === "episode")?.url || first.sources?.[0]?.url || null;
            const isMobile = window.innerWidth < 600;
            const title = first.episode_title || (first.episode_tag ? first.episode_tag.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : null) || "Episode";
            const isNewsBundleTag = tag.startsWith('nyt-opinion') || tag.startsWith('wsj-opinion');
            const cardBg = isNewsBundleTag ? "#D8D3CB" : "var(--color-collection-card-bg, #F5F0E8)";
            const isBundlePinned = orderedPosts.some(o => o.pinned);

            const toggleBundlePin = async (e: React.MouseEvent) => {
              e.stopPropagation();
              await fetch(`${API}/episodes/${encodeURIComponent(tag)}/pin`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
              });
              onRefresh();
            };

            const toggleExpand = (e: React.MouseEvent) => {
              e.stopPropagation();
              setExpandedEpisodes(prev => {
                const next = new Set(prev);
                if (next.has(tag)) next.delete(tag);
                else next.add(tag);
                return next;
              });
            };

            if (isExpanded) {
              return (
                <div key={`episode-${tag}`} style={{ marginBottom: 14 }}>
                  {/* Episode header */}
                  <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: isMobile ? 8 : 9, fontWeight: 700, margin: "0 0 3px", letterSpacing: -0.2, lineHeight: 1, display: "flex", alignItems: "center", gap: 5 }}>
                        {podcastName && (
                          episodeUrl
                            ? <a href={episodeUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent, #FF00AE)", textDecoration: "underline" }}>{podcastName}</a>
                            : <span style={{ color: "var(--color-accent, #FF00AE)" }}>{podcastName}</span>
                        )}
                        <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                          {podcastName ? "  ·  " : ""}{orderedPosts.length} takes · {dateStr}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowCollectionInfo(true); }}
                          style={{ background: "none", border: "none", borderRadius: "50%", width: 28, height: 28, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1, flexShrink: 0, margin: -7, WebkitTapHighlightColor: "transparent" }}
                          aria-label="What is this?"
                        >
                          <span style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>?</span>
                        </button>
                      </p>
                      <p style={{ fontSize: isMobile ? 13 : 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0, letterSpacing: -0.3, lineHeight: 1.2 }}>
                        {episodeUrl
                          ? <a href={episodeUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>{title}</a>
                          : title}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {authUser?.is_admin && (
                        <button
                          onClick={toggleBundlePin}
                          style={{ background: "none", border: "none", padding: "3px 6px", fontSize: 14, cursor: "pointer", opacity: isBundlePinned ? 1 : 0.35, WebkitTapHighlightColor: "transparent" }}
                          title={isBundlePinned ? "Unpin bundle" : "Pin bundle to top"}
                        >📌</button>
                      )}
                      <button
                        onClick={toggleExpand}
                        style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", cursor: "pointer", letterSpacing: 0.2, WebkitTapHighlightColor: "transparent" }}
                      >
                        ↑ Collapse
                      </button>
                    </div>
                  </div>
                  {/* Episode cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {orderedPosts.map(obs => (
                      <div key={obs.id} style={{ marginBottom: 7 }}>
                        {renderCard(obs)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Collapsed: stacked card preview
            return (
              <div key={`episode-${tag}`} style={{ marginBottom: 14, position: "relative", paddingTop: 10 }}>
                {/* Back peek card */}
                <div style={{ position: "absolute", top: 0, left: 8, right: 8, height: 68, borderRadius: 8, background: cardBg, transform: "rotate(1.4deg)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", opacity: 0.7 }} />
                {/* Middle peek card */}
                <div style={{ position: "absolute", top: 4, left: 4, right: 4, height: 68, borderRadius: 8, background: cardBg, transform: "rotate(-0.7deg)", boxShadow: "0 1px 5px rgba(0,0,0,0.09)", opacity: 0.85 }} />
                {/* Front summary card */}
                <div
                  onClick={toggleExpand}
                  style={{
                    position: "relative", borderRadius: 8, background: cardBg,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.12)", cursor: "pointer",
                    padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {podcastName && (
                      <p style={{ fontSize: isMobile ? 8 : 9, fontWeight: 700, margin: "0 0 3px", color: "var(--color-accent, #FF00AE)", letterSpacing: -0.1, lineHeight: 1, textTransform: "uppercase" }}>
                        {podcastName}
                      </p>
                    )}
                    <p style={{ fontSize: isMobile ? 13 : 12, fontWeight: 700, color: "var(--color-dark-text, #1A1A1A)", margin: 0, letterSpacing: -0.3, lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                      {title}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(26,26,26,0.4)", margin: "4px 0 0", letterSpacing: -0.1, fontWeight: 500 }}>
                      {orderedPosts.length} hot take{orderedPosts.length !== 1 ? "s" : ""} · {dateStr}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, paddingTop: 2, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid rgba(192,173,147,0.55)", borderRadius: 20, padding: "3px 10px", fontSize: 9, fontWeight: 800, color: "#B8A98C", letterSpacing: 0.3, textTransform: "uppercase" }}>
                      Expand
                    </span>
                    {authUser?.is_admin && (
                      <button
                        onClick={toggleBundlePin}
                        style={{ background: "none", border: "none", padding: 0, fontSize: 13, cursor: "pointer", opacity: isBundlePinned ? 1 : 0.3, WebkitTapHighlightColor: "transparent" }}
                        title={isBundlePinned ? "Unpin bundle" : "Pin bundle to top"}
                      >📌</button>
                    )}
                  </div>
                </div>
              </div>
            );
          };

          const renderedEpisodeTags = new Set<string>();
          const renderFeedItem = (obs: Observation) => {
            if (!obs.episode_tag) return renderPost(obs);
            if (renderedEpisodeTags.has(obs.episode_tag)) return null;
            renderedEpisodeTags.add(obs.episode_tag);
            const posts = episodePostsMap.get(obs.episode_tag) || [obs];
            return renderEpisodeBundle(obs.episode_tag, posts);
          };

          return (
            <>
              {/* Collection info overlay */}
              {showCollectionInfo && (
                <div
                  onClick={() => setShowCollectionInfo(false)}
                  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: "var(--color-card-bg, #FFF)", borderRadius: 16, padding: "24px 20px", maxWidth: 340, width: "100%", boxSizing: "border-box" }}
                  >
                    <p style={{ fontSize: 17, fontWeight: 800, margin: "0 0 12px", color: "var(--color-dark-text, #1A1A1A)", letterSpacing: -0.3 }}>Podcast Collection</p>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--color-secondary-text, #888)", margin: "0 0 20px" }}>
                      We listened to the episode, pulled out the sharpest takes, and turned them into hot takes you can engage with. Tap any card to dig in.
                    </p>
                    <button
                      onClick={() => setShowCollectionInfo(false)}
                      style={{ width: "100%", padding: "11px 0", background: "var(--color-accent, #FF00AE)", color: "#FFF", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                    >Got it</button>
                  </div>
                </div>
              )}
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
                      borderRadius: 6, padding: "3px 9px",
                      fontSize: 9, fontWeight: 700,
                      color: selectedTopic === "__all__" ? "#FFF" : "rgba(255,255,255,0.55)",
                      cursor: "pointer", WebkitTapHighlightColor: "transparent",
                      fontFamily: "inherit",
                    }}
                  >
                    Latest
                  </button>

                  {/* Top pill */}
                  <button
                    onClick={() => setSelectedTopic(selectedTopic === "__top__" ? null : "__top__")}
                    style={{
                      flexShrink: 0,
                      background: selectedTopic === "__top__" ? "#4CAF50" : "rgba(76,175,80,0.15)",
                      border: selectedTopic === "__top__" ? "1.5px solid #4CAF50" : "1.5px solid rgba(76,175,80,0.4)",
                      borderRadius: 6, padding: "3px 9px",
                      fontSize: 9, fontWeight: 700,
                      color: selectedTopic === "__top__" ? "#FFF" : "#4CAF50",
                      cursor: "pointer", WebkitTapHighlightColor: "transparent",
                      fontFamily: "inherit",
                    }}
                  >
                    Top
                  </button>

                  {/* Hot Takes pill — only shown when there are hot takes */}
                  {hotTakes.length > 0 && (
                    <button
                      onClick={() => setSelectedTopic(selectedTopic === "__hot__" ? null : "__hot__")}
                      style={{
                        flexShrink: 0,
                        background: selectedTopic === "__hot__" ? "var(--color-accent, #FF00AE)" : "rgba(255,0,174,0.15)",
                        border: selectedTopic === "__hot__" ? "1.5px solid #FF00AE" : "1.5px solid rgba(255,0,174,0.4)",
                        borderRadius: 6, padding: "3px 9px",
                        fontSize: 9, fontWeight: 700,
                        color: selectedTopic === "__hot__" ? "#FFF" : "var(--color-accent, #FF00AE)",
                        cursor: "pointer", WebkitTapHighlightColor: "transparent",
                        fontFamily: "inherit",
                      }}
                    >
                      Hot Takes
                    </button>
                  )}

                  {/* PvA pill */}
                  <button
                    onClick={() => setSelectedTopic(selectedTopic === "PvA" ? null : "PvA")}
                    style={{
                      flexShrink: 0,
                      background: selectedTopic === "PvA" ? "rgba(255,255,255,0.15)" : "transparent",
                      border: selectedTopic === "PvA" ? "1.5px solid rgba(255,255,255,0.6)" : "1.5px solid rgba(255,255,255,0.2)",
                      borderRadius: 6, padding: "3px 9px",
                      fontSize: 9, fontWeight: 700,
                      color: selectedTopic === "PvA" ? "#FFF" : "rgba(255,255,255,0.55)",
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
                        borderRadius: 6, padding: "3px 9px",
                        fontSize: 9, fontWeight: 700,
                        color: selectedTopic === topic ? "#FFF" : "rgba(255,255,255,0.55)",
                        cursor: "pointer", WebkitTapHighlightColor: "transparent",
                        fontFamily: "inherit",
                      }}
                    >
                      {topic}
                    </button>
                  ))}
              </div>

              {/* Unified chronological feed — episode bundles grouped, regular posts dispersed */}
              {filteredPosts.length > 0
                ? <div style={{ paddingTop: 4 }}>{filteredPosts.map(renderFeedItem)}</div>
                : selectedTopic && (
                  <div style={{ textAlign: "center", padding: "48px 24px 0" }}>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                      {selectedTopic === "PvA" ? "No PvA episodes yet." : selectedTopic === "__hot__" ? "No hot takes yet." : `No takes tagged "${selectedTopic}" yet.`}
                    </p>
                  </div>
                )
              }
            </>
          );
        })()}
      </div>

      {/* Idea Button */}
      {yourTakeInput.size === 0 && <button
        onClick={onCapture}
        className="pva-fab"
        style={{
          position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)",
          width: 68, height: 68, borderRadius: "50%",
          background: "var(--color-accent, #FF00AE)", border: "none", outline: "4px solid rgba(255,0,174,0.5)", outlineOffset: 0, cursor: "pointer",
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
      </button>}
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
  const { config } = useInstanceConfig();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ b64: string; mediaType: string } | null>(null);
  const [placeholder] = useState(() => getRandomPlaceholder(config?.ui_copy?.placeholder_prompts));
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
    <div style={{ maxWidth: "var(--max-content-width, 480px)", margin: "0 auto", padding: "0 24px 60px", minHeight: "100vh", display: "flex", flexDirection: "column", background: "transparent" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "var(--color-secondary-text, #888)", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
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
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
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
        background: "var(--color-card-bg, #FFF)", borderRadius: 16, padding: "14px 16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12,
        border: listening ? "1.5px solid #6666CC" : "1.5px solid transparent",
        transition: "border-color 0.2s",
      }}>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          placeholder={listening ? (config?.ui_copy?.labels?.listening || "Listening\u2026") : placeholder}
          rows={3}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          style={{
            width: "100%", border: "none", outline: "none",
            fontSize: 16, color: "var(--color-dark-text, #1A1A1A)", lineHeight: 1.6,
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
              background: "var(--color-card-bg, #FFF)", borderRadius: 12, padding: "10px 14px",
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
                placeholder={config?.ui_copy?.labels?.add_link_optional || "Add a link (optional)"}
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: 16, color: "var(--color-dark-text, #1A1A1A)", fontFamily: "inherit",
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
          background: canSubmit ? "var(--color-accent, #FF00AE)" : "rgba(255,255,255,0.15)",
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
        <div style={{ marginTop: 12, background: "#FFF0EE", borderRadius: 8, padding: "12px 14px", border: "1px solid #F5C6C0" }}>
          <p style={{ fontSize: 13, color: "var(--color-accent, #FF00AE)", margin: 0, lineHeight: 1.5 }}>{error}</p>
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
  const { config } = useInstanceConfig();
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
      <div style={{ maxWidth: "var(--max-content-width, 480px)", margin: "0 auto", padding: "0 20px", background: "transparent", minHeight: "100vh" }}>
        <div style={{ padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "var(--color-secondary-text, #888)", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>&lsaquo; Back</button>
          {isOwner && (
            deleteConfirm ? (
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setDeleteConfirm(false)} style={{ background: "none", border: "none", fontSize: 12, color: "#666", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>cancel</button>
                <button onClick={async () => { setDeleting(true); await onDelete(obs.id); onBack(); }} disabled={deleting} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "var(--color-accent, #FF00AE)", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>{deleting ? "deleting…" : "delete"}</button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, opacity: 0.35, WebkitTapHighlightColor: "transparent" }} title="Delete">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
            )
          )}
        </div>
        <div style={{ marginTop: 60, textAlign: "center" }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>{"\u26A0\uFE0F"}</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#FFF", margin: "0 0 8px" }}>Analysis failed</p>
          <p style={{ fontSize: 14, color: "var(--color-secondary-text, #888)", lineHeight: 1.6, margin: "0 0 28px" }}>
            {obs.error_detail?.includes("PAYWALL")
              ? "This article is paywalled. Paste the text directly instead."
              : obs.error_detail?.includes("529") || obs.error_detail?.includes("overloaded")
              ? "API is temporarily overloaded. Try again in a moment."
              : obs.error_detail?.includes("401") || obs.error_detail?.includes("auth")
              ? "Check that the API key is set correctly."
              : obs.error_detail || "Something went wrong. Try again."}
          </p>
          <button onClick={onBack} style={{ background: "var(--color-card-bg, #FFF)", color: "#12102B", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>
      </div>
    );
  }

  // Share handled by ShareButton component

  return (
    <div style={{ maxWidth: "var(--max-content-width, 480px)", margin: "0 auto", paddingBottom: 80, background: "transparent", minHeight: "100vh" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "var(--color-secondary-text, #888)", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>&lsaquo; Back</button>
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
                  style={{ background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "var(--color-accent, #FF00AE)", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
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
                        <span style={{ fontSize: 13, color: "var(--color-accent, #FF00AE)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{domain}</span>
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


        {/* Score row + Devil's Advocate button */}
        {obs.status === "complete" && obs.score != null && (() => {
          const v = Math.round(obs.score);
          const tier = getScoreTier(v);
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", flex: "1 1 auto", minWidth: 0 }}>
                <ScoreBadge value={obs.score} size={isMobile ? "lg" : "xl"} animate isHotTake={obs.is_hot_take} obsId={obs.id} hideLabel emojiDelay={1000} emojiAnim="detailEmojiPop" emojiDuration="0.9s" emojiEasing="ease-out" skipObserver />
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: isMobile ? 12 : 15, fontWeight: 800, color: obs.is_hot_take ? "#FF00AE" : getScoreColor(v), letterSpacing: -0.3, lineHeight: 1.2, opacity: 0, animation: "scoreLabelFadeIn 0.5s ease-out 1.4s forwards", wordBreak: "break-word" }}>
                    {obs.is_hot_take ? "Hot Take" : tier.label}
                  </span>
                  <button
                    onClick={() => setShowScoreInfo(sv => !sv)}
                    style={{
                      background: showScoreInfo ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "50%", width: 20, height: 20,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", padding: 0, flexShrink: 0,
                      color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 800,
                      WebkitTapHighlightColor: "transparent",
                      opacity: 0, animation: "scoreLabelFadeIn 0.5s ease-out 1.4s forwards",
                    }}
                  >?</button>
                </div>
                {showScoreInfo && (isMobile ? <ScoreInfoSheet onClose={() => setShowScoreInfo(false)} isHotTake={obs.is_hot_take} /> : <ScoreInfoPopover onClose={() => setShowScoreInfo(false)} isHotTake={obs.is_hot_take} />)}
              </div>
              <button
                onClick={() => { setActiveTab("coldshower"); handleCounterpoint(); }}
                style={{
                  background: "transparent",
                  border: "1.5px solid #FF00AE",
                  borderRadius: 8, padding: "8px 12px",
                  cursor: counterpointLoading ? "default" : "pointer", fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 0.15s",
                  animation: counterpointLoading ? "devilBorder 1.2s linear infinite" : undefined,
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!counterpointLoading) e.currentTarget.style.background = "rgba(255,0,174,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                disabled={counterpointLoading}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-accent, #FF00AE)", letterSpacing: -0.2, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>Devil&rsquo;s Advocate</span>
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
                    padding: "12px 14px", fontSize: 20, color: "var(--color-dark-text, #1A1A1A)", fontWeight: 700,
                    lineHeight: 1.4, resize: "none", fontFamily: "inherit",
                    boxSizing: "border-box", outline: "none", letterSpacing: -0.4,
                    overflow: "hidden",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => setEditMode(false)}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 8,
                      border: "1.5px solid rgba(255,255,255,0.15)", background: "transparent",
                      color: "var(--color-secondary-text, #888)", fontSize: 14, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >Cancel</button>
                  <button
                    onClick={handleResubmit}
                    disabled={!editText.trim() || resubmitting}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 8,
                      border: "none", background: editText.trim() && !resubmitting ? "var(--color-accent, #FF00AE)" : "rgba(255,255,255,0.15)",
                      color: "#FFF", fontSize: 14, fontWeight: 700,
                      cursor: editText.trim() && !resubmitting ? "pointer" : "not-allowed",
                      fontFamily: "inherit",
                    }}
                  >{resubmitting ? "Submitting\u2026" : "Resubmit \u2192"}</button>
                </div>
              </div>
            ) : (
              <>
                <h1
                  onClick={isOwner ? () => { setEditMode(true); setEditText(obs.thesis || obs.raw_input || ""); } : undefined}
                  style={{
                    fontSize: "var(--font-size-detail-headline, 20px)", fontWeight: 700, color: "#FFF", lineHeight: 1.4,
                    letterSpacing: -0.4, margin: 0,
                    cursor: isOwner ? "pointer" : "default",
                  }}
                >{obs.thesis}</h1>
                {isOwner && !isProcessing && (
                  <p
                    onClick={() => { setEditMode(true); setEditText(obs.thesis || obs.raw_input || ""); }}
                    style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "6px 0 0", cursor: "pointer", letterSpacing: -0.1 }}
                  >tap to edit</p>
                )}
                {obs.input_type === "url" && obs.raw_input && (() => {
                  let domain = obs.raw_input;
                  try { domain = new URL(obs.raw_input).hostname.replace(/^www\./, ""); } catch {}
                  return (
                    <a href={obs.raw_input} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-block", fontSize: 11, color: "rgba(255,255,255,0.35)", textDecoration: "none", marginTop: 6 }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                    >{domain} ↗</a>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Hot Take content — always visible */}
        {obs.status === "complete" && (steelBottomLine || steelHardFacts.length > 0 || steelBullets.length > 0) && (
          <div ref={steelmanRef}>
            {steelBottomLine && (
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-accent, #FF00AE)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> {config?.ui_copy?.labels?.hot_take_badge || "Hot Take"}</p>
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
              <ProcessingDots color="var(--color-accent, #FF00AE)" /><span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Playing devil&rsquo;s advocate…</span>
            </div>
          );
          if (counterpointError) return (
            <div style={{ background: "rgba(255,0,174,0.1)", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,0,174,0.3)" }}>
              <p style={{ fontSize: 14, color: "var(--color-accent, #FF00AE)", margin: 0, lineHeight: 1.5 }}>Devil&rsquo;s advocate failed. Try again.</p>
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
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-accent, #FF00AE)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> Devil&rsquo;s Advocate</p>
                <p style={{ fontSize: 15, color: "#FFF", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{counterpoint.bottom_line}</p>
              </div>
              {counterpoint.bullets.length > 0 && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 10px" }}>The Case Against</p>
                  {counterpoint.bullets.map((bullet, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                      <span style={{ color: "var(--color-accent, #FF00AE)", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>{"\u2212"}</span>
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
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
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
              <ProcessingDots color="var(--color-accent, #FF00AE)" /><span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Generating PvA take…</span>
            </div>
          );
          if (pvaError) return (
            <div style={{ background: "rgba(255,0,174,0.1)", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,0,174,0.3)" }}>
              <p style={{ fontSize: 14, color: "var(--color-accent, #FF00AE)", margin: 0, lineHeight: 1.5 }}>PvA take failed. Try again.</p>
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
                  <span style={{ color: "var(--color-accent, #FF00AE)", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>{"\u2022"}</span>
                  <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0 }}>{bullet}</p>
                </div>
              ))}
              {take.tldr && take.tldr !== pvaBottomLine && (
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
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
        background: "var(--color-accent, #FF00AE)", flexShrink: 0,
        animation: "redDotPulse 2s ease-in-out infinite",
      }} />
      <style>{`
        @keyframes redDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes devilBorder {
          0%, 100% { box-shadow: 0 0 4px #FF00AE, inset 0 0 4px rgba(255,0,174,0.15); border-color: #FF00AE; }
          50% { box-shadow: 0 0 12px #FF00AE, inset 0 0 8px rgba(255,0,174,0.25); border-color: #FF77D0; }
        }
        @keyframes scoreLabelFadeIn { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
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
          color: copied ? "var(--color-accent, #FF00AE)" : "#FFF", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
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
        color: copied ? "var(--color-accent, #FF00AE)" : "rgba(0,0,0,0.45)", fontSize: 10, fontFamily: "inherit",
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

type View = "home" | "capture" | "output" | "about" | "admin";

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
  const { config } = useInstanceConfig();
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
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(d => { if (d.maintenance) setMaintenance(true); }).catch(() => {});
  }, []);

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
      <div style={{ minHeight: "100dvh", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, position: "relative" }}>
  
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, position: "relative", zIndex: 1 }}>
          <BurstIcon size={130} />
          <span style={{ fontSize: 25, fontWeight: 900, letterSpacing: "var(--letter-spacing-headline, -1.5px)", color: "#FFF", marginTop: -18, fontFamily: "var(--font-display, 'Besley', serif)" }}>
            <span style={{ color: "var(--color-accent, #FF00AE)" }}>hot</span>take
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
        {authError && <p style={{ color: "var(--color-accent, #FF00AE)", fontSize: 13, marginTop: 16, textAlign: "center" }}>{authError}</p>}
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

  if (maintenance) {
    return (
      <div style={{ minHeight: "100dvh", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <p style={{ fontFamily: "var(--font-display, 'Besley', serif)", fontSize: 22, fontWeight: 400, color: "#FFF", textAlign: "center", lineHeight: 1.4, letterSpacing: -0.5, margin: 0, whiteSpace: "pre-line" }}>
          {config?.ui_copy?.labels?.empty_state || "Hot Take is getting hotter.\nCome back later."}
        </p>
      </div>
    );
  }

  if (view === "about") {
    return <AboutView onBack={() => setView("home")} />;
  }

  if (view === "admin") {
    return <AdminPanel onClose={() => setView("home")} />;
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
      onOpenAdmin={() => setView("admin")}
      onRefresh={fetchObservations}
    />
  );
}
