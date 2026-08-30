import type { ProjectElement } from '../../../types/video-project';
import { asPercent } from '../../../types/video-project';
import { ELEMENT_EFFECTS } from '../../../types/element-style';
import { historyGestureBind } from '../../../store/useVideoEditorStore';

type EffectsPanelProps = {
  layer: ProjectElement | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<ProjectElement>) => void;
};

export const EffectsPanel = ({ layer, onClose, onUpdate }: EffectsPanelProps) => {
  if (!layer) {
    return (
      <div className="p-4 text-sm text-neutral-500">
        Selecione um elemento para aplicar efeitos.
      </div>
    );
  }

  const current = layer.effect ?? 'none';

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-100">Efeitos</h2>
        <button type="button" onClick={onClose} className="text-xs text-violet-300 hover:text-violet-200 cursor-pointer px-2 py-1">
          Voltar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section>
          <h3 className="text-xs font-semibold text-neutral-400 mb-2">Efeitos</h3>
          <div className="grid grid-cols-2 gap-2">
            {ELEMENT_EFFECTS.map((fx) => (
              <button
                key={fx.id}
                type="button"
                onClick={() =>
                  onUpdate(layer.id, { effect: fx.id === 'none' ? undefined : fx.id })
                }
                className={
                  'py-3 px-2 rounded-xl border text-sm cursor-pointer transition-colors ' +
                  (current === fx.id
                    ? 'border-violet-400 bg-violet-600/20 text-violet-100'
                    : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:border-neutral-500')
                }
              >
                {fx.label}
              </button>
            ))}
          </div>
        </section>

        <section className="pt-2 border-t border-neutral-800 space-y-3">
          <h3 className="text-xs font-semibold text-neutral-400">Avançados</h3>
          <label className="block text-xs text-neutral-500">
            Borda (0-100%)
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              className="mt-2 w-full accent-violet-500"
              value={asPercent(layer.borderWidth)}
              onChange={(e) => onUpdate(layer.id, { borderWidth: Number(e.target.value) })}
              {...historyGestureBind}
            />
            <input
              type="number"
              min={0}
              max={100}
              className="field-input mt-1"
              value={asPercent(layer.borderWidth)}
              onChange={(e) =>
                onUpdate(layer.id, { borderWidth: Math.min(100, Math.max(0, Number(e.target.value))) })
              }
            />
          </label>
          <label className="block text-xs text-neutral-500">
            Cor da borda
            <input
              type="color"
              className="mt-1 w-full h-9 rounded cursor-pointer"
              value={layer.borderColor ?? '#ffffff'}
              onChange={(e) => onUpdate(layer.id, { borderColor: e.target.value })}
              {...historyGestureBind}
            />
          </label>
          <label className="block text-xs text-neutral-500">
            Arredondamento (0-100%)
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              className="mt-2 w-full accent-violet-500"
              value={asPercent(layer.cornerRadius)}
              onChange={(e) => onUpdate(layer.id, { cornerRadius: Number(e.target.value) })}
              {...historyGestureBind}
            />
            <input
              type="number"
              min={0}
              max={100}
              className="field-input mt-1"
              value={asPercent(layer.cornerRadius)}
              onChange={(e) =>
                onUpdate(layer.id, { cornerRadius: Math.min(100, Math.max(0, Number(e.target.value))) })
              }
            />
          </label>
        </section>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          background: #171717;
          border: 1px solid #404040;
          color: #f5f5f5;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};
