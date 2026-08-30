import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { enqueueRender, getJob, isRenderBusy } from './services/render-queue.js';
import { getFfmpegVersion, resolveAssetPath } from './services/scene-compositor.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.VIDEO_DATA_DIR || path.join(__dirname, 'data', 'jobs');
const ASSETS_ROOT = path.join(__dirname, 'data', 'assets');
const SFX_ROOT =
  process.env.SFX_LIBRARY_ROOT ||
  '/home/usuario/Documentos/TagAberta/EfeitosSonoros';

const upload = multer({
  dest: path.join(DATA_DIR, 'uploads'),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const hasFfmpeg = () =>
  new Promise((resolve) => {
    import('child_process').then(({ spawn }) => {
      const p = spawn('ffmpeg', ['-version']);
      p.on('error', () => resolve(false));
      p.on('close', (code) => resolve(code === 0));
    });
  });

let ffmpegOk = false;
let ffmpegVersion = null;

const initHealth = async () => {
  ffmpegOk = await hasFfmpeg();
  if (ffmpegOk) ffmpegVersion = await getFfmpegVersion();
};

await initHealth();
await mkdir(DATA_DIR, { recursive: true });
await mkdir(ASSETS_ROOT, { recursive: true });

app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    hasFfmpeg: ffmpegOk,
    ffmpegVersion,
    renderBusy: isRenderBusy(),
    sfxRoot: existsSync(SFX_ROOT) ? SFX_ROOT : null,
  });
});

app.get('/sfx-library', async (_, res) => {
  if (!existsSync(SFX_ROOT)) {
    return res.json({ root: SFX_ROOT, categories: [], error: 'Pasta SFX não encontrada' });
  }
  try {
    const categories = [];
    const dirs = await readdir(SFX_ROOT, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const catPath = path.join(SFX_ROOT, dir.name);
      const files = await readdir(catPath);
      const mp3s = files.filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f));
      categories.push({
        name: dir.name,
        files: mp3s.map((f) => ({
          name: f,
          path: path.join(catPath, f),
        })),
      });
    }
    res.json({ root: SFX_ROOT, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/assets/:projectId', upload.single('file'), async (req, res) => {
  const { projectId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Campo "file" obrigatório' });

  const dir = path.join(ASSETS_ROOT, projectId);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(req.file.originalname) || path.extname(req.file.filename);
  const filename = `${randomUUID()}${ext}`;
  const dest = path.join(dir, filename);

  const { rename, unlink } = await import('fs/promises');
  await rename(req.file.path, dest);

  const assetRef = `asset://${filename}`;
  res.json({
    src: assetRef,
    filename,
    url: `/assets/${projectId}/${filename}`,
  });
});

app.get('/assets/:projectId/:filename', async (req, res) => {
  const filePath = path.join(ASSETS_ROOT, req.params.projectId, req.params.filename);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.sendFile(filePath);
});

app.post('/render/prepare', async (req, res) => {
  const { project, assets } = req.body;
  if (!project?.id) return res.status(400).json({ error: 'project obrigatório' });

  const jobAssetsDir = path.join(ASSETS_ROOT, project.id);
  await mkdir(jobAssetsDir, { recursive: true });

  if (Array.isArray(assets)) {
    for (const item of assets) {
      if (!item.src || !item.dataUrl) continue;
      const match = item.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) continue;
      const rel = item.src.replace('asset://', '');
      const dest = path.join(jobAssetsDir, rel);
      await writeFile(dest, Buffer.from(match[1], 'base64'));
    }
  }

  res.json({ ok: true, assetsDir: jobAssetsDir });
});

app.post('/render', async (req, res) => {
  if (!ffmpegOk) {
    return res.status(503).json({
      error: 'FFmpeg não instalado. Rode: sudo apt install ffmpeg',
    });
  }

  const { project } = req.body;
  if (!project?.scenes?.length) {
    return res.status(400).json({ error: 'Projeto inválido ou sem cenas' });
  }

  const projectAssets = path.join(ASSETS_ROOT, project.id);
  await mkdir(projectAssets, { recursive: true });

  for (const scene of project.scenes) {
    for (const layer of scene.layers || []) {
      if (layer.type === 'image' && layer.src?.startsWith('asset://')) {
        const p = resolveAssetPath(layer.src, projectAssets);
        if (!p) {
          return res.status(400).json({
            error: `Asset não encontrado: ${layer.src}. Faça upload novamente.`,
          });
        }
      }
    }
  }

  for (const track of project.audioTracks || []) {
    for (const clip of track.clips || []) {
      if (clip.src?.startsWith('asset://')) {
        const p = resolveAssetPath(clip.src, projectAssets);
        if (!p) {
          return res.status(400).json({
            error: `Áudio não encontrado: ${clip.src}`,
          });
        }
      } else if (clip.src && !existsSync(clip.src)) {
        return res.status(400).json({ error: `Arquivo de áudio ausente: ${clip.src}` });
      }
    }
  }

  try {
    const jobId = await enqueueRender(project, DATA_DIR, projectAssets);
    res.json({ jobId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/render/status/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json({
    state: job.state,
    progress: job.progress,
    error: job.error,
    outputPath: job.outputPath ? true : null,
  });
});

app.get('/render/download/:jobId', async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  if (job.state !== 'done' || !job.outputPath) {
    return res.status(400).json({ error: 'Render ainda não concluído' });
  }
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="zenith-${job.projectId.slice(0, 8)}.mp4"`);
  res.sendFile(job.outputPath);
});

const PORT = process.env.VIDEO_PORT || 3335;
app.listen(PORT, () => {
  console.log(`Zenith Video API na porta ${PORT}`);
  console.log(ffmpegOk ? `FFmpeg ${ffmpegVersion}` : 'FFmpeg ausente - instale com sudo apt install ffmpeg');
  console.log(`SFX root: ${existsSync(SFX_ROOT) ? SFX_ROOT : '(não encontrado)'}`);
});
