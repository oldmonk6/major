"use client";

import Link from "next/link";
import React from "react";

export default function LandingPage() {
  return (
    <div className="card">
      <h1>Reclaim Recovery</h1>
      <p style={{ marginBottom: 16 }}>
        Build a personal recovery plan, log check-ins, and get just-in-time coaching. Sign in to get started.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/auth" className="button">
          Get started
        </Link>
        <Link href="/onboard" className="button" style={{ background: "#1f2a3f" }}>
          Go to onboarding
        </Link>
      </div>
    </div>
  );
}
