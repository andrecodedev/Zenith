import { useState, useEffect, useRef } from 'react';
import { Mic, Send, Square, Plus, Trash2, Bot, Loader2, Menu, X } from 'lucide-react';


interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export function ChatView() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const transcribeAudio = async (blob: Blob) => {
    setIsGenerating(true);
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('groq_api_key');
      if (!apiKey) throw new Error("Chave da API da Groq não encontrada. Adicione VITE_GROQ_API_KEY no .env.local");

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
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error?.message || `Erro HTTP Groq: ${response.status}`);
      }

      const result = await response.json();
      const transcript = result.text;
      setInput(prev => prev ? prev + ' ' + transcript.trim() : transcript.trim());
      setIsGenerating(false);
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      // Parar gravação
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsListening(false);
    } else {
      // Iniciar gravação
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
        console.error("Erro ao acessar o microfone", err);
        alert("Erro ao acessar o microfone. Verifique as permissões no navegador.");
      }
    }
  };

  // Load sessions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('zenith_ai_chats');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) setActiveSessionId(parsed[0].id);
    } else {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('zenith_ai_chats', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isGenerating]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (updated.length === 0) {
        // If we deleted the last one, localStorage will still keep the array empty. Let's create a new one.
        return [];
      }
      return updated;
    });
    if (activeSessionId === id) {
      setActiveSessionId(sessions.find(s => s.id !== id)?.id || null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId) return;
    
    if (isListening) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsListening(false);
    }

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: input.trim() };
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsGenerating(true);

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { 
          ...s, 
          title: s.messages.length === 0 ? userMessage.content.slice(0, 30) + '...' : s.title,
          messages: [...s.messages, userMessage] 
        };
      }
      return s;
    }));

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('groq_api_key');
      
      if (!apiKey) {
        throw new Error("Chave da API da Groq não encontrada. Adicione no arquivo .env.local como VITE_GROQ_API_KEY");
      }

      const activeSession = sessions.find(s => s.id === activeSessionId);
      const history = activeSession?.messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })) || [];

      const messages = [...history, { role: "user", content: userMessage.content }];

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || `Erro HTTP Groq: ${response.status}`);
      }

      const result = await response.json();
      const text = result.choices[0].message.content;

      const modelMessage: Message = { id: crypto.randomUUID(), role: 'model', content: text };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, modelMessage] };
        }
        return s;
      }));

    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = { 
        id: crypto.randomUUID(), 
        role: 'model', 
        content: `**Erro:** ${error.message || 'Falha ao conectar com o Gemini.'}` 
      };
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="flex flex-col h-full w-full min-h-0">


      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Histórico */}
      <div className={`w-64 bg-bg-primary md:bg-transparent border-r md:border-r-0 border-border-base flex flex-col pt-8 pl-4 absolute md:relative inset-y-0 left-0 z-50 md:z-auto transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${!isMobileSidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-3 pb-4 flex justify-between items-center pr-4">
          <h3 className="font-title font-semibold text-xs uppercase tracking-widest text-text-tertiary">Recentes</h3>
          <div className="flex items-center gap-1">
            <button onClick={createNewSession} className="p-1 hover:bg-bg-secondary rounded-md transition-colors text-text-secondary hover:text-text-primary cursor-pointer" title="Nova Conversa">
              <Plus size={16} />
            </button>
            <button onClick={() => setIsMobileSidebarOpen(false)} className="md:hidden p-1 hover:bg-bg-secondary rounded-md transition-colors text-text-secondary hover:text-text-primary cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {sessions.map(s => (
            <div 
              key={s.id} 
              onClick={() => { setActiveSessionId(s.id); setIsMobileSidebarOpen(false); }}
              className={`group flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition-colors ${activeSessionId === s.id ? 'bg-bg-secondary text-text-primary' : 'hover:bg-bg-secondary/50 text-text-tertiary hover:text-text-secondary'}`}
            >
              <div className="flex items-center gap-3 truncate">
                <span className="text-[13px] truncate font-medium">{s.title}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-brand-pink transition-all cursor-pointer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center p-4 text-xs text-text-tertiary">
              Nenhuma conversa.
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-bg-primary relative min-h-0">
        {/* Header */}
        <div className="px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border-base shrink-0 mb-6 bg-bg-primary flex justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-title text-text-primary flex items-center gap-3 mb-1 md:mb-2">
              <Bot size={28} className="text-brand-pink shrink-0" />
              Zenith AI
            </h1>
            <p className="text-text-secondary text-sm md:text-base">Assistente pessoal pronto para ajudar</p>
          </div>
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden p-2 bg-elements border border-border-base rounded-xl text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-2 md:px-8 pb-40 space-y-6 md:space-y-8">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center -mt-20">
              <h1 className="text-2xl md:text-4xl font-title text-text-secondary mb-12">Qual é a vibe?</h1>
            </div>
          ) : (
            activeSession.messages.map((m) => (
              <div key={m.id} className={`flex gap-2 md:gap-4 max-w-4xl mx-auto w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'model' && (
                  <div className="w-6 h-6 md:w-8 md:h-8 mt-1 rounded-full flex items-center justify-center shrink-0">
                    <Bot size={20} className="text-brand-pink md:w-6 md:h-6" />
                  </div>
                )}
                
                <div className={`max-w-[90%] md:max-w-[85%] min-w-0 ${
                  m.role === 'user' 
                    ? 'bg-bg-secondary rounded-2xl md:rounded-3xl py-2 px-4 md:py-3 md:px-5 text-text-primary' 
                    : 'py-1 text-text-primary'
                }`}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            ))
          )}
          
          {isGenerating && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-elements flex items-center justify-center shrink-0 border border-border-base">
                <Bot size={16} className="text-brand-pink" />
              </div>
              <div className="bg-elements border border-border-base rounded-2xl rounded-tl-sm p-4 flex items-center gap-2 text-text-secondary">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-medium uppercase tracking-widest">Pensando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full p-2 md:p-8 bg-gradient-to-t from-bg-primary via-bg-primary to-transparent pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto relative flex items-end gap-1 md:gap-2 bg-elements border border-border-base rounded-2xl p-1.5 md:p-2 shadow-lg">
            <button 
              onClick={toggleListening}
              className={`p-2 md:p-3 rounded-xl shrink-0 transition-all duration-300 cursor-pointer ${
                isListening 
                  ? 'bg-brand-pink text-black animate-pulse' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              {isListening ? <Square size={20} className="fill-current" /> : <Mic size={20} />}
            </button>
            
            <div className="flex-1 relative flex">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? "Ouvindo..." : "Pergunte qualquer coisa..."}
                className="w-full bg-transparent border-none py-3 px-2 text-[15px] text-text-primary outline-none resize-none overflow-y-auto"
                rows={1}
                style={{ minHeight: '44px' }}
              />
            </div>
            
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="p-3 mr-1 text-brand-pink hover:bg-brand-pink/10 rounded-xl disabled:opacity-50 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <Send size={18} className="translate-x-[1px] translate-y-[1px]" />
            </button>
          </div>
          <p className="text-center text-[10px] text-text-tertiary mt-4 uppercase tracking-widest">A inteligência artificial pode cometer erros.</p>
        </div>
      </div>
      </div>
    </div>
  );
}
