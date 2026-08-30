import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  FlipHorizontal2,
  Italic,
  Loader2,
  Music,
  Paintbrush,
  Scissors,
  Timer,
  Underline,
  Volume2,
  WandSparkles,
  Trash2,
} from 'lucide-react';
import type { Layer, VideoScene } from '../../../types/video-project';
import { asPercent } from '../../../types/video-project';
import { historyGestureBind } from '../../../store/useVideoEditorStore';

export type ElementSidePanel = 'none' | 'effects' | 'animate' | 'position';

type AudioToolbarClip = {
  trackId: string;
  label?: string;
  startSec: number;
  durationSec: number;
  volume?: number;
};

type EditorToolbarProps = {
  layer: Layer | null;
  scene: VideoScene | null;
  clip: AudioToolbarClip | null;
  playheadSec: number;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onUpdateSceneDuration: (sceneId: string, durationSec: number) => void;
  onUpdateSceneColor: (sceneId: string, color: string) => void;
  onUpdateClip: (trackId: string, clipId: string, patch: Record<string, unknown>) => void;
  onSplitAtPlayhead: (id: string) => void;
  onOpenPanel: (panel: ElementSidePanel) => void;
  onOpenTransition: (sceneId: string) => void;
  activePanel: ElementSidePanel;
  selectedClipId: string | null;
  selectionCount?: number;
  onRemoveBackground?: () => void;
  removingBackground?: boolean;
  onDelete?: () => void;
  canDeleteScene?: boolean;
  hideTimelineTools?: boolean;
  stylePaintArmed?: boolean;
  onToggleStylePaint?: () => void;
};

const Btn = ({
  active,
  onClick,
  title,
  children,
  className = '',
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={
      `h-9 min-w-9 px-2 rounded-md flex items-center justify-center text-sm transition-colors cursor-pointer ` +
      (active
        ? 'bg-violet-600 text-white'
        : 'text-neutral-200 hover:bg-neutral-700') +
      ` ${className}`
    }
  >
    {children}
  </button>
);

const PanelBtn = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'h-9 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ' +
      (active ? 'bg-violet-600 text-white' : 'text-neutral-200 hover:bg-neutral-700')
    }
  >
    {label}
  </button>
);

const Sep = () => <div className="w-px h-6 bg-neutral-600 mx-0.5 shrink-0" />;

const DeleteBtn = ({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) => {
  if (!onClick) return null;
  return (
    <Btn
      title={disabled ? 'Precisa de pelo menos um fundo' : 'Excluir (Delete)'}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={
        disabled
          ? 'opacity-40 pointer-events-none'
          : 'text-red-300 hover:bg-red-600 hover:text-white'
      }
    >
      <Trash2 size={16} />
    </Btn>
  );
};

const RemoveBgBtn = ({
  onClick,
  busy,
}: {
  onClick?: () => void;
  busy?: boolean;
}) => {
  if (!onClick) return null;
  return (
    <button
      type="button"
      title="Recortar o fundo da imagem com IA"
      disabled={busy}
      onClick={onClick}
      className={
        'h-9 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors flex items-center gap-1.5 ' +
        (busy
          ? 'bg-violet-700/80 text-white cursor-wait'
          : 'text-neutral-200 hover:bg-neutral-700')
      }
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <WandSparkles size={15} />}
      {busy ? 'Removendo...' : 'Remover fundo'}
    </button>
  );
};

