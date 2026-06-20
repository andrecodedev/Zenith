import Ferrofluid from './Ferrofluid';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  onStart: () => void;
}

export function Hero({ onStart }: HeroProps) {
  return (
    <>
      <div className="fixed inset-0 z-0 bg-black transition-all duration-700 [html.light_&]:invert">
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

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full text-center max-w-2xl mx-auto px-6 pointer-events-none">

        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-8">
          <span className="w-10 h-px bg-text-tertiary/60" />
          <span className="text-text-tertiary uppercase tracking-[0.35em] text-[10px] font-bold drop-shadow-md">
            Apresentando Zenith
          </span>
          <span className="w-10 h-px bg-text-tertiary/60" />
        </div>

        {/* Headline */}
        <h1 className="font-bold font-title uppercase text-text-primary drop-shadow-2xl mb-6 leading-none">
          <span className="block text-5xl md:text-7xl tracking-widest mb-1">Domine</span>
          <span className="block text-6xl md:text-8xl tracking-[0.2em] text-transparent bg-clip-text bg-linear-to-r from-white via-neutral-300 to-neutral-500">
            O Tempo
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-text-secondary mb-10 drop-shadow-md font-light leading-loose tracking-wide max-w-sm">
          Planeje com precisão. Execute com foco.<br />
          Alcance o seu potencial máximo.
        </p>

        {/* CTA */}
        <button
          onClick={onStart}
          className="group pointer-events-auto cursor-pointer border border-white/30 hover:border-white/80 hover:bg-white hover:text-black text-white px-7 py-2.5 text-xs font-bold uppercase tracking-[0.25em] flex items-center gap-3 transition-all duration-500 active:scale-95"
        >
          Acessar Plataforma
          <ArrowRight size={14} className="transition-transform duration-500 group-hover:translate-x-1.5" />
        </button>

        {/* Trust */}
        <div className="flex items-center gap-5 mt-8 pointer-events-none select-none">
          {['Organize', 'Execute', 'Evolua'].map((label, i) => (
            <span key={label} className="flex items-center gap-5">
              <span className="text-[10px] text-text-tertiary uppercase tracking-widest">{label}</span>
              {i < 2 && <span className="w-px h-3 bg-text-tertiary/30" />}
            </span>
          ))}
        </div>

      </div>
    </>
  );
}
