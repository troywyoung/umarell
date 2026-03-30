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
  summary?: string;        // steel man prose
  stress_test?: StressTest; // generated on demand
  created_at: string;
}
