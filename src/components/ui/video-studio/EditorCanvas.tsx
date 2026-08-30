import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Rect, Group, Line } from 'react-konva';
import type Konva from 'konva';
import type { Layer as ProjectLayer } from '../../../types/video-project';
import { PROJECT_HEIGHT, PROJECT_WIDTH, cornerRadiusPx, strokeWidthPx } from '../../../types/video-project';
import { getElementAnimTransform } from '../../../lib/element-animations';
import { effectKonvaProps } from '../../../lib/element-effects';
import { isVideoSrc } from '../../../lib/video-assets';
import { layerBox, snapLayerDrag, type GuideLine } from '../../../lib/canvas-guides';
import { readZenithImageDrag, ZENITH_IMAGE_DRAG } from '../../../lib/canvas-image-drag';

type TransitionBackground = {
  fromColor: string;
  fromSrc?: string;
  fromOpacity: number;
  toColor: string;
  toSrc?: string;
  toOpacity: number;
};

type EditorCanvasProps = {
  layers: ProjectLayer[];
  sceneId: string | null;
  backgroundSrc?: string;
  backgroundColor?: string;
  /** Crossfade de fundos durante Combinar */
  transitionBackground?: TransitionBackground | null;
  selectedLayerId: string | null;
  selectedLayerIds?: string[];
  selectedSceneId: string | null;
  playheadSec: number;
  onSelectLayer: (id: string | null) => void;
  onSelectScene: (id: string) => void;
  onUpdateLayer: (id: string, patch: Partial<ProjectLayer>) => void;
  onReplaceImageSrc?: (layerId: string, src: string) => void;
  onDropAddImage?: (src: string, durationSec?: number) => void;
  resolveImageUrl: (src: string) => string;
  stylePaintArmed?: boolean;
};

const stopBubble = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
  e.cancelBubble = true;
};

const BackgroundVisual = ({
  color,
  src,
  opacity = 1,
  resolveImageUrl,
}: {
  color: string;
  src?: string;
  opacity?: number;
  resolveImageUrl: (s: string) => string;
}) => {
  const url = src ? resolveImageUrl(src) : '';
  const image = useImage(url);
  if (image) {
    return (
      <KonvaImage
        x={0}
        y={0}
        width={PROJECT_WIDTH}
        height={PROJECT_HEIGHT}
        image={image}
        opacity={opacity}
        listening={false}
      />
    );
  }
  return (
    <Rect
      x={0}
      y={0}
      width={PROJECT_WIDTH}
      height={PROJECT_HEIGHT}
      fill={color}
      opacity={opacity}
      listening={false}
    />
  );
};

const useImage = (url: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    // /personagem e /sfx sao same-origin. crossOrigin sem header CORS tinge o canvas e o Konva perde o clique.
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);
  return image;
};

const useLayerMedia = (url: string, playheadSec: number, startSec: number) => {
  const videoMode = isVideoSrc(url);
  const image = useImage(videoMode ? '' : url);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoMode || !url) {
      setVideo(null);
      return;
    }
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      v.crossOrigin = 'anonymous';
    }
    const onReady = () => setVideo(v);
    v.addEventListener('loadeddata', onReady);
    v.src = url;
    return () => {
      v.removeEventListener('loadeddata', onReady);
      v.pause();
      v.src = '';
      setVideo(null);
    };
  }, [url, videoMode]);

  useEffect(() => {
    if (!video) return;
    const t = Math.max(0, playheadSec - startSec);
    const dur = Number.isFinite(video.duration) ? video.duration : t;
    const next = Math.min(t, Math.max(0, dur - 0.04));
    if (Math.abs(video.currentTime - next) > 0.05) {
      video.currentTime = next;
    }
  }, [video, playheadSec, startSec]);

  return videoMode ? video : image;
};

const bboxHit =
  (w: number, h: number) =>
  (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.closePath();
    ctx.fillStrokeShape(shape);
  };

