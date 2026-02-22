"use client";

import React, { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    // Clear localStorage
    localStorage.removeItem("reclaim_token");
    localStorage.removeItem("reclaim_user_id");

    // Redirect to home
    setTimeout(() => {
      window.location.href = "/";
    }, 500);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        color: "var(--text-primary)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="loading-spinner" style={{ marginBottom: "1rem" }} />
        <p>Signing you out...</p>
      </div>
    </div>
  );
}
