import { readRaindropCache, writeRaindropCache, type RaindropItem, type RaindropCacheMap } from './store.js';

interface RaindropApiResponseItem {
  _id: number;
  title: string;
  link: string;
  domain?: string;
  cover?: string;
  created?: string;
}

interface RaindropApiResponse {
  result: boolean;
  items?: RaindropApiResponseItem[];
}

export async function fetchRaindropCollection(
  collectionId: string,
  token: string,
): Promise<{ items: RaindropItem[] } | { error: string }> {
  if (!token || token === 'placeholder' || token === 'dev-raindrop-token') {
    return { error: 'no token configured' };
  }

  const url = `https://api.raindrop.io/rest/v1/raindrops/${collectionId}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const reason = `HTTP ${response.status}`;
      console.error(`[raindrop] API request failed for collection ${collectionId}: ${reason}`);
      return { error: reason };
    }

    const data = (await response.json()) as RaindropApiResponse;
    if (!data.result || !Array.isArray(data.items)) {
      return { error: 'malformed API response' };
    }

    return {
      items: data.items.map((item) => ({
        id: item._id,
        title: item.title || item.link,
        link: item.link,
        domain: item.domain || new URL(item.link).hostname,
        cover: item.cover || undefined,
        created: item.created || new Date().toISOString(),
      })),
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[raindrop] fetch failed for collection ${collectionId}:`, reason);
    return { error: reason };
  }
}

export async function pollRaindropCollections(
  dataDir: string,
  collectionIds: string[],
  token: string,
): Promise<RaindropCacheMap> {
  const currentCache = await readRaindropCache(dataDir);
  const newCache: RaindropCacheMap = { ...currentCache };
  const now = new Date().toISOString();

  for (const collectionId of collectionIds) {
    if (!collectionId) continue;
    const result = await fetchRaindropCollection(collectionId, token);
    newCache[collectionId] = {
      collectionId,
      items: 'items' in result ? result.items : (currentCache[collectionId]?.items ?? []),
      fetchedAt: now,
      lastError: 'error' in result ? result.error : undefined,
    };
  }

  await writeRaindropCache(dataDir, newCache);
  return newCache;
}

export function startRaindropPoller(
  dataDir: string,
  getCollectionIds: () => Promise<string[]>,
  token: string,
  intervalMs = 15 * 60 * 1000,
): { stop: () => void; trigger: () => Promise<RaindropCacheMap> } {
  const trigger = async () => {
    try {
      const ids = await getCollectionIds();
      if (ids.length === 0) return await readRaindropCache(dataDir);
      return await pollRaindropCollections(dataDir, ids, token);
    } catch (err) {
      console.error('[raindrop] polling error:', err);
      return await readRaindropCache(dataDir);
    }
  };

  // Run initial poll asynchronously
  trigger().catch(() => {});

  const interval = setInterval(() => {
    trigger().catch(() => {});
  }, intervalMs);

  return {
    stop: () => clearInterval(interval),
    trigger,
  };
}