const nodeNameFor = (id: string) => `el-${id.replace(/:/g, '_')}`;

const realLayerId = (id: string) =>
  id.startsWith('match:') ? id.split(':')[1] || id : id;

const ALPHA_MIN = 12;
const alphaProbe = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (alphaProbe) {
  alphaProbe.width = 1;
  alphaProbe.height = 1;
}
const alphaCtx = alphaProbe?.getContext('2d', { willReadFrequently: true }) ?? null;

const sampleImageAlpha = (
  img: HTMLImageElement,
  localX: number,
  localY: number,
  w: number,
  h: number,
) => {
  if (!alphaCtx || w <= 0 || h <= 0 || !img.naturalWidth) return 255;
  const sx = Math.min(img.naturalWidth - 1, Math.max(0, (localX / w) * img.naturalWidth));
  const sy = Math.min(img.naturalHeight - 1, Math.max(0, (localY / h) * img.naturalHeight));
  try {
    alphaCtx.clearRect(0, 0, 1, 1);
    alphaCtx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
    return alphaCtx.getImageData(0, 0, 1, 1).data[3] ?? 255;
  } catch {
    return 255;
  }
};

const isTransformerAnchor = (node: Konva.Node | null) => {
  let n: Konva.Node | null = node;
  while (n) {
    if (n.getClassName() === 'Transformer') {
      return /anchor/i.test(node.name() || '');
    }
    n = n.getParent();
  }
  return false;
};

const pickTopLayerId = (stage: Konva.Stage, layers: ProjectLayer[]): string | null => {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const expected = nodeNameFor(layer.id);
    const node = stage.findOne((n: Konva.Node) => n.name() === expected);
    if (!node || !node.visible() || node.opacity() < 0.05) continue;
    const local = node.getAbsoluteTransform().copy().invert().point(pos);
    if (layer.type === 'image') {
      if (local.x < 0 || local.y < 0 || local.x > layer.w || local.y > layer.h) continue;
      const imgNode =
        node.getClassName() === 'Group'
          ? ((node as Konva.Group).findOne('Image') as Konva.Image | undefined)
          : undefined;
      const img = imgNode?.image() as CanvasImageSource | undefined;
      const src = img instanceof HTMLImageElement ? img.src : '';
      const isSvg = src.startsWith('data:image/svg') || src.includes('.svg');
      // PNG/personagem: pixel transparente furar. SVG/forma: bbox inteiro (sample 1x1 no SVG volta alpha 0).
      if (!isSvg && img instanceof HTMLImageElement && img.naturalWidth > 0) {
        if (sampleImageAlpha(img, local.x, local.y, layer.w, layer.h) < ALPHA_MIN) continue;
      }
  return realLayerId(layer.id);
    }
    const box = node.getClientRect({ skipShadow: true });
    const pad = 10;
    if (
      pos.x >= box.x - pad &&
      pos.x <= box.x + box.width + pad &&
      pos.y >= box.y - pad &&
      pos.y <= box.y + box.height + pad
    ) {
      return realLayerId(layer.id);
    }
  }
  return null;
};

/** Soltar da biblioteca: usa a caixa inteira (sem furar alpha) pra ser facil trocar o personagem. */
const pickTopImageLayerForDrop = (stage: Konva.Stage, layers: ProjectLayer[]): string | null => {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.type !== 'image' || layer.id.startsWith('match:')) continue;
    const node = stage.findOne((n: Konva.Node) => n.name() === nodeNameFor(layer.id));
    if (!node || !node.visible()) continue;
    const local = node.getAbsoluteTransform().copy().invert().point(pos);
    if (local.x < 0 || local.y < 0 || local.x > layer.w || local.y > layer.h) continue;
    return layer.id;
  }
  return null;
};

