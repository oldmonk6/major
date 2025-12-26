"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  React.useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (!stored) {
      router.replace("/auth");
      return;
    }
    setToken(stored);
  }, [router]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/tasks/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const complete = async (taskId: string) => {
    await fetch(`${apiBase}/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  useEffect(() => {
    load();
  }, [token]);

  return (
    <div className="card">
      <h1>Today's Tasks</h1>
      <button className="button" onClick={load} disabled={!token || loading}>
        Refresh
      </button>
      <ul className="list">
        {tasks.map((t) => (
          <li key={t.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{t.title}</strong>
                <div>Status: {t.status}</div>
                <div>XP: {t.xp}</div>
              </div>
              {t.status !== "completed" && (
                <button className="button" onClick={() => complete(t.id)}>
                  Complete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
