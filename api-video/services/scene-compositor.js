import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_W = 1920;
const BASE_H = 1080;
const FPS = 30;

const sizeFor = (uhd) => {
  const S = uhd ? 2 : 1;
  return { W: BASE_W * S, H: BASE_H * S, S };
};

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PUBLIC_ROOT = path.join(__dirname, '..', '..', 'public');

const resolveAssetPath = (src, assetsDir) => {
  if (!src) return null;
  if (src.startsWith('asset://')) {
    const rel = src.slice('asset://'.length);
    return path.join(assetsDir, rel);
  }
  if (src.startsWith('/sfx/') || src.startsWith('/personagem/')) {
    const bundled = path.join(PUBLIC_ROOT, src.replace(/^\//, ''));
    if (existsSync(bundled)) return bundled;
  }
  if (path.isAbsolute(src) && existsSync(src)) return src;
  const fromAssets = path.join(assetsDir, src);
  if (existsSync(fromAssets)) return fromAssets;
  return existsSync(src) ? src : null;
};

const textAnchor = (align) => {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
};

const hexToRgba = (hex) => {
  const raw = String(hex || '#ffffff').replace('#', '');
  const n = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw.padEnd(6, '0').slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 255,
    g: Number.isFinite(g) ? g : 255,
    b: Number.isFinite(b) ? b : 255,
    alpha: 1,
  };
};

export const compositeScene = async (scene, assetsDir, outputPng, elements = [], uhd = true) => {
  const { W, H, S } = sizeFor(uhd);
  const layers = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  let base = sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: hexToRgba(scene.backgroundColor),
    },
  });

  const composites = [];

  if (scene.backgroundSrc) {
    const bgPath = resolveAssetPath(scene.backgroundSrc, assetsDir);
    if (bgPath) {
      const buf = await sharp(bgPath).resize(W, H, { fit: 'cover' }).png().toBuffer();
      composites.push({ input: buf, left: 0, top: 0 });
    }
  }

  for (const layer of layers) {
    if (layer.type === 'image') {
      const filePath = resolveAssetPath(layer.src, assetsDir);
      if (!filePath) continue;
      const opacity = layer.opacity ?? 1;
      let img = sharp(filePath).resize(Math.round(layer.w * S), Math.round(layer.h * S), {
        fit: 'fill',
      });
      if (layer.rotation) img = img.rotate(layer.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
      if (opacity < 1) img = img.ensureAlpha().composite([{
        input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in',
      }]);
      const buf = await img.png().toBuffer();
      composites.push({
        input: buf,
        left: Math.round(layer.x * S),
        top: Math.round(layer.y * S),
      });
    } else if (layer.type === 'text') {
      const anchor = textAnchor(layer.align);
      const x = (layer.x || 0) * S;
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <text x="${x}" y="${(layer.y || 0) * S + (layer.fontSize || 32) * S}" font-family="${escapeXml(layer.fontFamily || 'sans-serif')}" font-size="${(layer.fontSize || 32) * S}" fill="${escapeXml(layer.color || '#ffffff')}" text-anchor="${anchor}">${escapeXml(layer.text)}</text>
      </svg>`;
      const buf = await sharp(Buffer.from(svg)).png().toBuffer();
      composites.push({ input: buf, left: 0, top: 0 });
    }
  }

  if (composites.length) base = base.composite(composites);
  await base.png().toFile(outputPng);
};

export const runFfmpeg = (args, onProgress) =>
  new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
      const m = stderr.match(/time=(\d+):(\d+):(\d+\.\d+)/g);
      if (m && onProgress) {
        const last = m[m.length - 1];
        const parts = last.replace('time=', '').split(':');
        const sec =
          Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
        onProgress(sec);
      }
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exit ${code}`));
    });
  });

export const getFfmpegVersion = () =>
  new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version']);
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('close', () => {
      const line = out.split('\n')[0] || '';
      resolve(line.replace('ffmpeg version ', '').split(' ')[0] || null);
    });
    proc.on('error', () => resolve(null));
  });

