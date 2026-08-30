import { create } from 'zustand';
import type {
  AudioClip,
  AudioTrack,
  ProjectElement,
  VideoProject,
  VideoScene,
  ProjectLibraryAsset,
  ProjectLibraryKind,
  SceneTransition,
} from '../types/video-project';
import {
  createEmptyBanner,
  createEmptyProject,
  itemBelongsToSceneWindow,
  normalizeProject,
  projectTotalDurationSec,
  sceneStartSec,
  BANNER_DURATION_SEC,
} from '../types/video-project';
import {
  snapshotElementStyle,
  stylePatchFromClipboard,
  type CopiedElementStyle,
} from '../types/element-style';

export type EditorClipboard =
  | { kind: 'element'; payload: ProjectElement; pasteCount: number }
  | { kind: 'scene'; payload: VideoScene; pasteCount: number }
  | { kind: 'audio'; payload: AudioClip; pasteCount: number };

type EditorView = 'list' | 'editor';
export type EditorSurface = 'video' | 'banner';

type VideoEditorState = {
  view: EditorView;
  editorSurface: EditorSurface;
  project: VideoProject | null;
  activeSceneId: string | null;
  selectedLayerId: string | null;
  selectedClipId: string | null;
  selectedLayerIds: string[];
  selectedClipIds: string[];
  selectedSceneIds: string[];
  clipboard: EditorClipboard | null;
  historyPast: VideoProject[];
  historyFuture: VideoProject[];
  stylePaintArmed: boolean;
  styleClipboard: CopiedElementStyle | null;
  isDirty: boolean;
  playheadSec: number;
  isPlaying: boolean;
  saving: boolean;
  lastSavedAt: string | null;

  setView: (view: EditorView) => void;
  setEditorSurface: (surface: EditorSurface) => void;
  newProject: (name?: string) => void;
  loadProject: (project: VideoProject) => void;
  closeProject: () => void;
  setProjectName: (name: string) => void;
  markDirty: () => void;
  markSaved: () => void;
  setSaving: (saving: boolean) => void;

  setActiveScene: (sceneId: string | null, options?: { seekToStart?: boolean }) => void;
  addScene: (name?: string) => void;
  insertSceneAfter: (afterSceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  removeScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  reorderScene: (fromIndex: number, toIndex: number) => void;
  setSceneStart: (sceneId: string, startSec: number) => void;
  setSceneDuration: (sceneId: string, durationSec: number) => void;
  /** Trim pela esquerda: muda start + duração, sem arrastar elementos/áudio da janela. */
  trimSceneLeft: (sceneId: string, startSec: number) => void;
  bringSceneForward: (sceneId: string) => void;
  sendSceneBackward: (sceneId: string) => void;
  bringSceneToFront: (sceneId: string) => void;
  sendSceneToBack: (sceneId: string) => void;
  setSceneBackground: (sceneId: string, src: string) => void;
  setSceneColor: (sceneId: string, color: string) => void;
  setSceneTransition: (sceneId: string, transition: SceneTransition, durationSec?: number) => void;
  applyTransitionToAllScenes: (transition: SceneTransition, durationSec: number) => void;

  addElement: (element: ProjectElement) => void;
  updateElement: (elementId: string, patch: Partial<ProjectElement>) => void;
  removeElement: (elementId: string) => void;
  bringElementForward: (elementId: string) => void;
  sendElementBackward: (elementId: string) => void;
  bringElementToFront: (elementId: string) => void;
  sendElementToBack: (elementId: string) => void;
  reorderElementsFrontToBack: (frontToBackIds: string[]) => void;
  splitElementAtPlayhead: (elementId: string, playheadSec: number) => void;
  selectLayer: (layerId: string | null) => void;
  armStylePaint: () => void;
  cancelStylePaint: () => void;
  setTimelineSelection: (sel: {
    layerIds?: string[];
    clipIds?: string[];
    sceneIds?: string[];
  }) => void;
  toggleLayerInSelection: (layerId: string) => void;
  toggleClipInSelection: (clipId: string) => void;
  toggleSceneInSelection: (sceneId: string) => void;
  moveSelectionStarts: (items: {
    elements: { id: string; startSec: number }[];
    clips: { id: string; startSec: number }[];
    scenes: { id: string; startSec: number }[];
  }) => void;

  updateLayer: (layerId: string, patch: Partial<ProjectElement>) => void;
  removeLayer: (layerId: string) => void;
  bringLayerForward: (layerId: string) => void;
  sendLayerBackward: (layerId: string) => void;

  addAudioTrack: (name: string) => void;
  removeAudioTrack: (trackId: string) => void;
  addAudioClip: (trackId: string, clip: AudioClip) => void;
  updateAudioClip: (trackId: string, clipId: string, patch: Partial<AudioClip>) => void;
  removeAudioClip: (trackId: string, clipId: string) => void;
  selectClip: (clipId: string | null) => void;

  addLibraryAsset: (asset: {
    kind: ProjectLibraryKind;
    src: string;
    name: string;
    durationSec?: number;
  }) => void;
  removeLibraryAsset: (assetId: string) => void;

  setPlayhead: (sec: number) => void;
  setPlaying: (playing: boolean) => void;
  tickPlayhead: (dtSec: number) => void;

  copySelection: () => void;
  pasteSelection: () => void;
  cutSelection: () => void;
  deleteSelection: () => void;
  /** Agrupa varias mudancas (arrastar, slider) em um unico passo de desfazer. */
  beginHistoryGesture: () => void;
  endHistoryGesture: () => void;
  undo: () => void;
  redo: () => void;
};

const ensureBanner = (project: VideoProject) => project.banner ?? createEmptyBanner();

const workingElements = (project: VideoProject, surface: EditorSurface): ProjectElement[] =>
  surface === 'banner' ? ensureBanner(project).elements : project.elements;

const putElements = (
  project: VideoProject,
  surface: EditorSurface,
  elements: ProjectElement[],
): VideoProject => {
  if (surface === 'banner') {
    const banner = ensureBanner(project);
    return { ...project, banner: { ...banner, elements } };
  }
  return { ...project, elements };
};

const patchWorkingScene = (
  project: VideoProject,
  surface: EditorSurface,
  sceneId: string,
  patch: Partial<VideoScene>,
): VideoProject => {
  if (surface === 'banner') {
    const banner = ensureBanner(project);
    if (banner.scene.id !== sceneId) return project;
    return { ...project, banner: { ...banner, scene: { ...banner.scene, ...patch } } };
  }
  return {
    ...project,
    scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
  };
};

const cloneProject = (project: VideoProject): VideoProject =>
  JSON.parse(JSON.stringify(project)) as VideoProject;

/** Campos que mudam em fluxo (arrasto/slider/cor) e devem virar 1 undo, nao N. */
const CONTINUOUS_PATCH_KEYS = new Set([
  'x',
  'y',
  'w',
  'h',
  'rotation',
  'startSec',
  'durationSec',
  'opacity',
  'fontSize',
  'borderWidth',
  'cornerRadius',
  'color',
  'fillColor',
  'borderColor',
  'volume',
  'trimStartSec',
  'text',
]);

const historyKeyForElementPatch = (elementId: string, patch: Partial<ProjectElement>) => {
  const keys = Object.keys(patch);
  if (!keys.length) return null;
  if (!keys.every((k) => CONTINUOUS_PATCH_KEYS.has(k))) return null;
  return `el:${elementId}:${keys.sort().join(',')}`;
};

const HISTORY_COALESCE_MS = 500;
let historyGestureDepth = 0;
let historyGestureCaptured = false;
let lastHistoryKey: string | null = null;
let lastHistoryAt = 0;

const resetHistoryMerge = () => {
  lastHistoryKey = null;
  lastHistoryAt = 0;
};

const touchProject = (project: VideoProject): VideoProject => ({
  ...project,
  updatedAt: new Date().toISOString(),
});

const shiftScene = (project: VideoProject, sceneId: string, startSec: number): VideoProject => {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) return project;
  const from = sceneStartSec(scene, project);
  const next = Math.max(0, startSec);
  const delta = next - from;
  if (Math.abs(delta) < 0.0001) return project;
  return {
    ...project,
    scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, startSec: next } : s)),
    elements: project.elements.map((el) =>
      itemBelongsToSceneWindow(el.startSec, from, scene.durationSec)
        ? { ...el, startSec: Math.max(0, el.startSec + delta) }
        : el,
    ),
    audioTracks: project.audioTracks.map((track) => ({
      ...track,
      clips: track.clips.map((c) =>
        itemBelongsToSceneWindow(c.startSec, from, scene.durationSec)
          ? { ...c, startSec: Math.max(0, c.startSec + delta) }
          : c,
      ),
    })),
  };
};

