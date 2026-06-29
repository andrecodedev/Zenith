import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import path from 'path';

const exec = promisify(execCallback);

const app = express();
app.use(cors());
app.use(express.json());

// Resolve path to the locally downloaded yt-dlp binary
const ytDlpPath = path.resolve('./yt-dlp_linux');

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

// Rota 2: Download do Áudio usando yt-dlp local
app.get('/download', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatorio' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    
    const { stdout: infoJson } = await exec(`"${ytDlpPath}" --dump-json -f "bestaudio[ext=m4a]" ${url}`);
    const info = JSON.parse(infoJson);
    const title = info.title.replace(/[^a-zA-Z0-9 _-]/gi, ''); 
    
    res.header('Content-Disposition', `attachment; filename="${title}.m4a"`);
    res.header('Content-Type', 'audio/mp4');
    
    if (info.filesize || info.filesize_approx) {
      res.header('Content-Length', info.filesize || info.filesize_approx);
    }

    const ytdlp = spawn(ytDlpPath, ['-o', '-', '-f', 'bestaudio[ext=m4a]', url]);
    
    ytdlp.stdout.pipe(res);
    
    req.on('close', () => {
       ytdlp.kill();
    });

  } catch (error) {
    console.error('Erro no download:', error);
    if (!res.headersSent) {
      res.status(500).send('Falha ao processar o download');
    }
  }
});

// Rota 3: Streaming Direto
app.get('/stream', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Video ID obrigatorio' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    const { stdout } = await exec(`"${ytDlpPath}" -g -f "bestaudio[ext=m4a]" ${url}`);
    const directUrl = stdout.trim();
    if (directUrl) {
      res.redirect(directUrl);
    } else {
      res.status(404).send('URL de stream não encontrada');
    }
  } catch (error) {
    console.error('Erro no stream:', error);
    res.status(500).send('Falha ao obter stream');
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Zenith Music API (Powered by Standalone yt-dlp) rodando na porta ${PORT}`);
});
