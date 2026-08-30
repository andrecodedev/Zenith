import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { existsSync, readFileSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { enqueueRender, getJob, isRenderBusy } from './services/render-queue.js';
import { getFfmpegVersion, resolveAssetPath } from './services/scene-compositor.js';
import {
  downloadStockFile,
  isAllowedStockUrl,
  openStockStream,
  searchStock,
  STOCK_THEMES,
  stockStatus,
} from './services/stock-library.js';

const loadLocalEnv = () => {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
};
loadLocalEnv();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Sempre absoluto: concat do ffmpeg resolve paths relativos ao concat.txt.
const DATA_DIR = path.resolve(__dirname, process.env.VIDEO_DATA_DIR || path.join('data', 'jobs'));
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
    stock: stockStatus(),
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

app.get('/stock/themes', (req, res) => {
  const kind = String(req.query.kind || 'image');
  res.json({ themes: STOCK_THEMES[kind] || [] });
});

app.get('/stock/search', async (req, res) => {
  const kind = String(req.query.kind || 'image');
  if (!['image', 'video', 'audio'].includes(kind)) {
    return res.status(400).json({ error: 'kind invalido' });
  }
  try {
    const data = await searchStock(kind, req.query.q, req.query.page);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Falha na busca de stock' });
  }
});

app.get('/stock/stream', async (req, res) => {
  const url = String(req.query.url || '');
  if (!url || !isAllowedStockUrl(url)) {
    return res.status(400).json({ error: 'URL nao permitida' });
  }
  const ac = new AbortController();
  const onClose = () => ac.abort();
  req.on('close', onClose);
  try {
    // Timeout so na conexao inicial; o corpo pode ser MP3 longo.
    const connectTimer = setTimeout(() => ac.abort(), 25000);
    const { body, contentType, contentLength } = await openStockStream(url, ac.signal);
    clearTimeout(connectTimer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=600');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const { Readable } = await import('stream');
    const nodeStream = Readable.fromWeb(body);
    nodeStream.on('error', (err) => {
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return;
      console.error('stock stream:', err.message || err);
      if (!res.writableEnded) res.destroy();
    });
    res.on('close', () => {
      nodeStream.destroy();
    });
    nodeStream.pipe(res);
  } catch (err) {
    req.off('close', onClose);
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      if (!res.headersSent) res.status(504).json({ error: 'Timeout ao buscar midia' });
      return;
    }
    if (!res.headersSent) {
      res.status(502).json({ error: err.message || 'Falha no stream de stock' });
    }
  }
});

app.post('/stock/import', async (req, res) => {
  const { projectId, url, name } = req.body || {};
  if (!projectId || !url) {
    return res.status(400).json({ error: 'projectId e url obrigatorios' });
  }
  try {
    const { buf, ext } = await downloadStockFile(url);
    const dir = path.join(ASSETS_ROOT, projectId);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    await writeFile(path.join(dir, filename), buf);
    const assetRef = `asset://${filename}`;
    res.json({
      src: assetRef,
      filename,
      url: `/assets/${projectId}/${filename}`,
      name: String(name || 'stock').slice(0, 120),
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Falha ao importar stock' });
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

  const { project, uhd = true } = req.body;
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
      } else if (clip.src) {
        const p = resolveAssetPath(clip.src, projectAssets);
        if (!p) {
          return res.status(400).json({ error: `Arquivo de áudio ausente: ${clip.src}` });
        }
      }
    }
  }

  try {
    const jobId = await enqueueRender(project, DATA_DIR, projectAssets, uhd !== false);
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
  res.setHeader('Content-Disposition', `attachment; filename="zenith-${job.projectId.slice(0, 8)}_4k.mp4"`);
  res.sendFile(job.outputPath);
});

const PORT = process.env.VIDEO_PORT || 3335;
const server = app.listen(PORT, () => {
  console.log(`Zenith Video API na porta ${PORT}`);
  console.log(ffmpegOk ? `FFmpeg ${ffmpegVersion}` : 'FFmpeg ausente - instale com sudo apt install ffmpeg');
  console.log(`SFX root: ${existsSync(SFX_ROOT) ? SFX_ROOT : '(não encontrado)'}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} ja em uso. Mate o processo antigo:`);
    console.error(`  fuser -k ${PORT}/tcp`);
    console.error(`  # ou: ss -ltnp | grep ${PORT}`);
    process.exit(1);
  }
  throw err;
});
