"use client";

import { useRouter } from "next/navigation";
import React from "react";

export default function LogoutPage() {
  const router = useRouter();

  React.useEffect(() => {
    localStorage.removeItem("reclaim_token");
    localStorage.removeItem("reclaim_user_id");
    router.replace("/auth");
  }, [router]);

  return (
    <div className="card">
      <h1>Signing out...</h1>
      <p>Redirecting you to sign in.</p>
    </div>
  );
}
