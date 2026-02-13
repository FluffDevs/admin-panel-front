"use client";
import React, { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import S3Uploader from '../../components/S3Uploader';
import MusicList from '../../components/MusicList';

export default function DashboardPage() {
  const auth = useAuth();

  const [showDebug, setShowDebug] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function decodeJwt(token?: string) {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1];
      const json = JSON.parse(decodeURIComponent(atob(payload).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')));
      return json;
    } catch (e) {
      return { error: String(e) };
    }
  }

  if (auth.isLoading) return <div>Loading auth...</div>;
  if (auth.error) return <div>Auth error: {String(auth.error)}</div>;

  // Show URL error params (Cognito may return error in query string on redirect)
  const urlErrorInfo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const authErrorFromUrl = urlErrorInfo ? (urlErrorInfo.get('error') || urlErrorInfo.get('error_description')) : null;

  const isProgrammateur = (() => {
    try {
      const profile = auth.user?.profile as Record<string, unknown> | undefined;
      const groupsVal = profile?.['cognito:groups'] ?? profile?.groups;
      const groups: string[] = Array.isArray(groupsVal) ? (groupsVal.filter((g) => typeof g === 'string') as string[]) : [];
      // Read allowed groups from NEXT_PUBLIC_ALLOWED_PROGRAMMATEUR_GROUPS (client-side)
      const allowedRaw = process.env.NEXT_PUBLIC_ALLOWED_PROGRAMMATEUR_GROUPS ?? 'programmateur';
      const allowed = allowedRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (allowed.some((g) => groups.includes(g))) return true;
      const role = typeof profile?.role === 'string' ? profile.role as string : (typeof profile?.['custom:role'] === 'string' ? profile['custom:role'] as string : undefined);
      return role === 'programmateur';
    } catch {
      return false;
    }
  })();

  const signOutRedirect = () => {
    // Prefer the library's signoutRedirect which handles end-session properly
    try {
      // react-oidc-context exposes signoutRedirect; narrow via unknown then any-free call
      const maybeSignout = (auth as unknown) as { signoutRedirect?: () => Promise<void> | void };
      if (typeof maybeSignout.signoutRedirect === 'function') {
        void maybeSignout.signoutRedirect();
        return;
      }
    } catch (e) {
      // swallow and fallback to hosted logout
      console.warn('signoutRedirect failed, falling back to hosted logout', e);
    }

    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const logoutUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI ?? `${typeof window !== 'undefined' ? window.location.origin + '/dashboard' : '/dashboard'}`;
    const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    if (!clientId || !cognitoDomain) {
      // final fallback to remove local user session
      auth.removeUser();
      return;
    }
    window.location.href = `https://${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  return (
    <div style={{ padding: 24 }}>
      {!auth.isAuthenticated ? (
        <div>
          <button onClick={() => auth.signinRedirect()}>Se connecter</button>
        </div>
      ) : (
        <div>
          <h2>Bienvenue, {auth.user?.profile?.email ?? auth.user?.profile?.name}</h2>
          <p>Rôle programmateur: {String(isProgrammateur)}</p>
          {authErrorFromUrl && (
            <div style={{ marginTop: 8, color: 'crimson' }}>
              Erreur d&apos;authentification : {authErrorFromUrl}
            </div>
          )}

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <MusicList key={refreshKey} token={auth.user?.access_token ?? auth.user?.id_token} />
            </div>

            <aside style={{ width: 360 }}>
              <h3 className="text-lg font-medium">Uploader</h3>
              <S3Uploader
                token={auth.user?.id_token ?? auth.user?.access_token ?? ''}
                isProgrammateur={isProgrammateur}
                onUpload={(key: string) => {
                  // trigger MusicList refresh by changing key
                  setRefreshKey((k) => k + 1);
                  // show quick feedback
                  console.info('Uploaded key', key);
                }}
              />
            </aside>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={signOutRedirect}>Se déconnecter</button>
            <button style={{ marginLeft: 12 }} onClick={() => setShowDebug((s) => !s)}>
              {showDebug ? 'Cacher debug' : 'Afficher debug'}
            </button>
          </div>

          {showDebug && (
            <div style={{ marginTop: 12, background: '#111827', color: '#e5e7eb', padding: 12, borderRadius: 6 }}>
              <h4>Debug tokens</h4>
              <div style={{ wordBreak: 'break-all', fontSize: 12 }}>
                <strong>ID token:</strong>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{auth.user?.id_token ?? '(none)'}</pre>
                <strong>Decoded ID token payload:</strong>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(decodeJwt(auth.user?.id_token), null, 2)}</pre>

                <strong>Access token:</strong>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{auth.user?.access_token ?? '(none)'}</pre>
                <strong>Decoded access token payload:</strong>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(decodeJwt(auth.user?.access_token), null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
