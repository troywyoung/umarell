import { useState, useEffect, useRef } from "react";
import type { Observation } from "./types";
import { useObservations } from "./hooks/useObservations";

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

function SteelManIcon({ size = 24, animate = false, animateCount }: { size?: number; animate?: boolean; animateCount?: number }) {
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
            stroke="#1A1A1A"
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
          fill="#1A1A1A"
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

function EvidenceBadge({ value }: { value?: string }) {
  if (!value) return null;
  const c = EVIDENCE_COLORS[value] || { bg: "#F0F0ED", color: "#666" };
  return (
    <span style={{
      display: "inline-block",
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700,
      padding: "3px 10px", borderRadius: 100, letterSpacing: 0.3,
    }}>
      {value}
    </span>
  );
}

function ScoreBadge({ value }: { value?: number }) {
  if (value == null) return null;
  const color = value >= 70 ? "#2E7D32" : value >= 40 ? "#E65100" : "#6A1B9A";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700, color,
    }}>
      <span style={{ fontSize: 10, opacity: 0.7 }}>Evidence</span>
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

function HomeView({ observations, loading, onCapture, onSelect, onDelete }: {
  observations: Observation[];
  loading: boolean;
  onCapture: () => void;
  onSelect: (o: Observation) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 120 }}>
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: "1px solid #EBEBEB",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", letterSpacing: -0.4, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <SteelManIcon size={28} animate animateCount={3} /> Steel Man
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {loading && <span style={{ fontSize: 12, color: "#B0B0A8" }}>Refreshing…</span>}
          <button
            onClick={onCapture}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#E53935", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "#fff", lineHeight: 1, padding: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >+</button>
        </div>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        {observations.length === 0 && !loading ? (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1A1A1A", marginBottom: 8 }}>Nothing yet.</p>
            <p style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>
              Tap + to drop your first steel man.
            </p>
          </div>
        ) : (
          observations.map((obs) => {
            const steelBullets = (obs.summary || "").split(/\n+/).map(l => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);
            const firstBullet = steelBullets[0] || "";
            return (
              <div
                key={obs.id}
                onClick={() => onSelect(obs)}
                style={{
                  background: "#FFF", borderRadius: 14, padding: "14px 16px",
                  marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  cursor: "pointer", position: "relative",
                  display: "flex", alignItems: "flex-start", gap: 12,
                }}
              >
                {/* Image on the left if present */}
                {obs.image_data && (
                  <img
                    src={`data:${obs.image_media_type || "image/jpeg"};base64,${obs.image_data}`}
                    alt=""
                    style={{
                      width: 72, height: 72, borderRadius: 10,
                      objectFit: "cover", flexShrink: 0,
                    }}
                  />
                )}

                <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
                  {/* Headline: thesis truncated to 1 line */}
                  <p style={{
                    fontSize: 15, fontWeight: 600, color: "#1A1A1A",
                    lineHeight: 1.4, margin: "0 0 4px", letterSpacing: -0.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {obs.thesis || obs.raw_input}
                  </p>

                  {/* First steel man bullet as secondary text */}
                  {firstBullet && (
                    <p style={{
                      fontSize: 13, color: "#888", lineHeight: 1.45,
                      margin: "0 0 6px",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    } as React.CSSProperties}>
                      {firstBullet}
                    </p>
                  )}

                  {(obs.status === "formatting" || obs.status === "researching") && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <SteelManIcon size={16} animate />
                      <span style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>
                        {obs.status === "formatting" ? "Formatting\u2026" : "Researching\u2026"}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#B0B0A8" }}>{timeAgo(obs.created_at)}</span>
                    <EvidenceBadge value={obs.evidence_type} />
                    {obs.tags?.map((tag) => (
                      <span key={tag} style={{ fontSize: 11, color: "#888", background: "#F0F0ED", borderRadius: 100, padding: "2px 8px" }}>{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Share — bottom right */}
                {obs.status === "complete" && obs.thesis && (
                  <div style={{ position: "absolute", bottom: 12, right: 12 }}>
                    <ShareButton obsId={obs.id} onClick={(e) => e.stopPropagation()} />
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this steel man?")) onDelete(obs.id);
                  }}
                  style={{
                    position: "absolute", top: 12, right: 12,
                    background: "none", border: "none", cursor: "pointer",
                    color: "#CCC", fontSize: 18, padding: 4, lineHeight: 1,
                  }}
                >&times;</button>
              </div>
            );
          })
        )}
      </div>

      {/* Idea Button */}
      <button
        onClick={onCapture}
        style={{
          position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)",
          width: 68, height: 68, borderRadius: "50%",
          background: "#E53935", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(229,57,53,0.35)",
          fontSize: 32, color: "#fff", lineHeight: "1",
          WebkitTapHighlightColor: "transparent",
        }}
      >+</button>
    </div>
  );
}

// ─── Capture ──────────────────────────────────────────────────────────────

function CaptureView({ onSubmit, onSubmitImage, onBack }: {
  onSubmit: (text: string) => Promise<void>;
  onSubmitImage: (b64: string, mediaType: string, context?: string) => Promise<void>;
  onBack: () => void;
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
        What's your take?
      </h1>
      <p style={{ fontSize: 14, color: "#888", margin: "0 0 24px", lineHeight: 1.5 }}>
        Drop a hot take. We'll build the strongest case for it.
      </p>

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
            fontSize: 14, color: "#1A1A1A", fontFamily: "inherit",
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

      {/* Action buttons row: mic + photo */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
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
          <span style={{ fontSize: 18 }}>{"\uD83D\uDCF7"}</span>
          Photo
        </button>
      </div>

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

function OutputView({ obs: initialObs, onBack, onResubmit, pollObservation, requestStressTest }: {
  obs: Observation;
  onBack: () => void;
  onResubmit: (text: string) => Promise<void>;
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setObs(initialObs);
    setTab("steel");
    setEditMode(false);
    setStressLoading(false);
    setStressError(false);
  }, [initialObs.id]);

  useEffect(() => {
    if (obs.status === "complete" || obs.status === "error") return;
    pollRef.current = setInterval(async () => {
      const updated = await pollObservation(obs.id);
      if (updated) {
        setObs(updated);
        if (updated.status === "complete" || updated.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
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
      setObs((p) => ({ ...p, stress_test: result }));
    } else {
      setStressError(true);
    }
  };

  const handleResubmit = async () => {
    if (!editText.trim() || resubmitting) return;
    setResubmitting(true);
    try {
      await onResubmit(editText.trim());
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
            {obs.error_detail?.includes("529") || obs.error_detail?.includes("overloaded")
              ? "Claude API is temporarily overloaded. Try again in a moment."
              : obs.error_detail?.includes("401") || obs.error_detail?.includes("auth")
              ? "Check that ANTHROPIC_API_KEY is set correctly."
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
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", borderBottom: "1px solid #EBEBEB" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>&lsaquo; Back</button>
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
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "30px 0 28px" }}>
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
            <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 8px" }}>Thesis</p>
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
            <EvidenceBadge value={obs.evidence_type} />
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
                background: tab === "stress" ? "#1A1A1A" : "#EFEFED",
                color: tab === "stress" ? "#FFF" : "#666",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {stressLoading && tab === "stress" ? (
                <><ProcessingDots /><span>Testing…</span></>
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
          if (stressLoading) return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 0" }}>
              <SteelManIcon size={56} animate />
              <p style={{ fontSize: 14, color: "#888", marginTop: 14 }}>Stress testing…</p>
            </div>
          );
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
              <div style={{ background: "#F5F5F2", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><PulsingDot /> Verdict</p>
                <p style={{ fontSize: 15, color: "#1A1A1A", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{verdict}</p>
              </div>
            </div>
          );
        })()}

      </div>
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
        color: copied ? "#E53935" : "#666", fontSize: 12, fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        transition: "color 0.2s",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

function ProcessingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: "50%", background: "#6666CC",
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

export default function App() {
  const { observations, loading, fetchObservations, submitObservation, pollObservation, requestStressTest, deleteObservation } = useObservations();
  const [view, setView] = useState<View>("home");
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);

  useEffect(() => {
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
  }, []);

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

  const navigateTo = (nextView: View, obs?: Observation) => {
    const url = nextView === "output" && obs ? `#obs/${obs.id}` : window.location.pathname;
    window.history.pushState({ view: nextView }, "", url);
    if (obs) setSelectedObs(obs);
    setView(nextView);
  };

  const handleSubmit = async (text: string) => {
    const obs = await submitObservation(text, text.startsWith("http") ? "url" : "text");
    navigateTo("output", obs);
  };

  const handleSubmitImage = async (b64: string, mediaType: string, context?: string) => {
    const obs = await submitObservation(context || "image", "screenshot", b64, mediaType);
    navigateTo("output", obs);
  };

  const handleResubmit = async (text: string) => {
    const obs = await submitObservation(text, "text");
    setSelectedObs(obs);
    // view stays on "output"
  };

  if (view === "capture") {
    return (
      <CaptureView
        onSubmit={handleSubmit}
        onSubmitImage={handleSubmitImage}
        onBack={() => setView("home")}
      />
    );
  }

  if (view === "output" && selectedObs) {
    return (
      <OutputView
        obs={selectedObs}
        onBack={() => { setView("home"); fetchObservations(); }}
        onResubmit={handleResubmit}
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
    />
  );
}
