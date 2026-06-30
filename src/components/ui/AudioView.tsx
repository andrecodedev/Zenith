import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Mic, Copy, Trash2, Check, Clock, Loader2, Square, X } from 'lucide-react';

interface Transcription {
  id: string;
  text: string;
  created_at: string;
}

export function AudioView() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentCopied, setCurrentCopied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchTranscriptions();
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const fetchTranscriptions = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('audio_transcriptions')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTranscriptions(data || []);
    } catch (err) {
      console.error('Erro ao buscar transcrições:', err);
    } finally {
      setLoading(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    setTranscript('');
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('groq_api_key');
      if (!apiKey) throw new Error("Chave da API não encontrada.");

      const file = new File([blob], "audio.webm", { type: blob.type || "audio/webm" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-large-v3");
      formData.append("language", "pt");
      formData.append("prompt", "Transcreva o áudio com pontuação e acentuação perfeitas no idioma português.");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error("Erro na transcrição");
      }

      const result = await response.json();
      const transcribedText = result.text.trim();
      setTranscript(transcribedText);

      // Save to Supabase
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('audio_transcriptions').insert({
          user_id: userData.user.id,
          text: transcribedText
        });
        fetchTranscriptions(); // Refresh history
      }
    } catch (err) {
      console.error(err);
      setTranscript("Erro ao transcrever. Tente novamente.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsListening(false);
    } else {
      setTranscript('');
      setCurrentCopied(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          transcribeAudio(audioBlob);
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (err) {
        console.error("Erro ao acessar microfone", err);
      }
    }
  };

  const copyCurrentToClipboard = () => {
    navigator.clipboard.writeText(transcript);
    setCurrentCopied(true);
    setTimeout(() => setCurrentCopied(false), 2000);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteTranscription = async (id: string) => {
    try {
      const { error } = await supabase.from('audio_transcriptions').delete().eq('id', id);
      if (error) throw error;
      setTranscriptions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Erro ao deletar transcrição:', err);
    }
  };

  return (
    <div className="flex-1 bg-bg-primary h-full">
      <div className="pb-12 w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              <Mic className="text-brand-pink" size={32} />
              Transcrições
            </h1>
            <p className="text-text-tertiary mt-1">
              Grave áudios longos ou rápidos e veja todo o seu histórico.
            </p>
          </div>
        </div>

        {/* Gravador Principal */}
        <div className="bg-bg-secondary border border-border-base rounded-2xl p-8 mb-12 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-pink/20 via-transparent to-transparent"></div>
          
          <button
            onClick={toggleListening}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer group z-10 ${
              isListening 
                ? 'bg-white text-black border-4 border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.5)] scale-110 animate-pulse' 
                : 'bg-elements text-text-secondary border-2 border-border-base hover:text-white hover:border-white hover:scale-105 active:scale-95'
            }`}
            title="Clique para Gravar Áudio"
          >
            {isListening ? <Square size={36} className="fill-current" /> : <Mic size={36} className="transition-colors duration-300 group-hover:text-white" />}
          </button>
          <p className="mt-6 text-sm font-bold uppercase tracking-widest text-text-secondary z-10">
            {isListening ? 'Gravando... Clique para Parar' : 'Clique para Começar a Gravar'}
          </p>

          {/* Resultado da Gravação Atual */}
          {(transcript || isTranscribing) && (
            <div className="w-full mt-8 bg-bg-primary border border-border-base rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 z-10">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-brand-pink flex items-center gap-2">
                  <Mic size={16} /> Nova Transcrição
                </span>
                {!isTranscribing && (
                  <button onClick={() => setTranscript('')} className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
                    <X size={18} />
                  </button>
                )}
              </div>
              
              {isTranscribing ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <Loader2 size={32} className="text-brand-pink animate-spin" />
                  <span className="text-sm text-text-secondary font-medium">Processando áudio com inteligência artificial...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea 
                    value={transcript}
                    readOnly
                    className="w-full h-40 bg-elements border border-border-base rounded-lg p-4 text-sm md:text-base text-text-primary resize-none outline-none leading-relaxed"
                  />
                  <button
                    onClick={copyCurrentToClipboard}
                    className={`w-full flex items-center justify-center gap-2 py-3 font-bold text-sm uppercase tracking-wider rounded-lg transition-colors cursor-pointer border ${
                      currentCopied 
                        ? 'bg-elements text-text-secondary border-border-base' 
                        : 'bg-white text-black border-white hover:bg-neutral-200'
                    }`}
                  >
                    {currentCopied ? <Check size={18} /> : <Copy size={18} />}
                    {currentCopied ? 'Texto Copiado!' : 'Copiar Transcrição'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-border-base/40 w-full mb-8"></div>
        <h2 className="text-xl font-bold font-title text-text-primary mb-6">Histórico de Transcrições</h2>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-brand-pink" size={32} />
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary border border-dashed border-border-base rounded-2xl bg-bg-secondary/30">
            <Clock size={40} className="mb-4 opacity-20" />
            <p>Nenhuma transcrição salva no histórico.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {transcriptions.map((t) => (
              <div 
                key={t.id} 
                className="bg-bg-secondary border border-border-base rounded-xl p-5 hover:border-brand-pink/50 transition-all flex flex-col group hover:shadow-lg hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-4 text-xs text-text-tertiary font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {new Date(t.created_at).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  <button 
                    onClick={() => deleteTranscription(t.id)}
                    className="text-text-tertiary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Excluir transcrição"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <p className="text-text-secondary text-sm flex-1 mb-6 whitespace-pre-wrap line-clamp-5">
                  {t.text}
                </p>

                <button
                  onClick={() => copyToClipboard(t.id, t.text)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border ${
                    copiedId === t.id 
                      ? 'bg-elements text-text-secondary border-border-base' 
                      : 'bg-bg-primary text-text-primary border-border-base hover:border-white hover:text-white'
                  }`}
                >
                  {copiedId === t.id ? <Check size={16} /> : <Copy size={16} />}
                  {copiedId === t.id ? 'Copiado!' : 'Copiar Texto'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
