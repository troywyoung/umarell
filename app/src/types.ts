export interface StressTest {
  pros: string[];
  cons: string[];
  verdict: string;
}

export interface Observation {
  id: string;
  raw_input: string;
  input_type: "text" | "voice" | "photo" | "screenshot" | "url";
  thesis: string;
  status: "formatting" | "researching" | "complete" | "error";
  summary?: string;        // steel man bullets
  stress_test?: StressTest; // generated on demand
  score?: number;          // 0-100 evidence strength
  tags?: string[];         // e.g. ["AI", "Markets"]
  evidence_type?: string;  // Empirical | Observational | Anecdotal | Speculative
  sources?: { url: string; title: string }[];
  error_detail?: string;
  image_data?: string;       // base64
  image_media_type?: string; // e.g. "image/jpeg"
  created_at: string;
}
