import type { Layer } from '../../../types/video-project';

type PropertiesPanelProps = {
  layer: Layer | null;
  clip: { trackId: string; label?: string; startSec: number; durationSec: number; volume?: number } | null;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onUpdateClip: (trackId: string, clipId: string, patch: Record<string, unknown>) => void;
  selectedClipId: string | null;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onRemoveLayer: (id: string) => void;
};

export const PropertiesPanel = ({
  layer,
  clip,
  onUpdateLayer,
  onUpdateClip,
  selectedClipId,
  onBringForward,
  onSendBackward,
  onRemoveLayer,
}: PropertiesPanelProps) => {
  if (!layer && !clip) {
    return (
      <div className="p-3 border border-border-base rounded-xl bg-bg-secondary/30 h-full text-sm text-text-tertiary">
        Selecione um layer ou clip de áudio para editar propriedades.
      </div>
    );
  }

  if (clip && selectedClipId) {
    return (
      <div className="p-3 border border-border-base rounded-xl bg-bg-secondary/30 space-y-3 overflow-y-auto">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Clip de áudio</h3>
        <label className="block text-xs text-text-secondary">
          Início (s)
          <input
            type="number"
            min={0}
            step={0.1}
            className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
            value={clip.startSec}
            onChange={(e) =>
              onUpdateClip(clip.trackId, selectedClipId, { startSec: Number(e.target.value) })
            }
          />
        </label>
        <label className="block text-xs text-text-secondary">
          Duração (s)
          <input
            type="number"
            min={0.1}
            step={0.1}
            className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
            value={clip.durationSec}
            onChange={(e) =>
              onUpdateClip(clip.trackId, selectedClipId, { durationSec: Number(e.target.value) })
            }
          />
        </label>
        <label className="block text-xs text-text-secondary">
          Volume (0-1)
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
            value={clip.volume ?? 1}
            onChange={(e) =>
              onUpdateClip(clip.trackId, selectedClipId, { volume: Number(e.target.value) })
            }
          />
        </label>
        {clip.label && (
          <p className="text-[10px] text-text-tertiary truncate" title={clip.label}>
            {clip.label}
          </p>
        )}
      </div>
    );
  }

  if (!layer) return null;

  return (
    <div className="p-3 border border-border-base rounded-xl bg-bg-secondary/30 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
          {layer.type === 'image' ? 'Imagem' : 'Texto'}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 rounded border border-border-base hover:bg-elements"
            onClick={() => onBringForward(layer.id)}
          >
            ↑
          </button>
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 rounded border border-border-base hover:bg-elements"
            onClick={() => onSendBackward(layer.id)}
          >
            ↓
          </button>
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10"
            onClick={() => onRemoveLayer(layer.id)}
          >
            Remover
          </button>
        </div>
      </div>

      <label className="block text-xs text-text-secondary">
        X
        <input
          type="number"
          className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
          value={Math.round(layer.x)}
          onChange={(e) => onUpdateLayer(layer.id, { x: Number(e.target.value) })}
        />
      </label>
      <label className="block text-xs text-text-secondary">
        Y
        <input
          type="number"
          className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
          value={Math.round(layer.y)}
          onChange={(e) => onUpdateLayer(layer.id, { y: Number(e.target.value) })}
        />
      </label>

      {layer.type === 'image' && (
        <>
          <label className="block text-xs text-text-secondary">
            Largura
            <input
              type="number"
              min={20}
              className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
              value={Math.round(layer.w)}
              onChange={(e) => onUpdateLayer(layer.id, { w: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Altura
            <input
              type="number"
              min={20}
              className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
              value={Math.round(layer.h)}
              onChange={(e) => onUpdateLayer(layer.id, { h: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Opacidade
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
              value={layer.opacity ?? 1}
              onChange={(e) => onUpdateLayer(layer.id, { opacity: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      {layer.type === 'text' && (
        <>
          <label className="block text-xs text-text-secondary">
            Texto
            <textarea
              className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm min-h-[60px]"
              value={layer.text}
              onChange={(e) => onUpdateLayer(layer.id, { text: e.target.value })}
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Tamanho
            <input
              type="number"
              min={8}
              className="mt-1 w-full bg-bg-primary border border-border-base rounded px-2 py-1 text-sm"
              value={layer.fontSize}
              onChange={(e) => onUpdateLayer(layer.id, { fontSize: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Cor
            <input
              type="color"
              className="mt-1 w-full h-8 bg-bg-primary border border-border-base rounded cursor-pointer"
              value={layer.color}
              onChange={(e) => onUpdateLayer(layer.id, { color: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
};
