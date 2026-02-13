"use client";
import React, { useState } from 'react';

type Props = {
  token?: string | null;
  isProgrammateur?: boolean;
  // optional initial page to edit (server proxies GET /musics?page=N)
  initialPage?: number;
  onSaved?: () => void;
};

export default function CacheEditor({ token, isProgrammateur = false, initialPage = 0, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState<number>(initialPage);
  const [nextPageHeader, setNextPageHeader] = useState<string | null>(null);
  const [totalPageHeader, setTotalPageHeader] = useState<string | null>(null);

  async function load() {
    setError(null);
    setSuccess(null);
    if (!token) { setError('Token manquant'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cache?page=${encodeURIComponent(String(page))}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`GET failed ${res.status}`);
      const body = await res.text();
      setText(body);
      setNextPageHeader(res.headers.get('Next-Page'));
      setTotalPageHeader(res.headers.get('Total-Page'));
      setOpen(true);
    } catch (err) {
      const e = err as Error | undefined;
      setError(String(e?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    if (!token) { setError('Token manquant'); setSaving(false); return; }
    try {
      const res = await fetch(`/api/admin/cache?page=${encodeURIComponent(String(page))}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/csv' },
        body: text,
      });
      if (!res.ok) throw new Error(`PUT failed ${res.status}`);
      const json = await res.json();
      if (json?.ok) {
        setSuccess('Enregistré');
        setOpen(false);
        onSaved?.();
      } else {
        setError('Réponse invalide du serveur');
      }
    } catch (err) {
      const e = err as Error | undefined;
      setError(String(e?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  }

  if (!isProgrammateur) {
    return (
      <div className="mt-6">
        <div className="text-sm text-zinc-500">Édition du cache réservée aux programmateurs.</div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium mb-2">Cache CSV</h4>
      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded border px-2 py-1 text-sm">◀</button>
          <input type="number" value={page} onChange={(e) => setPage(Number(e.target.value ?? 0))} className="w-16 text-sm p-1 border rounded text-center" />
          <button onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 text-sm">▶</button>
        </div>
        <button disabled={loading} onClick={load} className="rounded bg-indigo-600 text-white px-3 py-1 text-sm">{loading ? 'Chargement...' : `Éditer page ${page}`}</button>
        <button onClick={() => setOpen((s) => !s)} className="rounded border px-3 py-1 text-sm">{open ? 'Fermer' : 'Ouvrir'}</button>
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        <span>Next-Page: {nextPageHeader ?? '-'}</span>
        <span className="mx-2">|</span>
        <span>Total-Page: {totalPageHeader ?? '-'}</span>
      </div>

      {error && <div className="mt-3 text-sm text-rose-600">Erreur: {error}</div>}
      {success && <div className="mt-3 text-sm text-green-700">{success}</div>}

      {open && (
        <div className="mt-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-48 p-2 border rounded text-xs font-mono" />
          <div className="flex gap-2 mt-2">
            <button disabled={saving} onClick={save} className="rounded bg-green-600 text-white px-3 py-1 text-sm">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            <button onClick={() => { setOpen(false); setError(null); setSuccess(null); }} className="rounded border px-3 py-1 text-sm">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
