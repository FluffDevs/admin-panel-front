"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import S3Uploader from '../../components/S3Uploader';
import Button from '../../components/Button';
import MusicList from '../../components/MusicList';
import CacheEditor from '../../components/CacheEditor';
import Image from 'next/image';

export default function DashboardPage() {
  const auth = useAuth();

  const [showDebug, setShowDebug] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, [setSelectedIds]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // cleanup blob url when component unmounts or when playingUrl changes
  useEffect(() => {
    return () => {
      try { if (playingUrl) URL.revokeObjectURL(playingUrl); } catch {}
    };
  }, [playingUrl]);

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
                {playingUrl && (
                  <div style={{ marginTop: 8 }}>
                    <h5 className="text-sm font-medium">Lecteur</h5>
                    <audio src={playingUrl} controls autoPlay style={{ width: '100%', marginTop: 6 }} onEnded={async () => {
                      // play next in selectedIds order
                      try {
                        const list = selectedIds;
                        if (!list || list.length === 0) return;
                        const idx = list.indexOf(playingId ?? '');
                        const next = (idx >= 0 && idx + 1 < list.length) ? list[idx + 1] : null;
                        if (!next) return; // end of queue
                        const url = (process.env.NEXT_PUBLIC_API_PROXY === '1' ? '/api' : (process.env.NEXT_PUBLIC_API_BASE_URL ?? '')) + `/musics/${encodeURIComponent(next)}/download`;
                        const headersInit: Record<string,string> = {};
                        const token = auth.user?.access_token ?? auth.user?.id_token;
                        if (token) headersInit['Authorization'] = `Bearer ${token}`;
                        const res = await fetch(url, { method: 'GET', headers: headersInit, credentials: 'include' });
                        if (!res.ok) throw new Error(`Téléchargement: ${res.status}`);
                        const blob = await res.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        if (playingUrl) try { URL.revokeObjectURL(playingUrl); } catch {}
                        setPlayingUrl(objectUrl);
                        setPlayingId(next);
                      } catch (err) {
                        console.error('queue next play error', err);
                      }
                    }} />
                    <div style={{ marginTop: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => { try { if (playingUrl) URL.revokeObjectURL(playingUrl); } catch {} setPlayingUrl(null); setPlayingId(null); }}>Stop</Button>
                    </div>
                  </div>
                )}
                {selectedIds.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <h5 className="text-sm font-medium mb-2">File d&apos;attente</h5>
                    <ol className="text-sm text-zinc-600" style={{ paddingLeft: 18, margin: 0 }}>
                      {selectedIds.map((id, idx) => (
                        <li key={id} style={{ marginBottom: 6 }}>
                          <strong style={{ marginRight: 8 }}>{idx + 1}.</strong> {id}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <section className="panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Liste des musiques</h3>
              <div className="text-sm text-zinc-500">Rôle programmateur: {String(isProgrammateur)}</div>
            </div>

            {/* stable callback to avoid causing effect loops in MusicList */}
            <MusicList key={refreshKey} token={auth.user?.access_token ?? auth.user?.id_token} onSelectionChange={handleSelectionChange} />
          </section>
          <aside className="panel">
            <h3 className="text-lg font-semibold mb-3">Uploader</h3>
            <S3Uploader
              token={auth.user?.id_token ?? auth.user?.access_token ?? ''}
              isProgrammateur={isProgrammateur}
              onUpload={(key: string) => {
                setRefreshKey((k) => k + 1);
                console.info('Uploaded key', key);
              }}
            />

            {/* Actions for selected tracks */}
            <div className="mt-4 uploader-actions">
              <h4 className="text-sm font-medium mb-2">Actions sélection</h4>
              <div className="flex flex-col gap-2">
                <div className="text-sm text-zinc-600">Sélection: {selectedIds.length}</div>
                <div className="flex gap-2 uploader-actions-row">
                  <Button variant="outline" size="sm" onClick={async () => {
                    // download selected sequentially
                    for (const id of selectedIds) {
                      try {
                        const url = (process.env.NEXT_PUBLIC_API_PROXY === '1' ? '/api' : (process.env.NEXT_PUBLIC_API_BASE_URL ?? '')) + `/musics/${encodeURIComponent(id)}/download`;
                        const headersInit: Record<string,string> = {};
                        const token = auth.user?.access_token ?? auth.user?.id_token;
                        if (token) headersInit['Authorization'] = `Bearer ${token}`;
                        const res = await fetch(url, { method: 'GET', headers: headersInit, credentials: 'include' });
                        if (!res.ok) throw new Error(`Téléchargement: ${res.status}`);
                        const blob = await res.blob();
                        const disposition = res.headers.get('Content-Disposition') ?? '';
                        let filename = id;
                        const m = /filename="?([^";]+)"?/.exec(disposition);
                        if (m && m[1]) filename = m[1];
                        const objectUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = objectUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(objectUrl);
                      } catch (e) {
                        console.error('download selected error', e);
                        alert(String(e));
                      }
                    }
                  }} disabled={selectedIds.length===0}>Télécharger</Button>

                  <Button variant="outline" size="sm" onClick={async () => {
                    // play selected - require single selection
                    if (selectedIds.length !== 1) return alert('Sélectionnez une seule piste pour écouter.');
                    const id = selectedIds[0];
                    try {
                      const url = (process.env.NEXT_PUBLIC_API_PROXY === '1' ? '/api' : (process.env.NEXT_PUBLIC_API_BASE_URL ?? '')) + `/musics/${encodeURIComponent(id)}/download`;
                      const headersInit: Record<string,string> = {};
                      const token = auth.user?.access_token ?? auth.user?.id_token;
                      if (token) headersInit['Authorization'] = `Bearer ${token}`;
                      const res = await fetch(url, { method: 'GET', headers: headersInit, credentials: 'include' });
                      if (!res.ok) throw new Error(`Téléchargement: ${res.status}`);
                      const blob = await res.blob();
                      const objectUrl = URL.createObjectURL(blob);
                      // revoke previous
                      if (playingUrl) URL.revokeObjectURL(playingUrl);
                      setPlayingUrl(objectUrl);
                      setPlayingId(id);
                    } catch (err) {
                      console.error('play error', err);
                      alert(String(err));
                    }
                  }} disabled={selectedIds.length===0}>Écouter</Button>

                  <Button variant="outline" size="sm" onClick={async () => {
                    if (selectedIds.length === 0) return alert('Aucune sélection.');
                    if (!confirm(`Confirmer la suppression de ${selectedIds.length} élément(s) ?`)) return;
                    const token = auth.user?.access_token ?? auth.user?.id_token;
                    for (const id of selectedIds) {
                      try {
                        const url = (process.env.NEXT_PUBLIC_API_PROXY === '1' ? '/api' : (process.env.NEXT_PUBLIC_API_BASE_URL ?? '')) + `/musics/${encodeURIComponent(id)}`;
                        const headersInit: Record<string,string> = {};
                        if (token) headersInit['Authorization'] = `Bearer ${token}`;
                        const res = await fetch(url, { method: 'DELETE', headers: headersInit, credentials: 'include' });
                        if (!res.ok) {
                          const t = await res.text().catch(()=>`HTTP ${res.status}`);
                          throw new Error(t);
                        }
                      } catch (e) {
                        console.error('delete selected error', e);
                        alert(String(e));
                      }
                    }
                    // refresh list
                    setRefreshKey((k) => k + 1);
                  }} disabled={selectedIds.length===0} className="text-rose-600">Supprimer</Button>

                  <label className="btn-outline-fluff btn-sm cursor-pointer">
                    Remplacer
                    <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (selectedIds.length !== 1) return alert('Sélectionnez une seule piste pour remplacer.');
                      const id = selectedIds[0];
                      try {
                        const url = (process.env.NEXT_PUBLIC_API_PROXY === '1' ? '/api' : (process.env.NEXT_PUBLIC_API_BASE_URL ?? '')) + `/musics/${encodeURIComponent(id)}`;
                        const headersInit: Record<string,string> = { 'Content-Type': f.type || 'application/octet-stream' };
                        const token = auth.user?.access_token ?? auth.user?.id_token;
                        if (token) headersInit['Authorization'] = `Bearer ${token}`;
                        const res = await fetch(url, { method: 'PUT', headers: headersInit, body: f, credentials: 'include' });
                        if (!res.ok) throw new Error(`Replace failed ${res.status}`);
                        setRefreshKey((k) => k + 1);
                        alert('Fichier remplacé');
                      } catch (err) {
                        console.error('replace selected error', err);
                        alert(String(err));
                      }
                    }} />
                  </label>
                </div>
              </div>
            </div>

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
