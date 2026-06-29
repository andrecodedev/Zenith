import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import { Readable } from 'stream';

const app = express();
app.use(cors());
app.use(express.json());

// Instâncias Piped em ordem de prioridade — se uma cair, tenta a próxima
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.darkness.services',
  'https://api.piped.projectsegfau.lt',
  'https://piped-api.garudalinux.org',
];

async function getPipedStreams(videoId) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.audioStreams?.length) continue;
      return data;
    } catch {
      continue;
    }
  }
  throw new Error('Todas as instâncias Piped falharam');
}

function getBestAudio(audioStreams) {
  const m4a = audioStreams.filter(s => s.mimeType?.includes('mp4'));
  const pool = m4a.length ? m4a : audioStreams;
  return pool.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
}

// Rota 1: Pesquisa no YouTube
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
    console.error('Erro na pesquisa:', err);
    res.status(500).json({ error: 'Falha ao pesquisar no YouTube' });
  }
});

// Rota 2: Stream direto — redireciona para URL de áudio do Piped
app.get('/stream', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatório' });
  try {
    const data = await getPipedStreams(id);
    const stream = getBestAudio(data.audioStreams);
    res.redirect(stream.url);
  } catch (err) {
    console.error('Erro no stream:', err);
    res.status(500).json({ error: 'Falha ao obter stream' });
  }
});

// Rota 3: Download do áudio
app.get('/download', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatório' });
  try {
    const data = await getPipedStreams(id);
    const stream = getBestAudio(data.audioStreams);
    const title = (data.title || id).replace(/[^a-zA-Z0-9 _-]/gi, '');

    const audioRes = await fetch(stream.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!audioRes.ok) throw new Error(`Falha ao buscar áudio: ${audioRes.status}`);

    res.setHeader('Content-Disposition', `attachment; filename="${title}.m4a"`);
    res.setHeader('Content-Type', stream.mimeType || 'audio/mp4');
    const contentLength = audioRes.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    console.error('Erro no download:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Falha no download' });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Zenith Music API (Powered by Piped) rodando na porta ${PORT}`);
});
