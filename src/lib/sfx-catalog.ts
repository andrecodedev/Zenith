export type SfxItem = {
  file: string;
  label: string;
  src: string;
};

export type SfxFolder = {
  id: string;
  label: string;
  items: SfxItem[];
};

export type SfxCatalog = {
  folders: SfxFolder[];
};

export const loadSfxCatalog = async (): Promise<SfxCatalog> => {
  const res = await fetch('/sfx/catalog.json');
  if (!res.ok) return { folders: [] };
  return res.json();
};
