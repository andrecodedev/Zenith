import React from 'react';
import Ferrofluid from './Ferrofluid';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  onStart: () => void;
}

export function Hero({ onStart }: HeroProps) {
  return (
    <>
      <div className="fixed inset-0 z-0 bg-black">
        <Ferrofluid
          colors={["#ffffff", "#aaaaaa", "#555555"]}
          speed={0.1}
          scale={1.5}
          turbulence={1}
          fluidity={0.1}
          rimWidth={0.2}
          sharpness={2.5}
          shimmer={1.5}
          glow={1.5}
          flowDirection="down"
          opacity={1}
          mouseInteraction={true}
          mouseStrength={1}
          mouseRadius={0.35}
        />
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full w-full text-center max-w-2xl mx-auto px-6 pointer-events-none">
        
        <span className="text-text-tertiary uppercase tracking-[0.3em] text-xs font-bold mb-4 drop-shadow-md">
          Apresentando Zenith
        </span>
        
        <h1 className="text-5xl md:text-7xl font-bold font-title tracking-widest uppercase text-white mb-6 drop-shadow-2xl">
          Domine o tempo
        </h1>
        
        <p className="text-lg text-text-secondary mb-12 drop-shadow-md font-light leading-relaxed">
          Uma plataforma de produtividade premium desenhada para alinhar suas tarefas com o ritmo da sua vida. Planeje, execute e alcance seu potencial máximo.
        </p>
        
        <button 
          onClick={onStart}
          className="group pointer-events-auto cursor-pointer bg-white hover:bg-neutral-200 text-black px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95"
        >
          Acessar Plataforma <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </div>
    </>
  );
}
