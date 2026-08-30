import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, Trash2, Type, ImageIcon, Music, Layers, Minus, Sparkles } from 'lucide-react';
import type { ProjectElement, VideoProject, VideoScene } from '../../../types/video-project';
import {
  hasSceneTransition,
  itemBelongsToSceneWindow,
  projectAudioTrack,
  projectTotalDurationSec,
  sceneStartTimes,
  scenesByTime,
  stackLanes,
} from '../../../types/video-project';
import { collectSnapTimes, SNAP_PX, snapMove, snapTime, type SnapKind } from '../../../lib/timeline-snap';
import { useVideoEditorStore } from '../../../store/useVideoEditorStore';

type TimelineProps = {
  project: VideoProject;
  activeSceneId: string | null;
  playheadSec: number;
  selectedLayerId: string | null;
  selectedClipId: string | null;
  selectedLayerIds: string[];
  selectedClipIds: string[];
  selectedSceneIds: string[];
  editingTransitionSceneId: string | null;
  onSelectScene: (id: string | null) => void;
  onAddScene: () => void;
  onInsertSceneAfter: (sceneId: string) => void;
  onEditTransition: (sceneId: string) => void;
  onRemoveScene: (id: string) => void;
  onRemoveElement: (id: string) => void;
  onSetPlayhead: (sec: number) => void;
  onSelectLayer: (id: string | null) => void;
  onSelectClip: (id: string | null) => void;
  onToggleLayer: (id: string) => void;
  onToggleClip: (id: string) => void;
  onToggleScene: (id: string) => void;
  onSetTimelineSelection: (sel: { layerIds: string[]; clipIds: string[]; sceneIds: string[] }) => void;
  onMoveSelectionStarts: (items: {
    elements: { id: string; startSec: number }[];
    clips: { id: string; startSec: number }[];
    scenes: { id: string; startSec: number }[];
  }) => void;
  onUpdateElement: (id: string, patch: { startSec?: number; durationSec?: number }) => void;
  onUpdateSceneDuration: (sceneId: string, durationSec: number) => void;
  onMoveScene: (sceneId: string, startSec: number) => void;
  onTrimSceneLeft: (sceneId: string, startSec: number) => void;
  onUpdateClip: (clipId: string, patch: { startSec?: number; durationSec?: number }) => void;
  onRemoveAudioClip: (clipId: string) => void;
  onReorderLayers: (frontToBackIds: string[]) => void;
  heightPx: number;
};

const MIN_PPS = 6;
const MAX_PPS = 120;
const DEFAULT_PPS = 32;
const LANE_H = 22;
const ELEM_LANE_H = 36;
const RULER_H = 28;
const SCENE_BLOCK_H = 50;

type Box = { x: number; y: number; w: number; h: number };

