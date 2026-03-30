import { useState, useEffect, useRef } from "react";
import type { Observation } from "./types";
import { useObservations } from "./hooks/useObservations";

// ─── Confidence badge ─────────────────────────────────────────────────────

const CONFIDENCE: Record<string, { label: string; bg: string; color: string }> = {
  well_supported: { label: "Well supported", bg: "#E8F5E9", color: "#2E7D32" },
  contested:      { label: "Contested",       bg: "#FFF8E1", color: "#E65100" },
  speculative:    { label: "Speculative",     bg: "#F3E5F5", color: "#6A1B9A" },
};

function ConfidenceBadge({ value }: { value?: string }) {
  if (!value || !CONFIDENCE[value]) return null;
  const c = CONFIDENCE[value];
  return (
    <span style={{
      display: "inline-block",
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700,
      padding: "3px 10px", borderRadius: 100, letterSpacing: 0.3,
    }}>
      {c.label}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#B0B0A8" }}>{timeAgo(obs.created_at)}</span>
                  <ConfidenceBadge value={obs.confidence} />
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
  onSubmitImage: (b64: string, mediaType: string) => Promise<void>;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ b64: string; mediaType: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => { if (!imagePreview) ref.current?.focus(); }, [imagePreview]);

  // Track iOS keyboard height via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  const isUrl = input.trim().startsWith("http://") || input.trim().startsWith("https://");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = "image/jpeg";
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const resized = canvas.toDataURL("image/jpeg", 0.85);
        const b64 = resized.split(",")[1];
        setImagePreview(resized);
        setImageMeta({ b64, mediaType });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      if (imageMeta) {
        await onSubmitImage(imageMeta.b64, imageMeta.mediaType);
      } else if (input.trim()) {
        await onSubmit(input.trim());
      }
    } catch (e: any) {
      setError(e?.message || "Failed to connect to API. Check VITE_API_URL.");
    }
    setSubmitting(false);
  };

  const canSubmit = (!!imageMeta || !!input.trim()) && !submitting;

  return (
    <div style={{
      maxWidth: 480, margin: "0 auto",
      padding: `0 20px ${kbHeight + 40}px`,
      overflowY: "auto", WebkitOverflowScrolling: "touch" as any,
    }}>
      <div style={{ padding: "20px 0 24px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          Cancel
        </button>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1A1A1A", letterSpacing: -0.5, margin: "0 0 8px" }}>
        What are you watching?
      </h1>
      <p style={{ fontSize: 14, color: "#888", margin: "0 0 24px", lineHeight: 1.5 }}>
        A thought, a pattern, a question. Paste a URL or drop a screenshot.
      </p>

      {/* Image preview */}
      {imagePreview ? (
        <div style={{ position: "relative", marginBottom: 14 }}>
          <img src={imagePreview} alt="Preview" style={{ width: "100%", borderRadius: 16, maxHeight: 280, objectFit: "cover" }} />
          <button
            onClick={() => { setImagePreview(null); setImageMeta(null); if (fileRef.current) fileRef.current.value = ""; }}
            style={{
              position: "absolute", top: 10, right: 10,
              background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
              width: 28, height: 28, color: "#fff", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>
      ) : (
        <div style={{
          background: "#FFF", borderRadius: 16, padding: 16,
          boxShadow: "0 2px 10px rgba(0,0,0,0.07)", marginBottom: 14,
        }}>
          <textarea
            ref={ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
            placeholder="Type your observation…"
            rows={5}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: "100%", border: "none", outline: "none",
              fontSize: 16, color: "#1A1A1A", lineHeight: 1.6,
              resize: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          {isUrl && (
            <p style={{ fontSize: 11, color: "#2E7D32", margin: "8px 0 0", fontWeight: 600 }}>
              URL detected — will extract and analyze
            </p>
          )}
        </div>
      )}

      {/* Screenshot button */}
      {!imagePreview && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%", background: "none",
              border: "1.5px dashed #D5D5CD", borderRadius: 14,
              padding: "13px 0", fontSize: 14, color: "#888",
              cursor: "pointer", fontFamily: "inherit", marginBottom: 14,
            }}
          >
            📎 Attach screenshot or photo
          </button>
        </>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: "100%",
          background: canSubmit ? "#1A1A1A" : "#D5D5CD",
          color: "#FFF", border: "none", borderRadius: 14,
          padding: "16px 0", fontSize: 16, fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed",
          letterSpacing: -0.2, fontFamily: "inherit",
        }}
      >
        {submitting ? "Submitting…" : "Start researching →"}
      </button>

      {error && (
        <div style={{
          marginTop: 12, background: "#FFF0EE", borderRadius: 10,
          padding: "12px 14px", border: "1px solid #F5C6C0",
        }}>
          <p style={{ fontSize: 13, color: "#C0392B", margin: 0, lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Output ───────────────────────────────────────────────────────────────

function OutputView({ obs: initialObs, onBack, pollObservation, requestBriefing }: {
  obs: Observation;
  onBack: () => void;
  pollObservation: (id: string) => Promise<Observation | null>;
  requestBriefing: (id: string) => Promise<string | null>;
}) {
  const [obs, setObs] = useState(initialObs);
  const [tab, setTab] = useState<"research" | "stress">("research");
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
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

  const handleBriefing = async () => {
    if (obs.briefing) { setShowBriefing(true); return; }
    setBriefingLoading(true);
    const text = await requestBriefing(obs.id);
    setBriefingLoading(false);
    if (text) { setObs((p) => ({ ...p, briefing: text })); setShowBriefing(true); }
  };

  const handleShare = () => {
    const text = obs.briefing ? `${obs.thesis}\n\n${obs.briefing}` : obs.thesis || obs.raw_input;
    if (navigator.share) navigator.share({ title: obs.thesis || "Umarell", text });
    else { navigator.clipboard.writeText(text); alert("Copied to clipboard"); }
  };

  if (showBriefing && obs.briefing) {
    return <BriefingView obs={obs} onBack={() => setShowBriefing(false)} onShare={handleShare} />;
  }

  const isProcessing = obs.status === "formatting" || obs.status === "researching";
  const isImage = obs.input_type === "screenshot" || obs.input_type === "photo";

  // Thesis to display — hide raw placeholder while image is still being analyzed
  const displayThesis = (isProcessing && isImage && (!obs.thesis || obs.thesis === "image"))
    ? null
    : (obs.thesis && obs.thesis !== "image" ? obs.thesis : obs.raw_input !== "image" ? obs.raw_input : null);

  if (obs.status === "error") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ padding: "14px 0" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>‹ Back</button>
        </div>
        <div style={{ marginTop: 60, textAlign: "center" }}>
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px" }}>Research failed</p>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, margin: "0 0 28px" }}>
            Something went wrong during analysis. This is usually an API issue — check that ANTHROPIC_API_KEY is set in your Railway API service.
          </p>
          <button onClick={onBack} style={{
            background: "#1A1A1A", color: "#FFF", border: "none", borderRadius: 14,
            padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      {/* Nav */}
      <div style={{
        padding: "14px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #EBEBEB",
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>‹ Back</button>
        <button
          onClick={handleBriefing}
          disabled={briefingLoading || isProcessing}
          style={{
            background: isProcessing || briefingLoading ? "#D5D5CD" : "#C0392B",
            color: "#FFF", border: "none", borderRadius: 20,
            padding: "7px 16px", fontSize: 13, fontWeight: 700,
            cursor: isProcessing || briefingLoading ? "not-allowed" : "pointer",
            fontFamily: "inherit", letterSpacing: 0.1,
          }}
        >
          {briefingLoading ? "Generating…" : obs.briefing ? "Briefing →" : "Briefing"}
        </button>
      </div>

      <div style={{ padding: "20px 16px 0" }}>
        {/* Processing banner */}
        {isProcessing && (
          <div style={{
            background: "#F0F0FF", borderRadius: 12, padding: "14px 16px",
            marginBottom: 20, border: "1px solid #DDDDF0",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isImage ? 6 : 0 }}>
              <ProcessingDots />
              <span style={{ fontSize: 14, color: "#444", fontWeight: 600 }}>
                {obs.status === "formatting"
                  ? (isImage ? "Extracting observation from image…" : "Formatting thesis…")
                  : "Researching…"}
              </span>
            </div>
            {isImage && obs.status === "formatting" && (
              <p style={{ fontSize: 12, color: "#888", margin: 0, paddingLeft: 26 }}>
                Claude is reading your image and building a research thesis.
              </p>
            )}
          </div>
        )}

        {/* Confidence + Thesis */}
        <div style={{ marginBottom: 20 }}>
          {obs.confidence && (
            <div style={{ marginBottom: 10 }}>
              <ConfidenceBadge value={obs.confidence} />
            </div>
          )}
          {displayThesis ? (
            <p style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.4, letterSpacing: -0.3, margin: 0 }}>
              {displayThesis}
            </p>
          ) : isProcessing ? (
            <div style={{ height: 24, background: "#EEEEE8", borderRadius: 6, width: "80%" }} />
          ) : null}
        </div>

        {/* Tabs — only show once research data exists */}
        {obs.status === "complete" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {(["research", "stress"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    background: tab === t ? "#1A1A1A" : "#EFEFED",
                    color: tab === t ? "#FFF" : "#666",
                  }}
                >
                  {t === "research" ? "Research" : "Stress Test"}
                </button>
              ))}
            </div>

            {tab === "research" && (
              <div>
                {/* Summary */}
                {obs.summary && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionLabel>Summary</SectionLabel>
                    <p style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.7, margin: 0 }}>{obs.summary}</p>
                  </div>
                )}

                {/* Supporting ideas */}
                {obs.supporting_ideas && obs.supporting_ideas.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionLabel>Supporting ideas</SectionLabel>
                    {obs.supporting_ideas.map((p, i) => <PointCard key={i} point={p} accent="#2E7D32" />)}
                  </div>
                )}

                {/* Counter ideas */}
                {obs.counter_ideas && obs.counter_ideas.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionLabel>Counter ideas</SectionLabel>
                    {obs.counter_ideas.map((p, i) => <PointCard key={i} point={p} accent="#C0392B" />)}
                  </div>
                )}

                {/* Context */}
                {obs.context && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionLabel>Context</SectionLabel>
                    <p style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.7, margin: 0 }}>{obs.context}</p>
                  </div>
                )}

                {/* More questions */}
                {obs.more_questions && obs.more_questions.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionLabel>More questions</SectionLabel>
                    {obs.more_questions.map((q, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                        padding: "11px 0", borderBottom: "1px solid #F0F0EC",
                      }}>
                        <span style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.5, flex: 1, paddingRight: 12 }}>{q.text}</span>
                        <span style={{ color: "#B0B0A8", flexShrink: 0, marginTop: 2 }}>→</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "stress" && obs.stress_test && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <SectionLabel>Stress Test</SectionLabel>
                  <ConfidenceBadge value={obs.stress_test.confidence_signal} />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#7B3F00", letterSpacing: 0.6, textTransform: "uppercase", margin: "0 0 8px" }}>Core assumptions</p>
                  {obs.stress_test.assumptions.map((a, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 10, marginBottom: 8,
                      background: "#FFF8F5", borderRadius: 10, padding: "10px 12px",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#7B3F00", minWidth: 18 }}>{i + 1}.</span>
                      <span style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.55 }}>{a}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#7B3F00", letterSpacing: 0.6, textTransform: "uppercase", margin: "0 0 8px" }}>Strongest objection</p>
                  <div style={{ background: "#FFF8F5", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #C0392B" }}>
                    <p style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
                      "{obs.stress_test.strongest_objection}"
                    </p>
                  </div>
                </div>

                {obs.stress_test.evidence_flags.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#7B3F00", letterSpacing: 0.6, textTransform: "uppercase", margin: "0 0 8px" }}>Evidence quality</p>
                    {obs.stress_test.evidence_flags.map((f, i) => (
                      <p key={i} style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.65, margin: "0 0 6px" }}>— {f}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Briefing ─────────────────────────────────────────────────────────────

function BriefingView({ obs, onBack, onShare }: {
  obs: Observation;
  onBack: () => void;
  onShare: () => void;
}) {
  // Split briefing into paragraphs for readable rendering
  const paragraphs = (obs.briefing || "").split(/\n+/).filter(Boolean);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid #EBEBEB",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>‹ Back</button>
        <button onClick={onShare} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#1A1A1A", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Share</button>
      </div>
      <div style={{ padding: "24px 20px 0" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#B0B0A8", letterSpacing: 1.4, textTransform: "uppercase", margin: "0 0 10px" }}>Briefing</p>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.4, letterSpacing: -0.3, margin: "0 0 18px" }}>{obs.thesis}</h1>
        <div style={{ width: 32, height: 2, background: "#1A1A1A", marginBottom: 22 }} />
        {paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 15, color: "#2A2A28", lineHeight: 1.8, margin: "0 0 16px", letterSpacing: 0.1 }}>{p}</p>
        ))}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 0.9, textTransform: "uppercase", margin: "0 0 10px" }}>
      {children}
    </p>
  );
}

function PointCard({ point, accent }: { point: { text: string; source_title?: string }; accent: string }) {
  return (
    <div style={{
      background: "#FFF", borderRadius: 10, padding: "12px 14px",
      marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      borderLeft: `3px solid ${accent}20`,
    }}>
      <p style={{ fontSize: 14, color: "#2A2A28", lineHeight: 1.6, margin: 0 }}>{point.text}</p>
      {point.source_title && (
        <p style={{ fontSize: 11, color: "#999", margin: "6px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9 }}>↗</span> {point.source_title}
        </p>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────

type View = "home" | "capture" | "output";

export default function App() {
  const { observations, loading, fetchObservations, submitObservation, pollObservation, requestBriefing, deleteObservation } = useObservations();
  const [view, setView] = useState<View>("home");
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);

  useEffect(() => { fetchObservations(); }, []);

  const handleSubmit = async (text: string) => {
    const obs = await submitObservation(text, text.startsWith("http") ? "url" : "text");
    setSelectedObs(obs); setView("output");
  };

  const handleSubmitImage = async (b64: string, mediaType: string) => {
    const obs = await submitObservation("image", "screenshot", b64, mediaType);
    setSelectedObs(obs); setView("output");
  };

  if (view === "capture") return <CaptureView onSubmit={handleSubmit} onSubmitImage={handleSubmitImage} onBack={() => setView("home")} />;
  if (view === "output" && selectedObs) {
    return (
      <OutputView
        obs={selectedObs}
        onBack={() => { setView("home"); fetchObservations(); }}
        pollObservation={pollObservation}
        requestBriefing={requestBriefing}
      />
    );
  }
  return <HomeView observations={observations} loading={loading} onCapture={() => setView("capture")} onSelect={(o) => { setSelectedObs(o); setView("output"); }} onDelete={deleteObservation} />;
}
