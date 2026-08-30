import type { ProjectElement, VideoProject, VideoScene } from '../types/video-project';
import { elementsAtTime, sceneStartTimes, scenesByTime } from '../types/video-project';

export type MatchMovePose = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  fontSize?: number;
};

export type MatchMovePair = {
  from: ProjectElement;
  to: ProjectElement;
};

export type MatchMoveFrame = {
  active: true;
  progress: number;
  fromScene: VideoScene;
  toScene: VideoScene;
  fromSceneStart: number;
  boundarySec: number;
  durationSec: number;
  pairs: MatchMovePair[];
  /** IDs dos clips originais escondidos enquanto o interpolante anima */
  hiddenIds: string[];
  /** Elementos já com pose interpolada (substitui o par) */
  morphLayers: ProjectElement[];
  /** Elementos sem par: fade out (antes) / fade in (depois) */
  fadeOutLayers: ProjectElement[];
  fadeInLayers: ProjectElement[];
  /** Elementos contínuos (mesmo id nos dois lados) */
  continuousLayers: ProjectElement[];
};

export type MatchMoveResult = MatchMoveFrame | { active: false };

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Identidade visual: mesma imagem/fonte = candidato a Combinar. */
export const elementFingerprint = (el: ProjectElement): string => {
  if (el.type === 'image') return `img:${el.src}`;
  return `txt:${el.text}\0${el.fontFamily}\0${el.color}`;
};

export const poseOf = (el: ProjectElement): MatchMovePose => {
  if (el.type === 'image') {
    return {
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      rotation: el.rotation ?? 0,
      opacity: el.opacity ?? 1,
    };
  }
  return {
    x: el.x,
    y: el.y,
    w: 200,
    h: el.fontSize,
    rotation: 0,
    opacity: 1,
    fontSize: el.fontSize,
  };
};

export const applyPose = (el: ProjectElement, pose: MatchMovePose): ProjectElement => {
  if (el.type === 'image') {
    return {
      ...el,
      x: pose.x,
      y: pose.y,
      w: pose.w,
      h: pose.h,
      rotation: pose.rotation,
      opacity: pose.opacity,
      id: el.id,
    };
  }
  return {
    ...el,
    x: pose.x,
    y: pose.y,
    fontSize: pose.fontSize ?? el.fontSize,
  };
};

export const lerpPose = (a: MatchMovePose, b: MatchMovePose, t: number): MatchMovePose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  rotation: lerp(a.rotation, b.rotation, t),
  opacity: lerp(a.opacity, b.opacity, t),
  fontSize:
    a.fontSize != null && b.fontSize != null ? lerp(a.fontSize, b.fontSize, t) : b.fontSize ?? a.fontSize,
});

/** Emparelha 1:1 por fingerprint (ordem de zIndex). */
export const matchElementPairs = (
  before: ProjectElement[],
  after: ProjectElement[],
): { pairs: MatchMovePair[]; unmatchedBefore: ProjectElement[]; unmatchedAfter: ProjectElement[]; continuous: ProjectElement[] } => {
  const beforeIds = new Set(before.map((e) => e.id));
  const afterIds = new Set(after.map((e) => e.id));

  const continuous = before.filter((e) => afterIds.has(e.id));
  const continuousIds = new Set(continuous.map((e) => e.id));

  const fromOnly = before.filter((e) => !continuousIds.has(e.id));
  const toOnly = after.filter((e) => !continuousIds.has(e.id));

  const usedTo = new Set<string>();
  const pairs: MatchMovePair[] = [];

  const sortedFrom = [...fromOnly].sort((a, b) => a.zIndex - b.zIndex);
  for (const from of sortedFrom) {
    const fp = elementFingerprint(from);
    const candidate = toOnly
      .filter((e) => !usedTo.has(e.id) && elementFingerprint(e) === fp)
      .sort((a, b) => a.zIndex - b.zIndex)[0];
    if (candidate) {
      usedTo.add(candidate.id);
      pairs.push({ from, to: candidate });
    }
  }

  const pairedFrom = new Set(pairs.map((p) => p.from.id));
  const unmatchedBefore = fromOnly.filter((e) => !pairedFrom.has(e.id));
  const unmatchedAfter = toOnly.filter((e) => !usedTo.has(e.id));

  void beforeIds;
  return { pairs, unmatchedBefore, unmatchedAfter, continuous };
};

