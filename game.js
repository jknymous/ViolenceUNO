/* ============================================================
   UNO CHAOS — GAME.JS v3
   ============================================================ */

// ── DATA ─────────────────────────────────────────────────────

const CHAOS_RULES_DEF = [
  { id: 'rule7', name: '7-SWAP', desc: 'Play a 7 → swap hand with any player.', def: true },
  { id: 'rule0', name: '0-ROTATE', desc: 'Play a 0 → all hands rotate in current direction.', def: true },
  { id: 'jumpIn', name: 'JUMP-IN', desc: 'Play an identical card out of turn to steal the round.', def: false },
  { id: 'stackPlus', name: 'STACK +2/+4', desc: 'Stack Draw cards — total passes forward.', def: true },
  { id: 'progressive', name: 'PROGRESSIVE UNO', desc: 'Keep stacking until someone can\'t — they draw it all.', def: false },
  { id: 'noBluff', name: 'NO-BLUFF +4', desc: 'Wild+4 playable anytime, no color restriction.', def: false },
];

const ULTIS_DEF = [
  { id: 'ghost', name: 'GHOST PROTOCOL', type: 'PASSIVE', icon: '👻', charge: 0, passive: true, desc: 'Your card count shows as "?" to opponents.' },
  { id: 'firewall', name: 'FIREWALL', type: 'PASSIVE', icon: '🛡️', charge: 0, passive: true, desc: 'Once per game, auto-block a +2 or +4 aimed at you.' },
  { id: 'datamirror', name: 'DATA MIRROR', type: 'PASSIVE', icon: '🔮', charge: 0, passive: true, desc: 'You can always see the top 2 cards of the draw pile.' },
  { id: 'hack', name: 'SYSTEM HACK', type: 'ACTIVE', icon: '💀', charge: 3, passive: false, desc: 'Force a target player to draw 2 extra cards.' },
  { id: 'reboot', name: 'REBOOT', type: 'ACTIVE', icon: '🔄', charge: 2, passive: false, desc: 'Discard your hand, draw the same number fresh.' },
  { id: 'emp', name: 'EMP BLAST', type: 'ACTIVE', icon: '⚡', charge: 1, passive: false, desc: 'Skip all other players for one full rotation.' },
  { id: 'neuralsync', name: 'NEURAL SYNC', type: 'ACTIVE', icon: '🧠', charge: 2, passive: false, desc: 'Swap your hand with any chosen player.' },
  { id: 'overclock', name: 'OVERCLOCK', type: 'ACTIVE', icon: '⏩', charge: 3, passive: false, desc: 'Play up to 2 cards on your next turn.' },
];

// ── SHARED STATE ─────────────────────────────────────────────
let G = {};
let setupData = {
  playerNames: ['PLAYER_1', 'PLAYER_2', 'PLAYER_3', 'PLAYER_4'],
  chaosRules: {},
  playerUltis: {},
};

// ── UTILS ─────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getUltiDef(id) { return ULTIS_DEF.find(u => u.id === id); }
function cardLabel(c) { return c ? `${c.color.toUpperCase()} ${c.value.toUpperCase()}` : ''; }
function isModalOpen() {
  return document.getElementById('color-overlay')?.classList.contains('show') ||
    document.getElementById('swap-overlay')?.classList.contains('show');
}

// ── DECK ─────────────────────────────────────────────────────
function createDeck(n) {
  const copies = n <= 3 ? 1 : n <= 6 ? 2 : 3;
  const colors = ['red', 'blue', 'green', 'yellow'];
  const deck = [];
  for (let d = 0; d < copies; d++) {
    colors.forEach(col => {
      deck.push({ color: col, value: '0', type: 'number' });
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(v => {
        deck.push({ color: col, value: v, type: 'number' });
        deck.push({ color: col, value: v, type: 'number' });
      });
      ['skip', 'reverse', '+2'].forEach(v => {
        deck.push({ color: col, value: v, type: 'special' });
        deck.push({ color: col, value: v, type: 'special' });
      });
    });
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value: 'wild', type: 'wild' });
      deck.push({ color: 'wild', value: '+4', type: 'wild4' });
    }
  }
  return shuffle(deck);
}

