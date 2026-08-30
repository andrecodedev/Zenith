import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Upload,
  Loader2,
  Type,
  ImageIcon,
  Video,
  Music,
  Sparkles,
  Layers,
  User,
  Trash2,
  ImagePlus,
  ArrowLeft,
  Folder,
  Play,
} from 'lucide-react';
import {
  fileToDataUrl,
  getAudioDuration,
  getVideoDuration,
  resolveAssetSrc,
  uploadProjectAsset,
} from '../../../lib/video-assets';
import { PropertiesPanel } from './PropertiesPanel';
import { TransitionsPanel } from './TransitionsPanel';
import { EffectsPanel } from './EffectsPanel';
import { AnimationsPanel } from './AnimationsPanel';
import { PositionPanel } from './PositionPanel';
import type { Layer, ProjectLibraryAsset, VideoProject, VideoScene } from '../../../types/video-project';
import type { SceneTransition } from '../../../types/video-project';
import { loadPersonagemCatalog, type PersonagemFolder } from '../../../lib/personagem-catalog';
import { loadSfxCatalog, type SfxFolder } from '../../../lib/sfx-catalog';

type AssetTab =
  | 'elementos'
  | 'personagem'
  | 'texto'
  | 'imagens'
  | 'videos'
  | 'audios'
  | 'sfx';

type SidePanel = 'none' | 'position' | 'audio' | 'transitions' | 'effects' | 'animate';

type TextPreset = 'title' | 'subtitle' | 'body';

type AssetsPanelProps = {
  projectId: string;
  apiUrl: string;
  apiOnline: boolean | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  library: ProjectLibraryAsset[];
  sidePanel: SidePanel;
  onCloseSidePanel: () => void;
  project: VideoProject;
  layer: Layer | null;
  scene: VideoScene | null;
  clip: { trackId: string; label?: string; startSec: number; durationSec: number; volume?: number } | null;
  selectedClipId: string | null;
  resolveAssetUrl: (src: string) => string;
  onAddLibraryAsset: (asset: {
    kind: 'image' | 'video' | 'audio' | 'element';
    src: string;
    name: string;
    durationSec?: number;
  }) => void;
  onRemoveLibraryAsset: (id: string) => void;
  onUseLibraryImage: (src: string, durationSec?: number) => void;
  onUseLibraryImageAsFundo: (src: string) => void;
  onUseLibraryAudio: (src: string, label: string, durationSec?: number) => void;
  onUseShape: (src: string, label: string) => void;
  onAddText: (preset?: TextPreset) => void;
  onUpdateElement: (id: string, patch: Partial<Layer>) => void;
  onUpdateClip: (trackId: string, clipId: string, patch: Record<string, unknown>) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onReorderLayers: (frontToBackIds: string[]) => void;
  onBringSceneForward: (id: string) => void;
  onSendSceneBackward: (id: string) => void;
  onBringSceneToFront: (id: string) => void;
  onSendSceneToBack: (id: string) => void;
  onSelectLayer: (id: string) => void;
  onError: (msg: string | null) => void;
  transitionScene: VideoScene | null;
  transitionSceneIndex: number;
  onSetSceneTransition: (sceneId: string, transition: SceneTransition, durationSec: number) => void;
  onApplyTransitionToAll: (transition: SceneTransition, durationSec: number) => void;
  surface?: 'video' | 'banner';
};

const railTabs: { id: AssetTab; label: string; title: string; icon: ReactNode }[] = [
  { id: 'elementos', label: 'Elementos', title: 'Elementos', icon: <Layers size={20} /> },
  { id: 'personagem', label: 'Personagem', title: 'Personagem', icon: <User size={20} /> },
  { id: 'texto', label: 'Texto', title: 'Texto', icon: <Type size={20} /> },
  { id: 'imagens', label: 'Imagens', title: 'Imagens', icon: <ImageIcon size={20} /> },
  { id: 'videos', label: 'Vídeos', title: 'Vídeos', icon: <Video size={20} /> },
  { id: 'audios', label: 'Áudios', title: 'Áudios', icon: <Music size={20} /> },
  { id: 'sfx', label: 'SFX', title: 'Efeitos sonoros', icon: <Sparkles size={20} /> },
];

