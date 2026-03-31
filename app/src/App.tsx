import { useState, useEffect, useRef } from "react";
import type { Observation } from "./types";
import { useObservations } from "./hooks/useObservations";

// ─── Rotating placeholder text ───────────────────────────────────────────

const PLACEHOLDERS = [
  "Give me your steel man\u2026",
  "Give me your steel woman\u2026",
  "Give me your steel baby\u2026",
  "Give me your steel dog\u2026",
  "Give me your steel grandma\u2026",
  "Give me your steel intern\u2026",
  "Give me your steel villain\u2026",
  "Give me your steel alien\u2026",
  "Give me your steel robot\u2026",
  "Give me your steel toddler\u2026",
  "Give me your steel professor\u2026",
  "Give me your steel pirate\u2026",
];

function getRandomPlaceholder() {
  return PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];
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
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", letterSpacing: -0.4 }}>
          Steel Man
        </span>
        {loading && <span style={{ fontSize: 12, color: "#B0B0A8" }}>Refreshing\u2026</span>}
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
                    <p style={{ fontSize: 12, color: "#999", margin: "0 0 6px", fontStyle: "italic" }}>
                      {obs.status === "formatting" ? "Formatting\u2026" : "Researching\u2026"}
                    </p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#B0B0A8" }}>{timeAgo(obs.created_at)}</span>
                    <EvidenceBadge value={obs.evidence_type} />
                    {obs.tags?.map((tag) => (
                      <span key={tag} style={{ fontSize: 11, color: "#888", background: "#F0F0ED", borderRadius: 100, padding: "2px 8px" }}>{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Thumbnail if image exists */}
                {obs.image_data && (
                  <img
                    src={`data:${obs.image_media_type || "image/jpeg"};base64,${obs.image_data}`}
                    alt=""
                    style={{
                      width: 48, height: 48, borderRadius: 8,
                      objectFit: "cover", flexShrink: 0,
                    }}
                  />
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
          background: "#1A1A1A", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
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
      } else if (text.trim()) {
        await onSubmit(text.trim());
      }
    } catch (e: any) {
      setError(e?.message || "Failed to connect to API.");
      setSubmitting(false);
    }
  };

  const canSubmit = (!!imageMeta || !!text.trim()) && !submitting;

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
            <span style={{ fontSize: 12, color: "#6666CC", fontWeight: 600 }}>Listening\u2026</span>
          </div>
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
          background: canSubmit ? "#1A1A1A" : "#D5D5CD",
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
            Something went wrong. Check that ANTHROPIC_API_KEY is set in your Railway API service.
          </p>
          <button onClick={onBack} style={{ background: "#1A1A1A", color: "#FFF", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>
      </div>
    );
  }

  // Build share text
  const shareText = `Steel Man: ${obs.thesis}\n\n${steelBullets.map(b => '\u2022 ' + b).join('\n')}`;
  const encodedShareText = encodeURIComponent(shareText);

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
              style={{ width: "100%", borderRadius: 14, maxHeight: 240, objectFit: "cover" }}
            />
          </div>
        )}

        {/* While processing: show full original input + step progress */}
        {isProcessing && (
          <>
            {/* Original observation */}
            {!isImage && obs.raw_input && obs.raw_input !== "image" && (
              <div style={{ background: "#F7F7F5", borderRadius: 12, padding: "14px 16px", marginBottom: 16, borderLeft: "3px solid #D0D0C8" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px" }}>Your observation</p>
                <p style={{ fontSize: 15, color: "#3A3A38", lineHeight: 1.65, margin: 0 }}>{obs.raw_input}</p>
              </div>
            )}

            {/* Step progress */}
            <div style={{ marginBottom: 24 }}>
              <StepRow label="Reading observation" done={obs.status !== "formatting"} active={obs.status === "formatting"} />
              <StepRow label="Forming thesis" done={obs.status === "researching" || obs.status === "complete"} active={obs.status === "formatting"} />
              <StepRow label="Building steel man" done={obs.status === "complete"} active={obs.status === "researching"} />
            </div>
          </>
        )}

        {/* Thesis (shown once complete) */}
        {obs.status === "complete" && obs.thesis && obs.thesis !== "image" && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 8px" }}>Thesis</p>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.4, letterSpacing: -0.4, margin: 0 }}>{obs.thesis}</h1>
          </div>
        )}

        {/* Share buttons (shown when complete) */}
        {obs.status === "complete" && steelBullets.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <a
              href={`https://wa.me/?text=${encodedShareText}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "#E8F5E9", color: "#2E7D32", border: "none",
                borderRadius: 100, padding: "6px 14px",
                fontSize: 12, fontWeight: 600, textDecoration: "none",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {"\uD83D\uDCAC"} WhatsApp
            </a>
            <a
              href={`sms:?body=${encodedShareText}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "#E3F2FD", color: "#1565C0", border: "none",
                borderRadius: 100, padding: "6px 14px",
                fontSize: 12, fontWeight: 600, textDecoration: "none",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {"\uD83D\uDCF1"} SMS
            </a>
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
                <><ProcessingDots /><span>Testing\u2026</span></>
              ) : "Stress Test"}
            </button>
          </div>
        )}

        {/* Steel Man content */}
        {obs.status === "complete" && tab === "steel" && steelBullets.map((bullet, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
            <span style={{ color: "#1A1A1A", fontWeight: 700, fontSize: 18, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{"\u2022"}</span>
            <p style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.65, margin: 0 }}>{bullet}</p>
          </div>
        ))}

        {/* Stress Test content */}
        {tab === "stress" && (
          stressLoading ? null : stressError ? (
            <div style={{ background: "#FFF0EE", borderRadius: 12, padding: "14px 16px", border: "1px solid #F5C6C0" }}>
              <p style={{ fontSize: 14, color: "#C0392B", margin: 0, lineHeight: 1.5 }}>
                Stress test failed. Tap the button to try again.
              </p>
            </div>
          ) : obs.stress_test?.verdict ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                {(obs.stress_test as any).pros?.map((pro: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <span style={{ color: "#2E7D32", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>+</span>
                    <p style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.65, margin: 0 }}>{pro}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 20 }}>
                {(obs.stress_test as any).cons?.map((con: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <span style={{ color: "#C0392B", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>{"\u2212"}</span>
                    <p style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.65, margin: 0 }}>{con}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: "#F5F5F2", borderRadius: 12, padding: "14px 16px", borderLeft: "3px solid #1A1A1A" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 6px" }}>Verdict</p>
                <p style={{ fontSize: 15, color: "#1A1A1A", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{(obs.stress_test as any).verdict}</p>
              </div>
            </div>
          ) : null
        )}

        {/* Edit & Resubmit */}
        {obs.status === "complete" && !editMode && (
          <div style={{ marginTop: 24 }}>
            <button
              onClick={() => { setEditMode(true); setEditText(obs.thesis); }}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10,
                border: "1.5px solid #D5D5CD", background: "transparent",
                color: "#555", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Edit &amp; Resubmit
            </button>
          </div>
        )}

        {obs.status === "complete" && editMode && (
          <div style={{ marginTop: 24 }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              style={{
                width: "100%", border: "1.5px solid #D5D5CD", borderRadius: 12,
                padding: "12px 14px", fontSize: 15, color: "#1A1A1A",
                lineHeight: 1.6, resize: "none", fontFamily: "inherit",
                boxSizing: "border-box", outline: "none",
              }}
            />
            <button
              onClick={handleResubmit}
              disabled={!editText.trim() || resubmitting}
              style={{
                width: "100%", marginTop: 10, padding: "14px 0", borderRadius: 10,
                border: "none", background: editText.trim() && !resubmitting ? "#1A1A1A" : "#D5D5CD",
                color: "#FFF", fontSize: 15, fontWeight: 700,
                cursor: editText.trim() && !resubmitting ? "pointer" : "not-allowed",
                fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
              }}
            >
              {resubmitting ? "Submitting\u2026" : "Resubmit \u2192"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────

function StepRow({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: done || active ? 1 : 0.35 }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        background: done ? "#1A1A1A" : active ? "#F0F0FF" : "#EEEEE8",
        border: active ? "2px solid #6666CC" : done ? "none" : "2px solid #D5D5CD",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {done && <span style={{ color: "#FFF", fontSize: 11, fontWeight: 700 }}>{"\u2713"}</span>}
        {active && <ProcessingDots />}
      </div>
      <span style={{ fontSize: 14, color: done ? "#1A1A1A" : active ? "#6666CC" : "#AAA", fontWeight: active || done ? 600 : 400 }}>
        {label}
      </span>
    </div>
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

  useEffect(() => { fetchObservations(); }, []);

  // Browser back button support
  useEffect(() => {
    const handlePop = () => {
      setView("home");
      setSelectedObs(null);
      fetchObservations();
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const navigateTo = (nextView: View, obs?: Observation) => {
    if (nextView !== "home") {
      window.history.pushState({ view: nextView }, "", "");
    }
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
