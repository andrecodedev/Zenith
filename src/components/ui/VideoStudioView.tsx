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
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Undo2,
  Redo2,
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
import { projectTotalDurationSec, sceneAtTime, createEmptyBanner } from '../../types/video-project';
import { resolveAssetSrc, isVideoSrc } from '../../lib/video-assets';
import { persistImageBlob, stripImageBackground } from '../../lib/remove-background';
import { getMatchMoveAt, layersForPreview } from '../../lib/match-move';
import { EditorCanvas } from './video-studio/EditorCanvas';
import { Timeline } from './video-studio/Timeline';
import { AssetsPanel } from './video-studio/AssetsPanel';
import { EditorToolbar, type ElementSidePanel } from './video-studio/EditorToolbar';
import { ConfirmModal } from './ConfirmModal';
import { usePreviewAudio } from './video-studio/usePreviewAudio';
import { bannerFileName, downloadBlob, exportBannerPng4k } from '../../lib/export-banner';

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
  const [exportingBanner, setExportingBanner] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [sidePanel, setSidePanel] = useState<
    'none' | 'position' | 'audio' | 'transitions' | 'effects' | 'animate'
  >('none');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [transitionSceneId, setTransitionSceneId] = useState<string | null>(null);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [removingBgHint, setRemovingBgHint] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [timelineH, setTimelineH] = useState(240);

  const closeSidePanel = () => {
    setSidePanel('none');
    setTransitionSceneId(null);
  };

  const openTransitionPanel = (sceneId: string) => {
    setTransitionSceneId(sceneId);
    setSidePanel('transitions');
    setSidebarExpanded(true);
  };

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
    (src: string) => resolveAssetSrc(src, store.project?.id, API_URL),
    [store.project],
  );

  const previewAudio = usePreviewAudio(store.project?.id, API_URL, store.isPlaying);

  useEffect(() => {
    if (!store.project?.id) return;
    setSidebarExpanded(false);
    setSidePanel('none');
    setTransitionSceneId(null);
  }, [store.project?.id]);

  useEffect(() => {
    if (store.selectedClipId) {
      setSidePanel('audio');
      setTransitionSceneId(null);
    }
  }, [store.selectedClipId]);

  useEffect(() => {
    if (store.view !== 'editor' || !store.project) return;

    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useVideoEditorStore.getState().deleteSelection();
        return;
      }
      if (e.key === 'Escape') {
        useVideoEditorStore.getState().cancelStylePaint();
        return;
      }
      if (!e.ctrlKey && !e.metaKey) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        useVideoEditorStore.getState().redo();
      } else if (key === 'z') {
        e.preventDefault();
        useVideoEditorStore.getState().undo();
      } else if (key === 'y') {
        e.preventDefault();
        useVideoEditorStore.getState().redo();
      } else if (key === 'x') {
        e.preventDefault();
        useVideoEditorStore.getState().cutSelection();
      } else if (key === 'c') {
        e.preventDefault();
        useVideoEditorStore.getState().copySelection();
      } else if (key === 'v') {
        e.preventDefault();
        useVideoEditorStore.getState().pasteSelection();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [store.view, store.project?.id]);

  useEffect(() => {
    if (!store.isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      useVideoEditorStore.getState().tickPlayhead(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [store.isPlaying]);

  const totalDuration = store.project ? projectTotalDurationSec(store.project) : 0;

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isBanner = store.editorSurface === 'banner';

  const previewScene = useMemo(() => {
    if (!store.project) return null;
    if (isBanner) return (store.project.banner ?? createEmptyBanner()).scene;
    return sceneAtTime(store.project, store.playheadSec);
  }, [store.project, store.playheadSec, isBanner]);

  const matchMove = useMemo(
    () =>
      !isBanner && store.project
        ? getMatchMoveAt(store.project, store.playheadSec)
        : { active: false as const },
    [store.project, store.playheadSec, isBanner],
  );

  const previewElements = useMemo(() => {
    if (!store.project) return [];
    if (isBanner) return (store.project.banner ?? createEmptyBanner()).elements;
    return layersForPreview(store.project, store.playheadSec, matchMove);
  }, [store.project, store.playheadSec, matchMove, isBanner]);

  const transitionBackground = useMemo(() => {
    if (!matchMove.active) return null;
    const p = matchMove.progress;
    return {
      fromColor: matchMove.fromScene.backgroundColor ?? '#ffffff',
      fromSrc: matchMove.fromScene.backgroundSrc,
      fromOpacity: 1 - p,
      toColor: matchMove.toScene.backgroundColor ?? '#ffffff',
      toSrc: matchMove.toScene.backgroundSrc,
      toOpacity: p,
    };
  }, [matchMove]);

  const selectedLayer = useMemo(() => {
    if (!store.project || !store.selectedLayerId) return null;
    const list = isBanner
      ? (store.project.banner ?? createEmptyBanner()).elements
      : store.project.elements;
    return list.find((l) => l.id === store.selectedLayerId) ?? null;
  }, [store.project, store.selectedLayerId, isBanner]);

  const selectedScene = useMemo(() => {
    if (!store.project || store.selectedLayerId || store.selectedClipId || !store.activeSceneId) {
      return null;
    }
    if (isBanner) {
      const scene = (store.project.banner ?? createEmptyBanner()).scene;
      return scene.id === store.activeSceneId ? scene : null;
    }
    return store.project.scenes.find((s) => s.id === store.activeSceneId) ?? null;
  }, [store.project, store.activeSceneId, store.selectedLayerId, store.selectedClipId, isBanner]);

  const workingProject = useMemo(() => {
    if (!store.project) return null;
    if (!isBanner) return store.project;
    const banner = store.project.banner ?? createEmptyBanner();
    return { ...store.project, scenes: [banner.scene], elements: banner.elements };
  }, [store.project, isBanner]);

  const selectedClipInfo = useMemo(() => {
    if (!store.project || !store.selectedClipId) return null;
    for (const track of store.project.audioTracks) {
      const clip = track.clips.find((c) => c.id === store.selectedClipId);
      if (clip) return { ...clip, trackId: track.id };
    }
    return null;
  }, [store.project, store.selectedClipId]);

  const handleRemoveBackground = async () => {
    if (removingBackground) return;
    const project = store.project;
    if (!project) return;
    const layer = selectedLayer;
    const scene = selectedScene;
    let src = '';
    let apply: ((next: string) => void) | null = null;
    if (layer?.type === 'image') {
      src = resolveImageUrl(layer.src);
      apply = (next) => store.updateElement(layer.id, { src: next, fillColor: 'transparent' });
    } else if (scene?.backgroundSrc) {
      src = resolveImageUrl(scene.backgroundSrc);
      apply = (next) => store.setSceneBackground(scene.id, next);
    }
    if (!src || !apply) {
      setActionError('Selecione uma imagem (ou um fundo com foto)');
      return;
    }
    setRemovingBackground(true);
    setActionError(null);
    setRemovingBgHint('Preparando...');
    try {
      const blob = await stripImageBackground(src, setRemovingBgHint);
      const stored = await persistImageBlob(blob, {
        apiUrl: API_URL,
        apiOnline,
        projectId: project.id,
      });
      apply(stored);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao remover fundo');
    } finally {
      setRemovingBackground(false);
      setRemovingBgHint(null);
    }
  };

  const transitionScene = useMemo(() => {
    if (!store.project || !transitionSceneId) return null;
    return store.project.scenes.find((s) => s.id === transitionSceneId) ?? null;
  }, [store.project, transitionSceneId]);

  const transitionSceneIndex = useMemo(() => {
    if (!store.project || !transitionSceneId) return -1;
    return store.project.scenes.findIndex((s) => s.id === transitionSceneId);
  }, [store.project, transitionSceneId]);

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

  const handleDelete = (id: string) => {
    const name = projects.find((p) => p.id === id)?.name ?? 'este projeto';
    setPendingDelete({ id, name });
  };

  const confirmDeleteProject = async () => {
    if (!pendingDelete) return;
    setDeletingProject(true);
    setActionError(null);
    try {
      await deleteVideoProject(pendingDelete.id);
      if (store.project?.id === pendingDelete.id) store.closeProject();
      setPendingDelete(null);
      await refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao excluir');
    } finally {
      setDeletingProject(false);
    }
  };

  const addImageElement = (src: string, size?: { w: number; h: number }, durationSec?: number) => {
    const place = (w: number, h: number) => {
      store.addElement({
        type: 'image',
        id: crypto.randomUUID(),
        src,
        x: 160,
        y: 80,
        w,
        h,
        opacity: 1,
        startSec: store.playheadSec,
        durationSec: durationSec ?? (isVideoSrc(src) ? 8 : 5),
        zIndex: 0,
      });
    };
    if (size) {
      place(size.w, size.h);
      return;
    }
    if (src.startsWith('/personagem/')) {
      const img = new Image();
      img.onload = () => {
        const maxH = 780;
        const maxW = 900;
        const s = Math.min(1, maxH / img.naturalHeight, maxW / img.naturalWidth);
        place(Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s));
      };
      img.onerror = () => place(480, 640);
      img.src = src;
      return;
    }
    place(640, 360);
  };

  const addShapeElement = (src: string) => {
    addImageElement(src, { w: 320, h: 200 });
  };

  const setFundoBackground = (src: string) => {
    const scene = previewScene ?? store.project?.scenes[0];
    if (scene) store.setSceneBackground(scene.id, src);
  };

  const addTextLayer = (preset?: 'title' | 'subtitle' | 'body') => {
    const presets = {
      title: { text: 'Título', fontSize: 72, y: 140 },
      subtitle: { text: 'Subtítulo', fontSize: 48, y: 240 },
      body: { text: 'Seu texto aqui', fontSize: 32, y: 340 },
    } as const;
    const d = preset ? presets[preset] : { text: 'Novo texto', fontSize: 48, y: 200 };
    store.addElement({
      type: 'text',
      id: crypto.randomUUID(),
      text: d.text,
      x: 160,
      y: d.y,
      fontSize: d.fontSize,
      fontFamily: 'sans-serif',
      color: '#111827',
      align: 'left',
      startSec: store.playheadSec,
      durationSec: 5,
      zIndex: 0,
    });
  };

  const addAudioClipToFirstTrack = (src: string, label: string, durationSec = 3) => {
    if (!store.project) return;
    if (!store.project.audioTracks[0]?.id) store.addAudioTrack('Áudio');
    const trackId = useVideoEditorStore.getState().project?.audioTracks[0]?.id;
    if (!trackId) return;
    store.addAudioClip(trackId, {
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
        body: JSON.stringify({ project: store.project, uhd: true }),
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
      a.download = `${store.project.name.replace(/\s+/g, '_')}_4k.mp4`;
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

  const handleExportBanner = async () => {
    if (!store.project) return;
    setActionError(null);
    setExportingBanner(true);
    try {
      const banner = store.project.banner ?? createEmptyBanner();
      const blob = await exportBannerPng4k({
        scene: banner.scene,
        elements: banner.elements,
        resolveUrl: resolveImageUrl,
      });
      downloadBlob(blob, bannerFileName(store.project.name));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao gerar o PNG 4K');
    } finally {
      setExportingBanner(false);
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

        <ConfirmModal
          open={pendingDelete != null}
          title="Excluir este projeto?"
          description={
            pendingDelete
              ? `"${pendingDelete.name}" vai sair da lista. Essa ação não tem volta.`
              : undefined
          }
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          busy={deletingProject}
          onCancel={() => {
            if (!deletingProject) setPendingDelete(null);
          }}
          onConfirm={confirmDeleteProject}
        />
      </div>
    );
  }

  if (!store.project || !previewScene) return null;

  const openElementPanel = (panel: ElementSidePanel) => {
    if (panel === 'none') {
      closeSidePanel();
      return;
    }
    setTransitionSceneId(null);
    setSidePanel(panel);
    setSidebarExpanded(true);
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-3.5rem)] min-h-0 bg-[#1a1a1a] text-neutral-100">
      <header className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 bg-[#0d1117] border-b border-neutral-800">
        <button
          type="button"
          onClick={() => store.closeProject()}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
        >
          <ArrowLeft size={16} /> Projetos
        </button>
        <input
          className="flex-1 min-w-[140px] max-w-xs bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-semibold text-neutral-100 outline-none focus:border-violet-500"
          value={store.project.name}
          onChange={(e) => store.setProjectName(e.target.value)}
        />
        <span className="text-xs text-neutral-500 hidden sm:inline">
          {store.saving ? 'Salvando...' : store.isDirty ? 'Alterações pendentes' : 'Salvo na nuvem'}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Desfazer (Ctrl+Z)"
            disabled={!store.historyPast.length}
            onClick={() => store.undo()}
            className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            title="Refazer (Ctrl+Shift+Z)"
            disabled={!store.historyFuture.length}
            onClick={() => store.redo()}
            className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="flex rounded-lg border border-neutral-600 overflow-hidden">
          <button
            type="button"
            title="Editar o vídeo"
            onClick={() => store.setEditorSurface('video')}
            className={
              'flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer ' +
              (!isBanner ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700')
            }
          >
            <Clapperboard size={14} />
            Vídeo
          </button>
          <button
            type="button"
            title="Editar o banner (capa estática, sem timeline)"
            onClick={() => store.setEditorSurface('banner')}
            className={
              'flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer ' +
              (isBanner ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700')
            }
          >
            <ImageIcon size={14} />
            Banner
          </button>
        </div>
        <button
          type="button"
          onClick={handleSaveNow}
          disabled={store.saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-600 text-sm hover:bg-neutral-700 cursor-pointer disabled:opacity-50"
        >
          {store.saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Salvar
        </button>
        {isBanner ? (
        <button
          type="button"
          onClick={handleExportBanner}
          disabled={exportingBanner}
          title="Baixar PNG em 3840×2160"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exportingBanner ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Baixar PNG 4K
        </button>
        ) : (
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !apiOnline}
          title={!apiOnline ? 'Export requer api-video local' : 'Baixar MP4 em 3840×2160'}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? `MP4 4K ${exportProgress}%` : 'Baixar MP4 4K'}
        </button>
        )}
        <button
          type="button"
          onClick={refreshHealth}
          className="p-2 text-neutral-500 hover:text-neutral-200 rounded-lg hover:bg-neutral-800"
          title="Verificar API de vídeo"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      {actionError && (
        <div className="shrink-0 flex items-start gap-2 mx-3 mt-2 p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {actionError}
        </div>
      )}

      {removingBackground && (
        <div className="shrink-0 mx-3 mt-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
          {removingBgHint || 'Removendo fundo...'}
        </div>
      )}

      {exporting && (
        <div className="shrink-0 mx-3 mt-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2">
          <div className="flex justify-between text-xs mb-1 text-neutral-400">
            <span>Exportando vídeo...</span>
            <span>{exportProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${exportProgress}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className={
            'shrink-0 flex flex-col min-h-0 border-r border-neutral-800 transition-[width] duration-200 relative z-20 ' +
            (sidebarExpanded ? 'w-[320px]' : 'w-16')
          }
        >
          <AssetsPanel
            projectId={store.project.id}
            apiUrl={API_URL}
            apiOnline={apiOnline}
            expanded={sidebarExpanded}
            onToggleExpanded={() => setSidebarExpanded((v) => !v)}
            library={store.project.library ?? []}
            sidePanel={sidePanel}
            onCloseSidePanel={closeSidePanel}
            project={workingProject ?? store.project}
            layer={selectedLayer}
            scene={selectedScene}
            clip={selectedClipInfo}
            selectedClipId={store.selectedClipId}
            resolveAssetUrl={resolveImageUrl}
            onAddLibraryAsset={store.addLibraryAsset}
            onRemoveLibraryAsset={store.removeLibraryAsset}
            onUseLibraryImage={(src, dur) => addImageElement(src, undefined, dur)}
            onUseLibraryImageAsFundo={setFundoBackground}
            onUseLibraryAudio={(src, label, dur) => addAudioClipToFirstTrack(src, label, dur)}
            onUseShape={addShapeElement}
            onAddText={addTextLayer}
            onUpdateElement={store.updateElement}
            onUpdateClip={store.updateAudioClip}
            onBringForward={store.bringElementForward}
            onSendBackward={store.sendElementBackward}
            onBringToFront={store.bringElementToFront}
            onSendToBack={store.sendElementToBack}
            onReorderLayers={store.reorderElementsFrontToBack}
            onBringSceneForward={store.bringSceneForward}
            onSendSceneBackward={store.sendSceneBackward}
            onBringSceneToFront={store.bringSceneToFront}
            onSendSceneToBack={store.sendSceneToBack}
            onSelectLayer={(id) => {
              if (id && store.project && !isBanner) {
                const el = store.project.elements.find((e) => e.id === id);
                if (el) {
                  const t = store.playheadSec;
                  if (t < el.startSec || t >= el.startSec + el.durationSec) {
                    store.setPlayhead(el.startSec);
                  }
                }
              }
              store.selectLayer(id);
            }}
            onError={setActionError}
            transitionScene={transitionScene}
            transitionSceneIndex={transitionSceneIndex}
            onSetSceneTransition={(id, t, d) => store.setSceneTransition(id, t, d)}
            onApplyTransitionToAll={store.applyTransitionToAllScenes}
            surface={store.editorSurface}
          />
        </div>

        <button
          type="button"
          title={sidebarExpanded ? 'Recolher menu' : 'Expandir menu'}
          onClick={() => setSidebarExpanded((v) => !v)}
          className="shrink-0 self-center z-30 -ml-px w-5 h-12 rounded-r-md bg-neutral-800 border border-neutral-600 border-l-0 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-violet-600 hover:border-violet-500 cursor-pointer shadow-md"
        >
          {sidebarExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#1e1e1e]">
          <div className="shrink-0 px-3 pt-2">
            <EditorToolbar
              layer={selectedLayer}
              scene={selectedScene}
              clip={selectedClipInfo}
              selectedClipId={store.selectedClipId}
              selectionCount={
                store.selectedLayerIds.length + store.selectedClipIds.length + store.selectedSceneIds.length
              }
              playheadSec={store.playheadSec}
              onUpdateLayer={store.updateElement}
              onUpdateSceneDuration={store.setSceneDuration}
              onUpdateSceneColor={store.setSceneColor}
              onUpdateClip={store.updateAudioClip}
              onSplitAtPlayhead={(id) => store.splitElementAtPlayhead(id, store.playheadSec)}
              onOpenPanel={openElementPanel}
              onOpenTransition={openTransitionPanel}
              activePanel={
                sidePanel === 'effects' || sidePanel === 'animate' || sidePanel === 'position'
                  ? sidePanel
                  : 'none'
              }
              onRemoveBackground={handleRemoveBackground}
              removingBackground={removingBackground}
              onDelete={() => store.deleteSelection()}
              canDeleteScene={!isBanner && (store.project?.scenes.length ?? 0) > 1}
              hideTimelineTools={isBanner}
              stylePaintArmed={store.stylePaintArmed}
              onToggleStylePaint={() => store.armStylePaint()}
            />
            {store.stylePaintArmed && (
              <p className="text-center text-xs text-violet-300 pb-1">
                Copiar estilo ligado: clique em outro elemento para aplicar. Esc cancela.
              </p>
            )}
          </div>

          <EditorCanvas
            layers={previewElements}
            sceneId={previewScene?.id ?? null}
            backgroundSrc={previewScene?.backgroundSrc}
            backgroundColor={previewScene?.backgroundColor ?? '#ffffff'}
            transitionBackground={transitionBackground}
            selectedLayerId={store.selectedLayerId}
            selectedLayerIds={store.selectedLayerIds}
            selectedSceneId={store.activeSceneId}
            playheadSec={isBanner ? 0 : store.playheadSec}
            onSelectLayer={(id) => {
              store.selectLayer(id);
              if (
                id &&
                sidePanel !== 'effects' &&
                sidePanel !== 'animate' &&
                sidePanel !== 'position'
              ) {
                closeSidePanel();
              }
            }}
            onSelectScene={(id) => store.setActiveScene(id, { seekToStart: false })}
            onUpdateLayer={store.updateElement}
            onReplaceImageSrc={(id, src) => store.updateElement(id, { src })}
            onDropAddImage={(src, dur) => addImageElement(src, undefined, dur)}
            resolveImageUrl={resolveImageUrl}
            stylePaintArmed={store.stylePaintArmed}
          />

          {!isBanner && (
          <>
          <div className="shrink-0 flex items-center justify-center gap-3 py-2 border-t border-neutral-800 bg-[#171717]">
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 cursor-pointer"
              onClick={() => {
                if (store.isPlaying) {
                  store.setPlaying(false);
                  previewAudio.onUserPause();
                } else {
                  previewAudio.onUserPlay();
                  store.setPlaying(true);
                }
              }}
              title={store.isPlaying ? 'Pausar' : 'Reproduzir preview'}
            >
              {store.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <span className="text-sm text-neutral-300 tabular-nums">
              {fmtTime(store.playheadSec)} / {fmtTime(totalDuration)}
            </span>
            <span className="text-xs text-neutral-600 hidden sm:inline">1920 × 1080</span>
          </div>

          <div
            role="separator"
            aria-orientation="horizontal"
            title="Arrastar para mudar a altura da timeline"
            className="shrink-0 h-2 cursor-ns-resize bg-neutral-800 hover:bg-violet-600 border-y border-neutral-700"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              const startY = e.clientY;
              const startH = timelineH;
              const onMove = (ev: PointerEvent) => {
                const next = Math.min(
                  Math.max(startH - (ev.clientY - startY), 140),
                  Math.round(window.innerHeight * 0.72),
                );
                setTimelineH(next);
              };
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
          />

          <Timeline
            heightPx={timelineH}
            project={store.project}
            activeSceneId={store.activeSceneId}
            playheadSec={store.playheadSec}
            selectedLayerId={store.selectedLayerId}
            selectedClipId={store.selectedClipId}
            selectedLayerIds={store.selectedLayerIds}
            selectedClipIds={store.selectedClipIds}
            selectedSceneIds={store.selectedSceneIds}
            editingTransitionSceneId={sidePanel === 'transitions' ? transitionSceneId : null}
            onSelectScene={(id) => store.setActiveScene(id, { seekToStart: true })}
            onAddScene={() => store.addScene()}
            onInsertSceneAfter={(id) => store.insertSceneAfter(id)}
            onEditTransition={openTransitionPanel}
            onRemoveScene={store.removeScene}
            onRemoveElement={store.removeElement}
            onSetPlayhead={store.setPlayhead}
            onSelectLayer={(id) => {
              if (id && store.project) {
                const el = store.project.elements.find((e) => e.id === id);
                if (el) {
                  const t = store.playheadSec;
                  if (t < el.startSec || t >= el.startSec + el.durationSec) {
                    store.setPlayhead(el.startSec);
                  }
                }
              }
              store.selectLayer(id);
            }}
            onSelectClip={(id) => {
              if (id && store.project) {
                for (const track of store.project.audioTracks) {
                  const clip = track.clips.find((c) => c.id === id);
                  if (clip) {
                    const t = store.playheadSec;
                    if (t < clip.startSec || t >= clip.startSec + clip.durationSec) {
                      store.setPlayhead(clip.startSec);
                    }
                    break;
                  }
                }
              }
              store.selectClip(id);
            }}
            onToggleLayer={store.toggleLayerInSelection}
            onToggleClip={store.toggleClipInSelection}
            onToggleScene={store.toggleSceneInSelection}
            onSetTimelineSelection={store.setTimelineSelection}
            onMoveSelectionStarts={store.moveSelectionStarts}
            onUpdateElement={store.updateElement}
            onUpdateSceneDuration={store.setSceneDuration}
            onMoveScene={store.setSceneStart}
            onTrimSceneLeft={store.trimSceneLeft}
            onUpdateClip={(clipId, patch) => {
              const track = store.project?.audioTracks.find((t) => t.clips.some((c) => c.id === clipId));
              if (track) store.updateAudioClip(track.id, clipId, patch);
            }}
            onRemoveAudioClip={(clipId) => {
              const track = store.project!.audioTracks[0];
              if (track) store.removeAudioClip(track.id, clipId);
            }}
            onReorderLayers={store.reorderElementsFrontToBack}
          />
        </>
          )}
          {isBanner && (
            <div className="shrink-0 flex items-center justify-center py-2 border-t border-neutral-800 bg-[#171717] text-xs text-neutral-500">
              Banner 1920 × 1080
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
