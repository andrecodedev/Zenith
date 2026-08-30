import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Music, Pause, Play, Search } from 'lucide-react';
import {
  importStockMedia,
  searchStockMedia,
  stockStreamUrl,
  STOCK_THEMES,
  type StockItem,
  type StockKind,
} from '../../../lib/stock-media';
import { getAudioDuration, resolveAssetSrc } from '../../../lib/video-assets';

type StockBrowserProps = {
  apiUrl: string;
  apiOnline: boolean | null;
  projectId: string;
  kind: StockKind;
  onError: (msg: string | null) => void;
  onUseImage: (src: string, durationSec?: number) => void;
  onUseFundo?: (src: string) => void;
  onUseAudio: (src: string, label: string, durationSec: number) => void;
  onAddToLibrary: (asset: {
    kind: 'image' | 'video' | 'audio';
    src: string;
    name: string;
    durationSec?: number;
  }) => void;
};

export const StockBrowser = ({
  apiUrl,
  apiOnline,
  projectId,
  kind,
  onError,
  onUseImage,
  onUseFundo,
  onUseAudio,
  onAddToLibrary,
}: StockBrowserProps) => {
  const themes = STOCK_THEMES[kind];
  const [themeId, setThemeId] = useState(themes[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [queryDebounced, setQueryDebounced] = useState('');
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewPhase, setPreviewPhase] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [hoverVideoId, setHoverVideoId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewTokenRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setQueryDebounced(query), 400);
    return () => window.clearTimeout(t);
  }, [query]);

  const activeQ =
    queryDebounced.trim() || themes.find((t) => t.id === themeId)?.q || themes[0]?.q || 'nature';

  useEffect(() => {
    if (!apiUrl || !apiOnline) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchStockMedia(apiUrl, kind, activeQ, 1)
      .then((data) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, apiOnline, kind, activeQ]);

  useEffect(() => {
    return () => {
      previewTokenRef.current += 1;
      previewRef.current?.pause();
      previewRef.current = null;
    };
  }, []);

  const stopPreview = () => {
    previewTokenRef.current += 1;
    previewRef.current?.pause();
    if (previewRef.current) {
      previewRef.current.removeAttribute('src');
      previewRef.current.load();
    }
    previewRef.current = null;
    setPreviewId(null);
    setPreviewPhase('idle');
  };

  const importItem = async (item: StockItem) => {
    const { src, name } = await importStockMedia(apiUrl, projectId, item);
    const kindLib = kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'audio';
    let durationSec = item.durationSec;
    if (kind === 'audio') {
      const url = resolveAssetSrc(src, projectId, apiUrl);
      durationSec = await getAudioDuration(url);
    }
    onAddToLibrary({ kind: kindLib, src, name, durationSec });
    return { src, name, durationSec };
  };

  const useItem = async (item: StockItem, asFundo = false) => {
    if (!apiOnline) {
      onError('Ligue a api-video para usar a biblioteca pronta.');
      return;
    }
    setBusyId(item.id);
    onError(null);
    try {
      const { src, name, durationSec } = await importItem(item);
      if (kind === 'audio') onUseAudio(src, name, durationSec ?? 8);
      else if (asFundo && onUseFundo) onUseFundo(src);
      else onUseImage(src, durationSec);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao usar o arquivo');
    } finally {
      setBusyId(null);
    }
  };

  const togglePreview = (item: StockItem) => {
    if (previewId === item.id && (previewPhase === 'playing' || previewPhase === 'loading')) {
      stopPreview();
      return;
    }
    if (!apiUrl || !apiOnline) {
      onError('Ligue a api-video para ouvir a biblioteca.');
      return;
    }

    stopPreview();
    const token = previewTokenRef.current;
    const stream = stockStreamUrl(apiUrl, item.downloadUrl);
    const audio = new Audio();
    audio.preload = 'auto';
    previewRef.current = audio;
    setPreviewId(item.id);
    setPreviewPhase('loading');
    onError(null);

    const fail = (msg: string) => {
      if (previewTokenRef.current !== token) return;
      stopPreview();
      onError(msg);
    };

    audio.onended = () => {
      if (previewTokenRef.current !== token) return;
      setPreviewId(null);
      setPreviewPhase('idle');
      previewRef.current = null;
    };
    audio.onerror = () => fail('Nao foi possivel tocar este audio. Tente outra faixa.');
    audio.onplaying = () => {
      if (previewTokenRef.current !== token) return;
      setPreviewPhase('playing');
    };

    audio.src = stream;
    void audio.play().catch(() => fail('Nao foi possivel tocar este audio. Tente outra faixa.'));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-neutral-400">Biblioteca pronta</p>
      {!apiOnline && (
        <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/25 rounded-md px-2.5 py-2">
          Sem api-video a busca de stock nao roda. Suba o servidor da porta 3335.
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setThemeId(t.id);
              setQuery('');
            }}
            className={
              'px-2 py-1 rounded-md text-[11px] cursor-pointer ' +
              (themeId === t.id && !query.trim()
                ? 'bg-violet-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5">
        <Search size={14} className="text-neutral-500 shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm text-neutral-100 outline-none"
          placeholder="Buscar na biblioteca..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {loading ? (
        <div className="flex justify-center py-6 text-neutral-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-600 py-2">
          Nada encontrado. Sem chave Pexels/Pixabay, fotos e videos ficam vazios. Audio tem uma lista Mixkit de reserva.
        </p>
      ) : kind === 'audio' ? (
        <div className="space-y-1">
          {items.map((item) => {
            const isThis = previewId === item.id;
            const playing = isThis && previewPhase === 'playing';
            const loadingPreview = isThis && previewPhase === 'loading';
            return (
            <div
              key={item.id}
              className={
                'flex items-center gap-2 px-2 py-2 rounded-lg border ' +
                (isThis
                  ? 'border-violet-400 bg-violet-600/20'
                  : 'border-neutral-700 bg-neutral-800/50')
              }
            >
              <button
                type="button"
                title={playing || loadingPreview ? 'Pausar' : 'Ouvir'}
                onClick={() => togglePreview(item)}
                className={
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer ' +
                  (isThis ? 'bg-violet-600 text-white' : 'bg-violet-600/20 text-violet-300')
                }
              >
                {loadingPreview ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : playing ? (
                  <Pause size={14} fill="currentColor" />
                ) : (
                  <Play size={14} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-200 truncate">{item.name}</p>
                <p className="text-[10px] text-neutral-500 truncate">
                  {loadingPreview ? 'Carregando...' : playing ? 'Tocando...' : item.credit}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => useItem(item)}
                className="px-2 py-1 rounded-md bg-violet-600 text-white text-[11px] cursor-pointer disabled:opacity-50"
              >
                {busyId === item.id ? <Loader2 size={12} className="animate-spin" /> : 'Usar'}
              </button>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const videoSrc = item.previewUrl || item.downloadUrl;
            const showVideo = kind === 'video' && hoverVideoId === item.id && videoSrc;
            return (
              <div key={item.id} className="rounded-lg border border-neutral-700 overflow-hidden bg-neutral-800">
                <div
                  className="aspect-video bg-neutral-900 relative"
                  onMouseEnter={() => kind === 'video' && setHoverVideoId(item.id)}
                  onMouseLeave={() => setHoverVideoId((id) => (id === item.id ? null : id))}
                >
                  {showVideo ? (
                    <video
                      src={videoSrc}
                      muted
                      playsInline
                      autoPlay
                      loop
                      className="w-full h-full object-cover"
                    />
                  ) : item.thumb ? (
                    <img src={item.thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <Music size={20} />
                    </div>
                  )}
                  {kind === 'video' && !showVideo && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-neutral-200">
                      Passe o mouse
                    </span>
                  )}
                  {busyId === item.id && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 size={18} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400 px-1.5 pt-1 truncate">{item.credit}</p>
                <div className="flex gap-1 p-1.5">
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => useItem(item)}
                    className="flex-1 py-1 rounded-md bg-violet-600 text-white text-[11px] cursor-pointer disabled:opacity-50"
                  >
                    Usar
                  </button>
                  {onUseFundo && (kind === 'image' || kind === 'video') && (
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      title="Usar como fundo"
                      onClick={() => useItem(item, true)}
                      className="px-1.5 py-1 rounded-md bg-neutral-700 text-neutral-100 cursor-pointer disabled:opacity-50"
                    >
                      <ImagePlus size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-neutral-600">
        Pexels e Pixabay (foto/video). Musica: Jamendo ou Mixkit. O arquivo e copiado para o projeto.
      </p>
    </div>
  );
};
