/**
 * Baixa o binário portátil Real-ESRGAN (ncnn-vulkan) + models.
 */
import { existsSync, mkdirSync, rmSync, renameSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = path.join(__dirname, 'realesrgan');
const BIN = path.join(TARGET_DIR, 'realesrgan-ncnn-vulkan');
const ZIP_URL =
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip';
const ZIP_PATH = path.join(__dirname, 'realesrgan-ubuntu.zip');

const findBinary = (dir) => {
  if (existsSync(path.join(dir, 'realesrgan-ncnn-vulkan'))) {
    return path.join(dir, 'realesrgan-ncnn-vulkan');
  }
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const found = findBinary(path.join(dir, name.name));
    if (found) return found;
  }
  return null;
};

const setup = () => {
  if (existsSync(BIN)) {
    console.log('✅ Real-ESRGAN já instalado em', TARGET_DIR);
    return;
  }

  console.log('⬇️  Baixando Real-ESRGAN ncnn-vulkan...');
  execFileSync('curl', ['-L', '--fail', '-o', ZIP_PATH, ZIP_URL], { stdio: 'inherit' });

  if (existsSync(TARGET_DIR)) rmSync(TARGET_DIR, { recursive: true, force: true });
  mkdirSync(TARGET_DIR, { recursive: true });

  try {
    execFileSync('unzip', ['-o', ZIP_PATH, '-d', TARGET_DIR], { stdio: 'inherit' });
  } catch {
    execFileSync(
      'python3',
      [
        '-c',
        `import zipfile; zipfile.ZipFile(${JSON.stringify(ZIP_PATH)}).extractall(${JSON.stringify(TARGET_DIR)})`,
      ],
      { stdio: 'inherit' },
    );
  }

  const found = findBinary(TARGET_DIR);
  if (!found) throw new Error('Binário realesrgan-ncnn-vulkan não encontrado após unzip');

  if (found !== BIN) {
    const foundDir = path.dirname(found);
    for (const name of readdirSync(foundDir)) {
      const from = path.join(foundDir, name);
      const to = path.join(TARGET_DIR, name);
      if (!existsSync(to)) renameSync(from, to);
    }
  }

  if (!existsSync(BIN)) throw new Error('Falha ao normalizar estrutura do Real-ESRGAN');

  execFileSync('chmod', ['a+rx', BIN]);
  rmSync(ZIP_PATH, { force: true });
  console.log('✅ Real-ESRGAN pronto em', TARGET_DIR);
};

try {
  setup();
} catch (err) {
  console.warn('⚠️  setup-realesrgan falhou:', err.message);
  console.warn('   /upscale ficará indisponível até o binário ser instalado.');
  process.exit(0);
}
