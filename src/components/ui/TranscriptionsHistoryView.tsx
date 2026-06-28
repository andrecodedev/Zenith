import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mic, Copy, Trash2, Check, Clock, Loader2 } from 'lucide-react';

interface Transcription {
  id: string;
  text: string;
  created_at: string;
}

export function TranscriptionsHistoryView() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTranscriptions();
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
              Histórico de Áudios
            </h1>
            <p className="text-text-tertiary mt-1">
              Registro automático de todas as suas transcrições rápidas.
            </p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-brand-pink" size={40} />
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary border border-dashed border-border-base rounded-2xl bg-bg-secondary/50">
            <Mic size={48} className="mb-4 opacity-20" />
            <p>Nenhuma transcrição salva ainda.</p>
            <p className="text-sm mt-2">Grave um áudio no botão flutuante para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {transcriptions.map((t) => (
              <div 
                key={t.id} 
                className="bg-bg-secondary border border-border-base rounded-xl p-5 hover:border-brand-pink/50 transition-colors flex flex-col group"
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
                
                <p className="text-text-secondary text-sm flex-1 mb-6 whitespace-pre-wrap line-clamp-6">
                  {t.text}
                </p>

                <button
                  onClick={() => copyToClipboard(t.id, t.text)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border ${
                    copiedId === t.id 
                      ? 'bg-brand-pink text-black border-brand-pink' 
                      : 'bg-bg-primary text-text-primary border-border-base hover:border-brand-pink hover:text-brand-pink'
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
