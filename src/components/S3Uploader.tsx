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
  if (USE_PROXY) return `/api${path}`;
  return `${API_BASE}${path}`;
}

export default function S3Uploader({ token, isProgrammateur, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file) return setStatus('Aucun fichier sélectionné');
    if (!isProgrammateur) return setStatus("Forbidden: vous n'êtes pas programmateur");
    setUploading(true);
    setStatus('Uploading...');
    try {
      const headersInit: Record<string, string> = {};
      if (token) headersInit['Authorization'] = `Bearer ${token}`;
      // Content-Type must match mime type of file
      headersInit['Content-Type'] = file.type || 'application/octet-stream';

      const res = await fetch(apiUrl('/musics'), {
        method: 'POST',
        headers: headersInit,
        body: file,
        credentials: 'include',
        mode: 'cors',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed ${res.status} ${res.statusText} - ${text}`);
      }
      const json = await res.json();
      setStatus('Upload terminé');
      if (onUpload) onUpload(String(json?.id ?? json?.ID ?? json?.Id ?? json));
    } catch (e: unknown) {
      setStatus(String((e as { message?: string })?.message ?? e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div style={{ marginTop: 8 }}>
        <button onClick={upload} disabled={uploading}>{uploading ? 'En cours...' : 'Uploader'}</button>
      </div>
      {status && <div style={{ marginTop: 8 }}>{status}</div>}
    </div>
  );
}
