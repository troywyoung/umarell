import { useState, useCallback } from "react";
import type { Observation } from "../types";
import { API } from "../config";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("sm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useObservations() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchObservations = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/observations`, { headers: authHeaders() });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data: Observation[] = await resp.json();
      setObservations(prev => {
        // Merge: server data wins for known obs, but keep any in-progress obs
        // that haven't landed in the server response yet (avoids flash-and-disappear)
        const serverIds = new Set(data.map(o => o.id));
        const stillProcessing = prev.filter(
          o => !serverIds.has(o.id) && (o.status === "formatting" || o.status === "researching")
        );
        const merged = [...data, ...stillProcessing];
        return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const submitObservation = useCallback(async (
    rawInput: string,
    inputType: Observation["input_type"] = "text",
    imageData?: string,
    imageMediaType?: string,
    parentId?: string,
    challengeType?: string,
  ): Promise<Observation> => {
    try {
      const resp = await fetch(`${API}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          raw_input: rawInput,
          input_type: inputType,
          ...(imageData && { image_data: imageData, image_media_type: imageMediaType }),
          ...(parentId && { parent_id: parentId }),
          ...(challengeType && { challenge_type: challengeType }),
        }),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const obs: Observation = await resp.json();
      setObservations((prev) => [obs, ...prev]);
      return obs;
    } catch (e: any) {
      throw new Error(e?.message || `Cannot reach API at ${API}. Is VITE_API_URL set?`);
    }
  }, []);

  const pollObservation = useCallback(async (id: string): Promise<Observation | null> => {
    try {
      const resp = await fetch(`${API}/observations/${id}`);
      if (resp.status === 404) {
        setObservations((prev) => prev.filter((o) => o.id !== id));
        return null;
      }
      if (!resp.ok) return null;
      const obs: Observation = await resp.json();
      setObservations((prev) => prev.map((o) => (o.id === id ? obs : o)));
      return obs;
    } catch {
      return null;
    }
  }, []);

  const requestStressTest = useCallback(async (id: string): Promise<import("../types").StressTest | null> => {
    try {
      const resp = await fetch(`${API}/observations/${id}/stress-test`, { method: "POST" });
      if (!resp.ok) return null;
      const data = await resp.json();
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? { ...o, stress_test: data } : o))
      );
      return data;
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
    requestStressTest, deleteObservation,
  };
}
