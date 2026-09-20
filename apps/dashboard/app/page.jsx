"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RivenLiveCommandDeck from "./components/RivenLiveCommandDeck";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function Home() {
  const [query, setQuery] = useState("");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [executing, setExecuting] = useState(false);
  const [system, setSystem] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sources, setSources] = useState([]);
  const sourceRef = useRef(null);

  async function refreshDocuments() {
    const response = await fetch(`${API_BASE}/api/documents`);
    if (response.ok) setDocuments(await response.json());
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/system/status`)
      .then((response) => response.ok ? response.json() : null)
      .then(setSystem)
      .catch(() => setSystem(null));
    refreshDocuments().catch(() => {});
    return () => sourceRef.current?.close();
  }, []);

  const agentStates = useMemo(() => {
    const map = new Map();
    for (const task of run?.tasks || []) {
      map.set(task.agent_id, { ...task, latest: task.status || "assigned" });
    }
    for (const event of events) {
      if (!event.agent_id) continue;
      const current = map.get(event.agent_id) || { agent_id: event.agent_id };
      map.set(event.agent_id, {
        ...current,
        latest: event.type,
        message: event.message,
      });
    }
    return [...map.values()];
  }, [run, events]);

  const orchestratorState = useMemo(() => {
    const latest = [...events].reverse().find((event) => !event.agent_id);
    return latest?.type || run?.status || "ready";
  }, [events, run]);

  const liveWebSources = useMemo(
    () => events.filter((event) => event.type === "source.found" && event.metadata?.origin === "web"),
    [events],
  );

  const followUps = useMemo(
    () => events.filter((event) => event.type === "follow_up.requested"),
    [events],
  );

  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API_BASE}/api/documents`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Document upload failed.");
      await refreshDocuments();
    } catch (err) {
      setError(err.message || "Document upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function previewEvidence() {
    if (query.trim().length < 2) return;
    try {
      const response = await fetch(`${API_BASE}/api/sources/search?q=${encodeURIComponent(query)}&limit=6`);
      if (response.ok) setSources(await response.json());
    } catch {
      // Preview is optional and should not block mission execution.
    }
  }

  async function startResearch(event) {
    event.preventDefault();
    setError("");
    setEvents([]);
    setExecuting(true);
    sourceRef.current?.close();

    try {
      await previewEvidence();
      const response = await fetch(`${API_BASE}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error("Could not create research run.");

      const nextRun = await response.json();
      setRun(nextRun);

      const source = new EventSource(`${API_BASE}/api/runs/${nextRun.id}/events`);
      sourceRef.current = source;
      source.onmessage = (message) => {
        const payload = JSON.parse(message.data);
        setEvents((current) => [...current, payload]);
      };
      source.onerror = () => setError((current) => current || "Live event stream disconnected.");

      const executeResponse = await fetch(`${API_BASE}/api/runs/${nextRun.id}/execute`, { method: "POST" });
      if (!executeResponse.ok) {
        const payload = await executeResponse.json().catch(() => ({}));
        throw new Error(payload.detail || "Research execution could not start.");
      }
      setRun(await executeResponse.json());
    } catch (err) {
      setError(err.message || "Research execution failed.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <RivenLiveCommandDeck
      system={system}
      documents={documents}
      sources={sources}
      query={query}
      setQuery={setQuery}
      uploadDocument={uploadDocument}
      uploading={uploading}
      previewEvidence={previewEvidence}
      startResearch={startResearch}
      executing={executing}
      error={error}
      run={run}
      events={events}
      agentStates={agentStates}
      orchestratorState={orchestratorState}
      liveWebSources={liveWebSources}
      followUps={followUps}
    />
  );
}
