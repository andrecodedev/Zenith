import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import multer from 'multer';
import { imageSize } from 'image-size';
import { spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { unlink, readFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

const ytDlpPath = path.resolve('./yt-dlp_linux');
const COOKIES_PATH = '/tmp/yt-cookies.txt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REALESRGAN_DIR = path.join(__dirname, 'realesrgan');
const REALESRGAN_BIN = path.join(REALESRGAN_DIR, 'realesrgan-ncnn-vulkan');
const REALESRGAN_MODELS = path.join(REALESRGAN_DIR, 'models');
const UPSCALE_TIMEOUT_MS = 180_000;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const upload = multer({
  dest: '/tmp',
  limits: { fileSize: 25 * 1024 * 1024 },
});

let upscaleBusy = false;

const hasUpscaleEngine = () => existsSync(REALESRGAN_BIN) && existsSync(REALESRGAN_MODELS);

const runRealEsrgan = (inputPath, outputPath, scale) =>
  new Promise((resolve, reject) => {
    // Modelo anime/illustration: melhor para line art
    const args = [
      '-i', inputPath,
      '-o', outputPath,
      '-s', String(scale),
      '-n', 'realesrgan-x4plus-anime',
      '-m', REALESRGAN_MODELS,
      '-f', 'png',
      '-t', '100',
    ];

    const proc = spawn(REALESRGAN_BIN, args, { cwd: REALESRGAN_DIR });
    let err = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Timeout no upscale (motor demorou demais)'));
    }, UPSCALE_TIMEOUT_MS);

    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.stdout.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && existsSync(outputPath)) resolve();
      else reject(new Error(err.trim() || `Real-ESRGAN exit ${code}`));
    });
  });

// Decodifica e persiste os cookies do YouTube no disco ao iniciar
if (process.env.YOUTUBE_COOKIES_B64) {
  try {
    const decoded = Buffer.from(process.env.YOUTUBE_COOKIES_B64, 'base64').toString('utf8');
    writeFileSync(COOKIES_PATH, decoded);
    console.log('✅ Cookies do YouTube carregados');
  } catch (err) {
    console.warn('⚠️  Falha ao carregar cookies:', err.message);
  }
} else {
  console.warn('⚠️  YOUTUBE_COOKIES_B64 não definido — requisições podem ser bloqueadas pelo YouTube');
}

function buildArgs(extra) {
  const hasCookies = existsSync(COOKIES_PATH);
  const args = [
    '--extractor-args', hasCookies
      ? 'youtube:player_client=web,mweb'
      : 'youtube:player_client=ios,android',
    '--no-playlist',
  ];
  if (hasCookies) args.push('--cookies', COOKIES_PATH);
  return [...args, ...extra];
}

function spawnAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = '';
    let err = '';
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { err += d; });
    proc.on('close', code => (code === 0 ? resolve(out) : reject(new Error(err))));
    proc.on('error', reject);
  });
}

// Pesquisa
app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parâmetro "q" obrigatório' });
  try {
    const r = await ytSearch(q);
    res.json(r.videos.slice(0, 10).map(v => ({
      id: v.videoId,
      title: v.title,
      channel: v.author.name,
      duration: v.timestamp,
      thumbnail: v.thumbnail,
      url: v.url,
    })));
  } catch (err) {
    console.error('Erro na pesquisa:', err.message);
    res.status(500).json({ error: 'Falha ao pesquisar' });
  }
});

// Stream → retorna URL direta do YouTube e redireciona
app.get('/stream', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatório' });
  const ytUrl = `https://www.youtube.com/watch?v=${id}`;
  try {
    const stdout = await spawnAsync(ytDlpPath, buildArgs([
      '-g', '-f', 'bestaudio[ext=m4a]/bestaudio', ytUrl,
    ]));
    const directUrl = stdout.trim();
    if (!directUrl) throw new Error('URL não encontrada');
    res.redirect(directUrl);
  } catch (err) {
    console.error('Erro no stream:', err.message);
    res.status(500).json({ error: 'Falha ao obter stream' });
  }
});