// ── GAME START ───────────────────────────────────────────────
function startGame() {
  const inputs = document.querySelectorAll('#player-list input');
  if (inputs.length) inputs.forEach((inp, i) => {
    setupData.playerNames[i] = inp.value.trim().toUpperCase() || `PLAYER_${i + 1}`;
  });
  setupData.playerNames.forEach((_, i) => {
    if (!setupData.playerUltis[i]) setupData.playerUltis[i] = ULTIS_DEF[i % ULTIS_DEF.length].id;
  });

  G = {
    players: setupData.playerNames.map((name, i) => ({
      name, hand: [], isHuman: i === 0,
      ulti: setupData.playerUltis[i] || ULTIS_DEF[0].id,
    })),
    deck: [], discard: [], currentPlayer: 0, direction: 1,
    turn: 1, drawStack: 0, currentColor: null,
    chaosRules: { ...setupData.chaosRules },
    ultiCharges: {}, firewallUsed: new Set(),
    humanCalledUno: false,   // player 0 pressed UNO button
    unoPenaltyTimer: null,   // 2s countdown after playing to 1 card
    tokens: 0, actionLock: false, pendingCB: null,
  };

  G.players.forEach((_, i) => {
    const d = getUltiDef(G.players[i].ulti);
    G.ultiCharges[i] = d ? d.charge : 0;
  });

  G.deck = createDeck(G.players.length);
  G.players.forEach(p => { for (let k = 0; k < 7; k++) p.hand.push(G.deck.pop()); });

  let first;
  do { first = G.deck.pop(); } while (first.type === 'wild' || first.type === 'wild4');
  G.discard.push(first);
  G.currentColor = first.color;

  showScreen('game');
  renderGame();
  gameLog(`GAME START — ${G.players.length} PLAYERS`, 'hi');
  gameLog(`FIRST CARD: ${cardLabel(first)}`, 'hi');

  if (G.currentPlayer !== 0) scheduleBotTurn();
}

// ── RENDER ───────────────────────────────────────────────────
function renderGame() {
  renderOpponents();
  renderCenter();
  renderHand();
  renderUltiHud();
  updateHud();
}

// Opponents in a circle arc across the top
function renderOpponents() {
  const area = document.getElementById('table-area');
  area.querySelectorAll('.opp-seat').forEach(el => el.remove());

  const opps = G.players.filter((_, i) => i !== 0);
  const total = opps.length;
  if (!total) return;

  const W = area.offsetWidth || window.innerWidth;
  const H = area.offsetHeight || window.innerHeight * 0.6;
  const cx = W / 2;
  const cy = H / 2;

  // Arc: spread from 195° to 345°, ellipse radii
  const rx = Math.min(cx * 0.75, 300);
  const ry = Math.min(cy * 0.78, 210);
  const startDeg = 195, endDeg = 345;
  const step = total === 1 ? 0 : (endDeg - startDeg) / (total - 1);

  opps.forEach((p, idx) => {
    const realIdx = idx + 1;
    const deg = startDeg + idx * step;
    const rad = (deg * Math.PI) / 180;
    const x = cx + rx * Math.cos(rad);
    const y = cy + ry * Math.sin(rad);

    const seat = document.createElement('div');
    seat.className = 'opp-seat';
    seat.style.left = `${x}px`;
    seat.style.top = `${y}px`;
    seat.style.transform = 'translate(-50%,-50%)';

    const isGhosted = getUltiDef(p.ulti)?.id === 'ghost';
    const count = isGhosted ? '?' : p.hand.length;
    const isActive = realIdx === G.currentPlayer;
    const ultiDef = getUltiDef(p.ulti);

    // Mini circular fan
    const fc = Math.min(p.hand.length, 8);
    const span = Math.min(60, fc * 9);
    let fanHTML = `<div class="opp-fan">`;
    for (let f = 0; f < fc; f++) {
      const rot = fc <= 1 ? 0 : -span / 2 + f * (span / (fc - 1));
      fanHTML += `<div class="opp-mini-card" style="transform:translateX(-50%) rotate(${rot}deg);margin-left:27px"></div>`;
    }
    fanHTML += `</div>`;

    seat.innerHTML = `
      ${fanHTML}
      <div class="opp-avatar${isActive ? ' active-turn' : ''}">
        ${p.name.slice(0, 2)}
        <div class="opp-badge">${count}</div>
      </div>
      <div class="opp-name-lbl">${p.name}</div>
      <div class="opp-ulti-lbl">${ultiDef?.icon || ''} ${ultiDef?.name || ''}</div>
    `;
    area.appendChild(seat);
  });
}

