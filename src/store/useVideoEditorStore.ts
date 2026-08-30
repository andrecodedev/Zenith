import { create } from 'zustand';
import type {
  AudioClip,
  AudioTrack,
  Layer,
  VideoProject,
  VideoScene,
} from '../types/video-project';
import { createEmptyProject } from '../types/video-project';

type EditorView = 'list' | 'editor';

type VideoEditorState = {
  view: EditorView;
  project: VideoProject | null;
  activeSceneId: string | null;
  selectedLayerId: string | null;
  selectedClipId: string | null;
  isDirty: boolean;
  playheadSec: number;
  isPlaying: boolean;
  saving: boolean;
  lastSavedAt: string | null;

  setView: (view: EditorView) => void;
  newProject: (name?: string) => void;
  loadProject: (project: VideoProject) => void;
  closeProject: () => void;
  setProjectName: (name: string) => void;
  markDirty: () => void;
  markSaved: () => void;
  setSaving: (saving: boolean) => void;

  setActiveScene: (sceneId: string) => void;
  addScene: (name?: string) => void;
  duplicateScene: (sceneId: string) => void;
  removeScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  reorderScene: (fromIndex: number, toIndex: number) => void;
  setSceneDuration: (sceneId: string, durationSec: number) => void;

  addLayer: (layer: Layer) => void;
  updateLayer: (layerId: string, patch: Partial<Layer>) => void;
  removeLayer: (layerId: string) => void;
  bringLayerForward: (layerId: string) => void;
  sendLayerBackward: (layerId: string) => void;
  selectLayer: (layerId: string | null) => void;

  addAudioTrack: (name: string) => void;
  removeAudioTrack: (trackId: string) => void;
  addAudioClip: (trackId: string, clip: AudioClip) => void;
  updateAudioClip: (trackId: string, clipId: string, patch: Partial<AudioClip>) => void;
  removeAudioClip: (trackId: string, clipId: string) => void;
  selectClip: (clipId: string | null) => void;

  setPlayhead: (sec: number) => void;
  setPlaying: (playing: boolean) => void;
};

const touchProject = (project: VideoProject): VideoProject => ({
  ...project,
  updatedAt: new Date().toISOString(),
});

const updateActiveScene = (
  project: VideoProject,
  activeSceneId: string | null,
  fn: (scene: VideoScene) => VideoScene,
): VideoProject => {
  if (!activeSceneId) return project;
  return {
    ...project,
    scenes: project.scenes.map((s) => (s.id === activeSceneId ? fn(s) : s)),
  };
};

