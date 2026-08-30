export interface VideoProject {
  schemaVersion: 1;
  id: string;
  name: string;
  fps: 30;
  width: 1920;
  height: 1080;
  scenes: VideoScene[];
  elements: ProjectElement[];
  audioTracks: AudioTrack[];
  library?: ProjectLibraryAsset[];
  /** Layout estático (capa/banner), separado da timeline. */
  banner?: ProjectBanner;
  createdAt: string;
  updatedAt: string;
}

export type ProjectBanner = {
  scene: VideoScene;
  elements: ProjectElement[];
};

export const BANNER_DURATION_SEC = 1;

export const createEmptyBanner = (): ProjectBanner => ({
  scene: {
    id: crypto.randomUUID(),
    name: 'Banner',
    durationSec: BANNER_DURATION_SEC,
    startSec: 0,
    zIndex: 0,
    backgroundColor: '#ffffff',
  },
  elements: [],
});

/** Página de fundo na timeline (bloco arrastável, estilo Canva). */
export interface VideoScene {
  id: string;
  name: string;
  durationSec: number;
  /** Início na timeline. Se faltar, normalizeProject preenche em sequência. */
  startSec?: number;
  /** Empilha quando dois fundos se sobrepõem. */
  zIndex?: number;
  backgroundSrc?: string;
  backgroundColor?: string;
  transitionOut?: SceneTransition;
  transitionDurationSec?: number;
  /** @deprecated migrado para elements */
  layers?: LegacyLayer[];
}

/** Transição ao sair desta página para a próxima. */
export type SceneTransition =
  | 'cut'
  | 'match'
  | 'dissolve'
  | 'slide-left'
  | 'slide-right'
  | 'circle';

export const SCENE_TRANSITIONS: {
  id: SceneTransition;
  label: string;
  hint: string;
}[] = [
  { id: 'match', label: 'Combinar', hint: 'Anima elementos iguais entre fundos' },
  { id: 'cut', label: 'Nenhuma', hint: 'Corte seco' },
  { id: 'dissolve', label: 'Dissolver', hint: 'Fade suave' },
  { id: 'slide-left', label: 'Deslizar', hint: 'Entra pela esquerda' },
  { id: 'slide-right', label: 'Deslizar direita', hint: 'Entra pela direita' },
  { id: 'circle', label: 'Círculo', hint: 'Abertura circular' },
];

export const hasSceneTransition = (scene: VideoScene) =>
  Boolean(scene.transitionOut && scene.transitionOut !== 'cut');

export type ImageLayer = {
  type: 'image';
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  zIndex: number;
  borderWidth?: number;
  borderColor?: string;
  cornerRadius?: number;
  fillColor?: string;
  flipX?: boolean;
  effect?: import('./element-style').ElementEffect;
  animation?: import('./element-style').ElementAnimation;
};

export type TextLayer = {
  type: 'text';
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  zIndex: number;
  borderWidth?: number;
  borderColor?: string;
  cornerRadius?: number;
  fillColor?: string;
  effect?: import('./element-style').ElementEffect;
  animation?: import('./element-style').ElementAnimation;
};

type LegacyLayer = ImageLayer | TextLayer;

export type ProjectElement = (ImageLayer | TextLayer) & {
  startSec: number;
  durationSec: number;
};

export type Layer = ProjectElement;

export interface AudioClip {
  id: string;
  src: string;
  startSec: number;
  durationSec: number;
  trimStartSec?: number;
  volume?: number;
  label?: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  clips: AudioClip[];
}

/**
 * Biblioteca do projeto (não atravessa projeto A -> B):
 * image, video, audio enviado, element enviado.
 * Conta (Supabase, todo projeto novo já traz): personagem/avatar e SFX.
 */
export type ProjectLibraryKind = 'image' | 'video' | 'audio' | 'element';

/** Arquivo enviado pelo usuário, fica na biblioteca até ele usar no projeto. */
export interface ProjectLibraryAsset {
  id: string;
  kind: ProjectLibraryKind;
  src: string;
  name: string;
  durationSec?: number;
  createdAt: string;
}

