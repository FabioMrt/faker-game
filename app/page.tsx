'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { themes } from '../lib/catalog.mjs';
import { createRound } from '../lib/game.mjs';

type Round = ReturnType<typeof createRound>;
type Stage = 'setup' | 'themes' | 'cards' | 'discussion' | 'result';
const palette = ['#ff765e','#60c9e0','#b4a0ef','#a5d36d','#ffd05d','#ef8ebd','#edaa63','#85d5b9','#8aaaf5','#d6b38c','#f69b91','#91b857','#cba4d8','#7bc7c0','#d6bd57','#e88ba1','#98b6c9','#c7d68b','#a3a0de','#e6b5a1'];
function Pixel({className=''}:{className?:string}) { return <span aria-hidden="true" className={'pixel '+className}><i/><i/></span>; }
export default function Home() {
 const [players,setPlayers] = useState<string[]>([]);
 const [colorIds,setColorIds] = useState<Record<string,number>>({});
 const [name,setName] = useState('');
 const [theme,setTheme] = useState('');
 const [stage,setStage] = useState<Stage>('setup');
 const [round,setRound] = useState<Round|null>(null);
 const [index,setIndex] = useState(0);
 const [visible,setVisible] = useState(false);
 const [seen,setSeen] = useState(false);
 const [error,setError] = useState('');
 const [rules,setRules] = useState(false);
 const [confirm,setConfirm] = useState<'exit'|'reveal'|false>(false);
 const [roundNumber,setRoundNumber] = useState(0);
 const input = useRef<HTMLInputElement>(null);
 const hold = useRef<number|string|null>(null);
 const selected = themes.find(t=>t.id===theme);
 function playerStyle(player:string):CSSProperties {return {'--player-color':palette[colorIds[player]??0]} as CSSProperties;}
 function chooseTheme(){hide();setTheme('');setStage('themes');}
 function hide() { hold.current=null; setVisible(false); }
 useEffect(()=>{
   try { const saved=JSON.parse(localStorage.getItem('impostor-players')||'[]'); if(Array.isArray(saved)) {
 const names=saved.filter(n=>typeof n==='string' && n.trim().length>0).slice(0,20);setPlayers(names);
 let stored:Record<string,number>={};try{stored=JSON.parse(localStorage.getItem('impostor-colors')||'{}')||{};}catch{}
 const colors:Record<string,number>={};const used=new Set<number>();
 names.forEach((n:string)=>{const id=stored[n];const next=Number.isInteger(id)&&id>=0&&id<palette.length&&!used.has(id)?id:palette.findIndex((_,i)=>!used.has(i));colors[n]=next;used.add(next);});setColorIds(colors);
 } } catch {}
   const conceal=()=>{hold.current=null;setVisible(false);};
   window.addEventListener('blur',conceal); document.addEventListener('visibilitychange',conceal);
   return ()=>{window.removeEventListener('blur',conceal);document.removeEventListener('visibilitychange',conceal);};
 },[]);
 function savePlayers(next:string[]) {
 const colors:Record<string,number>={};const used=new Set<number>();
 next.forEach(n=>{if(Object.hasOwn(colorIds,n)){colors[n]=colorIds[n];used.add(colors[n]);}});
 next.forEach(n=>{if(!Object.hasOwn(colors,n)){const id=palette.findIndex((_,i)=>!used.has(i));colors[n]=id;used.add(id);}});
 setColorIds(colors);setPlayers(next);
 try{localStorage.setItem('impostor-players',JSON.stringify(next));localStorage.setItem('impostor-colors',JSON.stringify(colors));}catch{}
 }
 function add() {
   const cleaned=name.trim().replace(/\s+/g,' ');
   if(!cleaned) return;
   if(players.some(p=>p.toLocaleLowerCase('pt-BR')===cleaned.toLocaleLowerCase('pt-BR'))) {setError('Esse nome já está na roda. Use um apelido diferente.');return;}
   if(players.length>=20){setError('A roda pode ter até 20 jogadores.');return;}
   savePlayers([...players,cleaned]);setName('');setError('');input.current?.focus();
 }
 function start() {
   if(!selected||players.length<3)return;
   hide();setRound(createRound(players,selected,round?.word));setIndex(0);setSeen(false);setStage('cards');setRoundNumber(n=>n+1);setConfirm(false);
 }
 function next() {hide();setSeen(false);if(round && index+1>=round.players.length)setStage('discussion');else setIndex(i=>i+1);}
 function reveal(key:number|string) {if(hold.current!==null)return;hold.current=key;setVisible(true);setSeen(true);}
 const imp=round?.impostor===index;
 return <div className="app">
  <header className="topbar"><a href="/" className="brand" onClick={e=>{e.preventDefault();if(stage==='setup')return;if(stage==='themes'||stage==='result'){setStage('setup');return;}setConfirm('exit');}}><img className="brand-mark" src="/brand/faker-mark.svg" alt="" width="40" height="40"/><img className="brand-wordmark" src="/brand/faker-wordmark.svg" alt="FAKER" width="150" height="34"/></a><button className="help" onClick={()=>{hide();setRules(true);}}>Como jogar <span>?</span></button></header>
  <main>
   {stage==='setup' ? <>
    <section className="intro"><div className="eyebrow">FALE. BLEFE. NÃO ENTREGUE.</div><h1>TODO MUNDO SABE.<br/><span>UM SÓ DISFARÇA.</span></h1><p>Uma palavra secreta. Um intruso. A sua melhor cara de inocente.</p><div className="mascot-parade" aria-hidden="true"><Pixel/><Pixel/><Pixel/><span className="speech">EU SEI. JURO.</span></div></section>
    <section className="panel players-panel"><div className="section-heading"><div><span className="step">01</span><h2>TIME DE SUSPEITOS</h2></div><span className="count">{players.length}/20</span></div>
      <form onSubmit={e=>{e.preventDefault();add();}} className="add-player"><input ref={input} aria-label="Nome do jogador" placeholder="Manda o nome ou apelido..." maxLength={24} value={name} onChange={e=>{setName(e.target.value);setError('');}} autoComplete="off"/><button aria-label="Adicionar jogador" disabled={!name.trim()||players.length>=20}>+ <span>ADICIONAR</span></button></form>
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="player-list">{players.length ? players.map((p,i)=><div className="player" key={p} style={playerStyle(p)}><Pixel/><span className="player-name"><small>PLAYER {String(i+1).padStart(2,'0')}</small>{p}</span><button aria-label={'Remover '+p} onClick={()=>savePlayers(players.filter((_,j)=>j!==i))}>×</button></div>):<div className="empty"><Pixel/><p>Nenhum suspeito por aqui. Ainda.</p><small>Adicione pelo menos 3 pessoas para jogar.</small></div>}</div>
      <div className="small-note">3–20 jogadores <span>✦</span> Um celular para toda a mesa</div>
    </section>
    <div className="start-bar"><span className="start-hint">{players.length<3?'Faltam '+(3-players.length)+' para fechar a turma.':'Turma reunida. Bora escolher o tema?'}</span><button className="primary" disabled={players.length<3} onClick={chooseTheme}>ESCOLHER TEMA <span>→</span></button></div>
   </> : stage==='themes' ? <section className="theme-screen">
    <button className="back-button" onClick={()=>setStage('setup')}>← Editar jogadores</button>
    <div className="eyebrow">RODADA {String(roundNumber+1).padStart(2,'0')} · {players.length} SUSPEITOS</div><h1>QUAL É A<br/><span>DA VEZ?</span></h1><p className="theme-intro">Escolham o território. A palavra fica por nossa conta.</p>
    <div className="theme-list">{themes.map((t,i)=><button key={t.id} className={'theme '+(theme===t.id?'selected':'')} style={{'--theme-color':palette[i]} as CSSProperties} aria-pressed={theme===t.id} onClick={()=>setTheme(t.id)}><span className="theme-level">MUNDO 0{i+1}</span><span className="theme-icon" aria-hidden="true">{['🕹️','⭐','🏝️','🍕','🐊','🎬','🎲'][i]}</span><strong>{t.name}</strong><small>{t.description}</small><span className="radio">{theme===t.id?'✓ SELECIONADO':'SELECIONAR +'}</span></button>)}</div>
    <div className="start-bar"><span className="start-hint">{selected?selected.name+'? Valendo!':'Escolha um tema para liberar a rodada.'}</span><button className="primary" disabled={!selected||players.length<3} onClick={start}>COMEÇAR RODADA <span>▶</span></button></div>
   </section> : round && <section className="play-area">
     <div className="play-meta"><span>RODADA {String(roundNumber).padStart(2,'0')}</span><span>{round.theme}</span></div>
     {stage==='cards'&&<div className="player-turn" key={roundNumber+'-'+index}>
       <div className="progress">{round.players.map((player:string,i:number)=><span key={i} style={playerStyle(player)} className={i<=index?'filled':''}/>)}</div>
       <p className="eyebrow center" role="status">CARTA {index+1} DE {round.players.length} · VEZ DE {round.players[index]}</p><div className="turn-avatar" style={playerStyle(round.players[index])}><Pixel/></div><h1 className="player-title">Sua vez,<br/><span style={playerStyle(round.players[index])}>{round.players[index]}!</span></h1><p className="play-description">Pegue o celular. Só você pode olhar.</p>
       <div className={'secret-card '+(visible?(imp?'is-impostor':'is-player'):'')} aria-live="off">
         {visible?<><span className="card-symbol">{imp?'!':'✦'}</span><span className="card-label">{imp?'VOCÊ É O IMPOSTOR':'VOCÊ SABE A PALAVRA'}</span><small>{imp?'Sua dica é':'A palavra secreta é'}</small><strong className="secret-word">{imp?round.hint:round.word}</strong><p>{imp?'Disfarce. Escute. Entre na conversa.':'Dê uma pista sem entregar o segredo.'}</p></>:<><div className="card-back-symbol"><Pixel/></div><span className="card-label">SEU SEGREDO ESTÁ AQUI</span><p>Segure o botão abaixo para descobrir.</p><div className="card-decoration">FAKER / TOP SECRET</div></>}
       </div>
       <button className={'hold-button '+(visible?'holding':'')} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);reveal(e.pointerId);}} onPointerUp={hide} onPointerCancel={hide} onLostPointerCapture={hide} onPointerLeave={hide} onBlur={hide} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)reveal(e.key);}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();hide();}}}><span className="eye-pad"><svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{visible?<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>:<><path d="M3 9c4 7 14 7 18 0M5 12l-2 3m7-1-1 4m5-4 1 4m4-6 2 3"/></>}</svg></span><span className="reveal-copy"><strong>{visible?'Segredo revelado':'Espiar minha carta'}</strong><small>{visible?'Solte para esconder':'Pressione e segure para revelar'}</small></span><span className="reveal-led" aria-hidden="true"/></button>
       <button className="primary advance-button" disabled={!seen||visible} onClick={next}>{index===round.players.length-1?'Todos prontos. Vamos jogar!':'Próximo jogador'} <span>→</span></button><p className="privacy-note">Soltou, escondeu. Passe o celular com a carta fechada.</p>
     </div>}
     {stage==='discussion'&&<div className="end-panel"><span className="big-symbol">☷</span><p className="eyebrow center">AGORA É NO OLHO NO OLHO</p><h1>Quem está<br/><span>disfarçando?</span></h1><p>Todos viram suas cartas. Cada pessoa fala uma palavra relacionada, sem revelar o segredo.</p><div className="starter"><small>QUEM COMEÇA</small><strong style={playerStyle(round.players[round.starter])} className="colored-name">{round.players[round.starter]}</strong><span>Depois, sigam em volta da mesa.</span></div><p>Conversem e votem em voz alta. Só revelem o impostor depois que todos decidirem!</p><button className="primary full" onClick={()=>setConfirm('reveal')}>Revelar o impostor <span>→</span></button></div>}
     {stage==='result'&&<div className="end-panel"><p className="eyebrow center">O SEGREDO ACABOU</p><h1>Era <span>{round.players[round.impostor]}!</span></h1><p>Conseguiu enganar a mesa?</p><div className="result-card"><span className="badge">IMPOSTOR</span><strong style={playerStyle(round.players[round.impostor])} className="colored-name">{round.players[round.impostor]}</strong><div className="answer-row"><div><small>PALAVRA SECRETA</small><b>{round.word}</b></div><div><small>DICA RECEBIDA</small><b>{round.hint}</b></div></div></div><button className="primary full" onClick={chooseTheme}>Jogar outra rodada <span>↻</span></button><button className="next-button" onClick={()=>setStage('setup')}>Editar jogadores</button><p className="privacy-note">Mesma turma. Escolham o próximo tema!</p></div>}
   </section>}
  </main>
  <footer><span className="footer-brand">FAKER<span> UM DE VOCÊS NÃO SABE.</span></span><span>UM CELULAR. A MESA INTEIRA.</span></footer>
  {rules&&<div className="modal-backdrop" onClick={()=>setRules(false)}><section role="dialog" aria-modal="true" aria-labelledby="rules-title" className="modal" onClick={e=>e.stopPropagation()}><button className="close" aria-label="Fechar regras" autoFocus onClick={()=>setRules(false)}>×</button><span className="eyebrow">RÁPIDO DE APRENDER</span><h2 id="rules-title">Como jogar</h2><ol><li>Cadastrem os jogadores e escolham um tema.</li><li>Passem o celular. Cada pessoa segura o botão para ver sua carta em segredo.</li><li>Todos recebem a mesma palavra, menos um: o impostor recebe apenas uma dica de uma palavra.</li><li>Cada pessoa fala uma palavra relacionada. O impostor tenta se misturar.</li><li>Votem em voz alta e revelem o impostor. Se a mesa acertar, ela vence; se errar, o impostor vence!</li></ol><button className="primary full" onClick={()=>setRules(false)}>Entendi, vamos jogar</button></section></div>}
  {confirm&&<div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="modal"><h2 id="confirm-title">{confirm==='reveal'?'Todos já votaram?':'Voltar ao início?'}</h2><p>{confirm==='reveal'?'A próxima tela revela o impostor, a palavra e a dica.':'A rodada atual será encerrada. Os nomes dos jogadores serão mantidos.'}</p><button className="primary full" onClick={()=>{hide();setConfirm(false);setStage(confirm==='reveal'?'result':'setup');}}>{confirm==='reveal'?'Sim, revelar impostor':'Encerrar rodada'}</button><button className="next-button" autoFocus onClick={()=>setConfirm(false)}>Continuar {confirm==='reveal'?'discutindo':'jogando'}</button></section></div>}
 </div>;
}

