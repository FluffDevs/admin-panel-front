"use client";
import React, { useEffect, useState } from 'react';

type Props = {
  token?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://nu8n9r0hl5.execute-api.eu-west-1.amazonaws.com';
const USE_PROXY = process.env.NEXT_PUBLIC_API_PROXY === '1';

function apiUrl(path: string) {
  if (USE_PROXY) return `/api${path}`;
  return `${API_BASE}${path}`;
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

export default function MusicList({ token }: Props) {
  // NOTE: API pages are 0-based
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [totalPage, setTotalPage] = useState<number | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  // Auto-refresh controls
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(30000); // default 30s
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
  const url = apiUrl(`/musics?page=${page}`);
        const headersInit: Record<string, string> = {};
        if (token) headersInit['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers: headersInit, credentials: 'include', mode: 'cors' });
        if (!mounted) return;
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = await res.text();

        // Try to parse JSON first (Bruno returns { data: [...], metadata: {...} })
        let usedNext: number | null = null;
        let usedTotal: number | null = null;
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

            // metadata may contain page and total_pages (0-based page)
            if ('metadata' in (jsonParsed as Record<string, unknown>) && (jsonParsed as Record<string, unknown>)['metadata'] && typeof (jsonParsed as Record<string, unknown>)['metadata'] === 'object') {
              const md = (jsonParsed as Record<string, unknown>)['metadata'] as Record<string, unknown> | undefined;
              if (md) {
                usedNext = typeof md.page === 'number' ? md.page as number : null;
                usedTotal = typeof md.total_pages === 'number' ? md.total_pages as number : (typeof md.total_pages === 'string' ? Number(md.total_pages as string) : null);
                if (typeof usedTotal !== 'number') usedTotal = null;
              }
            }
          } else {
            // not the JSON shape we expect, fallback to CSV parsing below
            throw new Error('Not Bruno JSON');
          }
        } catch {
          // Fallback to CSV
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

  return (
    <div>
      {/* Display page to user as 1-based while requests are 0-based */}
      <h3>Liste des musiques (page {page + 1}{totalPage ? ` / ${totalPage}` : ''})</h3>

      {/* Auto-refresh controls */}
      <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
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
      {loading && <div>Chargement...</div>}
      {error && <div style={{ color: 'crimson' }}>Erreur: {error}</div>}

      {!loading && rows.length === 0 && <div>Aucune musique trouvée.</div>}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{h}</th>
                ))}
                <th style={{ padding: 6, borderBottom: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {headers.map((h) => (
                    <td key={h} style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>{r[h]}</td>
                  ))}
                  <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>
                    {/* assume there is an id column named id or ID */}
                    <button onClick={() => playMusic(r.id ?? r.ID ?? r.Id ?? r['id'] ?? '')} disabled={!((r.id ?? r.ID ?? r.Id ?? r['id'] ?? ''))}>Écouter</button>
                    <button style={{ marginLeft: 8 }} onClick={async () => {
                      const id = r.id ?? r.ID ?? r.Id ?? r['id'] ?? '';
                      if (!id) return setError('No id for download');
                      try {
                        const dlUrl = apiUrl(`/musics/${encodeURIComponent(id)}/download`);
                        const headersInit: Record<string, string> = {};
                        if (token) headersInit['Authorization'] = `Bearer ${token}`;
                        const res = await fetch(dlUrl, { method: 'GET', headers: headersInit, credentials: 'include', mode: 'cors' });
                        if (!res.ok) throw new Error(`Download failed ${res.status}`);
                        const blob = await res.blob();
                        const disposition = res.headers.get('Content-Disposition') ?? '';
                        let filename = id;
                        const m = /filename="?([^";]+)"?/.exec(disposition);
                        if (m && m[1]) filename = m[1];
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (e: unknown) {
                        setError(String((e as { message?: string })?.message ?? e));
                      }
                    }}>Télécharger</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>Précédent</button>
  <button onClick={() => { if (nextPage !== null && typeof nextPage !== 'undefined') setPage(nextPage); else setPage((p) => p + 1); }} disabled={nextPage === null && totalPage !== null && page >= (totalPage ?? 0)}>Suivant</button>
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
