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
  summary?: string;
  stress_test?: StressTest;
  score?: number;
  tags?: string[];
  evidence_type?: string;
  sources?: { url: string; title: string }[];
  user_id?: string;
  model_used?: string;
  error_detail?: string;
  image_data?: string;
  image_media_type?: string;
  user_name?: string;
  parent_id?: string;
  challenge_type?: string;
  bs_score?: number;
  bs_verdict?: string;
  created_at: string;
}
