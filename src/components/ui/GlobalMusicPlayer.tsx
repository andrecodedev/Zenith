import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Volume2, VolumeX, Maximize2, Minimize2, X, ChevronDown, ChevronUp, Music } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function GlobalMusicPlayer({ onNavigate, hidden }: { onNavigate?: (view: string) => void; hidden?: boolean }) {
  const { playingVideo, setPlayingVideo, isPlaying, setIsPlaying, musicHistory, isPlayerExpanded, setIsPlayerExpanded, isPlayerMinimized, setIsPlayerMinimized, setMusicTab } = useStore();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [isShuffle, setIsShuffle] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialSeekDoneRef = useRef(false);

  useEffect(() => {
    initialSeekDoneRef.current = false;
  }, [playingVideo?.id]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const playNext = () => {
    if (!musicHistory.length || !playingVideo) return;
    const currentIndex = musicHistory.findIndex(v => v.id === playingVideo.id);
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * musicHistory.length);
    } else if (nextIndex >= musicHistory.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return; 
      }
    }

    if (musicHistory[nextIndex].id === playingVideo.id) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      setPlayingVideo(musicHistory[nextIndex]);
    }
    setIsPlaying(true);
  };

  const playPrev = () => {
    if (!musicHistory.length || !playingVideo) return;
    const currentIndex = musicHistory.findIndex(v => v.id === playingVideo.id);
    if (currentIndex === -1) return;
    
    let prevIndex = currentIndex - 1;
    if (isShuffle) {
      prevIndex = Math.floor(Math.random() * musicHistory.length);
    } else if (prevIndex < 0) {
      if (repeatMode === 'all') prevIndex = musicHistory.length - 1;
      else prevIndex = 0;
    }
    setPlayingVideo(musicHistory[prevIndex]);
    setIsPlaying(true);
  };

  const handleEnded = () => {
    playNext();
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (vol > 0 && isMuted) setIsMuted(false);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sincroniza estado de play/pause se vier externo
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(e => console.log('Autoplay preventido', e));
      } else if (!isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, playingVideo]);

  if (!playingVideo) return null;

  return (
    <>
      {isPlayerMinimized ? (
      <div className={`fixed bottom-0 right-0 left-0 bg-bg-secondary border-t border-border-base p-2 px-4 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-[110] flex items-center justify-between transition-all duration-300 animate-in slide-in-from-bottom ${hidden ? 'hidden' : ''}`}>
        <div className="flex items-center gap-3 w-1/3">
          <img src={playingVideo.thumbnail} alt={playingVideo.title} className="w-8 h-8 rounded object-cover shadow-sm" />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-text-primary truncate text-sm">{playingVideo.title}</h4>
            <p className="text-text-tertiary truncate text-xs flex items-center gap-2">
              {playingVideo.channel}
              {playingVideo.genre && <span className="bg-elements px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">{playingVideo.genre}</span>}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={playPrev} className="text-text-primary hover:text-text-tertiary transition-colors cursor-pointer">
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-text-primary text-bg-primary flex items-center justify-center hover:scale-105 transition-transform cursor-pointer">
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={playNext} className="text-text-primary hover:text-text-tertiary transition-colors cursor-pointer">
            <SkipForward size={18} fill="currentColor" />
          </button>
        </div>

        <div className="w-1/3 flex justify-end gap-2">
          <button onClick={() => { if (onNavigate) onNavigate('music'); setMusicTab('history'); setIsPlayerMinimized(false); }} className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-elements transition-colors cursor-pointer" title="Abrir Minhas Músicas">
            <Music size={16} />
          </button>
          <button onClick={() => setIsPlayerMinimized(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-elements transition-colors cursor-pointer" title="Expandir Player">
            <ChevronUp size={20} />
          </button>
        </div>
      </div>
      ) : (
    <div className={`fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border-base p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-[110] transition-all duration-300 ${isPlayerExpanded ? 'h-screen flex flex-col justify-center px-8' : 'animate-in slide-in-from-bottom-full'} ${hidden ? 'hidden' : ''}`}>
      <div className={`mx-auto flex w-full ${isPlayerExpanded ? 'flex-col max-w-2xl gap-8' : 'flex-col sm:flex-row items-center gap-4 max-w-7xl'}`}>
        <div className={`flex items-center gap-4 ${isPlayerExpanded ? 'flex-col text-center w-full' : 'w-full sm:w-1/3'}`}>
          <img src={playingVideo.thumbnail} alt={playingVideo.title} className={`${isPlayerExpanded ? 'w-64 h-64 shadow-2xl rounded-xl object-cover mb-4' : 'w-14 h-14 rounded object-cover shadow-sm'}`} />
          <div className={`min-w-0 flex-1 ${isPlayerExpanded ? 'w-full' : ''}`}>
            <h4 className={`font-bold text-text-primary truncate ${isPlayerExpanded ? 'text-2xl mb-2' : 'text-base'}`}>{playingVideo.title}</h4>
            <p className={`text-text-tertiary truncate flex items-center gap-2 ${isPlayerExpanded ? 'text-lg justify-center' : 'text-sm'}`}>
              {playingVideo.channel}
              {playingVideo.genre && <span className="bg-elements px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{playingVideo.genre}</span>}
            </p>
          </div>
          {!isPlayerExpanded && (
            <button onClick={() => setIsPlayerExpanded(true)} className="p-2 sm:hidden text-text-tertiary hover:text-text-primary cursor-pointer">
              <Maximize2 size={20} />
            </button>
          )}
        </div>
        
        <div className={`flex flex-col items-center gap-2 ${isPlayerExpanded ? 'w-full mt-4' : 'flex-1 w-full'}`}>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <button onClick={() => setIsShuffle(!isShuffle)} className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${isShuffle ? 'bg-elements text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}>
              <Shuffle size={20} />
            </button>
            <button onClick={playPrev} className="w-10 h-10 rounded-full flex items-center justify-center text-text-primary hover:text-text-tertiary transition-colors cursor-pointer">
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-text-primary text-bg-primary flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-lg">
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={playNext} className="w-10 h-10 rounded-full flex items-center justify-center text-text-primary hover:text-text-tertiary transition-colors cursor-pointer">
              <SkipForward size={24} fill="currentColor" />
            </button>
            <button onClick={() => setRepeatMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none')} className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors relative ${repeatMode !== 'none' ? 'bg-elements text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}>
              {repeatMode === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
              {repeatMode === 'all' && <div className="absolute w-1 h-1 bg-current rounded-full" style={{ bottom: '4px' }}></div>}
            </button>
          </div>
          
          <div className="w-full flex items-center gap-3 text-xs text-text-tertiary font-medium mt-1">
            <span className="w-8 text-right">{formatTime(currentTime)}</span>
            <input 
              type="range" 
              min="0" 
              max={duration || 100} 
              value={currentTime} 
              onChange={handleSeek}
              style={{ backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%` }}
              className="flex-1 h-1 bg-elements rounded-full appearance-none cursor-pointer bg-no-repeat bg-[image:linear-gradient(to_right,currentColor,currentColor)] text-text-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-transform"
            />
            <span className="w-8">{formatTime(duration)}</span>
          </div>
        </div>

        <div className={`flex items-center gap-3 sm:gap-6 ${isPlayerExpanded ? 'w-full justify-between mt-8' : 'w-full sm:w-1/3 justify-end'}`}>
          <div className={`flex items-center gap-2 ${isPlayerExpanded ? 'w-48' : 'flex min-w-[80px] max-w-[120px] flex-1'}`}>
            <button onClick={() => setIsMuted(!isMuted)} className="text-text-tertiary hover:text-text-primary cursor-pointer shrink-0">
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={isMuted ? 0 : volume} 
              onChange={handleVolumeChange}
              style={{ backgroundSize: `${(isMuted ? 0 : volume) * 100}% 100%` }}
              className="w-full h-1 bg-elements rounded-full appearance-none cursor-pointer bg-no-repeat bg-[image:linear-gradient(to_right,currentColor,currentColor)] text-text-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-transform"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isPlayerExpanded && (
              <button 
                onClick={() => { if (onNavigate) onNavigate('music'); setMusicTab('history'); setIsPlayerMinimized(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-elements transition-colors cursor-pointer"
                title="Abrir Minhas Músicas"
              >
                <Music size={16} />
              </button>
            )}
            {!isPlayerExpanded && (
              <button 
                onClick={() => setIsPlayerMinimized(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-elements transition-colors cursor-pointer"
                title="Minimizar Player"
              >
                <ChevronDown size={20} />
              </button>
            )}
            <button 
              onClick={() => setIsPlayerExpanded(!isPlayerExpanded)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-elements transition-colors cursor-pointer"
              title={isPlayerExpanded ? "Restaurar" : "Tela Cheia"}
            >
              {isPlayerExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button 
              onClick={() => { setPlayingVideo(null); setIsPlaying(false); setIsPlayerExpanded(false); }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-elements transition-colors cursor-pointer"
              title="Fechar Player"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
    )}

      {/* Hidden Audio Element - Moved outside conditional so it never unmounts */}
      <audio 
        ref={audioRef}
        src={`${import.meta.env.VITE_MUSIC_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://seu-backend-deployado.com' : `http://${window.location.hostname}:3333`)}/stream?id=${playingVideo.id}`} 
        autoPlay
        loop={repeatMode === 'one'}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          const time = audioRef.current?.currentTime || 0;
          setCurrentTime(time);
          if (playingVideo) {
            localStorage.setItem('zenith_music_time', JSON.stringify({ id: playingVideo.id, time }));
          }
        }}
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration || 0);
          if (!initialSeekDoneRef.current && playingVideo) {
            const savedState = localStorage.getItem('zenith_music_time');
            if (savedState) {
              try {
                const { id, time } = JSON.parse(savedState);
                if (id === playingVideo.id && audioRef.current && time > 0) {
                  audioRef.current.currentTime = time;
                }
              } catch (e) {}
            }
            initialSeekDoneRef.current = true;
          }
        }}
        onEnded={handleEnded}
        className="hidden"
      />
    </>
  );
}
