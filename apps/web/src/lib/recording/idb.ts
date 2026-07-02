"use client";

import { get, set, del, update, keys } from "idb-keyval";

/**
 * Typed IndexedDB wrappers (over idb-keyval) for crash-safe audio chunk
 * persistence. Each chunk is written to IndexedDB BEFORE upload is attempted,
 * so a crash/refresh never loses recorded audio.
 *
 * Key layout:
 *   chunk:{sessionId}:{index}   → StoredChunk
 *   session:{sessionId}:chunks  → number[] (ordered list of chunk indices)
 */

export interface StoredChunk {
  sessionId: string;
  chunkIndex: number;
  blob: Blob;
  uploaded: boolean;
}

const chunkKey = (sessionId: string, index: number) =>
  `chunk:${sessionId}:${index}`;
const indexKey = (sessionId: string) => `session:${sessionId}:chunks`;

/** Persist a chunk and append its index to the session's chunk list. */
export async function saveChunk(chunk: StoredChunk): Promise<void> {
  await set(chunkKey(chunk.sessionId, chunk.chunkIndex), chunk);
  // `update` runs the read-modify-write inside a single IndexedDB transaction,
  // so two overlapping saveChunk calls (e.g. delayed `dataavailable` events
  // under tab throttling) can't both read the old list and clobber each
  // other's append — a plain get()+set() here could silently drop an index and
  // orphan its chunk from upload / crash-recovery.
  await update<number[]>(indexKey(chunk.sessionId), (prev) => {
    const list = prev ?? [];
    if (list.includes(chunk.chunkIndex)) return list;
    return [...list, chunk.chunkIndex].sort((a, b) => a - b);
  });
}

/** Mark a set of chunk indices as uploaded (e.g. from server acknowledgement). */
export async function markChunksUploaded(
  sessionId: string,
  indices: number[],
): Promise<void> {
  for (const index of indices) {
    const existing = await get<StoredChunk>(chunkKey(sessionId, index));
    if (existing && !existing.uploaded) {
      await set(chunkKey(sessionId, index), { ...existing, uploaded: true });
    }
  }
}

export async function getChunk(
  sessionId: string,
  index: number,
): Promise<StoredChunk | undefined> {
  return get<StoredChunk>(chunkKey(sessionId, index));
}

export async function getChunkIndices(sessionId: string): Promise<number[]> {
  return (await get<number[]>(indexKey(sessionId))) ?? [];
}

/** All chunks for a session that have not yet been acknowledged by the server. */
export async function getPendingChunks(
  sessionId: string,
): Promise<StoredChunk[]> {
  const indices = await getChunkIndices(sessionId);
  const result: StoredChunk[] = [];
  for (const index of indices) {
    const c = await get<StoredChunk>(chunkKey(sessionId, index));
    if (c && !c.uploaded) result.push(c);
  }
  return result;
}

/** Remove every chunk and the index list for a session. */
export async function clearSession(sessionId: string): Promise<void> {
  const indices = await getChunkIndices(sessionId);
  for (const index of indices) {
    await del(chunkKey(sessionId, index));
  }
  await del(indexKey(sessionId));
}

/** Distinct session ids that currently have at least one stored chunk. */
export async function listSessionIds(): Promise<string[]> {
  const allKeys = (await keys()) as IDBValidKey[];
  const ids = new Set<string>();
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith("session:") && k.endsWith(":chunks")) {
      ids.add(k.slice("session:".length, k.length - ":chunks".length));
    }
  }
  return Array.from(ids);
}

export interface SessionPending {
  sessionId: string;
  pendingCount: number;
  totalCount: number;
}

/** Scan every session and report those with pending (un-uploaded) chunks. */
export async function scanPendingSessions(): Promise<SessionPending[]> {
  const ids = await listSessionIds();
  const out: SessionPending[] = [];
  for (const sessionId of ids) {
    const indices = await getChunkIndices(sessionId);
    let pending = 0;
    for (const index of indices) {
      const c = await get<StoredChunk>(chunkKey(sessionId, index));
      if (c && !c.uploaded) pending++;
    }
    if (pending > 0) {
      out.push({ sessionId, pendingCount: pending, totalCount: indices.length });
    }
  }
  return out;
}
