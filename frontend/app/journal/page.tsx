"use client";

import React, { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function deriveKey(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

async function encryptText(text: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return combined;
}

export default function JournalPage() {
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [tags, setTags] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const submit = async () => {
    if (!token) {
      setStatus("Login first");
      return;
    }
    setStatus("Encrypting...");
    try {
      const encrypted = await encryptText(text, password || "journal-key");
      const blob = new Blob([encrypted], { type: "application/octet-stream" });
      const form = new FormData();
      form.append("file", blob, "journal.enc");
      form.append("emotion_tags", tags);
      const res = await fetch(`${apiBase}/journal/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.detail || "Error");
      } else {
        setStatus(`Uploaded journal ${data.journal_id}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("Error");
    }
  };

  return (
    <div className="card">
      <h1>Journal (client-side encrypted)</h1>
      <label className="label">Entry</label>
      <textarea className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      <label className="label">Passphrase (used to derive key)</label>
      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="label">Emotion tags (comma)</label>
      <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
      <button className="button" onClick={submit}>Encrypt & Upload</button>
      {status && <p>{status}</p>}
    </div>
  );
}