function renderCenter() {
  const top = G.discard[G.discard.length - 1];

  // Discard
  const dp = document.getElementById('discard-pile');
  dp.innerHTML = '';
  if (top) dp.appendChild(buildCardEl(top, false, true));

  // Draw pile
  const drawEl = document.getElementById('draw-pile');
  drawEl.innerHTML = '';
  drawEl.appendChild(buildDeckCardEl());

  // Direction
  document.getElementById('dir-badge').textContent = G.direction === 1 ? '↻' : '↺';

  // Color dot
  const colorMap = { red: '#ee1133', blue: '#0077ee', green: '#00bb44', yellow: '#ffcc00' };
  const col = G.currentColor || top?.color || 'blue';
  const dot = document.getElementById('color-dot');
  dot.style.background = colorMap[col] || '#0077ee';
  dot.style.boxShadow = `0 0 14px ${colorMap[col] || '#0077ee'}`;
  document.getElementById('color-name').textContent = col.toUpperCase();
}

// ── HAND as circular fan ─────────────────────────────────────
function renderHand() {
  const human = G.players[0];
  const isMyTurn = G.currentPlayer === 0 && !G.actionLock;
  const container = document.getElementById('fan-container');
  container.innerHTML = '';

  // Push entire player area up to clear taskbar
  const handArea = document.getElementById('player-hand-area');
  if (handArea) handArea.style.bottom = getBottomOffset() + 'px';

  document.getElementById('player-name-lbl').textContent = human.name;
  document.getElementById('turn-status').innerHTML = isMyTurn
    ? `<span class="turn-badge">YOUR TURN</span>`
    : `<span class="wait-badge">WAITING...</span>`;

  const count = human.hand.length;
  if (count === 0) { container.style.height = '30px'; return; }

  const style = getComputedStyle(document.documentElement);
  const cardW = parseInt(style.getPropertyValue('--cw')) || 68;
  const cardH = parseInt(style.getPropertyValue('--ch')) || 100;

  // Container = exactly card height. Cards sit at bottom:0, fan upward.
  container.style.height = `${cardH}px`;
  container.style.overflow = 'visible';

  const containerW = container.offsetWidth || window.innerWidth;
  const totalAngle = Math.min(90, count * 7);
  const startAngle = -totalAngle / 2;
  const angleStep = count <= 1 ? 0 : totalAngle / (count - 1);

  // Overlap-based spread like real cards in hand
  const overlapStep = Math.min(cardW * 0.54, 42);
  const totalSpread = cardW + (count - 1) * overlapStep;
  const maxSpread = Math.min(containerW * 0.84, totalSpread);
  const xStart = (containerW - maxSpread) / 2;
  const xStep = count <= 1 ? 0 : maxSpread / (count - 1);

  human.hand.forEach((card, idx) => {
    const canP = isMyTurn && canPlay(card);
    const el = buildCardEl(card, canP, false);
    const angle = startAngle + idx * angleStep;
    const xPos = xStart + idx * xStep;

    el.style.position = 'absolute';
    el.style.left = `${xPos}px`;
    el.style.bottom = '0px';
    el.style.transform = `rotate(${angle}deg)`;
    el.style.transformOrigin = 'bottom center';
    el.style.zIndex = idx + 1;
    el.style.setProperty('--base-transform', `rotate(${angle}deg)`);

    if (canP) {
      el.addEventListener('mouseenter', () => {
        el.style.transform = `rotate(${angle}deg) translateY(-18px) scale(1.08)`;
        el.style.zIndex = 200;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = `rotate(${angle}deg)`;
        el.style.zIndex = idx + 1;
      });
      el.addEventListener('click', () => handleCardClick(idx, el, angle));
    }
    container.appendChild(el);
  });


  // Buttons
  document.getElementById('draw-btn').disabled = !isMyTurn;
  const ultiDef = getUltiDef(human.ulti);
  const hasCharge = !ultiDef?.passive && G.ultiCharges[0] > 0;
  const ultiBtn = document.getElementById('ulti-btn');
  ultiBtn.disabled = !isMyTurn || !hasCharge;
  ultiBtn.textContent = ultiDef ? `⚡ ${ultiDef.name}` : '⚡ ULTI';

  // ── UNO BUTTON ──
  // Show only on player's OWN turn when hand==2 and hasn't called UNO yet.
  // One press = registered, button disappears immediately.
  const unoBtn = document.getElementById('uno-btn');
  const needsUno = isMyTurn && human.hand.length === 2 && !G.humanCalledUno;
  unoBtn.classList.toggle('show', needsUno);
}