/**
 * Janela da Combinar: cruza a borda entre fundos.
 * progress 0 = ainda no fundo A, 1 = já no fundo B.
 */
export const getMatchMoveAt = (project: VideoProject, t: number): MatchMoveResult => {
  const starts = sceneStartTimes(project);
  const scenes = scenesByTime(project);

  for (let i = 0; i < scenes.length - 1; i++) {
    const fromScene = scenes[i];
    const toScene = scenes[i + 1];
    if (fromScene.transitionOut !== 'match') continue;

    const boundary = starts.get(toScene.id);
    if (boundary == null) continue;

    const durationSec = Math.max(0.25, fromScene.transitionDurationSec ?? 0.7);
    // Metade antes / metade depois da troca de fundo
    const half = durationSec / 2;
    const windowStart = boundary - half;
    const windowEnd = boundary + half;

    if (t < windowStart || t > windowEnd) continue;

    const raw = (t - windowStart) / durationSec;
    const progress = easeInOut(Math.min(1, Math.max(0, raw)));

    const sampleBefore = Math.max(0, boundary - 0.02);
    const sampleAfter = boundary + 0.02;
    const before = elementsAtTime(project, sampleBefore);
    const after = elementsAtTime(project, sampleAfter);

    const { pairs, unmatchedBefore, unmatchedAfter, continuous } = matchElementPairs(before, after);

    const morphLayers: ProjectElement[] = pairs.map(({ from, to }) => {
      const pose = lerpPose(poseOf(from), poseOf(to), progress);
      // Usa o elemento "to" como base visual; pose vem da interpolação
      const base = progress < 0.5 ? from : to;
      return applyPose(
        {
          ...base,
          id: `match:${from.id}:${to.id}`,
          zIndex: Math.max(from.zIndex, to.zIndex) + 100,
          startSec: windowStart,
          durationSec,
        } as ProjectElement,
        pose,
      );
    });

    const fadeOutLayers = unmatchedBefore.map((el) => {
      if (el.type === 'image') {
        return { ...el, opacity: (el.opacity ?? 1) * (1 - progress), id: el.id };
      }
      return el;
    });

    const fadeInLayers = unmatchedAfter.map((el) => {
      if (el.type === 'image') {
        return { ...el, opacity: (el.opacity ?? 1) * progress, id: el.id };
      }
      return el;
    });

    const hiddenIds = [
      ...pairs.flatMap((p) => [p.from.id, p.to.id]),
      // continuous keeps its real id in continuousLayers
    ];

    // Contínuos: amostra no tempo atual (já está na timeline)
    const continuousLayers = continuous
      .map((el) => elementsAtTime(project, t).find((e) => e.id === el.id))
      .filter(Boolean) as ProjectElement[];

    return {
      active: true,
      progress,
      fromScene,
      toScene,
      fromSceneStart: starts.get(fromScene.id) ?? 0,
      boundarySec: boundary,
      durationSec,
      pairs,
      hiddenIds,
      morphLayers,
      fadeOutLayers,
      fadeInLayers,
      continuousLayers,
    };
  }

  return { active: false };
};

/** Camadas finais para o canvas durante Combinar (ou lista normal se inativo). */
export const layersForPreview = (
  project: VideoProject,
  t: number,
  match: MatchMoveResult,
): ProjectElement[] => {
  if (!match.active) return elementsAtTime(project, t);

  const hide = new Set(match.hiddenIds);
  const live = elementsAtTime(project, t).filter((e) => !hide.has(e.id));

  const fadeOutIds = new Set(match.fadeOutLayers.map((e) => e.id));
  const fadeInIds = new Set(match.fadeInLayers.map((e) => e.id));
  const others = live.filter((e) => !fadeOutIds.has(e.id) && !fadeInIds.has(e.id));

  return [...others, ...match.fadeOutLayers, ...match.fadeInLayers, ...match.morphLayers].sort(
    (a, b) => a.zIndex - b.zIndex,
  );
};
