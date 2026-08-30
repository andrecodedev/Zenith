import type { DragEvent } from 'react';

export const ZENITH_IMAGE_DRAG = 'application/x-zenith-image';

export type ZenithImageDrag = {
  src: string;
  durationSec?: number;
};

export const startZenithImageDrag = (e: DragEvent, payload: ZenithImageDrag) => {
  e.dataTransfer.setData(ZENITH_IMAGE_DRAG, JSON.stringify(payload));
  e.dataTransfer.setData('text/plain', payload.src);
  e.dataTransfer.effectAllowed = 'copy';
};

export const readZenithImageDrag = (e: DragEvent): ZenithImageDrag | null => {
  const typed = e.dataTransfer.getData(ZENITH_IMAGE_DRAG);
  if (typed) {
    try {
      const parsed = JSON.parse(typed) as ZenithImageDrag;
      if (parsed?.src) return parsed;
    } catch {
      return null;
    }
  }
  const plain = e.dataTransfer.getData('text/plain');
  if (plain && (plain.startsWith('/') || plain.startsWith('asset://') || plain.startsWith('http'))) {
    return { src: plain };
  }
  return null;
};
