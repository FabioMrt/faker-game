import test from 'node:test';
import assert from 'node:assert/strict';
import { themes } from '../lib/catalog.mjs';
import { createRound } from '../lib/game.mjs';
test('catalog has exactly three distinct one-word hints per answer',()=>{for(const theme of themes)for(const [word,...hints] of theme.entries){assert.equal(hints.length,3);assert.equal(new Set(hints).size,3);for(const hint of hints){assert.ok(!/\s/.test(hint));assert.notEqual(hint.toLowerCase(),word.toLowerCase());}}});
test('rounds have one impostor, preserve names, and avoid immediate repeats',()=>{const names=['Ana','Bia','Caio','Duda'];for(const theme of themes){let previous='';for(let i=0;i<250;i++){const r=createRound(names,theme,previous);assert.deepEqual([...r.players].sort(),[...names].sort());assert.equal(r.players.filter((_,j)=>j===r.impostor).length,1);assert.ok(r.starter>=0&&r.starter<names.length);assert.notEqual(r.word,previous);const entry=theme.entries.find(e=>e[0]===r.word);assert.ok(entry.slice(1).includes(r.hint));previous=r.word;}}});
test('rejects invalid group sizes',()=>{assert.throws(()=>createRound(['Ana'],themes[0]));assert.throws(()=>createRound(Array(21).fill('A'),themes[0]));});