const TAB_COPY: Record<AssetTab, { title: string; hint: string }> = {
  elementos: { title: 'Elementos', hint: 'Formas prontas e elementos que você enviar' },
  personagem: { title: 'Personagem', hint: 'Pastas de poses. Clique para ver as imagens e voltar' },
  texto: { title: 'Texto', hint: 'Adicione títulos e legendas ao preview' },
  imagens: { title: 'Imagens', hint: 'Fotos e PNGs só deste projeto' },
  videos: { title: 'Vídeos', hint: 'Clips de vídeo só deste projeto' },
  audios: { title: 'Áudios', hint: 'Música e narração só deste projeto' },
  sfx: { title: 'Efeitos sonoros', hint: 'Pastas da biblioteca. Clique para ouvir e adicionar' },
};

const shapeSvg = (fill: string, kind: 'rect' | 'circle' | 'star') => {
  const body =
    kind === 'rect'
      ? '<rect width="200" height="120" fill="' + fill + '" rx="12"/>'
      : kind === 'circle'
        ? '<circle cx="80" cy="80" r="80" fill="' + fill + '"/>'
        : '<polygon points="80,8 98,58 152,58 108,92 124,148 80,116 36,148 52,92 8,58 62,58" fill="' + fill + '"/>';
  const size = kind === 'rect' ? 'width="200" height="120"' : 'width="160" height="160"';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" ' +
    size +
    ' viewBox="0 0 ' +
    (kind === 'rect' ? '200 120' : '160 160') +
    '">' +
    body +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
};

const BUILTIN_ELEMENTS = [
  { id: 'rect-violet', label: 'Retângulo', src: shapeSvg('#7c3aed', 'rect') },
  { id: 'rect-sky', label: 'Retângulo azul', src: shapeSvg('#0ea5e9', 'rect') },
  { id: 'circle-amber', label: 'Círculo', src: shapeSvg('#f59e0b', 'circle') },
  { id: 'circle-rose', label: 'Círculo rosa', src: shapeSvg('#f43f5e', 'circle') },
  { id: 'star-emerald', label: 'Estrela', src: shapeSvg('#10b981', 'star') },
  { id: 'star-indigo', label: 'Estrela índigo', src: shapeSvg('#6366f1', 'star') },
];

const poseLabel = (raw: string) =>
  raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const TEXT_PRESETS: { id: TextPreset; label: string; hint: string; sample: string }[] = [
  { id: 'title', label: 'Adicionar um título', hint: 'Grande, destaque', sample: 'Título' },
  { id: 'subtitle', label: 'Adicionar um subtítulo', hint: 'Médio', sample: 'Subtítulo' },
  { id: 'body', label: 'Adicionar um texto', hint: 'Corpo de texto', sample: 'Seu texto aqui' },
];

const fmtDur = (sec?: number) => {
  if (!sec) return '';
  if (sec < 60) return sec.toFixed(1) + 's';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + s.toString().padStart(2, '0');
};