export const EditorToolbar = ({
  layer,
  scene,
  clip,
  selectedClipId,
  selectionCount = 0,
  playheadSec,
  onUpdateLayer,
  onUpdateSceneDuration,
  onUpdateSceneColor,
  onUpdateClip,
  onSplitAtPlayhead,
  onOpenPanel,
  onOpenTransition,
  activePanel,
  onRemoveBackground,
  removingBackground,
  onDelete,
  canDeleteScene = true,
  hideTimelineTools = false,
  stylePaintArmed = false,
  onToggleStylePaint,
}: EditorToolbarProps) => {
  if (selectionCount > 1) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 border border-violet-500/50 text-sm text-neutral-200">
        <span className="font-medium text-violet-200">{selectionCount} itens</span>
        <span className="text-neutral-400">Arraste um na timeline para mover todos. Shift+clique soma na seleção.</span>
        <DeleteBtn onClick={onDelete} />
      </div>
    );
  }
  if (layer) {
    return (
      <LayerToolbar
        layer={layer}
        playheadSec={playheadSec}
        onUpdateLayer={onUpdateLayer}
        onSplitAtPlayhead={onSplitAtPlayhead}
        onOpenPanel={onOpenPanel}
        activePanel={activePanel}
        onRemoveBackground={onRemoveBackground}
        removingBackground={removingBackground}
        onDelete={onDelete}
        hideTimelineTools={hideTimelineTools}
        stylePaintArmed={stylePaintArmed}
        onToggleStylePaint={onToggleStylePaint}
      />
    );
  }

  if (clip && selectedClipId) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
        <Music size={16} className="text-violet-300 ml-1" />
        <span className="text-sm text-neutral-200 truncate max-w-[160px]">{clip.label || 'Áudio'}</span>
        <Sep />
        <label
          className="h-9 flex items-center gap-1.5 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-sm text-neutral-200"
          title="Duração"
        >
          <Timer size={15} className="text-neutral-400" />
          <input
            type="number"
            min={0.1}
            step={0.1}
            className="w-14 bg-transparent outline-none text-sm tabular-nums"
            value={Number(clip.durationSec.toFixed(1))}
            onChange={(e) =>
              onUpdateClip(clip.trackId, selectedClipId, { durationSec: Number(e.target.value) })
            }
          />
          <span className="text-neutral-500 text-xs">s</span>
        </label>
        <label
          className="h-9 flex items-center gap-1.5 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-sm text-neutral-200"
          title="Volume"
        >
          <Volume2 size={15} className="text-neutral-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            className="w-20 accent-violet-500"
            value={clip.volume ?? 1}
            onChange={(e) =>
              onUpdateClip(clip.trackId, selectedClipId, { volume: Number(e.target.value) })
            }
            {...historyGestureBind}
          />
        </label>
        <Sep />
        <DeleteBtn onClick={onDelete} />
      </div>
    );
  }

  if (scene) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
        <span className="text-sm text-neutral-200 px-1">{scene.name || 'Fundo'}</span>
        <Sep />
        {!hideTimelineTools && (
        <label
          className="h-9 flex items-center gap-1.5 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-sm text-neutral-200"
          title="Duração do fundo"
        >
          <Timer size={15} className="text-neutral-400" />
          <input
            type="number"
            min={0.5}
            step={0.1}
            className="w-14 bg-transparent outline-none text-sm tabular-nums"
            value={Number(scene.durationSec.toFixed(1))}
            onChange={(e) => onUpdateSceneDuration(scene.id, Number(e.target.value))}
          />
          <span className="text-neutral-500 text-xs">s</span>
        </label>
        )}
        <label
          className="relative h-9 w-9 rounded-md border border-neutral-600 overflow-hidden cursor-pointer"
          title="Cor do fundo"
        >
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={scene.backgroundColor ?? '#ffffff'}
            onChange={(e) => onUpdateSceneColor(scene.id, e.target.value)}
            {...historyGestureBind}
          />
          <span className="block w-full h-full" style={{ background: scene.backgroundColor ?? '#ffffff' }} />
        </label>
        {!hideTimelineTools && (
          <PanelBtn label="Transição" active={false} onClick={() => onOpenTransition(scene.id)} />
        )}
        <PanelBtn
          label="Posição"
          active={activePanel === 'position'}
          onClick={() => onOpenPanel(activePanel === 'position' ? 'none' : 'position')}
        />
        {scene.backgroundSrc ? (
          <RemoveBgBtn onClick={onRemoveBackground} busy={removingBackground} />
        ) : null}
        <Sep />
        <DeleteBtn onClick={onDelete} disabled={!canDeleteScene} />
      </div>
    );
  }

  return (
    <div className="h-11 flex items-center justify-center rounded-lg bg-neutral-800/80 border border-neutral-700 text-sm text-neutral-400">
      Clique em um elemento, fundo ou áudio para editar
    </div>
  );
};

