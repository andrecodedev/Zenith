import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { Layer as ProjectLayer } from '../../../types/video-project';
import { PROJECT_HEIGHT, PROJECT_WIDTH } from '../../../types/video-project';

type EditorCanvasProps = {
  layers: ProjectLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<ProjectLayer>) => void;
  resolveImageUrl: (src: string) => string;
};

const useImage = (url: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
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

const ImageLayerNode = ({
  layer,
  isSelected,
  onSelect,
  onChange,
  resolveImageUrl,
}: {
  layer: Extract<ProjectLayer, { type: 'image' }>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ProjectLayer>) => void;
  resolveImageUrl: (src: string) => string;
}) => {
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const url = resolveImageUrl(layer.src);
  const image = useImage(url);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image ?? undefined}
        x={layer.x}
        y={layer.y}
        width={layer.w}
        height={layer.h}
        rotation={layer.rotation ?? 0}
        opacity={layer.opacity ?? 1}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: node.x(),
            y: node.y(),
            w: Math.max(20, node.width() * scaleX),
            h: Math.max(20, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
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
  onSelect,
  onChange,
}: {
  layer: Extract<ProjectLayer, { type: 'text' }>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ProjectLayer>) => void;
}) => {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Text
        ref={shapeRef}
        text={layer.text}
        x={layer.x}
        y={layer.y}
        fontSize={layer.fontSize}
        fontFamily={layer.fontFamily}
        fill={layer.color}
        align={layer.align ?? 'left'}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      />
      {isSelected && <Transformer ref={trRef} enabledAnchors={['middle-left', 'middle-right']} />}
    </>
  );
};

export const EditorCanvas = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  resolveImageUrl,
}: EditorCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

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

  const sorted = useMemo(
    () => [...layers].sort((a, b) => a.zIndex - b.zIndex),
    [layers],
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex items-center justify-center bg-bg-primary/60 rounded-xl border border-border-base overflow-hidden"
      onClick={() => onSelectLayer(null)}
    >
      <Stage
        width={PROJECT_WIDTH * scale}
        height={PROJECT_HEIGHT * scale}
        scaleX={scale}
        scaleY={scale}
        onClick={(e) => {
          if (e.target === e.target.getStage()) onSelectLayer(null);
        }}
      >
        <Layer>
          {sorted.map((layer) => {
            const isSelected = layer.id === selectedLayerId;
            if (layer.type === 'image') {
              return (
                <ImageLayerNode
                  key={layer.id}
                  layer={layer}
                  isSelected={isSelected}
                  onSelect={() => onSelectLayer(layer.id)}
                  onChange={(patch) => onUpdateLayer(layer.id, patch)}
                  resolveImageUrl={resolveImageUrl}
                />
              );
            }
            return (
              <TextLayerNode
                key={layer.id}
                layer={layer}
                isSelected={isSelected}
                onSelect={() => onSelectLayer(layer.id)}
                onChange={(patch) => onUpdateLayer(layer.id, patch)}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};