function handleCardClick(idx, el, angle) {
  if (G.actionLock) return;
  G.actionLock = true;

  // --- Get positions BEFORE touching the DOM ---
  const cardRect = el.getBoundingClientRect();
  const discardEl = document.getElementById('discard-pile');
  const discardRect = discardEl ? discardEl.getBoundingClientRect() : null;

  // Build a floating clone that lives on <body> so renderGame() can't delete it
  const clone = el.cloneNode(true);
  clone.style.cssText = `
    position:fixed;
    left:${cardRect.left}px;
    top:${cardRect.top}px;
    width:${cardRect.width}px;
    height:${cardRect.height}px;
    margin:0; z-index:9999;
    pointer-events:none;
    transform:rotate(${angle}deg);
    transform-origin:bottom center;
    transition:none;
  `;
  document.body.appendChild(clone);

  // Hide the original immediately so it doesn't double-render
  el.style.visibility = 'hidden';

  // Compute fly vector (clone is fixed-positioned, so use viewport coords directly)
  let flyX = 0, flyY = -200, flyRot = -angle;
  if (discardRect) {
    const discardCX = discardRect.left + discardRect.width / 2;
    const discardCY = discardRect.top + discardRect.height / 2;
    const cloneCX = cardRect.left + cardRect.width / 2;
    const cloneCY = cardRect.top + cardRect.height / 2;
    flyX = discardCX - cloneCX;
    flyY = discardCY - cloneCY;
    flyRot = -angle;
  }

  // Animate clone via Web Animations API (precise, doesn't need CSS class tricks)
  const anim = clone.animate([
    { transform: `rotate(${angle}deg) scale(1)`, opacity: 1 },
    { transform: `rotate(${angle}deg) scale(1.12) translateY(-14px)`, opacity: 1, offset: 0.25 },
    {
      transform: `translate(${flyX}px, ${flyY}px) rotate(${flyRot}deg) scale(0.9)`,
      opacity: 0.1
    }
  ], {
    duration: 420,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'forwards'
  });

  anim.onfinish = () => {
    clone.remove();
    G.actionLock = false;
    playCard(0, idx);   // state update + renderGame() fires here
  };
}

function renderUltiHud() {
  const human = G.players[0];
  const ultiDef = getUltiDef(human.ulti);
  const hud = document.getElementById('ulti-hud');
  if (!ultiDef) { hud.innerHTML = ''; return; }
  if (ultiDef.passive) {
    hud.innerHTML = `${ultiDef.icon} <span style="color:var(--purple)">${ultiDef.name}</span> <span style="font-size:9px;color:var(--dim)">PASSIVE</span>`;
  } else {
    const charges = G.ultiCharges[0] || 0;
    const pips = Array.from({ length: ultiDef.charge }, (_, i) =>
      `<div class="pip${i < charges ? ' filled' : ''}"></div>`
    ).join('');
    hud.innerHTML = `${ultiDef.icon} <span style="color:var(--purple)">${ultiDef.name}</span><div class="charge-pips">${pips}</div>`;
  }
}

function updateHud() {
  document.getElementById('hdr-turn').textContent = G.turn;
  document.getElementById('hdr-deck').textContent = G.deck.length;
  document.getElementById('token-count').textContent = G.tokens;
}

// ── CARD BUILDERS ─────────────────────────────────────────────
const SPECIAL_SYM = { skip: '⊘', reverse: '⇌', '+2': '+2', wild: '★', '+4': '+4' };

