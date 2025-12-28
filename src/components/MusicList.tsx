"use client";
import React, { useEffect, useState } from 'react';

type Props = {
  token?: string;
  apiBase?: string; // base URL for Bruno API
};

export default function MusicList({ token, apiBase }: Props) {
  // Use the local proxy endpoint to avoid CORS issues
  // Prefer the public Bruno API if provided via NEXT_PUBLIC_BRUNO_API_URL, otherwise fall back to local proxy
  const base = apiBase ?? (process.env.NEXT_PUBLIC_BRUNO_API_URL ? `${process.env.NEXT_PUBLIC_BRUNO_API_URL.replace(/\/$/, '')}/musics` : '/api/musics');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [items, setItems] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);

  function formatDuration(d?: string) {
    if (!d) return '';
    try {
      const sMatch = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
      if (!sMatch) return d;
      const hours = Number(sMatch[1] ?? 0);
      const mins = Number(sMatch[2] ?? 0);
      const secs = Number(sMatch[3] ?? 0);
      const totalSec = Math.round(hours * 3600 + mins * 60 + secs);
      const hh = Math.floor(totalSec / 3600);
      const mm = Math.floor((totalSec % 3600) / 60);
      const ss = totalSec % 60;
      if (hh > 0) return `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
      return `${mm}:${String(ss).padStart(2,'0')}`;
    } catch {
      return d;
    }
  }

  const fetchPage = async (p: number, useFallback = false) => {
    setLoading(true);
    setError(null);
    setFallbackAvailable(false);
    try {
      setError(null);
      const url = `${base}?page=${p}${useFallback ? '&fallback=true' : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const text = await res.text();
      // If the Bruno proxy signals fallback available, surface it
      const fallbackHdr = res.headers.get('X-Fallback-Available');
      if (fallbackHdr === 'true') {
        setFallbackAvailable(true);
        // If the server indicates fallback is available and we didn't already request it,
        // retry automatically once with the fallback to restore UI in dev.
        if (!useFallback) {
          setLoading(false);
          return fetchPage(p, true);
        }
      }

      if (!res.ok) {
        // return the raw body as error message
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      // Try to detect JSON responses (some Bruno endpoints return JSON) and handle CSV otherwise
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(text);
          // Bruno seems to return { data: [ ... ] } — handle that shape, or an array directly
          const arrayData = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
          const rows = arrayData.map((row: Record<string, unknown>) => {
            const obj: Record<string, string> = {};
            Object.keys(row || {}).forEach((k) => { obj[k] = row[k] == null ? '' : String(row[k]); });
            return obj;
          });
          setItems(rows);
        } catch {
          throw new Error('Invalid JSON response');
        }
      } else {
        // parse CSV lines into objects (assume first line header)
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          setItems([]);
        } else {
          const headers = lines[0].split(',').map((h) => h.trim());
          const rows = lines.slice(1).map((ln) => {
            const parts = ln.split(',');
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = parts[i] ?? ''; });
            return obj;
          });
          setItems(rows);
        }
      }

      const totalRaw = res.headers.get('Total-Page');
      setTotalPages(totalRaw ? Number(totalRaw) : null);
      setPage(p);
    } catch (err) {
      const e = err as Error | undefined;
      setError(String(e?.message ?? String(err)));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ marginTop: 16 }}>
      <h3 className="text-lg font-medium">Liste des musiques</h3>
      <div style={{ marginTop: 8 }}>
        <button onClick={() => fetchPage(1)} disabled={loading} style={{ marginRight: 8 }}>
          Refresh
        </button>
        <button onClick={() => fetchPage(Math.max(1, page - 1))} disabled={loading || page <= 1} style={{ marginRight: 8 }}>
          Prev
        </button>
        <button onClick={() => fetchPage((page || 1) + 1)} disabled={loading || (totalPages !== null && page >= totalPages)}>
          Next
        </button>
        {fallbackAvailable && (
          <button onClick={() => fetchPage(1, true)} style={{ marginLeft: 12 }}>
            Utiliser données de secours
          </button>
        )}
        {totalPages !== null && <span style={{ marginLeft: 12 }}>Page {page} / {totalPages}</span>}
        <span style={{ marginLeft: 12 }}>Total: {items.length}</span>
      </div>

      {loading && <div style={{ marginTop: 8 }}>Chargement...</div>}
      {error && <div style={{ marginTop: 8, color: 'red' }}>{error}</div>}

      <div style={{ marginTop: 12 }}>
        {items.length === 0 && !loading ? (
          <div>Aucun résultat</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                  {items.length > 0 && (() => {
                    // Prefer common music fields in a friendly order
                    const preferred = ['title', 'artist', 'album', 'id', 'duration', 'year'];
                    const keysSet = new Set<string>();
                    items.forEach(r => Object.keys(r || {}).forEach(k => keysSet.add(k)));
                    const allKeys = Array.from(keysSet);
                    const ordered = [ ...preferred.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !preferred.includes(k)) ];
                    return ordered.map((h) => (
                      <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>{h}</th>
                    ));
                  })()}
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    {(() => {
                      const preferred = ['title', 'artist', 'album', 'id', 'duration', 'year'];
                      const rowKeys = Object.keys(row);
                      const ordered = [ ...preferred.filter(k => rowKeys.includes(k)), ...rowKeys.filter(k => !preferred.includes(k)) ];
                      return ordered.map((k) => (
                        <td key={k} style={{ padding: '6px' }}>{k === 'duration' ? formatDuration(row[k]) : row[k]}</td>
                      ));
                    })()}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
