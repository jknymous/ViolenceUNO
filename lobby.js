/* ============================================================
   UNO CHAOS — lobby.js
   Handles online lobby: create room, join room, quick match
   ============================================================ */

// Socket.io client — loaded via CDN in index.html
let socket = null;
let myRoomCode = null;
let mySocketId = null;
let isHost = false;
let lobbyPlayers = [];

// ── CONNECT TO SERVER ────────────────────────────────────────
function connectSocket() {
  if (socket && socket.connected) return Promise.resolve();

  // Use same origin in production, localhost in dev
  const SERVER_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

  return new Promise((resolve, reject) => {
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      mySocketId = socket.id;
      console.log('[Socket] Connected:', mySocketId);
      setupSocketListeners();
      resolve();
    });

    socket.on('connect_error', err => {
      console.error('[Socket] Error:', err.message);
      reject(err);
    });

    setTimeout(() => reject(new Error('Connection timeout')), 8000);
  });
}

// ── SOCKET EVENT LISTENERS ───────────────────────────────────
function setupSocketListeners() {
  // Lobby updates
  socket.on('lobbyUpdate', ({ players, hostId }) => {
    lobbyPlayers = players;
    isHost = (hostId === mySocketId);
    renderLobbyPlayers(players, hostId);
  });

  socket.on('settingsUpdate', ({ chaosRules }) => {
    // Sync chaos rules from host
    if (!isHost) {
      setupData.chaosRules = chaosRules;
      renderChaosGrid();
    }
  });

  socket.on('hostChanged', ({ newHostId }) => {
    isHost = (newHostId === mySocketId);
    updateStartBtn();
    if (isHost) showToastLobby('YOU ARE NOW THE HOST', 'hi');
  });

  // Game start
  socket.on('gameStarted', () => {
    showScreen('game');
    showToastLobby('GAME STARTING...', 'hi');
  });

  // Game state (authoritative from server)
  socket.on('gameState', (state) => {
    applyServerState(state);
  });

  // Game log
  socket.on('gameLog', ({ msg, type }) => {
    gameLog(msg, type);
  });

  // UNO called by someone
  socket.on('unoCalled', ({ player }) => {
    toast(`${player}: UNO!`, 'danger');
  });

  // Swap target request (7 rule — only sent to the player who played 7)
  socket.on('requestSwapTarget', ({ players }) => {
    openSwapModal(mySocketId, '7-SWAP — CHOOSE TARGET', (targetId) => {
      socket.emit('swapHand', { targetId });
    }, null, players); // custom player list from server
  });

  // Game over
  socket.on('gameOver', ({ winner }) => {
    document.getElementById('win-name').textContent = winner;
    showScreen('win');
  });

  // Chat
  socket.on('chatMsg', ({ player, text }) => {
    appendChat(player, text);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    toast('DISCONNECTED FROM SERVER', 'danger');
  });
}

// ── CREATE ROOM ──────────────────────────────────────────────
async function createOnlineRoom() {
  const nameEl = document.getElementById('online-name');
  const playerName = (nameEl?.value || 'PLAYER_1').toUpperCase().trim();

  try {
    showOnlineStatus('CONNECTING...');
    await connectSocket();

    const ultiId = setupData.playerUltis[0] || 'ghost';

    socket.emit('createRoom', {
      playerName,
      ulti: ultiId,
      chaosRules: setupData.chaosRules,
    }, (res) => {
      if (!res.ok) return showOnlineStatus('ERROR: ' + res.reason, true);
      myRoomCode = res.code;
      isHost = true;
      lobbyPlayers = res.players;
      showLobbyScreen(res.code, res.players, true);
    });
  } catch (err) {
    showOnlineStatus('CANNOT CONNECT TO SERVER', true);
  }
}

// ── JOIN ROOM ────────────────────────────────────────────────
async function joinOnlineRoom() {
  const code = (document.getElementById('room-code-input')?.value || '').trim().toUpperCase();
  const nameEl = document.getElementById('online-name');
  const playerName = (nameEl?.value || 'PLAYER_2').toUpperCase().trim();

  if (!code || code.length !== 6) return showOnlineStatus('ENTER A VALID 6-CHAR CODE', true);

  try {
    showOnlineStatus('JOINING...');
    await connectSocket();

    socket.emit('joinRoom', { code, playerName, ulti: setupData.playerUltis[0] || 'ghost' }, (res) => {
      if (!res.ok) return showOnlineStatus('ERROR: ' + res.reason, true);
      myRoomCode = res.code;
      isHost = (res.hostId === mySocketId);
      lobbyPlayers = res.players;
      setupData.chaosRules = res.chaosRules || {};
      showLobbyScreen(res.code, res.players, false);
    });
  } catch (err) {
    showOnlineStatus('CANNOT CONNECT TO SERVER', true);
  }
}

// ── QUICK MATCH ──────────────────────────────────────────────
async function quickMatch() {
  const nameEl = document.getElementById('online-name');
  const playerName = (nameEl?.value || 'PLAYER_1').toUpperCase().trim();

  try {
    showOnlineStatus('SEARCHING...');
    await connectSocket();

    socket.emit('quickJoin', { playerName, ulti: setupData.playerUltis[0] || 'ghost' }, (res) => {
      if (!res.ok) return showOnlineStatus('ERROR: ' + (res.reason || ''), true);
      myRoomCode = res.code;
      isHost = res.created || false;
      lobbyPlayers = res.players;
      showLobbyScreen(res.code, res.players, isHost);
      if (res.created) showOnlineStatus('WAITING FOR PLAYERS...', false, 'warn');
    });
  } catch (err) {
    showOnlineStatus('CANNOT CONNECT TO SERVER', true);
  }
}

