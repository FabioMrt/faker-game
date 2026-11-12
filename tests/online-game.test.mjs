import test from 'node:test';
import assert from 'node:assert/strict';
import { onlineRoomView, prepareOnlineRound, resetOnlineRound } from '../lib/online-game.mjs';

function room() {
  return {
    code: 'ABC123', hostId: 'a', phase: 'lobby', themeId: 'objetos', roundNumber: 0,
    players: [
      { id: 'a', token: 'secret-a', name: 'Ana', color: 0, ready: false, viewed: false, joinedAt: 1 },
      { id: 'b', token: 'secret-b', name: 'Bia', color: 1, ready: false, viewed: false, joinedAt: 2 },
      { id: 'c', token: 'secret-c', name: 'Caio', color: 2, ready: false, viewed: false, joinedAt: 3 },
    ],
    word: null, hint: null, impostorId: null, starterId: null, speakingOrderIds: [], createdAt: 1, updatedAt: 1,
  };
}

test('online view never exposes tokens or another player card', () => {
  const value = room();
  prepareOnlineRound(value, { entries: [['Espelho', 'Vaidade', 'Rotina', 'Detalhe']] }, () => 0);
  value.players[1].viewed = true;
  const view = onlineRoomView(value, 'a');
  assert.equal(JSON.stringify(view).includes('secret-'), false);
  assert.equal(view.viewer.card, null);
  assert.equal('card' in view.players[1], false);
});

test('viewer receives only their assignment after revealing', () => {
  const value = room();
  prepareOnlineRound(value, { entries: [['Espelho', 'Vaidade', 'Rotina', 'Detalhe']] }, () => 0);
  value.players[0].viewed = true;
  const impostorView = onlineRoomView(value, 'a');
  assert.deepEqual(impostorView.viewer.card, { role: 'impostor', value: 'Vaidade' });
  value.players[1].viewed = true;
  const playerView = onlineRoomView(value, 'b');
  assert.deepEqual(playerView.viewer.card, { role: 'player', value: 'Espelho' });
});

test('next online round clears every secret and ready state', () => {
  const value = room();
  prepareOnlineRound(value, { entries: [['Espelho', 'Vaidade', 'Rotina', 'Detalhe']] }, () => 0);
  value.players.forEach(player => { player.ready = true; player.viewed = true; });
  resetOnlineRound(value);
  assert.equal(value.phase, 'lobby');
  assert.equal(value.themeId, null);
  assert.equal(value.word, null);
  assert.deepEqual(value.speakingOrderIds, []);
  assert.equal(value.players.some(player => player.ready || player.viewed), false);
});

test('each online round includes every player in a shuffled speaking order', () => {
  const value = room();
  const theme = { entries: [['Espelho', 'Vaidade', 'Rotina', 'Detalhe']] };
  prepareOnlineRound(value, theme, () => 0);
  const firstOrder = [...value.speakingOrderIds];
  assert.deepEqual([...firstOrder].sort(), ['a', 'b', 'c']);
  assert.equal(new Set(firstOrder).size, value.players.length);
  assert.equal(value.starterId, firstOrder[0]);

  const picks = [0, 0, 2, 1];
  prepareOnlineRound(value, theme, limit => (picks.shift() ?? 0) % limit);
  assert.deepEqual([...value.speakingOrderIds].sort(), ['a', 'b', 'c']);
  assert.notDeepEqual(value.speakingOrderIds, firstOrder);
  assert.equal(value.starterId, value.speakingOrderIds[0]);
});
