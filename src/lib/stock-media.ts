export type StockKind = 'image' | 'video' | 'audio';

export type StockTheme = { id: string; label: string; q: string };

export const STOCK_THEMES: Record<StockKind, StockTheme[]> = {
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
    { id: 'lofi', label: 'Lo-fi', q: 'lofi' },
    { id: 'suspense', label: 'Suspense', q: 'cinematic' },
    { id: 'transicao', label: 'Transição', q: 'ambient' },
    { id: 'corporativo', label: 'Corporativo', q: 'corporate' },
    { id: 'alegre', label: 'Alegre', q: 'happy' },
  ],
};

export type StockItem = {
  id: string;
  kind: StockKind;
  name: string;
  thumb?: string | null;
  previewUrl?: string | null;
  downloadUrl: string;
  credit: string;
  pageUrl?: string;
  durationSec?: number;
};

export const searchStockMedia = async (
  apiUrl: string,
  kind: StockKind,
  q: string,
  page = 1,
): Promise<{ items: StockItem[]; provider: string | null }> => {
  const res = await fetch(
    `${apiUrl}/stock/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}&page=${page}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha na busca da biblioteca');
  }
  return res.json();
};

export const importStockMedia = async (
  apiUrl: string,
  projectId: string,
  item: StockItem,
): Promise<{ src: string; name: string }> => {
  const res = await fetch(`${apiUrl}/stock/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      url: item.downloadUrl,
      name: item.name,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao baixar o arquivo');
  }
  const data = await res.json();
  return { src: data.src, name: data.name || item.name };
};

/** Preview via api-video (evita hotlink/CORS do CDN externo). */
export const stockStreamUrl = (apiUrl: string, downloadUrl: string) =>
  `${apiUrl}/stock/stream?url=${encodeURIComponent(downloadUrl)}`;
