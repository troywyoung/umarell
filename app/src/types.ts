export interface HardFactItem {
  fact: string;
  source: string;
  url?: string;
}

export interface SteelmanResult {
  bottom_line: string;
  hard_facts?: (HardFactItem | string)[];
  bullets: string[];
}

export interface Counterpoint {
  bottom_line: string;
  hard_facts?: (HardFactItem | string)[];
  bullets: string[];
  verdict: string;
  strength: "weak" | "moderate" | "strong" | "devastating";
}

export interface PvaTake {
  bottom_line: string;
  bullets: string[];
  tldr: string;
  body?: string; // legacy
  voice?: string;
}

// Legacy format — kept for backward compat
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
  summary?: string; // JSON string of SteelmanResult (or legacy plain text)
  stress_test?: StressTest | Counterpoint;
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
  pva_take?: PvaTake;
  episode_tag?: string;
  episode_title?: string;
  episode_url?: string;
  category?: string;
  created_at: string;
}
