import { useEffect, useRef, useState } from 'react';
import { ImageUpscale, Upload, Download, Loader2, X, AlertCircle } from 'lucide-react';

type Scale = 2 | 4;

const API_URL = import.meta.env.VITE_MUSIC_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://seu-backend-deployado.com' : `http://${window.location.hostname}:3333`);

const MAX_MP = 6_000_000;
const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';

export const ImageUpscaleView = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState<Scale>(4);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      abortRef.current?.abort();
    };
  }, []);

  const clearResult = () => {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
  };

  const resetFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    clearResult();
    setFile(null);
    setPreviewUrl(null);
    setDims(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const loadImageDims = (url: string): Promise<{ w: number; h: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      img.src = url;
    });

  const onPickFile = async (picked: File | null) => {
    if (!picked) return;
    setError(null);
    clearResult();

    if (!ACCEPT.split(',').some((t) => picked.type === t)) {
      setError('Formato inválido. Use PNG, JPG ou WebP.');
      return;
    }

    const url = URL.createObjectURL(picked);
    try {
      const d = await loadImageDims(url);
      if (d.w * d.h > MAX_MP) {
        URL.revokeObjectURL(url);
        setError(`Imagem muito grande (${d.w}×${d.h}). Limite ~6 megapixels.`);
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(picked);
      setPreviewUrl(url);
      setDims(d);
    } catch (err) {
      URL.revokeObjectURL(url);
      setError(err instanceof Error ? err.message : 'Falha ao carregar preview');
    }
  };

  const handleUpscale = async () => {
    if (!file || !dims || processing) return;
    setError(null);
    clearResult();
    setProcessing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${API_URL}/upscale?scale=${scale}`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          /* resposta não-JSON */
        }
        if (res.status === 503) {
          msg += ' A API pode estar offline ou sem o motor Real-ESRGAN.';
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Falha no upscale');
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  };

  const handleDownload = () => {
    if (!resultUrl || !file) return;
    const base = file.name.replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${base}_${scale}x.png`;
    a.click();
  };

  const target = dims ? { w: dims.w * scale, h: dims.h * scale } : null;

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
              Amplia com Real-ESRGAN (2x ou 4x). Sem paywall.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full cursor-pointer rounded-2xl border border-dashed border-border-base bg-bg-secondary/30 hover:bg-bg-secondary/60 hover:border-text-tertiary/50 transition-all py-16 flex flex-col items-center gap-3"
          >
            <Upload size={28} className="text-text-tertiary" />
            <span className="text-text-primary font-semibold">Escolher imagem</span>
            <span className="text-text-tertiary text-xs">PNG, JPG ou WebP · até ~6MP</span>
          </button>
        ) : (
          <div className="rounded-2xl border border-border-base bg-bg-secondary/30 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-text-primary font-medium truncate">{file.name}</p>
                {dims && target && (
                  <p className="text-text-secondary text-sm mt-0.5">
                    {dims.w} × {dims.h} px → {target.w} × {target.h} px
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={resetFile}
                disabled={processing}
                className="shrink-0 p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-elements cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Remover imagem"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-text-tertiary font-bold">Original</p>
                <div className="rounded-xl border border-border-base bg-bg-primary/40 overflow-hidden flex items-center justify-center min-h-[160px]">
                  {previewUrl && (
                    <img src={previewUrl} alt="Original" className="max-h-56 w-full object-contain" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-text-tertiary font-bold">Resultado</p>
                <div className="rounded-xl border border-border-base bg-bg-primary/40 overflow-hidden flex items-center justify-center min-h-[160px]">
                  {processing ? (
                    <div className="flex flex-col items-center gap-2 text-text-secondary py-10">
                      <Loader2 size={24} className="animate-spin" />
                      <span className="text-sm">Processando {scale}x…</span>
                    </div>
                  ) : resultUrl ? (
                    <img src={resultUrl} alt="Upscaled" className="max-h-56 w-full object-contain" />
                  ) : (
                    <span className="text-text-tertiary text-sm py-10">Aguardando</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-xl border border-border-base overflow-hidden">
                {([2, 4] as Scale[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={processing}
                    onClick={() => {
                      setScale(s);
                      clearResult();
                    }}
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
                onClick={handleUpscale}
                disabled={processing}
                className="cursor-pointer bg-text-primary text-bg-primary font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <ImageUpscale size={16} />}
                Ampliar
              </button>

              {resultUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="cursor-pointer border border-border-base bg-bg-secondary hover:bg-elements text-text-primary font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Download
                </button>
              )}
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
          Motor: Real-ESRGAN (modelo anime/illustration). Não é redimensionamento simples.
          Em hosts com pouca RAM (ex.: Render free) o processamento pode falhar; rode a API localmente se precisar.
        </p>
      </div>
    </div>
  );
};
