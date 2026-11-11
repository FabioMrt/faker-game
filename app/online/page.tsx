'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { PlayerCredentials, RoomPhase } from '../../lib/online-types';

type PublicPlayer = { id: string; name: string; color: number; ready: boolean; viewed: boolean; isHost: boolean };
type Card = { role: 'player' | 'impostor'; value: string };
type RoomView = {
  code: string; phase: RoomPhase; themeId: string | null; roundNumber: number; hostId: string;
  starterId: string | null; allReady: boolean; players: PublicPlayer[];
  viewer: { id: string; isHost: boolean; card: Card | null };
  result: { impostorId: string; word: string; hint: string } | null;
};

type ApiResult = { ok: true; room: RoomView; credentials?: PlayerCredentials } | { ok: false; error: string };

const palette = ['#ff765e','#60c9e0','#b4a0ef','#a5d36d','#ffd05d','#ef8ebd','#edaa63','#85d5b9','#8aaaf5','#d6b38c','#f69b91','#91b857','#cba4d8','#7bc7c0','#d6bd57','#e88ba1','#98b6c9','#c7d68b','#a3a0de','#e6b5a1'];
const themes = [
  ['objetos','🕹️','Objetos','Coisas do dia a dia'], ['famosos','⭐','Pessoas famosas','Nomes que todo mundo conhece'],
  ['lugares','🏝️','Lugares','Para onde a pista leva?'], ['comidas','🍕','Comidas','Uma rodada de dar água na boca'],
  ['animais','🐊','Animais','Instinto também conta'], ['cinema-tv','🎬','Cinema/TV','Filmes, séries e personagens'],
  ['geral','🎲','Geral','Tudo misturado. Qualquer assunto vale!'],
] as const;

async function callApi(payload: Record<string, unknown>): Promise<Extract<ApiResult, { ok: true }>> {
  const response = await fetch('/api/online', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store',
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(response.ok
      ? 'A resposta da sala veio em um formato inesperado. Tente novamente.'
      : 'O servidor da sala está indisponível no momento. Tente novamente em instantes.');
  }
  const result = await response.json() as ApiResult;
  if (!result.ok) throw new Error(result.error);
  return result;
}

function replaceRoomUrl(code?: string) {
  try {
    const url = new URL(window.location.href);
    url.pathname = '/online';
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // A sala continua funcionando mesmo em navegadores que bloqueiam a History API.
  }
}

function Pixel() { return <span aria-hidden="true" className="pixel"><i/><i/></span>; }
function playerStyle(color: number): CSSProperties { return { '--player-color': palette[color] } as CSSProperties; }
function themeName(id: string | null) { return themes.find(theme => theme[0] === id)?.[2] ?? 'Escolhendo tema'; }

