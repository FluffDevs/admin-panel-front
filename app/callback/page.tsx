"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "react-oidc-context";

export default function CallbackPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handle = async () => {
      try {
        if (auth && typeof (auth as any).signinRedirectCallback === "function") {
          // @ts-ignore
          await (auth as any).signinRedirectCallback();
        }
      } catch (e) {
        // swallow - show a console message
        // eslint-disable-next-line no-console
        console.error("OIDC callback error", e);
      } finally {
        router.replace("/dashboard");
      }
    };

    handle();
  }, [auth, router]);

  return <div>Processing authentication callback...</div>;
}
