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

const sourceToBlob = async (src: string): Promise<Blob> => {
  if (src.startsWith('data:')) {
    const res = await fetch(src);
    return res.blob();
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error('Não deu para ler a imagem');
  return res.blob();
};

const colorDist = (r: number, g: number, b: number, cr: number, cg: number, cb: number) => {
  const dr = r - cr;
  const dg = g - cg;
  const db = b - cb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

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

const floodEdgeBackground = (
  image: ImageData,
  bg: { r: number; g: number; b: number },
  tolerance: number,
): number => {
  const { data, width: w, height: h } = image;
  const seen = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  const trySeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    const a = data[i + 3];
    if (a < 16) {
      seen[idx] = 1;
      qx[qt] = x;
      qy[qt] = y;
      qt++;
      return;
    }
    if (colorDist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) > tolerance) return;
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
      const na = data[ni + 3];
      if (na >= 16 && colorDist(data[ni], data[ni + 1], data[ni + 2], bg.r, bg.g, bg.b) > tolerance) {
        continue;
      }
      seen[nidx] = 1;
      qx[qt] = nx;
      qy[qt] = ny;
      qt++;
    }
  }

  // franja de 1px: so pixels colados no fundo e ainda parecidos com a cor do fundo
  const fringeTol = tolerance + 18;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const i = idx * 4;
      if (data[i + 3] < 16) continue;
      if (colorDist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) > fringeTol) continue;
      let nextToHole = false;
      for (let d = 0; d < 4; d++) {
        const ni = ((y + dirs[d * 2 + 1]) * w + (x + dirs[d * 2])) * 4;
        if (data[ni + 3] < 16) {
          nextToHole = true;
          break;
        }
      }
      if (nextToHole) {
        data[i + 3] = 0;
        removed++;
      }
    }
  }

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

const stripByEdgeFlood = async (blob: Blob): Promise<Blob | null> => {
  const image = await blobToImageData(blob);
  const bg = cornersAgree(image.data, image.width, image.height);
  if (!bg) return null;

  const total = image.width * image.height;
  const tries = [28, 40, 52];
  let best: { data: Uint8ClampedArray; removed: number } | null = null;

  for (const tol of tries) {
    const copy = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    const removed = floodEdgeBackground(copy, bg, tol);
    const ratio = removed / total;
    if (ratio < 0.02 || ratio > 0.88) continue;
    if (!best || Math.abs(ratio - 0.35) < Math.abs(best.removed / total - 0.35)) {
      best = { data: copy.data, removed };
    }
    // ja removeu uma fatia razoavel de fundo sem comer o desenho
    if (ratio >= 0.08 && ratio <= 0.75) {
      best = { data: copy.data, removed };
      break;
    }
  }

  if (!best) return null;
  const out = new ImageData(best.data, image.width, image.height);
  return imageDataToPng(out);
};

export const stripImageBackground = async (
  imageSrc: string,
  onProgress?: (msg: string) => void,
): Promise<Blob> => {
  onProgress?.('Lendo imagem...');
  const input = await sourceToBlob(imageSrc);
  onProgress?.('Recortando fundo (bordas)...');
  const flooded = await stripByEdgeFlood(input);
  if (flooded) return flooded;

  onProgress?.('Fundo irregular, usando modelo...');
  const { removeBackground } = await import('@imgly/background-removal');
  const job = removeBackground(input, {
    output: { format: 'image/png', quality: 0.92 },
    progress: (key, current, total) => {
      if (!total) return;
      const pct = Math.round((current / total) * 100);
      onProgress?.(`${key} ${pct}%`);
    },
  });
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Remocao de fundo demorou demais. Tente de novo.')), 90000);
  });
  return Promise.race([job, timeout]);
};
