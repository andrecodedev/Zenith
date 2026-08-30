import { useEffect, useRef, useState } from 'react';
import { ImageUpscale, Upload, Download, Loader2, X, AlertCircle, CheckCircle2, Archive } from 'lucide-react';
import JSZip from 'jszip';

type Scale = 2 | 4;
type ItemStatus = 'pending' | 'processing' | 'done' | 'error';

type BatchItem = {
  id: string;
  file: File;
  previewUrl: string;
  dims: { w: number; h: number } | null;
  status: ItemStatus;
  resultBlob: Blob | null;
  resultUrl: string | null;
  error: string | null;
};

const API_URL =
  import.meta.env.VITE_MUSIC_API_URL ||
  (window.location.hostname.includes('vercel.app')
    ? 'https://seu-backend-deployado.com'
    : `http://${window.location.hostname}:3333`);

const MAX_BATCH = 50;
const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';

const isAllowedMime = (type: string) => ACCEPT.split(',').some((t) => t === type);

export const ImageUpscaleView = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [scale, setScale] = useState<Scale>(4);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      for (const item of items) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only on unmount
  }, []);

  const loadImageDims = (url: string): Promise<{ w: number; h: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      img.src = url;
    });

  const clearAll = () => {
    abortRef.current = true;
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    }
    setItems([]);
    setError(null);
    setProgress({ done: 0, total: 0 });
    setProcessing(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);

    const remaining = MAX_BATCH - items.length;
    if (remaining <= 0) {
      setError(`Limite de ${MAX_BATCH} imagens por lote.`);
      return;
    }

    const picked = Array.from(list).slice(0, remaining);
    const next: BatchItem[] = [];
    const rejects: string[] = [];

    for (const file of picked) {
      if (!isAllowedMime(file.type)) {
        rejects.push(`${file.name}: formato inválido`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      try {
        const dims = await loadImageDims(previewUrl);
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl,
          dims,
          status: 'pending',
          resultBlob: null,
          resultUrl: null,
          error: null,
        });
      } catch {
        URL.revokeObjectURL(previewUrl);
        rejects.push(`${file.name}: falha ao ler`);
      }
    }

    if (next.length) setItems((prev) => [...prev, ...next]);
    if (rejects.length) setError(rejects.slice(0, 3).join(' · ') + (rejects.length > 3 ? ` (+${rejects.length - 3})` : ''));
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeItem = (id: string) => {
    if (processing) return;
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.resultUrl) URL.revokeObjectURL(target.resultUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const upscaleOne = async (item: BatchItem, currentScale: Scale, signal: AbortSignal): Promise<Partial<BatchItem>> => {
    const form = new FormData();
    form.append('file', item.file);
    const res = await fetch(`${API_URL}/upscale?scale=${currentScale}`, {
      method: 'POST',
      body: form,
      signal,
    });
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    return {
      status: 'done',
      resultBlob: blob,
      resultUrl: URL.createObjectURL(blob),
      error: null,
    };
  };

  const handleUpscaleAll = async () => {
    if (!items.length || processing) return;
    setError(null);
    abortRef.current = false;
    setProcessing(true);

    const queue = items.filter((i) => i.status !== 'done');
    setProgress({ done: 0, total: queue.length });

    let finished = 0;
    for (const item of queue) {
      if (abortRef.current) break;

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'processing',
                error: null,
                resultBlob: null,
                resultUrl: i.resultUrl
                  ? (URL.revokeObjectURL(i.resultUrl), null)
                  : null,
              }
            : i,
        ),
      );

      const controller = new AbortController();
      try {
        const patch = await upscaleOne(item, scale, controller.signal);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') break;
        const msg = err instanceof Error ? err.message : 'Falha no upscale';
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'error', error: msg, resultBlob: null, resultUrl: null } : i,
          ),
        );
      }

      finished += 1;
      setProgress({ done: finished, total: queue.length });
    }

    setProcessing(false);
  };

  const handleDownloadZip = async () => {
    const ready = items.filter((i) => i.status === 'done' && i.resultBlob);
    if (!ready.length || zipping) return;
    setZipping(true);
    setError(null);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      for (const item of ready) {
        const base = item.file.name.replace(/\.[^.]+$/, '');
        let name = `${base}_${scale}x.png`;
        let n = 2;
        while (used.has(name)) {
          name = `${base}_${scale}x_${n}.png`;
          n += 1;
        }
        used.add(name);
        zip.file(name, item.resultBlob!);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zenith-upscale_${scale}x_${ready.length}imgs.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar ZIP');
    } finally {
      setZipping(false);
    }
  };

  const handleDownloadOne = (item: BatchItem) => {
    if (!item.resultUrl) return;
    const base = item.file.name.replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = item.resultUrl;
    a.download = `${base}_${scale}x.png`;
    a.click();
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const canZip = doneCount > 0 && !processing;

  return (
    <div className="w-full flex-1 flex flex-col mb-8 px-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl border border-border-base bg-bg-secondary/50 flex items-center justify-center">
            <ImageUpscale size={20} className="text-text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold font-title">Image Upscale</h2>
            <p className="text-text-secondary text-sm">
              Amplia com Real-ESRGAN (2x ou 4x). Até {MAX_BATCH} imagens → ZIP.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => onPickFiles(e.target.files)}
        />

        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full cursor-pointer rounded-2xl border border-dashed border-border-base bg-bg-secondary/30 hover:bg-bg-secondary/60 hover:border-text-tertiary/50 transition-all py-16 flex flex-col items-center gap-3"
          >
            <Upload size={28} className="text-text-tertiary" />
            <span className="text-text-primary font-semibold">Escolher imagens</span>
            <span className="text-text-tertiary text-xs">
              PNG, JPG ou WebP · até {MAX_BATCH} por vez
            </span>
          </button>
        ) : (
          <div className="rounded-2xl border border-border-base bg-bg-secondary/30 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-text-primary font-medium">
                  {items.length} imagem{items.length > 1 ? 'ns' : ''} · máx. {MAX_BATCH}
                </p>
                {processing && (
                  <p className="text-text-secondary text-sm mt-0.5">
                    Processando {progress.done}/{progress.total}…
                  </p>
                )}
                {!processing && doneCount > 0 && (
                  <p className="text-text-secondary text-sm mt-0.5">
                    {doneCount} pronta{doneCount > 1 ? 's' : ''} para ZIP
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!processing && items.length < MAX_BATCH && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="cursor-pointer px-3 py-2 text-sm rounded-lg border border-border-base text-text-secondary hover:bg-elements"
                  >
                    + Adicionar
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={processing}
                  className="cursor-pointer px-3 py-2 text-sm rounded-lg border border-border-base text-text-tertiary hover:text-text-primary hover:bg-elements disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Limpar
                </button>
              </div>
            </div>

            <ul className="space-y-2 max-h-72 overflow-y-auto hide-scrollbar">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-border-base bg-bg-primary/40 px-3 py-2"
                >
                  <img
                    src={item.resultUrl || item.previewUrl}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border-base"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{item.file.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {item.dims
                        ? `${item.dims.w}×${item.dims.h} → ${item.dims.w * scale}×${item.dims.h * scale}`
                        : '—'}
                      {item.status === 'processing' && ' · processando…'}
                      {item.status === 'done' && ' · ok'}
                      {item.status === 'error' && ` · ${item.error || 'erro'}`}
                    </p>
                  </div>
                  {item.status === 'done' && (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  )}
                  {item.status === 'processing' && (
                    <Loader2 size={16} className="animate-spin text-text-secondary shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                  )}
                  {item.status === 'done' && item.resultUrl && (
                    <button
                      type="button"
                      onClick={() => handleDownloadOne(item)}
                      className="cursor-pointer p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-elements"
                      aria-label="Download"
                    >
                      <Download size={16} />
                    </button>
                  )}
                  {!processing && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="cursor-pointer p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-elements"
                      aria-label="Remover"
                    >
                      <X size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-xl border border-border-base overflow-hidden">
                {([2, 4] as Scale[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={processing}
                    onClick={() => setScale(s)}
                    className={`px-4 py-2 text-sm font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      scale === s
                        ? 'bg-white text-black'
                        : 'bg-transparent text-text-tertiary hover:bg-elements'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleUpscaleAll}
                disabled={processing || items.length === 0}
                className="cursor-pointer bg-text-primary text-bg-primary font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <ImageUpscale size={16} />}
                {processing ? `${progress.done}/${progress.total}` : `Ampliar ${items.length}`}
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={!canZip || zipping}
                className="cursor-pointer border border-border-base bg-bg-secondary hover:bg-elements text-text-primary font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {zipping ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                Baixar ZIP ({doneCount})
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 [html.light_&]:text-red-700 px-4 py-3 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-text-tertiary text-xs leading-relaxed">
          Lote: processa uma por vez (até {MAX_BATCH}) e gera ZIP no final. Motor Real-ESRGAN local
          (Vulkan). No Render free o Ampliar falha: use a API no seu PC.
        </p>
      </div>
    </div>
  );
};