// ── START GAME (host) ────────────────────────────────────────
function hostStartGame() {
  if (!isHost || !socket) return;
  socket.emit('startGame', {}, (res) => {
    if (!res?.ok) toast(res?.reason || 'Cannot start', 'danger');
  });
}

// ── LOBBY SCREEN ─────────────────────────────────────────────
function showLobbyScreen(code, players, hosting) {
  showScreen('lobby');
  document.getElementById('lobby-code').textContent = code;
  document.getElementById('lobby-title').textContent = hosting ? '// YOU ARE HOST' : '// JOINED ROOM';
  renderLobbyPlayers(players, hosting ? mySocketId : null);
  updateStartBtn();
}

function renderLobbyPlayers(players, hostId) {
  const list = document.getElementById('lobby-players');
  if (!list) return;
  list.innerHTML = '';
  players.forEach(p => {
    const el = document.createElement('div');
    el.className = 'lobby-player-row';
    const isMe = p.id === mySocketId;
    const isH = p.id === hostId;
    el.innerHTML = `
      <div class="lp-name ${isMe ? 'me' : ''}">${p.name}</div>
      <div class="lp-ulti">${getUltiDef(p.ulti)?.icon || ''} ${getUltiDef(p.ulti)?.name || ''}</div>
      <div class="lp-badge">${isH ? 'HOST' : ''} ${isMe ? '(YOU)' : ''}</div>
    `;
    list.appendChild(el);
  });
  updateStartBtn();
}

function updateStartBtn() {
  const btn = document.getElementById('start-game-btn');
  if (!btn) return;
  btn.style.display = isHost ? 'block' : 'none';
  btn.disabled = lobbyPlayers.length < 2;
}

// ── CHAT ─────────────────────────────────────────────────────
function sendChat() {
  const inp = document.getElementById('chat-input');
  const text = inp?.value?.trim();
  if (!text || !socket) return;
  socket.emit('chatMsg', { text });
  inp.value = '';
}

function appendChat(player, text) {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  const msg = document.createElement('div');
  msg.className = 'chat-msg';
  msg.innerHTML = `<span class="chat-name">${player}</span> ${text}`;
  el.appendChild(msg);
  el.scrollTop = el.scrollHeight;
}

// ── STATUS DISPLAY ───────────────────────────────────────────
function showOnlineStatus(msg, isError = false, type = '') {
  const el = document.getElementById('online-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--red)' : type === 'warn' ? 'var(--yellow)' : 'var(--cyan)';
  el.style.display = 'block';
}

function showToastLobby(msg, type) {
  toast(msg, type);
}

// ── ONLINE PLAY CARD ─────────────────────────────────────────
// Override for online mode — sends to server instead of local logic
function onlinePlayCard(cardIdx, chosenColor) {
  if (!socket) return;
  socket.emit('playCard', { cardIdx, chosenColor }, (res) => {
    if (!res?.ok) toast(res?.reason || 'Illegal move', 'danger');
  });
}

function onlineDrawCard() {
  if (!socket) return;
  socket.emit('drawCard', {}, (res) => {
    if (!res?.ok) toast('Cannot draw', 'danger');
  });
}

function onlineCallUno() {
  if (!socket) return;
  socket.emit('callUno');
  toast('UNO!!!', 'danger');
  document.getElementById('uno-btn')?.classList.remove('show');
}

// ── APPLY SERVER STATE → RENDER ──────────────────────────────
function applyServerState(state) {
  if (!state) return;

  // Rebuild G from server state for rendering
  G.players = state.players.map(p => ({
    name: p.name,
    hand: p.id === mySocketId ? state.myHand : Array(p.cardCount).fill({}),
    isHuman: p.id === mySocketId,
    ulti: p.ulti,
  }));

  // Reorder so local player is always index 0
  const myIdx = state.players.findIndex(p => p.id === mySocketId);
  if (myIdx > 0) {
    G.players = [...G.players.slice(myIdx), ...G.players.slice(0, myIdx)];
  }

  G.currentPlayer = (() => {
    const cpId = state.currentPlayerId;
    return G.players.findIndex((p, i) => {
      const orig = state.players[(myIdx + i) % state.players.length];
      return orig?.id === cpId;
    });
  })();

  G.direction = state.direction;
  G.turn = state.turn;
  G.drawStack = state.drawStack;
  G.currentColor = state.currentColor;
  G.discard = state.discard;
  G.deck = Array(state.deckCount).fill({});
  G.chaosRules = state.chaosRules;
  G.ultiCharges = { 0: state.ultiCharges?.[mySocketId] || 0 };
  G.actionLock = (state.currentPlayerId !== mySocketId);
  G.tokens = G.tokens || 0;

  if (state.status === 'finished') return;

  renderGame();
}

// ── REMATCH (online) ─────────────────────────────────────────
function onlineRematch() {
  if (!socket || !isHost) return toast('Only host can rematch', 'danger');
  socket.emit('rematch', {}, (res) => {
    if (!res?.ok) toast('Cannot rematch', 'danger');
  });
}

function copyRoomCode() {
  const code = myRoomCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => toast('CODE COPIED!', ''));
}
