import { useState, useRef, useEffect } from 'react';
import { Search, Music, Download, Play, X, Settings2, XCircle, Clock, Pause, Trash2, List, Check, Loader2, Tag, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
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
  const [videoToCategorize, setVideoToCategorize] = useState<any | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('Todas');

  // Batch states
  const [batchText, setBatchText] = useState('');
  const [batchItems, setBatchItems] = useState<any[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  
  const abortBatchRef = useRef<boolean>(false);

  // Genre Carousel States
  const genresRef = useRef<HTMLDivElement>(null);
  const [canScrollLeftGenre, setCanScrollLeftGenre] = useState(false);
  const [canScrollRightGenre, setCanScrollRightGenre] = useState(false);

  const checkScrollGenre = () => {
    if (genresRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = genresRef.current;
      setCanScrollLeftGenre(scrollLeft > 0);
      setCanScrollRightGenre(Math.ceil(scrollLeft) < scrollWidth - clientWidth - 1);
    }
  };

  const [retryModalData, setRetryModalData] = useState<{ isOpen: boolean, itemIndex: number, query: string }>({ isOpen: false, itemIndex: -1, query: '' });
  const [duplicateWarningData, setDuplicateWarningData] = useState<{isOpen: boolean, video: any, isBatch: boolean, itemIndex?: number}>({isOpen: false, video: null, isBatch: false});
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  useEffect(() => {
    checkScrollGenre();
    window.addEventListener('resize', checkScrollGenre);
    return () => window.removeEventListener('resize', checkScrollGenre);
  }, []);

  useEffect(() => {
    // Re-check when history loads
    setTimeout(checkScrollGenre, 100);
  }, [history]);
  const [downloadQueue, setDownloadQueue] = useState<{video: any, itemIndex: number}[]>([]);
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);

  // Processa a fila de downloads sequencialmente
  useEffect(() => {
    if (downloadQueue.length > 0 && !isDownloadingBatch) {
      processNextInQueue();
    }
  }, [downloadQueue, isDownloadingBatch]);

  const processNextInQueue = async () => {
    if (downloadQueue.length === 0) return;
    
    const nextItem = downloadQueue[0];
    setIsDownloadingBatch(true);
    await executeBatchDownload(nextItem.video, nextItem.itemIndex);
    
    // Remove processado da fila
    setDownloadQueue(prev => prev.slice(1));
    setIsDownloadingBatch(false);
  };

  const defaultGenres = ['Geral', 'Pop', 'Rock', 'Eletrônica', 'Hip-Hop', 'Sertanejo', 'Lofi', 'Podcast', 'Foco'];
  const dynamicGenres = Array.from(new Set(history.map(v => v.genre || 'Geral')));
  const availableGenres = ['Todas', ...Array.from(new Set([...defaultGenres, ...dynamicGenres]))];
  const normalizeText = (text: string) => 
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredHistory = history.filter(v => {
    const matchesGenre = selectedGenre === 'Todas' || (v.genre || 'Geral') === selectedGenre;
    const searchNormalized = normalizeText(historySearchQuery);
    const matchesSearch = historySearchQuery === '' || 
      normalizeText(v.title).includes(searchNormalized) || 
      normalizeText(v.channel).includes(searchNormalized);
    return matchesGenre && matchesSearch;
  });



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
    // Se a música excluída for a que está tocando, para o player
    if (playingVideo?.id === videoId || playingVideo?.video_id === videoId) {
      setPlayingVideo(null);
      setIsPlaying(false);
    }

    // Atualiza o estado local
    setHistory(prev => {
      const newHistory = prev.filter(v => v.id !== videoId && v.video_id !== videoId);
      setMusicHistory(newHistory); // atualiza a fila do player tbm
      return newHistory;
    });

    // Remove do banco de dados
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('music_history').delete().eq('user_id', user.id).eq('video_id', videoId);
    }
  };

  const updateVideoCategory = async (videoId: string, newGenre: string) => {
    if (!newGenre.trim()) return;
    
    // Atualiza estado local
    setHistory(prev => {
      const newHistory = prev.map(v => v.id === videoId || v.video_id === videoId ? { ...v, genre: newGenre } : v);
      setMusicHistory(newHistory);
      return newHistory;
    });

    // Atualiza no banco
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('music_history').update({ genre: newGenre }).eq('user_id', user.id).eq('video_id', videoId);
    }
    setVideoToCategorize(null);
    setNewCategory('');
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

  const handleBatchProcess = async () => {
    if (!batchText.trim()) return;
    const lines = batchText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    abortBatchRef.current = false;

    const initialItems = lines.map(line => ({
      query: line,
      status: 'pending', // pending, searching, ready
      results: []
    }));
    
    setBatchItems(initialItems);
    setIsBatchProcessing(true);

    let currentItems = [...initialItems];

    for (let i = 0; i < currentItems.length; i++) {
      if (abortBatchRef.current) break;

      currentItems[i].status = 'searching';
      setBatchItems([...currentItems]);

      try {
        const res = await fetch(`http://localhost:3333/search?q=${encodeURIComponent(currentItems[i].query)}`);
        const data = await res.json();
        currentItems[i].results = data.slice(0, 3); // top 3
        currentItems[i].status = 'ready';
      } catch (err) {
        currentItems[i].status = 'error';
      }
      setBatchItems([...currentItems]);
      // Small delay to prevent rate limit
      if (!abortBatchRef.current) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    setIsBatchProcessing(false);
  };

  const handleCancelBatch = () => {
    abortBatchRef.current = true;
    setIsBatchProcessing(false);
    setDownloadQueue([]); // Limpa a fila
  };

  const resetBatch = () => {
    handleCancelBatch();
    setBatchItems([]);
    setBatchText('');
  };

  const queueBatchDownload = (video: any, itemIndex: number, skipDuplicateCheck = false) => {
    if (skipDuplicateCheck !== true && history.some(v => v.id === video.id || v.video_id === video.id)) {
      setDuplicateWarningData({ isOpen: true, video, isBatch: true, itemIndex });
      return;
    }

    const items = [...batchItems];
    items[itemIndex].status = 'queued'; // Mark as queued
    setBatchItems(items);
    setDownloadQueue(prev => [...prev, { video, itemIndex }]);
  };

  const executeBatchDownload = async (video: any, itemIndex: number) => {
    try {
      const items = [...batchItems];
      items[itemIndex].status = 'downloading';
      setBatchItems(items);

      const res = await fetch(`http://localhost:3333/download?id=${video.id}`);
      if (!res.ok) throw new Error('Falha no download');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.title.replace(/[^a-zA-Z0-9 _-]/gi, '')}.m4a`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      saveToHistory(video);
      
      const updatedItems = [...batchItems];
      updatedItems[itemIndex].status = 'done';
      setBatchItems(updatedItems);
    } catch (err) {
      console.error(err);
      alert('Erro no download do lote.');
      const items = [...batchItems];
      items[itemIndex].status = 'error';
      setBatchItems(items);
    }
  };

  const openRetryModal = (itemIndex: number) => {
    setRetryModalData({ isOpen: true, itemIndex, query: batchItems[itemIndex].query });
  };

  const handleRetrySubmit = async () => {
    const { itemIndex, query: newQuery } = retryModalData;
    setRetryModalData({ isOpen: false, itemIndex: -1, query: '' });
    
    if (!newQuery || !newQuery.trim()) return;

    const items = [...batchItems];
    items[itemIndex].query = newQuery;
    items[itemIndex].status = 'searching';
    setBatchItems(items);

    try {
      const res = await fetch(`http://localhost:3333/search?q=${encodeURIComponent(newQuery)}`);
      const data = await res.json();
      items[itemIndex].results = data.slice(0, 3);
      items[itemIndex].status = 'ready';
    } catch (err) {
      items[itemIndex].status = 'error';
    }
    setBatchItems([...items]);
  };

  const handleDownload = async (skipDuplicateCheck = false) => {
    if (!selectedVideo || downloadProgress !== null) return;
    
    if (skipDuplicateCheck !== true && history.some(v => v.id === selectedVideo.id || v.video_id === selectedVideo.id)) {
      setDuplicateWarningData({ isOpen: true, video: selectedVideo, isBatch: false });
      return;
    }
    
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
      
      setVideoToCategorize(selectedVideo);
      setNewCategory('');
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
    <div className="w-full flex flex-col px-4 max-w-4xl mx-auto min-h-full">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-title mb-2 flex items-center gap-3">
            <Music className="text-text-primary" /> 
            Zenith Music
          </h2>
          <p className="text-text-secondary">Busque no YouTube e baixe em MP3/M4A sem anúncios.</p>
        </div>
        
        <div className="flex bg-bg-secondary p-1 rounded-xl border border-border-base w-full md:w-fit shrink-0 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setMusicTab('search')}
            className={`flex-1 justify-center px-3 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${musicTab === 'search' ? 'bg-text-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <Search size={16} /> Pesquisar
          </button>
          <button
            onClick={() => setMusicTab('batch')}
            className={`flex-1 justify-center px-3 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${musicTab === 'batch' ? 'bg-text-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <List size={16} /> Lote
          </button>
          <button
            onClick={() => setMusicTab('history')}
            className={`flex-1 justify-center px-3 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${musicTab === 'history' ? 'bg-text-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <Music size={16} /> Minhas Músicas
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
                  {/* Play Preview Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingVideo(video);
                        setIsPlaying(true);
                      }}
                      className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl cursor-pointer"
                      title="Ouvir Prévia"
                    >
                      <Play size={20} className="ml-1" fill="currentColor" />
                    </button>
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
                  onClick={() => handleDownload(false)}
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

      {musicTab === 'batch' && (
        <div className="space-y-6">
          <div className="bg-bg-secondary border border-border-base rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-text-primary mb-2">Modo Aprovação (Lote)</h3>
            <p className="text-text-tertiary text-sm mb-4">
              Cole a lista de músicas (uma por linha). O Zenith vai pesquisar automaticamente todas elas. Depois, você escolhe qual versão baixar.
            </p>
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Ex:&#10;FIGHTERS - Sture Zetterberg&#10;At The Rainbow's End&#10;Distant Fortune..."
              className="w-full h-40 bg-bg-primary border border-border-base rounded-xl p-4 text-text-primary outline-none focus:border-neutral-500 transition-colors mb-4 resize-none"
            />
            <div className="flex justify-end gap-3">
              {batchItems.length > 0 && (
                <button
                  onClick={resetBatch}
                  className="px-6 py-3 rounded-xl border border-border-base text-text-tertiary hover:text-text-primary hover:bg-bg-primary transition-colors cursor-pointer font-bold text-sm"
                >
                  Limpar / Recomeçar
                </button>
              )}
              {isBatchProcessing ? (
                <button
                  onClick={handleCancelBatch}
                  className="bg-red-500/10 text-red-500 font-bold px-8 py-3 rounded-xl hover:bg-red-500 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <X size={18} /> Cancelar Processo
                </button>
              ) : (
                <button
                  onClick={handleBatchProcess}
                  disabled={!batchText.trim()}
                  className="bg-text-primary text-bg-primary font-bold px-8 py-3 rounded-xl hover:bg-neutral-300 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Search size={18} /> Pesquisar Lista
                </button>
              )}
            </div>
          </div>

          {downloadQueue.length > 0 && (
            <div className="bg-bg-secondary border border-border-base rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
              <Loader2 className="animate-spin text-text-primary" size={20} />
              <div>
                <h4 className="font-bold text-text-primary text-sm">Fila de Download</h4>
                <p className="text-xs text-text-tertiary">{downloadQueue.length} música{downloadQueue.length > 1 ? 's' : ''} aguardando download sequencial...</p>
              </div>
            </div>
          )}

          {batchItems.length > 0 && (
            <div className="space-y-4">
              {batchItems.map((item, idx) => (
                <div key={idx} className="bg-bg-secondary border border-border-base rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-2 h-2 rounded-full ${item.status === 'done' ? 'bg-green-500' : (item.status === 'searching' || item.status === 'downloading') ? 'bg-yellow-500 animate-pulse' : item.status === 'queued' ? 'bg-blue-500 animate-pulse' : item.status === 'error' ? 'bg-red-500' : 'bg-neutral-500'}`} />
                    <h4 className="font-bold text-text-primary flex-1">{item.query}</h4>
                    {item.status !== 'downloading' && item.status !== 'queued' && (
                      <button 
                        onClick={() => openRetryModal(idx)}
                        className="p-1.5 rounded-lg bg-bg-primary border border-border-base text-text-tertiary hover:text-text-primary hover:bg-elements transition-colors cursor-pointer"
                        title="Refazer Busca / Editar Nome"
                      >
                        <RefreshCcw size={14} />
                      </button>
                    )}
                    <span className="text-xs uppercase font-bold tracking-widest text-text-tertiary ml-2">
                      {item.status === 'searching' && 'Buscando...'}
                      {item.status === 'queued' && 'Na Fila...'}
                      {item.status === 'downloading' && 'Baixando...'}
                      {item.status === 'done' && 'Concluído'}
                    </span>
                  </div>
                  
                  {item.status === 'ready' && item.results && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {item.results.map((video: any) => (
                        <div key={video.id} className="bg-bg-primary border border-border-base rounded-xl p-3 flex flex-col gap-3 group">
                          <div className="w-full h-24 rounded overflow-hidden relative bg-elements group/thumb">
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500" />
                            <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 rounded text-[10px] text-white font-bold">{video.duration}</div>
                            {/* Play Preview Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => {
                                  setPlayingVideo(video);
                                  setIsPlaying(true);
                                }}
                                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl cursor-pointer"
                                title="Ouvir Prévia"
                              >
                                <Play size={12} className="ml-0.5" fill="currentColor" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-text-primary line-clamp-2 mb-1" title={video.title}>{video.title}</h5>
                            <p className="text-[10px] text-text-tertiary">{video.channel}</p>
                          </div>
                          <button
                            onClick={() => queueBatchDownload(video, idx)}
                            className="mt-auto w-full py-2 flex items-center justify-center gap-2 bg-elements hover:bg-text-primary hover:text-bg-primary text-text-secondary text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <Download size={14} /> Baixar Esta
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.status === 'error' && (
                    <p className="text-red-500 text-xs">Erro ao processar. Tente pesquisar manualmente.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {musicTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Music size={20} /> Minhas Músicas
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
              <p className="text-sm text-text-tertiary">
                Esta é a sua biblioteca pessoal. Seu histórico de downloads salvos e organizados.
              </p>
            </div>
            
            {history.length > 0 && (
              <div className="flex flex-col gap-3 w-full md:w-auto md:max-w-md ml-auto">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Buscar em minhas músicas..."
                    className="w-full bg-bg-primary border border-border-base rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary outline-none focus:border-neutral-500 transition-colors"
                  />
                </div>
                
                <div className="relative flex items-center group overflow-hidden">
                  {canScrollLeftGenre && (
                    <button
                      type="button"
                      onClick={() => genresRef.current?.scrollBy({ left: -140, behavior: 'smooth' })}
                      className="absolute left-0 z-10 w-8 h-full flex items-center justify-start pl-1 bg-gradient-to-r from-bg-secondary via-bg-secondary/90 to-transparent text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                
                <div 
                  ref={genresRef}
                  onScroll={checkScrollGenre}
                  className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 md:pb-0 flex-1 relative px-1"
                >
                  {availableGenres.map(genre => (
                    <button
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${selectedGenre === genre ? 'bg-text-primary text-bg-primary' : 'bg-elements text-text-secondary hover:text-text-primary hover:bg-elements/80'}`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>

                {canScrollRightGenre && (
                  <button
                    type="button"
                    onClick={() => genresRef.current?.scrollBy({ left: 140, behavior: 'smooth' })}
                    className="absolute right-0 z-10 w-8 h-full flex items-center justify-end pr-1 bg-gradient-to-l from-bg-secondary via-bg-secondary/90 to-transparent text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
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
                <div key={video.id} className="bg-bg-secondary border border-border-base rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-neutral-500 transition-colors">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
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
                  </div>
                  
                  <div className="flex items-center gap-2 justify-between sm:justify-end w-full sm:w-auto pt-3 sm:pt-0 border-t border-border-base sm:border-t-0 mt-1 sm:mt-0">
                    <button 
                      onClick={() => togglePlay(video)}
                      className={`flex-1 sm:flex-none h-10 px-4 sm:px-0 sm:w-10 rounded-xl sm:rounded-full flex items-center justify-center transition-colors cursor-pointer ${playingVideo?.id === video.id ? 'bg-text-primary text-bg-primary' : 'bg-bg-primary border border-border-base text-text-primary hover:bg-elements'}`}
                      title="Ouvir Música"
                    >
                      {playingVideo?.id === video.id && isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      <span className="sm:hidden ml-2 font-bold text-xs">Ouvir</span>
                    </button>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => { setVideoToCategorize(video); setNewCategory(''); }}
                        className="w-10 h-10 rounded-xl sm:rounded-full flex items-center justify-center bg-bg-primary border border-border-base text-text-primary hover:bg-elements transition-colors cursor-pointer"
                        title="Mudar Categoria / Gênero"
                      >
                        <Tag size={16} />
                      </button>
                      <button 
                        onClick={() => { setSelectedVideo(video); setMusicTab('search'); }}
                        className="w-10 h-10 rounded-xl sm:rounded-full flex items-center justify-center bg-bg-primary border border-border-base text-text-primary hover:bg-elements transition-colors cursor-pointer"
                        title="Baixar novamente"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={() => setVideoToDelete(video)}
                        className="w-10 h-10 rounded-xl sm:rounded-full flex items-center justify-center bg-bg-primary border border-border-base text-text-tertiary hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors cursor-pointer"
                        title="Remover do histórico"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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

      {/* Modal de Categorização */}
      {videoToCategorize && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-secondary border border-border-base rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-in-center">
            <h3 className="text-xl font-bold text-text-primary mb-2">Definir Categoria</h3>
            <p className="text-text-secondary text-sm mb-4">
              Escolha ou crie uma nova categoria para <span className="text-text-primary font-bold">"{videoToCategorize.title}"</span>.
            </p>
            
            <div className="mb-4">
              <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 block">Categorias Existentes</label>
              <div className="flex flex-wrap gap-2">
                {availableGenres.filter(g => g !== 'Todas').map(genre => (
                  <button
                    key={genre}
                    onClick={() => setNewCategory(genre)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${newCategory === genre ? 'bg-text-primary text-bg-primary border-text-primary' : 'bg-bg-primary border-border-base text-text-secondary hover:text-text-primary'}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 block">Nova Categoria</label>
              <input 
                type="text" 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Ex: Rock, Podcast, Lofi..."
                className="w-full bg-bg-primary border border-border-base rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-neutral-500 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setVideoToCategorize(null)}
                className="px-4 py-2 rounded-lg font-bold text-sm text-text-primary bg-elements hover:bg-elements/80 transition-colors cursor-pointer"
              >
                Pular
              </button>
              <button 
                onClick={() => updateVideoCategory(videoToCategorize.id || videoToCategorize.video_id, newCategory || 'Geral')}
                disabled={!newCategory.trim() && newCategory !== ''} // Allows fallback to Geral if empty and clicked Salvar, actually let's force them to type or select. Wait, if empty it shouldn't be disabled? If empty, they can skip. Let's disable if empty.
                className="px-4 py-2 rounded-lg font-bold text-sm text-bg-primary bg-text-primary hover:bg-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                Salvar Categoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reescrever Busca */}
      {retryModalData.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-secondary border border-border-base rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-in-center">
            <h3 className="text-xl font-bold text-text-primary mb-2">Refazer Busca</h3>
            <p className="text-text-secondary text-sm mb-4">
              Reescreva a busca para tentar encontrar a música correta:
            </p>
            
            <div className="mb-6">
              <input 
                type="text" 
                value={retryModalData.query}
                onChange={(e) => setRetryModalData({ ...retryModalData, query: e.target.value })}
                placeholder="Ex: Nome da música - Artista"
                className="w-full bg-bg-primary border border-border-base rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-neutral-500 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRetrySubmit();
                  }
                }}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setRetryModalData({ isOpen: false, itemIndex: -1, query: '' })}
                className="px-4 py-2 rounded-lg font-bold text-sm text-text-primary bg-elements hover:bg-elements/80 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleRetrySubmit}
                disabled={!retryModalData.query.trim()}
                className="px-4 py-2 rounded-lg font-bold text-sm text-bg-primary bg-text-primary hover:bg-neutral-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Search size={16} /> Pesquisar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso de Duplicata */}
      {duplicateWarningData.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-secondary border border-border-base rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-in-center">
            <h3 className="text-xl font-bold text-text-primary mb-2 flex items-center gap-2">
              <Check size={20} className="text-elements" /> Já está na biblioteca
            </h3>
            <p className="text-text-secondary text-sm mb-6">
              A música <span className="text-text-primary font-bold">"{duplicateWarningData.video?.title}"</span> já foi baixada anteriormente e está no seu histórico.
              <br /><br />
              Deseja baixar novamente mesmo assim?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setDuplicateWarningData({ isOpen: false, video: null, isBatch: false })}
                className="px-4 py-2 rounded-lg font-bold text-sm text-text-primary bg-elements hover:bg-elements/80 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const data = duplicateWarningData;
                  setDuplicateWarningData({ isOpen: false, video: null, isBatch: false });
                  if (data.isBatch && data.itemIndex !== undefined) {
                    queueBatchDownload(data.video, data.itemIndex, true);
                  } else {
                    handleDownload(true);
                  }
                }}
                className="px-4 py-2 rounded-lg font-bold text-sm text-bg-primary bg-text-primary hover:bg-neutral-300 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Download size={16} /> Baixar Novamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
