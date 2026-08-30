import { useEffect, useRef, useState } from 'react';
import { Upload, Music, Loader2, FolderOpen } from 'lucide-react';

type SfxFile = { name: string; path: string };
type SfxCategory = { name: string; files: SfxFile[] };

type AssetsPanelProps = {
  projectId: string;
  apiUrl: string;
  onImageUploaded: (src: string, previewUrl: string) => void;
  onAudioPicked: (src: string, label: string, durationSec?: number) => void;
};

export const AssetsPanel = ({
  projectId,
  apiUrl,
  onImageUploaded,
  onAudioPicked,
}: AssetsPanelProps) => {
  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sfx, setSfx] = useState<SfxCategory[]>([]);
  const [sfxLoading, setSfxLoading] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    if (!apiUrl) return;
    setSfxLoading(true);
    fetch(`${apiUrl}/sfx-library`)
      .then((r) => r.json())
      .then((data) => setSfx(data.categories || []))
      .catch(() => setSfx([]))
      .finally(() => setSfxLoading(false));
  }, [apiUrl]);

  const uploadFile = async (file: File): Promise<{ src: string; url: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${apiUrl}/assets/${projectId}`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha no upload');
    }
    const data = await res.json();
    return { src: data.src, url: `${apiUrl}${data.url}` };
  };

  const onImagePick = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !apiUrl) return;
    setUploading(true);
    try {
      const { src, url } = await uploadFile(file);
      onImageUploaded(src, url);
    } finally {
      setUploading(false);
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  const onAudioUpload = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !apiUrl) return;
    setUploading(true);
    try {
      const { src } = await uploadFile(file);
      const duration = await getAudioDuration(`${apiUrl}/assets/${projectId}/${src.replace('asset://', '')}`);
      onAudioPicked(src, file.name, duration);
    } finally {
      setUploading(false);
      if (audioRef.current) audioRef.current.value = '';
    }
  };

  const getAudioDuration = (url: string): Promise<number> =>
    new Promise((resolve) => {
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 3));
      audio.addEventListener('error', () => resolve(3));
    });

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 overflow-y-auto p-3 border border-border-base rounded-xl bg-bg-secondary/30">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">Assets</h3>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={uploading || !apiUrl}
            onClick={() => imageRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-btn-bg border border-border-base text-sm hover:bg-elements cursor-pointer disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload imagem (PNG/JPG)
          </button>
          <input
            ref={imageRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onImagePick(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading || !apiUrl}
            onClick={() => audioRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-btn-bg border border-border-base text-sm hover:bg-elements cursor-pointer disabled:opacity-50"
          >
            <Music size={14} />
            Upload áudio (MP3/WAV)
          </button>
          <input
            ref={audioRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a"
            className="hidden"
            onChange={(e) => onAudioUpload(e.target.files)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1">
          <FolderOpen size={12} /> Biblioteca SFX
        </h3>
        {!apiUrl && (
          <p className="text-xs text-text-tertiary">API offline. SFX indisponível.</p>
        )}
        {sfxLoading && <p className="text-xs text-text-tertiary">Carregando...</p>}
        {!sfxLoading && sfx.length === 0 && apiUrl && (
          <p className="text-xs text-text-tertiary">Nenhuma categoria encontrada em EfeitosSonoros/</p>
        )}
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {sfx.map((cat) => (
            <div key={cat.name} className="rounded-lg border border-border-base/50 overflow-hidden">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-xs font-medium bg-bg-primary/40 hover:bg-elements flex justify-between"
                onClick={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
              >
                {cat.name}
                <span className="text-text-tertiary">{cat.files.length}</span>
              </button>
              {expandedCat === cat.name && (
                <div className="max-h-32 overflow-y-auto">
                  {cat.files.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      className="w-full text-left px-2 py-1 text-[10px] truncate hover:bg-elements text-text-secondary hover:text-text-primary"
                      onClick={() => onAudioPicked(f.path, f.name, 2)}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
