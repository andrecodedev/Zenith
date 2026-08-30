export interface VideoProject {
  schemaVersion: 1;
  id: string;
  name: string;
  fps: 30;
  width: 1920;
  height: 1080;
  scenes: VideoScene[];
  audioTracks: AudioTrack[];
  createdAt: string;
  updatedAt: string;
}

export interface VideoScene {
  id: string;
  name: string;
  durationSec: number;
  transitionOut?: 'cut' | 'dissolve' | 'slide-left';
  transitionDurationSec?: number;
  layers: Layer[];
}

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
  zIndex: number;
};

export type Layer = ImageLayer | TextLayer;

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
        name: 'Cena 1',
        durationSec: 5,
        layers: [],
      },
    ],
    audioTracks: [
      { id: crypto.randomUUID(), name: 'Narração', clips: [] },
      { id: crypto.randomUUID(), name: 'SFX', clips: [] },
      { id: crypto.randomUUID(), name: 'Música', clips: [] },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

export const projectTotalDurationSec = (project: VideoProject): number =>
  project.scenes.reduce((sum, s) => sum + s.durationSec, 0);

export const sceneStartTimes = (project: VideoProject): Map<string, number> => {
  const map = new Map<string, number>();
  let t = 0;
  for (const scene of project.scenes) {
    map.set(scene.id, t);
    t += scene.durationSec;
  }
  return map;
};
