import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import { spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const ytDlpPath = path.resolve('./yt-dlp_linux');
const COOKIES_PATH = '/tmp/yt-cookies.txt';

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

app.get('/health', (_, res) => res.json({ status: 'ok', hasCookies: existsSync(COOKIES_PATH) }));

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log(`🚀 Zenith API rodando na porta ${PORT}`));
