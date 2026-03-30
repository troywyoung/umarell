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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ b64: string; mediaType: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!imagePreview) ref.current?.focus(); }, [imagePreview]);

  const isUrl = input.trim().startsWith("http://") || input.trim().startsWith("https://");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = file.type || "image/jpeg";
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:image/jpeg;base64,XXXX" — strip the prefix
      const b64 = result.split(",")[1];
      setImagePreview(result);
      setImageMeta({ b64, mediaType });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (imageMeta) {
      await onSubmitImage(imageMeta.b64, imageMeta.mediaType);
    } else if (input.trim()) {
      await onSubmit(input.trim());
    }
    setSubmitting(false);
  };

  const canSubmit = (!!imageMeta || !!input.trim()) && !submitting;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 40px" }}>
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
  const [openSection, setOpenSection] = useState<string | null>(null);
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

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #EBEBEB",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>‹ Back</button>
        <button onClick={handleShare} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, color: "#1A1A1A", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Share</button>
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        {isProcessing && (
          <div style={{ background: "#F5F5F2", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: "#666", fontStyle: "italic" }}>
              {obs.status === "formatting" ? "Formatting your thesis…" : "Researching…"}
            </span>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          {obs.confidence && <div style={{ marginBottom: 10 }}><ConfidenceBadge value={obs.confidence} /></div>}
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.35, letterSpacing: -0.4, margin: 0 }}>
            {obs.thesis || obs.raw_input}
          </h1>
        </div>

        {obs.summary && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Summary</SectionLabel>
            <p style={{ fontSize: 15, color: "#3A3A38", lineHeight: 1.65, margin: 0 }}>{obs.summary}</p>
          </div>
        )}

        {obs.supporting_ideas && obs.supporting_ideas.length > 0 && (
          <Collapsible title="Supporting ideas" open={openSection === "supporting"} onToggle={() => setOpenSection((s) => s === "supporting" ? null : "supporting")}>
            {obs.supporting_ideas.map((p, i) => <PointItem key={i} point={p} />)}
          </Collapsible>
        )}

        {obs.counter_ideas && obs.counter_ideas.length > 0 && (
          <Collapsible title="Counter ideas" open={openSection === "counter"} onToggle={() => setOpenSection((s) => s === "counter" ? null : "counter")}>
            {obs.counter_ideas.map((p, i) => <PointItem key={i} point={p} />)}
          </Collapsible>
        )}

        {obs.context && (
          <Collapsible title="Context" open={openSection === "context"} onToggle={() => setOpenSection((s) => s === "context" ? null : "context")}>
            <p style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.65, margin: 0 }}>{obs.context}</p>
          </Collapsible>
        )}

        {obs.stress_test && (
          <Collapsible title="Stress test" open={openSection === "stress"} onToggle={() => setOpenSection((s) => s === "stress" ? null : "stress")} accent="#7B3F00">
            <p style={{ fontSize: 12, fontWeight: 700, color: "#7B3F00", letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 6px" }}>Strongest objection</p>
            <p style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.65, margin: "0 0 14px" }}>{obs.stress_test.strongest_objection}</p>
            {obs.stress_test.assumptions.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#7B3F00", letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 6px" }}>Assumptions</p>
                {obs.stress_test.assumptions.map((a, i) => (
                  <p key={i} style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.65, margin: "0 0 6px" }}>— {a}</p>
                ))}
              </>
            )}
            {obs.stress_test.evidence_flags.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#7B3F00", letterSpacing: 0.5, textTransform: "uppercase", margin: "14px 0 6px" }}>Evidence flags</p>
                {obs.stress_test.evidence_flags.map((f, i) => (
                  <p key={i} style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.65, margin: "0 0 6px" }}>— {f}</p>
                ))}
              </>
            )}
          </Collapsible>
        )}

        {obs.more_questions && obs.more_questions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>More questions</SectionLabel>
            {obs.more_questions.map((q, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                padding: "12px 0", borderBottom: "1px solid #F0F0EC",
              }}>
                <span style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.5, flex: 1, paddingRight: 12 }}>{q.text}</span>
                <span style={{ fontSize: 14, color: "#B0B0A8", flexShrink: 0, marginTop: 2 }}>→</span>
              </div>
            ))}
          </div>
        )}

        {obs.status === "complete" && (
          <button
            onClick={handleBriefing}
            disabled={briefingLoading}
            style={{
              width: "100%",
              background: briefingLoading ? "#D5D5CD" : "#1A1A1A",
              color: "#FFF", border: "none", borderRadius: 14,
              padding: "16px 0", fontSize: 16, fontWeight: 700,
              cursor: briefingLoading ? "not-allowed" : "pointer",
              letterSpacing: -0.2, fontFamily: "inherit", marginTop: 8,
            }}
          >
            {briefingLoading ? "Generating…" : obs.briefing ? "Read the Briefing →" : "Generate Briefing →"}
          </button>
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
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #EBEBEB",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 15, color: "#888", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>‹ Back</button>
        <button onClick={onShare} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, color: "#1A1A1A", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Share</button>
      </div>
      <div style={{ padding: "28px 24px 0" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 12px" }}>Briefing</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.4, letterSpacing: -0.3, margin: "0 0 20px" }}>{obs.thesis}</h1>
        <div style={{ width: 36, height: 2, background: "#1A1A1A", marginBottom: 24 }} />
        <p style={{ fontSize: 16, color: "#2A2A28", lineHeight: 1.75, letterSpacing: 0.1, margin: 0 }}>{obs.briefing}</p>
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 0.8, textTransform: "uppercase", margin: "0 0 8px" }}>
      {children}
    </p>
  );
}

function Collapsible({ title, open, onToggle, accent = "#1A1A1A", children }: {
  title: string; open: boolean; onToggle: () => void; accent?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#FFF", borderRadius: 12, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{title}</span>
        <span style={{ fontSize: 12, color: "#B0B0A8" }}>{open ? "∧" : "∨"}</span>
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

function PointItem({ point }: { point: { text: string; source_title?: string } }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 14, color: "#3A3A38", lineHeight: 1.65, margin: 0 }}>{point.text}</p>
      {point.source_title && <p style={{ fontSize: 11, color: "#999", margin: "3px 0 0" }}>{point.source_title}</p>}
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
    if (obs) { setSelectedObs(obs); setView("output"); }
  };

  const handleSubmitImage = async (b64: string, mediaType: string) => {
    const obs = await submitObservation("image", "screenshot", b64, mediaType);
    if (obs) { setSelectedObs(obs); setView("output"); }
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