const LayerToolbar = ({
  layer,
  playheadSec,
  onUpdateLayer,
  onSplitAtPlayhead,
  onOpenPanel,
  activePanel,
  onRemoveBackground,
  removingBackground,
  onDelete,
  hideTimelineTools = false,
  stylePaintArmed = false,
  onToggleStylePaint,
}: {
  layer: Layer;
  playheadSec: number;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onSplitAtPlayhead: (id: string) => void;
  onOpenPanel: (panel: ElementSidePanel) => void;
  activePanel: ElementSidePanel;
  onRemoveBackground?: () => void;
  removingBackground?: boolean;
  onDelete?: () => void;
  hideTimelineTools?: boolean;
  stylePaintArmed?: boolean;
  onToggleStylePaint?: () => void;
}) => {
  const canSplit =
    playheadSec > layer.startSec + 0.05 &&
    playheadSec < layer.startSec + layer.durationSec - 0.05;

  const togglePanel = (panel: Exclude<ElementSidePanel, 'none'>) => {
    onOpenPanel(activePanel === panel ? 'none' : panel);
  };

  if (layer.type === 'text') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
        <select
          className="h-9 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-sm text-neutral-100 min-w-[120px]"
          value={layer.fontFamily}
          onChange={(e) => onUpdateLayer(layer.id, { fontFamily: e.target.value })}
        >
          <option value="sans-serif">Sans-serif</option>
          <option value="Montserrat, sans-serif">Montserrat</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="monospace">Monoespaçada</option>
        </select>
        <input
          type="number"
          min={12}
          max={200}
          title="Tamanho da fonte"
          className="h-9 w-16 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-sm text-neutral-100"
          value={layer.fontSize}
          onChange={(e) => onUpdateLayer(layer.id, { fontSize: Number(e.target.value) })}
        />
        <label className="relative h-9 w-9 rounded-md border border-neutral-600 overflow-hidden cursor-pointer" title="Cor do texto">
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={layer.color}
            onChange={(e) => onUpdateLayer(layer.id, { color: e.target.value })}
            {...historyGestureBind}
          />
          <span className="block w-full h-full" style={{ background: layer.color }} />
        </label>
        <Sep />
        <Btn
          title="Negrito"
          active={Boolean(layer.bold)}
          onClick={() => onUpdateLayer(layer.id, { bold: !layer.bold })}
        >
          <Bold size={16} />
        </Btn>
        <Btn
          title="Itálico"
          active={Boolean(layer.italic)}
          onClick={() => onUpdateLayer(layer.id, { italic: !layer.italic })}
        >
          <Italic size={16} />
        </Btn>
        <Btn
          title="Sublinhado"
          active={Boolean(layer.underline)}
          onClick={() => onUpdateLayer(layer.id, { underline: !layer.underline })}
        >
          <Underline size={16} />
        </Btn>
        <Sep />
        <Btn
          title="Alinhar à esquerda"
          active={layer.align === 'left' || !layer.align}
          onClick={() => onUpdateLayer(layer.id, { align: 'left' })}
        >
          <AlignLeft size={16} />
        </Btn>
        <Btn
          title="Centralizar"
          active={layer.align === 'center'}
          onClick={() => onUpdateLayer(layer.id, { align: 'center' })}
        >
          <AlignCenter size={16} />
        </Btn>
        <Btn
          title="Alinhar à direita"
          active={layer.align === 'right'}
          onClick={() => onUpdateLayer(layer.id, { align: 'right' })}
        >
          <AlignRight size={16} />
        </Btn>
        <Sep />
        <SharedElementControls
          layer={layer}
          canSplit={canSplit}
          onUpdateLayer={onUpdateLayer}
          onSplit={() => onSplitAtPlayhead(layer.id)}
          activePanel={activePanel}
          onTogglePanel={togglePanel}
          hideTimelineTools={hideTimelineTools}
          stylePaintArmed={stylePaintArmed}
          onToggleStylePaint={onToggleStylePaint}
        />
        <Sep />
        <DeleteBtn onClick={onDelete} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
      {!hideTimelineTools && (
        <>
          <Btn
            title="Dividir no playhead"
            onClick={() => onSplitAtPlayhead(layer.id)}
            className={canSplit ? '' : 'opacity-40 pointer-events-none'}
          >
            <Scissors size={16} />
          </Btn>
          <label
            className="h-9 flex items-center gap-1.5 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-sm text-neutral-200 cursor-pointer"
            title="Duração do elemento na timeline"
          >
            <Timer size={15} className="text-neutral-400" />
            <input
              type="number"
              min={0.5}
              step={0.1}
              className="w-14 bg-transparent outline-none text-sm tabular-nums"
              value={Number(layer.durationSec.toFixed(1))}
              onChange={(e) => onUpdateLayer(layer.id, { durationSec: Number(e.target.value) })}
            />
            <span className="text-neutral-500 text-xs">s</span>
          </label>
        </>
      )}
      <Btn
        title={layer.flipX ? 'Tirar espelho horizontal' : 'Espelhar horizontal'}
        active={Boolean(layer.flipX)}
        onClick={() => onUpdateLayer(layer.id, { flipX: !layer.flipX })}
      >
        <FlipHorizontal2 size={16} />
      </Btn>
      <RemoveBgBtn onClick={onRemoveBackground} busy={removingBackground} />
      <Sep />
      <label className="relative h-9 w-9 rounded-md border border-neutral-600 overflow-hidden cursor-pointer" title="Cor de fundo (atrás da imagem)">
        <input
          type="color"
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={layer.fillColor && layer.fillColor !== 'transparent' ? layer.fillColor : '#ffffff'}
          onChange={(e) => onUpdateLayer(layer.id, { fillColor: e.target.value })}
          {...historyGestureBind}
        />
        <span
          className="block w-full h-full"
          style={{
            background:
              !layer.fillColor || layer.fillColor === 'transparent'
                ? 'repeating-conic-gradient(#555 0% 25%, #444 0% 50%) 50% / 8px 8px'
                : layer.fillColor,
          }}
        />
      </label>
      <label className="h-9 flex items-center gap-1 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-xs text-neutral-400" title="Espessura da borda (0-100%)">
        Borda
        <input
          type="number"
          min={0}
          max={100}
          className="w-10 bg-transparent outline-none text-neutral-100 text-sm"
          value={asPercent(layer.borderWidth)}
          onChange={(e) =>
            onUpdateLayer(layer.id, { borderWidth: Math.min(100, Math.max(0, Number(e.target.value))) })
          }
        />
        <span>%</span>
      </label>
      <label className="relative h-9 w-9 rounded-md border border-neutral-600 overflow-hidden cursor-pointer" title="Cor da borda">
        <input
          type="color"
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={layer.borderColor ?? '#ffffff'}
          onChange={(e) => onUpdateLayer(layer.id, { borderColor: e.target.value })}
          {...historyGestureBind}
        />
        <span className="block w-full h-full border-4 border-current" style={{ color: layer.borderColor ?? '#fff' }} />
      </label>
      <label className="h-9 flex items-center gap-1 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-xs text-neutral-400" title="Arredondamento (0-100%)">
        ⌒
        <input
          type="number"
          min={0}
          max={100}
          className="w-10 bg-transparent outline-none text-neutral-100 text-sm"
          value={asPercent(layer.cornerRadius)}
          onChange={(e) =>
            onUpdateLayer(layer.id, { cornerRadius: Math.min(100, Math.max(0, Number(e.target.value))) })
          }
        />
        <span>%</span>
      </label>
      <Sep />
      <PanelBtn label="Efeitos" active={activePanel === 'effects'} onClick={() => togglePanel('effects')} />
      <PanelBtn label="Animar" active={activePanel === 'animate'} onClick={() => togglePanel('animate')} />
      <PanelBtn label="Posição" active={activePanel === 'position'} onClick={() => togglePanel('position')} />
      <Btn
        title={stylePaintArmed ? 'Copiar estilo (clique em outro elemento, Esc cancela)' : 'Copiar estilo'}
        active={stylePaintArmed}
        onClick={() => onToggleStylePaint?.()}
      >
        <Paintbrush size={16} />
      </Btn>
      <Sep />
      <DeleteBtn onClick={onDelete} />
    </div>
  );
};

