import type { VideoProject } from '../types/video-project';
import { projectAudioTrack, projectTotalDurationSec, sceneStartTimes } from '../types/video-project';

export const SNAP_PX = 10;

export type SnapKind = 'element' | 'scene' | 'clip';

const roundMs = (t: number) => Math.round(t * 1000) / 1000;

export type SnapExclude = {
  kind: SnapKind;
  id: string;
  ignoreElementIds?: string[];
  ignoreClipIds?: string[];
};

export const collectSnapTimes = (
  project: VideoProject,
  playheadSec: number,
  exclude?: SnapExclude,
): number[] => {
  const starts = sceneStartTimes(project);
  const times: number[] = [0, playheadSec, projectTotalDurationSec(project)];

  for (const el of project.elements) {
    if (exclude?.kind === 'element' && el.id === exclude.id) continue;
    if (exclude?.ignoreElementIds?.includes(el.id)) continue;
    times.push(el.startSec, el.startSec + el.durationSec);
  }
  for (const scene of project.scenes) {
    if (exclude?.kind === 'scene' && scene.id === exclude.id) continue;
    const start = starts.get(scene.id) ?? scene.startSec ?? 0;
    times.push(start, start + scene.durationSec);
  }
  for (const clip of projectAudioTrack(project).clips) {
    if (exclude?.kind === 'clip' && clip.id === exclude.id) continue;
    if (exclude?.ignoreClipIds?.includes(clip.id)) continue;
    times.push(clip.startSec, clip.startSec + clip.durationSec);
  }

  return [...new Set(times.map(roundMs))].sort((a, b) => a - b);
};

export const snapTime = (
  raw: number,
  targets: number[],
  thresholdSec: number,
): { value: number; guide: number | null } => {
  let best: { value: number; guide: number; dist: number } | null = null;
  for (const t of targets) {
    const dist = Math.abs(raw - t);
    if (dist <= thresholdSec && (!best || dist < best.dist)) {
      best = { value: t, guide: t, dist };
    }
  }
  return best ?? { value: raw, guide: null };
};

/** Move o bloco inteiro: ímã no início, no fim ou no centro. */
export const snapMove = (
  rawStart: number,
  duration: number,
  targets: number[],
  thresholdSec: number,
): { start: number; guide: number | null } => {
  const candidates = [
    { edge: rawStart, toStart: (snapped: number) => snapped },
    { edge: rawStart + duration, toStart: (snapped: number) => snapped - duration },
    { edge: rawStart + duration / 2, toStart: (snapped: number) => snapped - duration / 2 },
  ];
  let best: { start: number; guide: number; dist: number } | null = null;
  for (const c of candidates) {
    for (const t of targets) {
      const dist = Math.abs(c.edge - t);
      if (dist <= thresholdSec && (!best || dist < best.dist)) {
        best = { start: Math.max(0, c.toStart(t)), guide: t, dist };
      }
    }
  }
  if (!best) return { start: Math.max(0, rawStart), guide: null };
  return { start: best.start, guide: best.guide };
};
