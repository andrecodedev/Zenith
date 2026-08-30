import { fileToDataUrl, uploadProjectAsset } from './video-assets';

export const persistImageBlob = async (
  blob: Blob,
  opts: { apiUrl: string; apiOnline: boolean | null; projectId?: string },
): Promise<string> => {
  const file = new File([blob], 'sem-fundo.png', { type: blob.type || 'image/png' });
  if (opts.apiUrl && opts.apiOnline && opts.projectId) {
    try {
      const { src } = await uploadProjectAsset(opts.apiUrl, opts.projectId, file);
      return src;
    } catch {
      /* cai no data URL */
    }
  }
  return fileToDataUrl(file);
};

export class BgRemovalAbortedError extends Error {
  constructor(message = 'Remocao de fundo cancelada') {
    super(message);
    this.name = 'AbortError';
  }
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new BgRemovalAbortedError();
};

const sourceToBlob = async (src: string, signal?: AbortSignal): Promise<Blob> => {
  throwIfAborted(signal);
  if (src.startsWith('data:')) {
    const res = await fetch(src, { signal });
    return res.blob();
  }
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error('Não deu para ler a imagem');
  return res.blob();
};

const colorDist = (r: number, g: number, b: number, cr: number, cg: number, cb: number) => {
  const dr = r - cr;
  const dg = g - cg;
  const db = b - cb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const luma = (r: number, g: number, b: number) => (r + g + b) / 3;

/** Traço escuro: abaixo disso nao e fundo (protege contorno). */
const INK_LUMA = 100;

const sampleCorner = (data: Uint8ClampedArray, w: number, h: number, x: number, y: number) => {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      const px = Math.min(w - 1, Math.max(0, x + dx));
      const py = Math.min(h - 1, Math.max(0, y + dy));
      const i = (py * w + px) * 4;
      if (data[i + 3] < 16) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (!n) return null;
  return { r: r / n, g: g / n, b: b / n };
};

const cornersAgree = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { r: number; g: number; b: number } | null => {
  const samples = [
    sampleCorner(data, w, h, 0, 0),
    sampleCorner(data, w, h, w - 4, 0),
    sampleCorner(data, w, h, 0, h - 4),
    sampleCorner(data, w, h, w - 4, h - 4),
  ].filter(Boolean) as { r: number; g: number; b: number }[];
  if (samples.length < 3) return null;
  const avg = samples.reduce(
    (a, s) => ({ r: a.r + s.r, g: a.g + s.g, b: a.b + s.b }),
    { r: 0, g: 0, b: 0 },
  );
  avg.r /= samples.length;
  avg.g /= samples.length;
  avg.b /= samples.length;
  const maxD = Math.max(...samples.map((s) => colorDist(s.r, s.g, s.b, avg.r, avg.g, avg.b)));
  if (maxD > 48) return null;
  return avg;
};

type ImageStats = { paper: number; ink: number; mid: number; n: number };

const sampleStats = (data: Uint8ClampedArray, w: number, h: number): ImageStats => {
  const total = w * h;
  let paper = 0;
  let ink = 0;
  let mid = 0;
  const step = Math.max(1, Math.floor(total / 8000));
  let n = 0;
  for (let p = 0; p < total; p += step) {
    const i = p * 4;
    if (data[i + 3] < 16) continue;
    n++;
    const y = luma(data[i], data[i + 1], data[i + 2]);
    if (y > 220) paper++;
    else if (y < 80) ink++;
    else mid++;
  }
  return { paper, ink, mid, n };
};

/**
 * Desenho tipo sticker/line-art: muito papel claro + traço escuro.
 * Pele/cabelo brancos entram no "papel", por isso o modelo IA nao serve.
 * Camiseta cinza aumenta "mid": ainda assim usamos o caminho seguro se o
 * canto for fundo claro e houver tinta.
 */
const isLineArt = (data: Uint8ClampedArray, w: number, h: number) => {
  const { paper, ink, mid, n } = sampleStats(data, w, h);
  if (!n) return false;
  const paperR = paper / n;
  const inkR = ink / n;
  const midR = mid / n;
  if (paperR > 0.22 && inkR > 0.008 && midR < 0.58) return true;
  const bg = cornersAgree(data, w, h);
  if (!bg || luma(bg.r, bg.g, bg.b) < 200) return false;
  return paperR > 0.15 && inkR > 0.006;
};

/** Fecha falhas de 1-N px no contorno para o flood nao "vazar". */
const dilateMask = (src: Uint8Array, w: number, h: number, radius: number): Uint8Array => {
  if (radius <= 0) return src;
  let cur = src;
  for (let pass = 0; pass < radius; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cur[i]) {
          next[i] = 1;
          continue;
        }
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (cur[ny * w + nx]) {
              hit = true;
              break;
            }
          }
        }
        if (hit) next[i] = 1;
      }
    }
    cur = next;
  }
  return cur;
};

