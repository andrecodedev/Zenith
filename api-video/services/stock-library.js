import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const STOCK_THEMES = {
  image: [
    { id: 'pessoas', label: 'Pessoas', q: 'people portrait' },
    { id: 'animais', label: 'Animais', q: 'animals' },
    { id: 'computador', label: 'Computador', q: 'laptop coding computer' },
    { id: 'objetos', label: 'Objetos', q: 'objects still life' },
    { id: 'natureza', label: 'Natureza', q: 'nature landscape' },
    { id: 'cidade', label: 'Cidade', q: 'city street' },
  ],
  video: [
    { id: 'pessoas', label: 'Pessoas', q: 'people talking' },
    { id: 'computador', label: 'Computador', q: 'person using computer' },
    { id: 'escritorio', label: 'Escritório', q: 'office work' },
    { id: 'codigo', label: 'Código', q: 'programming code screen' },
    { id: 'rua', label: 'Cidade', q: 'city street' },
  ],
  audio: [
    // Queries curtas: Jamendo falha com frase longa e cai no fallback.
    { id: 'lofi', label: 'Lo-fi', q: 'lofi' },
    { id: 'suspense', label: 'Suspense', q: 'cinematic' },
    { id: 'transicao', label: 'Transição', q: 'ambient' },
    { id: 'corporativo', label: 'Corporativo', q: 'corporate' },
    { id: 'alegre', label: 'Alegre', q: 'happy' },
  ],
};

const ALLOW_HOSTS = [
  'images.pexels.com',
  'videos.pexels.com',
  'player.vimeo.com',
  'vod-progressive.akamaized.net',
  'pixabay.com',
  'cdn.pixabay.com',
  'i.vimeocdn.com',
  'mp3l.jamendo.com',
  'mp3d.jamendo.com',
  'prod-1.storage.jamendo.com',
  'freesound.org',
  'cdn.freesound.org',
  'assets.mixkit.co',
  'www.soundhelix.com',
  'soundhelix.com',
];

export const stockStatus = () => ({
  pexels: Boolean(process.env.PEXELS_API_KEY),
  pixabay: Boolean(process.env.PIXABAY_API_KEY),
  jamendo: Boolean(process.env.JAMENDO_CLIENT_ID),
});

const pexelsKey = () => process.env.PEXELS_API_KEY || '';
const pixabayKey = () => process.env.PIXABAY_API_KEY || '';
const jamendoId = () => process.env.JAMENDO_CLIENT_ID || '';

const fetchJson = async (url, headers = {}) => {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Stock HTTP ${res.status}`);
  return res.json();
};

const mapPexelsPhoto = (p) => ({
  id: `pexels-p-${p.id}`,
  kind: 'image',
  name: (p.alt || `Foto ${p.id}`).slice(0, 80),
  thumb: p.src?.medium || p.src?.small,
  downloadUrl: p.src?.original || p.src?.large2x || p.src?.large,
  credit: p.photographer ? `${p.photographer} / Pexels` : 'Pexels',
  pageUrl: p.url,
});

const mapPexelsVideo = (v) => {
  const files = [...(v.video_files || [])].sort((a, b) => (b.width || 0) - (a.width || 0));
  // Prefere HD ~1080p; evita 4K pesado no preview local
  const file =
    files.find((f) => (f.width || 0) >= 1280 && (f.width || 0) <= 1920) ||
    files.find((f) => (f.width || 0) <= 1920) ||
    files[0];
  return {
    id: `pexels-v-${v.id}`,
    kind: 'video',
    name: (v.user?.name ? `Vídeo ${v.user.name}` : `Vídeo ${v.id}`).slice(0, 80),
    thumb: v.image,
    previewUrl: file?.link,
    downloadUrl: file?.link,
    credit: v.user?.name ? `${v.user.name} / Pexels` : 'Pexels',
    pageUrl: v.url,
    durationSec: v.duration || undefined,
  };
};

const mapPixabayImage = (h) => ({
  id: `pixabay-p-${h.id}`,
  kind: 'image',
  name: (h.tags || `Imagem ${h.id}`).slice(0, 80),
  thumb: h.webformatURL || h.previewURL,
  downloadUrl: h.largeImageURL || h.webformatURL,
  credit: h.user ? `${h.user} / Pixabay` : 'Pixabay',
  pageUrl: h.pageURL,
});

const mapPixabayVideo = (h) => {
  const vids = h.videos || {};
  const file = vids.medium || vids.small || vids.large || vids.tiny;
  return {
    id: `pixabay-v-${h.id}`,
    kind: 'video',
    name: (h.tags || `Vídeo ${h.id}`).slice(0, 80),
    thumb: h.videos?.tiny?.thumbnail || h.userImageURL,
    downloadUrl: file?.url,
    credit: h.user ? `${h.user} / Pixabay` : 'Pixabay',
    pageUrl: h.pageURL,
    durationSec: h.duration || undefined,
  };
};

const searchPexelsPhotos = async (q, page) => {
  const key = pexelsKey();
  if (!key) return [];
  const data = await fetchJson(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=16&page=${page}`,
    { Authorization: key },
  );
  return (data.photos || []).map(mapPexelsPhoto).filter((i) => i.downloadUrl);
};

