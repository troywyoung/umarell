import { useState, useEffect, useRef } from "react";
import { GoogleLogin } from "@react-oauth/google";
import type { Observation } from "./types";
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

// ─── Steel Man Icon (SVG) — geometric wireframe mesh ─────────────────────

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

function SteelManIcon({ size = 24, animate = false, animateCount, color = "#1A1A1A" }: { size?: number; animate?: boolean; animateCount?: number; color?: string }) {
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
            fill="#E53935"
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

function ScoreBadge({ value }: { value?: number }) {
  if (value == null) return null;
  const color = value >= 70 ? "#2E7D32" : value >= 40 ? "#E65100" : "#6A1B9A";
  const bg = value >= 70 ? "#E8F5E9" : value >= 40 ? "#FFF3E0" : "#F3E5F5";
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, letterSpacing: -0.3,
      background: bg, borderRadius: 100, padding: "3px 9px",
    }}>
      {value}/100
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Home ─────────────────────────────────────────────────────────────────

function HomeView({ observations, loading, onCapture, onSelect, onDelete, authUser, onSignOut }: {
  observations: Observation[];
  loading: boolean;
  onCapture: () => void;
  onSelect: (o: Observation) => void;
  onDelete: (id: string) => void;
  authUser: { id: string; name: string; avatar: string | null };
  onSignOut: () => void;
}) {
  const [bgImage, setBgImage] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const page = Math.floor(Math.random() * 100) + 1;
    fetch(`https://api.pexels.com/v1/search?query=${["animals","people+wonderment","people+confusion","people+ecstasy","factories","war"][Math.floor(Math.random()*6)]}&per_page=1&page=${page}&orientation=landscape`, {
      headers: { Authorization: "8PIku3G38amYoSKnhCyaA0o5p40er0GSxHM56s8Rvw5dcHrgiQ0n2qwe" },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const url = data.photos?.[0]?.src?.landscape;
        if (url) {
          const img = new Image();
          img.src = url;
          img.onload = () => {
            if (cancelled) return;
            setBgImage(url);
          };
          img.onerror = () => {};
        } else {
          // no image, nothing to do
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 120, minHeight: "100vh", position: "relative" }}>
      {bgImage && (
        <>
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover", backgroundPosition: "center center",
            zIndex: 0, pointerEvents: "none",
          }} />
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, height: 80,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
            zIndex: 0, pointerEvents: "none",
          }} />
        </>
      )}
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: "1px solid #EBEBEB",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 1,
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: bgImage ? "#FFF" : "#1A1A1A", letterSpacing: -0.4, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <SteelManIcon size={28} animate animateCount={3} color={bgImage ? "#FFF" : "#1A1A1A"} /> Steel Man
          </span>
          <span style={{ fontSize: 10, color: bgImage ? "rgba(255,255,255,0.7)" : "#999", marginLeft: 36, marginTop: 2, letterSpacing: -0.4 }}>
            Tap <strong>+</strong> to drop your first steel man
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {loading && <span style={{ fontSize: 12, color: "#B0B0A8" }}>Refreshing…</span>}
          <button
            onClick={onCapture}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#E53935", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1, padding: "0 0 1px 0",
              WebkitTapHighlightColor: "transparent",
            }}
          >+</button>
          {authUser.avatar
            ? <img src={authUser.avatar} onClick={onSignOut} title={`Signed in as ${authUser.name} — tap to sign out`} style={{ width: 30, height: 30, borderRadius: "50%", cursor: "pointer", border: "2px solid rgba(255,255,255,0.4)" }} />
            : <button onClick={onSignOut} style={{ fontSize: 11, color: bgImage ? "rgba(255,255,255,0.6)" : "#AAA", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
          }
        </div>
      </div>

      <div style={{ padding: "12px 16px 0", position: "relative", zIndex: 1 }}>
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

          const renderCard = (obs: Observation) => {
            const steelBullets = (obs.summary || "").split(/\n+/).map((l: string) => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);
            const firstBullet = steelBullets[0] || "";
            return (
              <div
                key={obs.id}
                onClick={() => onSelect(obs)}
                style={{
                  borderRadius: 10,
                  background: "#FFF",
                  border: "none",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  cursor: "pointer", overflow: "hidden",
                }}
              >
                {obs.user_name && (
                  <p style={{ fontSize: 9, fontWeight: 600, color: "#999", margin: 0, padding: "8px 12px 0", letterSpacing: -0.2, lineHeight: 1 }}>{obs.user_name}</p>
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: obs.user_name ? "4px 12px 6px 12px" : "10px 12px 6px 12px" }}>
                  {obs.image_data && (
                    <img
                      src={`data:${obs.image_media_type || "image/jpeg"};base64,${obs.image_data}`}
                      style={{ width: 65, height: 65, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                    />
                  )}
                  <p style={{
                    fontSize: 12, fontWeight: 700,
                    color: "#1A1A1A", lineHeight: 1.4, margin: 0, letterSpacing: -0.3, flex: 1,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
                  }}>
                    {obs.thesis || obs.raw_input}
                  </p>
                  {obs.score != null && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, flexShrink: 0,
                      background: obs.score >= 70 ? "#E8F5E9" : obs.score >= 40 ? "#FFF3E0" : "#F3E5F5",
                      color: obs.score >= 70 ? "#2E7D32" : obs.score >= 40 ? "#E65100" : "#6A1B9A",
                      padding: "2px 6px", borderRadius: 4, letterSpacing: 0.2,
                    }}>
                      {Math.round(obs.score)}
                    </span>
                  )}
                  {(!obs.user_id || obs.user_id === authUser.id) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm("Delete this steel man?")) onDelete(obs.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#CCC", fontSize: 13, padding: "0 0 0 2px", lineHeight: 1, flexShrink: 0 }}
                    >&times;</button>
                  )}
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
                  display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
                  padding: "6px 12px 10px",
                  borderTop: "1px solid #F5F5F2",
                }}>
                  <span style={{ fontSize: 8, fontWeight: 600, color: "#B0B0A8", letterSpacing: 0.2 }}>{timeAgo(obs.created_at)}</span>
                  <EvidenceBadge value={obs.evidence_type} />
                  {obs.tags?.map((tag: string) => (
                    <span key={tag} style={{ fontSize: 8, color: "#888", background: "#F0F0ED", borderRadius: 100, padding: "1px 6px" }}>{tag}</span>
                  ))}
                  {obs.status === "complete" && obs.thesis && (
                    <span style={{ marginLeft: "auto" }}>
                      <ShareButton obsId={obs.id} onClick={(e) => e.stopPropagation()} />
                    </span>
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
              }}
            >
              <p style={{ fontSize: 11, color: "#1A1A1A", fontWeight: 600, margin: 0, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                <span style={{ fontWeight: 800, color: "#2C5ABA" }}>Challenge: </span>{c.thesis || c.raw_input}
              </p>
            </div>
          );

          return topLevel.map(obs => {
            const children = (challengeMap.get(obs.id) || [])
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return (
              <div key={obs.id} style={{ marginBottom: 10 }}>
                {renderCard(obs)}
                {children.map(c => (
                  <div key={c.id} style={{ marginTop: 4 }}>
                    {renderChallenge(c)}
                  </div>
                ))}
              </div>
            );
          });
        })()}
      </div>

      {/* Idea Button */}
      <button
        onClick={onCapture}
        style={{
          position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)",
          width: 68, height: 68, borderRadius: "50%",
          background: "#E53935", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 12px rgba(229,57,53,0.4)", zIndex: 2,
          fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1, paddingBottom: 2,
          WebkitTapHighlightColor: "transparent",
          animation: "fabPulse 2s ease-in-out infinite",
        }}
      >+
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
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          Cancel
        </button>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1A1A1A", letterSpacing: -0.5, margin: "0 0 6px" }}>
        {parentObs ? "What's your counter?" : "What's your take?"}
      </h1>
      <p style={{ fontSize: 14, color: "#888", margin: "0 0 24px", lineHeight: 1.5 }}>
        {parentObs ? "Drop your counter-argument. We'll steel man it." : "Drop a hot take. We'll build the strongest case for it."}
      </p>
      {parentObs && (
        <div style={{ background: "#F8F8F6", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#B0B0A8", letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 6px" }}>ORIGINAL STEEL MAN</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px", lineHeight: 1.4 }}>{parentObs.thesis || parentObs.raw_input}</p>
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
      <div style={{
        background: "#FFF", borderRadius: 12, padding: "10px 14px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 8,
        border: url.trim() ? "1.5px solid #E53935" : "1.5px solid transparent",
        transition: "border-color 0.2s",
      }}>
        <span style={{ fontSize: 16, flexShrink: 0, opacity: 0.5 }}>{"\uD83D\uDD17"}</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Submit a link instead"
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
            background: listening ? "#1A1A1A" : "#F0F0ED",
            color: listening ? "#FFF" : "#555",
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
            background: "#F0F0ED", color: "#555",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{ fontSize: 18 }}>🖼️</span>
          Screenshot
        </button>
      </div>
      <p style={{ fontSize: 11, color: "#B0B0A8", textAlign: "center", margin: "0 0 14px", letterSpacing: 0.1 }}>
        Screenshot a headline, tweet, chart, or stat
      </p>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: "100%",
          background: canSubmit ? "#E53935" : "#D5D5CD",
          color: "#FFF", border: "none", borderRadius: 14,
          padding: "16px 0", fontSize: 16, fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed",
          letterSpacing: -0.2, fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {submitting ? "Submitting\u2026" : canSubmit ? "Steel man this \u2192" : "Type your take above"}
      </button>

      {error && (
        <div style={{ marginTop: 12, background: "#FFF0EE", borderRadius: 10, padding: "12px 14px", border: "1px solid #F5C6C0" }}>
          <p style={{ fontSize: 13, color: "#C0392B", margin: 0, lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Output ───────────────────────────────────────────────────────────────

function OutputView({ obs: initialObs, onBack, onResubmit, onChallenge, pollObservation, requestStressTest }: {
  obs: Observation;
  onBack: () => void;
  onResubmit: (text: string, imageData?: string, imageMediaType?: string) => Promise<void>;
  onChallenge: (obs: Observation) => void;
  pollObservation: (id: string) => Promise<Observation | null>;
  requestStressTest: (id: string) => Promise<import("./types").StressTest | null>;
}) {
  const [obs, setObs] = useState(initialObs);
  const [tab, setTab] = useState<"steel" | "stress">("steel");
  const [stressLoading, setStressLoading] = useState(false);
  const [stressError, setStressError] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [, setCounterThesis] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Observation[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveNullsRef = useRef(0);

  useEffect(() => {
    setObs(initialObs);
    setTab("steel");
    setEditMode(false);
    setStressLoading(false);
    setStressError(false);
    setCounterThesis(null);
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

  const handleStressTab = async () => {
    setTab("stress");
    if (obs.stress_test?.verdict) return;
    setStressError(false);
    setStressLoading(true);
    const result = await requestStressTest(obs.id);
    setStressLoading(false);
    if (result) {
      // Re-fetch observation to get updated sources from stress test
      const updated = await pollObservation(obs.id);
      if (updated) {
        setObs(updated);
      } else {
        setObs((p) => ({ ...p, stress_test: result }));
      }
    } else {
      setStressError(true);
    }
  };

  const handleResubmit = async () => {
    if (!editText.trim() || resubmitting) return;
    setResubmitting(true);
    try {
      await onResubmit(editText.trim(), obs.image_data, obs.image_media_type);
    } catch {
      setResubmitting(false);
    }
  };

  const isProcessing = obs.status === "formatting" || obs.status === "researching";
  const isImage = obs.input_type === "screenshot" || obs.input_type === "photo";
  const steelBullets = (obs.summary || "").split(/\n+/).map(l => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);

  if (obs.status === "error") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ padding: "14px 0" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>&lsaquo; Back</button>
        </div>
        <div style={{ marginTop: 60, textAlign: "center" }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>{"\u26A0\uFE0F"}</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px" }}>Analysis failed</p>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, margin: "0 0 28px" }}>
            {obs.error_detail?.includes("PAYWALL")
              ? "This article is paywalled. Paste the text directly instead."
              : obs.error_detail?.includes("529") || obs.error_detail?.includes("overloaded")
              ? "API is temporarily overloaded. Try again in a moment."
              : obs.error_detail?.includes("401") || obs.error_detail?.includes("auth")
              ? "Check that the API key is set correctly."
              : obs.error_detail || "Something went wrong. Try again."}
          </p>
          <button onClick={onBack} style={{ background: "#1A1A1A", color: "#FFF", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>
      </div>
    );
  }

  // Share handled by ShareButton component

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EBEBEB" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>&lsaquo; Back</button>
        {obs.user_name && <span style={{ fontSize: 12, fontWeight: 600, color: "#AAA" }}>{obs.user_name}</span>}
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
              <div style={{ background: "#F7F7F5", borderRadius: 12, padding: "14px 16px", marginBottom: 16, width: "100%", boxSizing: "border-box", overflow: "hidden" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> Your observation</p>
                <p style={{ fontSize: 15, color: "#3A3A38", lineHeight: 1.65, margin: 0, wordBreak: "break-all", overflowWrap: "anywhere" }}>{obs.raw_input}</p>
              </div>
            )}

            {/* Step progress — animated mesh builds itself */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "30px 0 28px" }}>
              <SteelManIcon size={49} animate />
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", margin: "0 0 4px" }}>
                  {obs.status === "formatting" ? "Reading your take\u2026" : "Building steel man\u2026"}
                </p>
                <p style={{ fontSize: 13, color: "#999", margin: 0 }}>This usually takes a few seconds</p>
              </div>
            </div>
          </>
        )}

        {/* Thesis (shown once complete) — click to edit */}
        {obs.status === "complete" && obs.thesis && obs.thesis !== "image" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 8px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>Thesis</p>
              {!obs.parent_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); onChallenge(obs); }}
                  style={{
                    background: "none", border: "1px solid #E53935", borderRadius: 6,
                    padding: "3px 10px", cursor: "pointer",
                    fontSize: 10, fontWeight: 600, color: "#E53935", fontFamily: "inherit",
                    letterSpacing: 0.2, WebkitTapHighlightColor: "transparent",
                  }}
                >Challenge this</button>
              )}
            </div>
            {editMode ? (
              <div>
                <textarea
                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                  value={editText}
                  onChange={(e) => { setEditText(e.target.value); const t = e.target; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                  autoFocus
                  style={{
                    width: "100%", border: "1.5px solid #D5D5CD", borderRadius: 12,
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
                      border: "1.5px solid #D5D5CD", background: "transparent",
                      color: "#888", fontSize: 14, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >Cancel</button>
                  <button
                    onClick={handleResubmit}
                    disabled={!editText.trim() || resubmitting}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 10,
                      border: "none", background: editText.trim() && !resubmitting ? "#E53935" : "#D5D5CD",
                      color: "#FFF", fontSize: 14, fontWeight: 700,
                      cursor: editText.trim() && !resubmitting ? "pointer" : "not-allowed",
                      fontFamily: "inherit",
                    }}
                  >{resubmitting ? "Submitting\u2026" : "Resubmit \u2192"}</button>
                </div>
              </div>
            ) : (
              <h1
                onClick={() => { setEditMode(true); setEditText(obs.thesis || obs.raw_input || ""); }}
                style={{
                  fontSize: 20, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.4,
                  letterSpacing: -0.4, margin: 0, cursor: "pointer",
                  borderBottom: "1px dashed #D5D5CD", paddingBottom: 4,
                }}
                title="Tap to edit & resubmit"
              >{obs.thesis}</h1>
            )}
          </div>
        )}

        {/* Share (shown when complete) */}
        {obs.status === "complete" && steelBullets.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <ShareButton obsId={obs.id} />
          </div>
        )}

        {/* Metadata row: evidence type, score, tags */}
        {obs.status === "complete" && (obs.evidence_type || obs.score != null || obs.tags?.length) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 20 }}>
            <EvidenceBadge value={obs.evidence_type} size="lg" />
            <ScoreBadge value={obs.score} />
            {obs.tags?.map((tag) => (
              <span key={tag} style={{ fontSize: 11, color: "#888", background: "#F0F0ED", borderRadius: 100, padding: "3px 9px", fontWeight: 600 }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Tab buttons */}
        {obs.status === "complete" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button
              onClick={() => setTab("steel")}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                background: tab === "steel" ? "#1A1A1A" : "#EFEFED",
                color: tab === "steel" ? "#FFF" : "#666",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
              }}
            >Steel Man</button>
            <button
              onClick={handleStressTab}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                background: tab === "stress" ? "#E53935" : "#EFEFED",
                color: tab === "stress" ? "#FFF" : "#666",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {stressLoading && tab === "stress" ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ProcessingDots color="#FFF" /><span>Testing…</span></span>
              ) : "Stress Test"}
            </button>
          </div>
        )}

        {/* Steel Man content + Edit & Resubmit */}
        {obs.status === "complete" && tab === "steel" && (
          <>
            {steelBullets.map((bullet, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                <span style={{ color: "#1A1A1A", fontWeight: 700, fontSize: 18, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{"\u2022"}</span>
                <p style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.65, margin: 0 }}>{bullet}</p>
              </div>
            ))}

            {/* Sources */}
            {obs.sources && obs.sources.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #EBEBEB" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#B0B0A8", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 8px" }}>Sources</p>
                {obs.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block", fontSize: 12, color: "#777", lineHeight: 1.5,
                      textDecoration: "none", marginBottom: 4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#E53935")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#777")}
                  >
                    {src.title || src.url}
                  </a>
                ))}
              </div>
            )}

          </>
        )}

        {/* Stress Test content */}
        {tab === "stress" && (() => {
          if (stressLoading) return null;
          if (stressError) return (
            <div style={{ background: "#FFF0EE", borderRadius: 12, padding: "14px 16px", border: "1px solid #F5C6C0" }}>
              <p style={{ fontSize: 14, color: "#C0392B", margin: 0, lineHeight: 1.5 }}>
                Stress test failed. Tap the button to try again.
              </p>
            </div>
          );
          const st = obs.stress_test as any;
          if (!st?.verdict) return null;
          const pros: string[] = Array.isArray(st.pros) ? st.pros : [];
          const cons: string[] = Array.isArray(st.cons) ? st.cons : [];
          const verdict: string = typeof st.verdict === "string" ? st.verdict : JSON.stringify(st.verdict);
          return (
            <div>
              <div style={{ background: "#F5F5F2", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> Verdict</p>
                <p style={{ fontSize: 15, color: "#1A1A1A", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{verdict}</p>
              </div>
              {pros.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#2E7D32", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 10px" }}>Strengths</p>
                  {pros.map((pro, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                      <span style={{ color: "#2E7D32", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>+</span>
                      <p style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.65, margin: 0 }}>{typeof pro === "string" ? pro : JSON.stringify(pro)}</p>
                    </div>
                  ))}
                </div>
              )}
              {cons.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#C0392B", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 10px" }}>Weaknesses</p>
                  {cons.map((con, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                      <span style={{ color: "#C0392B", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>{"\u2212"}</span>
                      <p style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.65, margin: 0 }}>{typeof con === "string" ? con : JSON.stringify(con)}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* Sources (from both steel man and stress test) */}
              {obs.sources && obs.sources.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #EBEBEB" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#B0B0A8", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 8px" }}>Sources</p>
                  {obs.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block", fontSize: 12, color: "#777", lineHeight: 1.5,
                        textDecoration: "none", marginBottom: 4,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#E53935")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#777")}
                    >
                      {src.title || src.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })()}


        {/* Challenges */}
        {challenges.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#B0B0A8", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 12px" }}>Challenges ({challenges.length})</p>
            {challenges.map(c => (
              <div key={c.id} style={{ background: "#F8F8F6", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A", margin: "0 0 4px", lineHeight: 1.4 }}>{c.thesis || c.raw_input}</p>
                {c.score != null && <span style={{ fontSize: 10, color: "#888" }}>Score: {Math.round(c.score)}</span>}
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

function PulsingDot() {
  return (
    <>
      <span style={{
        display: "inline-block", width: 7, height: 7, borderRadius: "50%",
        background: "#E53935", flexShrink: 0,
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

function ShareButton({ obsId, onClick }: { obsId: string; onClick?: (e: React.MouseEvent) => void }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}#obs/${obsId}`;
  const shareText = "Someone shared a Steel Man with you. Check it out:";
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

  return (
    <button
      onClick={handleShare}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "none", border: "none", cursor: "pointer", padding: 0,
        color: copied ? "#E53935" : "#666", fontSize: 10, fontFamily: "inherit",
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

type View = "home" | "capture" | "output";

interface AuthUser { id: string; name: string; avatar: string | null; }

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("sm_user") || "null"); } catch { return null; }
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const { observations, loading, fetchObservations, submitObservation, pollObservation, requestStressTest, deleteObservation } = useObservations();
  const [view, setView] = useState<View>("home");
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
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
      fetchObservations();
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Show login screen if not authenticated
  if (!authUser) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0F0F0F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ marginBottom: 32 }}>
          <SteelManIcon size={48} animate color="#FFF" />
        </div>
        <h1 style={{ color: "#FFF", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, margin: "0 0 16px", textAlign: "center" }}>Steel Man</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 20px", textAlign: "center", lineHeight: 1.7, maxWidth: 300, letterSpacing: -0.1 }}>
          To steel man is to take any argument and make the strongest possible case for it.
        </p>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 40px", textAlign: "center", lineHeight: 1.7, maxWidth: 300, letterSpacing: -0.1 }}>
          Drop any claim. We research it and build the strongest case. Then stress test it. Challenge others. See what holds up.
        </p>
        {authLoading
          ? <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Signing in…</p>
          : <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setAuthError("Google sign-in failed")} theme="filled_black" shape="rectangular" text="continue_with" size="large" />
        }
        {authError && <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 16, textAlign: "center" }}>{authError}</p>}
      </div>
    );
  }

  const navigateTo = (nextView: View, obs?: Observation) => {
    const url = nextView === "output" && obs ? `#obs/${obs.id}` : window.location.pathname;
    window.history.pushState({ view: nextView }, "", url);
    if (obs) setSelectedObs(obs);
    setView(nextView);
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

  const handleResubmit = async (text: string, imageData?: string, imageMediaType?: string) => {
    const inputType = imageData ? "screenshot" : (text.startsWith("http") ? "url" : "text");
    const obs = await submitObservation(text, inputType, imageData, imageMediaType);
    setSelectedObs(obs);
    // view stays on "output"
  };

  if (view === "capture") {
    return (
      <CaptureView
        onSubmit={handleSubmit}
        onSubmitImage={handleSubmitImage}
        onBack={() => {
          setChallengingObs(null);
          setView("home");
          window.history.replaceState(null, "", window.location.pathname);
        }}
        parentObs={challengingObs}
      />
    );
  }

  if (view === "output" && selectedObs) {
    return (
      <OutputView
        obs={selectedObs}
        onBack={() => { setView("home"); window.history.replaceState(null, "", window.location.pathname); fetchObservations(); }}
        onResubmit={handleResubmit}
        onChallenge={handleChallenge}
        pollObservation={pollObservation}
        requestStressTest={requestStressTest}
      />
    );
  }

  return (
    <HomeView
      observations={observations}
      loading={loading}
      onCapture={() => navigateTo("capture")}
      onSelect={(o) => navigateTo("output", o)}
      onDelete={deleteObservation}
      authUser={authUser}
      onSignOut={handleSignOut}
    />
  );
}