const erodeMask = (src: Uint8Array, w: number, h: number, radius: number): Uint8Array => {
  if (radius <= 0) return src;
  let cur = src;
  for (let pass = 0; pass < radius; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!cur[i]) continue;
        let keep = true;
        for (let dy = -1; dy <= 1 && keep; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              keep = false;
              break;
            }
            if (!cur[ny * w + nx]) {
              keep = false;
              break;
            }
          }
        }
        if (keep) next[i] = 1;
      }
    }
    cur = next;
  }
  return cur;
};

/** Fecha buracos do contorno sem engordar a barreira demais (dilata e volta). */
const closeMask = (src: Uint8Array, w: number, h: number, radius: number): Uint8Array => {
  if (radius <= 0) return src;
  return erodeMask(dilateMask(src, w, h, radius), w, h, radius);
};

/**
 * Traço + anti-alias: cinza medio do contorno tambem veda falhas.
 * Nao usa isso pra pintar tinta, so como barreira do flood.
 */
const buildBarrierMask = (data: Uint8ClampedArray, w: number, h: number): Uint8Array => {
  const hard = new Uint8Array(w * h);
  const soft = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] < 16) continue;
    const y = luma(data[i], data[i + 1], data[i + 2]);
    if (y < INK_LUMA) hard[p] = 1;
    else if (y < 168) soft[p] = 1;
  }
  // soft so vale se tocar tinta dura (evita camiseta cinza virar muro)
  const softTouch = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!soft[i]) continue;
      let nearHard = false;
      for (let dy = -2; dy <= 2 && !nearHard; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (hard[ny * w + nx]) {
            nearHard = true;
            break;
          }
        }
      }
      if (nearHard) softTouch[i] = 1;
    }
  }
  const merged = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) merged[p] = hard[p] || softTouch[p] ? 1 : 0;
  return merged;
};

/** Pixels alcancaveis pela borda sem atravessar a mascara de tinta. */
const floodOutsideBarrier = (
  barrier: Uint8Array,
  w: number,
  h: number,
  signal?: AbortSignal,
): Uint8Array => {
  const bg = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;
  let steps = 0;

  const seed = (x: number, y: number) => {
    const idx = y * w + x;
    if (bg[idx] || barrier[idx]) return;
    bg[idx] = 1;
    qx[qt] = x;
    qy[qt] = y;
    qt++;
  };

  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }

  const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
  while (qh < qt) {
    if ((steps++ & 8191) === 0) throwIfAborted(signal);
    const x = qx[qh];
    const y = qy[qh];
    qh++;
    for (let d = 0; d < 4; d++) {
      const nx = x + dirs[d * 2];
      const ny = y + dirs[d * 2 + 1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (bg[nidx] || barrier[nidx]) continue;
      bg[nidx] = 1;
      qx[qt] = nx;
      qy[qt] = ny;
      qt++;
    }
  }
  return bg;
};

type InkRun = { min: number; max: number };

const columnRunsWithInk = (
  mask: Uint8Array,
  w: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): InkRun[] => {
  const n = x1 - x0;
  const has = new Uint8Array(n);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (mask[y * w + x]) has[x - x0] = 1;
    }
  }
  const runs: InkRun[] = [];
  let i = 0;
  while (i < n) {
    while (i < n && !has[i]) i++;
    if (i >= n) break;
    const a = i;
    while (i < n && has[i]) i++;
    runs.push({ min: a + x0, max: i - 1 + x0 });
  }
  return runs;
};

/** Vao central entre pernas: o gap cujo meio esta mais perto do centro da figura. */
const centerGap = (runs: InkRun[]): { x0: number; x1: number } | null => {
  if (runs.length < 2) return null;
  const cx = (runs[0].min + runs[runs.length - 1].max) / 2;
  let best: { x0: number; x1: number; dist: number } | null = null;
  for (let i = 0; i < runs.length - 1; i++) {
    const x0 = runs[i].max + 1;
    const x1 = runs[i + 1].min - 1;
    if (x1 < x0) continue;
    const mid = (x0 + x1) / 2;
    const dist = Math.abs(mid - cx);
    if (!best || dist < best.dist) best = { x0, x1, dist };
  }
  return best;
};

