import Konva from 'konva';
import type { ProjectElement, VideoScene } from '../types/video-project';
import {
  PROJECT_HEIGHT,
  PROJECT_WIDTH,
  cornerRadiusPx,
  strokeWidthPx,
} from '../types/video-project';

export const UHD_SCALE = 2;

const loadHtmlImage = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

const safeFileName = (name: string) =>
  (name || 'banner').replace(/[^\w\-]+/g, '_').slice(0, 80);

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportBannerJpg4k = async ({
  scene,
  elements,
  resolveUrl,
}: {
  scene: VideoScene;
  elements: ProjectElement[];
  resolveUrl: (src: string) => string;
}): Promise<Blob> => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden';
  document.body.appendChild(wrap);

  const stage = new Konva.Stage({
    container: wrap,
    width: PROJECT_WIDTH,
    height: PROJECT_HEIGHT,
  });

  try {
  const layer = new Konva.Layer();
  stage.add(layer);

  const bgColor = scene.backgroundColor || '#ffffff';
  layer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: PROJECT_WIDTH,
      height: PROJECT_HEIGHT,
      fill: bgColor,
      listening: false,
    }),
  );

  if (scene.backgroundSrc) {
    const bgImg = await loadHtmlImage(resolveUrl(scene.backgroundSrc));
    if (bgImg) {
      layer.add(
        new Konva.Image({
          x: 0,
          y: 0,
          width: PROJECT_WIDTH,
          height: PROJECT_HEIGHT,
          image: bgImg,
          listening: false,
        }),
      );
    }
  }

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    if (el.type === 'image') {
      const img = await loadHtmlImage(resolveUrl(el.src));
      const radius = cornerRadiusPx(el.w, el.h, el.cornerRadius);
      const borderW = strokeWidthPx(el.w, el.h, el.borderWidth);
      const group = new Konva.Group({
        x: el.x + (el.flipX ? el.w : 0),
        y: el.y,
        rotation: el.rotation ?? 0,
        scaleX: el.flipX ? -1 : 1,
        opacity: el.opacity ?? 1,
        listening: false,
        clipFunc:
          radius > 0
            ? (ctx) => {
                const w = el.w;
                const h = el.h;
                const r = Math.min(radius, w / 2, h / 2);
                ctx.beginPath();
                ctx.moveTo(r, 0);
                ctx.lineTo(w - r, 0);
                ctx.quadraticCurveTo(w, 0, w, r);
                ctx.lineTo(w, h - r);
                ctx.quadraticCurveTo(w, h, w - r, h);
                ctx.lineTo(r, h);
                ctx.quadraticCurveTo(0, h, 0, h - r);
                ctx.lineTo(0, r);
                ctx.quadraticCurveTo(0, 0, r, 0);
                ctx.closePath();
              }
            : undefined,
      });
      if (el.fillColor && el.fillColor !== 'transparent') {
        group.add(
          new Konva.Rect({
            x: 0,
            y: 0,
            width: el.w,
            height: el.h,
            fill: el.fillColor,
            cornerRadius: radius,
          }),
        );
      }
      if (img) {
        group.add(
          new Konva.Image({
            x: 0,
            y: 0,
            width: el.w,
            height: el.h,
            image: img,
          }),
        );
      }
      if (borderW > 0) {
        group.add(
          new Konva.Rect({
            x: 0,
            y: 0,
            width: el.w,
            height: el.h,
            stroke: el.borderColor ?? '#ffffff',
            strokeWidth: borderW,
            cornerRadius: radius,
          }),
        );
      }
      layer.add(group);
    } else {
      const fontStyle = [el.bold ? 'bold' : '', el.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal';
      layer.add(
        new Konva.Text({
          x: el.x,
          y: el.y,
          text: el.text,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          fontStyle,
          textDecoration: el.underline ? 'underline' : '',
          fill: el.color,
          align: el.align ?? 'left',
          listening: false,
        }),
      );
    }
  }

  layer.draw();
    // JPEG: banner de midia social nao precisa de transparencia; arquivo menor que PNG.
    const dataUrl = stage.toDataURL({
      mimeType: 'image/jpeg',
      quality: 0.92,
      pixelRatio: UHD_SCALE,
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (!blob.size) throw new Error('Nao foi possivel gerar o JPG');
    return blob;
  } finally {
    stage.destroy();
    wrap.remove();
  }
};

export const bannerFileName = (projectName: string) => `${safeFileName(projectName)}_banner_4k.jpg`;
