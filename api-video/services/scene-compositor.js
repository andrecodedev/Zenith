import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const resolveAssetPath = (src, assetsDir) => {
  if (!src) return null;
  if (src.startsWith('asset://')) {
    const rel = src.slice('asset://'.length);
    return path.join(assetsDir, rel);
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

export const compositeScene = async (scene, assetsDir, outputPng) => {
  const layers = [...(scene.layers || [])].sort((a, b) => a.zIndex - b.zIndex);
  let base = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 18, g: 18, b: 24, alpha: 1 },
    },
  });

  const composites = [];

  for (const layer of layers) {
    if (layer.type === 'image') {
      const filePath = resolveAssetPath(layer.src, assetsDir);
      if (!filePath) continue;
      const opacity = layer.opacity ?? 1;
      let img = sharp(filePath).resize(Math.round(layer.w), Math.round(layer.h), {
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
        left: Math.round(layer.x),
        top: Math.round(layer.y),
      });
    } else if (layer.type === 'text') {
      const anchor = textAnchor(layer.align);
      const x =
        layer.align === 'center'
          ? layer.x
          : layer.align === 'right'
            ? layer.x
            : layer.x;
      const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <text x="${x}" y="${layer.y + layer.fontSize}" font-family="${escapeXml(layer.fontFamily || 'sans-serif')}" font-size="${layer.fontSize}" fill="${escapeXml(layer.color || '#ffffff')}" text-anchor="${anchor}">${escapeXml(layer.text)}</text>
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

export const renderProject = async (project, jobDir, onProgress) => {
  const assetsDir = path.join(jobDir, 'assets');
  await mkdir(jobDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  const scenes = project.scenes || [];
  if (!scenes.length) throw new Error('Projeto sem cenas');

  const scenePngs = [];
  for (let i = 0; i < scenes.length; i++) {
    const png = path.join(jobDir, `scene_${i}.png`);
    await compositeScene(scenes[i], assetsDir, png);
    scenePngs.push({ png, duration: scenes[i].durationSec || 5 });
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
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-vf', `scale=${WIDTH}:${HEIGHT}`,
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
    for (const layer of scene.layers || []) {
      if (layer.type === 'image') collectSrc(layer.src);
    }
  }
  for (const track of project.audioTracks || []) {
    for (const clip of track.clips || []) collectSrc(clip.src);
  }

  await writeFile(path.join(assetsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
};

export { WIDTH, HEIGHT, FPS, resolveAssetPath };
