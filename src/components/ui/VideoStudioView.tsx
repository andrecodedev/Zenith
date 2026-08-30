import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  Plus,
  Save,
  Loader2,
  AlertCircle,
  Download,
  Trash2,
  Copy,
  ArrowLeft,
  Film,
  RefreshCw,
  Type,
} from 'lucide-react';
import { useVideoEditorStore } from '../../store/useVideoEditorStore';
import {
  createVideoProjectInDb,
  deleteVideoProject,
  duplicateVideoProject,
  listVideoProjects,
  loadVideoProject,
  saveVideoProject,
} from '../../lib/video-projects';
import type { VideoProjectSummary } from '../../types/video-project';
import { PROJECT_HEIGHT, PROJECT_WIDTH } from '../../types/video-project';
import { EditorCanvas } from './video-studio/EditorCanvas';
import { Timeline } from './video-studio/Timeline';
import { AssetsPanel } from './video-studio/AssetsPanel';
import { PropertiesPanel } from './video-studio/PropertiesPanel';

const API_URL =
  import.meta.env.VITE_VIDEO_API_URL ||
  (window.location.hostname.includes('vercel.app')
    ? ''
    : `http://${window.location.hostname}:3335`);

export const VideoStudioView = () => {
  const store = useVideoEditorStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [projects, setProjects] = useState<VideoProjectSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [hasFfmpeg, setHasFfmpeg] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const refreshList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const list = await listVideoProjects();
      setProjects(list);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Falha ao listar projetos');
    } finally {
      setListLoading(false);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    if (!API_URL) {
      setApiOnline(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error('offline');
      const data = await res.json();
      setApiOnline(true);
      setHasFfmpeg(Boolean(data.hasFfmpeg));
    } catch {
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    refreshList();
    refreshHealth();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshList, refreshHealth]);

  useEffect(() => {
    if (!store.isDirty || !store.project) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        store.setSaving(true);
        await saveVideoProject(store.project!);
        store.markSaved();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Falha ao salvar');
      } finally {
        store.setSaving(false);
      }
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store.isDirty, store.project]);

  const resolveImageUrl = useCallback(
    (src: string) => {
      if (!store.project || !API_URL) return '';
      if (src.startsWith('asset://')) {
        return `${API_URL}/assets/${store.project.id}/${src.replace('asset://', '')}`;
      }
      if (src.startsWith('http')) return src;
      return src;
    },
    [store.project],
  );

  const activeScene = useMemo(
    () => store.project?.scenes.find((s) => s.id === store.activeSceneId) ?? null,
    [store.project, store.activeSceneId],
  );

  const selectedLayer = useMemo(() => {
    if (!activeScene || !store.selectedLayerId) return null;
    return activeScene.layers.find((l) => l.id === store.selectedLayerId) ?? null;
  }, [activeScene, store.selectedLayerId]);

  const selectedClipInfo = useMemo(() => {
    if (!store.project || !store.selectedClipId) return null;
    for (const track of store.project.audioTracks) {
      const clip = track.clips.find((c) => c.id === store.selectedClipId);
      if (clip) return { ...clip, trackId: track.id };
    }
    return null;
  }, [store.project, store.selectedClipId]);

  const handleSaveNow = async () => {
    if (!store.project) return;
    setActionError(null);
    try {
      store.setSaving(true);
      await saveVideoProject(store.project);
      store.markSaved();
      await refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      store.setSaving(false);
    }
  };

  const handleCreate = async () => {
    setActionError(null);
    try {
      const project = await createVideoProjectInDb('Projeto Tag Aberta');
      store.loadProject(project);
      await refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao criar projeto');
    }
  };

  const handleOpen = async (id: string) => {
    setActionError(null);
    try {
      const project = await loadVideoProject(id);
      store.loadProject(project);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao abrir projeto');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateVideoProject(id);
      await refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao duplicar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este projeto?')) return;
    try {
      await deleteVideoProject(id);
      if (store.project?.id === id) store.closeProject();
      await refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao excluir');
    }
  };

  const addImageLayer = (src: string) => {
    const maxZ = activeScene?.layers.reduce((m, l) => Math.max(m, l.zIndex), 0) ?? 0;
    store.addLayer({
      type: 'image',
      id: crypto.randomUUID(),
      src,
      x: 100,
      y: 100,
      w: 640,
      h: 360,
      opacity: 1,
      zIndex: maxZ + 1,
    });
  };

  const addTextLayer = () => {
    const maxZ = activeScene?.layers.reduce((m, l) => Math.max(m, l.zIndex), 0) ?? 0;
    store.addLayer({
      type: 'text',
      id: crypto.randomUUID(),
      text: 'Novo texto',
      x: 200,
      y: 200,
      fontSize: 48,
      fontFamily: 'sans-serif',
      color: '#ffffff',
      align: 'left',
      zIndex: maxZ + 1,
    });
  };

  const addAudioClipToFirstTrack = (src: string, label: string, durationSec = 3) => {
    const track = store.project?.audioTracks[0];
    if (!track) return;
    store.addAudioClip(track.id, {
      id: crypto.randomUUID(),
      src,
      startSec: store.playheadSec,
      durationSec,
      volume: 1,
      label,
    });
  };

  const handleExport = async () => {
    if (!store.project || !API_URL) return;
    if (!hasFfmpeg) {
      setActionError('FFmpeg não instalado. Rode: sudo apt install ffmpeg');
      return;
    }
    setActionError(null);
    setExporting(true);
    setExportProgress(0);

    try {
      await handleSaveNow();
      const res = await fetch(`${API_URL}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: store.project }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao iniciar export');
      }
      const { jobId } = await res.json();

      await new Promise<void>((resolve, reject) => {
        pollRef.current = setInterval(async () => {
          try {
            const st = await fetch(`${API_URL}/render/status/${jobId}`);
            const data = await st.json();
            setExportProgress(data.progress ?? 0);
            if (data.state === 'done') {
              if (pollRef.current) clearInterval(pollRef.current);
              resolve();
            } else if (data.state === 'error') {
              if (pollRef.current) clearInterval(pollRef.current);
              reject(new Error(data.error || 'Erro no render'));
            }
          } catch (e) {
            if (pollRef.current) clearInterval(pollRef.current);
            reject(e);
          }
        }, 800);
      });

      const dl = await fetch(`${API_URL}/render/download/${jobId}`);
      if (!dl.ok) throw new Error('Falha no download');
      const blob = await dl.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${store.project.name.replace(/\s+/g, '_')}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha no export');
    } finally {
      setExporting(false);
      setExportProgress(0);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  if (store.view === 'list') {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 pb-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-title flex items-center gap-2">
              <Clapperboard size={24} />
              Video Studio
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Editor Tag Aberta: cenas, áudio ilimitado, export MP4 local.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-btn-bg border border-border-base font-bold text-sm hover:bg-elements cursor-pointer"
          >
            <Plus size={16} /> Novo projeto
          </button>
        </div>

        {apiOnline === false && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm text-amber-100">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">API Video offline</p>
              <p className="text-xs mt-1 text-amber-100/80">
                Export e SFX precisam de <code className="text-amber-50">api-video</code> na porta 3335.
                Edição e save no Supabase funcionam normalmente.
              </p>
            </div>
          </div>
        )}

        {apiOnline && !hasFfmpeg && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-sm">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <p>FFmpeg não encontrado. Instale com: sudo apt install ffmpeg</p>
          </div>
        )}

        {listError && (
          <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">
            {listError}
            {listError.includes('video_projects') && (
              <p className="text-xs mt-2 text-red-200/80">
                Rode a migration em supabase/migrations/001_video_projects.sql no Supabase SQL Editor.
              </p>
            )}
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">
            {actionError}
          </div>
        )}

        {listLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-text-tertiary" size={32} />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-base rounded-2xl text-text-tertiary">
            <Film size={40} className="mx-auto mb-3 opacity-40" />
            <p>Nenhum projeto ainda. Crie o primeiro para montar seu vídeo Tag Aberta.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-border-base bg-bg-secondary/40 hover:bg-bg-secondary/70 transition-colors"
              >
                <button
                  type="button"
                  className="flex-1 text-left cursor-pointer"
                  onClick={() => handleOpen(p.id)}
                >
                  <p className="font-bold text-text-primary">{p.name}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {p.durationSec != null ? `${Number(p.durationSec).toFixed(1)}s · ` : ''}
                    atualizado {new Date(p.updatedAt).toLocaleString('pt-BR')}
                  </p>
                </button>
                <button
                  type="button"
                  className="p-2 text-text-tertiary hover:text-text-primary cursor-pointer"
                  title="Duplicar"
                  onClick={() => handleDuplicate(p.id)}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="p-2 text-text-tertiary hover:text-red-400 cursor-pointer"
                  title="Excluir"
                  onClick={() => handleDelete(p.id)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!store.project || !activeScene) return null;

  return (
    <div className="w-full flex flex-col gap-4 pb-8 min-h-[calc(100vh-8rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => store.closeProject()}
          className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary cursor-pointer"
        >
          <ArrowLeft size={16} /> Projetos
        </button>
        <input
          className="flex-1 min-w-[180px] max-w-md bg-bg-secondary border border-border-base rounded-lg px-3 py-1.5 text-sm font-bold"
          value={store.project.name}
          onChange={(e) => store.setProjectName(e.target.value)}
        />
        <span className="text-xs text-text-tertiary">
          {store.saving ? 'Salvando...' : store.isDirty ? 'Alterações pendentes' : 'Salvo'}
        </span>
        <button
          type="button"
          onClick={handleSaveNow}
          disabled={store.saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-base bg-btn-bg text-sm hover:bg-elements cursor-pointer disabled:opacity-50"
        >
          {store.saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar
        </button>
        <button
          type="button"
          onClick={addTextLayer}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-base text-sm hover:bg-elements cursor-pointer"
        >
          <Type size={14} /> Texto
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !apiOnline}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 text-sm font-medium hover:bg-amber-500/25 cursor-pointer disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exportar MP4
        </button>
        <button type="button" onClick={refreshHealth} className="p-1.5 text-text-tertiary hover:text-text-primary">
          <RefreshCw size={14} />
        </button>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {actionError}
        </div>
      )}

      {exporting && (
        <div className="rounded-xl border border-border-base px-3 py-2">
          <div className="flex justify-between text-xs mb-1">
            <span>Exportando...</span>
            <span>{exportProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-elements overflow-hidden">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${exportProgress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-2 min-h-[200px] lg:min-h-0">
          <AssetsPanel
            projectId={store.project.id}
            apiUrl={API_URL}
            onImageUploaded={(src) => addImageLayer(src)}
            onAudioPicked={(src, label, dur) => addAudioClipToFirstTrack(src, label, dur)}
          />
        </div>
        <div className="lg:col-span-7 flex flex-col min-h-[280px]">
          <div className="text-[10px] text-text-tertiary mb-1 text-center">
            Preview {PROJECT_WIDTH}x{PROJECT_HEIGHT} (escala reduzida)
          </div>
          <EditorCanvas
            layers={activeScene.layers}
            selectedLayerId={store.selectedLayerId}
            onSelectLayer={store.selectLayer}
            onUpdateLayer={store.updateLayer}
            resolveImageUrl={resolveImageUrl}
          />
        </div>
        <div className="lg:col-span-3 min-h-[200px]">
          <PropertiesPanel
            layer={selectedLayer}
            clip={selectedClipInfo}
            selectedClipId={store.selectedClipId}
            onUpdateLayer={store.updateLayer}
            onUpdateClip={store.updateAudioClip}
            onBringForward={store.bringLayerForward}
            onSendBackward={store.sendLayerBackward}
            onRemoveLayer={store.removeLayer}
          />
        </div>
      </div>

      <Timeline
        project={store.project}
        activeSceneId={store.activeSceneId}
        playheadSec={store.playheadSec}
        selectedClipId={store.selectedClipId}
        onSelectScene={store.setActiveScene}
        onAddScene={() => store.addScene()}
        onDuplicateScene={store.duplicateScene}
        onRemoveScene={store.removeScene}
        onRenameScene={store.renameScene}
        onSetSceneDuration={store.setSceneDuration}
        onReorderScene={store.reorderScene}
        onSetPlayhead={store.setPlayhead}
        onSelectClip={store.selectClip}
        onAddAudioTrack={() => store.addAudioTrack(`Faixa ${store.project!.audioTracks.length + 1}`)}
        onRemoveAudioTrack={store.removeAudioTrack}
        onAddAudioClip={(trackId) => {
          store.addAudioClip(trackId, {
            id: crypto.randomUUID(),
            src: '',
            startSec: store.playheadSec,
            durationSec: 2,
            label: 'Novo clip (faça upload ou pick SFX)',
          });
        }}
        onRemoveAudioClip={store.removeAudioClip}
      />
    </div>
  );
};