// Download → pipe do áudio direto pro cliente
app.get('/download', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatório' });
  const ytUrl = `https://www.youtube.com/watch?v=${id}`;
  try {
    const infoOut = await spawnAsync(ytDlpPath, buildArgs([
      '--dump-json', '-f', 'bestaudio[ext=m4a]/bestaudio', ytUrl,
    ]));
    const info = JSON.parse(infoOut);
    const title = info.title.replace(/[^a-zA-Z0-9 _-]/gi, '');

    res.setHeader('Content-Disposition', `attachment; filename="${title}.m4a"`);
    res.setHeader('Content-Type', 'audio/mp4');
    if (info.filesize || info.filesize_approx) {
      res.setHeader('Content-Length', info.filesize || info.filesize_approx);
    }

    const dl = spawn(ytDlpPath, buildArgs(['-o', '-', '-f', 'bestaudio[ext=m4a]/bestaudio', ytUrl]));
    dl.stdout.pipe(res);
    req.on('close', () => dl.kill());
  } catch (err) {
    console.error('Erro no download:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Falha no download' });
  }
});

/**
 * POST /upscale?scale=2|4
 * multipart field: file
 * Resposta: image/png
 */
app.post('/upscale', upload.single('file'), async (req, res) => {
  const inputPath = req.file?.path;
  const outputPath = path.join('/tmp', `zenith-upscale-${randomUUID()}.png`);

  const cleanup = async () => {
    if (inputPath) {
      try { await unlink(inputPath); } catch { /* ignore */ }
    }
    try { await unlink(outputPath); } catch { /* ignore */ }
  };

  try {
    if (!hasUpscaleEngine()) {
      return res.status(503).json({
        error: 'Motor Real-ESRGAN não instalado. Rode npm run setup:realesrgan na pasta api/.',
      });
    }

    if (upscaleBusy) {
      return res.status(503).json({ error: 'Upscale ocupado. Aguarde o job atual terminar.' });
    }

    const scale = Number(req.query.scale);
    if (scale !== 2 && scale !== 4) {
      return res.status(400).json({ error: 'scale deve ser 2 ou 4' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Campo "file" obrigatório (multipart)' });
    }

    const mime = (req.file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return res.status(400).json({ error: 'Arquivo inválido. Use PNG, JPG ou WebP.' });
    }

    const buf = await readFile(inputPath);
    let width;
    let height;
    try {
      const size = imageSize(buf);
      width = size.width;
      height = size.height;
    } catch {
      return res.status(400).json({ error: 'Não foi possível ler dimensões da imagem' });
    }

    if (!width || !height) {
      return res.status(400).json({ error: 'Dimensões inválidas' });
    }

    upscaleBusy = true;
    await runRealEsrgan(inputPath, outputPath, scale);

    const outBuf = await readFile(outputPath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="upscaled_${scale}x.png"`);
    res.setHeader('Content-Length', outBuf.length);
    res.setHeader('X-Upscale-Scale', String(scale));
    res.setHeader('X-Upscale-Input', `${width}x${height}`);
    res.send(outBuf);
  } catch (err) {
    console.error('Erro no upscale:', err.message);
    if (!res.headersSent) {
      const msg = String(err.message || '');
      if (msg.includes('Timeout')) {
        res.status(500).json({ error: 'Timeout: o motor demorou demais (tente 2x ou imagem menor).' });
      } else if (/ENOMEM|Cannot allocate|killed|SIGKILL|out of memory/i.test(msg)) {
        res.status(500).json({ error: 'Sem memória no servidor (OOM). Use imagem menor ou host com mais RAM.' });
      } else if (/vulkan|gpu|vk/i.test(msg)) {
        res.status(500).json({
          error: 'Real-ESRGAN precisa de Vulkan/GPU. Em CPU-only (ex.: Render free) pode falhar; rode a API localmente.',
        });
      } else {
        res.status(500).json({ error: 'Falha do modelo no upscale' });
      }
    }
  } finally {
    upscaleBusy = false;
    await cleanup();
  }
});

app.get('/health', (_, res) =>
  res.json({
    status: 'ok',
    hasCookies: existsSync(COOKIES_PATH),
    hasUpscaleEngine: hasUpscaleEngine(),
  }),
);

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3333;
app.listen(PORT, HOST, () => {
  console.log(`🚀 Zenith API rodando em http://${HOST}:${PORT}`);
  console.log(
    hasUpscaleEngine()
      ? '✅ Real-ESRGAN disponível'
      : '⚠️  Real-ESRGAN ausente — rode npm run setup:realesrgan',
  );
});
