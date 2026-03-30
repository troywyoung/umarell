export interface Point {
  text: string;
  source_title?: string;
  source_url?: string;
}

export interface Question {
  text: string;
}

export interface StressTest {
  assumptions: string[];
  strongest_objection: string;
  evidence_flags: string[];
  confidence_signal: string;
}

export interface Observation {
  id: string;
  raw_input: string;
  input_type: "text" | "voice" | "photo" | "screenshot" | "url";
  thesis: string;
  status: "formatting" | "researching" | "complete" | "error";
  confidence?: "well_supported" | "contested" | "speculative";
  summary?: string;
  supporting_ideas?: Point[];
  counter_ideas?: Point[];
  context?: string;
  more_questions?: Question[];
  stress_test?: StressTest;
  briefing?: string;
  created_at: string;
}
