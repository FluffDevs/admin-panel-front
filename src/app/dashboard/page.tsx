"use client";
import React, { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import S3Uploader from '../../components/S3Uploader';
import MusicList from '../../components/MusicList';
import CacheEditor from '../../components/CacheEditor';
import Image from 'next/image';

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

  if (auth.isLoading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  if (auth.error) return <div className="min-h-screen flex items-center justify-center">Erreur d&apos;authentification: {String(auth.error)}</div>;

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

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Vous n&apos;êtes pas connecté</h2>
          <button onClick={() => auth.signinRedirect()} className="rounded-full bg-zinc-900 text-white px-6 py-2">Se connecter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-black shadow-sm">
        <div className="flex items-center gap-4">
          <Image src="/file.svg" alt="Fluff Radio" width={40} height={40} />
          <div>
            <div className="font-semibold">Fluff Radio</div>
            <div className="text-xs text-zinc-500">Panneau d&apos;administration</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-700">{auth.user?.profile?.email ?? auth.user?.profile?.name}</div>
          <button onClick={signOutRedirect} className="rounded-full border px-3 py-1 text-sm">Se déconnecter</button>
        </div>
      </header>

      <main className="p-6">
        {authErrorFromUrl && (
          <div className="mb-4 rounded-md bg-rose-50 border border-rose-100 text-rose-700 p-3">Erreur d&apos;authentification : {authErrorFromUrl}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Liste des musiques</h3>
              <div className="text-sm text-zinc-500">Rôle programmateur: {String(isProgrammateur)}</div>
            </div>

            <MusicList key={refreshKey} token={auth.user?.access_token ?? auth.user?.id_token} />
          </section>

          <aside className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Uploader</h3>
            <S3Uploader
              token={auth.user?.id_token ?? auth.user?.access_token ?? ''}
              isProgrammateur={isProgrammateur}
              onUpload={(key: string) => {
                setRefreshKey((k) => k + 1);
                console.info('Uploaded key', key);
              }}
            />

            <CacheEditor token={auth.user?.id_token ?? auth.user?.access_token ?? ''} isProgrammateur={isProgrammateur} onSaved={() => setRefreshKey((k) => k + 1)} />

            <div className="mt-6">
              <button onClick={() => setShowDebug((s) => !s)} className="text-sm text-zinc-600 underline">{showDebug ? 'Cacher debug' : 'Afficher debug'}</button>
            </div>

            {showDebug && (
              <div className="mt-4 bg-slate-900 text-slate-100 p-3 rounded">
                <h4 className="font-medium mb-2">Debug tokens</h4>
                <div className="text-xs break-words">
                  <strong>ID token:</strong>
                  <pre className="whitespace-pre-wrap text-[11px]">{auth.user?.id_token ?? '(none)'}</pre>
                  <strong>Decoded ID token payload:</strong>
                  <pre className="whitespace-pre-wrap text-[11px]">{JSON.stringify(decodeJwt(auth.user?.id_token), null, 2)}</pre>

                  <strong>Access token:</strong>
                  <pre className="whitespace-pre-wrap text-[11px]">{auth.user?.access_token ?? '(none)'}</pre>
                  <strong>Decoded access token payload:</strong>
                  <pre className="whitespace-pre-wrap text-[11px]">{JSON.stringify(decodeJwt(auth.user?.access_token), null, 2)}</pre>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
