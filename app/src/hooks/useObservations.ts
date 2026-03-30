import { useState, useCallback } from "react";
import type { Observation } from "../types";
import { API } from "../config";

export function useObservations() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchObservations = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/observations`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data: Observation[] = await resp.json();
      setObservations(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitObservation = useCallback(async (
    rawInput: string,
    inputType: Observation["input_type"] = "text",
    imageData?: string,
    imageMediaType?: string,
  ): Promise<Observation | null> => {
    try {
      const resp = await fetch(`${API}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_input: rawInput,
          input_type: inputType,
          ...(imageData && { image_data: imageData, image_media_type: imageMediaType }),
        }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const obs: Observation = await resp.json();
      setObservations((prev) => [obs, ...prev]);
      return obs;
    } catch {
      return null;
    }
  }, []);

  const pollObservation = useCallback(async (id: string): Promise<Observation | null> => {
    try {
      const resp = await fetch(`${API}/observations/${id}`);
      if (!resp.ok) return null;
      const obs: Observation = await resp.json();
      setObservations((prev) => prev.map((o) => (o.id === id ? obs : o)));
      return obs;
    } catch {
      return null;
    }
  }, []);

  const requestBriefing = useCallback(async (id: string): Promise<string | null> => {
    try {
      const resp = await fetch(`${API}/observations/${id}/briefing`, { method: "POST" });
      if (!resp.ok) return null;
      const data = await resp.json();
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? { ...o, briefing: data.briefing } : o))
      );
      return data.briefing;
    } catch {
      return null;
    }
  }, []);

  const deleteObservation = useCallback(async (id: string) => {
    await fetch(`${API}/observations/${id}`, { method: "DELETE" });
    setObservations((prev) => prev.filter((o) => o.id !== id));
  }, []);

  return {
    observations, loading,
    fetchObservations, submitObservation, pollObservation,
    requestBriefing, deleteObservation,
  };
}