const findCrotchGap = (barrier: Uint8Array, w: number, h: number): { x0: number; x1: number } | null => {
  for (const frac of [0.62, 0.5, 0.4, 0.3]) {
    const y0 = Math.floor(h * frac);
    const runs = columnRunsWithInk(barrier, w, 0, w, y0, h);
    if (runs.length < 3) continue;
    const gap = centerGap(runs);
    if (gap) return gap;
  }
  return null;
};

/**
 * Fecha so aberturas estreitas na borda (calca sem barra).
 * Nao pinta barra no topo/lado (virava linha branca na cabeca/notebook).
 * Deixa o vao do meio das pernas aberto.
 */
const sealCroppedOpenings = (
  barrier: Uint8Array,
  w: number,
  h: number,
  crotch: { x0: number; x1: number } | null,
) => {
  const bandY = Math.max(8, Math.round(h * 0.28));
  const thick = Math.max(2, Math.round(Math.min(w, h) / 220));
  const runs = columnRunsWithInk(barrier, w, 0, w, h - bandY, h);
  if (runs.length < 2) return;

  const charW = runs[runs.length - 1].max - runs[0].min + 1;
  const narrow = Math.max(10, Math.round(charW * 0.34));

  const paintBottom = (xA: number, xB: number) => {
    const a = Math.max(0, xA);
    const b = Math.min(w - 1, xB);
    if (b < a) return;
    for (let t = 0; t < thick; t++) {
      const y = h - 1 - t;
      if (y < 0) continue;
      for (let x = a; x <= b; x++) barrier[y * w + x] = 1;
    }
  };

  const left = runs[0].max + 1;
  const right = runs[runs.length - 1].min - 1;
  if (crotch) {
    paintBottom(left, crotch.x0 - 1);
    paintBottom(crotch.x1 + 1, right);
  } else {
    for (let i = 0; i < runs.length - 1; i++) {
      const x0 = runs[i].max + 1;
      const x1 = runs[i + 1].min - 1;
      if (x1 < x0) continue;
      if (x1 - x0 + 1 <= narrow) paintBottom(x0, x1);
    }
    if (runs.length === 2 && right - left + 1 > narrow) paintBottom(left, right);
  }
};

/**
 * O flood entra no vao e sobe ate o quadril, depois vaza pra calca.
 * Devolve o branco entre traços das pernas; o gap central continua vazado.
 */
const restoreLowerLimbFills = (
  outside: Uint8Array,
  ink: Uint8Array,
  w: number,
  h: number,
  crotch: { x0: number; x1: number } | null,
) => {
  const y0 = Math.floor(h * 0.36);
  for (let y = y0; y < h; y++) {
    const runs = columnRunsWithInk(ink, w, 0, w, y, y + 1);
    if (runs.length < 2) continue;
    for (let i = 0; i < runs.length - 1; i++) {
      const a = runs[i].max + 1;
      const b = runs[i + 1].min - 1;
      if (b < a) continue;
      const mid = (a + b) / 2;
      if (crotch && mid >= crotch.x0 - 1 && mid <= crotch.x1 + 1) continue;
      for (let x = a; x <= b; x++) outside[y * w + x] = 0;
    }
  }
};

const matchesPaper = (
  data: Uint8ClampedArray,
  i: number,
  bg: { r: number; g: number; b: number },
) => {
  if (data[i + 3] < 16) return false;
  if (luma(data[i], data[i + 1], data[i + 2]) < INK_LUMA) return false;
  return colorDist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) <= 36;
};

/** Linha residual na moldura do PNG (topo/lado). */
const clearFramePaper = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: { r: number; g: number; b: number },
) => {
  const thick = Math.max(2, Math.round(Math.min(w, h) / 500));
  for (let t = 0; t < thick; t++) {
    for (let x = 0; x < w; x++) {
      const top = (t * w + x) * 4;
      const bot = ((h - 1 - t) * w + x) * 4;
      if (matchesPaper(data, top, bg)) data[top + 3] = 0;
      if (matchesPaper(data, bot, bg)) data[bot + 3] = 0;
    }
    for (let y = 0; y < h; y++) {
      const left = (y * w + t) * 4;
      const right = (y * w + (w - 1 - t)) * 4;
      if (matchesPaper(data, left, bg)) data[left + 3] = 0;
      if (matchesPaper(data, right, bg)) data[right + 3] = 0;
    }
  }
};