function buildCardEl(card, playable, isDiscard) {
  const el = document.createElement('div');

  // Face-down card (opponent cards in online mode, or deck placeholder)
  // ONLY treat as back if explicitly marked — never treat real 'wild' cards as back
  if (!card || card.type === 'back' || card.color === 'back') {
    el.className = 'card deck no-hover';
    el.innerHTML = `<div class="card-face">
      <div class="card-val" style="font-size:12px;color:var(--cyan);
        -webkit-text-fill-color:var(--cyan);text-shadow:0 0 10px var(--cyan)">UNO</div>
    </div>`;
    return el;
  }

  const val = SPECIAL_SYM[card.value] ?? card.value;
  const sm = card.type !== 'number';
  el.className = ['card', card.color,
    playable ? 'playable' : (!isDiscard ? 'unplayable' : ''),
    isDiscard ? 'no-hover' : '',
  ].filter(Boolean).join(' ');
  el.innerHTML = `<div class="card-face">
    <div class="card-corner tl">${val}</div>
    <div class="card-val${sm ? ' sm' : ''}">${val}</div>
    <div class="card-corner br">${val}</div>
  </div>`;
  // discard card: static size, no absolute
  if (isDiscard) {
    el.style.position = 'relative';
    el.style.width = 'var(--cw)';
    el.style.height = 'var(--ch)';
    el.style.cursor = 'default';
  }
  return el;
}

function buildDeckCardEl() {
  const el = document.createElement('div');
  el.className = 'card deck';
  el.style.position = 'relative';
  el.style.width = 'var(--cw)';
  el.style.height = 'var(--ch)';
  el.style.cursor = 'pointer';
  el.innerHTML = `<div class="card-face">
    <div class="card-val" style="font-size:12px;color:var(--cyan);-webkit-text-fill-color:var(--cyan);text-shadow:0 0 10px var(--cyan)">UNO</div>
  </div>`;
  el.addEventListener('mouseenter', () => { el.style.transform = 'translateY(-8px)'; });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  el.addEventListener('click', () => { if (G.currentPlayer === 0 && !G.actionLock) playerDraw(); });
  return el;
}

// ── LEGALITY ─────────────────────────────────────────────────
function canPlay(card) {
  if (isModalOpen()) return false;
  if (card.type === 'wild') return true;
  if (card.type === 'wild4') return G.chaosRules.noBluff ||
    !G.players[G.currentPlayer].hand.some(c => c.color === G.currentColor);
  if (G.drawStack > 0 && G.chaosRules.stackPlus)
    return card.value === '+2' || card.type === 'wild4';
  const top = G.discard[G.discard.length - 1];
  return card.color === G.currentColor || card.value === top.value;
}

// ── DRAW ─────────────────────────────────────────────────────
function drawCards(pidx, count, silent = false) {
  const p = G.players[pidx];
  for (let i = 0; i < count; i++) {
    if (G.deck.length === 0) reshuffleDeck();
    if (G.deck.length > 0) p.hand.push(G.deck.pop());
  }
  if (!silent) gameLog(`${p.name} DRAWS ${count}`, 'warn');
}

function reshuffleDeck() {
  if (G.discard.length <= 1) return;
  const top = G.discard.pop();
  G.deck = shuffle(G.discard);
  G.discard = [top];
  gameLog('DECK RESHUFFLED', 'hi');
}

// ── TURN FLOW ─────────────────────────────────────────────────
function nextPlayerIdx() {
  return (G.currentPlayer + G.direction + G.players.length) % G.players.length;
}

function advanceTurn(skip = false) {
  // Clear any pending UNO penalty timer from previous turn
  if (G.unoPenaltyTimer) { clearTimeout(G.unoPenaltyTimer); G.unoPenaltyTimer = null; }
  let next = nextPlayerIdx();
  if (skip) {
    gameLog(`${G.players[next].name} SKIPPED`, 'warn');
    next = (next + G.direction + G.players.length) % G.players.length;
  }
  G.currentPlayer = next;
  G.turn++;

  // Reset human UNO call flag at the start of each new round of turns
  // (only reset when it's back to human's turn so the flag survives bot turns)
  if (G.currentPlayer === 0) G.humanCalledUno = false;

  renderGame();

  if (G.currentPlayer !== 0) {
    G.actionLock = true;
    scheduleBotTurn();
  } else {
    G.actionLock = false;
  }
}

