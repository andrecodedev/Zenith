import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Copy, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function QuickTranscriber() {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [copied, setCopied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
      setCopied(false);
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-end gap-3 pointer-events-auto">
      {/* Transcript Modal */}
      {(transcript || isTranscribing) && (
        <div className="w-72 bg-bg-secondary border border-border-base rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Transcrição Rápida</span>
            {!isTranscribing && (
              <button onClick={() => setTranscript('')} className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
                <X size={16} />
              </button>
            )}
          </div>
          
          {isTranscribing ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <Loader2 size={24} className="text-brand-pink animate-spin" />
              <span className="text-xs text-text-secondary">Processando áudio via Whisper...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea 
                value={transcript}
                readOnly
                className="w-full h-32 bg-elements border border-border-base rounded-lg p-3 text-sm text-text-primary resize-none outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-bg-primary border border-border-base text-text-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:border-brand-pink hover:text-brand-pink transition-colors cursor-pointer"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar Texto'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mic Button */}
      <button
        onClick={toggleListening}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg cursor-pointer group ${
          isListening 
            ? 'bg-bg-secondary text-brand-pink border border-brand-pink shadow-[0_0_15px_rgba(255,107,158,0.3)] hover:scale-105' 
            : 'bg-bg-secondary text-text-secondary border border-border-base hover:text-brand-pink hover:-translate-y-1 hover:border-brand-pink active:translate-y-0 active:scale-95'
        }`}
        title="Transcrição Rápida (Whisper)"
      >
        {isListening ? <Square size={22} className="fill-current" /> : <Mic size={22} className="transition-colors duration-300 group-hover:text-brand-pink" />}
        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-white rounded-full border-2 border-bg-secondary animate-pulse"></div>
      </button>
    </div>
  );
}
