export function randomInt(max) {
  const limit = 4294967296 - (4294967296 % max);
  const values = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % max;
}
export function createRound(players, theme, previousWord = '', pick = randomInt) {
  if (players.length < 3 || players.length > 20) throw new Error('Use de 3 a 20 jogadores.');
  const available = theme.entries.filter(entry => entry[0] !== previousWord);
  const entry = (available.length ? available : theme.entries)[pick(available.length || theme.entries.length)];
  const order = [...players];
  for (let i = order.length - 1; i > 0; i--) { const j = pick(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  return {players: order, impostor: pick(order.length), word: entry[0], hint: entry[1 + pick(3)], theme: theme.name, starter: pick(order.length)};
}
