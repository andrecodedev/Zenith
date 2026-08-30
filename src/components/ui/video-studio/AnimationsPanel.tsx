import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ProjectElement } from '../../../types/video-project';
import {
  ANIMATION_CATALOG,
  defaultAnimation,
  type AnimationType,
  type ElementAnimation,
} from '../../../types/element-style';
import { historyGestureBind } from '../../../store/useVideoEditorStore';

type AnimationsPanelProps = {
  layer: ProjectElement | null;
  onClose: () => void;
  onUpdate: (id: string, animation: ElementAnimation | undefined) => void;
};

const GRID_COLS = 3;

const DIRECTION_TYPES: AnimationType[] = [
  'pan',
  'drift',
  'flow',
  'tectonic',
  'slide-left',
  'slide-right',
  'rise',
  'from-bottom',
];

const usesDirection = (type: AnimationType) => DIRECTION_TYPES.includes(type);

const AnimPreview = ({ type }: { type: AnimationType }) => (
  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/40 to-violet-900/30 border border-violet-500/30 flex items-center justify-center">
    <span className="text-[9px] text-violet-200 font-medium uppercase">{type.slice(0, 3)}</span>
  </div>
);

type SettingsProps = {
  anim: ElementAnimation;
  onApply: (patch: Partial<ElementAnimation>) => void;
  onRemove: () => void;
};

const AnimationSettings = ({ anim, onApply, onRemove }: SettingsProps) => {
  const showDirection = usesDirection(anim.type);

  return (
    <div className="col-span-3 rounded-xl border border-violet-500/30 bg-violet-950/25 p-3 space-y-3">
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-neutral-400">Animar</span>
        <div className="flex gap-1">
          {(['both', 'in', 'out'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onApply({ phase: p })}
              className={
                'flex-1 py-1.5 rounded-lg text-xs cursor-pointer ' +
                (anim.phase === p
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700')
              }
            >
              {p === 'both' ? 'Ambos' : p === 'in' ? 'Entrando' : 'Saindo'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-neutral-400">Velocidade</span>
        <div className="flex gap-1">
          {(['slow', 'medium', 'fast'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onApply({ speed: s })}
              className={
                'flex-1 py-1.5 rounded-lg text-xs cursor-pointer ' +
                (anim.speed === s
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700')
              }
            >
              {s === 'slow' ? 'Lenta' : s === 'medium' ? 'Média' : 'Rápida'}
            </button>
          ))}
        </div>
      </div>

      {showDirection && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-neutral-400">Direção</span>
          <div className="flex gap-2">
            <button
              type="button"
              title="Esquerda"
              onClick={() => onApply({ direction: 'left' })}
              className={
                'flex-1 py-2 rounded-lg flex items-center justify-center cursor-pointer ' +
                (anim.direction !== 'right'
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700')
              }
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              title="Direita"
              onClick={() => onApply({ direction: 'right' })}
              className={
                'flex-1 py-2 rounded-lg flex items-center justify-center cursor-pointer ' +
                (anim.direction === 'right'
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700')
              }
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {showDirection && (
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-xs text-neutral-400">Inverter a animação de saída</span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(anim.reverseExit)}
            onClick={() => onApply({ reverseExit: !anim.reverseExit })}
            className={
              'relative w-10 h-5 rounded-full shrink-0 transition-colors cursor-pointer ' +
              (anim.reverseExit ? 'bg-violet-600' : 'bg-neutral-700')
            }
          >
            <span
              className={
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ' +
                (anim.reverseExit ? 'translate-x-5' : 'translate-x-0')
              }
            />
          </button>
        </label>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-neutral-400">
          Intensidade: {Math.round((anim.intensity ?? 0.7) * 100)}%
        </label>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={anim.intensity ?? 0.7}
          onChange={(e) => onApply({ intensity: Number(e.target.value) })}
          className="w-full accent-violet-500"
          {...historyGestureBind}
        />
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white cursor-pointer"
      >
        Remover animação
      </button>
    </div>
  );
};

export const AnimationsPanel = ({ layer, onClose, onUpdate }: AnimationsPanelProps) => {
  const anim = layer?.animation ?? defaultAnimation();
  const [activeType, setActiveType] = useState<AnimationType>(anim.type);

  useEffect(() => {
    if (layer?.animation?.type) setActiveType(layer.animation.type);
    else if (!layer?.animation) setActiveType('none');
  }, [layer?.id, layer?.animation?.type]);

  if (!layer) {
    return (
      <div className="p-4 text-sm text-neutral-500">
        Selecione um elemento no preview para animar.
      </div>
    );
  }

  const current = layer.animation ?? { ...defaultAnimation(), type: activeType };

  const apply = (patch: Partial<ElementAnimation>) => {
    const merged = { ...current, ...patch };
    if (merged.type === 'none') {
      onUpdate(layer.id, undefined);
      return;
    }
    onUpdate(layer.id, merged);
  };

  const pick = (type: AnimationType) => {
    setActiveType(type);
    if (type === 'none') {
      onUpdate(layer.id, undefined);
      return;
    }
    apply({ type });
  };

  const renderCategoryGrid = (items: { id: AnimationType; label: string }[]) => {
    const selected = layer.animation?.type ?? (activeType !== 'none' ? activeType : null);
    const cells: ReactNode[] = [];

    items.forEach((item, idx) => {
      const active = selected === item.id;
      cells.push(
        <button
          key={item.id}
          type="button"
          onClick={() => pick(item.id)}
          className={
            'flex flex-col items-center gap-1.5 p-2 rounded-xl border cursor-pointer transition-colors ' +
            (active
              ? 'border-violet-400 bg-violet-600/15 ring-1 ring-violet-400/40'
              : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/40')
          }
        >
          <AnimPreview type={item.id} />
          <span className="text-[10px] text-neutral-300 text-center leading-tight">{item.label}</span>
        </button>,
      );

      const isEndOfRow = (idx + 1) % GRID_COLS === 0 || idx === items.length - 1;
      if (isEndOfRow && selected && selected !== 'none') {
        const rowStart = Math.floor(idx / GRID_COLS) * GRID_COLS;
        const rowEnd = Math.min(rowStart + GRID_COLS, items.length);
        const rowItems = items.slice(rowStart, rowEnd);
        if (rowItems.some((i) => i.id === selected)) {
          cells.push(
            <AnimationSettings
              key={`settings-${rowStart}-${selected}`}
              anim={layer.animation ?? { ...defaultAnimation(), type: selected }}
              onApply={apply}
              onRemove={() => onUpdate(layer.id, undefined)}
            />,
          );
        }
      }
    });

    return cells;
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <h2 className="text-sm font-semibold text-neutral-100">Animar</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-violet-300 hover:text-violet-200 cursor-pointer px-2 py-1"
        >
          Voltar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {ANIMATION_CATALOG.map((cat) => (
          <section key={cat.title}>
            <h3 className="text-xs font-semibold text-neutral-400 mb-2">{cat.title}</h3>
            <div className="grid grid-cols-3 gap-2">{renderCategoryGrid(cat.items)}</div>
          </section>
        ))}
      </div>
    </div>
  );
};
