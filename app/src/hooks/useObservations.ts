import { useState, useCallback } from "react";
import type { Observation, Counterpoint, PvaTake } from "../types";
import { buildInstanceUrl, authHeaders } from "../utils/api";
import { useInstanceConfig } from "../contexts/InstanceContext";

export function useObservations() {
  const { instanceKey } = useInstanceConfig();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchObservations = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildInstanceUrl(instanceKey, "/observations");
      const resp = await fetch(url, { headers: authHeaders() });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data: Observation[] = await resp.json();
      setObservations(data);
    } finally {
      setLoading(false);
    }
  }, [instanceKey]);

  const submitObservation = useCallback(async (
    rawInput: string,
    inputType: Observation["input_type"] = "text",
    imageData?: string,
    imageMediaType?: string,
    parentId?: string,
    challengeType?: string,
  ): Promise<Observation> => {
    try {
      const url = buildInstanceUrl(instanceKey, "/observations");
      const resp = await fetch(url, {
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
      throw new Error(e?.message || `Cannot reach API. Is VITE_API_URL set?`);
    }
  }, [instanceKey]);

  const pollObservation = useCallback(async (id: string): Promise<Observation | null> => {
    try {
      const url = buildInstanceUrl(instanceKey, `/observations/${id}`);
      const resp = await fetch(url);
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
  }, [instanceKey]);

  const requestStressTest = useCallback(async (id: string): Promise<import("../types").StressTest | null> => {
    try {
      const url = buildInstanceUrl(instanceKey, `/observations/${id}/stress-test`);
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) return null;
      const data = await resp.json();
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? { ...o, stress_test: data } : o))
      );
      return data;
    } catch {
      return null;
    }
  }, [instanceKey]);

  const requestCounterpoint = useCallback(async (id: string): Promise<Counterpoint | null> => {
    try {
      const url = buildInstanceUrl(instanceKey, `/observations/${id}/counterpoint`);
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) return null;
      const data: Counterpoint = await resp.json();
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? { ...o, stress_test: data } : o))
      );
      return data;
    } catch {
      return null;
    }
  }, [instanceKey]);

  const requestPvaTake = useCallback(async (id: string, voice: string = "all"): Promise<PvaTake | null> => {
    try {
      const url = buildInstanceUrl(instanceKey, `/observations/${id}/pva-take`);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice }),
      });
      if (!resp.ok) return null;
      const data: PvaTake = await resp.json();
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? { ...o, pva_take: data } : o))
      );
      return data;
    } catch {
      return null;
    }
  }, [instanceKey]);

  const editObservation = useCallback(async (
    id: string,
    rawInput: string,
    inputType: string = "text",
    imageData?: string,
    imageMediaType?: string,
  ): Promise<Observation> => {
    const url = buildInstanceUrl(instanceKey, `/observations/${id}`);
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        raw_input: rawInput,
        input_type: inputType,
        ...(imageData && { image_data: imageData, image_media_type: imageMediaType }),
      }),
    });
    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    const obs: Observation = await resp.json();
    setObservations((prev) => prev.map((o) => (o.id === id ? obs : o)));
    return obs;
  }, [instanceKey]);

  const deleteObservation = useCallback(async (id: string) => {
    const url = buildInstanceUrl(instanceKey, `/observations/${id}`);
    await fetch(url, { method: "DELETE", headers: authHeaders() });
    setObservations((prev) => prev.filter((o) => o.id !== id));
  }, [instanceKey]);

  return {
    observations, loading,
    fetchObservations, submitObservation, editObservation, pollObservation,
    requestStressTest, requestCounterpoint, requestPvaTake, deleteObservation,
  };
}
