import { Redis } from '@upstash/redis';
import type { OnlineRoom } from './online-types';

const ROOM_TTL_SECONDS = 60 * 60 * 4;
const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = configured ? Redis.fromEnv() : null;

type MemoryEntry = { room: OnlineRoom; expiresAt: number };
const globalRooms = globalThis as typeof globalThis & { __fakerRooms?: Map<string, MemoryEntry> };
const memoryRooms = globalRooms.__fakerRooms ?? new Map<string, MemoryEntry>();
if (process.env.NODE_ENV !== 'production') globalRooms.__fakerRooms = memoryRooms;

export class RoomStoreUnavailableError extends Error {}

function roomKey(code: string) { return `faker:room:${code}`; }
function lockKey(code: string) { return `faker:lock:${code}`; }

function assertAvailable() {
  if (!redis && process.env.NODE_ENV === 'production') {
    throw new RoomStoreUnavailableError('O modo online ainda precisa do Redis conectado na Vercel.');
  }
}

export async function createStoredRoom(room: OnlineRoom) {
  assertAvailable();
  if (!redis) {
    if (memoryRooms.has(room.code)) return false;
    memoryRooms.set(room.code, { room, expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000 });
    return true;
  }
  const result = await redis.set(roomKey(room.code), room, { ex: ROOM_TTL_SECONDS, nx: true });
  return result === 'OK';
}

export async function readStoredRoom(code: string): Promise<OnlineRoom | null> {
  assertAvailable();
  if (!redis) {
    const entry = memoryRooms.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      memoryRooms.delete(code);
      return null;
    }
    return structuredClone(entry.room);
  }
  return redis.get<OnlineRoom>(roomKey(code));
}

async function acquireLock(code: string) {
  if (!redis) return 'memory';
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await redis.set(lockKey(code), token, { nx: true, px: 2500 });
    if (result === 'OK') return token;
    await new Promise(resolve => setTimeout(resolve, 35 + attempt * 15));
  }
  throw new Error('A sala está ocupada. Tente novamente.');
}

async function releaseLock(code: string, token: string) {
  if (!redis) return;
  await redis.eval(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    [lockKey(code)],
    [token],
  );
}

export async function updateStoredRoom(code: string, update: (room: OnlineRoom) => OnlineRoom | void) {
  assertAvailable();
  const lock = await acquireLock(code);
  try {
    const room = await readStoredRoom(code);
    if (!room) return null;
    const updated = update(room) ?? room;
    updated.updatedAt = Date.now();
    if (!redis) {
      memoryRooms.set(code, { room: structuredClone(updated), expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000 });
    } else {
      await redis.set(roomKey(code), updated, { ex: ROOM_TTL_SECONDS });
    }
    return updated;
  } finally {
    await releaseLock(code, lock);
  }
}
