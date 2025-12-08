"use client";
import React from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.isLoading) return <div>Loading...</div>;

  if (!auth.isAuthenticated) {
    // redirect to login
    router.replace("/");
    return null;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      <div>
        <strong>Email:</strong> {auth.user?.profile?.email}
        access_token: {auth.user?.access_token}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => auth.signoutRedirect()}>Se déconnecter</button>
      </div>
    </div>
  );
}