const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const fmtPlayhead = (sec: number) => {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

const rulerStep = (pps: number) => {
  if (pps >= 64) return 1;
  if (pps >= 32) return 5;
  if (pps >= 16) return 10;
  return 30;
};

/** Hint central só com faixa vazia (some assim que entra conteúdo). */
const EmptyTrackHint = ({ children }: { children: ReactNode }) => (
  <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-neutral-500 pointer-events-none select-none">
    {children}
  </div>
);

/** Barrinha nas duas bordas para trim (esquerda = início, direita = duração). */
const ResizeHandle = ({
  selected,
  side,
  onPointerDown,
  className = '',
}: {
  selected?: boolean;
  side: 'left' | 'right';
  onPointerDown: (e: React.PointerEvent) => void;
  className?: string;
}) => (
  <div
    data-no-seek
    title={side === 'left' ? 'Arrastar início' : 'Arrastar duração'}
    className={
      'absolute top-0 bottom-0 w-3 cursor-ew-resize z-30 pointer-events-auto ' +
      (side === 'left' ? 'left-0 rounded-l-md' : 'right-0 rounded-r-md') +
      (selected ? ' bg-white/50 hover:bg-white/80' : ' bg-white/25 hover:bg-white/55') +
      ` ${className}`
    }
    onPointerDown={onPointerDown}
  />
);

type DragMode = 'move' | 'resize-left' | 'resize-right';
type ItemDrag = {
  kind: SnapKind;
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origStart: number;
  origDur: number;
  origLane: number;
  moved: boolean;
  ignoreElementIds?: string[];
  ignoreClipIds?: string[];
  mates?: {
    elements: { id: string; origStart: number }[];
    clips: { id: string; origStart: number }[];
    scenes: { id: string; origStart: number }[];
  };
};

const layerIcon = (layer: ProjectElement) =>
  layer.type === 'text' ? <Type size={12} /> : <ImageIcon size={12} />;


const SceneGap = ({
  left,
  hasTransition,
  isEditing,
  onInsert,
  onTransition,
}: {
  left: number;
  hasTransition: boolean;
  isEditing: boolean;
  onInsert: () => void;
  onTransition: () => void;
}) => {
  const [hover, setHover] = useState(false);
  const open = hover || isEditing;

  return (
    <div
      data-no-seek
      className={
        'absolute top-0 bottom-0 pointer-events-none ' + (open ? 'z-50' : 'z-20')
      }
      style={{ left: left - 20, width: 40 }}
    >
      {open ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-auto"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <button
            type="button"
            title="Adicionar mídia/cena em branco"
            className="w-7 h-7 rounded-full bg-white text-neutral-900 shadow-lg flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onInsert();
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            title={hasTransition ? 'Alterar transição' : 'Adicionar transição'}
            className={
              'w-7 h-7 rounded-full shadow-lg flex items-center justify-center cursor-pointer ' +
              (isEditing
                ? 'bg-violet-600 text-white ring-2 ring-violet-300'
                : 'bg-neutral-800 text-violet-300 border border-neutral-600 hover:bg-neutral-700')
            }
            onClick={(e) => {
              e.stopPropagation();
              onTransition();
            }}
          >
            <Sparkles size={13} />
          </button>
        </div>
      ) : (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-9 h-8 pointer-events-auto flex items-end justify-center pb-0.5"
          onMouseEnter={() => setHover(true)}
          title={hasTransition ? 'Transição / adicionar' : 'Adicionar transição ou cena'}
        >
          {hasTransition ? (
            <button
              type="button"
              className="w-5 h-5 rounded-full bg-violet-600 border border-violet-400 shadow flex items-center justify-center text-white hover:bg-violet-500 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onTransition();
              }}
            >
              <Sparkles size={10} />
            </button>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500/80" />
          )}
        </div>
      )}
    </div>
  );
};