export default function OnlinePage() {
  const [credentials, setCredentials] = useState<PlayerCredentials | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  const holding = useRef(false);

  const me = room?.players.find(player => player.id === room.viewer.id) ?? null;
  const starter = room?.players.find(player => player.id === room.starterId) ?? null;
  const impostor = room?.players.find(player => player.id === room.result?.impostorId) ?? null;
  const selectedTheme = useMemo(() => themes.find(theme => theme[0] === room?.themeId), [room?.themeId]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('room')?.toUpperCase().slice(0, 6) ?? '';
    if (requested) { setMode('join'); setJoinCode(requested); }
    try {
      const saved = JSON.parse(localStorage.getItem('faker-online-session') ?? 'null') as PlayerCredentials | null;
      if (saved && (!requested || requested === saved.code)) setCredentials(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const result = await callApi({ action: 'state', ...credentials });
        if (!cancelled) { setRoom(result.room); setError(''); }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'A sala perdeu a conexão.');
      }
    };
    void sync();
    const timer = window.setInterval(sync, 1400);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [credentials]);

  useEffect(() => { setCardVisible(false); holding.current = false; }, [room?.phase, room?.roundNumber]);

  async function enter(action: 'create' | 'join') {
    setBusy(true); setError('');
    try {
      const result = await callApi({ action, name, code: joinCode });
      if (!result.credentials) throw new Error('A sala não devolveu uma sessão válida.');
      localStorage.setItem('faker-online-session', JSON.stringify(result.credentials));
      setCredentials(result.credentials); setRoom(result.room);
      replaceRoomUrl(result.credentials.code);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }

  async function action(actionName: string, extra: Record<string, unknown> = {}) {
    if (!credentials) return null;
    setBusy(true); setError('');
    try {
      const result = await callApi({ action: actionName, ...credentials, ...extra });
      setRoom(result.room); return result.room;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a sala.'); return null; }
    finally { setBusy(false); }
  }

  async function holdStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || me?.ready) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    holding.current = true; setRevealing(true);
    let current = room;
    if (!room?.viewer.card) current = await action('revealCard');
    if (holding.current && current?.viewer.card) setCardVisible(true);
  }

  function holdEnd() { holding.current = false; setRevealing(false); setCardVisible(false); }

  async function copyInvite() {
    if (!room) return;
    await navigator.clipboard.writeText(`${window.location.origin}/online?room=${room.code}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  function forgetRoom() {
    localStorage.removeItem('faker-online-session');
    setCredentials(null); setRoom(null); setError(''); setJoinCode('');
    replaceRoomUrl();
  }

  return <div className="app online-app">
    <header className="topbar">
      <a href="/" className="brand"><img className="brand-mark" src="/brand/faker-mark.svg" alt="" width="40" height="40"/><img className="brand-wordmark" src="/brand/faker-wordmark.svg" alt="FAKER" width="150" height="34"/></a>
      <span className="online-badge"><i/> ONLINE</span>
    </header>

    {!credentials ? <main className="online-entry">
      <a className="back-button" href="/">← Voltar ao jogo presencial</a>
      <div className="eyebrow">SALA ONLINE · CADA UM NO SEU CELULAR</div>
      <h1>ENTRE NA CALL.<br/><span>CONFUNDA TODO MUNDO.</span></h1>
      <p className="theme-intro">Crie uma sala ou entre pelo código. Sem conta, sem instalação.</p>
      <div className="online-tabs" role="tablist">
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Criar sala</button>
        <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Entrar com código</button>
      </div>
      <section className="panel online-entry-panel">
        <label>SEU NOME<input value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="Nome ou apelido" autoComplete="nickname"/></label>
        {mode === 'join' && <label>CÓDIGO DA SALA<input className="code-input" value={joinCode} maxLength={6} onChange={event => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC123" autoCapitalize="characters"/></label>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary online-main-action" disabled={busy || !name.trim() || (mode === 'join' && joinCode.length !== 6)} onClick={() => void enter(mode)}>{busy ? 'CONECTANDO...' : mode === 'create' ? 'CRIAR MINHA SALA' : 'ENTRAR NA SALA'} <span>→</span></button>
      </section>
    </main> : !room ? <main className="online-loading"><Pixel/><h2>ENTRANDO NA SALA...</h2>{error && <><p className="error">{error}</p><button className="next-button" onClick={forgetRoom}>Usar outro código</button></>}</main> : <main className="online-room">
      <div className="room-topline"><button className="back-button" onClick={forgetRoom}>← Sair desta sala</button><span>RODADA {String(room.roundNumber + (room.phase === 'lobby' ? 1 : 0)).padStart(2, '0')}</span></div>
      <section className="room-code-panel">
        <div><small>CÓDIGO DA SALA</small><strong>{room.code}</strong></div>
        <button onClick={() => void copyInvite()}>{copied ? '✓ LINK COPIADO' : 'COPIAR CONVITE'}</button>
      </section>
      {error && <p className="error room-error" role="alert">{error}</p>}

      {room.phase === 'lobby' && <>
        <div className="online-heading"><div><span className="step">01</span><h2>QUEM JÁ CHEGOU</h2></div><span className="count">{room.players.length}/20</span></div>
        <div className="online-roster">{room.players.map(player => <div className="online-player" key={player.id} style={playerStyle(player.color)}><Pixel/><strong>{player.name}</strong>{player.isHost && <span>HOST</span>}</div>)}</div>
        {room.viewer.isHost ? <section className="online-theme-section">
          <div className="online-heading"><div><span className="step">02</span><h2>ESCOLHA O TEMA</h2></div></div>
          <div className="online-theme-grid">{themes.map(theme => <button key={theme[0]} className={room.themeId === theme[0] ? 'selected' : ''} onClick={() => void action('selectTheme', { themeId: theme[0] })}><span>{theme[1]}</span><strong>{theme[2]}</strong><small>{theme[3]}</small></button>)}</div>
          <button className="primary online-main-action" disabled={busy || room.players.length < 3 || !room.themeId} onClick={() => void action('startRound')}>PREPARAR CARTAS <span>→</span></button>
          {room.players.length < 3 && <p className="privacy-note">Faltam {3 - room.players.length} para fechar a turma.</p>}
        </section> : <section className="waiting-panel"><Pixel/><span>O HOST ESTÁ PREPARANDO A RODADA</span><strong>{selectedTheme ? `${selectedTheme[1]} ${selectedTheme[2]}` : 'Escolhendo o tema...'}</strong></section>}
      </>}

      {room.phase === 'cards' && <section className="online-card-stage">
        <div className="eyebrow center">{themeName(room.themeId)} · CARTA INDIVIDUAL</div>
        <div className="turn-avatar" style={playerStyle(me?.color ?? 0)}><Pixel/></div>
        <h1 className="player-title">Sua vez,<br/><span style={playerStyle(me?.color ?? 0)}>{me?.name}!</span></h1>
        <div className={`secret-card ${cardVisible && room.viewer.card ? room.viewer.card.role === 'impostor' ? 'is-impostor' : 'is-player' : ''}`}>
          {cardVisible && room.viewer.card ? <><span className="card-symbol">{room.viewer.card.role === 'impostor' ? '!' : '✦'}</span><span className="card-label">{room.viewer.card.role === 'impostor' ? 'VOCÊ É O IMPOSTOR' : 'VOCÊ SABE A PALAVRA'}</span><small>{room.viewer.card.role === 'impostor' ? 'Sua dica é' : 'A palavra secreta é'}</small><strong className="secret-word">{room.viewer.card.value}</strong><p>{room.viewer.card.role === 'impostor' ? 'Disfarce. Escute. Entre na conversa.' : 'Dê uma pista sem entregar o segredo.'}</p></> : <><div className="card-back-symbol"><Pixel/></div><span className="card-label">SÓ VOCÊ PODE VER</span><p>Segure o controle abaixo para revelar.</p><div className="card-decoration">FAKER / TOP SECRET</div></>}
        </div>
        <button className={`hold-button ${revealing ? 'holding' : ''}`} disabled={Boolean(me?.ready)} onContextMenu={event => event.preventDefault()} onPointerDown={event => void holdStart(event)} onPointerUp={holdEnd} onPointerCancel={holdEnd} onLostPointerCapture={holdEnd} onPointerLeave={holdEnd}>
          <span className="eye-pad"><svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{revealing ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M3 9c4 7 14 7 18 0M5 12l-2 3m7-1-1 4m5-4 1 4m4-6 2 3"/></>}</svg></span>
          <span className="reveal-copy"><strong>{me?.ready ? 'Carta confirmada' : revealing ? 'Segredo revelado' : 'Espiar minha carta'}</strong><small>{me?.ready ? 'Aguarde os outros jogadores' : revealing ? 'Solte para esconder' : 'Pressione e segure para revelar'}</small></span><span className="reveal-led" aria-hidden="true"/>
        </button>
        <button className="primary advance-button" disabled={busy || !room.viewer.card || Boolean(me?.ready) || cardVisible} onClick={() => void action('ready')}>{me?.ready ? '✓ VOCÊ ESTÁ PRONTO' : 'ESTOU PRONTO'} <span>→</span></button>
        <div className="ready-board"><div><strong>{room.players.filter(player => player.ready).length}/{room.players.length}</strong><span>PRONTOS</span></div><div className="ready-dots">{room.players.map(player => <i key={player.id} title={`${player.name}: ${player.ready ? 'pronto' : 'aguardando'}`} className={player.ready ? 'ready' : ''} style={playerStyle(player.color)}/>)}</div></div>
        {room.viewer.isHost && <button className="primary online-main-action" disabled={busy || !room.allReady} onClick={() => void action('startDiscussion')}>INICIAR RODADA <span>▶</span></button>}
        {!room.viewer.isHost && room.allReady && <p className="privacy-note">Todo mundo pronto. Aguardando o host iniciar.</p>}
      </section>}

      {room.phase === 'discussion' && <section className="end-panel online-end-panel"><span className="big-symbol">☷</span><div className="eyebrow center">TODO MUNDO VIU A CARTA</div><h1>HORA DO<br/><span>BLEFE.</span></h1><p>Conversem pela ligação. Cada pessoa fala uma palavra relacionada, sem entregar o segredo.</p><div className="starter"><small>QUEM COMEÇA</small><strong className="colored-name" style={playerStyle(starter?.color ?? 0)}>{starter?.name}</strong><span>Depois, sigam a ordem da chamada.</span></div>{room.viewer.isHost ? <button className="primary full" onClick={() => void action('revealResult')}>REVELAR O FAKER <span>→</span></button> : <div className="waiting-panel compact"><span>O HOST REVELA DEPOIS DA VOTAÇÃO</span></div>}</section>}

      {room.phase === 'result' && room.result && <section className="end-panel online-end-panel"><div className="eyebrow center">O SEGREDO ACABOU</div><h1>ERA <span>{impostor?.name}!</span></h1><div className="result-card"><span className="badge">FAKER</span><strong className="colored-name" style={playerStyle(impostor?.color ?? 0)}>{impostor?.name}</strong><div className="answer-row"><div><small>PALAVRA SECRETA</small><b>{room.result.word}</b></div><div><small>DICA RECEBIDA</small><b>{room.result.hint}</b></div></div></div>{room.viewer.isHost ? <button className="primary full" onClick={() => void action('nextRound')}>NOVA RODADA <span>↻</span></button> : <div className="waiting-panel compact"><span>AGUARDANDO O HOST PREPARAR A PRÓXIMA</span></div>}</section>}
    </main>}
    <footer><span className="footer-brand">FAKER<span> UM DE VOCÊS NÃO SABE.</span></span><span>MODO ONLINE · SALAS TEMPORÁRIAS</span></footer>
  </div>;
}