const useTransformer = (
  isSelected: boolean,
  shapeRef: React.RefObject<Konva.Node | null>,
  trRef: React.RefObject<Konva.Transformer | null>,
  deps: unknown[] = [],
) => {
  useEffect(() => {
    if (!isSelected) {
      trRef.current?.nodes([]);
      return;
    }
    const attach = () => {
      const shape = shapeRef.current;
      const tr = trRef.current;
      if (!shape || !tr) return;
      tr.nodes([shape]);
      tr.getLayer()?.batchDraw();
    };
    attach();
    const id = requestAnimationFrame(attach);
    return () => cancelAnimationFrame(id);
  }, [isSelected, shapeRef, trRef, ...deps]);
};

const ImageLayerNode = ({
  layer,
  isSelected,
  playheadSec,
  interactive = true,
  draggable,
  onChange,
  resolveImageUrl,
  posOverride,
}: {
  layer: Extract<ProjectLayer, { type: 'image' }>;
  isSelected: boolean;
  playheadSec: number;
  interactive?: boolean;
  draggable?: boolean;
  onChange: (patch: Partial<ProjectLayer>) => void;
  resolveImageUrl: (src: string) => string;
  posOverride?: { x: number; y: number } | null;
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const url = resolveImageUrl(layer.src);
  const image = useLayerMedia(url, playheadSec, layer.startSec);
  const canDrag = draggable ?? interactive;

  useEffect(() => {
    groupRef.current?.getLayer()?.batchDraw();
  }, [image, playheadSec]);

  const localT =
    layer.durationSec > 0
      ? Math.min(1, Math.max(0, (playheadSec - layer.startSec) / layer.durationSec))
      : 0;
  const anim = getElementAnimTransform(layer.animation, localT);
  const fx = effectKonvaProps(layer.effect, playheadSec);

  const radius = cornerRadiusPx(layer.w, layer.h, layer.cornerRadius);
  const borderW = strokeWidthPx(layer.w, layer.h, layer.borderWidth);
  const fill =
    layer.fillColor && layer.fillColor !== 'transparent' ? layer.fillColor : undefined;

  useTransformer(isSelected, groupRef, trRef, [
    image,
    layer.w,
    layer.h,
    layer.x,
    layer.y,
    layer.flipX,
    layer.cornerRadius,
    layer.borderWidth,
    anim.scale,
    anim.rotation,
  ]);

  const commitTransform = () => {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: node.x(),
      y: node.y(),
      w: Math.max(20, layer.w * scaleX),
      h: Math.max(20, layer.h * scaleY),
      rotation: node.rotation(),
    });
  };

  const baseOpacity = (layer.opacity ?? 1) * anim.opacity;
  const clipFunc =
    radius > 0
      ? (ctx: Konva.Context) => {
          const w = layer.w;
          const h = layer.h;
          const r = Math.min(radius, w / 2, h / 2);
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(w - r, 0);
          ctx.quadraticCurveTo(w, 0, w, r);
          ctx.lineTo(w, h - r);
          ctx.quadraticCurveTo(w, h, w - r, h);
          ctx.lineTo(r, h);
          ctx.quadraticCurveTo(0, h, 0, h - r);
          ctx.lineTo(0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.closePath();
        }
      : undefined;

  return (
    <>
      <Group
        ref={groupRef}
        name={nodeNameFor(layer.id)}
        x={(posOverride?.x ?? layer.x) + (layer.flipX ? layer.w : 0) * anim.scale + anim.offsetX + (fx.offsetX ?? 0)}
        y={(posOverride?.y ?? layer.y) + anim.offsetY}
        rotation={(layer.rotation ?? 0) + anim.rotation}
        scaleX={anim.scale * (layer.flipX ? -1 : 1)}
        scaleY={anim.scale}
        opacity={baseOpacity * (fx.opacity ?? 1)}
        draggable={false}
        listening={interactive}
        clipFunc={clipFunc}
        onTransformEnd={canDrag ? commitTransform : undefined}
      >
        <Rect
          x={0}
          y={0}
          width={layer.w}
          height={layer.h}
          fill="rgba(0,0,0,0.001)"
          listening={interactive}
          hitFunc={bboxHit(layer.w, layer.h)}
        />
        {fill && (
          <Rect x={0} y={0} width={layer.w} height={layer.h} fill={fill} cornerRadius={radius} listening={false} />
        )}
        {image ? (
          <KonvaImage
            x={0}
            y={0}
            width={layer.w}
            height={layer.h}
            image={image}
            listening={interactive}
            hitFunc={bboxHit(layer.w, layer.h)}
            shadowBlur={fx.shadowBlur}
            shadowColor={fx.shadowColor}
            shadowOpacity={fx.shadowOpacity}
            shadowOffsetX={fx.shadowOffsetX}
            shadowOffsetY={fx.shadowOffsetY}
          />
        ) : (
          <Rect
            x={0}
            y={0}
            width={layer.w}
            height={layer.h}
            fill="#d1d5db"
            stroke="#9ca3af"
            strokeWidth={2}
            dash={[8, 4]}
            listening={interactive}
            hitFunc={bboxHit(layer.w, layer.h)}
          />
        )}
        {borderW > 0 && (
          <Rect
            x={0}
            y={0}
            width={layer.w}
            height={layer.h}
            stroke={layer.borderColor ?? '#ffffff'}
            strokeWidth={borderW}
            cornerRadius={radius}
            listening={false}
          />
        )}
      </Group>
      {isSelected && canDrag && !posOverride && (
        <Transformer
          ref={trRef}
          rotateEnabled
          borderStroke="#a78bfa"
          anchorStroke="#a78bfa"
          anchorFill="#ffffff"
          anchorCornerRadius={2}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
};

const TextLayerNode = ({
  layer,
  isSelected,
  playheadSec,
  interactive = true,
  onChange,
  posOverride,
}: {
  layer: Extract<ProjectLayer, { type: 'text' }>;
  isSelected: boolean;
  playheadSec: number;
  interactive?: boolean;
  onChange: (patch: Partial<ProjectLayer>) => void;
  posOverride?: { x: number; y: number } | null;
}) => {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const localT =
    layer.durationSec > 0
      ? Math.min(1, Math.max(0, (playheadSec - layer.startSec) / layer.durationSec))
      : 0;
  const anim = getElementAnimTransform(layer.animation, localT);
  const fx = effectKonvaProps(layer.effect, playheadSec);

  useTransformer(isSelected, shapeRef, trRef, [
    layer.text,
    layer.fontSize,
    layer.x,
    layer.y,
    layer.bold,
    layer.italic,
    layer.underline,
    anim.scale,
  ]);

  return (
    <>
      <Text
        ref={shapeRef}
        name={nodeNameFor(layer.id)}
        text={layer.text}
        x={(posOverride?.x ?? layer.x) + anim.offsetX + (fx.offsetX ?? 0)}
        y={(posOverride?.y ?? layer.y) + anim.offsetY}
        fontSize={layer.fontSize * anim.scale}
        fontFamily={layer.fontFamily}
        fontStyle={[layer.bold ? 'bold' : '', layer.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal'}
        textDecoration={layer.underline ? 'underline' : ''}
        fill={layer.color}
        align={layer.align ?? 'left'}
        rotation={anim.rotation}
        opacity={anim.opacity * (fx.opacity ?? 1)}
        draggable={false}
        listening={interactive}
        hitStrokeWidth={16}
        shadowBlur={fx.shadowBlur}
        shadowColor={fx.shadowColor}
        shadowOpacity={fx.shadowOpacity}
        shadowOffsetX={fx.shadowOffsetX}
        shadowOffsetY={fx.shadowOffsetY}
        onDragEnd={
          interactive
            ? (e) => {
                stopBubble(e);
                onChange({ x: e.target.x(), y: e.target.y() });
              }
            : undefined
        }
        onTransformEnd={
          interactive
            ? () => {
                const node = shapeRef.current;
                if (!node) return;
                const scaleX = node.scaleX();
                node.scaleX(1);
                node.scaleY(1);
                onChange({
                  x: node.x(),
                  y: node.y(),
                  fontSize: Math.max(12, layer.fontSize * scaleX),
                });
              }
            : undefined
        }
      />
      {isSelected && interactive && !posOverride && (
        <Transformer
          ref={trRef}
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'middle-left',
            'middle-right',
          ]}
          borderStroke="#a78bfa"
          anchorStroke="#a78bfa"
          anchorFill="#ffffff"
          anchorCornerRadius={2}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 40 ? oldBox : newBox)}
        />
      )}
    </>
  );
};

export const EditorCanvas = ({
  layers,
  sceneId,
  backgroundSrc,
  backgroundColor = '#ffffff',
  transitionBackground = null,
  selectedLayerId,
  selectedLayerIds,
  selectedSceneId,
  playheadSec,
  onSelectLayer,
  onSelectScene,
  onUpdateLayer,
  onReplaceImageSrc,
  onDropAddImage,
  resolveImageUrl,
  stylePaintArmed = false,
}: EditorCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const scaleRef = useRef(0.4);
  const [scale, setScale] = useState(0.4);
  scaleRef.current = scale;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 32;
      const h = el.clientHeight - 32;
      const sx = w / PROJECT_WIDTH;
      const sy = h / PROJECT_HEIGHT;
      setScale(Math.min(sx, sy, 0.55));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [liveDrag, setLiveDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<GuideLine[]>([]);

  const sorted = useMemo(
    () => [...layers].sort((a, b) => a.zIndex - b.zIndex),
    [layers],
  );

  const selectedIds = selectedLayerIds?.length ? selectedLayerIds : selectedLayerId ? [selectedLayerId] : [];
  const fundoSelected = Boolean(sceneId && selectedSceneId === sceneId && selectedIds.length === 0);

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;

    const stage = stageRef.current;
    if (!stage) return;
    stage.setPointersPositions(e.nativeEvent);

    const shape = stage.getIntersection(stage.getPointerPosition() ?? { x: 0, y: 0 });
    if (isTransformerAnchor(shape)) return;

    const picked = pickTopLayerId(stage, sorted);
    if (!picked) {
      if (!sceneId) return;
      onSelectLayer(null);
      onSelectScene(sceneId);
      setLiveDrag(null);
      setGuides([]);
      return;
    }

    const layer = sorted.find((l) => realLayerId(l.id) === picked);
    if (!layer || layer.id.startsWith('match:')) {
      onSelectLayer(picked);
      return;
    }

    onSelectLayer(picked);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = layer.x;
    const origY = layer.y;
    let dragging = false;
    const others = sorted
      .filter((l) => realLayerId(l.id) !== picked && !l.id.startsWith('match:'))
      .map((l) => layerBox(l));

    const placed = (clientX: number, clientY: number) => {
      const s = scaleRef.current || 1;
      const raw = layerBox(
        layer,
        origX + (clientX - startClientX) / s,
        origY + (clientY - startClientY) / s,
      );
      return snapLayerDrag(raw, others);
    };

    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) < 3 && !dragging) return;
      dragging = true;
      const next = placed(ev.clientX, ev.clientY);
      setLiveDrag({ id: picked, x: next.x, y: next.y });
      setGuides(next.guides);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setLiveDrag(null);
      setGuides([]);
      if (!dragging) return;
      const next = placed(ev.clientX, ev.clientY);
      onUpdateLayer(picked, { x: next.x, y: next.y });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onCanvasDragOver = (e: DragEvent<HTMLDivElement>) => {
    const types = [...e.dataTransfer.types];
    if (!types.includes(ZENITH_IMAGE_DRAG) && !types.includes('text/plain')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onCanvasDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const payload = readZenithImageDrag(e);
    if (!payload?.src) return;
    const stage = stageRef.current;
    if (!stage) return;
    stage.setPointersPositions(e.nativeEvent);
    const targetId = pickTopImageLayerForDrop(stage, sorted);
    if (targetId && onReplaceImageSrc) {
      onReplaceImageSrc(targetId, payload.src);
      return;
    }
    onDropAddImage?.(payload.src, payload.durationSec);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
      style={{
        background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #242424 0% 50%) 50% / 20px 20px',
        cursor: stylePaintArmed ? 'copy' : undefined,
      }}
      onPointerDown={onCanvasPointerDown}
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
    >
      <Stage
        ref={stageRef}
        width={PROJECT_WIDTH * scale}
        height={PROJECT_HEIGHT * scale}
        scaleX={scale}
        scaleY={scale}
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.45)' }}
      >
        <Layer>
          {transitionBackground ? (
            <>
              <BackgroundVisual
                color={transitionBackground.fromColor}
                src={transitionBackground.fromSrc}
                opacity={transitionBackground.fromOpacity}
                resolveImageUrl={resolveImageUrl}
              />
              <BackgroundVisual
                color={transitionBackground.toColor}
                src={transitionBackground.toSrc}
                opacity={transitionBackground.toOpacity}
                resolveImageUrl={resolveImageUrl}
              />
            </>
          ) : (
            <BackgroundVisual
              color={backgroundColor}
              src={backgroundSrc}
              resolveImageUrl={resolveImageUrl}
            />
          )}
          {fundoSelected && (
            <Rect
              x={0}
              y={0}
              width={PROJECT_WIDTH}
              height={PROJECT_HEIGHT}
              stroke="#a78bfa"
              strokeWidth={4}
              listening={false}
            />
          )}
          {sorted.map((layer) => {
            const isMorph = layer.id.startsWith('match:');
            const selectId = isMorph
              ? layer.id.split(':')[1] || layer.id
              : layer.id;
            const isSelected = !isMorph && selectedIds.includes(layer.id);
            if (layer.type === 'image') {
              return (
                <ImageLayerNode
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected || (isMorph && selectedIds.includes(selectId))}
                  playheadSec={playheadSec}
                  interactive
                  draggable={!isMorph}
                  posOverride={liveDrag?.id === selectId ? liveDrag : null}
                  onChange={(patch) => onUpdateLayer(selectId, patch)}
                  resolveImageUrl={resolveImageUrl}
                />
              );
            }
            return (
              <TextLayerNode
                key={layer.id}
                layer={layer}
                isSelected={isSelected || (isMorph && selectedIds.includes(selectId))}
                playheadSec={playheadSec}
                interactive
                posOverride={liveDrag?.id === selectId ? liveDrag : null}
                onChange={(patch) => onUpdateLayer(selectId, patch)}
              />
            );
          })}
          {guides.some(
            (g) =>
              (g.axis === 'x' && (g.at === 0 || g.at === PROJECT_WIDTH)) ||
              (g.axis === 'y' && (g.at === 0 || g.at === PROJECT_HEIGHT)),
          ) && (
            <Rect
              x={0}
              y={0}
              width={PROJECT_WIDTH}
              height={PROJECT_HEIGHT}
              stroke="#c4b5fd"
              strokeWidth={2}
              listening={false}
            />
          )}
          {guides.map((g, i) =>
            g.axis === 'x' ? (
              <Line
                key={`gx-${g.at}-${i}`}
                points={[g.at, 0, g.at, PROJECT_HEIGHT]}
                stroke="#c4b5fd"
                strokeWidth={2}
                listening={false}
              />
            ) : (
              <Line
                key={`gy-${g.at}-${i}`}
                points={[0, g.at, PROJECT_WIDTH, g.at]}
                stroke="#c4b5fd"
                strokeWidth={2}
                listening={false}
              />
            ),
          )}
        </Layer>
      </Stage>
    </div>
  );
};