/** So poeira / linha fina solta. Nao fura vaos grandes (isso quebrava o personagem). */
const dropThinPaperIslands = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: { r: number; g: number; b: number },
) => {
  const seen = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
  const maxSpeck = Math.max(40, Math.floor(w * h * 0.00015));

  for (let start = 0; start < w * h; start++) {
    if (seen[start]) continue;
    if (!matchesPaper(data, start * 4, bg)) {
      seen[start] = 1;
      continue;
    }
    let qh = 0;
    let qt = 0;
    seen[start] = 1;
    qx[0] = start % w;
    qy[0] = Math.floor(start / w);
    qt = 1;
    let minX = qx[0];
    let maxX = qx[0];
    let minY = qy[0];
    let maxY = qy[0];
    const cells: number[] = [];
    while (qh < qt) {
      const x = qx[qh];
      const y = qy[qh];
      qh++;
      cells.push(y * w + x);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let d = 0; d < 4; d++) {
        const nx = x + dirs[d * 2];
        const ny = y + dirs[d * 2 + 1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (seen[n]) continue;
        if (!matchesPaper(data, n * 4, bg)) continue;
        seen[n] = 1;
        qx[qt] = nx;
        qy[qt] = ny;
        qt++;
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const thin = Math.min(bw, bh) <= 3 && Math.max(bw, bh) >= 8;
    if (!thin && cells.length > maxSpeck) continue;
    for (const p of cells) data[p * 4 + 3] = 0;
  }
};

/**
 * Versao estavel: fundo externo + calca protegida + meio das pernas aberto.
 * Sem furo agressivo de vaos (braco/objeto) - isso estava destruindo o personagem.
 */
const stripBySealedInk = (
  image: ImageData,
  signal?: AbortSignal,
): { data: Uint8ClampedArray; removed: number } | null => {
  throwIfAborted(signal);
  const { data, width: w, height: h } = image;
  const bgColor = cornersAgree(data, w, h);
  if (!bgColor) return null;

  const barrier = buildBarrierMask(data, w, h);
  const closeR = Math.min(3, Math.max(2, Math.round(Math.min(w, h) / 320)));
  const sealed = closeMask(barrier, w, h, closeR);
  const floodBarrier = dilateMask(sealed, w, h, 1);
  const crotch = findCrotchGap(sealed, w, h);
  sealCroppedOpenings(floodBarrier, w, h, crotch);
  const outside = floodOutsideBarrier(floodBarrier, w, h, signal);
  restoreLowerLimbFills(outside, sealed, w, h, crotch);

  const out = new Uint8ClampedArray(data);
  let removed = 0;
  for (let p = 0; p < w * h; p++) {
    if (!outside[p]) continue;
    const i = p * 4;
    if (out[i + 3] === 0) continue;
    out[i + 3] = 0;
    removed++;
  }

  clearFramePaper(out, w, h, bgColor);
  dropThinPaperIslands(out, w, h, bgColor);

  const total = w * h;
  const ratio = removed / total;
  const kept = 1 - ratio;
  if (ratio < 0.008 || kept < 0.01) return null;

  return { data: out, removed };
};

const trimBgHalo = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: { r: number; g: number; b: number },
  fringeTol: number,
) => {
  const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (luma(data[i], data[i + 1], data[i + 2]) < INK_LUMA) continue;
      if (colorDist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) > fringeTol) continue;
      let nextToHole = false;
      for (let d = 0; d < 4; d++) {
        const ni = ((y + dirs[d * 2 + 1]) * w + (x + dirs[d * 2])) * 4;
        if (data[ni + 3] < 16) {
          nextToHole = true;
          break;
        }
      }
      if (nextToHole) data[i + 3] = 0;
    }
  }
};

