"use client";
import React, { useState } from 'react';

type Props = {
  token: string; // Bearer token (ID or Access token) from Cognito
  isProgrammateur: boolean;
  onUpload?: (key: string) => void;
};

export default function S3Uploader({ token, isProgrammateur, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file) return setStatus('No file');
    if (!isProgrammateur) return setStatus('Forbidden: not programmateur');
    setUploading(true);
    setStatus('Requesting presigned URL...');
    // store uploaded musics under the musics/ prefix to match existing objects
    const key = `musics/${Date.now()}_${file.name}`;
    const res = await fetch('/api/s3/presign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key, operation: 'upload', contentType: file.type }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setUploading(false);
      return setStatus(`Presign failed: ${err?.error ?? res.status}`);
    }

    const { url } = await res.json();
    setStatus('Uploading file to S3...');

    try {
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) {
        setStatus(`Upload failed: ${put.status}`);
        setUploading(false);
        return;
      }

      setStatus('Upload successful — key: ' + key);
      if (typeof onUpload === 'function') {
        try { onUpload(key); } catch {}
      }
    } catch (err) {
      setStatus('Upload error: ' + String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={upload} disabled={!file || uploading} className="px-3 py-1 rounded bg-sky-600 text-white">
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <div><strong>Fichier:</strong> {file ? file.name : 'Aucun fichier choisi'}</div>
        {status && <div style={{ marginTop: 6 }}>{status}</div>}
      </div>
    </div>
  );
}
