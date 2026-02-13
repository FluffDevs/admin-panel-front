"use client";
import React, { useEffect } from "react";
import Image from "next/image";
import { useAuth } from "react-oidc-context";

export default function LoginPage() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      // redirect on the client once authentication is established
      if (typeof window !== "undefined") window.location.href = "/dashboard";
    }
  }, [auth.isAuthenticated]);

  if (auth.isLoading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 via-white to-rose-50">
      <div className="w-full max-w-md bg-white/95 shadow-xl rounded-2xl p-8">
        <div className="flex flex-col items-center gap-4">
          <Image src="/file.svg" alt="Fluff Radio" width={96} height={96} />
          <h1 className="text-2xl font-semibold">Fluff Radio — Admin</h1>
          <p className="text-sm text-zinc-600 text-center">Connectez-vous pour gérer les musiques, uploader et administrer votre radio.</p>

          {auth.error && (
            <div className="mt-2 text-sm text-red-600">Erreur d&apos;authentification: {String(auth.error)}</div>
          )}

          <div className="w-full mt-4">
            <button
              onClick={() => auth.signinRedirect()}
              className="w-full btn-fluff hover:opacity-95 transition"
            >
              Se connecter
            </button>
          </div>

          <div className="w-full mt-4 text-xs text-zinc-500 text-center">
            En vous connectant via Cognito, vous acceptez les conditions d&apos;utilisation.
          </div>
        </div>
      </div>
    </div>
  );
}