export const Timeline = (props: TimelineProps) => {
  const {
    project,
    activeSceneId,
    playheadSec,
    selectedLayerId,
    selectedClipId,
    selectedLayerIds,
    selectedClipIds,
    selectedSceneIds,
    editingTransitionSceneId,
    onSelectScene,
    onAddScene,
    onInsertSceneAfter,
    onEditTransition,
    onRemoveScene,
    onRemoveElement,
    onSetPlayhead,
    onSelectLayer,
    onSelectClip,
    onToggleLayer,
    onToggleClip,
    onToggleScene,
    onSetTimelineSelection,
    onMoveSelectionStarts,
    onUpdateElement,
    onUpdateSceneDuration,
    onMoveScene,
    onTrimSceneLeft,
    onUpdateClip,
    onRemoveAudioClip,
    onReorderLayers,
    heightPx,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  const playheadRef = useRef(playheadSec);
  projectRef.current = project;
  playheadRef.current = playheadSec;
  const [pps, setPps] = useState(DEFAULT_PPS);
  const [dragging, setDragging] = useState(false);
  const [itemDrag, setItemDrag] = useState<ItemDrag | null>(null);
  const beginItemDrag = (drag: ItemDrag) => {
    useVideoEditorStore.getState().beginHistoryGesture();
    setItemDrag(drag);
  };
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const audioTrack = projectAudioTrack(project);
  const elems = project.elements || [];
  const elemsFrontToBack = [...elems].sort((a, b) => b.zIndex - a.zIndex || a.id.localeCompare(b.id));
  const elemLanes = new Map(elemsFrontToBack.map((el, i) => [el.id, i]));
  const audioLanes = stackLanes(audioTrack.clips);
  const starts = sceneStartTimes(project);
  const sceneLanes = stackLanes(
    project.scenes.map((s) => ({
      id: s.id,
      startSec: starts.get(s.id) ?? s.startSec ?? 0,
      durationSec: s.durationSec,
    })),
  );
  const elemLaneCount = Math.max(1, elemsFrontToBack.length);
  const audioLaneCount = audioLanes.size ? Math.max(...audioLanes.values()) + 1 : 1;
  const sceneLaneCount = sceneLanes.size ? Math.max(...sceneLanes.values()) + 1 : 1;
  const elemRowH = Math.max(48, elemLaneCount * ELEM_LANE_H + 8);
  const audioRowH = Math.max(44, audioLaneCount * LANE_H + 8);
  const sceneRowH = Math.max(56, sceneLaneCount * 50 + 8);

  const totalSec = Math.max(projectTotalDurationSec(project), 5);
  const contentWidth = Math.max(totalSec * pps, 400);
  const playheadLeft = playheadSec * pps;
  const zoomPct = Math.round((pps / DEFAULT_PPS) * 100);

  const clampSec = useCallback(
    (sec: number) => Math.max(0, Math.min(totalSec, sec)),
    [totalSec],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const scrollEl = scrollRef.current;
      const contentEl = contentRef.current;
      if (!scrollEl || !contentEl) return;
      const rect = contentEl.getBoundingClientRect();
      const x = clientX - rect.left + scrollEl.scrollLeft;
      onSetPlayhead(clampSec(x / pps));
    },
    [clampSec, onSetPlayhead, pps],
  );

  useEffect(() => {
    if (!itemDrag) return;
    const thresholdSec = SNAP_PX / pps;
    const apply = (startSec: number, durationSec: number, guide: number | null) => {
      setSnapGuide(guide);
      if (itemDrag.mode === 'move' && itemDrag.mates) {
        const delta = startSec - itemDrag.origStart;
        onMoveSelectionStarts({
          elements: itemDrag.mates.elements.map((m) => ({
            id: m.id,
            startSec: Math.max(0, m.origStart + delta),
          })),
          clips: itemDrag.mates.clips.map((m) => ({
            id: m.id,
            startSec: Math.max(0, m.origStart + delta),
          })),
          scenes: itemDrag.mates.scenes.map((m) => ({
            id: m.id,
            startSec: Math.max(0, m.origStart + delta),
          })),
        });
        return;
      }
      if (itemDrag.kind === 'element') {
        onUpdateElement(itemDrag.id, { startSec, durationSec });
      } else if (itemDrag.kind === 'scene') {
        if (itemDrag.mode === 'move') onMoveScene(itemDrag.id, startSec);
        else if (itemDrag.mode === 'resize-right') onUpdateSceneDuration(itemDrag.id, durationSec);
        else onTrimSceneLeft(itemDrag.id, startSec);
      } else {
        onUpdateClip(itemDrag.id, { startSec, durationSec });
      }
    };
    const onMove = (e: PointerEvent) => {
      const targets = collectSnapTimes(projectRef.current, playheadRef.current, {
        kind: itemDrag.kind,
        id: itemDrag.id,
        ignoreElementIds: [
          ...(itemDrag.ignoreElementIds ?? []),
          ...(itemDrag.mates?.elements.map((m) => m.id) ?? []),
        ],
        ignoreClipIds: [
          ...(itemDrag.ignoreClipIds ?? []),
          ...(itemDrag.mates?.clips.map((m) => m.id) ?? []),
        ],
      });
      const dx = (e.clientX - itemDrag.startX) / pps;
      const dy = e.clientY - itemDrag.startY;
      const moved = itemDrag.moved || Math.hypot(e.clientX - itemDrag.startX, dy) > 3;
      if (!moved && itemDrag.mode === 'move') return;
      if (!itemDrag.moved) setItemDrag({ ...itemDrag, moved: true });
      if (
        itemDrag.mode === 'move' &&
        itemDrag.kind === 'element' &&
        !itemDrag.mates &&
        Math.abs(dy) > Math.abs(e.clientX - itemDrag.startX) &&
        Math.abs(dy) > 8
      ) {
        const maxLane = Math.max(0, elemsFrontToBack.length - 1);
        const newLane = Math.max(0, Math.min(maxLane, itemDrag.origLane + Math.round(dy / ELEM_LANE_H)));
        if (newLane !== itemDrag.origLane) {
          const ids = elemsFrontToBack.map((el) => el.id);
          const from = ids.indexOf(itemDrag.id);
          if (from >= 0) {
            ids.splice(from, 1);
            ids.splice(newLane, 0, itemDrag.id);
            onReorderLayers(ids);
            setItemDrag({ ...itemDrag, origLane: newLane, startY: e.clientY, moved: true });
          }
        }
        return;
      }
      const origEnd = itemDrag.origStart + itemDrag.origDur;
      if (itemDrag.mode === 'move') {
        const snapped = snapMove(itemDrag.origStart + dx, itemDrag.origDur, targets, thresholdSec);
        apply(snapped.start, itemDrag.origDur, snapped.guide);
        return;
      }
      if (itemDrag.mode === 'resize-right') {
        const rawEnd = origEnd + dx;
        const snapped = snapTime(rawEnd, targets, thresholdSec);
        const durationSec = Math.max(0.5, snapped.value - itemDrag.origStart);
        apply(itemDrag.origStart, durationSec, snapped.guide);
        return;
      }
      const rawStart = itemDrag.origStart + dx;
      const snapped = snapTime(rawStart, targets, thresholdSec);
      let startSec = Math.max(0, snapped.value);
      let durationSec = origEnd - startSec;
      if (durationSec < 0.5) {
        durationSec = 0.5;
        startSec = Math.max(0, origEnd - 0.5);
      }
      apply(startSec, durationSec, snapped.guide);
    };
    const onUp = () => {
      setItemDrag(null);
      setSnapGuide(null);
      useVideoEditorStore.getState().endHistoryGesture();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [
    itemDrag,
    onUpdateElement,
    onUpdateSceneDuration,
    onMoveScene,
    onTrimSceneLeft,
    onUpdateClip,
    onMoveSelectionStarts,
    onReorderLayers,
    pps,
    elemsFrontToBack,
  ]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => seekFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, seekFromClientX]);

  const toContent = (clientX: number, clientY: number) => {
    const contentEl = contentRef.current;
    if (!contentEl) return { x: 0, y: 0 };
    const rect = contentEl.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const hitsInBox = (box: Box) => {
    const layerIds: string[] = [];
    const clipIds: string[] = [];
    const sceneIds: string[] = [];
    const elemTop = RULER_H;
    const sceneTop = RULER_H + elemRowH;
    const audioTop = sceneTop + sceneRowH;
    for (const layer of elems) {
      const b: Box = {
        x: layer.startSec * pps,
        y: elemTop + 4 + (elemLanes.get(layer.id) ?? 0) * ELEM_LANE_H,
        w: Math.max(layer.durationSec * pps, 28),
        h: ELEM_LANE_H - 6,
      };
      if (boxesOverlap(box, b)) layerIds.push(layer.id);
    }
    for (const scene of project.scenes) {
      const start = starts.get(scene.id) ?? scene.startSec ?? 0;
      const b: Box = {
        x: start * pps,
        y: sceneTop + 4 + (sceneLanes.get(scene.id) ?? 0) * SCENE_BLOCK_H,
        w: Math.max(scene.durationSec * pps, 48),
        h: 46,
      };
      if (boxesOverlap(box, b)) sceneIds.push(scene.id);
    }
    for (const clip of audioTrack.clips) {
      const b: Box = {
        x: clip.startSec * pps,
        y: audioTop + 4 + (audioLanes.get(clip.id) ?? 0) * LANE_H,
        w: Math.max(clip.durationSec * pps, 20),
        h: LANE_H - 4,
      };
      if (boxesOverlap(box, b)) clipIds.push(clip.id);
    }
    return { layerIds, clipIds, sceneIds };
  };

  const snapshotMates = (dragKind: SnapKind, dragId: string, dragStart: number) => {
    const sceneSet = new Set(selectedSceneIds);
    const windows = project.scenes
      .filter((s) => sceneSet.has(s.id))
      .map((s) => ({ start: starts.get(s.id) ?? s.startSec ?? 0, dur: s.durationSec }));
    const nested = (start: number) =>
      windows.some((w) => itemBelongsToSceneWindow(start, w.start, w.dur));
    const mates = {
      elements: elems
        .filter((el) => selectedLayerIds.includes(el.id) && !nested(el.startSec))
        .map((el) => ({ id: el.id, origStart: el.startSec })),
      clips: audioTrack.clips
        .filter((c) => selectedClipIds.includes(c.id) && !nested(c.startSec))
        .map((c) => ({ id: c.id, origStart: c.startSec })),
      scenes: project.scenes
        .filter((s) => sceneSet.has(s.id))
        .map((s) => ({ id: s.id, origStart: starts.get(s.id) ?? s.startSec ?? 0 })),
    };
    if (dragKind === 'element' && !mates.elements.some((m) => m.id === dragId)) {
      mates.elements.push({ id: dragId, origStart: dragStart });
    }
    if (dragKind === 'clip' && !mates.clips.some((m) => m.id === dragId)) {
      mates.clips.push({ id: dragId, origStart: dragStart });
    }
    if (dragKind === 'scene' && !mates.scenes.some((m) => m.id === dragId)) {
      mates.scenes.push({ id: dragId, origStart: dragStart });
    }
    const n = mates.elements.length + mates.clips.length + mates.scenes.length;
    return n > 1 ? mates : undefined;
  };

  const selectionSize = selectedLayerIds.length + selectedClipIds.length + selectedSceneIds.length;

  useEffect(() => {
    if (!marquee) return;
    const origin = { x0: marquee.x0, y0: marquee.y0 };
    const onMove = (e: PointerEvent) => {
      const p = toContent(e.clientX, e.clientY);
      setMarquee({ x0: origin.x0, y0: origin.y0, x1: p.x, y1: p.y });
    };
    const onUp = (e: PointerEvent) => {
      setMarquee(null);
      const p = toContent(e.clientX, e.clientY);
      const dx = p.x - origin.x0;
      const dy = p.y - origin.y0;
      if (Math.hypot(dx, dy) < 6) {
        onSelectLayer(null);
        onSelectClip(null);
        onSelectScene(null);
        seekFromClientX(e.clientX);
        return;
      }
      const box: Box = {
        x: Math.min(origin.x0, p.x),
        y: Math.min(origin.y0, p.y),
        w: Math.abs(p.x - origin.x0),
        h: Math.abs(p.y - origin.y0),
      };
      onSetTimelineSelection(hitsInBox(box));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // so liga quando a caixa nasce/some; o origin fica no closure
  }, [marquee != null]);

  const onTimelinePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-seek]')) return;
    const p = toContent(e.clientX, e.clientY);
    if (p.y < RULER_H) {
      seekFromClientX(e.clientX);
      setDragging(true);
      return;
    }
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onWheel = useCallback(
    (e: WheelEvent) => {
      const scrollEl = scrollRef.current;
      const contentEl = contentRef.current;
      if (!scrollEl || !contentEl) return;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = contentEl.getBoundingClientRect();
        const cursorX = e.clientX - rect.left + scrollEl.scrollLeft;
        const cursorSec = cursorX / pps;
        const factor = e.deltaY > 0 ? 0.88 : 1.14;
        const nextPps = Math.min(MAX_PPS, Math.max(MIN_PPS, pps * factor));
        setPps(nextPps);
        requestAnimationFrame(() => {
          scrollEl.scrollLeft = Math.max(0, cursorSec * nextPps - (e.clientX - rect.left));
        });
        return;
      }

      const dy = e.deltaY;
      const dx = e.deltaX;
      if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
        scrollEl.scrollLeft += e.shiftKey ? dy : dx || dy;
      }
    },
    [pps],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const sceneBlock = (scene: VideoScene) => {
    const left = (starts.get(scene.id) ?? 0) * pps;
    const w = Math.max(scene.durationSec * pps, 48);
    const active = selectedSceneIds.includes(scene.id) || scene.id === activeSceneId;
    const lane = sceneLanes.get(scene.id) ?? 0;
    return (
      <div
        key={scene.id}
        data-no-seek
        className={
          'absolute rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing group ' +
          (active
            ? 'border-violet-400 bg-violet-600/35 ring-1 ring-violet-400/50'
            : 'border-neutral-600 bg-neutral-800 hover:border-neutral-400')
        }
        style={{ left, width: w, top: 4 + lane * 50, height: 46 }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          const additive = e.shiftKey || e.ctrlKey || e.metaKey;
          const keepGroup = !additive && selectedSceneIds.includes(scene.id) && selectionSize > 1;
          if (additive) onToggleScene(scene.id);
          else if (!keepGroup) onSelectScene(scene.id);
          const origStart = starts.get(scene.id) ?? scene.startSec ?? 0;
          beginItemDrag({
            kind: 'scene',
            id: scene.id,
            mode: 'move',
            startX: e.clientX,
            startY: e.clientY,
            origLane: 0,
            origStart,
            origDur: scene.durationSec,
            moved: false,
            ignoreElementIds: elems
              .filter((el) => itemBelongsToSceneWindow(el.startSec, origStart, scene.durationSec))
              .map((el) => el.id),
            ignoreClipIds: audioTrack.clips
              .filter((c) => itemBelongsToSceneWindow(c.startSec, origStart, scene.durationSec))
              .map((c) => c.id),
            mates: keepGroup ? snapshotMates('scene', scene.id, origStart) : undefined,
          });
        }}
      >
        <div className="h-full flex flex-col items-center justify-center text-xs px-2 pointer-events-none">
          {scene.backgroundSrc ? (
            <ImageIcon size={16} className="text-violet-300 mb-0.5" />
          ) : (
            <Plus size={16} className="text-neutral-500 mb-0.5" />
          )}
          <span className="text-neutral-200 font-medium truncate w-full text-center">Fundo</span>
          <span className="text-[10px] text-neutral-400 tabular-nums">
            {scene.durationSec.toFixed(1)}s
          </span>
        </div>
        {project.scenes.length > 1 && (
          <button
            type="button"
            className="absolute top-0.5 left-1/2 -translate-x-1/2 p-0.5 rounded bg-black/50 text-red-300 opacity-0 group-hover:opacity-100 z-20 cursor-pointer pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveScene(scene.id);
            }}
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>
    );
  };

  const sceneResizeHandles = () =>
    project.scenes.map((scene) => {
      const left = (starts.get(scene.id) ?? 0) * pps;
      const w = Math.max(scene.durationSec * pps, 48);
      const active = scene.id === activeSceneId;
      const lane = sceneLanes.get(scene.id) ?? 0;
      const top = 4 + lane * 50;
      const beginDrag = (e: React.PointerEvent, mode: DragMode) => {
        e.stopPropagation();
        e.preventDefault();
        onSelectScene(scene.id);
        const origStart = starts.get(scene.id) ?? scene.startSec ?? 0;
        beginItemDrag({
          kind: 'scene',
          id: scene.id,
          mode,
          startX: e.clientX,
          startY: e.clientY,
          origLane: 0,
          origStart,
          origDur: scene.durationSec,
          moved: true,
          ignoreElementIds: elems
            .filter((el) => itemBelongsToSceneWindow(el.startSec, origStart, scene.durationSec))
            .map((el) => el.id),
          ignoreClipIds: audioTrack.clips
            .filter((c) => itemBelongsToSceneWindow(c.startSec, origStart, scene.durationSec))
            .map((c) => c.id),
        });
      };
      return (
        <div key={'resize-' + scene.id}>
          <div
            className="absolute z-40 overflow-hidden rounded-l-[calc(0.5rem-2px)]"
            style={{ left, width: 12, top, height: 46 }}
          >
            <ResizeHandle
              side="left"
              selected={active}
              className="left-0 right-0 w-full rounded-l-[calc(0.5rem-2px)]"
              onPointerDown={(e) => beginDrag(e, 'resize-left')}
            />
          </div>
          <div
            className="absolute z-40 overflow-hidden rounded-r-[calc(0.5rem-2px)]"
            style={{ left: left + w - 12, width: 12, top, height: 46 }}
          >
            <ResizeHandle
              side="right"
              selected={active}
              className="left-0 right-0 w-full rounded-r-[calc(0.5rem-2px)]"
              onPointerDown={(e) => beginDrag(e, 'resize-right')}
            />
          </div>
        </div>
      );
    });

  const addFundoLeft = totalSec * pps + 8;
  const step = rulerStep(pps);
  const marks: number[] = [];
  for (let t = 0; t <= totalSec + step; t += step) marks.push(t);

  const startPlayheadDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDragging(true);
  };

  const Playhead = () => (
    <div
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: playheadLeft, transform: 'translateX(-50%)' }}
    >
      <div
        className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-auto cursor-ew-resize"
        data-no-seek
        onPointerDown={startPlayheadDrag}
      >
        <div className="px-2 py-0.5 rounded-md bg-neutral-700 border border-neutral-500 text-[11px] font-medium text-white whitespace-nowrap shadow-lg tabular-nums">
          {fmtPlayhead(playheadSec)}
        </div>
        <div className="mx-auto w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-neutral-600" />
      </div>
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.45)]" />
      <div
        className="absolute top-5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-white border border-neutral-400 pointer-events-auto cursor-ew-resize"
        data-no-seek
        onPointerDown={startPlayheadDrag}
      />
    </div>
  );

  return (
    <div
      className="shrink-0 flex flex-col bg-[#141414] border-t border-neutral-800 text-neutral-100 select-none min-h-0"
      style={{ height: heightPx }}
    >
      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 overflow-auto overscroll-contain tl-scroll ${dragging ? 'tl-dragging' : ''}`}
        onPointerDown={onTimelinePointerDown}
      >
        <div ref={contentRef} className="relative pb-8" style={{ width: contentWidth + 56 }}>
            <Playhead />
            {marquee && (
              <div
                className="absolute z-50 pointer-events-none rounded-sm border border-violet-400 bg-violet-500/20"
                style={{
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.max(1, Math.abs(marquee.x1 - marquee.x0)),
                  height: Math.max(1, Math.abs(marquee.y1 - marquee.y0)),
                }}
              />
            )}
            {snapGuide != null && (
              <div
                className="absolute top-0 bottom-0 z-40 pointer-events-none"
                style={{ left: snapGuide * pps, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-neutral-800 border border-pink-400 text-[10px] font-medium text-pink-300 whitespace-nowrap tabular-nums shadow">
                  {fmtPlayhead(snapGuide)}
                </div>
                <div
                  className="absolute top-6 bottom-0 left-1/2 -translate-x-1/2 w-0 border-l border-dashed border-pink-400"
                  style={{ boxShadow: '0 0 6px rgba(244,114,182,0.55)' }}
                />
              </div>
            )}

            <div className="sticky top-0 z-20 relative h-7 bg-neutral-900 border-b border-neutral-800" data-tl-ruler>
              {marks.map((t) => (
                <div key={t} className="absolute top-0 h-full pointer-events-none" style={{ left: t * pps }}>
                  <div className="w-px h-2.5 bg-neutral-600" />
                  <span className="absolute top-2.5 left-1 text-[10px] text-neutral-500 tabular-nums">
                    {t >= 60 ? fmtTime(t) : `${t}s`}
                  </span>
                </div>
              ))}
            </div>

            {/* Elementos: hint só se vazio */}
            <div className="relative border-b border-neutral-800 bg-neutral-900/40" style={{ height: elemRowH }}>
              {elems.length === 0 && (
                <EmptyTrackHint>
                  <Layers size={14} className="text-neutral-600" />
                  Adicionar elementos
                </EmptyTrackHint>
              )}
              {elems.map((layer) => {
                const selected = selectedLayerIds.includes(layer.id) || layer.id === selectedLayerId;
                const left = layer.startSec * pps;
                const w = Math.max(layer.durationSec * pps, 28);
                const lane = elemLanes.get(layer.id) ?? 0;
                return (
                  <div
                    key={layer.id}
                    data-no-seek
                    className={
                      'absolute rounded-md overflow-hidden flex items-center gap-1 pl-3.5 pr-3.5 text-[11px] border cursor-grab active:cursor-grabbing ' +
                      (selected
                        ? 'bg-violet-600 border-violet-300 text-white shadow-[0_0_0_1px_rgba(167,139,250,0.6)]'
                        : 'bg-neutral-800 border-neutral-600 text-neutral-300 hover:border-neutral-400')
                    }
                    style={{ left, width: w, top: 4 + lane * ELEM_LANE_H, height: ELEM_LANE_H - 6 }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
                      const keepGroup = !additive && selectedLayerIds.includes(layer.id) && selectionSize > 1;
                      if (additive) onToggleLayer(layer.id);
                      else if (!keepGroup) onSelectLayer(layer.id);
                      beginItemDrag({
                        kind: 'element',
                        id: layer.id,
                        mode: 'move',
                          startX: e.clientX,
                          startY: e.clientY,
                          origLane: elemLanes.get(layer.id) ?? 0,
                        origStart: layer.startSec,
                        origDur: layer.durationSec,
                        moved: false,
                        mates: keepGroup ? snapshotMates('element', layer.id, layer.startSec) : undefined,
                      });
                    }}
                  >
                    <ResizeHandle
                      side="left"
                      selected={selected}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onSelectLayer(layer.id);
                        beginItemDrag({
                          kind: 'element',
                          id: layer.id,
                          mode: 'resize-left',
                          startX: e.clientX,
                          startY: e.clientY,
                          origLane: elemLanes.get(layer.id) ?? 0,
                          origStart: layer.startSec,
                          origDur: layer.durationSec,
                          moved: true,
                        });
                      }}
                    />
                    {layerIcon(layer)}
                    <span className="truncate flex-1 min-w-0">
                      {layer.type === 'text' ? layer.text : 'Imagem'}
                    </span>
                    <button
                      type="button"
                      className="text-red-300 hover:text-red-200 shrink-0 z-20"
                      title="Excluir"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveElement(layer.id);
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                    <ResizeHandle
                      side="right"
                      selected={selected}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onSelectLayer(layer.id);
                        beginItemDrag({
                          kind: 'element',
                          id: layer.id,
                          mode: 'resize-right',
                          startX: e.clientX,
                          startY: e.clientY,
                          origLane: elemLanes.get(layer.id) ?? 0,
                          origStart: layer.startSec,
                          origDur: layer.durationSec,
                          moved: true,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Fundo: blocos + resize; gaps por cima no hover (z-50) pra botões clicáveis */}
            <div className="relative border-b border-neutral-800 bg-neutral-900/60" style={{ height: sceneRowH }}>
              {project.scenes.map((s) => sceneBlock(s))}
              {sceneResizeHandles()}
              {(() => {
                const ordered = scenesByTime(project);
                return ordered.slice(0, -1).map((s, i) => {
                  const following = ordered[i + 1];
                  if (!following) return null;
                  const boundary = (starts.get(following.id) ?? 0) * pps;
                  return (
                    <SceneGap
                      key={'gap-' + s.id}
                      left={boundary}
                      hasTransition={hasSceneTransition(s)}
                      isEditing={editingTransitionSceneId === s.id}
                      onInsert={() => onInsertSceneAfter(s.id)}
                      onTransition={() => onEditTransition(s.id)}
                    />
                  );
                });
              })()}
              <button
                type="button"
                data-no-seek
                className="absolute top-2 bottom-2 w-10 rounded-lg border-2 border-dashed border-neutral-600 hover:border-violet-400 hover:bg-violet-600/10 flex items-center justify-center text-neutral-500 hover:text-violet-300 cursor-pointer"
                style={{ left: addFundoLeft }}
                title="Novo fundo"
                onClick={(e) => { e.stopPropagation(); onAddScene(); }}
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Áudio: hint só se vazio */}
            <div className="relative border-b border-neutral-800 bg-neutral-900/50" style={{ height: audioRowH }}>
              {audioTrack.clips.length === 0 && (
                <EmptyTrackHint>
                  <Music size={14} className="text-neutral-600" />
                  Adicionar áudio
                </EmptyTrackHint>
              )}
              {audioTrack.clips.map((clip) => {
                const left = clip.startSec * pps;
                const clipW = Math.max(clip.durationSec * pps, 20);
                const selected = selectedClipIds.includes(clip.id) || clip.id === selectedClipId;
                const lane = audioLanes.get(clip.id) ?? 0;
                return (
                  <div
                    key={clip.id}
                    data-no-seek
                    className={`absolute rounded-md overflow-hidden border pl-3.5 pr-3.5 flex items-center gap-1 text-[11px] cursor-grab active:cursor-grabbing ${
                      selected
                        ? 'bg-violet-600/60 border-violet-300 text-white'
                        : 'bg-violet-900/50 border-violet-700 text-violet-100 hover:border-violet-500'
                    }`}
                    style={{ left, width: clipW, top: 4 + lane * LANE_H, height: LANE_H - 4 }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
                      const keepGroup = !additive && selectedClipIds.includes(clip.id) && selectionSize > 1;
                      if (additive) onToggleClip(clip.id);
                      else if (!keepGroup) onSelectClip(clip.id);
                      beginItemDrag({
                        kind: 'clip',
                        id: clip.id,
                        mode: 'move',
                          startX: e.clientX,
                          startY: e.clientY,
                          origLane: 0,
                        origStart: clip.startSec,
                        origDur: clip.durationSec,
                        moved: false,
                        mates: keepGroup ? snapshotMates('clip', clip.id, clip.startSec) : undefined,
                      });
                    }}
                  >
                    <ResizeHandle
                      side="left"
                      selected={selected}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onSelectClip(clip.id);
                        beginItemDrag({
                          kind: 'clip',
                          id: clip.id,
                          mode: 'resize-left',
                          startX: e.clientX,
                          startY: e.clientY,
                          origLane: 0,
                          origStart: clip.startSec,
                          origDur: clip.durationSec,
                          moved: true,
                        });
                      }}
                    />
                    <Music size={10} className="shrink-0" />
                    <span className="truncate flex-1">{clip.label || 'Áudio'}</span>
                    <button
                      type="button"
                      className="text-red-300 hover:text-red-200 shrink-0 z-20"
                      onClick={(e) => { e.stopPropagation(); onRemoveAudioClip(clip.id); }}
                    >
                      <Trash2 size={10} />
                    </button>
                    <ResizeHandle
                      side="right"
                      selected={selected}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onSelectClip(clip.id);
                        beginItemDrag({
                          kind: 'clip',
                          id: clip.id,
                          mode: 'resize-right',
                          startX: e.clientX,
                          startY: e.clientY,
                          origLane: 0,
                          origStart: clip.startSec,
                          origDur: clip.durationSec,
                          moved: true,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 pr-24 border-t border-neutral-800 bg-neutral-950 text-xs text-neutral-500">
        <span className="tabular-nums">{fmtTime(playheadSec)} / {fmtTime(totalSec)}</span>
        <div className="flex items-center gap-2 mr-2">
          <button type="button" className="p-1 rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer" onClick={() => setPps((z) => Math.max(MIN_PPS, z * 0.85))}>
            <Minus size={14} />
          </button>
          <input type="range" min={MIN_PPS} max={MAX_PPS} step={1} value={pps} onChange={(e) => setPps(Number(e.target.value))} className="w-28 h-1 accent-violet-500 cursor-pointer" />
          <button type="button" className="p-1 rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer" onClick={() => setPps((z) => Math.min(MAX_PPS, z * 1.15))}>
            <Plus size={14} />
          </button>
          <span className="w-10 text-right tabular-nums text-neutral-400">{zoomPct}%</span>
        </div>
      </div>

      <style>{`.tl-scroll { cursor: crosshair; } .tl-dragging { cursor: ew-resize; }`}</style>
    </div>
  );
};