export const useVideoEditorStore = create<VideoEditorState>((set, get) => ({
  view: 'list',
  project: null,
  activeSceneId: null,
  selectedLayerId: null,
  selectedClipId: null,
  isDirty: false,
  playheadSec: 0,
  isPlaying: false,
  saving: false,
  lastSavedAt: null,

  setView: (view) => set({ view }),

  newProject: (name) => {
    const project = createEmptyProject(name);
    set({
      view: 'editor',
      project,
      activeSceneId: project.scenes[0]?.id ?? null,
      selectedLayerId: null,
      selectedClipId: null,
      isDirty: true,
      playheadSec: 0,
      isPlaying: false,
    });
  },

  loadProject: (project) =>
    set({
      view: 'editor',
      project,
      activeSceneId: project.scenes[0]?.id ?? null,
      selectedLayerId: null,
      selectedClipId: null,
      isDirty: false,
      playheadSec: 0,
      isPlaying: false,
      lastSavedAt: project.updatedAt,
    }),

  closeProject: () =>
    set({
      view: 'list',
      project: null,
      activeSceneId: null,
      selectedLayerId: null,
      selectedClipId: null,
      isDirty: false,
      playheadSec: 0,
      isPlaying: false,
    }),

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

  setActiveScene: (sceneId) =>
    set({ activeSceneId: sceneId, selectedLayerId: null }),

  addScene: (name) => {
    const { project } = get();
    if (!project) return;
    const scene: VideoScene = {
      id: crypto.randomUUID(),
      name: name || `Cena ${project.scenes.length + 1}`,
      durationSec: 5,
      layers: [],
    };
    set({
      project: touchProject({ ...project, scenes: [...project.scenes, scene] }),
      activeSceneId: scene.id,
      isDirty: true,
    });
  },

  duplicateScene: (sceneId) => {
    const { project } = get();
    if (!project) return;
    const source = project.scenes.find((s) => s.id === sceneId);
    if (!source) return;
    const copy: VideoScene = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (cópia)`,
      layers: source.layers.map((l) => ({ ...l, id: crypto.randomUUID() })),
    };
    const idx = project.scenes.findIndex((s) => s.id === sceneId);
    const scenes = [...project.scenes];
    scenes.splice(idx + 1, 0, copy);
    set({
      project: touchProject({ ...project, scenes }),
      activeSceneId: copy.id,
      isDirty: true,
    });
  },

  removeScene: (sceneId) => {
    const { project, activeSceneId } = get();
    if (!project || project.scenes.length <= 1) return;
    const scenes = project.scenes.filter((s) => s.id !== sceneId);
    const nextActive =
      activeSceneId === sceneId ? scenes[0]?.id ?? null : activeSceneId;
    set({
      project: touchProject({ ...project, scenes }),
      activeSceneId: nextActive,
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
    const sec = Math.max(0.5, durationSec);
    set({
      project: touchProject({
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId ? { ...s, durationSec: sec } : s,
        ),
      }),
      isDirty: true,
    });
  },

  addLayer: (layer) => {
    const { project, activeSceneId } = get();
    if (!project || !activeSceneId) return;
    set({
      project: touchProject(
        updateActiveScene(project, activeSceneId, (s) => ({
          ...s,
          layers: [...s.layers, layer],
        })),
      ),
      selectedLayerId: layer.id,
      isDirty: true,
    });
  },

  updateLayer: (layerId, patch) => {
    const { project, activeSceneId } = get();
    if (!project || !activeSceneId) return;
    set({
      project: touchProject(
        updateActiveScene(project, activeSceneId, (s) => ({
          ...s,
          layers: s.layers.map((l) =>
            l.id === layerId ? ({ ...l, ...patch } as Layer) : l,
          ),
        })),
      ),
      isDirty: true,
    });
  },

  removeLayer: (layerId) => {
    const { project, activeSceneId, selectedLayerId } = get();
    if (!project || !activeSceneId) return;
    set({
      project: touchProject(
        updateActiveScene(project, activeSceneId, (s) => ({
          ...s,
          layers: s.layers.filter((l) => l.id !== layerId),
        })),
      ),
      selectedLayerId: selectedLayerId === layerId ? null : selectedLayerId,
      isDirty: true,
    });
  },

  bringLayerForward: (layerId) => {
    const { project, activeSceneId } = get();
    if (!project || !activeSceneId) return;
    set({
      project: touchProject(
        updateActiveScene(project, activeSceneId, (s) => {
          const sorted = [...s.layers].sort((a, b) => a.zIndex - b.zIndex);
          const idx = sorted.findIndex((l) => l.id === layerId);
          if (idx < 0 || idx >= sorted.length - 1) return s;
          const next = sorted[idx + 1];
          return {
            ...s,
            layers: s.layers.map((l) => {
              if (l.id === layerId) return { ...l, zIndex: next.zIndex };
              if (l.id === next.id) return { ...l, zIndex: sorted[idx].zIndex };
              return l;
            }),
          };
        }),
      ),
      isDirty: true,
    });
  },

  sendLayerBackward: (layerId) => {
    const { project, activeSceneId } = get();
    if (!project || !activeSceneId) return;
    set({
      project: touchProject(
        updateActiveScene(project, activeSceneId, (s) => {
          const sorted = [...s.layers].sort((a, b) => a.zIndex - b.zIndex);
          const idx = sorted.findIndex((l) => l.id === layerId);
          if (idx <= 0) return s;
          const prev = sorted[idx - 1];
          return {
            ...s,
            layers: s.layers.map((l) => {
              if (l.id === layerId) return { ...l, zIndex: prev.zIndex };
              if (l.id === prev.id) return { ...l, zIndex: sorted[idx].zIndex };
              return l;
            }),
          };
        }),
      ),
      isDirty: true,
    });
  },

  selectLayer: (layerId) => set({ selectedLayerId: layerId, selectedClipId: null }),

  addAudioTrack: (name) => {
    const { project } = get();
    if (!project) return;
    const track: AudioTrack = { id: crypto.randomUUID(), name, clips: [] };
    set({
      project: touchProject({ ...project, audioTracks: [...project.audioTracks, track] }),
      isDirty: true,
    });
  },

  removeAudioTrack: (trackId) => {
    const { project } = get();
    if (!project || project.audioTracks.length <= 1) return;
    set({
      project: touchProject({
        ...project,
        audioTracks: project.audioTracks.filter((t) => t.id !== trackId),
      }),
      selectedClipId: null,
      isDirty: true,
    });
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
      isDirty: true,
    });
  },

  updateAudioClip: (trackId, clipId, patch) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touchProject({
        ...project,
        audioTracks: project.audioTracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
              }
            : t,
        ),
      }),
      isDirty: true,
    });
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

  selectClip: (clipId) => set({ selectedClipId: clipId, selectedLayerId: null }),

  setPlayhead: (sec) => set({ playheadSec: Math.max(0, sec) }),
  setPlaying: (playing) => set({ isPlaying: playing }),
}));