export const AssetsPanel = ({
  projectId,
  apiUrl,
  apiOnline,
  expanded,
  onToggleExpanded,
  library,
  sidePanel,
  onCloseSidePanel,
  project,
  layer,
  scene,
  clip,
  selectedClipId,
  resolveAssetUrl,
  onAddLibraryAsset,
  onRemoveLibraryAsset,
  onUseLibraryImage,
  onUseLibraryImageAsFundo,
  onUseLibraryAudio,
  onUseShape,
  onAddText,
  onUpdateElement,
  onUpdateClip,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onReorderLayers,
  onBringSceneForward,
  onSendSceneBackward,
  onBringSceneToFront,
  onSendSceneToBack,
  onSelectLayer,
  onError,
  transitionScene,
  transitionSceneIndex,
  onSetSceneTransition,
  onApplyTransitionToAll,
  surface = 'video',
}: AssetsPanelProps) => {
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const elementFileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<AssetTab>('imagens');
  const visibleTabs =
    surface === 'banner'
      ? railTabs.filter((t) => t.id !== 'videos' && t.id !== 'audios' && t.id !== 'sfx')
      : railTabs;

  useEffect(() => {
    if (surface === 'banner' && (tab === 'videos' || tab === 'audios' || tab === 'sfx')) {
      setTab('elementos');
    }
  }, [surface, tab]);
  const [uploading, setUploading] = useState(false);
  const [uploadingElement, setUploadingElement] = useState(false);
  const [personagemFolders, setPersonagemFolders] = useState<PersonagemFolder[]>([]);
  const [openPersonagemFolder, setOpenPersonagemFolder] = useState<string | null>(null);
  const [sfxFolders, setSfxFolders] = useState<SfxFolder[]>([]);
  const [openSfxFolder, setOpenSfxFolder] = useState<string | null>(null);
  const [previewSfxSrc, setPreviewSfxSrc] = useState<string | null>(null);
  const previewSfxRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadPersonagemCatalog()
      .then((c) => setPersonagemFolders(c.folders || []))
      .catch(() => setPersonagemFolders([]));
    loadSfxCatalog()
      .then((c) => setSfxFolders(c.folders || []))
      .catch(() => setSfxFolders([]));
  }, []);

  useEffect(() => {
    return () => {
      previewSfxRef.current?.pause();
      previewSfxRef.current = null;
    };
  }, []);

  const pickTab = (next: AssetTab) => {
    onCloseSidePanel();
    // Mesma aba com painel aberto: setinha implícita (recolhe). Outra aba ou painel fechado: abre.
    if (expanded && next === tab && sidePanel === 'none') {
      onToggleExpanded();
      return;
    }
    setTab(next);
    if (!expanded) onToggleExpanded();
  };

  const stopSfxPreview = () => {
    previewSfxRef.current?.pause();
    previewSfxRef.current = null;
    setPreviewSfxSrc(null);
  };

  const toggleSfxPreview = (src: string) => {
    if (previewSfxSrc === src) {
      stopSfxPreview();
      return;
    }
    previewSfxRef.current?.pause();
    const audio = new Audio(src);
    previewSfxRef.current = audio;
    setPreviewSfxSrc(src);
    audio.onended = () => {
      previewSfxRef.current = null;
      setPreviewSfxSrc(null);
    };
    audio.play().catch(() => stopSfxPreview());
  };

  const addSfx = async (src: string, label: string) => {
    onError(null);
    const dur = await getAudioDuration(src);
    onUseLibraryAudio(src, label, dur);
  };

  const storeFile = async (file: File): Promise<string> => {
    if (apiUrl && apiOnline) {
      try {
        const { src } = await uploadProjectAsset(apiUrl, projectId, file);
        return src;
      } catch {
        /* fallback local */
      }
    }
    return fileToDataUrl(file);
  };

  const storeAudio = async (file: File): Promise<{ src: string; duration: number }> => {
    if (apiUrl && apiOnline) {
      try {
        const { src } = await uploadProjectAsset(apiUrl, projectId, file);
        const url = resolveAssetSrc(src, projectId, apiUrl);
        const duration = await getAudioDuration(url);
        return { src, duration };
      } catch {
        /* fallback local */
      }
    }
    const src = await fileToDataUrl(file);
    const duration = await getAudioDuration(src);
    return { src, duration };
  };

  const onImageFilesPicked = async (list: FileList | null) => {
    const files = list ? Array.from(list).filter((f) => f.type.startsWith('image/')) : [];
    if (!files.length) return;
    setUploading(true);
    onError(null);
    try {
      for (const file of files) {
        const src = await storeFile(file);
        onAddLibraryAsset({ kind: 'image', src, name: file.name });
      }
      setTab('imagens');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

  const onVideoFilesPicked = async (list: FileList | null) => {
    const files = list ? Array.from(list).filter((f) => f.type.startsWith('video/')) : [];
    if (!files.length) return;
    setUploading(true);
    onError(null);
    try {
      for (const file of files) {
        const src = await storeFile(file);
        const blobUrl = URL.createObjectURL(file);
        const durationSec = await getVideoDuration(blobUrl);
        URL.revokeObjectURL(blobUrl);
        onAddLibraryAsset({ kind: 'video', src, name: file.name, durationSec });
      }
      setTab('videos');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setUploading(false);
      if (videoFileRef.current) videoFileRef.current.value = '';
    }
  };

  const onAudioFilesPicked = async (list: FileList | null) => {
    const files = list
      ? Array.from(list).filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(f.name))
      : [];
    if (!files.length) return;
    setUploading(true);
    onError(null);
    try {
      for (const file of files) {
        const { src, duration } = await storeAudio(file);
        onAddLibraryAsset({ kind: 'audio', src, name: file.name, durationSec: duration });
      }
      setTab('audios');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setUploading(false);
      if (audioFileRef.current) audioFileRef.current.value = '';
    }
  };

  /** Upload na aba Elementos: tudo vira kind element (GIF, vídeo, imagem, sticker). */
  const onElementFilesPicked = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    setUploadingElement(true);
    onError(null);
    try {
      for (const file of files) {
        const isVisual =
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          /\.(gif|webp|png|jpe?g|svg|mp4|webm|mov)$/i.test(file.name);
        if (!isVisual) {
          onError('Em Elementos envie imagem, GIF ou vídeo.');
          continue;
        }
        const src = await storeFile(file);
        onAddLibraryAsset({ kind: 'element', src, name: file.name });
        setTab('elementos');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha no upload do elemento');
    } finally {
      setUploadingElement(false);
      if (elementFileRef.current) elementFileRef.current.value = '';
    }
  };

  const images = library.filter((a) => a.kind === 'image');
  const videos = library.filter((a) => a.kind === 'video');
  const audios = library.filter((a) => a.kind === 'audio');
  const customElements = library.filter((a) => a.kind === 'element');
  const tabCopy = TAB_COPY[tab];

  const UploadBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      type="button"
      disabled={uploading}
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
    >
      {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
      {label}
    </button>
  );

  const OfflineHint = () =>
    !apiOnline ? (
      <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/25 rounded-md px-2.5 py-2">
        Sem api-video: arquivos ficam salvos no projeto (data URL).
      </p>
    ) : null;

  return (
    <div className="relative flex h-full min-h-0 w-full bg-neutral-900">
      <nav className="w-14 shrink-0 flex flex-col items-center py-2 gap-0.5 border-r border-neutral-800 bg-neutral-950 z-10 overflow-y-auto min-h-0">
        {visibleTabs.map((t) => {
          const active = tab === t.id && sidePanel === 'none';
          return (
            <button
              key={t.id}
              type="button"
              title={t.title}
              onClick={() => pickTab(t.id)}
              className={
                'w-11 min-h-11 shrink-0 rounded-lg flex flex-col items-center justify-center gap-0.5 py-1 cursor-pointer transition-colors ' +
                (active && expanded
                  ? 'bg-violet-600/30 text-violet-300'
                  : active && !expanded
                    ? 'bg-neutral-800 text-violet-300'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200')
              }
            >
              {t.icon}
              <span className="text-[8px] font-medium leading-tight text-center px-0.5 max-w-[44px] break-words">
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>

      {expanded && (
        <div className="relative flex-1 min-w-0 flex flex-col min-h-0 border-r border-neutral-800">
          {sidePanel === 'transitions' ? (
            <TransitionsPanel
              key={transitionScene?.id ?? 'none'}
              scene={transitionScene}
              sceneIndex={transitionSceneIndex}
              onClose={onCloseSidePanel}
              onSetTransition={onSetSceneTransition}
              onApplyToAll={onApplyTransitionToAll}
            />
          ) : sidePanel === 'effects' ? (
            <EffectsPanel
              layer={layer}
              onClose={onCloseSidePanel}
              onUpdate={onUpdateElement}
            />
          ) : sidePanel === 'animate' ? (
            <AnimationsPanel
              layer={layer}
              onClose={onCloseSidePanel}
              onUpdate={(id, animation) => onUpdateElement(id, { animation })}
            />
          ) : sidePanel === 'position' ? (
            <PositionPanel
              project={project}
              layer={layer}
              scene={scene}
              onClose={onCloseSidePanel}
              onSelectLayer={onSelectLayer}
              onUpdateLayer={onUpdateElement}
              onBringForward={onBringForward}
              onSendBackward={onSendBackward}
              onBringToFront={onBringToFront}
              onSendToBack={onSendToBack}
              onReorderLayers={onReorderLayers}
              onBringSceneForward={onBringSceneForward}
              onSendSceneBackward={onSendSceneBackward}
              onBringSceneToFront={onBringSceneToFront}
              onSendSceneToBack={onSendSceneToBack}
            />
          ) : sidePanel === 'audio' ? (
            <PropertiesPanel
              mode="audio"
              layer={layer}
              clip={clip}
              selectedClipId={selectedClipId}
              onClose={onCloseSidePanel}
              onUpdateLayer={onUpdateElement}
              onUpdateClip={onUpdateClip}
              onBringForward={onBringForward}
              onSendBackward={onSendBackward}
            />
          ) : sidePanel !== 'none' ? null : (
            <>
              <div className="px-4 py-3 border-b border-neutral-800">
                <h2 className="text-sm font-semibold text-neutral-100">{tabCopy.title}</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{tabCopy.hint}</p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {tab === 'elementos' && (
                  <div className="p-4 space-y-4">
                    <button
                      type="button"
                      disabled={uploadingElement}
                      onClick={() => elementFileRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {uploadingElement ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Upload size={18} />
                      )}
                      Upload
                    </button>
                    <input
                      ref={elementFileRef}
                      type="file"
                      accept="image/*,video/*,.gif,.webp,.svg,.mp4,.webm,.mov"
                      multiple
                      className="hidden"
                      onChange={(e) => onElementFilesPicked(e.target.files)}
                    />
                    <p className="text-xs text-neutral-500">
                      Envie GIF, imagem, vídeo ou sticker. Ficam só em Elementos.
                    </p>

                    <div>
                      <p className="text-xs font-medium text-neutral-400 mb-2">Prontos</p>
                      <div className="grid grid-cols-2 gap-2">
                        {BUILTIN_ELEMENTS.map((el) => (
                          <button
                            key={el.id}
                            type="button"
                            onClick={() => {
                              onError(null);
                              onUseShape(el.src, el.label);
                            }}
                            className="group aspect-square rounded-lg border border-neutral-700 bg-neutral-800/80 hover:border-violet-500 hover:bg-neutral-800 overflow-hidden cursor-pointer flex flex-col"
                          >
                            <div className="flex-1 flex items-center justify-center p-3">
                              <img src={el.src} alt="" className="max-w-full max-h-full object-contain" />
                            </div>
                            <span className="text-[10px] text-neutral-400 group-hover:text-neutral-200 py-1.5 px-2 truncate border-t border-neutral-700/80">
                              {el.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-neutral-400 mb-2">Seus elementos</p>
                      {customElements.length === 0 ? (
                        <p className="text-xs text-neutral-600 py-2">
                          Nenhum upload ainda. Use o botão Upload acima.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {customElements.map((asset) => {
                            const url = resolveAssetUrl(asset.src);
                            const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(asset.src) || asset.name.match(/\.(mp4|webm|mov)$/i);
                            return (
                              <div
                                key={asset.id}
                                className="group relative aspect-square rounded-lg border border-neutral-700 bg-neutral-800/80 overflow-hidden flex flex-col"
                              >
                                <button
                                  type="button"
                                  title="Adicionar ao vídeo"
                                  onClick={() => {
                                    onError(null);
                                    onUseLibraryImage(asset.src);
                                  }}
                                  className="flex-1 flex items-center justify-center p-2 cursor-pointer min-h-0"
                                >
                                  {isVideo ? (
                                    <video
                                      src={url}
                                      muted
                                      playsInline
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  ) : (
                                    <img
                                      src={url}
                                      alt=""
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  )}
                                </button>
                                <span className="text-[10px] text-neutral-400 py-1.5 px-2 truncate border-t border-neutral-700/80">
                                  {asset.name}
                                </span>
                                <button
                                  type="button"
                                  title="Remover da biblioteca"
                                  onClick={() => onRemoveLibraryAsset(asset.id)}
                                  className="absolute top-1 right-1 p-1 rounded bg-black/60 text-red-300 opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'personagem' && (
                  <div className="p-4 space-y-3">
                    {(() => {
                      const folder = personagemFolders.find((f) => f.id === openPersonagemFolder);
                      if (folder) {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => setOpenPersonagemFolder(null)}
                              className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white cursor-pointer"
                            >
                              <ArrowLeft size={14} />
                              Voltar
                            </button>
                            <p className="text-sm font-medium text-neutral-100">{folder.label}</p>
                            <p className="text-xs text-neutral-500">
                              {folder.items.length} poses. Clique para colocar no preview.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {folder.items.map((el) => (
                                <button
                                  key={el.src}
                                  type="button"
                                  title={poseLabel(el.label)}
                                  onClick={() => {
                                    onError(null);
                                    onUseLibraryImage(el.src);
                                  }}
                                  className="group aspect-square rounded-lg border border-neutral-700 bg-neutral-800/80 hover:border-violet-500 hover:bg-neutral-800 overflow-hidden cursor-pointer flex flex-col"
                                >
                                  <div className="flex-1 flex items-center justify-center p-1 bg-[radial-gradient(circle_at_center,#27272a_0%,#171717_70%)]">
                                    <img
                                      src={el.src}
                                      alt=""
                                      className="max-w-full max-h-full object-contain"
                                      loading="lazy"
                                    />
                                  </div>
                                  <span className="text-[10px] text-neutral-400 group-hover:text-neutral-200 py-1.5 px-2 truncate border-t border-neutral-700/80">
                                    {poseLabel(el.label)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        );
                      }
                      return (
                        <>
                          <p className="text-xs text-neutral-500">
                            Abra uma pasta para ver as poses. Voltar retorna a esta lista.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {personagemFolders.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setOpenPersonagemFolder(f.id)}
                                className="group rounded-lg border border-neutral-700 bg-neutral-800/80 hover:border-violet-500 hover:bg-neutral-800 overflow-hidden cursor-pointer flex flex-col text-left"
                              >
                                <div className="aspect-square relative flex items-center justify-center bg-[radial-gradient(circle_at_center,#27272a_0%,#171717_70%)]">
                                  {f.cover ? (
                                    <img
                                      src={f.cover}
                                      alt=""
                                      className="max-w-[90%] max-h-[90%] object-contain"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Folder size={28} className="text-neutral-500" />
                                  )}
                                </div>
                                <span className="text-[11px] text-neutral-200 py-1.5 px-2 leading-tight">
                                  {f.label}
                                </span>
                                <span className="text-[10px] text-neutral-500 px-2 pb-2">
                                  {f.items.length} imagens
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {tab === 'texto' && (
                  <div className="p-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        onError(null);
                        onAddText();
                      }}
                      className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer"
                    >
                      Adicionar caixa de texto
                    </button>
                    <p className="text-xs text-neutral-500 pt-1 pb-2">Estilos rápidos</p>
                    {TEXT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onError(null);
                          onAddText(p.id);
                        }}
                        className="w-full text-left px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800/60 hover:border-violet-500/60 hover:bg-neutral-800 cursor-pointer transition-colors"
                      >
                        <span
                          className={
                            'block text-neutral-100 font-semibold ' +
                            (p.id === 'title' ? 'text-2xl' : p.id === 'subtitle' ? 'text-lg' : 'text-sm')
                          }
                        >
                          {p.sample}
                        </span>
                        <span className="text-xs text-neutral-500 mt-0.5">{p.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {tab === 'imagens' && (
                  <div className="p-4 space-y-3">
                    <UploadBtn label="Enviar imagens" onClick={() => imageFileRef.current?.click()} />
                    <input
                      ref={imageFileRef}
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.svg"
                      multiple
                      className="hidden"
                      onChange={(e) => onImageFilesPicked(e.target.files)}
                    />
                    <OfflineHint />
                    {images.length === 0 ? (
                      <EmptyLibrary icon={<ImageIcon size={28} />} text="Nenhuma imagem enviada" />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {images.map((asset) => (
                          <LibraryImageCard
                            key={asset.id}
                            asset={asset}
                            url={resolveAssetUrl(asset.src)}
                            onAdd={() => onUseLibraryImage(asset.src)}
                            onFundo={() => onUseLibraryImageAsFundo(asset.src)}
                            onRemove={() => onRemoveLibraryAsset(asset.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'videos' && (
                  <div className="p-4 space-y-3">
                    <UploadBtn label="Enviar vídeos" onClick={() => videoFileRef.current?.click()} />
                    <input
                      ref={videoFileRef}
                      type="file"
                      accept="video/*,.mp4,.webm,.mov"
                      multiple
                      className="hidden"
                      onChange={(e) => onVideoFilesPicked(e.target.files)}
                    />
                    <OfflineHint />
                    {videos.length === 0 ? (
                      <EmptyLibrary icon={<Video size={28} />} text="Nenhum vídeo enviado" />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {videos.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            title="Adicionar na timeline"
                            onClick={() => onUseLibraryImage(asset.src, asset.durationSec)}
                            className="relative group rounded-lg border border-neutral-700 bg-neutral-800 overflow-hidden aspect-video cursor-pointer text-left"
                          >
                            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                              <Video size={32} className="text-neutral-600" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <p className="text-[10px] text-neutral-200 truncate">{asset.name}</p>
                              {asset.durationSec != null && (
                                <p className="text-[10px] text-neutral-400">{fmtDur(asset.durationSec)}</p>
                              )}
                            </div>
                            <span
                              role="button"
                              tabIndex={0}
                              title="Remover"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveLibraryAsset(asset.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  onRemoveLibraryAsset(asset.id);
                                }
                              }}
                              className="absolute top-1 right-1 p-1 rounded bg-black/60 text-red-300 opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-neutral-600 text-center">
                      Clique no clipe para colocar na timeline no playhead.
                    </p>
                  </div>
                )}

                {tab === 'audios' && (
                  <div className="p-4 space-y-3">
                    <UploadBtn label="Enviar áudios" onClick={() => audioFileRef.current?.click()} />
                    <input
                      ref={audioFileRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.ogg"
                      multiple
                      className="hidden"
                      onChange={(e) => onAudioFilesPicked(e.target.files)}
                    />
                    <OfflineHint />
                    {audios.length === 0 ? (
                      <EmptyLibrary icon={<Music size={28} />} text="Nenhum áudio enviado" />
                    ) : (
                      <div className="space-y-1">
                        {audios.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() =>
                              onUseLibraryAudio(asset.src, asset.name, asset.durationSec)
                            }
                            className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-800/60 hover:border-violet-500/50 hover:bg-neutral-800 cursor-pointer text-left"
                          >
                            <span className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0">
                              <Music size={14} className="text-violet-300" />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm text-neutral-200 truncate">
                                {asset.name}
                              </span>
                              {asset.durationSec != null && (
                                <span className="text-xs text-neutral-500">
                                  {fmtDur(asset.durationSec)}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              title="Remover"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveLibraryAsset(asset.id);
                              }}
                              className="p-1.5 rounded text-neutral-500 hover:text-red-300 opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'sfx' && (
                  <div className="p-4 space-y-3">
                    {(() => {
                      const folder = sfxFolders.find((f) => f.id === openSfxFolder);
                      if (folder) {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                stopSfxPreview();
                                setOpenSfxFolder(null);
                              }}
                              className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white cursor-pointer"
                            >
                              <ArrowLeft size={14} />
                              Voltar
                            </button>
                            <p className="text-sm font-medium text-neutral-100">{folder.label}</p>
                            <p className="text-xs text-neutral-500">
                              {folder.items.length} efeitos. Play ouve, clique no nome adiciona na timeline.
                            </p>
                            <div className="space-y-1">
                              {folder.items.map((el) => {
                                const playing = previewSfxSrc === el.src;
                                return (
                                  <div
                                    key={el.src}
                                    className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:border-violet-500 overflow-hidden"
                                  >
                                    <button
                                      type="button"
                                      title={playing ? 'Parar' : 'Ouvir'}
                                      onClick={() => toggleSfxPreview(el.src)}
                                      className={
                                        'shrink-0 w-9 h-9 flex items-center justify-center cursor-pointer ' +
                                        (playing ? 'text-pink-300' : 'text-violet-300 hover:text-white')
                                      }
                                    >
                                      <Play size={14} fill="currentColor" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Adicionar na timeline"
                                      onClick={() => addSfx(el.src, el.label)}
                                      className="flex-1 min-w-0 text-left py-2 pr-2 text-xs text-neutral-200 hover:text-white cursor-pointer truncate"
                                    >
                                      {el.label}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        );
                      }
                      return (
                        <>
                          <p className="text-xs text-neutral-500">
                            Abra uma pasta para ver os efeitos. Voltar retorna a esta lista.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {sfxFolders.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setOpenSfxFolder(f.id)}
                                className="group rounded-lg border border-neutral-700 bg-neutral-800/80 hover:border-violet-500 hover:bg-neutral-800 overflow-hidden cursor-pointer flex flex-col text-left p-3"
                              >
                                <Sparkles size={18} className="text-violet-400 mb-2" />
                                <span className="text-[11px] text-neutral-200 leading-tight">{f.label}</span>
                                <span className="text-[10px] text-neutral-500 mt-1">
                                  {f.items.length} efeitos
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const EmptyLibrary = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
    <div className="mb-3 opacity-40">{icon}</div>
    <p className="text-sm">{text}</p>
  </div>
);

const LibraryImageCard = ({
  asset,
  url,
  onAdd,
  onFundo,
  onRemove,
}: {
  asset: ProjectLibraryAsset;
  url: string;
  onAdd: () => void;
  onFundo: () => void;
  onRemove: () => void;
}) => (
  <div className="relative group rounded-lg border border-neutral-700 bg-neutral-800 overflow-hidden aspect-square">
    {url ? (
      <img src={url} alt="" className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-neutral-900">
        <ImageIcon size={24} className="text-neutral-600" />
      </div>
    )}
    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
      <button
        type="button"
        onClick={onAdd}
        className="w-full py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium cursor-pointer"
      >
        Adicionar
      </button>
      <button
        type="button"
        onClick={onFundo}
        className="w-full py-1.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-neutral-100 text-[11px] font-medium cursor-pointer flex items-center justify-center gap-1"
      >
        <ImagePlus size={12} />
        Fundo
      </button>
    </div>
    <button
      type="button"
      title="Remover da biblioteca"
      onClick={onRemove}
      className="absolute top-1 right-1 p-1 rounded bg-black/60 text-red-300 opacity-0 group-hover:opacity-100 cursor-pointer z-10"
    >
      <Trash2 size={12} />
    </button>
    <p className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] text-neutral-300 truncate pointer-events-none group-hover:opacity-0">
      {asset.name}
    </p>
  </div>
);
