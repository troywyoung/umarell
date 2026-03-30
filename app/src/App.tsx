import { useState, useEffect, useRef } from "react";
import type { Observation } from "./types";
import { useObservations } from "./hooks/useObservations";

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
          Umarell
        </span>
        {loading && <span style={{ fontSize: 12, color: "#B0B0A8" }}>Refreshing…</span>}
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        {observations.length === 0 && !loading ? (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1A1A1A", marginBottom: 8 }}>Nothing yet.</p>
            <p style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>
              Tap the button below to capture your first observation.
            </p>
          </div>
        ) : (
          observations.map((obs) => (
            <div
              key={obs.id}
              onClick={() => onSelect(obs)}
              style={{
                background: "#FFF", borderRadius: 14, padding: "14px 16px",
                marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                cursor: "pointer", position: "relative",
              }}
            >
              <div style={{ paddingRight: 28 }}>
                <p style={{
                  fontSize: 15, fontWeight: 600, color: "#1A1A1A",
                  lineHeight: 1.4, margin: "0 0 6px", letterSpacing: -0.2,
                }}>
                  {obs.thesis || obs.raw_input}
                </p>
                {(obs.status === "formatting" || obs.status === "researching") && (
                  <p style={{ fontSize: 12, color: "#999", margin: "0 0 6px", fontStyle: "italic" }}>
                    {obs.status === "formatting" ? "Formatting…" : "Researching…"}
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this observation?")) onDelete(obs.id);
                }}
                style={{
                  position: "absolute", top: 12, right: 12,
                  background: "none", border: "none", cursor: "pointer",
                  color: "#CCC", fontSize: 18, padding: 4, lineHeight: 1,
                }}
              >×</button>
            </div>
          ))
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
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [showText, setShowText] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ b64: string; mediaType: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const voiceSupported = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;

  useEffect(() => { if (showText) textRef.current?.focus(); }, [showText]);

  const listeningRef = useRef(false);

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
      setTranscript(parts.join(" ").trim());
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed") {
        setShowText(true);
        setError("Mic not available — type your observation below.");
      }
      listeningRef.current = false;
      setListening(false);
    };
    // Chrome ends recognition after silence — restart if still active
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
    if (!SR) { setShowText(true); setError("Voice not available — type your observation below."); return; }
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
        await onSubmitImage(imageMeta.b64, imageMeta.mediaType, transcript.trim() || undefined);
      } else if (transcript.trim()) {
        await onSubmit(transcript.trim());
      }
    } catch (e: any) {
      setError(e?.message || "Failed to connect to API.");
      setSubmitting(false);
    }
  };

  const canSubmit = (!!imageMeta || !!transcript.trim()) && !submitting;
  const hasInput = !!imageMeta || !!transcript.trim();

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          Cancel
        </button>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1A1A1A", letterSpacing: -0.5, margin: "0 0 6px" }}>
        What are you watching?
      </h1>
      <p style={{ fontSize: 14, color: "#888", margin: "0 0 40px", lineHeight: 1.5 }}>
        Speak your observation or attach a screenshot.
      </p>

      {/* Image preview + optional voice/text context */}
      {imagePreview && (
        <div style={{ marginBottom: 16 }}>
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
            >×</button>
          </div>
          {/* Voice context beneath image */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <button
              onClick={toggleVoice}
              style={{
                flexShrink: 0, width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
                background: listening ? "#1A1A1A" : "#F0F0ED", color: listening ? "#FFF" : "#444",
                fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}
            >{listening ? "⏹" : "🎤"}</button>
            <div style={{ flex: 1, background: "#FFF", borderRadius: 12, padding: "10px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              {transcript ? (
                <p style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.5, margin: 0 }}>{transcript}
                  <button onClick={() => setTranscript("")} style={{ background: "none", border: "none", color: "#CCC", fontSize: 14, cursor: "pointer", marginLeft: 6, verticalAlign: "middle" }}>×</button>
                </p>
              ) : (
                <p style={{ fontSize: 14, color: "#AAA", margin: 0 }}>{listening ? "Listening…" : "Add voice context (optional)"}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transcript display */}
      {transcript && !imagePreview && (
        <div style={{ background: "#FFF", borderRadius: 16, padding: "16px", marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative" }}>
          <p style={{ fontSize: 16, color: "#1A1A1A", lineHeight: 1.6, margin: 0 }}>{transcript}</p>
          <button
            onClick={() => setTranscript("")}
            style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#CCC", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* Text input (fallback) */}
      {showText && !imagePreview && (
        <div style={{ background: "#FFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <textarea
            ref={textRef}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type your observation…"
            rows={4}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            style={{ width: "100%", border: "none", outline: "none", fontSize: 16, color: "#1A1A1A", lineHeight: 1.6, resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>
      )}

      {/* Input buttons */}
      {!imagePreview && !showText && (
        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          {/* Mic button */}
          <button
            onClick={toggleVoice}
            style={{
              flex: 1, padding: "28px 0", borderRadius: 20, border: "none", cursor: "pointer",
              background: listening ? "#1A1A1A" : "#F0F0ED",
              color: listening ? "#FFF" : "#444",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              transition: "background 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 32 }}>{listening ? "⏹" : "🎤"}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{listening ? "Stop" : "Speak"}</span>
          </button>

          {/* Photo button */}
          <>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                flex: 1, padding: "28px 0", borderRadius: 20, border: "none", cursor: "pointer",
                background: "#F0F0ED", color: "#444",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{ fontSize: 32 }}>📷</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Photo</span>
            </button>
          </>
        </div>
      )}

      {/* Photo button when in text mode */}
      {!imagePreview && showText && (
        <>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
          <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: "none", border: "1.5px dashed #D5D5CD", borderRadius: 14, padding: "13px 0", fontSize: 14, color: "#888", cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
            📷 Attach photo instead
          </button>
        </>
      )}

      {/* Type instead / Speak instead toggle */}
      {!imagePreview && !listening && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <button
            onClick={() => { setShowText(!showText); setError(""); }}
            style={{ background: "none", border: "none", fontSize: 13, color: "#999", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
          >
            {showText ? (voiceSupported ? "Use voice instead" : null) : "Type instead"}
          </button>
        </div>
      )}

      {listening && (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <ProcessingDots />
          <span style={{ fontSize: 13, color: "#6666CC", marginLeft: 8, fontWeight: 600 }}>Listening…</span>
        </div>
      )}

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
        {submitting ? "Submitting…" : hasInput ? "Start researching →" : "Speak or attach a photo"}
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

function OutputView({ obs: initialObs, onBack, pollObservation, requestStressTest }: {
  obs: Observation;
  onBack: () => void;
  pollObservation: (id: string) => Promise<Observation | null>;
  requestStressTest: (id: string) => Promise<import("./types").StressTest | null>;
}) {
  const [obs, setObs] = useState(initialObs);
  const [tab, setTab] = useState<"steel" | "stress">("steel");
  const [stressLoading, setStressLoading] = useState(false);
  const [stressError, setStressError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const isProcessing = obs.status === "formatting" || obs.status === "researching";
  const isImage = obs.input_type === "screenshot" || obs.input_type === "photo";
  const displayThesis = (isProcessing && isImage && (!obs.thesis || obs.thesis === "image"))
    ? null
    : (obs.thesis && obs.thesis !== "image" ? obs.thesis : obs.raw_input !== "image" ? obs.raw_input : null);
  const steelBullets = (obs.summary || "").split(/\n+/).map(l => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean);

  if (obs.status === "error") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ padding: "14px 0" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>‹ Back</button>
        </div>
        <div style={{ marginTop: 60, textAlign: "center" }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px" }}>Analysis failed</p>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, margin: "0 0 28px" }}>
            Something went wrong. Check that ANTHROPIC_API_KEY is set in your Railway API service.
          </p>
          <button onClick={onBack} style={{ background: "#1A1A1A", color: "#FFF", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", borderBottom: "1px solid #EBEBEB" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>‹ Back</button>
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        {/* Processing */}
        {isProcessing && (
          <div style={{ background: "#F0F0FF", borderRadius: 12, padding: "14px 16px", marginBottom: 24, border: "1px solid #DDDDF0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ProcessingDots />
              <span style={{ fontSize: 14, color: "#444", fontWeight: 600 }}>
                {obs.status === "formatting" ? (isImage ? "Reading image…" : "Formatting thesis…") : "Building steel man…"}
              </span>
            </div>
          </div>
        )}

        {/* Thesis */}
        <div style={{ marginBottom: obs.status === "complete" ? 12 : 20 }}>
          {displayThesis
            ? <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.4, letterSpacing: -0.4, margin: 0 }}>{displayThesis}</h1>
            : isProcessing ? <div style={{ height: 26, background: "#EEEEE8", borderRadius: 6, width: "80%" }} /> : null}
        </div>

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

        {/* Steel Man content */}
        {obs.status === "complete" && tab === "steel" && steelBullets.map((bullet, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
            <span style={{ color: "#1A1A1A", fontWeight: 700, fontSize: 18, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>•</span>
            <p style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.65, margin: 0 }}>{bullet}</p>
          </div>
        ))}

        {/* Stress Test content */}
        {tab === "stress" && (
          stressLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0" }}>
              <ProcessingDots />
              <span style={{ fontSize: 14, color: "#666" }}>Running stress test…</span>
            </div>
          ) : stressError ? (
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
                    <span style={{ color: "#C0392B", fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 1 }}>−</span>
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
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────

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

  const handleSubmit = async (text: string) => {
    const obs = await submitObservation(text, text.startsWith("http") ? "url" : "text");
    setSelectedObs(obs); setView("output");
  };

  const handleSubmitImage = async (b64: string, mediaType: string, context?: string) => {
    const obs = await submitObservation(context || "image", "screenshot", b64, mediaType);
    setSelectedObs(obs); setView("output");
  };

  if (view === "capture") return <CaptureView onSubmit={handleSubmit} onSubmitImage={handleSubmitImage} onBack={() => setView("home")} />;
  if (view === "output" && selectedObs) {
    return (
      <OutputView
        obs={selectedObs}
        onBack={() => { setView("home"); fetchObservations(); }}
        pollObservation={pollObservation}
        requestStressTest={requestStressTest}
      />
    );
  }
  return <HomeView observations={observations} loading={loading} onCapture={() => setView("capture")} onSelect={(o) => { setSelectedObs(o); setView("output"); }} onDelete={deleteObservation} />;
}
