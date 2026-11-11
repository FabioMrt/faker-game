import { randomInt } from './game.mjs';

export function prepareOnlineRound(room, theme, pick = randomInt) {
  if (room.players.length < 3) throw new Error('A sala precisa de pelo menos 3 jogadores.');
  const previous = room.word;
  const available = theme.entries.filter(entry => entry[0] !== previous);
  const entries = available.length ? available : theme.entries;
  const entry = entries[pick(entries.length)];
  const impostor = room.players[pick(room.players.length)];
  const starter = room.players[pick(room.players.length)];

  room.phase = 'cards';
  room.roundNumber += 1;
  room.word = entry[0];
  room.hint = entry[1 + pick(3)];
  room.impostorId = impostor.id;
  room.starterId = starter.id;
  room.players = room.players.map(player => ({ ...player, ready: false, viewed: false }));
  return room;
}

export function resetOnlineRound(room) {
  room.phase = 'lobby';
  room.themeId = null;
  room.word = null;
  room.hint = null;
  room.impostorId = null;
  room.starterId = null;
  room.players = room.players.map(player => ({ ...player, ready: false, viewed: false }));
  return room;
}

export function onlineRoomView(room, viewerId) {
  const viewer = room.players.find(player => player.id === viewerId);
  if (!viewer) throw new Error('Jogador não encontrado.');
  const canSeeCard = viewer.viewed && room.word && room.hint && room.impostorId;
  const resultVisible = room.phase === 'result';

  return {
    code: room.code,
    phase: room.phase,
    themeId: room.themeId,
    roundNumber: room.roundNumber,
    hostId: room.hostId,
    starterId: room.starterId,
    allReady: room.players.length >= 3 && room.players.every(player => player.ready),
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      color: player.color,
      ready: player.ready,
      viewed: player.viewed,
      isHost: player.id === room.hostId,
    })),
    viewer: {
      id: viewer.id,
      isHost: viewer.id === room.hostId,
      card: canSeeCard ? {
        role: viewer.id === room.impostorId ? 'impostor' : 'player',
        value: viewer.id === room.impostorId ? room.hint : room.word,
      } : null,
    },
    result: resultVisible ? {
      impostorId: room.impostorId,
      word: room.word,
      hint: room.hint,
    } : null,
  };
}
