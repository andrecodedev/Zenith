import type { ElementEffect } from '../types/element-style';

export const effectKonvaProps = (
  effect: ElementEffect | undefined,
  playheadSec: number,
): {
  shadowBlur?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  offsetX?: number;
  opacity?: number;
} => {
  if (!effect || effect === 'none') return {};

  switch (effect) {
    case 'glow':
      return { shadowBlur: 24, shadowColor: '#c4b5fd', shadowOpacity: 0.95 };
    case 'neon':
      return { shadowBlur: 36, shadowColor: '#22d3ee', shadowOpacity: 1 };
    case 'shadow':
      return { shadowBlur: 16, shadowColor: '#000000', shadowOpacity: 0.55, shadowOffsetY: 8 };
    case 'echo':
      return { shadowBlur: 8, shadowColor: '#ffffff', shadowOpacity: 0.35, shadowOffsetX: 6, shadowOffsetY: 6 };
    case 'glitch':
      return {
        offsetX: Math.sin(playheadSec * 40) * 4,
        shadowBlur: 4,
        shadowColor: '#f472b6',
        shadowOpacity: 0.6,
        shadowOffsetX: Math.cos(playheadSec * 35) * 6,
      };
    case 'retro':
      return { shadowBlur: 0, shadowColor: '#f97316', shadowOpacity: 0.4, shadowOffsetX: 3 };
    case 'vhs':
      return {
        shadowBlur: 2,
        shadowColor: '#ef4444',
        shadowOpacity: 0.5,
        offsetX: Math.sin(playheadSec * 20) * 2,
      };
    default:
      return {};
  }
};
