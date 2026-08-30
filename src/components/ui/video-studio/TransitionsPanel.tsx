import { useState } from 'react';
import {
  SCENE_TRANSITIONS,
  type SceneTransition,
  type VideoScene,
} from '../../../types/video-project';
import { historyGestureBind } from '../../../store/useVideoEditorStore';

type TransitionsPanelProps = {
  scene: VideoScene | null;
  sceneIndex: number;
  onClose: () => void;
  onSetTransition: (sceneId: string, transition: SceneTransition, durationSec: number) => void;
  onApplyToAll: (transition: SceneTransition, durationSec: number) => void;
};

const TransitionIcon = ({ type }: { type: SceneTransition }) => {
  const base = 'w-8 h-8 rounded border border-violet-500/40 bg-violet-600/20';
  if (type === 'match') {
    return (
      <div className={base + ' relative overflow-hidden flex items-center justify-center'}>
        <div className="absolute left-0.5 top-1 w-3 h-4 rounded-sm bg-violet-300/80" />
        <div className="absolute right-0.5 bottom-1 w-3 h-4 rounded-sm bg-violet-400/90" />
        <span className="relative text-[10px] text-violet-100">↔</span>
      </div>
    );
  }
  if (type === 'cut') {
    return (
      <div className={base + ' flex items-center justify-center text-neutral-500 text-lg'}>—</div>
    );
  }
  if (type === 'dissolve') {
    return <div className={base + ' bg-gradient-to-br from-violet-400/60 to-transparent'} />;
  }
  if (type === 'slide-left') {
    return (
      <div className={base + ' relative overflow-hidden'}>
        <div className="absolute inset-y-0 left-0 w-1/2 bg-violet-400/70" />
      </div>
    );
  }
  if (type === 'slide-right') {
    return (
      <div className={base + ' relative overflow-hidden'}>
        <div className="absolute inset-y-0 right-0 w-1/2 bg-violet-400/70" />
      </div>
    );
  }
  return <div className={base + ' rounded-full bg-violet-400/50 scale-75'} />;
};

export const TransitionsPanel = ({
  scene,
  sceneIndex: _sceneIndex,
  onClose,
  onSetTransition,
  onApplyToAll,
}: TransitionsPanelProps) => {
  const current = scene?.transitionOut ?? 'cut';
  const [duration, setDuration] = useState(scene?.transitionDurationSec ?? 0.7);

  if (!scene) {
    return (
      <div className="flex flex-col h-full p-4 text-sm text-neutral-500">
        Selecione uma transição entre fundos na timeline.
      </div>
    );
  }

  const pick = (t: SceneTransition) => {
    const d = t === 'match' && duration < 0.5 ? 0.7 : duration;
    if (t === 'match') setDuration(d);
    onSetTransition(scene.id, t, d);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Transições</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Entre este fundo e o próximo
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-violet-300 hover:text-violet-200 cursor-pointer px-2 py-1"
        >
          Voltar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {SCENE_TRANSITIONS.map((t) => {
            const active = current === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                onClick={() => pick(t.id)}
                className={
                  'flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ' +
                  (active
                    ? 'border-violet-400 bg-violet-600/20 ring-1 ring-violet-400/50'
                    : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-500')
                }
              >
                <TransitionIcon type={t.id} />
                <span className="text-[11px] text-neutral-300 text-center leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>

        {current === 'match' && (
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-100/90 leading-relaxed">
            A função <strong className="font-semibold text-sky-50">Combinar</strong> anima
            elementos iguais entre fundos (mesma imagem ou mesmo texto). Coloque o mesmo asset
            nos dois fundos em posições diferentes e dê play na junção.
          </div>
        )}

        {current !== 'cut' && (
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <label className="text-xs font-medium text-neutral-400">
              Duração (segundos): {duration.toFixed(2)}
            </label>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={duration}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDuration(d);
                onSetTransition(scene.id, current, d);
              }}
              className="w-full accent-violet-500"
              {...historyGestureBind}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => onApplyToAll(current, duration)}
          className="w-full py-2.5 rounded-lg border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 cursor-pointer"
        >
          Aplicar a todas as cenas
        </button>
      </div>
    </div>
  );
};
