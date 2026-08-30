export type AppView =
  | 'hero'
  | 'sobre'
  | 'dashboard'
  | 'calendar'
  | 'stats'
  | 'notes'
  | 'finance'
  | 'investments'
  | 'hub'
  | 'music'
  | 'chat'
  | 'audio'
  | 'image_upscale'
  | 'voice_studio'
  | 'video_studio';

const VIEW_PATHS: Record<AppView, string> = {
  hero: '/',
  hub: '/',
  sobre: '/sobre',
  dashboard: '/rotina',
  calendar: '/calendario',
  stats: '/estatisticas',
  notes: '/notas',
  finance: '/financas',
  investments: '/investimentos',
  music: '/musica',
  chat: '/ia',
  audio: '/transcricoes',
  image_upscale: '/image-upscale',
  voice_studio: '/voice-studio',
  video_studio: '/video-studio',
};

const PATH_VIEWS: Record<string, AppView> = {
  '/': 'hub',
  '/sobre': 'sobre',
  '/rotina': 'dashboard',
  '/calendario': 'calendar',
  '/estatisticas': 'stats',
  '/notas': 'notes',
  '/financas': 'finance',
  '/investimentos': 'investments',
  '/musica': 'music',
  '/ia': 'chat',
  '/transcricoes': 'audio',
  '/image-upscale': 'image_upscale',
  '/voice-studio': 'voice_studio',
  '/video-studio': 'video_studio',
};

export const normalizePath = (pathname: string) => {
  const base = pathname.split('?')[0].split('#')[0];
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base || '/';
};

export const LAST_PATH_KEY = 'zenith_active_path';

export const isKnownAppPath = (pathname: string) =>
  normalizePath(pathname) in PATH_VIEWS;

export const viewFromPath = (pathname: string, loggedIn: boolean): AppView => {
  const path = normalizePath(pathname);
  if (path === '/') return loggedIn ? 'hub' : 'hero';
  const view = PATH_VIEWS[path];
  if (!view) return loggedIn ? 'hub' : 'hero';
  if (!loggedIn && view !== 'sobre') return 'hero';
  return view;
};

export const pathFromView = (view: AppView): string => VIEW_PATHS[view] ?? '/';

export const rememberActivePath = (view: AppView) => {
  sessionStorage.setItem(LAST_PATH_KEY, pathFromView(view));
};

/** Se a URL caiu em / mas o usuário estava em outro módulo, recupera o path salvo. */
export const resolveReturnPath = (pathname: string, loggedIn: boolean): string => {
  const path = normalizePath(pathname);
  if (!loggedIn || path !== '/') return path;
  const saved = sessionStorage.getItem(LAST_PATH_KEY);
  if (saved && saved !== '/' && isKnownAppPath(saved)) return saved;
  return path;
};

export const viewFromBrowserLocation = (pathname: string, loggedIn: boolean): AppView =>
  viewFromPath(resolveReturnPath(pathname, loggedIn), loggedIn);

export const syncUrlForView = (view: AppView, replace = false) => {
  const next = pathFromView(view);
  const current = normalizePath(window.location.pathname);
  if (current === next) return;
  const state = { zenithView: view };
  if (replace) window.history.replaceState(state, '', next);
  else window.history.pushState(state, '', next);
};
