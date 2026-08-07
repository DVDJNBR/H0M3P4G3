import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface RaindropItem {
  id: number;
  title: string;
  link: string;
  domain: string;
  cover?: string;
  created: string;
}

export interface RaindropCollectionCache {
  collectionId: string;
  items: RaindropItem[];
  fetchedAt: string;
}

export type RaindropCacheMap = Record<string, RaindropCollectionCache>;

export function getRaindropCachePath(dataDir: string): string {
  return join(dataDir, 'raindrop-cache.json');
}

export async function readRaindropCache(dataDir: string): Promise<RaindropCacheMap> {
  const filePath = getRaindropCachePath(dataDir);
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      return {};
    }
    console.error(`[raindrop] failed to read cache from ${filePath}:`, err);
    return {};
  }
}

export async function writeRaindropCache(
  dataDir: string,
  cacheMap: RaindropCacheMap,
): Promise<void> {
  const filePath = getRaindropCachePath(dataDir);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  await mkdir(dirname(filePath), { recursive: true });

  try {
    await writeFile(tmpPath, JSON.stringify(cacheMap, null, 2), 'utf8');
    await rename(tmpPath, filePath);
    console.log(`[raindrop] updated cache at ${filePath}`);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup error
    }
    console.error(`[raindrop] failed to write cache to ${filePath}:`, err);
    throw err;
  }
}