const SharedElementControls = ({
  layer,
  canSplit,
  onUpdateLayer,
  onSplit,
  activePanel,
  onTogglePanel,
  hideTimelineTools,
  stylePaintArmed,
  onToggleStylePaint,
}: {
  layer: Layer;
  canSplit: boolean;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onSplit: () => void;
  activePanel: ElementSidePanel;
  onTogglePanel: (p: Exclude<ElementSidePanel, 'none'>) => void;
  hideTimelineTools?: boolean;
  stylePaintArmed?: boolean;
  onToggleStylePaint?: () => void;
}) => (
  <>
    {!hideTimelineTools && (
      <>
        <Btn title="Dividir no playhead" onClick={onSplit} className={canSplit ? '' : 'opacity-40 pointer-events-none'}>
          <Scissors size={16} />
        </Btn>
        <label
          className="h-9 flex items-center gap-1.5 px-2 rounded-md bg-neutral-900 border border-neutral-600 text-sm text-neutral-200"
          title="Duração na timeline"
        >
          <Timer size={15} className="text-neutral-400" />
          <input
            type="number"
            min={0.5}
            step={0.1}
            className="w-14 bg-transparent outline-none text-sm tabular-nums"
            value={Number(layer.durationSec.toFixed(1))}
            onChange={(e) => onUpdateLayer(layer.id, { durationSec: Number(e.target.value) })}
          />
          <span className="text-neutral-500 text-xs">s</span>
        </label>
      </>
    )}
    <PanelBtn label="Efeitos" active={activePanel === 'effects'} onClick={() => onTogglePanel('effects')} />
    <PanelBtn label="Animar" active={activePanel === 'animate'} onClick={() => onTogglePanel('animate')} />
    <PanelBtn label="Posição" active={activePanel === 'position'} onClick={() => onTogglePanel('position')} />
    <Btn
      title={stylePaintArmed ? 'Copiar estilo (clique em outro elemento, Esc cancela)' : 'Copiar estilo'}
      active={stylePaintArmed}
      onClick={() => onToggleStylePaint?.()}
    >
      <Paintbrush size={16} />
    </Btn>
  </>
);
