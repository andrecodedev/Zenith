import { supabase } from './supabase';
import type { VideoProject, VideoProjectSummary } from '../types/video-project';
import { createEmptyProject, projectTotalDurationSec } from '../types/video-project';

export const listVideoProjects = async (): Promise<VideoProjectSummary[]> => {
  const { data, error } = await supabase
    .from('video_projects')
    .select('id, name, duration_sec, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    durationSec: row.duration_sec,
    updatedAt: row.updated_at,
  }));
};

export const loadVideoProject = async (id: string): Promise<VideoProject> => {
  const { data, error } = await supabase
    .from('video_projects')
    .select('project_json')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data.project_json as VideoProject;
};

export const saveVideoProject = async (project: VideoProject): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const updated: VideoProject = { ...project, updatedAt: new Date().toISOString() };
  const durationSec = projectTotalDurationSec(updated);

  const { error } = await supabase.from('video_projects').upsert(
    {
      id: updated.id,
      user_id: user.id,
      name: updated.name,
      schema_version: updated.schemaVersion,
      project_json: updated,
      duration_sec: durationSec,
      updated_at: updated.updatedAt,
    },
    { onConflict: 'id' },
  );

  if (error) throw new Error(error.message);
};

export const createVideoProjectInDb = async (name?: string): Promise<VideoProject> => {
  const project = createEmptyProject(name);
  await saveVideoProject(project);
  return project;
};

export const deleteVideoProject = async (id: string): Promise<void> => {
  const { error } = await supabase.from('video_projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const duplicateVideoProject = async (id: string): Promise<VideoProject> => {
  const source = await loadVideoProject(id);
  const copy: VideoProject = {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    name: `${source.name} (cópia)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveVideoProject(copy);
  return copy;
};