// ── PLAY CARD ─────────────────────────────────────────────────
function playCard(pidx, cidx) {
  if (G.actionLock && pidx === 0) return;
  const player = G.players[pidx];
  const card = player.hand[cidx];
  if (!canPlay(card)) {
    if (pidx === 0) toast('CANNOT PLAY THAT CARD', 'danger');
    return;
  }

  player.hand.splice(cidx, 1);
  G.discard.push(card);
  if (card.color !== 'wild') G.currentColor = card.color;
  gameLog(`${player.name} PLAYS ${cardLabel(card)}`, pidx === 0 ? 'hi' : '');

  if (player.hand.length === 0) {
    setTimeout(() => showWin(player.name), 400);
    return;
  }

  // If human just dropped to 1 card without calling UNO first,
  // give a 2-second grace window — after that, +2 penalty
  if (pidx === 0 && player.hand.length === 1 && !G.humanCalledUno) {
    G.unoPenaltyTimer = setTimeout(() => {
      // Only penalise if they STILL haven't called and still have 1 card
      if (!G.humanCalledUno && G.players[0].hand.length === 1) {
        gameLog(`${G.players[0].name} FORGOT UNO! +2 PENALTY`, 'bad');
        toast('FORGOT UNO! +2 CARDS', 'danger');
        drawCards(0, 2, true);
        G.humanCalledUno = true; // prevent double penalty
        renderGame();
      }
    }, 2000);
  }

  // Chaos 7 — only the player who played the 7 picks the target
  if (G.chaosRules.rule7 && card.value === '7') {
    const doSwap = (tidx) => {
      [G.players[pidx].hand, G.players[tidx].hand] =
        [G.players[tidx].hand, G.players[pidx].hand];
      gameLog(`${player.name} SWAPPED WITH ${G.players[tidx].name}`, 'hi');
      resolveEffect(card, pidx, () => advanceTurn());
    };
    if (player.isHuman) {
      // Human picks via modal
      openSwapModal(pidx, '7-SWAP — CHOOSE TARGET', doSwap, pidx);
    } else {
      // Bot auto-picks player with fewest cards
      let bestIdx = -1, bestCount = Infinity;
      G.players.forEach((p, i) => {
        if (i === pidx) return;
        if (p.hand.length < bestCount) { bestCount = p.hand.length; bestIdx = i; }
      });
      if (bestIdx !== -1) doSwap(bestIdx);
      else resolveEffect(card, pidx, () => advanceTurn());
    }
    return;
  }

  // Chaos 0
  if (G.chaosRules.rule0 && card.value === '0') {
    const saved = G.players.map(p => [...p.hand]);
    G.players.forEach((p, i) => {
      p.hand = saved[(i - G.direction + G.players.length) % G.players.length];
    });
    gameLog('0-ROTATE: ALL HANDS ROTATED!', 'hi');
    resolveEffect(card, pidx, () => advanceTurn());
    return;
  }

  resolveEffect(card, pidx, () => advanceTurn());
}

function resolveEffect(card, pidx, done) {
  if (card.type === 'wild' || card.type === 'wild4') {
    const afterColor = (color) => {
      G.currentColor = color;
      gameLog(`${G.players[pidx].name} CHOSE ${color.toUpperCase()}`, 'hi');
      if (card.type === 'wild4') {
        if (G.chaosRules.stackPlus) {
          G.drawStack += 4;
          gameLog(`+4 STACKED — TOTAL: ${G.drawStack}`, 'bad');
          done();
        } else {
          const next = nextPlayerIdx();
          tryFirewall(next, 4,
            () => { drawCards(next, 4); advanceTurn(true); },
            () => { advanceTurn(true); }
          );
        }
      } else { done(); }
    };
    if (pidx === 0) {
      openColorModal(afterColor);
    } else {
      const cols = ['red', 'blue', 'green', 'yellow'];
      const counts = {};
      cols.forEach(c => { counts[c] = G.players[pidx].hand.filter(h => h.color === c).length; });
      const best = cols.reduce((a, b) => counts[a] >= counts[b] ? a : b);
      afterColor(best);
    }
    return;
  }

  if (card.value === 'skip') { done = () => advanceTurn(true); }
  if (card.value === 'reverse') {
    G.direction *= -1;
    gameLog('DIRECTION REVERSED!', 'hi');
    if (G.players.length === 2) done = () => advanceTurn(true);
  }
  if (card.value === '+2') {
    if (G.chaosRules.stackPlus) {
      G.drawStack += 2;
      gameLog(`+2 STACKED — TOTAL: ${G.drawStack}`, 'bad');
    } else {
      const next = nextPlayerIdx();
      tryFirewall(next, 2,
        () => { drawCards(next, 2); advanceTurn(true); },
        () => { advanceTurn(true); }
      );
      return;
    }
  }
  done();
}

