import { useEffect, useRef } from 'react';
import { useVideoEditorStore } from '../../../store/useVideoEditorStore';
import { resolveAssetSrc } from '../../../lib/video-assets';
import { projectAudioTrack } from '../../../types/video-project';

type Slot = {
  el: HTMLAudioElement;
  src: string;
  running: boolean;
  starting: boolean;
};

const slots = new Map<string, Slot>();

const pauseSlot = (slot: Slot) => {
  slot.starting = false;
  slot.running = false;
  if (!slot.el.paused) slot.el.pause();
};

const pauseAll = () => {
  for (const slot of slots.values()) pauseSlot(slot);
};

const ensureSlot = (id: string, url: string): Slot => {
  let slot = slots.get(id);
  if (!slot) {
    const el = document.createElement('audio');
    el.preload = 'auto';
    el.muted = false;
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    el.setAttribute('playsinline', 'true');
    document.body.appendChild(el);
    slot = { el, src: '', running: false, starting: false };
    slots.set(id, slot);
  }
  if (url && slot.src !== url) {
    slot.src = url;
    slot.running = false;
    slot.starting = false;
    slot.el.src = url;
  }
  return slot;
};

const startSlot = (slot: Slot, atSec: number) => {
  if (slot.starting) return;
  slot.starting = true;

  const go = () => {
    const dur = slot.el.duration;
    if (Number.isFinite(dur) && dur > 0 && atSec >= dur - 0.02) {
      slot.starting = false;
      slot.running = true;
      return;
    }
    try {
      if (Number.isFinite(atSec)) slot.el.currentTime = Math.max(0, atSec);
    } catch {
      /* metadata ainda nao chegou */
    }
    slot.el.muted = false;
    void slot.el
      .play()
      .then(() => {
        slot.starting = false;
        slot.running = true;
      })
      .catch(() => {
        slot.starting = false;
        slot.running = false;
      });
  };

  if (slot.el.readyState >= 1) go();
  else slot.el.addEventListener('loadeddata', go, { once: true });
};

const clipsOf = (projectId: string | undefined, apiUrl: string) => {
  const { project, playheadSec, isPlaying } = useVideoEditorStore.getState();
  if (!project) return { playheadSec, isPlaying, items: [] as const };
  const items = projectAudioTrack(project).clips.map((clip) => ({
    clip,
    url: resolveAssetSrc(clip.src, projectId, apiUrl),
  }));
  return { playheadSec, isPlaying, items };
};

const syncPreviewAudio = (play: boolean, projectId: string | undefined, apiUrl: string) => {
  const { playheadSec, items } = clipsOf(projectId, apiUrl);
  if (!items.length) {
    if (!play) pauseAll();
    return;
  }

  const live = new Set<string>();
  for (const { clip, url } of items) {
    live.add(clip.id);
    if (!url) continue;
    const slot = ensureSlot(clip.id, url);
    slot.el.muted = false;
    slot.el.volume = Math.max(0, Math.min(1, clip.volume ?? 1));

    const local = playheadSec - clip.startSec;
    const active = play && local >= -0.05 && local < clip.durationSec;
    const want = (clip.trimStartSec ?? 0) + Math.max(0, local);

    if (!active) {
      pauseSlot(slot);
      continue;
    }

    if (slot.starting) continue;
    if (!slot.running) {
      startSlot(slot, want);
      continue;
    }

    if (slot.el.paused || slot.el.ended) continue;

    if (Math.abs((slot.el.currentTime || 0) - want) > 0.5) {
      try {
        slot.el.currentTime = want;
      } catch {
        /* ignore */
      }
    }
  }

  for (const [id, slot] of slots) {
    if (live.has(id)) continue;
    pauseSlot(slot);
    slot.el.remove();
    slots.delete(id);
  }
};

export const usePreviewAudio = (
  projectId: string | undefined,
  apiUrl: string,
  isPlaying: boolean,
) => {
  const argsRef = useRef({ projectId, apiUrl });
  argsRef.current = { projectId, apiUrl };

  useEffect(() => {
    const { items } = clipsOf(projectId, apiUrl);
    for (const { clip, url } of items) {
      if (url) ensureSlot(clip.id, url);
    }
  }, [projectId, apiUrl, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      pauseAll();
      return;
    }
    let raf = 0;
    const loop = () => {
      const { projectId: pid, apiUrl: url } = argsRef.current;
      syncPreviewAudio(true, pid, url);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return {
    onUserPlay: () => {
      const { projectId: pid, apiUrl: url } = argsRef.current;
      for (const slot of slots.values()) {
        slot.running = false;
        slot.starting = false;
      }
      syncPreviewAudio(true, pid, url);
    },
    onUserPause: () => {
      pauseAll();
    },
  };
};
