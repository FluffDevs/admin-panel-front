"use client";
import React from 'react';
import { AuthProvider } from 'react-oidc-context';

type Props = {
  children: React.ReactNode;
};

export default function AuthProviderClient({ children }: Props) {
  const authority = process.env.NEXT_PUBLIC_COGNITO_ISSUER;
  const client_id = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const redirect_uri = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI ?? `${window.location.origin}/dashboard`)
    : '/dashboard';

  const scope = process.env.NEXT_PUBLIC_COGNITO_SCOPE ?? 'openid profile email';

  const oidcConfig = {
    authority,
    client_id,
    redirect_uri,
    response_type: 'code',
    scope,
    automaticSilentRenew: true,
  } as unknown;

  // Debug helpers: log config so dev can check mismatches in browser console
  if (typeof window !== 'undefined') {
    console.info('OIDC config', { authority, client_id, redirect_uri });
    if (!authority || !client_id) {
      console.warn('OIDC config missing NEXT_PUBLIC_COGNITO_ISSUER or NEXT_PUBLIC_COGNITO_CLIENT_ID');
    }
  }

  return <AuthProvider {...(oidcConfig as unknown as Record<string, unknown>)}>{children}</AuthProvider>;
}