export type VideoProjectRow = {
  id: string;
  user_id: string;
  name: string;
  schema_version: number;
  project_json: VideoProject;
  duration_sec: number | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoProjectSummary = {
  id: string;
  name: string;
  durationSec: number | null;
  updatedAt: string;
};

export const PROJECT_WIDTH = 1920;
export const PROJECT_HEIGHT = 1080;
export const PROJECT_FPS = 30 as const;

/** Borda e arredondamento gravados em 0-100. Valores velhos em px (>100) saturam em 100%. */
export const asPercent = (raw?: number) => {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return 0;
  if (raw > 100) return 100;
  return raw;
};

export const cornerRadiusPx = (w: number, h: number, pct?: number) =>
  (asPercent(pct) / 100) * (Math.min(w, h) / 2);

export const strokeWidthPx = (w: number, h: number, pct?: number) =>
  (asPercent(pct) / 100) * (Math.min(w, h) / 2);

export const createEmptyProject = (name = 'Novo projeto'): VideoProject => {
  const now = new Date().toISOString();
  const sceneId = crypto.randomUUID();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    fps: PROJECT_FPS,
    width: PROJECT_WIDTH,
    height: PROJECT_HEIGHT,
    scenes: [
      {
        id: sceneId,
        name: 'Fundo',
        durationSec: 5,
        startSec: 0,
        zIndex: 0,
        backgroundColor: '#ffffff',
      },
    ],
    elements: [],
    audioTracks: [{ id: crypto.randomUUID(), name: 'Áudio', clips: [] }],
    library: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const projectTotalDurationSec = (project: VideoProject): number => {
  let max = 0;
  for (const s of project.scenes) {
    max = Math.max(max, sceneStartSec(s, project) + s.durationSec);
  }
  for (const e of project.elements || []) {
    max = Math.max(max, e.startSec + e.durationSec);
  }
  for (const track of project.audioTracks || []) {
    for (const c of track.clips) {
      max = Math.max(max, c.startSec + c.durationSec);
    }
  }
  return max;
};

export const sceneStartSec = (scene: VideoScene, project?: VideoProject): number => {
  if (scene.startSec != null) return scene.startSec;
  if (!project) return 0;
  return sceneStartTimes(project).get(scene.id) ?? 0;
};

export const sceneStartTimes = (project: VideoProject): Map<string, number> => {
  const map = new Map<string, number>();
  const allHaveStart = project.scenes.every((s) => s.startSec != null);
  if (allHaveStart) {
    for (const scene of project.scenes) map.set(scene.id, scene.startSec ?? 0);
    return map;
  }
  let t = 0;
  for (const scene of project.scenes) {
    const start = scene.startSec ?? t;
    map.set(scene.id, start);
    t = start + scene.durationSec;
  }
  return map;
};

export const scenesByTime = (project: VideoProject): VideoScene[] => {
  const starts = sceneStartTimes(project);
  return [...project.scenes].sort((a, b) => {
    const ds = (starts.get(a.id) ?? 0) - (starts.get(b.id) ?? 0);
    if (ds !== 0) return ds;
    return (a.zIndex ?? 0) - (b.zIndex ?? 0);
  });
};

export const sceneAtTime = (project: VideoProject, t: number): VideoScene | null => {
  if (!project.scenes.length) return null;
  const starts = sceneStartTimes(project);
  const covering = project.scenes.filter((scene) => {
    const start = starts.get(scene.id) ?? 0;
    return t >= start && t < start + scene.durationSec;
  });
  if (covering.length) {
    return [...covering].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))[covering.length - 1];
  }
  const ordered = scenesByTime(project);
  return ordered[ordered.length - 1] ?? null;
};

/** Item "embaixo" deste fundo: começa dentro da janela dele. */
export const itemBelongsToSceneWindow = (
  startSec: number,
  sceneStart: number,
  sceneDur: number,
) => startSec >= sceneStart - 0.001 && startSec < sceneStart + sceneDur - 0.001;

export const elementsAtTime = (project: VideoProject, t: number): ProjectElement[] =>
  (project.elements || [])
    .filter((e) => t >= e.startSec && t < e.startSec + e.durationSec)
    .sort((a, b) => a.zIndex - b.zIndex);

/** Faixa única de áudio (estilo Canva). Clips empilham na mesma linha. */
export const projectAudioTrack = (project: VideoProject): AudioTrack => {
  if (!project.audioTracks.length) {
    return { id: 'audio', name: 'Áudio', clips: [] };
  }
  if (project.audioTracks.length === 1) return project.audioTracks[0];
  return {
    id: project.audioTracks[0].id,
    name: 'Áudio',
    clips: project.audioTracks.flatMap((t) => t.clips),
  };
};

/** Atribui faixas vertuais para clips que se sobrepõem no tempo (empilhar na UI). */
export const stackLanes = (
  items: { id: string; startSec: number; durationSec: number }[],
): Map<string, number> => {
  const sorted = [...items].sort((a, b) => a.startSec - b.startSec);
  const lanes = new Map<string, number>();
  const laneEnds: number[] = [];

  for (const item of sorted) {
    const end = item.startSec + item.durationSec;
    let lane = 0;
    for (; lane < laneEnds.length; lane++) {
      if (item.startSec >= laneEnds[lane] - 0.01) break;
    }
    if (lane === laneEnds.length) laneEnds.push(end);
    else laneEnds[lane] = end;
    lanes.set(item.id, lane);
  }
  return lanes;
};

export const normalizeProject = (raw: VideoProject): VideoProject => {
  const elements: ProjectElement[] = [...(raw.elements || [])];
  const hasLegacyLayers = (raw.scenes || []).some((s) => (s.layers?.length ?? 0) > 0);

  if (hasLegacyLayers && elements.length === 0) {
    const starts = sceneStartTimes(raw);
    for (const scene of raw.scenes || []) {
      const sceneStart = starts.get(scene.id) ?? 0;
      for (const layer of scene.layers || []) {
        elements.push({
          ...(layer as ImageLayer | TextLayer),
          startSec: sceneStart,
          durationSec: scene.durationSec,
        });
      }
    }
  }

  const starts = sceneStartTimes({ ...raw, scenes: raw.scenes || [] });
  const scenes = (raw.scenes || []).map(({ layers: _layers, ...rest }, i) => ({
    ...rest,
    name: 'Fundo',
    startSec: rest.startSec ?? starts.get(rest.id) ?? 0,
    zIndex: rest.zIndex ?? i,
    backgroundColor: rest.backgroundColor ?? '#ffffff',
  }));

  const mergedClips = (raw.audioTracks || []).flatMap((t) => t.clips);
  const audioTracks: AudioTrack[] = [
    {
      id: raw.audioTracks?.[0]?.id ?? crypto.randomUUID(),
      name: 'Áudio',
      clips: mergedClips,
    },
  ];

  return {
    ...raw,
    scenes,
    elements,
    audioTracks,
    library: raw.library ?? [],
    banner: raw.banner
      ? {
          scene: {
            ...raw.banner.scene,
            name: raw.banner.scene.name || 'Banner',
            durationSec: raw.banner.scene.durationSec || BANNER_DURATION_SEC,
            startSec: 0,
            backgroundColor: raw.banner.scene.backgroundColor ?? '#ffffff',
          },
          elements: raw.banner.elements ?? [],
        }
      : undefined,
  };
};
