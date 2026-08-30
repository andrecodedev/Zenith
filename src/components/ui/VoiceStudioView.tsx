import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Upload,
  Download,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Mic2,
  RefreshCw,
} from 'lucide-react';

type Tab = 'voices' | 'generate';

type VoiceProfile = {
  id: string;
  name: string;
  createdAt: string;
  sampleCount?: number;
  sampleDurationSec?: number | null;
  status?: 'pending' | 'confirmed';
  previewStatus?: string;
  previewError?: string | null;
  hasPreview?: boolean;
  previewProgressCurrent?: number;
  previewProgressTotal?: number;
};

type JobStatus = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  chunkCurrent: number;
  chunkTotal: number;
  error: string | null;
  variantCount?: number;
};

const API_URL =
  import.meta.env.VITE_TTS_API_URL ||
  (window.location.hostname.includes('vercel.app')
    ? ''
    : `http://${window.location.hostname}:3334`);

const DEFAULT_MAX_CHARS = 1500;
const MAX_VOICE_FILES = 50;
const ACCEPT_AUDIO = 'audio/*,.mp3,.MP3,.wav,.m4a,.ogg,.opus,.flac,.webm,.aac';
const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|opus|flac|webm|aac)$/i;

const isAudioFile = (file: File) =>
  AUDIO_EXT.test(file.name) || file.type.startsWith('audio/');

const progressPercent = (current: number, total: number) => {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
};

