import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import { Readable } from 'stream';

const app = express();
app.use(cors());
app.use(express.json());

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.darkness.services',
  'https://api.piped.projectsegfau.lt',
  'https://piped-api.garudalinux.org',
  'https://watchapi.whatever.social',
  'https://pipedapi.in.projectsegfau.lt',
];

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.kavin.rocks',
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://inv.tux.pizza',
];

async function safeFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Zenith/1.0)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function bestAudioFromPiped(streams) {
  const m4a = streams.filter(s => s.mimeType?.includes('mp4'));
  const pool = m4a.length ? m4a : streams;
  return pool.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
}

function bestAudioFromInvidious(formats) {
  const audio = formats.filter(f => f.type?.startsWith('audio'));
  const m4a = audio.filter(f => f.type?.includes('mp4') || f.type?.includes('aac'));
  const pool = m4a.length ? m4a : audio;
  return pool.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
}

async function getAudioStream(videoId) {
  // Tier 1: Piped
  for (const base of PIPED_INSTANCES) {
    try {
      const data = await safeFetch(`${base}/streams/${videoId}`);
      const best = bestAudioFromPiped(data.audioStreams || []);
      if (!best?.url) continue;
      console.log(`[OK] Piped: ${base}`);
      return { url: best.url, mimeType: best.mimeType || 'audio/mp4', title: data.title || videoId };
    } catch (err) {
      console.warn(`[FAIL] Piped ${base}: ${err.message}`);
    }
  }

  // Tier 2: Invidious
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const data = await safeFetch(`${base}/api/v1/videos/${videoId}?fields=title,adaptiveFormats`);
      const best = bestAudioFromInvidious(data.adaptiveFormats || []);
      if (!best?.url) continue;
      console.log(`[OK] Invidious: ${base}`);
      const mimeType = best.type?.split(';')[0] || 'audio/mp4';
      return { url: best.url, mimeType, title: data.title || videoId };
    } catch (err) {
      console.warn(`[FAIL] Invidious ${base}: ${err.message}`);
    }
  }

  throw new Error('Todos os provedores falharam (Piped + Invidious)');
}

// Pesquisa no YouTube
app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parâmetro "q" obrigatório' });
  try {
    const r = await ytSearch(q);
    const videos = r.videos.slice(0, 10).map(v => ({
      id: v.videoId,
      title: v.title,
      channel: v.author.name,
      duration: v.timestamp,
      thumbnail: v.thumbnail,
      url: v.url,
    }));
    res.json(videos);
  } catch (err) {
    console.error('Erro na pesquisa:', err.message);
    res.status(500).json({ error: 'Falha ao pesquisar no YouTube' });
  }
});

// Stream direto → redireciona para URL de áudio
app.get('/stream', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatório' });
  try {
    const { url } = await getAudioStream(id);
    res.redirect(url);
  } catch (err) {
    console.error('Erro no stream:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Download do áudio
app.get('/download', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatório' });
  try {
    const { url, mimeType, title } = await getAudioStream(id);
    const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/gi, '');
    const ext = mimeType.includes('webm') ? 'webm' : 'm4a';

    const audioRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!audioRes.ok) throw new Error(`Falha ao buscar áudio: ${audioRes.status}`);

    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);
    res.setHeader('Content-Type', mimeType);
    const len = audioRes.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);

    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    console.error('Erro no download:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', providers: { piped: PIPED_INSTANCES.length, invidious: INVIDIOUS_INSTANCES.length } }));

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Zenith Music API (Piped + Invidious) rodando na porta ${PORT}`);
});
