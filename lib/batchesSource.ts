// lib/batchesSource.ts — loads the batches list from the admin-configured JSON URL
// (default: GitHub raw batches.json), normalizes it to the card shape used by the
// UI, applies the default banner, and caches with a last-good fallback.
import { getAppSettings } from "./appSettings";
import { DEFAULT_BATCH_BANNER } from "./branding";

export type SourceBatch = {
  _id: string;
  batchId: string;
  batchName: string;
  batchPrice: number;
  batchImage: string;
  template: string;
  BatchType: "FREE" | "PAID";
  language: string;
  byName: string;
  startDate: string;
  endDate: string;
  batchStatus: boolean;
  slug?: string;
};

const CACHE_TTL_MS = 60_000;
let cache: { url: string; at: number; items: SourceBatch[] } | null = null;
let lastGood: { url: string; items: SourceBatch[] } | null = null;

export function clearBatchesCache() {
  cache = null;
}

function pickImage(item: any): string {
  const candidates = [
    item.previewImage,
    item.batchImage,
    item.pngUrl,
    item.image,
    item.iosPreviewImageUrl,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object" && c.baseUrl && c.key) return `${c.baseUrl}${c.key}`;
  }
  return DEFAULT_BATCH_BANNER;
}

export function normalizeBatch(item: any): SourceBatch | null {
  const id = item?._id || item?.batchId || item?.id;
  if (!id) return null;
  const priceRaw = item.feeTotal ?? item.batchPrice ?? item.offPrice ?? item.actualPrice ?? 0;
  const price = Number(priceRaw) || 0;
  const today = new Date().toISOString().split("T")[0];
  return {
    _id: String(id),
    batchId: String(id),
    batchName: item.name || item.batchName || "Untitled batch",
    batchPrice: price,
    batchImage: pickImage(item),
    template: item.template || "NORMAL",
    BatchType: price === 0 ? "FREE" : "PAID",
    language: item.language || item.medium || "Hinglish",
    byName: item.byName || item.exam || "PW",
    startDate: item.startDate || item.startsOn || today,
    endDate: item.endDate || item.startDate || today,
    batchStatus: true,
    slug: item.slug,
  };
}

function extractArray(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.batches)) return json.batches;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.data?.batches)) return json.data.batches;
  return [];
}

export async function fetchBatchesFromUrl(url: string): Promise<SourceBatch[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 PW-MARCO" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Batches source returned HTTP ${res.status}`);
  const json = await res.json();
  const arr = extractArray(json);
  if (!arr.length && json?.success === false) throw new Error("Batches source reported failure");
  return arr.map(normalizeBatch).filter(Boolean) as SourceBatch[];
}

export async function getAllBatches(force = false): Promise<SourceBatch[]> {
  const { batchesSourceUrl } = await getAppSettings();
  const url = batchesSourceUrl;
  const now = Date.now();
  if (!force && cache && cache.url === url && now - cache.at < CACHE_TTL_MS) return cache.items;
  try {
    const items = await fetchBatchesFromUrl(url);
    cache = { url, at: now, items };
    lastGood = { url, items };
    return items;
  } catch (err) {
    console.error("[batchesSource] fetch failed:", (err as Error).message);
    if (lastGood) return lastGood.items;
    throw err;
  }
}

export async function findBatchById(batchId: string): Promise<SourceBatch | undefined> {
  const items = await getAllBatches();
  return items.find((b) => b.batchId === batchId);
}

export function paginate<T>(items: T[], page: number, limit: number) {
  const totalItems = items.length;
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    totalItems,
  };
}