const searchPexelsVideos = async (q, page) => {
  const key = pexelsKey();
  if (!key) return [];
  const data = await fetchJson(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=12&page=${page}`,
    { Authorization: key },
  );
  return (data.videos || []).map(mapPexelsVideo).filter((i) => i.downloadUrl);
};

const searchPixabayPhotos = async (q, page) => {
  const key = pixabayKey();
  if (!key) return [];
  const data = await fetchJson(
    `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&per_page=16&page=${page}`,
  );
  return (data.hits || []).map(mapPixabayImage).filter((i) => i.downloadUrl);
};

const searchPixabayVideos = async (q, page) => {
  const key = pixabayKey();
  if (!key) return [];
  const data = await fetchJson(
    `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&safesearch=true&per_page=12&page=${page}`,
  );
  return (data.hits || []).map(mapPixabayVideo).filter((i) => i.downloadUrl);
};

const mapJamendoTrack = (t) => ({
  id: `jamendo-${t.id}`,
  kind: 'audio',
  name: t.name || `Faixa ${t.id}`,
  thumb: t.album_image || t.image,
  downloadUrl: t.audio,
  credit: t.artist_name ? `${t.artist_name} / Jamendo` : 'Jamendo',
  pageUrl: t.shareurl,
  durationSec: t.duration ? Number(t.duration) : undefined,
});

const searchJamendoOnce = async (q, page) => {
  const id = jamendoId();
  if (!id) return [];
  const offset = Math.max(0, (page - 1) * 12);
  const data = await fetchJson(
    `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(id)}&format=json&limit=12&offset=${offset}&search=${encodeURIComponent(q)}&audioformat=mp32&include=musicinfo`,
  );
  return (data.results || []).map(mapJamendoTrack).filter((i) => i.downloadUrl);
};

/** Jamendo às vezes zera em query composta; tenta a 1a palavra. */
const searchJamendo = async (q, page) => {
  const query = String(q || '').trim();
  let items = await searchJamendoOnce(query, page).catch(() => []);
  if (items.length) return items;
  const first = query.split(/\s+/)[0];
  if (first && first.toLowerCase() !== query.toLowerCase()) {
    items = await searchJamendoOnce(first, page).catch(() => []);
  }
  return items;
};

let fallbackAudio = null;
const loadFallbackAudio = async () => {
  if (fallbackAudio) return fallbackAudio;
  const raw = await readFile(path.join(__dirname, '..', 'data', 'stock-audio-fallback.json'), 'utf8');
  fallbackAudio = JSON.parse(raw);
  return fallbackAudio;
};

const searchFallbackAudio = async (q) => {
  const list = await loadFallbackAudio();
  const needle = q.toLowerCase();
  const matched = list.filter(
    (t) =>
      t.tags.some((tag) => needle.includes(tag) || tag.includes(needle.split(' ')[0] || '')) ||
      t.name.toLowerCase().includes(needle),
  );
  const rows = (matched.length ? matched : list).slice(0, 12);
  return rows.map((t) => ({
    id: t.id,
    kind: 'audio',
    name: t.name,
    thumb: null,
    downloadUrl: t.url,
    credit: t.credit,
    pageUrl: 'https://mixkit.co/free-stock-music/',
  }));
};

export const searchStock = async (kind, q, page = 1) => {
  const query = String(q || '').trim().slice(0, 80) || 'nature';
  const p = Math.max(1, Number(page) || 1);

  if (kind === 'image') {
    let items = await searchPexelsPhotos(query, p).catch(() => []);
    if (!items.length) items = await searchPixabayPhotos(query, p).catch(() => []);
    return { items, provider: items[0]?.id.startsWith('pixabay') ? 'pixabay' : 'pexels' };
  }
  if (kind === 'video') {
    let items = await searchPexelsVideos(query, p).catch(() => []);
    if (!items.length) items = await searchPixabayVideos(query, p).catch(() => []);
    return { items, provider: items[0]?.id.startsWith('pixabay') ? 'pixabay' : 'pexels' };
  }
  if (kind === 'audio') {
    let items = await searchJamendo(query, p).catch(() => []);
    if (!items.length) items = await searchFallbackAudio(query);
    return { items, provider: items[0]?.id.startsWith('jamendo') ? 'jamendo' : 'demo' };
  }
  return { items: [], provider: null };
};

export const isAllowedStockUrl = (raw) => {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return ALLOW_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
    || u.hostname.endsWith('pexels.com')
    || u.hostname.endsWith('pixabay.com')
    || u.hostname.endsWith('jamendo.com')
    || u.hostname.endsWith('mixkit.co')
    || u.hostname.endsWith('freesound.org')
    || u.hostname.endsWith('soundhelix.com');
};

/** Proxy de midia stock (preview no browser sem hotlink/CORS). */
export const openStockStream = async (rawUrl, signal) => {
  if (!isAllowedStockUrl(rawUrl)) throw new Error('URL de stock nao permitida');
  const res = await fetch(rawUrl, {
    signal,
    headers: { 'User-Agent': 'ZenithVideoStudio/1.0' },
  });
  if (!res.ok || !res.body) throw new Error('Falha ao buscar midia de stock');
  return {
    body: res.body,
    contentType: res.headers.get('content-type') || 'audio/mpeg',
    contentLength: res.headers.get('content-length'),
  };
};

const extFromUrlOrType = (url, contentType) => {
  const fromPath = path.extname(new URL(url).pathname).toLowerCase();
  if (fromPath && fromPath.length <= 5) return fromPath;
  if (contentType?.includes('jpeg')) return '.jpg';
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('mp4')) return '.mp4';
  if (contentType?.includes('webm')) return '.webm';
  if (contentType?.includes('mpeg') || contentType?.includes('mp3')) return '.mp3';
  if (contentType?.includes('wav')) return '.wav';
  return '.bin';
};

export const downloadStockFile = async (rawUrl) => {
  if (!isAllowedStockUrl(rawUrl)) throw new Error('URL de stock nao permitida');
  const res = await fetch(rawUrl, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error('Falha ao baixar o arquivo de stock');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 90 * 1024 * 1024) throw new Error('Arquivo de stock grande demais');
  const ext = extFromUrlOrType(rawUrl, res.headers.get('content-type') || '');
  return { buf, ext };
};
