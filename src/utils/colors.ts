const COLOR_STYLES: Record<string, string> = {
  'bg-blue-500':    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  'bg-fuchsia-500': 'bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30',
  'bg-purple-500':  'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  'bg-red-500':     'bg-red-500/15 text-red-400 border border-red-500/30',
  'bg-green-500':   'bg-green-500/15 text-green-400 border border-green-500/30',
  'bg-yellow-500':  'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  'bg-orange-500':  'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  'bg-pink-500':    'bg-pink-500/15 text-pink-400 border border-pink-500/30',
  'bg-indigo-500':  'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  'bg-teal-500':    'bg-teal-500/15 text-teal-400 border border-teal-500/30',
  'bg-cyan-500':    'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  'bg-rose-500':    'bg-rose-500/15 text-rose-400 border border-rose-500/30',
};

const FALLBACK = 'bg-elements text-text-secondary border border-border-base';

export const getCategoryStyles = (bgClass?: string) => {
  if (!bgClass) return FALLBACK;
  return COLOR_STYLES[bgClass] ?? FALLBACK;
};

export const CATEGORY_COLOR_OPTIONS = Object.keys(COLOR_STYLES);
