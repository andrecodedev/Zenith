import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  ImageIcon,
  Type,
} from 'lucide-react';
import type { ProjectElement, VideoProject, VideoScene } from '../../../types/video-project';
import { PROJECT_HEIGHT, PROJECT_WIDTH } from '../../../types/video-project';

type PositionPanelProps = {
  project: VideoProject;
  layer: ProjectElement | null;
  scene: VideoScene | null;
  onClose: () => void;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: Partial<ProjectElement>) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onReorderLayers: (frontToBackIds: string[]) => void;
  onBringSceneForward: (id: string) => void;
  onSendSceneBackward: (id: string) => void;
  onBringSceneToFront: (id: string) => void;
  onSendSceneToBack: (id: string) => void;
};

type Tab = 'organize' | 'layers';

export const PositionPanel = ({
  project,
  layer,
  scene,
  onClose,
  onSelectLayer,
  onUpdateLayer,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onReorderLayers,
  onBringSceneForward,
  onSendSceneBackward,
  onBringSceneToFront,
  onSendSceneToBack,
}: PositionPanelProps) => {
  const [tab, setTab] = useState<Tab>('layers');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sortedLayers = [...project.elements].sort(
    (a, b) => b.zIndex - a.zIndex || a.id.localeCompare(b.id),
  );

  useEffect(() => {
    const zs = project.elements.map((e) => e.zIndex);
    if (zs.length > 1 && new Set(zs).size !== zs.length) {
      const frontToBack = [...project.elements]
        .sort((a, b) => b.zIndex - a.zIndex || a.id.localeCompare(b.id))
        .map((e) => e.id);
      onReorderLayers(frontToBack);
    }
  }, [project.elements, onReorderLayers]);

  const align = (mode: 'top' | 'left' | 'center' | 'middle' | 'bottom' | 'right') => {
    if (!layer) return;
    if (layer.type === 'image') {
      const w = layer.w;
      const h = layer.h;
      if (mode === 'left') onUpdateLayer(layer.id, { x: 0 });
      if (mode === 'right') onUpdateLayer(layer.id, { x: PROJECT_WIDTH - w });
      if (mode === 'center') onUpdateLayer(layer.id, { x: (PROJECT_WIDTH - w) / 2 });
      if (mode === 'top') onUpdateLayer(layer.id, { y: 0 });
      if (mode === 'bottom') onUpdateLayer(layer.id, { y: PROJECT_HEIGHT - h });
      if (mode === 'middle') onUpdateLayer(layer.id, { y: (PROJECT_HEIGHT - h) / 2 });
    } else {
      if (mode === 'left') onUpdateLayer(layer.id, { x: 0 });
      if (mode === 'center') onUpdateLayer(layer.id, { x: PROJECT_WIDTH / 2 - 100 });
      if (mode === 'right') onUpdateLayer(layer.id, { x: PROJECT_WIDTH - 200 });
      if (mode === 'top') onUpdateLayer(layer.id, { y: 0 });
      if (mode === 'middle') onUpdateLayer(layer.id, { y: PROJECT_HEIGHT / 2 });
      if (mode === 'bottom') onUpdateLayer(layer.id, { y: PROJECT_HEIGHT - 80 });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-100">Posição</h2>
        <button type="button" onClick={onClose} className="text-xs text-violet-300 hover:text-violet-200 cursor-pointer px-2 py-1">
          Voltar
        </button>
      </div>

      <div className="flex border-b border-neutral-800">
        {(['organize', 'layers'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'flex-1 py-2.5 text-xs font-medium cursor-pointer ' +
              (tab === t
                ? 'text-violet-300 border-b-2 border-violet-400'
                : 'text-neutral-500 hover:text-neutral-300')
            }
          >
            {t === 'organize' ? 'Organizar' : 'Camadas'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {tab === 'organize' && layer && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Btn onClick={() => onBringForward(layer.id)} icon={<ArrowUp size={14} />} label="Para frente" />
              <Btn onClick={() => onSendBackward(layer.id)} icon={<ArrowDown size={14} />} label="Para trás" />
              <Btn onClick={() => onBringToFront(layer.id)} icon={<ChevronsUp size={14} />} label="Para o topo" />
              <Btn onClick={() => onSendToBack(layer.id)} icon={<ChevronsDown size={14} />} label="Para o fundo" />
            </div>

            <div>
              <p className="text-xs text-neutral-500 mb-2">Alinhar à página</p>
              <div className="grid grid-cols-3 gap-1.5 max-w-[180px]">
                <AlignBtn label="↑" onClick={() => align('top')} />
                <span />
                <span />
                <AlignBtn label="←" onClick={() => align('left')} />
                <AlignBtn label="◎" onClick={() => { align('center'); align('middle'); }} />
                <AlignBtn label="→" onClick={() => align('right')} />
                <span />
                <AlignBtn label="↓" onClick={() => align('bottom')} />
                <span />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <p className="text-xs text-neutral-500">Avançados</p>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="X" value={Math.round(layer.x)} onChange={(v) => onUpdateLayer(layer.id, { x: v })} />
                <NumField label="Y" value={Math.round(layer.y)} onChange={(v) => onUpdateLayer(layer.id, { y: v })} />
                {layer.type === 'image' && (
                  <>
                    <NumField label="Largura" value={Math.round(layer.w)} onChange={(v) => onUpdateLayer(layer.id, { w: v })} />
                    <NumField label="Altura" value={Math.round(layer.h)} onChange={(v) => onUpdateLayer(layer.id, { h: v })} />
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'organize' && scene && !layer && (
          <>
            <p className="text-xs text-neutral-500">
              Se dois fundos se sobrepõem, este controle escolhe quem aparece.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Btn onClick={() => onBringSceneForward(scene.id)} icon={<ArrowUp size={14} />} label="Para frente" />
              <Btn onClick={() => onSendSceneBackward(scene.id)} icon={<ArrowDown size={14} />} label="Para trás" />
              <Btn onClick={() => onBringSceneToFront(scene.id)} icon={<ChevronsUp size={14} />} label="Para o topo" />
              <Btn onClick={() => onSendSceneToBack(scene.id)} icon={<ChevronsDown size={14} />} label="Para o fundo" />
            </div>
          </>
        )}

        {tab === 'organize' && !layer && !scene && (
          <p className="text-neutral-500 text-sm">Selecione um elemento ou fundo para organizar.</p>
        )}

        {tab === 'layers' && (
          <div className="space-y-1">
            <p className="text-xs text-neutral-500 mb-2">
              Clique seleciona. Arraste a linha para cima ou para baixo: o de cima fica na frente no preview.
            </p>
            {sortedLayers.length === 0 && (
              <p className="text-neutral-600 text-sm">Nenhuma camada ainda.</p>
            )}
            {sortedLayers.map((el) => {
              const active = layer?.id === el.id;
              const dropping = overId === el.id && dragId && dragId !== el.id;
              return (
                <div
                  key={el.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setOverId(el.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData('text/plain') || dragId;
                    setDragId(null);
                    setOverId(null);
                    if (!fromId || fromId === el.id) return;
                    const ids = sortedLayers.map((x) => x.id);
                    const from = ids.indexOf(fromId);
                    const to = ids.indexOf(el.id);
                    if (from < 0 || to < 0) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    let insert = e.clientY < rect.top + rect.height / 2 ? to : to + 1;
                    if (from < insert) insert -= 1;
                    const next = [...ids];
                    next.splice(from, 1);
                    next.splice(insert, 0, fromId);
                    onReorderLayers(next);
                  }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', el.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragId(el.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragLeave={() => {
                    if (overId === el.id) setOverId(null);
                  }}
                  className={
                    'w-full flex items-center gap-1 px-1 py-1.5 rounded-lg border text-left ' +
                    (active
                      ? 'border-violet-400 bg-violet-600/15'
                      : 'border-neutral-700 bg-neutral-800/40 hover:border-neutral-500') +
                    (dropping ? ' ring-2 ring-violet-400' : '')
                  }
                >
                  <span
                    title="Arrastar para reordenar"
                    className="p-1 text-neutral-500 hover:text-neutral-200 cursor-grab active:cursor-grabbing shrink-0"
                  >
                    <GripVertical size={14} />
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectLayer(el.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 py-0.5 cursor-pointer"
                  >
                    {el.type === 'text' ? (
                      <Type size={14} className="text-neutral-400 shrink-0" />
                    ) : (
                      <ImageIcon size={14} className="text-neutral-400 shrink-0" />
                    )}
                    <span className="flex-1 truncate text-sm text-neutral-200">
                      {el.type === 'text' ? el.text : 'Imagem'}
                    </span>
                    <span className="text-[10px] text-neutral-500 tabular-nums">z{el.zIndex}</span>
                  </button>
                  <button
                    type="button"
                    title="Trazer para frente"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBringForward(el.id);
                    }}
                    className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 cursor-pointer"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    title="Enviar para trás"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendBackward(el.id);
                    }}
                    className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 cursor-pointer"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Btn = ({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-700 cursor-pointer"
  >
    {icon}
    {label}
  </button>
);

const AlignBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-9 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700 cursor-pointer text-sm"
  >
    {label}
  </button>
);

const NumField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) => (
  <label className="text-xs text-neutral-500">
    {label}
    <input
      type="number"
      className="w-full mt-1 px-2 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </label>
);
