import { useState, useRef, useEffect } from 'react';
import { Search, Music, Download, Play, X, Settings2, XCircle, Clock, Pause, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';

export function MusicDownloaderView() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadETA, setDownloadETA] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const { playingVideo, setPlayingVideo, isPlaying, setIsPlaying, setMusicHistory, musicTab, setMusicTab } = useStore();
  const [history, setHistory] = useState<any[]>([]);
  const [videoToDelete, setVideoToDelete] = useState<any | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('Todas');

  const availableGenres = ['Todas', ...Array.from(new Set(history.map(v => v.genre || 'Geral')))];
  const filteredHistory = selectedGenre === 'Todas' ? history : history.filter(v => (v.genre || 'Geral') === selectedGenre);



  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('music_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        // Mapear colunas do BD para o formato que a UI espera
        const mapped = data.map(r => ({
          id: r.video_id,
          title: r.title,
          channel: r.channel,
          duration: r.duration,
          thumbnail: r.thumbnail,
          genre: r.genre || 'Geral'
        }));
        setHistory(mapped);
        setMusicHistory(mapped);
      }
    };
    fetchHistory();
  }, []);

  const autoCategorizeMusic = (title: string, channel: string) => {
    const t = (title + ' ' + channel).toLowerCase();
    if (t.includes('rap') || t.includes('hip hop') || t.includes('trap')) return 'Rap/Hip-Hop';
    if (t.includes('funk') || t.includes('mandelão') || t.includes('mandelao') || t.includes('dj')) return 'Funk';
    if (t.includes('sertanejo') || t.includes('agronejo') || t.includes('modão') || t.includes('modao')) return 'Sertanejo';
    if (t.includes('rock') || t.includes('metal') || t.includes('punk') || t.includes('indie')) return 'Rock';
    if (t.includes('mpb') || t.includes('bossa') || t.includes('acústico') || t.includes('acustico')) return 'MPB';
    if (t.includes('pagode') || t.includes('samba')) return 'Samba/Pagode';
    if (t.includes('eletronica') || t.includes('eletrônica') || t.includes('edm') || t.includes('dance') || t.includes('house')) return 'Eletrônica';
    if (t.includes('pop')) return 'Pop';
    if (t.includes('gospel') || t.includes('louvor') || t.includes('adoração')) return 'Gospel';
    if (t.includes('lofi') || t.includes('lo-fi') || t.includes('chill') || t.includes('relax')) return 'Lo-Fi';
    return 'Geral';
  };

  const saveToHistory = async (video: any) => {
    const genre = autoCategorizeMusic(video.title, video.channel);
    const videoWithCategory = { ...video, genre };

    // Atualiza local imediatamente para UX rápida
    setHistory(prev => {
      const filtered = prev.filter(v => v.id !== videoWithCategory.id);
      return [videoWithCategory, ...filtered];
    });

    // Salva no banco de dados (nuvem)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Deleta anterior se existir para evitar duplicados (upsert simplificado)
      await supabase.from('music_history').delete().eq('user_id', user.id).eq('video_id', videoWithCategory.id);
      await supabase.from('music_history').insert({
        user_id: user.id,
        video_id: videoWithCategory.id,
        title: videoWithCategory.title,
        channel: videoWithCategory.channel,
        duration: videoWithCategory.duration,
        thumbnail: videoWithCategory.thumbnail,
        genre: videoWithCategory.genre
      });
    }
  };

  const deleteFromHistory = async (videoId: string) => {
    // Atualiza o estado local
    setHistory(prev => {
      const newHistory = prev.filter(v => v.id !== videoId);
      setMusicHistory(newHistory); // atualiza a fila do player tbm
      return newHistory;
    });

    // Remove do banco de dados
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('music_history').delete().eq('user_id', user.id).eq('video_id', videoId);
    }
  };

  const togglePlay = (video: any, queueToUse: any[] = filteredHistory) => {
    if (playingVideo?.id === video.id) {
      setIsPlaying(!isPlaying);
    } else {
      setPlayingVideo(video);
      setIsPlaying(true);
      // Atualiza a fila do player apenas com as músicas da visualização atual (filtro)
      setMusicHistory(queueToUse);
    }
  };

  const playCategory = () => {
    if (filteredHistory.length > 0) {
      togglePlay(filteredHistory[0], filteredHistory);
    }
  };



  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    setSelectedVideo(null); // Clear selected video on new search
    try {
      // Fazendo a busca de verdade no nosso novo backend
      const res = await fetch(`http://localhost:3333/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Falha ao buscar');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
      alert('Erro ao buscar as músicas. O backend tá rodando?');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedVideo || downloadProgress !== null) return;
    
    setDownloadProgress(0);
    setDownloadETA('Calculando...');
    
    abortControllerRef.current = new AbortController();
    
    try {
      const startTime = Date.now();
      const res = await fetch(`http://localhost:3333/download?id=${selectedVideo.id}`, {
        signal: abortControllerRef.current.signal
      });
      
      if (!res.ok) throw new Error('Falha no download');

      const contentLength = res.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Stream não suportada');

      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (total) {
          const progress = Math.round((loaded / total) * 100);
          setDownloadProgress(progress);
          
          const elapsed = (Date.now() - startTime) / 1000; // seconds
          if (elapsed > 1) {
            const speed = loaded / elapsed;
            const remainingBytes = total - loaded;
            const remainingSeconds = remainingBytes / speed;
            
            if (remainingSeconds < 60) {
              setDownloadETA(`${Math.round(remainingSeconds)}s restantes`);
            } else {
              setDownloadETA(`${Math.floor(remainingSeconds / 60)}m ${Math.round(remainingSeconds % 60)}s`);
            }
          }
        }
      }

      setDownloadETA('Salvando...');
      const blob = new Blob(chunks, { type: 'audio/mp4' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedVideo.title.replace(/[^a-zA-Z0-9 _-]/gi, '')}.m4a`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      saveToHistory(selectedVideo);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Download cancelado pelo usuário');
      } else {
        console.error(err);
        alert('Erro no download. Tente novamente.');
      }
    } finally {
      setDownloadProgress(null);
      setDownloadETA('');
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="w-full flex flex-col px-4 max-w-4xl mx-auto h-full pb-20">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-title mb-2 flex items-center gap-3">
            <Music className="text-text-primary" /> 
            Zenith Music
          </h2>
          <p className="text-text-secondary">Busque no YouTube e baixe em MP3/M4A sem anúncios.</p>
        </div>
        
        <div className="flex bg-bg-secondary p-1 rounded-xl border border-border-base w-fit shrink-0">
          <button
            onClick={() => setMusicTab('search')}
            className={`px-4 sm:px-6 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer flex items-center gap-2 ${musicTab === 'search' ? 'bg-text-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <Search size={16} /> Pesquisar
          </button>
          <button
            onClick={() => setMusicTab('history')}
            className={`px-4 sm:px-6 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer flex items-center gap-2 ${musicTab === 'history' ? 'bg-text-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <Clock size={16} /> Minhas Músicas
          </button>
        </div>
      </div>

      {musicTab === 'search' && (
        <>
          <div className="bg-bg-secondary border border-border-base rounded-2xl p-6 shadow-xl mb-8">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" size={20} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Digite o nome da música ou artista..."
                  className="w-full bg-bg-primary border border-border-base rounded-xl py-3 pl-12 pr-4 text-text-primary outline-none focus:border-neutral-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="bg-text-primary text-bg-primary font-bold px-8 py-3 rounded-xl hover:bg-neutral-300 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
          </div>

      {results.length > 0 && !selectedVideo && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Settings2 size={20} /> Resultados Encontrados
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((video) => (
              <div 
                key={video.id} 
                onClick={() => setSelectedVideo(video)}
                className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden hover:border-neutral-500 transition-colors cursor-pointer group flex flex-col"
              >
                <div className="relative aspect-video bg-elements w-full">
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h4 className="font-bold text-text-primary line-clamp-2 text-sm mb-1 group-hover:text-neutral-400 transition-colors">
                    {video.title}
                  </h4>
                  <p className="text-xs text-text-tertiary mt-auto">
                    {video.channel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedVideo && (
        <div className="bg-bg-secondary border border-border-base rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-6 relative overflow-hidden">
          <button 
            onClick={() => setSelectedVideo(null)}
            className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary cursor-pointer p-1"
          >
            <X size={24} />
          </button>
          
          <div className="w-full md:w-48 aspect-video md:aspect-square shrink-0 rounded-xl overflow-hidden bg-elements relative">
            <img src={selectedVideo.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Play className="text-white opacity-80" size={32} />
            </div>
          </div>
          
          <div className="flex flex-col flex-1 justify-center">
            <h3 className="text-xl font-bold text-text-primary mb-2 pr-8">{selectedVideo.title}</h3>
            <p className="text-text-secondary text-sm mb-6">{selectedVideo.channel} • {selectedVideo.duration}</p>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-auto">
              <div className="flex-1 flex gap-2 relative">
                <button 
                  onClick={handleDownload}
                  disabled={downloadProgress !== null}
                  className="relative overflow-hidden flex items-center justify-center gap-2 bg-text-primary text-bg-primary font-bold px-6 py-3 rounded-xl hover:bg-neutral-300 transition-colors flex-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  {downloadProgress !== null && (
                    <div 
                      className="absolute top-0 left-0 h-full bg-neutral-400/30 transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  )}
                  
                  <Download size={18} className="relative z-10" />
                  <span className="relative z-10">
                    {downloadProgress !== null 
                      ? `Baixando... ${downloadProgress}% (${downloadETA})`
                      : 'Baixar M4A (Áudio Nativo)'
                    }
                  </span>
                </button>

                {downloadProgress !== null && (
                  <button
                    onClick={handleCancel}
                    className="flex shrink-0 items-center justify-center bg-bg-primary border border-border-base text-text-primary hover:bg-elements hover:text-red-500 transition-colors rounded-xl px-4 cursor-pointer"
                    title="Cancelar download"
                  >
                    <XCircle size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {musicTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Clock size={20} /> Histórico
              </h3>
              {filteredHistory.length > 0 && (
                <button 
                  onClick={playCategory}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-text-primary text-bg-primary font-bold text-xs hover:scale-105 transition-transform cursor-pointer"
                >
                  <Play size={14} fill="currentColor" />
                  Tocar {selectedGenre}
                </button>
              )}
            </div>
            
            {history.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                {availableGenres.map(genre => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${selectedGenre === genre ? 'bg-text-primary text-bg-primary' : 'bg-elements text-text-secondary hover:text-text-primary hover:bg-elements/80'}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="bg-bg-secondary border border-border-base rounded-2xl p-8 text-center text-text-tertiary">
              {history.length === 0 
                ? 'Nenhuma música baixada ainda. Quando você baixar, elas aparecerão aqui.'
                : 'Nenhuma música encontrada para esta categoria.'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredHistory.map((video) => (
                <div key={video.id} className="bg-bg-secondary border border-border-base rounded-xl p-4 flex items-center gap-4 hover:border-neutral-500 transition-colors">
                  <div className="w-16 h-16 md:w-24 md:h-16 shrink-0 rounded overflow-hidden bg-elements relative">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-text-primary truncate text-sm mb-1">{video.title}</h4>
                    <p className="text-xs text-text-tertiary truncate flex items-center gap-2">
                      {video.channel} 
                      {video.genre && <span className="bg-elements px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{video.genre}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => togglePlay(video)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${playingVideo?.id === video.id ? 'bg-text-primary text-bg-primary' : 'bg-bg-primary border border-border-base text-text-primary hover:bg-elements'}`}
                    >
                      {playingVideo?.id === video.id && isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button 
                      onClick={() => { setSelectedVideo(video); setMusicTab('search'); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-bg-primary border border-border-base text-text-primary hover:bg-elements transition-colors cursor-pointer"
                      title="Baixar novamente"
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      onClick={() => setVideoToDelete(video)}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-bg-primary border border-border-base text-text-tertiary hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors cursor-pointer"
                      title="Remover do histórico"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {videoToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-secondary border border-border-base rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-in-center">
            <h3 className="text-xl font-bold text-text-primary mb-2">Excluir Música</h3>
            <p className="text-text-secondary text-sm mb-6">
              Tem certeza que deseja remover <span className="text-text-primary font-bold">"{videoToDelete.title}"</span> do seu histórico? Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setVideoToDelete(null)}
                className="px-4 py-2 rounded-lg font-bold text-sm text-text-primary bg-elements hover:bg-elements/80 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  deleteFromHistory(videoToDelete.id);
                  setVideoToDelete(null);
                }}
                className="px-4 py-2 rounded-lg font-bold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
