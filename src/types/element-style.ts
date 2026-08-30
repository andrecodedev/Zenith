export type ElementEffect =
  | 'none'
  | 'glow'
  | 'neon'
  | 'shadow'
  | 'retro'
  | 'vhs'
  | 'echo'
  | 'glitch';

export type AnimationType =
  | 'none'
  | 'rise'
  | 'pan'
  | 'pop'
  | 'bounce'
  | 'drift'
  | 'blur'
  | 'sequence'
  | 'breath'
  | 'from-bottom'
  | 'tectonic'
  | 'somersault'
  | 'neon'
  | 'cutout'
  | 'stomp'
  | 'flow'
  | 'ascend'
  | 'zoom'
  | 'spin'
  | 'blink'
  | 'pulse'
  | 'shake'
  | 'fade'
  | 'slide-left'
  | 'slide-right';

export type AnimationPhase = 'both' | 'in' | 'out';
export type AnimationSpeed = 'slow' | 'medium' | 'fast';

export interface ElementAnimation {
  type: AnimationType;
  phase: AnimationPhase;
  speed: AnimationSpeed;
  intensity?: number;
  direction?: 'left' | 'right';
  /** Saída na direção oposta à entrada (estilo Canva). */
  reverseExit?: boolean;
}

export interface ElementVisualStyle {
  borderWidth?: number;
  borderColor?: string;
  cornerRadius?: number;
  fillColor?: string;
  effect?: ElementEffect;
  animation?: ElementAnimation;
}

export type AnimationCategory = {
  title: string;
  items: { id: AnimationType; label: string }[];
};

export const ANIMATION_CATALOG: AnimationCategory[] = [
  {
    title: 'Geral',
    items: [
      { id: 'rise', label: 'Elevação' },
      { id: 'pan', label: 'Panorama' },
      { id: 'pop', label: 'Surgir' },
      { id: 'bounce', label: 'Quicar' },
      { id: 'drift', label: 'Correnteza' },
      { id: 'blur', label: 'Desfoque' },
      { id: 'sequence', label: 'Sequência' },
      { id: 'breath', label: 'Sopro' },
      { id: 'from-bottom', label: 'De baixo' },
    ],
  },
  {
    title: 'Movimento',
    items: [
      { id: 'tectonic', label: 'Tectônico' },
      { id: 'somersault', label: 'Cambalhota' },
      { id: 'neon', label: 'Neon' },
      { id: 'cutout', label: 'Recorte' },
      { id: 'stomp', label: 'Arrancada' },
    ],
  },
  {
    title: 'Sugestões',
    items: [
      { id: 'flow', label: 'Fluxo' },
      { id: 'ascend', label: 'Ascensão' },
      { id: 'zoom', label: 'Zoom' },
    ],
  },
  {
    title: 'Efeitos adicionais',
    items: [
      { id: 'spin', label: 'Girar' },
      { id: 'blink', label: 'Piscar' },
      { id: 'pulse', label: 'Pulsar' },
      { id: 'shake', label: 'Sacudir' },
      { id: 'fade', label: 'Desvanecer' },
      { id: 'slide-left', label: 'Deslizar esq.' },
      { id: 'slide-right', label: 'Deslizar dir.' },
    ],
  },
];

export const ELEMENT_EFFECTS: { id: ElementEffect; label: string }[] = [
  { id: 'none', label: 'Nenhum' },
  { id: 'glow', label: 'Brilhante' },
  { id: 'neon', label: 'Neon' },
  { id: 'shadow', label: 'Sombra' },
  { id: 'echo', label: 'Eco' },
  { id: 'glitch', label: 'Falha' },
  { id: 'retro', label: 'Retrô' },
  { id: 'vhs', label: 'VHS' },
];

export const speedFactor = (speed: AnimationSpeed) =>
  speed === 'slow' ? 1.6 : speed === 'fast' ? 0.55 : 1;

export const defaultAnimation = (): ElementAnimation => ({
  type: 'none',
  phase: 'both',
  speed: 'medium',
  intensity: 0.7,
  direction: 'left',
});

export type CopiedElementStyle = ElementVisualStyle & {
  opacity?: number;
  text?: {
    fontFamily: string;
    fontSize: number;
    color: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
};

export const snapshotElementStyle = (el: {
  type: string;
  borderWidth?: number;
  borderColor?: string;
  cornerRadius?: number;
  fillColor?: string;
  effect?: ElementEffect;
  animation?: ElementAnimation;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}): CopiedElementStyle => {
  const visual: CopiedElementStyle = {
    borderWidth: el.borderWidth ?? 0,
    borderColor: el.borderColor ?? '#ffffff',
    cornerRadius: el.cornerRadius ?? 0,
    fillColor: el.fillColor,
    effect: el.effect ?? 'none',
    animation: el.animation ? { ...el.animation } : undefined,
    opacity: el.opacity ?? 1,
  };
  if (el.type === 'text') {
    visual.text = {
      fontFamily: el.fontFamily ?? 'sans-serif',
      fontSize: el.fontSize ?? 48,
      color: el.color ?? '#111827',
      align: el.align,
      bold: el.bold,
      italic: el.italic,
      underline: el.underline,
    };
  }
  return visual;
};

export const stylePatchFromClipboard = (
  targetType: string,
  style: CopiedElementStyle,
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {
    borderWidth: style.borderWidth,
    borderColor: style.borderColor,
    cornerRadius: style.cornerRadius,
    fillColor: style.fillColor,
    effect: style.effect,
    animation: style.animation,
    opacity: style.opacity,
  };
  if (targetType === 'text' && style.text) {
    return { ...patch, ...style.text };
  }
  return patch;
};
