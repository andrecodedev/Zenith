import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import type { AudioTrack, VideoProject, VideoScene } from '../../../types/video-project';
import { projectTotalDurationSec, sceneStartTimes } from '../../../types/video-project';

type TimelineProps = {
  project: VideoProject;
  activeSceneId: string | null;
  playheadSec: number;
  selectedClipId: string | null;
  onSelectScene: (id: string) => void;
  onAddScene: () => void;
  onDuplicateScene: (id: string) => void;
  onRemoveScene: (id: string) => void;
  onRenameScene: (id: string, name: string) => void;
  onSetSceneDuration: (id: string, sec: number) => void;
  onReorderScene: (from: number, to: number) => void;
  onSetPlayhead: (sec: number) => void;
  onSelectClip: (id: string | null) => void;
  onAddAudioTrack: () => void;
  onRemoveAudioTrack: (id: string) => void;
  onAddAudioClip: (trackId: string) => void;
  onRemoveAudioClip: (trackId: string, clipId: string) => void;
};

const PIXELS_PER_SEC = 24;

export const Timeline = ({
  project,
  activeSceneId,
  playheadSec,
  selectedClipId,
  onSelectScene,
  onAddScene,
  onDuplicateScene,
  onRemoveScene,
  onRenameScene,
  onSetSceneDuration,
  onReorderScene,
  onSetPlayhead,
  onSelectClip,
  onAddAudioTrack,
  onRemoveAudioTrack,
  onAddAudioClip,
  onRemoveAudioClip,
}: TimelineProps) => {
  const totalSec = projectTotalDurationSec(project);
  const width = Math.max(totalSec * PIXELS_PER_SEC, 600);
  const starts = sceneStartTimes(project);

  const sceneBlock = (scene: VideoScene, index: number) => {
    const left = (starts.get(scene.id) ?? 0) * PIXELS_PER_SEC;
    const w = scene.durationSec * PIXELS_PER_SEC;
    const active = scene.id === activeSceneId;
    return (
      <div
        key={scene.id}
        className={`absolute top-1 bottom-1 rounded-md border px-2 flex items-center gap-1 text-xs cursor-pointer transition-colors ${
          active
            ? 'bg-amber-500/20 border-amber-400/60 text-text-primary'
            : 'bg-elements/40 border-border-base text-text-secondary hover:border-text-tertiary'
        }`}
        style={{ left, width: w }}
        onClick={() => onSelectScene(scene.id)}
      >
        <GripVertical size={12} className="shrink-0 opacity-50" />
        <input
          className="bg-transparent border-none outline-none flex-1 min-w-0 text-xs font-medium truncate"
          value={scene.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRenameScene(scene.id, e.target.value)}
        />
        <button
          type="button"
          className="p-0.5 hover:text-text-primary"
          title="Duplicar"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicateScene(scene.id);
          }}
        >
          <Copy size={12} />
        </button>
        {project.scenes.length > 1 && (
          <button
            type="button"
            className="p-0.5 hover:text-red-400"
            title="Remover"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveScene(scene.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
        <input
          type="number"
          min={0.5}
          step={0.5}
          className="w-12 bg-bg-primary/50 rounded px-1 text-[10px] border border-border-base"
          value={scene.durationSec}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSetSceneDuration(scene.id, Number(e.target.value))}
        />
        <span className="text-[10px] text-text-tertiary hidden sm:inline">s</span>
        {index > 0 && (
          <button
            type="button"
            className="text-[9px] text-text-tertiary hover:text-text-primary ml-1"
            onClick={(e) => {
              e.stopPropagation();
              onReorderScene(index, index - 1);
            }}
          >
            ←
          </button>
        )}
        {index < project.scenes.length - 1 && (
          <button
            type="button"
            className="text-[9px] text-text-tertiary hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onReorderScene(index, index + 1);
            }}
          >
            →
          </button>
        )}
      </div>
    );
  };

  const audioRow = (track: AudioTrack) => (
    <div key={track.id} className="flex border-b border-border-base/40 min-h-[44px]">
      <div className="w-28 shrink-0 px-2 py-2 border-r border-border-base/40 flex flex-col justify-center gap-1">
        <span className="text-xs font-medium truncate">{track.name}</span>
        <div className="flex gap-1">
          <button
            type="button"
            className="text-[10px] text-text-tertiary hover:text-text-primary flex items-center gap-0.5"
            onClick={() => onAddAudioClip(track.id)}
          >
            <Plus size={10} /> clip
          </button>
          {project.audioTracks.length > 1 && (
            <button
              type="button"
              className="text-[10px] text-red-400/80 hover:text-red-400"
              onClick={() => onRemoveAudioTrack(track.id)}
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
      <div className="relative flex-1 overflow-x-auto">
        <div className="relative h-full min-w-full" style={{ width }}>
          {track.clips.map((clip) => {
            const left = clip.startSec * PIXELS_PER_SEC;
            const w = Math.max(clip.durationSec * PIXELS_PER_SEC, 20);
            const selected = clip.id === selectedClipId;
            return (
              <div
                key={clip.id}
                className={`absolute top-1.5 bottom-1.5 rounded border px-1.5 flex items-center text-[10px] cursor-pointer truncate ${
                  selected
                    ? 'bg-sky-500/25 border-sky-400/70'
                    : 'bg-elements/50 border-border-base hover:border-text-tertiary'
                }`}
                style={{ left, width: w }}
                onClick={() => onSelectClip(clip.id)}
                title={clip.label || clip.src}
              >
                <span className="truncate">{clip.label || 'Áudio'}</span>
                <button
                  type="button"
                  className="ml-auto pl-1 text-red-400/80 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAudioClip(track.id, clip.id);
                  }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="border border-border-base rounded-xl bg-bg-secondary/40 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-base/60">
        <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Timeline</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddScene}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-btn-bg border border-border-base hover:bg-elements cursor-pointer"
          >
            <Plus size={12} /> Cena
          </button>
          <button
            type="button"
            onClick={onAddAudioTrack}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-btn-bg border border-border-base hover:bg-elements cursor-pointer"
          >
            <Plus size={12} /> Faixa áudio
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="relative" style={{ width, minHeight: 48 }}>
          <div
            className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none"
            style={{ left: playheadSec * PIXELS_PER_SEC }}
          />
          <div
            className="h-12 relative border-b border-border-base/40 bg-bg-primary/30"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left + e.currentTarget.parentElement!.scrollLeft;
              onSetPlayhead(x / PIXELS_PER_SEC);
            }}
          >
            {project.scenes.map((s, i) => sceneBlock(s, i))}
          </div>
        </div>

        {project.audioTracks.map(audioRow)}
      </div>

      <div className="px-3 py-1.5 text-[10px] text-text-tertiary border-t border-border-base/40">
        {project.audioTracks.reduce((n, t) => n + t.clips.length, 0)} clips de áudio · duração total{' '}
        {totalSec.toFixed(1)}s
      </div>
    </div>
  );
};
