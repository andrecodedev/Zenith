export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    reader.readAsDataURL(file);
  });

export const uploadProjectAsset = async (
  apiUrl: string,
  projectId: string,
  file: File,
): Promise<{ src: string; url: string }> => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${apiUrl}/assets/${projectId}`, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha no upload');
  }
  const data = await res.json();
  return { src: data.src, url: `${apiUrl}${data.url}` };
};

export const resolveAssetSrc = (
  src: string,
  projectId: string | undefined,
  apiUrl: string,
): string => {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  if (!projectId || !apiUrl) return '';
  if (src.startsWith('asset://')) {
    return `${apiUrl}/assets/${projectId}/${src.replace('asset://', '')}`;
  }
  return src;
};

export const getAudioDuration = (url: string): Promise<number> =>
  new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 3));
    audio.addEventListener('error', () => resolve(3));
  });

export const isVideoSrc = (src: string) =>
  src.startsWith('data:video') || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);

export const getVideoDuration = (url: string): Promise<number> =>
  new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => resolve(video.duration || 5));
    video.addEventListener('error', () => resolve(5));
    video.src = url;
  });
