import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.join(ROOT, 'src', 'assets'),
  ROOT,
];
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'api', '.agents', '.codex']);
const MIN_SIZE_TO_PROCESS = 40 * 1024;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...await walk(path.join(dir, entry.name)));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!RASTER_EXTENSIONS.has(ext)) {
      continue;
    }

    files.push(path.join(dir, entry.name));
  }

  return files;
}

function isRootLevelFile(filePath) {
  return path.dirname(filePath) === ROOT;
}

function uniqueFiles(files) {
  return [...new Set(files.map((filePath) => path.normalize(filePath)))];
}

async function optimizeImage(filePath) {
  const source = await fs.readFile(filePath);
  if (source.byteLength < MIN_SIZE_TO_PROCESS) {
    return null;
  }

  const ext = path.extname(filePath).toLowerCase();
  let pipeline = sharp(source, { animated: false }).rotate();

  if (ext === '.png') {
    pipeline = pipeline.png({
      compressionLevel: 9,
      effort: 10,
      palette: true,
      quality: 82,
      adaptiveFiltering: true,
    });
  } else if (ext === '.jpg' || ext === '.jpeg') {
    pipeline = pipeline.jpeg({
      quality: 82,
      mozjpeg: true,
      chromaSubsampling: '4:2:0',
    });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({
      quality: 82,
      effort: 6,
    });
  } else {
    return null;
  }

  const optimized = await pipeline.toBuffer();
  if (optimized.byteLength >= source.byteLength) {
    return null;
  }

  await fs.writeFile(filePath, optimized);
  return {
    filePath,
    before: source.byteLength,
    after: optimized.byteLength,
  };
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function main() {
  const candidates = [];

  for (const dir of TARGET_DIRS) {
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) {
        continue;
      }

      candidates.push(...await walk(dir));
    } catch {
      // Ignore missing directories.
    }
  }

  const files = uniqueFiles(candidates).filter((filePath) => {
    if (isRootLevelFile(filePath)) {
      return true;
    }

    return filePath.startsWith(path.join(ROOT, 'src', 'assets'));
  });

  const results = [];
  for (const filePath of files) {
    const optimized = await optimizeImage(filePath);
    if (optimized) {
      results.push(optimized);
      console.log(
        `${path.relative(ROOT, filePath)}: ${formatBytes(optimized.before)} -> ${formatBytes(optimized.after)}`
      );
    }
  }

  const savedBytes = results.reduce((sum, item) => sum + (item.before - item.after), 0);
  console.log(
    `Optimized ${results.length} images. Saved ${formatBytes(savedBytes)}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