/** Barra + % para jobs longos (preview / gerar fala). */
const JobProgress = ({
  label,
  current,
  total,
  hint,
}: {
  label: string;
  current: number;
  total: number;
  hint?: string;
}) => {
  const pct = total > 0 ? progressPercent(current, total) : null;
  const width = pct != null ? pct : 12;
  return (
    <div className="rounded-xl border border-border-base/60 bg-bg-primary/40 px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-primary flex items-center gap-2 min-w-0">
          <Loader2 size={16} className="animate-spin shrink-0 text-amber-200" />
          <span className="truncate">{label}</span>
        </p>
        <span className="text-lg font-semibold tabular-nums text-text-primary shrink-0">
          {pct != null ? `${pct}%` : '...'}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-elements overflow-hidden">
        <div
          className={`h-full bg-amber-300/90 transition-all duration-500 ${
            pct == null ? 'animate-pulse' : ''
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-xs text-text-tertiary">
        {total > 0
          ? `Passo ${current} de ${total}${hint ? ` · ${hint}` : ''}`
          : hint || 'Preparando modelo (primeira vez demora mais)...'}
      </p>
    </div>
  );
};

export const VoiceStudioView = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tab, setTab] = useState<Tab>('voices');
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [device, setDevice] = useState('cpu');
  const [maxChars, setMaxChars] = useState(DEFAULT_MAX_CHARS);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [voiceName, setVoiceName] = useState('');
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [reviewVoiceId, setReviewVoiceId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState({ current: 0, total: 0 });

  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState(1);
  const [wantTwoVariants, setWantTwoVariants] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [audioUrlA, setAudioUrlA] = useState<string | null>(null);
  const [audioUrlB, setAudioUrlB] = useState<string | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const stopPreviewPoll = () => {
    if (previewPollRef.current) {
      clearInterval(previewPollRef.current);
      previewPollRef.current = null;
    }
  };

  const clearPreview = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const clearOutputs = () => {
    setAudioUrlA((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAudioUrlB((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    return () => {
      stopPoll();
      stopPreviewPoll();
    };
  }, []);

  const refreshHealth = useCallback(async () => {
    if (!API_URL) {
      setApiOnline(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error('health');
      const data = await res.json();
      setApiOnline(true);
      setDevice(data.device || 'cpu');
      if (typeof data.maxChars === 'number') setMaxChars(data.maxChars);
    } catch {
      setApiOnline(false);
    }
  }, []);

  const refreshVoices = useCallback(async () => {
    if (!API_URL) return [] as VoiceProfile[];
    try {
      const res = await fetch(`${API_URL}/voices`);
      if (!res.ok) throw new Error('voices');
      const list = (await res.json()) as VoiceProfile[];
      setVoices(list);
      const confirmed = list.filter((v) => (v.status || 'confirmed') === 'confirmed');
      setSelectedVoiceId((prev) => {
        if (prev && confirmed.some((v) => v.id === prev)) return prev;
        return confirmed[0]?.id || '';
      });
      return list;
    } catch {
      return [] as VoiceProfile[];
    }
  }, []);

  // Bootstrap da tela: adia o fetch para fora do corpo síncrono do effect
  // (eslint react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshHealth();
      void refreshVoices();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshHealth, refreshVoices]);

  const loadPreviewAudio = async (voiceId: string) => {
    if (!API_URL) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_URL}/voices/${voiceId}/preview`);
      if (!res.ok) throw new Error('Preview ainda não disponível');
      const blob = await res.blob();
      clearPreview();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const watchPreview = (voiceId: string) => {
    stopPreviewPoll();
    setReviewVoiceId(voiceId);
    setTab('voices');
    setPreviewProgress({ current: 0, total: 0 });
    setInfo('Gerando preview do clone (CPU: pode demorar). Ouça antes de manter a voz.');
    previewPollRef.current = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(`${API_URL}/voices/${voiceId}`);
          if (!res.ok) return;
          const voice = (await res.json()) as VoiceProfile;
          setPreviewProgress({
            current: voice.previewProgressCurrent || 0,
            total: voice.previewProgressTotal || 0,
          });
          await refreshVoices();
          if (voice.previewStatus === 'ready') {
            stopPreviewPoll();
            setTab('voices');
            setInfo('Preview pronto. Ouça e escolha: Manter ou Descartar.');
            await loadPreviewAudio(voiceId);
          } else if (voice.previewStatus === 'error') {
            stopPreviewPoll();
            setError(voice.previewError || 'Falha ao gerar preview do clone');
          }
        } catch {
          /* ignore */
        }
      })();
    }, 1500);
  };

  const onPickVoiceFiles = (list: FileList | null) => {
    if (!list?.length) {
      setError('Nenhum arquivo veio do seletor. Tente de novo ou arraste o MP3.');
      return;
    }
    const picked = Array.from(list);
    const accepted = picked.filter(isAudioFile);
    const rejected = picked.filter((f) => !isAudioFile(f));
    if (!accepted.length) {
      setError(
        `Formato não aceito (${picked.map((f) => f.name).join(', ')}). Use MP3, WAV, M4A ou OGG.`
      );
      return;
    }
    setError(null);
    setVoiceFiles((prev) => {
      const merged = [...prev, ...accepted];
      if (merged.length > MAX_VOICE_FILES) {
        setError(
          `Limite de ${MAX_VOICE_FILES} arquivos. Mantive os primeiros. Qualidade = clips limpos (6-18s).`
        );
        return merged.slice(0, MAX_VOICE_FILES);
      }
      return merged;
    });
    setInfo(
      rejected.length
        ? `${accepted.length} áudio(s) ok. Ignorados: ${rejected.map((f) => f.name).join(', ')}`
        : `${accepted.length} áudio(s) pronto(s). Digite um nome e Salvar.`
    );
    if (fileRef.current) fileRef.current.value = '';
  };

  const createVoice = async () => {
    if (!API_URL) {
      setError('Configure VITE_TTS_API_URL no .env.local');
      return;
    }
    if (!voiceName.trim()) {
      setError('Dê um nome à voz (ex.: Andre 2)');
      return;
    }
    if (!voiceFiles.length) {
      setError('Envie pelo menos 1 amostra de áudio');
      return;
    }

    setCreating(true);
    setError(null);
    setInfo(null);
    clearPreview();
    try {
      const fd = new FormData();
      fd.append('name', voiceName.trim());
      for (const f of voiceFiles) fd.append('files', f);
      const res = await fetch(`${API_URL}/voices/create`, { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : body.error || `HTTP ${res.status}`
        );
      }
      setVoiceName('');
      setVoiceFiles([]);
      setTab('voices');
      await refreshVoices();
      watchPreview(body.id as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar voz');
    } finally {
      setCreating(false);
    }
  };

  const confirmVoice = async (id: string) => {
    if (!API_URL) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/voices/${id}/confirm`, { method: 'POST' });
      if (!res.ok) throw new Error('Não foi possivel confirmar a voz');
      setInfo('Voz mantida. Agora pode usar em Gerar Fala.');
      setReviewVoiceId(null);
      clearPreview();
      await refreshVoices();
      setSelectedVoiceId(id);
      setTab('generate');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao confirmar');
    }
  };

  const rebuildPreview = async (id: string) => {
    if (!API_URL) return;
    setError(null);
    clearPreview();
    try {
      const res = await fetch(`${API_URL}/voices/${id}/preview`, { method: 'POST' });
      if (!res.ok) throw new Error('Não foi possivel recalcular o preview');
      watchPreview(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao regenerar preview');
    }
  };

  const removeVoice = async (id: string) => {
    if (!API_URL) return;
    if (!confirm('Apagar este perfil de voz?')) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/voices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Não foi possivel apagar');
      if (selectedVoiceId === id) setSelectedVoiceId('');
      if (reviewVoiceId === id) {
        setReviewVoiceId(null);
        clearPreview();
        stopPreviewPoll();
      }
      await refreshVoices();
      setInfo('Voz removida.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao apagar');
    }
  };

  const generate = async () => {
    if (!API_URL) {
      setError('API TTS offline. Suba api-tts na porta 3334.');
      return;
    }
    if (!selectedVoiceId) {
      setError('Selecione uma voz confirmada (ouça o preview e clique em Manter).');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Cole o roteiro na caixa de texto');
      return;
    }
    if (trimmed.length > maxChars) {
      setError(`Texto com ${trimmed.length} caracteres. Limite neste PC (CPU): ${maxChars}.`);
      return;
    }

    setGenerating(true);
    setError(null);
    setInfo(null);
    setProgress({ current: 0, total: 0 });
    clearOutputs();
    stopPoll();

    const variants = wantTwoVariants ? 2 : 1;
    try {
      const res = await fetch(`${API_URL}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: selectedVoiceId,
          text: trimmed,
          speed,
          language: 'pt',
          variants,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.detail || body.error || `HTTP ${res.status}`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      const jobId = body.jobId as string;
      const variantCount = (body.variantCount as number) || variants;
      setProgress({ current: 0, total: body.chunkTotal || 0 });
      setInfo(
        (body.device || device) === 'cpu'
          ? `Gerando ${variantCount} opção(ões) em CPU. Não feche a aba.`
          : `Gerando ${variantCount} opção(ões)...`
      );

      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const st = await fetch(`${API_URL}/tts/status/${jobId}`);
            if (!st.ok) return;
            const job = (await st.json()) as JobStatus;
            setProgress({ current: job.chunkCurrent, total: job.chunkTotal });
            if (job.status === 'done') {
              stopPoll();
              const count = job.variantCount || variantCount;
              const dlA = await fetch(`${API_URL}/tts/download/${jobId}?variant=0`);
              if (!dlA.ok) throw new Error('Falha no download da opção A');
              setAudioUrlA(URL.createObjectURL(await dlA.blob()));
              if (count > 1) {
                const dlB = await fetch(`${API_URL}/tts/download/${jobId}?variant=1`);
                if (!dlB.ok) throw new Error('Falha no download da opção B');
                setAudioUrlB(URL.createObjectURL(await dlB.blob()));
              }
              setGenerating(false);
              setInfo(
                count > 1
                  ? 'Pronto. Ouça A e B e baixe a que ficar melhor.'
                  : 'Pronto. Ouça o preview e baixe o WAV.'
              );
            } else if (job.status === 'error') {
              stopPoll();
              setGenerating(false);
              setError(job.error || 'Erro na síntese');
            }
          } catch (err) {
            stopPoll();
            setGenerating(false);
            setError(err instanceof Error ? err.message : 'Erro ao acompanhar job');
          }
        })();
      }, 1500);
    } catch (e) {
      setGenerating(false);
      setError(e instanceof Error ? e.message : 'Falha ao iniciar geração');
    }
  };

  const downloadBlobUrl = (url: string, label: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenith-voice-${label}-${Date.now()}.wav`;
    a.click();
  };

  const charCount = text.length;
  const overLimit = charCount > maxChars;
  const confirmedVoices = voices.filter((v) => (v.status || 'confirmed') === 'confirmed');
  const reviewVoice =
    voices.find((v) => v.id === reviewVoiceId) ||
    voices.find((v) => v.status === 'pending') ||
    null;
  const previewBusy =
    !!reviewVoice &&
    (reviewVoice.previewStatus === 'queued' || reviewVoice.previewStatus === 'running');
  const previewPct = progressPercent(
    previewProgress.current || reviewVoice?.previewProgressCurrent || 0,
    previewProgress.total || reviewVoice?.previewProgressTotal || 0
  );

  return (
    <div className="w-full flex-1 flex flex-col mb-8 px-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl border border-border-base bg-bg-secondary/50 flex items-center justify-center">
            <AudioLines size={20} className="text-text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold font-title">Voice Studio</h2>
            <p className="text-text-secondary text-sm">
              Fluxo tipo Fish: cria a voz, ouve o preview, só então mantém. Duas takes (A/B) na
              geracao. Clone local (XTTS/CPU) aproxima o timbre; nao fica identico ao Fish pago.
            </p>
          </div>
        </div>

        {apiOnline === false && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              API TTS offline. Em outro terminal:{' '}
              <code className="text-xs">
                cd api-tts && source .venv/bin/activate && uvicorn main:app --host 127.0.0.1 --port
                3334
              </code>
            </span>
          </div>
        )}
        {apiOnline && device === 'cpu' && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-border-base bg-bg-secondary/40 px-3 py-2.5 text-sm text-text-secondary">
            <Mic2 size={16} className="mt-0.5 shrink-0" />
            <span>
              Modo CPU (sem NVIDIA): demora e o clone nao fica 100% igual a voce. Melhor amostra:
              4 a 6 audios limpos de 6 a 12s (sem WhatsApp comprimido, sem musica). Para voz
              identica tipo estudio, so API paga (Fish) ou GPU NVIDIA com fine-tune.
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setTab('generate')}
          className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'generate'
              ? 'bg-white text-black'
              : 'bg-btn-bg text-text-tertiary hover:text-text-primary'
          }`}
        >
          Gerar Fala
        </button>
        <button
          type="button"
          onClick={() => setTab('voices')}
          className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'voices'
              ? 'bg-white text-black'
              : 'bg-btn-bg text-text-tertiary hover:text-text-primary'
          }`}
        >
          Minhas Vozes
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && !error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {tab === 'voices' ? (
        <div className="space-y-5">
          {reviewVoice && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 space-y-3">
              <h3 className="font-semibold text-amber-100">Revisar clone: {reviewVoice.name}</h3>
              <p className="text-xs text-amber-100/80 leading-relaxed">
                Ouça o teste. Se parecer com você, mantenha. Se não, descarte e recrie com clips
                melhores (6-18s, sem música). O XTTS local não clona igual ao Fish pago.
              </p>

              {previewBusy ? (
                <JobProgress
                  label={
                    reviewVoice.previewStatus === 'queued'
                      ? 'Na fila da CPU...'
                      : 'Sintetizando preview do clone...'
                  }
                  current={previewProgress.current || reviewVoice.previewProgressCurrent || 0}
                  total={previewProgress.total || reviewVoice.previewProgressTotal || 0}
                  hint="CPU sem NVIDIA: cada frase leva dezenas de segundos"
                />
              ) : (
                <p className="text-xs text-text-tertiary">
                  Status preview: {reviewVoice.previewStatus || '...'}
                  {reviewVoice.previewStatus === 'ready' ? ` · ${previewPct || 100}%` : ''}
                </p>
              )}

              {previewLoading && (
                <p className="text-sm text-text-secondary flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Carregando áudio...
                </p>
              )}
              {previewUrl && !previewBusy && (
                <audio controls autoPlay src={previewUrl} className="w-full" />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!previewUrl || reviewVoice.previewStatus !== 'ready' || previewBusy}
                  onClick={() => void confirmVoice(reviewVoice.id)}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-40"
                >
                  Manter esta voz
                </button>
                <button
                  type="button"
                  disabled={previewBusy}
                  onClick={() => void rebuildPreview(reviewVoice.id)}
                  className="cursor-pointer px-4 py-2 rounded-xl border border-border-base text-sm text-text-secondary flex items-center gap-2 disabled:opacity-40"
                >
                  <RefreshCw size={14} /> Regenerar preview
                </button>
                <button
                  type="button"
                  onClick={() => void removeVoice(reviewVoice.id)}
                  className="cursor-pointer px-4 py-2 rounded-xl border border-red-500/40 text-sm text-red-200"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border-base bg-bg-secondary/30 p-4 sm:p-5 space-y-4">
            <h3 className="font-semibold text-text-primary">Criar perfil de voz</h3>
            <p className="text-text-tertiary text-xs leading-relaxed">
              Até {MAX_VOICE_FILES} arquivos. Depois de salvar, o Zenith gera um preview para você
              validar o clone antes de usar.
            </p>
            <label className="block space-y-1.5">
              <span className="text-xs text-text-tertiary">1. Nome do perfil (obrigatório)</span>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder='Ex.: "Andre 2"'
                className="w-full rounded-lg border border-border-base bg-bg-primary/40 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-text-tertiary"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs text-text-tertiary">2. Áudios de referência</span>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_AUDIO}
                multiple
                style={{ position: 'fixed', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                onChange={(e) => onPickVoiceFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full cursor-pointer rounded-xl border border-dashed border-border-base py-8 flex flex-col items-center gap-2 hover:bg-elements/40"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPickVoiceFiles(e.dataTransfer.files);
                }}
              >
                <Upload size={22} className="text-text-tertiary" />
                <span className="text-sm text-text-secondary text-center px-4">
                  {voiceFiles.length
                    ? `${voiceFiles.length} arquivo(s) — clique para adicionar mais`
                    : 'Clique aqui e escolha o MP3 (ou arraste)'}
                </span>
              </button>
            </div>

            {voiceFiles.length > 0 && (
              <ul className="text-xs text-text-secondary space-y-1 rounded-lg border border-border-base/50 bg-bg-primary/30 px-3 py-2">
                {voiceFiles.map((f) => (
                  <li
                    key={`${f.name}-${f.size}-${f.lastModified}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-text-tertiary">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={
                creating || apiOnline === false || !voiceName.trim() || voiceFiles.length === 0
              }
              onClick={() => void createVoice()}
              className="cursor-pointer w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Mic2 size={16} />}
              3. Salvar e gerar preview
            </button>
          </div>

          <div className="rounded-2xl border border-border-base bg-bg-secondary/30 p-4 sm:p-5 space-y-3">
            <h3 className="font-semibold text-text-primary">Perfis salvos</h3>
            {voices.length === 0 ? (
              <p className="text-sm text-text-tertiary">Nenhuma voz ainda.</p>
            ) : (
              <ul className="space-y-2">
                {voices.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-base/60 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{v.name}</p>
                      <p className="text-xs text-text-tertiary">
                        {v.sampleCount ?? '?'} amostra(s)
                        {v.sampleDurationSec != null ? ` · ${v.sampleDurationSec}s` : ''}
                        {' · '}
                        {(v.status || 'confirmed') === 'pending'
                          ? 'pendente (ouça preview)'
                          : 'confirmada'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(v.status === 'pending' || v.previewStatus === 'ready') && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewVoiceId(v.id);
                            if (v.previewStatus === 'ready') void loadPreviewAudio(v.id);
                            else watchPreview(v.id);
                          }}
                          className="cursor-pointer px-2 py-1 rounded-lg text-xs text-text-secondary hover:bg-elements"
                        >
                          Ouvir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeVoice(v.id)}
                        className="cursor-pointer p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-elements"
                        title="Apagar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border-base bg-bg-secondary/30 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <label className="flex-1 space-y-1.5">
                <span className="text-xs text-text-tertiary">Voz (só confirmadas)</span>
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className="w-full rounded-lg border border-border-base bg-bg-primary/40 px-3 py-2.5 text-sm text-text-primary outline-none"
                >
                  <option value="">Selecione...</option>
                  {confirmedVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:w-40 space-y-1.5">
                <span className="text-xs text-text-tertiary">Velocidade {speed.toFixed(1)}x</span>
                <input
                  type="range"
                  min={0.8}
                  max={1.2}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </label>
            </div>

            {confirmedVoices.length === 0 && (
              <p className="text-xs text-amber-200/90">
                Nenhuma voz confirmada. Em Minhas Vozes, crie um perfil, ouça o preview e clique em
                Manter.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={wantTwoVariants}
                onChange={(e) => setWantTwoVariants(e.target.checked)}
                className="cursor-pointer"
              />
              Gerar 2 opções (A/B), no estilo Fish — demora ~2x na CPU
            </label>

            <label className="block space-y-1.5">
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>Roteiro</span>
                <span className={overLimit ? 'text-red-400' : ''}>
                  {charCount} / {maxChars}
                </span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder="Cole aqui o roteiro..."
                className="w-full rounded-xl border border-border-base bg-bg-primary/40 px-3 py-3 text-sm text-text-primary outline-none focus:border-text-tertiary resize-y min-h-50"
              />
            </label>

            {generating && (
              <JobProgress
                label="Gerando fala..."
                current={progress.current}
                total={progress.total}
                hint={
                  wantTwoVariants
                    ? '2 opções A/B na CPU: pode passar de vários minutos'
                    : 'CPU sem NVIDIA: aguarde sem fechar a aba'
                }
              />
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generating || apiOnline === false || overLimit || !selectedVoiceId}
                onClick={() => void generate()}
                className="cursor-pointer px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <AudioLines size={16} />
                )}
                Gerar fala
              </button>
              {text && (
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => setText('')}
                  className="cursor-pointer px-4 py-2.5 rounded-xl border border-border-base text-text-tertiary text-sm hover:text-text-primary flex items-center gap-2"
                >
                  <X size={14} />
                  Limpar texto
                </button>
              )}
            </div>
          </div>

          {(audioUrlA || audioUrlB) && (
            <div className="rounded-2xl border border-border-base bg-bg-secondary/30 p-4 sm:p-5 space-y-4">
              <h3 className="font-semibold text-text-primary">Escolha a melhor take</h3>
              {audioUrlA && (
                <div className="space-y-2">
                  <p className="text-sm text-text-secondary">Opção A</p>
                  <audio controls src={audioUrlA} className="w-full" />
                  <button
                    type="button"
                    onClick={() => downloadBlobUrl(audioUrlA, 'a')}
                    className="cursor-pointer px-4 py-2 rounded-xl bg-white text-black font-semibold text-sm flex items-center gap-2"
                  >
                    <Download size={16} /> Baixar A
                  </button>
                </div>
              )}
              {audioUrlB && (
                <div className="space-y-2 pt-2 border-t border-border-base/50">
                  <p className="text-sm text-text-secondary">Opção B</p>
                  <audio controls src={audioUrlB} className="w-full" />
                  <button
                    type="button"
                    onClick={() => downloadBlobUrl(audioUrlB, 'b')}
                    className="cursor-pointer px-4 py-2 rounded-xl bg-white text-black font-semibold text-sm flex items-center gap-2"
                  >
                    <Download size={16} /> Baixar B
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
