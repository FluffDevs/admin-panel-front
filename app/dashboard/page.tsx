"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";
import "./styles.css";

type S3Object = {
  key: string;
  id?: string;
  size?: number;
  lastModified?: string;
  downloadUrl?: string;
};

type Meta = {
  title?: string;
  artist?: string;
  tags?: string;
};

export default function DashboardPage() {
  const auth = useAuth();
  const router = useRouter();

  const PROXY_BASE = "/api/bruno"; // local proxy to avoid CORS in browser

  const [objects, setObjects] = useState<S3Object[]>([]);
  const [prefix, setPrefix] = useState<string>("/");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  // playlist preserves order of selection
  const [playlist, setPlaylist] = useState<Array<{ obj: S3Object; meta: Meta }>>([]);
  const [selectedForEdit, setSelectedForEdit] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewMetadata, setViewMetadata] = useState<Record<string, unknown> | null>(null);

  async function fetchMetadata(id: string) {
    try {
      const url = PROXY_BASE + '/musics/' + encodeURIComponent(id);
      const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        setViewMetadata(j);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        alert('Erreur en récupérant metadata: ' + msg);
      }
    }

    async function deleteMusic(id: string) {
      if (!confirm('Supprimer la piste ?')) return;
      try {
        const url = PROXY_BASE + '/musics/' + encodeURIComponent(id);
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText);
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }
        alert('Supprimé');
        fetchObjects();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        alert('Erreur suppression: ' + msg);
      }
    }

    useEffect(() => {
      if (auth.isLoading) return;
      if (!auth.isAuthenticated) {
        router.replace("/");
      }
    }, [auth.isLoading, auth.isAuthenticated, router]);

    useEffect(() => {
      fetchObjects();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefix, page]);

    async function fetchObjects() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const url = PROXY_BASE + "/musics" + `?page=${encodeURIComponent(String(page))}`;
        let res: Response;
        try {
          res = await fetch(url);
        } catch (err: unknown) {
          const em = err instanceof Error ? err.message : String(err);
          setErrorMessage("Impossible de joindre l'API Bruno. Vérifiez l'URL, le réseau et les règles CORS (voir console).\n" + em);
          setObjects([]);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText);
          setErrorMessage(`API Bruno a répondu ${res.status} ${res.statusText}: ${txt}`);
          setObjects([]);
          setLoading(false);
          return;
        }

        const text = await res.text();
        const totalPageHeader = res.headers.get("Total-Page") || res.headers.get("total-page");
        setTotalPages(totalPageHeader ? Number(totalPageHeader) : null);

        // parse CSV returned by Bruno
        const parseCSV = (csv: string): string[][] => {
          const rows: string[][] = [];
          let cur = '';
          let curRow: string[] = [];
          let inQuotes = false;
          for (let i = 0; i < csv.length; i++) {
            const ch = csv[i];
            if (ch === '"') {
              if (inQuotes && csv[i + 1] === '"') { cur += '"'; i++; }
              else { inQuotes = !inQuotes; }
              continue;
            }
            if (ch === ',' && !inQuotes) { curRow.push(cur); cur = ''; continue; }
            if ((ch === '\n' || ch === '\r') && !inQuotes) {
              if (ch === '\n') { curRow.push(cur); rows.push(curRow); curRow = []; cur = ''; }
              continue;
            }
            cur += ch;
          }
          if (cur.length || curRow.length) { curRow.push(cur); rows.push(curRow); }
          return rows;
        };

        const lines = parseCSV(text);
        if (lines.length < 1) { setObjects([]); return; }
        const headers = lines[0].map(h => h.replace(/^"|"$/g, ''));
        const items = lines.slice(1).map(cols => {
          const obj: Record<string, string> = {};
          for (let i = 0; i < headers.length; i++) obj[headers[i]] = (cols[i] || '').replace(/^"|"$/g, '');
          return obj;
        });

        const mapped = items.map(it => ({
          key: it.filename || it.name || it.key || String(it.id || it.filename || it.name),
          id: it.id || it.key,
          size: it.size ? Number(it.size) : undefined,
          lastModified: it.updatedAt || it.lastModified || it.modified || it.createdAt || undefined,
          downloadUrl: PROXY_BASE + '/musics/' + encodeURIComponent((it.id || it.key || it.filename)) + '/download',
        } as S3Object));
        setObjects(mapped);
      } catch (err: unknown) {
        console.error(err);
        setObjects([]);
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        setLoading(false);
      }
    }

    function basename(key: string) {
      if (!key) return key;
      const parts = key.split("/");
      return parts[parts.length - 1] || parts[parts.length - 2] || key;
    }

    function toggleSelect(obj: S3Object) {
      const id = obj.id || obj.key;
      const idx = playlist.findIndex((p) => (p.obj.id || p.obj.key) === id);
      if (idx === -1) {
        setPlaylist((p) => [...p, { obj, meta: { title: basename(obj.key) } }]);
      } else {
        setPlaylist((p) => p.filter((_, i) => i !== idx));
        setSelectedForEdit((s) => (s === idx ? null : s));
      }
    }

    function isSelected(obj: S3Object) {
      const id = obj.id || obj.key;
      return playlist.some((p) => (p.obj.id || p.obj.key) === id);
    }

    function moveInPlaylist(i: number, delta: number) {
      setPlaylist((p) => {
        const arr = [...p];
        const j = i + delta;
        if (j < 0 || j >= arr.length) return arr;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
        return arr;
      });
      setSelectedForEdit((s) => (s === i ? i + delta : s === i + delta ? i : s));
    }

    async function saveMeta(index: number) {
      const item = playlist[index];
      try {
        const id = item.obj.id || item.obj.key;
        if (!id) throw new Error("ID de la musique manquant");
        const url = PROXY_BASE + "/musics/" + encodeURIComponent(String(id));
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.meta),
        });
        if (!res.ok) throw new Error(`Erreur: ${res.status}`);
        const updated = await res.json();
        setPlaylist((arr) => arr.map((it, idx) => idx === index ? { ...it, meta: { ...it.meta, ...(updated || {}) } } : it));
        alert("Méta mises à jour");
      } catch (err) {
        console.error(err);
        alert("Erreur en sauvegardant");
      }
    }

    if (auth.isLoading) return <div>Loading...</div>;
    if (!auth.isAuthenticated) return null;

    return (
      <div className="dash-container">
        <div className="dash-main">
          <header className="header">
            <h1 className="title">Programmateur — FluffRadio</h1>
            <div>
              <button onClick={() => auth.signoutRedirect()} className="btn btn-danger">Se déconnecter</button>
            </div>
          </header>

          <section style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ marginRight: 10 }}>
                <span style={{ marginRight: 8 }}>Filtre (prefix):</span>
                <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="input" />
              </label>
              <button onClick={fetchObjects} className="btn btn-primary btn-small">Rafraîchir</button>

              <div style={{ marginLeft: 20 }}>
                <input type="file" accept="audio/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                <button onClick={async () => {
                  if (!selectedFile) return alert('Choisir un fichier audio d\'abord');
                  setUploading(true);
                  try {
                    const url = PROXY_BASE + '/musics';
                    const res = await fetch(url, {
                      method: 'POST',
                      headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
                      body: selectedFile,
                    });
                    if (!res.ok) {
                      const txt = await res.text().catch(() => res.statusText);
                      throw new Error(`Upload failed ${res.status} ${txt}`);
                    }
                    const json = await res.json();
                    alert('Fichier uploadé — id: ' + (json.id || json.ID || JSON.stringify(json)));
                    fetchObjects();
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    alert('Erreur upload: ' + msg);
                  } finally { setUploading(false); }
                }} className="btn btn-primary btn-small" disabled={uploading} style={{ marginLeft: 8 }}>{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </div>
          </section>

          {errorMessage && (
            <div className="error-banner" role="alert">
              <strong>Erreur :</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{errorMessage}</span>
            </div>
          )}

          <section style={{ marginTop: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Objets</h2>
            {loading ? (
              <div>Chargement…</div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table className="table">
                  <thead className="thead">
                    <tr>
                      <th className="td"></th>
                      <th className="td">Nom</th>
                      <th className="td">Dernière modification</th>
                      <th className="td">Taille</th>
                      <th className="td">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((o) => (
                      <tr key={o.key} className="tr">
                        <td className="td"><input type="checkbox" checked={isSelected(o)} onChange={() => toggleSelect(o)} /></td>
                        <td className="td">{basename(o.key)}</td>
                        <td className="td muted small">{o.lastModified || "-"}</td>
                        <td className="td muted small">{o.size ? `${(o.size / 1024 / 1024).toFixed(2)} Mo` : "-"}</td>
                        <td className="td">
                          {o.downloadUrl ? <a href={o.downloadUrl} target="_blank" rel="noreferrer">Télécharger</a> : <span className="muted">—</span>}
                          <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-small" onClick={() => fetchMetadata(String(o.id || o.key))}>Voir</button>
                            <button className="btn btn-danger btn-small" onClick={() => deleteMusic(String(o.id || o.key))}>Suppr</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-small" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Précédent</button>
            <div className="small muted">Page {page}{totalPages ? ` / ${totalPages}` : ''}</div>
            <button className="btn btn-ghost btn-small" onClick={() => setPage(p => p + 1)} disabled={totalPages !== null && page >= (totalPages || 0)}>Suivant</button>
          </div>

          {viewMetadata && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ marginBottom: 6 }}>Metadata</h3>
              <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.04)', padding: 8, borderRadius: 6 }}>{JSON.stringify(viewMetadata, null, 2)}</pre>
              <div style={{ marginTop: 6 }}><button className="btn btn-ghost btn-small" onClick={() => setViewMetadata(null)}>Fermer</button></div>
            </div>
          )}
        </div>
        <aside className="dash-aside">
          <h2 className="text-lg font-semibold">Playlist (ordre de sélection)</h2>
          {playlist.length === 0 && <div className="text-gray-500">Aucune piste sélectionnée</div>}

          <ul className="list-none p-0 mt-3">
            {playlist.map((p, i) => (
              <li key={p.obj.key} className="playlist-item">
                <div className="flex justify-between items-center">
                  <div style={{ fontWeight: 600 }}>{p.meta.title || basename(p.obj.key)}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => moveInPlaylist(i, -1)} disabled={i === 0} className="btn btn-ghost btn-small">⬆️</button>
                    <button onClick={() => moveInPlaylist(i, +1)} disabled={i === playlist.length - 1} className="btn btn-ghost btn-small">⬇️</button>
                    <button onClick={() => setSelectedForEdit(i)} className="btn btn-small">Éditer</button>
                    <button onClick={() => toggleSelect(p.obj)} className="btn btn-danger btn-small">Retirer</button>
                  </div>
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>{basename(p.obj.key)}</div>

                {selectedForEdit === i && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>Titre</div>
                      <input value={p.meta.title || ""} onChange={(e) => {
                        const val = e.target.value;
                        setPlaylist((arr) => arr.map((it, idx) => idx === i ? { ...it, meta: { ...it.meta, title: val } } : it));
                      }} className="input" />
                    </label>
                    <label style={{ display: 'block', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>Artiste</div>
                      <input value={p.meta.artist || ""} onChange={(e) => {
                        const val = e.target.value;
                        setPlaylist((arr) => arr.map((it, idx) => idx === i ? { ...it, meta: { ...it.meta, artist: val } } : it));
                      }} className="input" />
                    </label>
                    <label style={{ display: 'block', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>Tags (csv)</div>
                      <input value={p.meta.tags || ""} onChange={(e) => {
                        const val = e.target.value;
                        setPlaylist((arr) => arr.map((it, idx) => idx === i ? { ...it, meta: { ...it.meta, tags: val } } : it));
                      }} className="input" />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => saveMeta(i)} className="btn btn-primary">Sauvegarder</button>
                      <button onClick={() => setSelectedForEdit(null)} className="btn btn-ghost">Fermer</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <button onClick={() => {
              const payload = playlist.map(p => ({ key: p.obj.key, meta: p.meta }));
              navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
              alert('Playlist copiée dans le presse-papiers (JSON)');
            }} className="px-3 py-1 bg-indigo-600 text-white rounded">Exporter (copier JSON)</button>
          </div>
        </aside>
      </div>
    );
  }

