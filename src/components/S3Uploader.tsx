"use client";
import React, { useState } from 'react';

type Props = {
  token: string;
  isProgrammateur: boolean;
  onUpload?: (id: string) => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://nu8n9r0hl5.execute-api.eu-west-1.amazonaws.com';
const USE_PROXY = process.env.NEXT_PUBLIC_API_PROXY === '1';

function apiUrl(path: string) {
  const resolved = USE_PROXY ? `/api${path}` : `${API_BASE}${path}`;
  // Debug helper: log which base is used so we can troubleshoot "local vs remote" calls
  if (typeof window !== 'undefined') {
    console.debug('[S3Uploader apiUrl]', { path, USE_PROXY, resolved });
  }
  return resolved;
}

export default function S3Uploader({ token, isProgrammateur, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // metadata editing state
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState<string | number>('');

  const upload = async () => {
    if (!file) return setStatus('Aucun fichier sélectionné');
    if (!isProgrammateur) return setStatus("Forbidden: vous n'êtes pas programmateur");
    setUploading(true);
    setStatus('Uploading...');
    try {
      // Prepare binary body matching server contract: raw audio binary with correct Content-Type
      let bodyToSend: Blob | File = file;
      // If MP3, try to write ID3 tags client-side so metadata is embedded in the binary
      const isMp3 = (file.type === 'audio/mpeg') || file.name.toLowerCase().endsWith('.mp3');
      if (isMp3) {
        try {
          const { default: ID3Writer } = await import('browser-id3-writer');
          const arrayBuffer = await file.arrayBuffer();
          // browser-id3-writer expects a Uint8Array
          const writer = new ID3Writer(new Uint8Array(arrayBuffer));
          if (title) writer.setFrame('TIT2', title);
          if (artist) writer.setFrame('TPE1', [artist]);
          if (album) writer.setFrame('TALB', album);
          if (year) writer.setFrame('TYER', String(year));
          writer.addTag();
          const taggedBlob = writer.getBlob();
          bodyToSend = taggedBlob;
        } catch (e) {
          console.warn('Écriture ID3 échouée, envoi du fichier original', e);
          // fallback: send original file
          bodyToSend = file;
        }
      }

      const headersInit: Record<string, string> = {};
      if (token) headersInit['Authorization'] = `Bearer ${token}`;
      // Server requires a Content-Type header matching the mime-type detected from file
      const contentType = file.type || (isMp3 ? 'audio/mpeg' : 'application/octet-stream');
      headersInit['Content-Type'] = contentType;

  // NOTE: do NOT add custom X-* headers here by default because many servers (API Gateway)
  // block unknown headers in CORS preflight. We embed metadata into the file (ID3) and
  // send Content-Type; if your backend requires separate metadata headers, add them
  // server-side to Access-Control-Allow-Headers or enable CORS for these headers.

      const res = await fetch(apiUrl('/musics'), {
        method: 'POST',
        headers: headersInit,
        body: bodyToSend,
        credentials: 'include',
        mode: 'cors',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed ${res.status} ${res.statusText} - ${text}`);
      }
      const json = await res.json();
      setStatus('Upload terminé');
      // reset editor
      setFile(null);
      setEditing(false);
      setTitle(''); setArtist(''); setAlbum(''); setYear('');
      if (onUpload) onUpload(String(json?.id ?? json?.ID ?? json?.Id ?? json));
    } catch (e: unknown) {
      setStatus(String((e as { message?: string })?.message ?? e));
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (f: File | null) => {
    setFile(f);
    if (f) {
      // prefill simple metadata from filename
      const name = f.name.replace(/\.[^/.]+$/, '');
      setTitle(name);
      setArtist('');
      setAlbum('');
      setYear('');
      setEditing(true);
    } else {
      setEditing(false);
    }
  };

  return (
    <div>
      <input type="file" accept="audio/*" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />

      {editing && file && (
        <div className="mt-4 bg-white/80 p-4 rounded shadow-sm">
          <h4 className="font-medium mb-2">Méta-données (modifiable avant upload)</h4>
          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm">Titre
              <input className="w-full border rounded px-2 py-1 mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="text-sm">Artiste
              <input className="w-full border rounded px-2 py-1 mt-1" value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
            <label className="text-sm">Album
              <input className="w-full border rounded px-2 py-1 mt-1" value={album} onChange={(e) => setAlbum(e.target.value)} />
            </label>
            <label className="text-sm">Année
              <input type="number" className="w-full border rounded px-2 py-1 mt-1" value={String(year)} onChange={(e) => setYear(Number(e.target.value) || '')} />
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <button className="btn-fluff" onClick={() => void upload()} disabled={uploading}>{uploading ? 'En cours...' : 'Confirmer & Uploader'}</button>
            <button className="btn-outline-fluff" onClick={() => { setFile(null); setEditing(false); setStatus(null); }}>Annuler</button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="mt-3">
          <button onClick={upload} disabled={uploading || !file} className="px-4 py-2 rounded bg-zinc-800 text-white">{uploading ? 'En cours...' : 'Uploader'}</button>
        </div>
      )}

      {status && <div className="mt-2 text-sm text-zinc-600">{status}</div>}
    </div>
  );
}