const restackByBackToFront = (elements: ProjectElement[], backToFrontIds: string[]): ProjectElement[] => {
  const zById = new Map(backToFrontIds.map((id, i) => [id, i + 1]));
  return elements.map((e) => (zById.has(e.id) ? { ...e, zIndex: zById.get(e.id)! } : e));
};

const sortedBackToFront = (elements: ProjectElement[]) =>
  [...elements].sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));

const selState = (layerIds: string[], clipIds: string[], sceneIds: string[], activeSceneId: string | null) => ({
  selectedLayerIds: layerIds,
  selectedClipIds: clipIds,
  selectedSceneIds: sceneIds,
  selectedLayerId: layerIds[0] ?? null,
  selectedClipId: layerIds.length ? null : (clipIds[0] ?? null),
  activeSceneId,
});

/** Tira foco de input para Ctrl+C/V do editor funcionar depois de clicar na timeline. */
const blurIfTyping = () => {
  const el = document.activeElement;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  ) {
    el.blur();
  }
};

export const useVideoEditorStore = create<VideoEditorState>((rawSet, get) => {
  const set: typeof rawSet = (partial, replace) => {
    if (replace) {
      rawSet(partial as VideoEditorState, replace);
      return;
    }
    const prev = get();
    const patch = typeof partial === 'function' ? partial(prev) : partial;
    if (!patch || typeof patch !== 'object') {
      rawSet(partial, replace);
      return;
    }
    const p = patch as Partial<VideoEditorState> & {
      _skipHistory?: boolean;
      _historyKey?: string | null;
    };
    const historyKey = p._historyKey;
    const skipHistory = Boolean(p._skipHistory);
    const rest = { ...p };
    delete rest._skipHistory;
    delete rest._historyKey;

    if (skipHistory) {
      rawSet(rest);
      return;
    }
    if (rest.project && prev.project && rest.project !== prev.project) {
      const pushSnapshot = () => {
        rawSet({
          ...rest,
          historyPast: [...prev.historyPast.slice(-49), cloneProject(prev.project)],
          historyFuture: [],
        });
      };

      if (historyGestureDepth > 0) {
        if (!historyGestureCaptured) {
          historyGestureCaptured = true;
          pushSnapshot();
        } else {
          rawSet({ ...rest, historyFuture: [] });
        }
        return;
      }

      const now = Date.now();
      const canMerge =
        historyKey != null &&
        historyKey === lastHistoryKey &&
        now - lastHistoryAt < HISTORY_COALESCE_MS &&
        prev.historyPast.length > 0;

      if (canMerge) {
        lastHistoryAt = now;
        rawSet({ ...rest, historyFuture: [] });
        return;
      }

      lastHistoryKey = historyKey ?? null;
      lastHistoryAt = now;
      pushSnapshot();
      return;
    }
    rawSet(rest);
  };

  return {
  view: 'list',
  editorSurface: 'video',
  project: null,
  activeSceneId: null,
  selectedLayerId: null,
  selectedClipId: null,
  selectedLayerIds: [],
  selectedClipIds: [],
  selectedSceneIds: [],
  clipboard: null,
  historyPast: [],
  historyFuture: [],
  stylePaintArmed: false,
  styleClipboard: null,
  isDirty: false,
  playheadSec: 0,
  isPlaying: false,
  saving: false,
  lastSavedAt: null,

  setView: (view) => set({ view }),

  setEditorSurface: (surface) => {
    const { project } = get();
    if (!project) return set({ editorSurface: surface });
    let next = project;
    if (surface === 'banner' && !project.banner) {
      next = touchProject({ ...project, banner: createEmptyBanner() });
    }
    const banner = next.banner ?? createEmptyBanner();
    set({
      editorSurface: surface,
      project: next,
      isDirty: surface === 'banner' && !project.banner ? true : get().isDirty,
      isPlaying: false,
      playheadSec: surface === 'banner' ? 0 : get().playheadSec,
      selectedLayerId: null,
      selectedLayerIds: [],
      selectedClipId: null,
      selectedClipIds: [],
      selectedSceneIds: surface === 'banner' ? [banner.scene.id] : [],
      activeSceneId: surface === 'banner' ? banner.scene.id : get().activeSceneId,
      stylePaintArmed: false,
      styleClipboard: null,
    });
  },

  newProject: (name) => {
    const project = createEmptyProject(name);
    set({
      view: 'editor',
      project,
      activeSceneId: null,
      selectedLayerId: null,
      selectedClipId: null,
      selectedLayerIds: [],
      selectedClipIds: [],
      selectedSceneIds: [],
      clipboard: null,
      editorSurface: 'video',
      stylePaintArmed: false,
      styleClipboard: null,
      isDirty: true,
      playheadSec: 0,
      isPlaying: false,
      historyPast: [],
      historyFuture: [],
      _skipHistory: true,
    } as Partial<VideoEditorState> & { _skipHistory: boolean });
  },

  loadProject: (raw) => {
    const project = normalizeProject(raw);
    const migrated =
      (raw.audioTracks?.length ?? 0) > 1 ||
      (raw.scenes || []).some((s) => (s.layers?.length ?? 0) > 0 || /^Cena\s*/i.test(s.name));
    set({
      view: 'editor',
      project,
      activeSceneId: null,
      selectedLayerId: null,
      selectedClipId: null,
      selectedLayerIds: [],
      selectedClipIds: [],
      selectedSceneIds: [],
      clipboard: null,
      editorSurface: 'video',
      stylePaintArmed: false,
      styleClipboard: null,
      isDirty: migrated,
      playheadSec: 0,
      isPlaying: false,
      lastSavedAt: migrated ? null : project.updatedAt,
      historyPast: [],
      historyFuture: [],
      _skipHistory: true,
    } as Partial<VideoEditorState> & { _skipHistory: boolean });
  },

  closeProject: () =>
    set({
      view: 'list',
      project: null,
      activeSceneId: null,
      selectedLayerId: null,
      selectedClipId: null,
      selectedLayerIds: [],
      selectedClipIds: [],
      selectedSceneIds: [],
      clipboard: null,
      editorSurface: 'video',
      stylePaintArmed: false,
      styleClipboard: null,
      isDirty: false,
      playheadSec: 0,
      isPlaying: false,
      historyPast: [],
      historyFuture: [],
      _skipHistory: true,
    } as Partial<VideoEditorState> & { _skipHistory: boolean }),

  setProjectName: (name) => {
    const { project } = get();
    if (!project) return;
    set({ project: touchProject({ ...project, name }), isDirty: true });
  },

  markDirty: () => set({ isDirty: true }),
  markSaved: () => {
    const { project } = get();
    set({ isDirty: false, lastSavedAt: project?.updatedAt ?? null });
  },
  setSaving: (saving) => set({ saving }),

  setActiveScene: (sceneId, options) => {
    blurIfTyping();
    const seekToStart = options?.seekToStart !== false;
    const { project, editorSurface } = get();
    if (!sceneId) return set({ activeSceneId: null, selectedSceneIds: [] });
    if (editorSurface === 'banner' && project) {
      const banner = ensureBanner(project);
      if (sceneId === banner.scene.id) {
        return set({
          activeSceneId: sceneId,
          selectedLayerId: null,
          selectedClipId: null,
          selectedLayerIds: [],
          selectedClipIds: [],
          selectedSceneIds: [sceneId],
        });
      }
    }
    if (!project) return set({ activeSceneId: sceneId, selectedLayerId: null, selectedClipId: null });
    const scene = project.scenes.find((s) => s.id === sceneId);
    const start = scene ? sceneStartSec(scene, project) : 0;
    set({
      activeSceneId: sceneId,
      selectedLayerId: null,
      selectedClipId: null,
      selectedLayerIds: [],
      selectedClipIds: [],
      selectedSceneIds: [sceneId],
      ...(seekToStart ? { playheadSec: start } : {}),
    });
  },

  addScene: (name) => {
    const { project } = get();
    if (!project) return;
    const end = projectTotalDurationSec(project);
    const maxZ = project.scenes.reduce((m, s) => Math.max(m, s.zIndex ?? 0), 0);
    const scene: VideoScene = {
      id: crypto.randomUUID(),
      name: name || 'Fundo',
      durationSec: 5,
      startSec: end,
      zIndex: maxZ + 1,
      backgroundColor: '#ffffff',
    };
    set({
      project: touchProject({ ...project, scenes: [...project.scenes, scene] }),
      activeSceneId: scene.id,
      isDirty: true,
    });
  },

  insertSceneAfter: (afterSceneId) => {
    const { project } = get();
    if (!project) return;
    const after = project.scenes.find((s) => s.id === afterSceneId);
    if (!after) return;
    const afterStart = sceneStartSec(after, project);
    const maxZ = project.scenes.reduce((m, s) => Math.max(m, s.zIndex ?? 0), 0);
    const scene: VideoScene = {
      id: crypto.randomUUID(),
      name: 'Fundo',
      durationSec: 5,
      startSec: afterStart + after.durationSec,
      zIndex: maxZ + 1,
      backgroundColor: '#ffffff',
    };
    set({
      project: touchProject({ ...project, scenes: [...project.scenes, scene] }),
      activeSceneId: scene.id,
      selectedLayerId: null,
      selectedClipId: null,
      selectedLayerIds: [],
      selectedClipIds: [],
      selectedSceneIds: [],
      playheadSec: scene.startSec,
      isDirty: true,
    });
  },

  duplicateScene: (sceneId) => {
    const { project } = get();
    if (!project) return;
    const source = project.scenes.find((s) => s.id === sceneId);
    if (!source) return;
    const srcStart = sceneStartSec(source, project);
    const maxZ = project.scenes.reduce((m, s) => Math.max(m, s.zIndex ?? 0), 0);
    const copy: VideoScene = {
      ...source,
      id: crypto.randomUUID(),
      name: 'Fundo',
      startSec: srcStart + source.durationSec,
      zIndex: maxZ + 1,
    };
    set({
      project: touchProject({ ...project, scenes: [...project.scenes, copy] }),
      activeSceneId: copy.id,
      isDirty: true,
    });
  },

  removeScene: (sceneId) => {
    const { project, activeSceneId } = get();
    if (!project || project.scenes.length <= 1) return;
    const scenes = project.scenes.filter((s) => s.id !== sceneId);
    set({
      project: touchProject({ ...project, scenes }),
      activeSceneId: activeSceneId === sceneId ? scenes[0]?.id ?? null : activeSceneId,
      selectedLayerId: null,
      isDirty: true,
    });
  },

  renameScene: (sceneId, name) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, name } : s)),
      }),
      isDirty: true,
    });
  },

  reorderScene: (fromIndex, toIndex) => {
    const { project } = get();
    if (!project) return;
    const scenes = [...project.scenes];
    const [moved] = scenes.splice(fromIndex, 1);
    scenes.splice(toIndex, 0, moved);
    set({ project: touchProject({ ...project, scenes }), isDirty: true });
  },

  setSceneDuration: (sceneId, durationSec) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId ? { ...s, durationSec: Math.max(0.5, durationSec) } : s,
        ),
      }),
      isDirty: true,
      _historyKey: `scene:${sceneId}:duration`,
    } as any);
  },

  trimSceneLeft: (sceneId, startSec) => {
    const { project } = get();
    if (!project) return;
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const from = sceneStartSec(scene, project);
    const end = from + scene.durationSec;
    let nextStart = Math.max(0, startSec);
    let nextDur = end - nextStart;
    if (nextDur < 0.5) {
      nextDur = 0.5;
      nextStart = Math.max(0, end - 0.5);
    }
    if (Math.abs(nextStart - from) < 0.0001 && Math.abs(nextDur - scene.durationSec) < 0.0001) return;
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId ? { ...s, startSec: nextStart, durationSec: nextDur } : s,
        ),
      }),
      isDirty: true,
      _historyKey: `scene:${sceneId}:trimLeft`,
    } as any);
  },

  setSceneStart: (sceneId, startSec) => {
    const { project } = get();
    if (!project) return;
    const next = shiftScene(project, sceneId, startSec);
    if (next === project) return;
    set({
      project: touchProject(next),
      isDirty: true,
      _historyKey: `scene:${sceneId}:start`,
    } as any);
  },

  bringSceneForward: (sceneId) => {
    const { project } = get();
    if (!project) return;
    const sorted = [...project.scenes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = sorted.findIndex((s) => s.id === sceneId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const next = sorted[idx + 1];
    const curZ = sorted[idx].zIndex ?? 0;
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) => {
          if (s.id === sceneId) return { ...s, zIndex: next.zIndex ?? 0 };
          if (s.id === next.id) return { ...s, zIndex: curZ };
          return s;
        }),
      }),
      isDirty: true,
    });
  },

  sendSceneBackward: (sceneId) => {
    const { project } = get();
    if (!project) return;
    const sorted = [...project.scenes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = sorted.findIndex((s) => s.id === sceneId);
    if (idx <= 0) return;
    const prev = sorted[idx - 1];
    const curZ = sorted[idx].zIndex ?? 0;
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) => {
          if (s.id === sceneId) return { ...s, zIndex: prev.zIndex ?? 0 };
          if (s.id === prev.id) return { ...s, zIndex: curZ };
          return s;
        }),
      }),
      isDirty: true,
    });
  },

  bringSceneToFront: (sceneId) => {
    const { project } = get();
    if (!project) return;
    const maxZ = project.scenes.reduce((m, s) => Math.max(m, s.zIndex ?? 0), 0);
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, zIndex: maxZ + 1 } : s)),
      }),
      isDirty: true,
    });
  },

  sendSceneToBack: (sceneId) => {
    const { project } = get();
    if (!project) return;
    const minZ = project.scenes.reduce((m, s) => Math.min(m, s.zIndex ?? 0), 0);
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, zIndex: minZ - 1 } : s)),
      }),
      isDirty: true,
    });
  },

  setSceneBackground: (sceneId, src) => {
    const { project, editorSurface } = get();
    if (!project) return;
    set({
      project: touchProject(patchWorkingScene(project, editorSurface, sceneId, { backgroundSrc: src })),
      isDirty: true,
    });
  },

  setSceneColor: (sceneId, color) => {
    const { project, editorSurface } = get();
    if (!project) return;
    set({
      project: touchProject(patchWorkingScene(project, editorSurface, sceneId, { backgroundColor: color })),
      isDirty: true,
      _historyKey: `scene:${sceneId}:color`,
    } as any);
  },

  setSceneTransition: (sceneId, transition, durationSec) => {
    const { project } = get();
    if (!project) return;
    const dur = durationSec ?? 0.75;
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                transitionOut: transition,
                transitionDurationSec: transition === 'cut' ? undefined : dur,
              }
            : s,
        ),
      }),
      isDirty: true,
    });
  },

  applyTransitionToAllScenes: (transition, durationSec) => {
    const { project } = get();
    if (!project) return;
    const ordered = [...project.scenes].sort(
      (a, b) => (a.startSec ?? 0) - (b.startSec ?? 0),
    );
    const lastId = ordered[ordered.length - 1]?.id;
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === lastId
            ? s
            : {
                ...s,
                transitionOut: transition,
                transitionDurationSec: transition === 'cut' ? undefined : durationSec,
              },
        ),
      }),
      isDirty: true,
    });
  },

  addElement: (partial) => {
    const { project, playheadSec, editorSurface } = get();
    if (!project) return;
    const list = workingElements(project, editorSurface);
    const maxZ = list.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const el: ProjectElement = {
      ...partial,
      id: partial.id ?? crypto.randomUUID(),
      startSec:
        editorSurface === 'banner' ? 0 : (partial.startSec ?? playheadSec),
      durationSec:
        editorSurface === 'banner'
          ? BANNER_DURATION_SEC
          : (partial.durationSec ?? 5),
      zIndex: partial.zIndex ?? maxZ + 1,
    } as ProjectElement;
    set({
      project: touchProject(putElements(project, editorSurface, [...list, el])),
      ...selState([el.id], [], [], editorSurface === 'banner' ? ensureBanner(project).scene.id : null),
      isDirty: true,
    });
  },

  updateElement: (elementId, patch) => {
    const { project, editorSurface } = get();
    if (!project) return;
    const list = workingElements(project, editorSurface);
    set({
      project: touchProject(
        putElements(
          project,
          editorSurface,
          list.map((e) => (e.id === elementId ? ({ ...e, ...patch } as ProjectElement) : e)),
        ),
      ),
      isDirty: true,
      _historyKey: historyKeyForElementPatch(elementId, patch),
    } as any);
  },

  removeElement: (elementId) => {
    const { project, selectedLayerId, selectedLayerIds, editorSurface } = get();
    if (!project) return;
    const layerIds = selectedLayerIds.filter((id) => id !== elementId);
    const list = workingElements(project, editorSurface);
    set({
      project: touchProject(
        putElements(
          project,
          editorSurface,
          list.filter((e) => e.id !== elementId),
        ),
      ),
      selectedLayerId: selectedLayerId === elementId ? (layerIds[0] ?? null) : selectedLayerId,
      selectedLayerIds: layerIds,
      isDirty: true,
    });
  },

  bringElementForward: (elementId) => {
    const { project, editorSurface } = get();
    if (!project) return;
    const list = workingElements(project, editorSurface);
    const sorted = sortedBackToFront(list);
    const idx = sorted.findIndex((e) => e.id === elementId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const next = [...sorted];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    set({
      project: touchProject(
        putElements(
          project,
          editorSurface,
          restackByBackToFront(
            list,
            next.map((e) => e.id),
          ),
        ),
      ),
      isDirty: true,
    });
  },

  sendElementBackward: (elementId) => {
    const { project, editorSurface } = get();
    if (!project) return;
    const list = workingElements(project, editorSurface);
    const sorted = sortedBackToFront(list);
    const idx = sorted.findIndex((e) => e.id === elementId);
    if (idx <= 0) return;
    const next = [...sorted];
    [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
    set({
      project: touchProject(
        putElements(
          project,
          editorSurface,
          restackByBackToFront(
            list,
            next.map((e) => e.id),
          ),
        ),
      ),
      isDirty: true,
    });
  },

  bringElementToFront: (elementId) => {
    const { project, editorSurface } = get();
    if (!project) return;
    const list = workingElements(project, editorSurface);
    const sorted = sortedBackToFront(list).filter((e) => e.id !== elementId);
    const el = list.find((e) => e.id === elementId);
    if (!el) return;
    set({
      project: touchProject(
        putElements(
          project,
          editorSurface,
          restackByBackToFront(
            list,
            [...sorted, el].map((e) => e.id),
          ),
        ),
      ),
      isDirty: true,
    });
  },

  sendElementToBack: (elementId) => {
    const { project, editorSurface } = get();
    if (!project) return;
    const list = workingElements(project, editorSurface);
    const sorted = sortedBackToFront(list).filter((e) => e.id !== elementId);
    const el = list.find((e) => e.id === elementId);
    if (!el) return;
    set({
      project: touchProject(
        putElements(
          project,
          editorSurface,
          restackByBackToFront(
            list,
            [el, ...sorted].map((e) => e.id),
          ),
        ),
      ),
      isDirty: true,
    });
  },

  reorderElementsFrontToBack: (frontToBackIds) => {
    const { project, editorSurface } = get();
    if (!project) return;
    const list = workingElements(project, editorSurface);
    const backToFront = [...frontToBackIds].reverse();
    set({
      project: touchProject(putElements(project, editorSurface, restackByBackToFront(list, backToFront))),
      isDirty: true,
    });
  },

  splitElementAtPlayhead: (elementId, playheadSec) => {
    const { project } = get();
    if (!project) return;
    const el = project.elements.find((e) => e.id === elementId);
    if (!el) return;
    const end = el.startSec + el.durationSec;
    if (playheadSec <= el.startSec + 0.05 || playheadSec >= end - 0.05) return;
    const firstDur = playheadSec - el.startSec;
    const secondDur = end - playheadSec;
    const copy: ProjectElement = {
      ...el,
      id: crypto.randomUUID(),
      startSec: playheadSec,
      durationSec: secondDur,
    };
    set({
      project: touchProject({
        ...project,
        elements: [
          ...project.elements.map((e) =>
            e.id === elementId ? ({ ...e, durationSec: firstDur } as ProjectElement) : e,
          ),
          copy,
        ],
      }),
      selectedLayerId: copy.id,
      selectedLayerIds: [copy.id],
      selectedClipIds: [],
      selectedSceneIds: [],
      selectedClipId: null,
      isDirty: true,
    });
  },

  selectLayer: (layerId) => {
    blurIfTyping();
    if (!layerId) {
      return set({
        selectedLayerId: null,
        selectedLayerIds: [],
        selectedClipId: null,
        selectedClipIds: [],
        selectedSceneIds: [],
      });
    }
    const { project, stylePaintArmed, styleClipboard, editorSurface } = get();
    let dirty = false;
    let nextProject = project;
    if (stylePaintArmed && styleClipboard && project) {
      const list = workingElements(project, editorSurface);
      nextProject = putElements(
        project,
        editorSurface,
        list.map((e) =>
          e.id === layerId
            ? ({ ...e, ...stylePatchFromClipboard(e.type, styleClipboard) } as ProjectElement)
            : e,
        ),
      );
      dirty = true;
    }
    set({
      ...(dirty && nextProject ? { project: touchProject(nextProject), isDirty: true } : {}),
      ...selState([layerId], [], [], null),
    });
  },

  armStylePaint: () => {
    const { project, selectedLayerId, stylePaintArmed, editorSurface } = get();
    if (stylePaintArmed) {
      set({ stylePaintArmed: false, styleClipboard: null });
      return;
    }
    const el = project
      ? workingElements(project, editorSurface).find((e) => e.id === selectedLayerId)
      : undefined;
    if (!el) return;
    set({ stylePaintArmed: true, styleClipboard: snapshotElementStyle(el) });
  },

  cancelStylePaint: () => set({ stylePaintArmed: false, styleClipboard: null }),

  setTimelineSelection: (sel) => {
    blurIfTyping();
    const layerIds = [...new Set(sel.layerIds ?? [])];
    const clipIds = [...new Set(sel.clipIds ?? [])];
    const sceneIds = [...new Set(sel.sceneIds ?? [])];
    const active =
      layerIds.length || clipIds.length ? null : (sceneIds[0] ?? null);
    const { project, stylePaintArmed, styleClipboard, editorSurface } = get();
    if (stylePaintArmed && styleClipboard && project && layerIds.length) {
      const list = workingElements(project, editorSurface);
      const next = putElements(
        project,
        editorSurface,
        list.map((e) =>
          layerIds.includes(e.id)
            ? ({ ...e, ...stylePatchFromClipboard(e.type, styleClipboard) } as ProjectElement)
            : e,
        ),
      );
      set({
        project: touchProject(next),
        isDirty: true,
        ...selState(layerIds, clipIds, sceneIds, active),
      });
      return;
    }
    set(selState(layerIds, clipIds, sceneIds, active));
  },

  toggleLayerInSelection: (layerId) => {
    const { selectedLayerIds, selectedClipIds, selectedSceneIds } = get();
    const layerIds = selectedLayerIds.includes(layerId)
      ? selectedLayerIds.filter((id) => id !== layerId)
      : [...selectedLayerIds, layerId];
    const active = layerIds.length || selectedClipIds.length ? null : (selectedSceneIds[0] ?? null);
    set(selState(layerIds, selectedClipIds, selectedSceneIds, active));
  },

  toggleClipInSelection: (clipId) => {
    const { selectedLayerIds, selectedClipIds, selectedSceneIds } = get();
    const clipIds = selectedClipIds.includes(clipId)
      ? selectedClipIds.filter((id) => id !== clipId)
      : [...selectedClipIds, clipId];
    const active = selectedLayerIds.length || clipIds.length ? null : (selectedSceneIds[0] ?? null);
    set(selState(selectedLayerIds, clipIds, selectedSceneIds, active));
  },

  toggleSceneInSelection: (sceneId) => {
    const { selectedLayerIds, selectedClipIds, selectedSceneIds } = get();
    const sceneIds = selectedSceneIds.includes(sceneId)
      ? selectedSceneIds.filter((id) => id !== sceneId)
      : [...selectedSceneIds, sceneId];
    const active = selectedLayerIds.length || selectedClipIds.length ? null : (sceneIds[0] ?? null);
    set(selState(selectedLayerIds, selectedClipIds, sceneIds, active));
  },

  moveSelectionStarts: (items) => {
    const { project } = get();
    if (!project) return;
    let next = project;
    for (const s of items.scenes) {
      next = shiftScene(next, s.id, s.startSec);
    }
    if (items.elements.length) {
      const map = new Map(items.elements.map((e) => [e.id, e.startSec]));
      next = {
        ...next,
        elements: next.elements.map((el) =>
          map.has(el.id) ? { ...el, startSec: Math.max(0, map.get(el.id)!) } : el,
        ),
      };
    }
    if (items.clips.length) {
      const map = new Map(items.clips.map((c) => [c.id, c.startSec]));
      next = {
        ...next,
        audioTracks: next.audioTracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            map.has(c.id) ? { ...c, startSec: Math.max(0, map.get(c.id)!) } : c,
          ),
        })),
      };
    }
    set({
      project: touchProject(next),
      isDirty: true,
      _historyKey: 'sel:moveStarts',
    } as any);
  },

  updateLayer: (id, patch) => get().updateElement(id, patch),
  removeLayer: (id) => get().removeElement(id),
  bringLayerForward: (id) => get().bringElementForward(id),
  sendLayerBackward: (id) => get().sendElementBackward(id),

  addAudioTrack: (name) => {
    const { project } = get();
    if (!project || project.audioTracks.length > 0) return;
    const track: AudioTrack = { id: crypto.randomUUID(), name: name || 'Áudio', clips: [] };
    set({
      project: touchProject({ ...project, audioTracks: [...project.audioTracks, track] }),
      isDirty: true,
    });
  },

  removeAudioTrack: (_trackId) => {
    /* faixa única: não remove */
  },

  addAudioClip: (trackId, clip) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touchProject({
        ...project,
        audioTracks: project.audioTracks.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
        ),
      }),
      selectedClipId: clip.id,
      selectedClipIds: [clip.id],
      selectedLayerIds: [],
      selectedSceneIds: [],
      selectedLayerId: null,
      isDirty: true,
    });
  },

  updateAudioClip: (trackId, clipId, patch) => {
    const { project } = get();
    if (!project) return;
    const keys = Object.keys(patch);
    const continuous = keys.length > 0 && keys.every((k) => CONTINUOUS_PATCH_KEYS.has(k));
    set({
      project: touchProject({
        ...project,
        audioTracks: project.audioTracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) }
            : t,
        ),
      }),
      isDirty: true,
      _historyKey: continuous ? `clip:${clipId}:${keys.sort().join(',')}` : null,
    } as any);
  },

  removeAudioClip: (trackId, clipId) => {
    const { project, selectedClipId } = get();
    if (!project) return;
    set({
      project: touchProject({
        ...project,
        audioTracks: project.audioTracks.map((t) =>
          t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t,
        ),
      }),
      selectedClipId: selectedClipId === clipId ? null : selectedClipId,
      isDirty: true,
    });
  },

  selectClip: (clipId) => {
    blurIfTyping();
    if (!clipId) {
      return set({ selectedClipId: null, selectedClipIds: [] });
    }
    set(selState([], [clipId], [], null));
  },

  addLibraryAsset: (asset) => {
    const { project } = get();
    if (!project) return;
    const entry: ProjectLibraryAsset = {
      id: crypto.randomUUID(),
      kind: asset.kind,
      src: asset.src,
      name: asset.name,
      durationSec: asset.durationSec,
      createdAt: new Date().toISOString(),
    };
    set({
      project: touchProject({
        ...project,
        library: [...(project.library ?? []), entry],
      }),
      isDirty: true,
    });
  },

  removeLibraryAsset: (assetId) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touchProject({
        ...project,
        library: (project.library ?? []).filter((a) => a.id !== assetId),
      }),
      isDirty: true,
    });
  },

  setPlayhead: (sec) => {
    const { project } = get();
    if (!project) return set({ playheadSec: Math.max(0, sec) });
    const total = projectTotalDurationSec(project);
    set({ playheadSec: Math.max(0, Math.min(total, sec)) });
  },

  setPlaying: (playing) => set({ isPlaying: playing }),

  tickPlayhead: (dtSec) => {
    const { project, playheadSec, isPlaying } = get();
    if (!project || !isPlaying) return;
    const total = projectTotalDurationSec(project);
    const next = playheadSec + dtSec;
    if (next >= total) {
      set({ playheadSec: total, isPlaying: false });
      return;
    }
    set({ playheadSec: next });
  },

  copySelection: () => {
    blurIfTyping();
    const { project, selectedLayerId, selectedClipId, activeSceneId } = get();
    if (!project) return;

    if (selectedLayerId) {
      const el = workingElements(project, get().editorSurface).find((e) => e.id === selectedLayerId);
      if (el) set({ clipboard: { kind: 'element', payload: { ...el }, pasteCount: 0 } });
      return;
    }

    if (selectedClipId) {
      for (const track of project.audioTracks) {
        const clip = track.clips.find((c) => c.id === selectedClipId);
        if (clip) {
          set({ clipboard: { kind: 'audio', payload: { ...clip }, pasteCount: 0 } });
          return;
        }
      }
    }

    if (activeSceneId) {
      const scene = project.scenes.find((s) => s.id === activeSceneId);
      if (scene) {
        set({
          clipboard: {
            kind: 'scene',
            payload: { ...scene },
            pasteCount: 0,
          },
        });
      }
    }
  },

  pasteSelection: () => {
    blurIfTyping();
    const { project, clipboard } = get();
    if (!project || !clipboard) return;

    if (clipboard.kind === 'element') {
      const { editorSurface } = get();
      const src = clipboard.payload;
      const n = clipboard.pasteCount + 1;
      const offset = 24 * n;
      const list = workingElements(project, editorSurface);
      const maxZ = list.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const el: ProjectElement = {
        ...src,
        id: crypto.randomUUID(),
        startSec: editorSurface === 'banner' ? 0 : src.startSec + 0.35 * n,
        durationSec: editorSurface === 'banner' ? BANNER_DURATION_SEC : src.durationSec,
        x: src.x + offset,
        y: src.y + offset,
        zIndex: maxZ + 1,
      };
      set({
        project: touchProject(putElements(project, editorSurface, [...list, el])),
        ...selState([el.id], [], [], editorSurface === 'banner' ? ensureBanner(project).scene.id : null),
        clipboard: { ...clipboard, pasteCount: n },
        isDirty: true,
      });
      return;
    }

    if (clipboard.kind === 'audio') {
      const src = clipboard.payload;
      const n = clipboard.pasteCount + 1;
      if (!project.audioTracks[0]?.id) get().addAudioTrack('Áudio');
      const trackId = get().project?.audioTracks[0]?.id;
      if (!trackId) return;
      const clip: AudioClip = {
        ...src,
        id: crypto.randomUUID(),
        startSec: src.startSec + 0.5 * n,
        label: src.label ? `${src.label} (cópia)` : 'Áudio (cópia)',
      };
      get().addAudioClip(trackId, clip);
      set({
        clipboard: { ...clipboard, pasteCount: n },
        activeSceneId: null,
        selectedLayerId: null,
        selectedClipId: clip.id,
      });
      return;
    }

    if (clipboard.kind === 'scene') {
      const src = clipboard.payload;
      const n = clipboard.pasteCount + 1;
      const srcStart = sceneStartSec(src, project);
      const maxZ = project.scenes.reduce((m, s) => Math.max(m, s.zIndex ?? 0), 0);
      const copy: VideoScene = {
        ...src,
        id: crypto.randomUUID(),
        name: 'Fundo',
        startSec: srcStart + src.durationSec * n,
        zIndex: maxZ + 1,
      };
      set({
        project: touchProject({ ...project, scenes: [...project.scenes, copy] }),
        activeSceneId: copy.id,
        selectedLayerId: null,
        selectedClipId: null,
        playheadSec: copy.startSec ?? srcStart,
        clipboard: { ...clipboard, pasteCount: n },
        isDirty: true,
      });
    }
  },

  deleteSelection: () => {
    const {
      project,
      selectedLayerIds,
      selectedClipIds,
      selectedSceneIds,
      selectedLayerId,
      selectedClipId,
      activeSceneId,
      editorSurface,
    } = get();
    if (!project) return;

    const layerIds = selectedLayerIds.length
      ? selectedLayerIds
      : selectedLayerId
        ? [selectedLayerId]
        : [];
    const clipIds = selectedClipIds.length
      ? selectedClipIds
      : selectedClipId
        ? [selectedClipId]
        : [];
    const sceneIds =
      layerIds.length || clipIds.length
        ? selectedSceneIds
        : selectedSceneIds.length
          ? selectedSceneIds
          : activeSceneId
            ? [activeSceneId]
            : [];

    if (!layerIds.length && !clipIds.length && !sceneIds.length) return;

    if (layerIds.length || clipIds.length) get().copySelection();

    if (editorSurface === 'banner') {
      if (!layerIds.length) return;
      const rm = new Set(layerIds);
      const list = workingElements(project, 'banner').filter((e) => !rm.has(e.id));
      set({
        project: touchProject(putElements(project, 'banner', list)),
        selectedLayerId: null,
        selectedLayerIds: [],
        isDirty: true,
      });
      return;
    }

    let elements = project.elements;
    let audioTracks = project.audioTracks;
    let scenes = project.scenes;

    if (layerIds.length) {
      const rm = new Set(layerIds);
      elements = elements.filter((e) => !rm.has(e.id));
    }
    if (clipIds.length) {
      const rm = new Set(clipIds);
      audioTracks = audioTracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => !rm.has(c.id)),
      }));
    }
    if (sceneIds.length && scenes.length > 1) {
      const keep = scenes.filter((s) => !sceneIds.includes(s.id));
      scenes = keep.length ? keep : [scenes[0]];
    }

    const nextActive = scenes.find((s) => s.id === activeSceneId)?.id ?? scenes[0]?.id ?? null;

    set({
      project: touchProject({ ...project, elements, audioTracks, scenes }),
      ...selState([], [], [], nextActive),
      isDirty: true,
    });
  },

  cutSelection: () => {
    get().copySelection();
    get().deleteSelection();
  },

  beginHistoryGesture: () => {
    if (historyGestureDepth === 0) historyGestureCaptured = false;
    historyGestureDepth += 1;
  },

  endHistoryGesture: () => {
    historyGestureDepth = Math.max(0, historyGestureDepth - 1);
    if (historyGestureDepth === 0) resetHistoryMerge();
  },

  undo: () => {
    const { historyPast, historyFuture, project } = get();
    if (!historyPast.length || !project) return;
    resetHistoryMerge();
    historyGestureDepth = 0;
    historyGestureCaptured = false;
    const prev = historyPast[historyPast.length - 1];
    rawSet({
      project: prev,
      historyPast: historyPast.slice(0, -1),
      historyFuture: [...historyFuture, cloneProject(project)],
      isDirty: true,
      selectedLayerId: null,
      selectedLayerIds: [],
      selectedClipId: null,
      selectedClipIds: [],
      selectedSceneIds: [],
      stylePaintArmed: false,
    });
  },

  redo: () => {
    const { historyPast, historyFuture, project } = get();
    if (!historyFuture.length || !project) return;
    resetHistoryMerge();
    historyGestureDepth = 0;
    historyGestureCaptured = false;
    const next = historyFuture[historyFuture.length - 1];
    rawSet({
      project: next,
      historyFuture: historyFuture.slice(0, -1),
      historyPast: [...historyPast, cloneProject(project)],
      isDirty: true,
      selectedLayerId: null,
      selectedLayerIds: [],
      selectedClipId: null,
      selectedClipIds: [],
      selectedSceneIds: [],
      stylePaintArmed: false,
    });
  },
};
});

export const historyGestureBind = {
  onPointerDown: () => useVideoEditorStore.getState().beginHistoryGesture(),
  onPointerUp: () => useVideoEditorStore.getState().endHistoryGesture(),
  onPointerCancel: () => useVideoEditorStore.getState().endHistoryGesture(),
};
