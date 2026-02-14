"use client";
import React, { useEffect, useState } from 'react';
import Button from './Button';

type Props = {
  token?: string | null;
  onSelectionChange?: (ids: string[]) => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://nu8n9r0hl5.execute-api.eu-west-1.amazonaws.com';
const USE_PROXY = process.env.NEXT_PUBLIC_API_PROXY === '1';

function apiUrl(path: string) {
  const resolved = USE_PROXY ? `/api${path}` : `${API_BASE}${path}`;
  // Debug helper: log which base is used so we can troubleshoot "local vs remote" calls
  if (typeof window !== 'undefined') {
    console.debug('[MusicList apiUrl]', { path, USE_PROXY, resolved });
  }
  return resolved;
}

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

export default function MusicList({ token, onSelectionChange }: Props) {
  // NOTE: API pages are 0-based
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [totalPage, setTotalPage] = useState<number | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // preserve selection order (useful for playlists/queue)
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  // Debug: keep raw response body from last GET /musics
  const [lastFetchRaw, setLastFetchRaw] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<boolean>(false);
  // Auto-refresh controls
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(30000); // default 30s
  const [refreshKey, setRefreshKey] = useState<number>(0);
  // edit state for row metadata
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingMetadata, setEditingMetadata] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
  const url = apiUrl(`/musics?page=${page}`);
        // Request CSV explicitly and prefer CSV parsing. Keep JSON fallback if API ignores Accept.
        const headersInit: Record<string, string> = { 'Accept': 'text/csv' };
        if (token) headersInit['Authorization'] = `Bearer ${token}`;
        const res = await fetch(url, { method: 'GET', headers: headersInit, credentials: 'include', mode: 'cors' });
        if (!mounted) return;
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = await res.text();
        // store raw response for debugging / inspection
        try { setLastFetchRaw(text); } catch {}

        let usedNext: number | null = null;
        let usedTotal: number | null = null;

        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          // backend returned JSON despite Accept header — keep previous JSON handling
          try {
            const jsonParsed = JSON.parse(text) as unknown;
            if (jsonParsed && typeof jsonParsed === 'object' && 'data' in (jsonParsed as Record<string, unknown>) && Array.isArray((jsonParsed as Record<string, unknown>)['data'])) {
              const data = (jsonParsed as Record<string, unknown>)['data'] as unknown[];
              const rowsParsed: Record<string, string>[] = data.map((item) => {
                const obj: Record<string, string> = {};
                if (item && typeof item === 'object') {
                  const rec = item as Record<string, unknown>;
                  Object.keys(rec).forEach((k) => {
                    const v = rec[k];
                    obj[k] = (v === null || typeof v === 'undefined') ? '' : String(v);
                  });
                }
                return obj;
              });
              setRows(rowsParsed);
              setHeaders(rowsParsed.length > 0 ? Object.keys(rowsParsed[0]) : []);

              if ('metadata' in (jsonParsed as Record<string, unknown>) && (jsonParsed as Record<string, unknown>)['metadata'] && typeof (jsonParsed as Record<string, unknown>)['metadata'] === 'object') {
                const md = (jsonParsed as Record<string, unknown>)['metadata'] as Record<string, unknown> | undefined;
                if (md) {
                  usedNext = typeof md.page === 'number' ? md.page as number : null;
                  usedTotal = typeof md.total_pages === 'number' ? md.total_pages as number : (typeof md.total_pages === 'string' ? Number(md.total_pages as string) : null);
                  if (typeof usedTotal !== 'number') usedTotal = null;
                }
              }
            } else {
              // unexpected JSON shape — fallthrough to CSV parsing
              const parsed = parseCsv(text);
              setHeaders(parsed.headers);
              setRows(parsed.rows);
              const next = res.headers.get('Next-Page');
              const total = res.headers.get('Total-Page');
              usedNext = next ? Number(next) : null;
              usedTotal = total ? Number(total) : null;
            }
          } catch {
            // JSON parse error — fallback to CSV
            const parsed = parseCsv(text);
            setHeaders(parsed.headers);
            setRows(parsed.rows);
            const next = res.headers.get('Next-Page');
            const total = res.headers.get('Total-Page');
            usedNext = next ? Number(next) : null;
            usedTotal = total ? Number(total) : null;
          }
        } else {
          // Prefer CSV parsing
          const parsed = parseCsv(text);
          setHeaders(parsed.headers);
          setRows(parsed.rows);
          const next = res.headers.get('Next-Page');
          const total = res.headers.get('Total-Page');
          usedNext = next ? Number(next) : null;
          usedTotal = total ? Number(total) : null;
        }

        setNextPage(usedNext);
        setTotalPage(usedTotal);
    } catch (e: unknown) {
      setError(String((e as { message?: string })?.message ?? e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [page, token, refreshKey]);

  // When rows change, drop selections that no longer exist
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const idSet = new Set(rows.map((r) => (r.id ?? r.ID ?? r.Id ?? r['id'] ?? '')));
      prev.forEach((v) => { if (idSet.has(v)) next.add(v); });
      // prune selectedOrder as well, keep order
      setSelectedOrder((ord) => ord.filter((id) => idSet.has(id)));
      return next;
    });
  }, [rows]);

  // notify parent whenever selection changes
  useEffect(() => {
    try {
      if (typeof onSelectionChange === 'function') onSelectionChange(selectedOrder.length ? selectedOrder : Array.from(selectedIds));
    } catch {}
  }, [selectedIds, selectedOrder, onSelectionChange]);

  // Timer to trigger refreshKey when autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = Math.max(1000, refreshIntervalMs);
    const id = setInterval(() => setRefreshKey((k) => k + 1), interval);
    return () => clearInterval(id);
  }, [autoRefresh, refreshIntervalMs]);

  const playMusic = async (id: string) => {
    try {
    const url = apiUrl(`/musics/${encodeURIComponent(id)}/download`);
      const headersInit: Record<string, string> = {};
      if (token) headersInit['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers: headersInit, credentials: 'include', mode: 'cors' });
      if (!res.ok) throw new Error(`Téléchargement: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPlayingUrl(objectUrl);
    } catch (e: unknown) {
      setError(String((e as { message?: string })?.message ?? e));
    }
  };

    // PATCH metadata
    const patchMetadata = async (id: string, metadata: Record<string, unknown>) => {
      try {
        const url = apiUrl(`/musics/${encodeURIComponent(id)}`);
        const headersInit: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headersInit['Authorization'] = `Bearer ${token}`;
        const res = await fetch(url, { method: 'PATCH', headers: headersInit, body: JSON.stringify(metadata), credentials: 'include', mode: 'cors' });
        if (!res.ok) throw new Error(`Patch failed ${res.status}`);
        const json = await res.json();
        // optionally update UI from returned metadata
        setRefreshKey((k) => k + 1);
        return json;
      } catch (e: unknown) {
        setError(String((e as { message?: string })?.message ?? e));
        throw e;
      }
    };

    // PUT replace audio file
    const replaceFile = async (id: string, fileToUpload: File) => {
      try {
        const url = apiUrl(`/musics/${encodeURIComponent(id)}`);
        const headersInit: Record<string, string> = {};
        if (token) headersInit['Authorization'] = `Bearer ${token}`;
        const contentType = fileToUpload.type || 'application/octet-stream';
        headersInit['Content-Type'] = contentType;
        const res = await fetch(url, { method: 'PUT', headers: headersInit, body: fileToUpload, credentials: 'include', mode: 'cors' });
        if (!res.ok) throw new Error(`Replace failed ${res.status}`);
        const json = await res.json();
        setRefreshKey((k) => k + 1);
        return json;
      } catch (e: unknown) {
        setError(String((e as { message?: string })?.message ?? e));
        throw e;
      }
    };

    // DELETE music (optimistic removal + detailed errors)
    const deleteMusic = async (id: string) => {
      if (!id) return setError('ID invalide');
      if (!confirm('Confirmer la suppression de cette musique ?')) return;

  // Don't remove from UI until server confirms deletion. Keep a snapshot in case we need to rollback.
  // Keep snapshot in case needed for debugging or rollback (currently unused)
  // const prevRows = rows.slice();
  setDeletingId(id);

      // Try deletion strategies and gather diagnostics
      const attempts: Array<() => Promise<Response | null>> = [];

      // 1) DELETE /musics/{id}
      attempts.push(async () => {
        const url = apiUrl(`/musics/${encodeURIComponent(id)}`);
        const headersInit: Record<string, string> = {};
        if (token) headersInit['Authorization'] = `Bearer ${token}`;
        return fetch(url, { method: 'DELETE', headers: headersInit, credentials: 'include', mode: 'cors' });
      });

      // 2) DELETE /musics with JSON body { id }
      attempts.push(async () => {
        const url = apiUrl(`/musics`);
        const headersInit: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headersInit['Authorization'] = `Bearer ${token}`;
        return fetch(url, { method: 'DELETE', headers: headersInit, body: JSON.stringify({ id }), credentials: 'include', mode: 'cors' });
      });

      // 3) DELETE /musics?id={id} as fallback
      attempts.push(async () => {
        const url = apiUrl(`/musics?id=${encodeURIComponent(id)}`);
        const headersInit: Record<string, string> = {};
        if (token) headersInit['Authorization'] = `Bearer ${token}`;
        return fetch(url, { method: 'DELETE', headers: headersInit, credentials: 'include', mode: 'cors' });
      });

      let lastErr: string | null = null;
      for (let i = 0; i < attempts.length; i++) {
        try {
          const attemptNum = i + 1;
          // Log which URL we will call for this attempt (the attempt() closure builds it)
          console.debug('[deleteMusic] attempting', { id, attempt: attemptNum });
          const res = await attempts[i]();
          if (!res) continue;
          // Diagnostic logging of response
          try {
            const clone = res.clone();
            const bodyText = await clone.text().catch(() => '<<no-body>>');
            console.debug('[deleteMusic] attempt result', { id, attempt: attemptNum, url: res.url ?? 'unknown', status: res.status, statusText: res.statusText, ok: res.ok, body: bodyText });
          } catch (logErr) {
            console.debug('[deleteMusic] logging failed', logErr);
          }

          if (res.ok) {
            setError(null);
            // Remove from UI now that server confirmed deletion
            setRows((rs) => rs.filter((r) => (r.id ?? r.ID ?? r.Id ?? r['id'] ?? '') !== id));
            setSelectedIds((s) => { const next = new Set(s); next.delete(id); return next; });
            // Force reload: go back to first page and refresh key to ensure fresh data from API
            try { setPage(0); } catch {}
            setRefreshKey((k) => k + 1);
            setDeletingId(null);
            // Inform user
            try { alert('Suppression réussie'); } catch {};
            return;
          }

          // Read response body for diagnostics (non-ok case)
          const text = await res.text().catch(() => `HTTP ${res.status}`);
          lastErr = `Attempt ${attemptNum} failed: ${res.status} ${res.statusText} - ${text}`;
          // continue to next attempt
        } catch (e: unknown) {
          lastErr = `Attempt ${i + 1} error: ${String((e as { message?: string })?.message ?? e)}`;
          console.debug('[deleteMusic] attempt exception', { id, attempt: i + 1, err: lastErr });
        }
      }

      // All attempts failed
      setDeletingId(null);
      setError(lastErr ?? 'Delete failed (unknown error)');
    };

  const downloadMusic = async (id: string) => {
    if (!id) return;
    try {
      const url = apiUrl(`/musics/${encodeURIComponent(id)}/download`);
      const headersInit: Record<string, string> = {};
      if (token) headersInit['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { method: 'GET', headers: headersInit, credentials: 'include', mode: 'cors' });
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
    } catch (e: unknown) {
      setError(String((e as { message?: string })?.message ?? e));
    }
  };

  const downloadSelected = async () => {
    const list = selectedOrder.length ? selectedOrder : Array.from(selectedIds);
    if (list.length === 0) return setError('Aucune sélection.');
    // download sequentially to avoid spamming the browser
    for (const id of list) {
      await downloadMusic(id);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
        setSelectedOrder((ord) => (ord.includes(id) ? ord : [...ord, id]));
      } else {
        next.delete(id);
        setSelectedOrder((ord) => ord.filter((x) => x !== id));
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = rows.map((r) => (r.id ?? r.ID ?? r.Id ?? r['id'] ?? ''));
      const all = new Set(allIds);
      setSelectedIds(all);
      setSelectedOrder(allIds);
    } else {
      setSelectedIds(new Set());
      setSelectedOrder([]);
    }
  };

  return (
    <div>
      <div className="music-toolbar">
        <div className="left">
          <div>
            <h3 className="text-lg font-semibold">Liste des musiques</h3>
            <div className="text-xs text-zinc-500">Page {page + 1}{totalPage ? ` / ${totalPage}` : ''} — Next: {nextPage ?? '-'}</div>
          </div>
        </div>

        <div className="right">
          <div className="text-sm text-zinc-600">Sélectionnées: {selectedIds.size}</div>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>Effacer</Button>
          <Button variant="primary" size="sm" onClick={downloadSelected}>Télécharger</Button>
        </div>
      </div>

      {/* Auto-refresh controls */}
      <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Auto-refresh</span>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>Intervalle (s)</span>
          <input type="number" min={1} value={Math.max(1, Math.round(refreshIntervalMs / 1000))} onChange={(e) => { const v = Number(e.target.value || '0'); setRefreshIntervalMs(Math.max(1, Math.floor(v)) * 1000); }} style={{ width: 80 }} disabled={!autoRefresh} />
        </label>
        {autoRefresh && <div style={{ fontSize: 12, color: '#6b7280' }}>Rafraîchissement toutes les {Math.max(1, Math.round(refreshIntervalMs / 1000))}s</div>}
      </div>
      {/* Debug: raw API response */}
      <div style={{ marginTop: 8 }}>
        <Button variant="outline" size="sm" onClick={() => setShowRaw((s) => !s)}>{showRaw ? 'Masquer réponse brute' : 'Afficher réponse brute'}</Button>
        {showRaw && (
          <div style={{ marginTop: 8 }}>
            <h4 className="text-sm font-medium">Dernière réponse brute (GET /musics)</h4>
            <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>{lastFetchRaw ?? JSON.stringify(rows, null, 2)}</pre>
          </div>
        )}
      </div>
      {loading && <div>Chargement...</div>}
      {error && <div style={{ color: 'crimson' }}>Erreur: {error}</div>}

      {!loading && rows.length === 0 && <div>Aucune musique trouvée.</div>}

      {rows.length > 0 && (
        <div className="music-table-wrapper">
          <table className="music-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>
                  <input type="checkbox" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={(e) => toggleSelectAll(e.target.checked)} />
                </th>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const id = r.id ?? r.ID ?? r.Id ?? r['id'] ?? '';
                return (
                  <tr key={i} className={selectedIds.has(id) ? 'row-selected' : ''}>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={selectedIds.has(id)} onChange={(e) => toggleSelect(id, e.target.checked)} />
                        {selectedOrder.includes(id) && (
                          <span className="order-badge" aria-hidden>{selectedOrder.indexOf(id) + 1}</span>
                        )}
                      </label>
                    </td>
                    {headers.map((h) => (
                      <td key={h}>{r[h]}</td>
                    ))}
                    <td>
                      <div className="actions-group">
                        <Button variant="outline" size="sm" onClick={() => playMusic(id)} disabled={!id}>Écouter</Button>
                        <Button variant="outline" size="sm" onClick={() => void downloadMusic(id)} disabled={!id}>Télécharger</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditingRowId(id);
                          const initial: Record<string, string> = {};
                          initial.title = String(r.title ?? r.Title ?? r['title'] ?? '');
                          initial.artist = String(r.artist ?? r.Artist ?? r['artist'] ?? '');
                          initial.album = String(r.album ?? r.Album ?? r['album'] ?? '');
                          initial.year = String(r.year ?? r.Year ?? r['year'] ?? '');
                          setEditingMetadata(initial);
                        }}>Modifier</Button>

                        <label className="btn-outline-fluff text-sm cursor-pointer">
                          Remplacer
                          <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              await replaceFile(id, f);
                              setError(null);
                              alert('Fichier remplacé');
                            } catch {
                              // error already set in replaceFile
                            }
                          }} />
                        </label>

                        <Button variant="outline" size="sm" onClick={() => void deleteMusic(id)} className="text-rose-600" disabled={deletingId === id}>{deletingId === id ? 'Suppression...' : 'Supprimer'}</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline metadata editor */}
      {editingRowId && (
        <div className="mt-4 bg-white rounded p-4 shadow">
          <h4 className="font-medium mb-2">Modifier métadonnées</h4>
          <div className="grid grid-cols-1 gap-2">
            <label>Titre<input className="w-full border rounded px-2 py-1 mt-1" value={editingMetadata.title ?? ''} onChange={(e) => setEditingMetadata({ ...editingMetadata, title: e.target.value })} /></label>
            <label>Artiste<input className="w-full border rounded px-2 py-1 mt-1" value={editingMetadata.artist ?? ''} onChange={(e) => setEditingMetadata({ ...editingMetadata, artist: e.target.value })} /></label>
            <label>Album<input className="w-full border rounded px-2 py-1 mt-1" value={editingMetadata.album ?? ''} onChange={(e) => setEditingMetadata({ ...editingMetadata, album: e.target.value })} /></label>
            <label>Année<input type="number" className="w-full border rounded px-2 py-1 mt-1" value={editingMetadata.year ?? ''} onChange={(e) => setEditingMetadata({ ...editingMetadata, year: e.target.value })} /></label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={async () => {
              try {
                await patchMetadata(editingRowId, {
                  title: editingMetadata.title,
                  artist: editingMetadata.artist,
                  album: editingMetadata.album,
                  year: editingMetadata.year,
                });
                setEditingRowId(null);
                setEditingMetadata({});
                alert('Métadonnées mises à jour');
              } catch {
                // error displayed in setError
              }
            }}>Confirmer</Button>
            <Button variant="outline" onClick={() => { setEditingRowId(null); setEditingMetadata({}); }}>Annuler</Button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>Précédent</Button>
        <Button variant="outline" onClick={() => { if (nextPage !== null && typeof nextPage !== 'undefined') setPage(nextPage); else setPage((p) => p + 1); }} disabled={nextPage === null && totalPage !== null && page >= (totalPage ?? 0)}>Suivant</Button>
      </div>

      {playingUrl && (
        <div style={{ marginTop: 12 }}>
          <h4>Lecteur</h4>
          <audio src={playingUrl} controls autoPlay style={{ width: '100%' }} />
          <div style={{ marginTop: 6 }}>
            <button onClick={() => { URL.revokeObjectURL(playingUrl); setPlayingUrl(null); }}>Stop</button>
          </div>
        </div>
      )}
    </div>
  );
}
