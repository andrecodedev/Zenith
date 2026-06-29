import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import ytdl from '@distube/ytdl-core';

const app = express();
app.use(cors());
app.use(express.json());

// Rota 1: Pesquisa no YouTube
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Faltou o parametro "q" (query)' });

  try {
    const r = await ytSearch(query);
    const videos = r.videos.slice(0, 10).map(v => ({
      id: v.videoId,
      title: v.title,
      channel: v.author.name,
      duration: v.timestamp,
      thumbnail: v.thumbnail,
      url: v.url
    }));
    res.json(videos);
  } catch (error) {
    console.error('Erro na pesquisa:', error);
    res.status(500).json({ error: 'Falha ao pesquisar no YouTube' });
  }
});

// Rota 2: Download do Áudio usando Node puro
app.get('/download', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatorio' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 _-]/gi, '');
    
    res.header('Content-Disposition', `attachment; filename="${title}.m4a"`);
    res.header('Content-Type', 'audio/mp4');

    ytdl(url, { filter: 'audioonly', quality: 'highestaudio' }).pipe(res);
  } catch (error) {
    console.error('Erro no download:', error);
    if (!res.headersSent) {
      res.status(500).send('Falha ao processar o download');
    }
  }
});

// Rota 3: Streaming Direto
app.get('/stream', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatorio' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    ytdl(url, { filter: 'audioonly', quality: 'highestaudio' }).pipe(res);
  } catch (error) {
    console.error('Erro no stream:', error);
    res.status(500).send('Falha ao obter stream');
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Zenith Music API (Node.js) rodando na porta ${PORT}`);
});
