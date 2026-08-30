import type { Layer as ProjectLayer } from '../types/video-project';
import { PROJECT_HEIGHT, PROJECT_WIDTH } from '../types/video-project';

export const GUIDE_SNAP = 14;

export type GuideLine = { axis: 'x' | 'y'; at: number };

export type LayerBox = { x: number; y: number; w: number; h: number };

export const layerBox = (layer: ProjectLayer, x = layer.x, y = layer.y): LayerBox => {
  if (layer.type === 'image') return { x, y, w: layer.w, h: layer.h };
  const w = Math.max(48, (layer.text?.length || 1) * layer.fontSize * 0.52);
  const h = layer.fontSize * 1.3;
  return { x, y, w, h };
};

const snapOnAxis = (edges: number[], targets: number[], threshold: number) => {
  let best: { delta: number; at: number; dist: number } | null = null;
  for (const edge of edges) {
    for (const t of targets) {
      const dist = Math.abs(edge - t);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { delta: t - edge, at: t, dist };
      }
    }
  }
  return best;
};

export const snapLayerDrag = (
  moving: LayerBox,
  others: LayerBox[],
  threshold = GUIDE_SNAP,
): { x: number; y: number; guides: GuideLine[] } => {
  const xTargets = [0, PROJECT_WIDTH / 2, PROJECT_WIDTH];
  const yTargets = [0, PROJECT_HEIGHT / 2, PROJECT_HEIGHT];
  for (const b of others) {
    xTargets.push(b.x, b.x + b.w / 2, b.x + b.w);
    yTargets.push(b.y, b.y + b.h / 2, b.y + b.h);
  }

  const sx = snapOnAxis([moving.x, moving.x + moving.w / 2, moving.x + moving.w], xTargets, threshold);
  const sy = snapOnAxis([moving.y, moving.y + moving.h / 2, moving.y + moving.h], yTargets, threshold);

  const guides: GuideLine[] = [];
  if (sx) guides.push({ axis: 'x', at: sx.at });
  if (sy) guides.push({ axis: 'y', at: sy.at });

  return {
    x: moving.x + (sx?.delta ?? 0),
    y: moving.y + (sy?.delta ?? 0),
    guides,
  };
};