function tryFirewall(pidx, amount, onHit, onBlock) {
  const u = getUltiDef(G.players[pidx].ulti);
  if (u?.id === 'firewall' && !G.firewallUsed.has(pidx)) {
    G.firewallUsed.add(pidx);
    toast(`${G.players[pidx].name} FIREWALL!`, 'purple');
    gameLog(`${G.players[pidx].name} BLOCKED ${amount} WITH FIREWALL`, 'vip');
    onBlock();
  } else {
    onHit();
  }
}

// ── HUMAN ACTIONS ─────────────────────────────────────────────
function playerDraw() {
  if (G.currentPlayer !== 0 || G.actionLock) return;
  if (G.drawStack > 0) {
    const total = G.drawStack; G.drawStack = 0;
    tryFirewall(0, total,
      () => drawCards(0, total),
      () => gameLog(`FIREWALL BLOCKS ${total}`, 'vip')
    );
    G.actionLock = true;
    setTimeout(() => { G.actionLock = false; advanceTurn(); }, 500);
    return;
  }
  drawCards(0, 1, true);
  gameLog(`${G.players[0].name} DRAWS 1`, 'warn');
  const drew = G.players[0].hand.at(-1);
  if (canPlay(drew)) toast('DREW — YOU CAN PLAY IT!', '');
  renderGame();
  G.actionLock = true;
  setTimeout(() => { G.actionLock = false; advanceTurn(); }, 600);
}

// ── UNO CALL ─────────────────────────────────────────────────
function callUno() {
  // Clear penalty timer — player called in time
  if (G.unoPenaltyTimer) { clearTimeout(G.unoPenaltyTimer); G.unoPenaltyTimer = null; }
  G.humanCalledUno = true;
  toast('UNO!!!', 'danger');
  gameLog(`${G.players[0].name} CALLS UNO!`, 'bad');
  document.getElementById('uno-btn').classList.remove('show');
}

// ── ULTI ─────────────────────────────────────────────────────
function useUlti() {
  if (G.currentPlayer !== 0 || G.actionLock) return;
  const pidx = 0;
  const player = G.players[pidx];
  const def = getUltiDef(player.ulti);
  if (!def || def.passive) return;
  if (G.ultiCharges[pidx] <= 0) return toast('NO CHARGES LEFT', 'danger');
  G.ultiCharges[pidx]--;
  G.actionLock = true;

  switch (def.id) {
    case 'hack':
      openSwapModal(pidx, '💀 HACK — TARGET PLAYER', (tidx) => {
        drawCards(tidx, 2);
        toast(`HACKED ${G.players[tidx].name}!`, 'purple');
        gameLog(`${player.name} HACKED ${G.players[tidx].name} (+2)`, 'vip');
        G.actionLock = false; renderGame();
      }, pidx); break;

    case 'reboot': {
      const n = player.hand.length; player.hand = [];
      drawCards(pidx, n, true);
      toast('SYSTEM REBOOT!', 'purple');
      gameLog(`${player.name} REBOOTED — ${n} NEW CARDS`, 'vip');
      G.actionLock = false; renderGame(); break;
    }

    case 'emp': {
      const skips = G.players.length - 1;
      G.currentPlayer = (G.currentPlayer + G.direction * skips + G.players.length * 100) % G.players.length;
      toast('⚡ EMP — ALL SKIPPED!', 'purple');
      gameLog(`${player.name} EMP BLASTED EVERYONE`, 'vip');
      G.actionLock = false; renderGame(); break;
    }

    case 'neuralsync':
      openSwapModal(pidx, '🧠 NEURAL SYNC — SWAP HANDS', (tidx) => {
        [G.players[pidx].hand, G.players[tidx].hand] =
          [G.players[tidx].hand, G.players[pidx].hand];
        toast(`SYNCED WITH ${G.players[tidx].name}!`, 'purple');
        gameLog(`${player.name} SYNCED WITH ${G.players[tidx].name}`, 'vip');
        G.actionLock = false; renderGame();
      }, pidx); break;

    case 'overclock':
      toast('⏩ OVERCLOCK — PLAY 2 CARDS!', 'purple');
      gameLog(`${player.name} OVERCLOCK ACTIVE`, 'vip');
      G.actionLock = false; renderGame(); break;

    default: G.actionLock = false;
  }
}

