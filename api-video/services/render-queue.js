import { randomUUID } from 'crypto';
import { copyFile, existsSync } from 'fs';
import { mkdir, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { renderProject } from './scene-compositor.js';

const copyFileAsync = promisify(copyFile);
const jobs = new Map();
let activeJobId = null;

export const getJob = (jobId) => jobs.get(jobId) ?? null;

const copyProjectAssets = async (projectAssetsDir, jobAssetsDir) => {
  if (!existsSync(projectAssetsDir)) return;
  await mkdir(jobAssetsDir, { recursive: true });
  const files = await readdir(projectAssetsDir);
  for (const file of files) {
    if (file === 'manifest.json') continue;
    await copyFileAsync(
      path.join(projectAssetsDir, file),
      path.join(jobAssetsDir, file),
    );
  }
};

export const enqueueRender = async (project, dataDir, projectAssetsDir) => {
  if (activeJobId) {
    const err = new Error('Render ocupado. Aguarde o job atual terminar.');
    err.status = 503;
    throw err;
  }

  const jobId = randomUUID();
  const jobDir = path.join(dataDir, jobId);
  const assetsDir = path.join(jobDir, 'assets');

  const job = {
    id: jobId,
    state: 'queued',
    progress: 0,
    error: null,
    outputPath: null,
    projectId: project.id,
  };
  jobs.set(jobId, job);

  activeJobId = jobId;
  job.state = 'running';

  (async () => {
    try {
      await mkdir(assetsDir, { recursive: true });
      await copyProjectAssets(projectAssetsDir, assetsDir);
      await writeFile(path.join(jobDir, 'project.json'), JSON.stringify(project, null, 2));

      const outputPath = await renderProject(project, jobDir, (pct) => {
        job.progress = Math.min(99, Math.round(pct));
      });

      if (!existsSync(outputPath)) throw new Error('Arquivo de saída não gerado');
      job.state = 'done';
      job.progress = 100;
      job.outputPath = outputPath;
    } catch (err) {
      job.state = 'error';
      job.error = err.message || 'Falha no render';
      job.progress = 0;
    } finally {
      activeJobId = null;
    }
  })();

  return jobId;
};

export const isRenderBusy = () => activeJobId !== null;
