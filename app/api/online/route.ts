import { NextResponse } from 'next/server';
import { themes } from '../../../lib/catalog.mjs';
import { onlineRoomView, prepareOnlineRound, resetOnlineRound } from '../../../lib/online-game.mjs';
import { createStoredRoom, readStoredRoom, RoomStoreUnavailableError, updateStoredRoom } from '../../../lib/room-store';
import type { OnlinePlayer, OnlineRoom } from '../../../lib/online-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class ActionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanCode = (value: unknown) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const cleanName = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, value => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}

function player(name: string, color: number): OnlinePlayer {
  return {
    id: crypto.randomUUID(),
    token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    name,
    color,
    ready: false,
    viewed: false,
    joinedAt: Date.now(),
  };
}

function authenticate(room: OnlineRoom, body: Record<string, unknown>) {
  const found = room.players.find(item => item.id === body.playerId && item.token === body.playerToken);
  if (!found) throw new ActionError('Sua sessão nessa sala não é válida.', 401);
  return found;
}

function hostOnly(room: OnlineRoom, actor: OnlinePlayer) {
  if (room.hostId !== actor.id) throw new ActionError('Apenas o host pode fazer isso.', 403);
}

function roomResponse(room: OnlineRoom, viewerId: string, credentials?: OnlinePlayer) {
  return NextResponse.json({
    ok: true,
    room: onlineRoomView(room, viewerId),
    ...(credentials ? { credentials: { code: room.code, playerId: credentials.id, playerToken: credentials.token } } : {}),
  });
}

async function create(name: string) {
  if (!name) throw new ActionError('Digite seu nome para criar a sala.');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const host = player(name, 0);
    const now = Date.now();
    const room: OnlineRoom = {
      code: randomCode(), hostId: host.id, phase: 'lobby', themeId: null, roundNumber: 0,
      players: [host], word: null, hint: null, impostorId: null, starterId: null,
      createdAt: now, updatedAt: now,
    };
    if (await createStoredRoom(room)) return roomResponse(room, host.id, host);
  }
  throw new ActionError('Não foi possível gerar um código. Tente novamente.', 503);
}

async function join(code: string, name: string) {
  if (code.length !== 6) throw new ActionError('Digite um código de sala válido.');
  if (!name) throw new ActionError('Digite seu nome para entrar.');
  const newcomer = player(name, 0);
  const room = await updateStoredRoom(code, current => {
    if (current.phase !== 'lobby') throw new ActionError('A rodada já começou. Entre na próxima.');
    if (current.players.length >= 20) throw new ActionError('Essa sala já está cheia.');
    if (current.players.some(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      throw new ActionError('Esse nome já está sendo usado na sala.');
    }
    newcomer.color = current.players.length % 20;
    current.players.push(newcomer);
  });
  if (!room) throw new ActionError('Sala não encontrada ou expirada.', 404);
  return roomResponse(room, newcomer.id, newcomer);
}

async function act(code: string, body: Record<string, unknown>) {
  if (code.length !== 6) throw new ActionError('Código de sala inválido.');
  const action = String(body.action ?? 'state');

  if (action === 'state') {
    const room = await readStoredRoom(code);
    if (!room) throw new ActionError('Sala não encontrada ou expirada.', 404);
    const actor = authenticate(room, body);
    return roomResponse(room, actor.id);
  }

  let actorId = '';
  const room = await updateStoredRoom(code, current => {
    const actor = authenticate(current, body);
    actorId = actor.id;

    if (action === 'selectTheme') {
      hostOnly(current, actor);
      if (current.phase !== 'lobby') throw new ActionError('O tema só pode ser alterado no lobby.');
      const themeId = String(body.themeId ?? '');
      if (!themes.some(theme => theme.id === themeId)) throw new ActionError('Tema inválido.');
      current.themeId = themeId;
    } else if (action === 'startRound') {
      hostOnly(current, actor);
      if (current.phase !== 'lobby') throw new ActionError('A rodada já começou.');
      const theme = themes.find(item => item.id === current.themeId);
      if (!theme) throw new ActionError('Escolha um tema primeiro.');
      prepareOnlineRound(current, theme);
    } else if (action === 'revealCard') {
      if (current.phase !== 'cards') throw new ActionError('As cartas não estão disponíveis agora.');
      actor.viewed = true;
    } else if (action === 'ready') {
      if (current.phase !== 'cards') throw new ActionError('A sala não está preparando cartas.');
      if (!actor.viewed) throw new ActionError('Veja sua carta antes de ficar pronto.');
      actor.ready = true;
    } else if (action === 'startDiscussion') {
      hostOnly(current, actor);
      if (current.phase !== 'cards') throw new ActionError('A rodada não está preparando cartas.');
      if (!current.players.every(item => item.ready)) throw new ActionError('Ainda há jogadores que não estão prontos.');
      current.phase = 'discussion';
    } else if (action === 'revealResult') {
      hostOnly(current, actor);
      if (current.phase !== 'discussion') throw new ActionError('A discussão ainda não começou.');
      current.phase = 'result';
    } else if (action === 'nextRound') {
      hostOnly(current, actor);
      if (current.phase !== 'result') throw new ActionError('Revele o resultado antes da próxima rodada.');
      resetOnlineRound(current);
    } else {
      throw new ActionError('Ação inválida.');
    }
  });

  if (!room) throw new ActionError('Sala não encontrada ou expirada.', 404);
  return roomResponse(room, actorId);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    if (action === 'create') return create(cleanName(body.name));
    if (action === 'join') return join(cleanCode(body.code), cleanName(body.name));
    return act(cleanCode(body.code), body);
  } catch (error) {
    const status = error instanceof ActionError ? error.status : error instanceof RoomStoreUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a sala.';
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
