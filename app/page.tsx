"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "react-oidc-context";

export default function Home() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [auth.isAuthenticated, router]);

  if (auth.isLoading) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Connexion</h1>
      {auth.error && <div>Erreur d'auth: {String(auth.error?.message || auth.error)}</div>}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => auth.signinRedirect()}>Se connecter</button>
      </div>
    </div>
  );
}
