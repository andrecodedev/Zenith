export type PersonagemItem = {
  file: string;
  label: string;
  src: string;
};

export type PersonagemFolder = {
  id: string;
  label: string;
  cover: string;
  items: PersonagemItem[];
};

export type PersonagemCatalog = {
  folders: PersonagemFolder[];
};

export const loadPersonagemCatalog = async (): Promise<PersonagemCatalog> => {
  const res = await fetch('/personagem/catalog.json');
  if (!res.ok) return { folders: [] };
  return res.json();
};