export const renderProject = async (project, jobDir, onProgress, uhd = true) => {
  const { W, H } = sizeFor(uhd);
  const assetsDir = path.join(jobDir, 'assets');
  await mkdir(jobDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  const scenes = project.scenes || [];
  if (!scenes.length) throw new Error('Projeto sem cenas');

  const scenePngs = [];
  let sceneStart = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneEnd = sceneStart + (scene.durationSec || 5);
    const sceneEls = (project.elements || []).filter(
      (e) => e.startSec < sceneEnd && e.startSec + e.durationSec > sceneStart,
    );
    const png = path.join(jobDir, `scene_${i}.png`);
    await compositeScene(scene, assetsDir, png, sceneEls, uhd);
    scenePngs.push({ png, duration: scene.durationSec || 5 });
    sceneStart = sceneEnd;
    onProgress?.(5 + (i / scenes.length) * 25);
  }

  const segmentPaths = [];
  for (let i = 0; i < scenePngs.length; i++) {
    const seg = path.join(jobDir, `segment_${i}.mp4`);
    await runFfmpeg([
      '-y',
      '-loop', '1',
      '-t', String(scenePngs[i].duration),
      '-i', scenePngs[i].png,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-vf', `scale=${W}:${H}`,
      seg,
    ]);
    segmentPaths.push(seg);
    onProgress?.(30 + (i / scenePngs.length) * 30);
  }

  const totalDuration = scenes.reduce((s, sc) => s + (sc.durationSec || 5), 0);
  const concatList = path.join(jobDir, 'concat.txt');
  await writeFile(
    concatList,
    segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
  );

  const videoOnly = path.join(jobDir, 'video_only.mp4');
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatList,
    '-c', 'copy',
    videoOnly,
  ]);
  onProgress?.(65);

  const allClips = (project.audioTracks || []).flatMap((t) =>
    (t.clips || []).map((c) => ({ ...c, trackName: t.name })),
  );

  const outputPath = path.join(jobDir, 'output.mp4');

  if (!allClips.length) {
    await runFfmpeg(['-y', '-i', videoOnly, '-c:v', 'copy', '-an', outputPath]);
    onProgress?.(100);
    return outputPath;
  }

  const audioInputs = [];
  const filterParts = [];
  let inputIdx = 1;

  for (const clip of allClips) {
    const audioPath = resolveAssetPath(clip.src, assetsDir);
    if (!audioPath) continue;
    audioInputs.push('-i', audioPath);
    const delayMs = Math.round((clip.startSec || 0) * 1000);
    const vol = clip.volume ?? 1;
    const trim = clip.trimStartSec ? `,atrim=start=${clip.trimStartSec}` : '';
    filterParts.push(
      `[${inputIdx}:a]${trim},adelay=${delayMs}|${delayMs},volume=${vol}[a${inputIdx}]`,
    );
    inputIdx++;
  }

  if (!filterParts.length) {
    await runFfmpeg(['-y', '-i', videoOnly, '-c:v', 'copy', '-an', outputPath]);
    onProgress?.(100);
    return outputPath;
  }

  const mixLabels = filterParts.map((_, i) => `[a${i + 1}]`).join('');
  const filterComplex =
    filterParts.join(';') +
    `;${mixLabels}amix=inputs=${filterParts.length}:duration=longest:dropout_transition=0[aout]`;

  await runFfmpeg(
    ['-y', '-i', videoOnly, ...audioInputs, '-filter_complex', filterComplex, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-shortest', outputPath],
    (sec) => onProgress?.(65 + Math.min(30, (sec / totalDuration) * 30)),
  );

  onProgress?.(100);
  return outputPath;
};

export const saveProjectAssets = async (project, assetsDir) => {
  await mkdir(assetsDir, { recursive: true });
  const manifest = { projectId: project.id, assets: [] };

  const collectSrc = (src) => {
    if (!src || src.startsWith('asset://')) return;
    manifest.assets.push(src);
  };

  for (const scene of project.scenes || []) {
    if (scene.backgroundSrc) collectSrc(scene.backgroundSrc);
  }
  for (const el of project.elements || []) {
    if (el.type === 'image') collectSrc(el.src);
  }
  for (const scene of project.scenes || []) {
    for (const layer of scene.layers || []) {
      if (layer.type === 'image') collectSrc(layer.src);
    }
  }
  for (const track of project.audioTracks || []) {
    for (const clip of track.clips || []) collectSrc(clip.src);
  }

  await writeFile(path.join(assetsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
};

export { FPS, resolveAssetPath };
export const WIDTH = BASE_W;
export const HEIGHT = BASE_H;
