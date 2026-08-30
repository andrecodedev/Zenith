import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { ProjectElement } from '../../../types/video-project';
import { historyGestureBind } from '../../../store/useVideoEditorStore';

type PropertiesPanelProps = {
  mode: 'none' | 'position' | 'audio';
  layer: ProjectElement | null;
  clip: { trackId: string; label?: string; startSec: number; durationSec: number; volume?: number } | null;
  selectedClipId: string | null;
  onClose: () => void;
  onUpdateLayer: (id: string, patch: Partial<ProjectElement>) => void;
  onUpdateClip: (trackId: string, clipId: string, patch: Record<string, unknown>) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
};

export const PropertiesPanel = ({
  mode,
  layer,
  clip,
  selectedClipId,
  onClose,
  onUpdateLayer,
  onUpdateClip,
  onBringForward,
  onSendBackward,
}: PropertiesPanelProps) => {
  if (mode === 'none') return null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-100">
          {mode === 'position' ? 'Posição' : 'Áudio na timeline'}
        </h2>
        <button type="button" onClick={onClose} className="text-xs text-violet-300 hover:text-violet-200 cursor-pointer px-2 py-1">
          Voltar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {mode === 'audio' && clip && selectedClipId && (
          <>
            <p className="text-xs text-neutral-500">Ajuste o clip selecionado na faixa de áudio.</p>
            {clip.label && (
              <p className="text-neutral-300 truncate" title={clip.label}>
                {clip.label}
              </p>
            )}
            <Field label="Início na timeline (segundos)">
              <input
                type="number"
                min={0}
                step={0.1}
                className="field-input"
                value={clip.startSec}
                onChange={(e) => onUpdateClip(clip.trackId, selectedClipId, { startSec: Number(e.target.value) })}
              />
            </Field>
            <Field label="Duração (segundos)">
              <input
                type="number"
                min={0.1}
                step={0.1}
                className="field-input"
                value={clip.durationSec}
                onChange={(e) => onUpdateClip(clip.trackId, selectedClipId, { durationSec: Number(e.target.value) })}
              />
            </Field>
            <Field label="Volume (0 a 1)">
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="field-input"
                value={clip.volume ?? 1}
                onChange={(e) => onUpdateClip(clip.trackId, selectedClipId, { volume: Number(e.target.value) })}
              />
            </Field>
          </>
        )}

        {mode === 'position' && layer && (
          <>
            <p className="text-xs text-neutral-500">
              Organize camadas e coordenadas do {layer.type === 'image' ? 'elemento' : 'texto'} na cena.
            </p>
            <Field label="Início na timeline (s)">
              <input
                type="number"
                min={0}
                step={0.1}
                className="field-input"
                value={layer.startSec}
                onChange={(e) => onUpdateLayer(layer.id, { startSec: Number(e.target.value) })}
              />
            </Field>
            <Field label="Duração visível (s)">
              <input
                type="number"
                min={0.5}
                step={0.1}
                className="field-input"
                value={layer.durationSec}
                onChange={(e) => onUpdateLayer(layer.id, { durationSec: Number(e.target.value) })}
              />
            </Field>
            <div className="flex gap-2">
              <button type="button" className="flex-1 btn-secondary" onClick={() => onBringForward(layer.id)}>
                <ArrowUp size={14} className="inline mr-1" /> Para frente
              </button>
              <button type="button" className="flex-1 btn-secondary" onClick={() => onSendBackward(layer.id)}>
                <ArrowDown size={14} className="inline mr-1" /> Para trás
              </button>
            </div>
            <Field label="Posição X (px)">
              <input
                type="number"
                className="field-input"
                value={Math.round(layer.x)}
                onChange={(e) => onUpdateLayer(layer.id, { x: Number(e.target.value) })}
              />
            </Field>
            <Field label="Posição Y (px)">
              <input
                type="number"
                className="field-input"
                value={Math.round(layer.y)}
                onChange={(e) => onUpdateLayer(layer.id, { y: Number(e.target.value) })}
              />
            </Field>
            {layer.type === 'image' && (
              <>
                <Field label="Largura (px)">
                  <input
                    type="number"
                    min={20}
                    className="field-input"
                    value={Math.round(layer.w)}
                    onChange={(e) => {
                      const w = Math.max(20, Number(e.target.value) || 20);
                      const ratio = layer.h / Math.max(1, layer.w);
                      onUpdateLayer(layer.id, { w, h: Math.max(20, Math.round(w * ratio)) });
                    }}
                  />
                </Field>
                <Field label="Altura (px)">
                  <input
                    type="number"
                    min={20}
                    className="field-input"
                    value={Math.round(layer.h)}
                    onChange={(e) => {
                      const h = Math.max(20, Number(e.target.value) || 20);
                      const ratio = layer.w / Math.max(1, layer.h);
                      onUpdateLayer(layer.id, { h, w: Math.max(20, Math.round(h * ratio)) });
                    }}
                  />
                </Field>
                <Field label="Opacidade">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                    value={layer.opacity ?? 1}
                    onChange={(e) => onUpdateLayer(layer.id, { opacity: Number(e.target.value) })}
                    {...historyGestureBind}
                  />
                </Field>
              </>
            )}
            {layer.type === 'text' && (
              <Field label="Conteúdo">
                <textarea
                  className="field-input min-h-[80px] resize-y"
                  value={layer.text}
                  onChange={(e) => onUpdateLayer(layer.id, { text: e.target.value })}
                />
              </Field>
            )}
          </>
        )}
      </div>

      <style>{`
        .field-input {
          width: 100%;
          margin-top: 4px;
          padding: 8px 10px;
          border-radius: 8px;
          background: #171717;
          border: 1px solid #404040;
          color: #f5f5f5;
          font-size: 14px;
        }
        .btn-secondary {
          padding: 8px 10px;
          border-radius: 8px;
          background: #262626;
          border: 1px solid #404040;
          color: #e5e5e5;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-secondary:hover { background: #333; }
      `}</style>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-neutral-400 text-xs font-medium">
    {label}
    {children}
  </label>
);