// ── BOT AI ───────────────────────────────────────────────────
function scheduleBotTurn() { setTimeout(botTurn, 700 + Math.random() * 500); }

function botTurn() {
  if (G.currentPlayer === 0) { G.actionLock = false; return; }
  const pidx = G.currentPlayer;
  const player = G.players[pidx];

  // Bots don't need UNO tracking — only human gets the penalty timer

  // Resolve draw stack
  if (G.drawStack > 0 && G.chaosRules.stackPlus) {
    const stacker = player.hand.find(c => c.value === '+2' || c.type === 'wild4');
    if (stacker) {
      const ci = player.hand.indexOf(stacker);
      G.actionLock = false; playCard(pidx, ci); return;
    }
    const total = G.drawStack; G.drawStack = 0;
    tryFirewall(pidx, total, () => drawCards(pidx, total), () => { });
    G.actionLock = false; setTimeout(advanceTurn, 500); return;
  }

  const playable = player.hand
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => canPlay(c));

  if (playable.length > 0) {
    const prio = c =>
      c.value === 'skip' || c.value === 'reverse' ? 3 :
        c.value === '+2' ? 2 :
          c.type === 'wild4' ? 1 :
            c.type === 'wild' ? 0 : -1;
    playable.sort((a, b) => prio(b.c) - prio(a.c));
    G.actionLock = false; playCard(pidx, playable[0].i);
  } else {
    drawCards(pidx, 1, true);
    gameLog(`${player.name} DRAWS`, 'warn');
    const drew = player.hand.at(-1);
    if (canPlay(drew)) {
      G.actionLock = false;
      setTimeout(() => playCard(pidx, player.hand.length - 1), 400);
    } else {
      G.actionLock = false; setTimeout(advanceTurn, 500);
    }
  }
}

// ── WIN ───────────────────────────────────────────────────────
function showWin(name) {
  document.getElementById('win-name').textContent = name;
  showScreen('win');
  gameLog(`🏆 ${name} WINS!`, 'hi');
}

// ── LOG (right panel) ────────────────────────────────────────
const logHistory = [];
function gameLog(msg, type = '') {
  logHistory.push({ msg, type });
  if (logHistory.length > 40) logHistory.shift();
  const body = document.getElementById('log-body');
  if (!body) return;
  body.innerHTML = '';
  logHistory.slice(-20).forEach(({ msg: m, type: t }) => {
    const el = document.createElement('div');
    el.className = `log-entry ${t}`;
    el.textContent = `› ${m}`;
    body.appendChild(el);
  });
  body.scrollTop = body.scrollHeight;
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = '') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ── MODALS ───────────────────────────────────────────────────
function openColorModal(cb) {
  G.pendingCB = cb;
  document.getElementById('color-overlay').classList.add('show');
}
window.pickColor = function (color) {
  document.getElementById('color-overlay').classList.remove('show');
  if (G.pendingCB) { G.pendingCB(color); G.pendingCB = null; }
};

function openSwapModal(fromIdx, title, cb, excludeIdx) {
  G.pendingCB = cb;
  document.getElementById('swap-title').textContent = `// ${title}`;
  const list = document.getElementById('swap-list');
  list.innerHTML = '';
  G.players.forEach((p, i) => {
    if (i === excludeIdx) return;
    const btn = document.createElement('button');
    btn.className = 'target-btn';
    btn.innerHTML = `<span>${p.name}</span><span class="target-sub">${p.hand.length} CARDS</span>`;
    btn.onclick = () => {
      document.getElementById('swap-overlay').classList.remove('show');
      if (G.pendingCB) { G.pendingCB(i); G.pendingCB = null; }
    };
    list.appendChild(btn);
  });
  document.getElementById('swap-overlay').classList.add('show');
}

// ── SCREEN NAV ────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = id === 'game' ? 'hidden' : '';
  if (id !== 'game') window.scrollTo(0, 0);
}

function confirmQuit() {
  if (confirm('QUIT THIS GAME?')) { G = {}; showScreen('menu'); }
}

// Compute bottom offset — always give a clean gap from taskbar
function getBottomOffset() {
  return 16; // fixed 16px gap — clean, simple, works at any window size
}

// Re-render on resize
window.addEventListener('resize', () => {
  if (document.getElementById('game').classList.contains('active')) {
    renderOpponents();
    renderHand();
  }
});