const floodEdgeBackground = (
  image: ImageData,
  bg: { r: number; g: number; b: number },
  tolerance: number,
  trimHalo: boolean,
  signal?: AbortSignal,
): number => {
  const { data, width: w, height: h } = image;
  const seen = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;
  let steps = 0;

  const matchesBg = (r: number, g: number, b: number, a: number) => {
    if (a < 16) return true;
    if (luma(r, g, b) < INK_LUMA) return false;
    return colorDist(r, g, b, bg.r, bg.g, bg.b) <= tolerance;
  };

  const trySeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (!matchesBg(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    seen[idx] = 1;
    qx[qt] = x;
    qy[qt] = y;
    qt++;
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
  let removed = 0;
  while (qh < qt) {
    if ((steps++ & 8191) === 0) throwIfAborted(signal);
    const x = qx[qh];
    const y = qy[qh];
    qh++;
    const i = (y * w + x) * 4;
    if (data[i + 3] > 0) {
      data[i + 3] = 0;
      removed++;
    }
    for (let d = 0; d < 4; d++) {
      const nx = x + dirs[d * 2];
      const ny = y + dirs[d * 2 + 1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (seen[nidx]) continue;
      const ni = nidx * 4;
      if (!matchesBg(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) continue;
      seen[nidx] = 1;
      qx[qt] = nx;
      qy[qt] = ny;
      qt++;
    }
  }

  if (trimHalo) trimBgHalo(data, w, h, bg, Math.min(tolerance + 8, 28));
  return removed;
};

const imageDataToPng = (image: ImageData): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas indisponivel'));
      return;
    }
    ctx.putImageData(image, 0, 0);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG'))),
      'image/png',
    );
  });

const blobToImageData = async (blob: Blob): Promise<ImageData> => {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponivel');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const stripByEdgeFlood = async (
  blob: Blob,
  signal?: AbortSignal,
): Promise<Blob | null> => {
  throwIfAborted(signal);
  const image = await blobToImageData(blob);
  throwIfAborted(signal);
  const bg = cornersAgree(image.data, image.width, image.height);
  if (!bg) return null;

  const lineArt = isLineArt(image.data, image.width, image.height);
  const total = image.width * image.height;
  const tries = lineArt ? [10, 14, 18] : [18, 28, 38];
  let best: { data: Uint8ClampedArray } | null = null;
  let bestScore = Infinity;

  for (const tol of tries) {
    throwIfAborted(signal);
    const copy = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    const removed = floodEdgeBackground(copy, bg, tol, !lineArt, signal);
    const ratio = removed / total;
    const kept = 1 - ratio;
    if (ratio < 0.01 || kept < 0.012) continue;
    const score = lineArt ? Math.abs(ratio - 0.35) : Math.abs(ratio - 0.4);
    if (!best || score < bestScore) {
      best = { data: copy.data };
      bestScore = score;
    }
    if (lineArt && ratio >= 0.04 && kept >= 0.08) {
      best = { data: copy.data };
      break;
    }
    if (!lineArt && ratio >= 0.08 && ratio <= 0.82) {
      best = { data: copy.data };
      break;
    }
  }

  if (!best) return null;
  return imageDataToPng(new ImageData(best.data, image.width, image.height));
};

const raceAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new BgRemovalAbortedError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new BgRemovalAbortedError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
};

export const stripImageBackground = async (
  imageSrc: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<Blob> => {
  throwIfAborted(signal);
  onProgress?.('Lendo imagem...');
  const input = await sourceToBlob(imageSrc, signal);
  throwIfAborted(signal);

  const probe = await blobToImageData(input);
  throwIfAborted(signal);
  const lineArt = isLineArt(probe.data, probe.width, probe.height);

  if (lineArt) {
    onProgress?.('Recortando desenho (protegendo preenchimento)...');
    const sealed = stripBySealedInk(probe, signal);
    if (sealed) {
      return imageDataToPng(new ImageData(sealed.data, probe.width, probe.height));
    }
    onProgress?.('Tentando recorte por bordas...');
    const flooded = await stripByEdgeFlood(input, signal);
    if (flooded) return flooded;
    throw new Error(
      'Neste desenho a pele e o fundo sao quase a mesma cor. Feche o contorno ou use fundo ja transparente.',
    );
  }

  onProgress?.('Recortando fundo (bordas)...');
  const flooded = await stripByEdgeFlood(input, signal);
  if (flooded) return flooded;

  onProgress?.('Fundo irregular, usando modelo...');
  const { removeBackground } = await import('@imgly/background-removal');
  throwIfAborted(signal);

  const job = removeBackground(input, {
    output: { format: 'image/png', quality: 0.92 },
    progress: (key, current, total) => {
      if (signal?.aborted) return;
      if (!total) return;
      const pct = Math.round((current / total) * 100);
      onProgress?.(`${key} ${pct}%`);
    },
  });

  const timeout = new Promise<never>((_, reject) => {
    const id = window.setTimeout(
      () => reject(new Error('Remocao de fundo demorou demais. Tente de novo.')),
      90000,
    );
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(id);
        reject(new BgRemovalAbortedError());
      },
      { once: true },
    );
  });

  return raceAbort(Promise.race([job, timeout]), signal);
};
