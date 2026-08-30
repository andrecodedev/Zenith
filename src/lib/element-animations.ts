import type { ElementAnimation, AnimationType } from '../types/element-style';
import { speedFactor } from '../types/element-style';

export type AnimTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  opacity: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** progress 0..1 dentro da fase da animação */
export const animProgressForElement = (
  localT: number,
  phase: ElementAnimation['phase'],
  speed: ElementAnimation['speed'],
): number | null => {
  const span = 0.35 / speedFactor(speed);
  if (phase === 'in') {
    if (localT > span) return null;
    return easeOut(localT / span);
  }
  if (phase === 'out') {
    if (localT < 1 - span) return null;
    return easeOut((localT - (1 - span)) / span);
  }
  if (localT <= span) return easeOut(localT / span);
  if (localT >= 1 - span) return easeOut((localT - (1 - span)) / span);
  return null;
};

export const computeAnimationTransform = (
  type: AnimationType,
  p: number,
  intensity: number,
  direction: 'left' | 'right',
  isOut: boolean,
): AnimTransform => {
  const k = intensity;
  const t = isOut ? 1 - p : p;
  const base: AnimTransform = { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, opacity: 1 };

  if (type === 'none') return base;

  const dir = direction === 'right' ? 1 : -1;

  switch (type) {
    case 'rise':
    case 'ascend':
      return { ...base, offsetY: lerp(80 * k, 0, t), opacity: lerp(0.2, 1, t) };
    case 'from-bottom':
      return { ...base, offsetY: lerp(120 * k, 0, t), opacity: lerp(0, 1, t) };
    case 'pan':
      return { ...base, offsetX: lerp(60 * k * dir, 0, t) };
    case 'pop':
    case 'zoom':
      return { ...base, scale: lerp(0.3, 1, easeOut(t)), opacity: lerp(0, 1, t) };
    case 'bounce':
      return {
        ...base,
        offsetY: lerp(40 * k, 0, t),
        scale: lerp(0.85, 1, easeInOut(t)),
      };
    case 'drift':
    case 'flow':
      return { ...base, offsetX: lerp(30 * k * dir, 0, t), offsetY: lerp(-20 * k, 0, t) };
    case 'blur':
      return { ...base, opacity: lerp(0, 1, t), scale: lerp(1.05, 1, t) };
    case 'sequence':
    case 'breath':
      return { ...base, scale: lerp(0.92, 1, t), opacity: lerp(0.5, 1, t) };
    case 'tectonic':
      return { ...base, offsetX: lerp(20 * k * dir, 0, t), rotation: lerp(-4 * k, 0, t) };
    case 'somersault':
      return { ...base, rotation: lerp(180 * k, 0, t), scale: lerp(0.5, 1, t) };
    case 'neon':
    case 'cutout':
      return { ...base, opacity: lerp(0, 1, t), scale: lerp(0.98, 1, t) };
    case 'stomp':
      return { ...base, scale: lerp(1.3, 1, easeOut(t)), offsetY: lerp(-15 * k, 0, t) };
    case 'spin':
      return { ...base, rotation: lerp(360 * k, 0, t), scale: lerp(0.4, 1, t) };
    case 'blink':
      return { ...base, opacity: t < 0.5 ? 0.2 : 1 };
    case 'pulse':
      return { ...base, scale: 1 + Math.sin(t * Math.PI) * 0.08 * k };
    case 'shake':
      return { ...base, offsetX: Math.sin(t * Math.PI * 6) * 12 * k * (1 - t) };
    case 'fade':
      return { ...base, opacity: isOut ? 1 - t : t };
    case 'slide-left':
      return { ...base, offsetX: lerp(-80 * k, 0, t) };
    case 'slide-right':
      return { ...base, offsetX: lerp(80 * k, 0, t) };
    default:
      return base;
  }
};

export const getElementAnimTransform = (
  anim: ElementAnimation | undefined,
  localT: number,
): AnimTransform => {
  if (!anim || anim.type === 'none') {
    return { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, opacity: 1 };
  }

  const span = 0.35 / speedFactor(anim.speed);
  const intensity = anim.intensity ?? 0.7;
  const baseDir = anim.direction ?? 'left';
  const dirFor = (isOut: boolean) => {
    if (isOut && anim.reverseExit) return baseDir === 'left' ? 'right' : 'left';
    return baseDir;
  };

  if (anim.phase === 'in') {
    const p = animProgressForElement(localT, 'in', anim.speed);
    if (p == null) return { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, opacity: 1 };
    return computeAnimationTransform(anim.type, p, intensity, dirFor(false), false);
  }
  if (anim.phase === 'out') {
    const p = animProgressForElement(localT, 'out', anim.speed);
    if (p == null) return { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, opacity: 1 };
    return computeAnimationTransform(anim.type, p, intensity, dirFor(true), true);
  }

  if (localT <= span) {
    const p = easeOut(localT / span);
    return computeAnimationTransform(anim.type, p, intensity, dirFor(false), false);
  }
  if (localT >= 1 - span) {
    const p = easeOut((localT - (1 - span)) / span);
    return computeAnimationTransform(anim.type, p, intensity, dirFor(true), true);
  }
  return { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, opacity: 1 };
};
