/* ============================================================
   UNO CHAOS — SETUP.JS
   Handles menu, setup screen, player config, chaos rules, ulti pick
   ============================================================ */

// ── STATE ────────────────────────────────────────────────────

let currentUltiPlayer = 0; // which player is picking ulti

// ── INIT ─────────────────────────────────────────────────────

function initSetup() {
  // Default chaos rules
  setupData.chaosRules = {};
  CHAOS_RULES_DEF.forEach(r => setupData.chaosRules[r.id] = r.def);

  // Default player names
  setupData.playerNames = ['PLAYER_1', 'PLAYER_2', 'PLAYER_3', 'PLAYER_4'];
  setupData.playerUltis = {};

  currentUltiPlayer = 0;

  renderPlayerList();
  renderChaosGrid();
  renderUltiGrid();
}

// ── PLAYER LIST ───────────────────────────────────────────────

function renderPlayerList() {
  const list = document.getElementById('player-list');
  const count = document.getElementById('player-count-label');
  list.innerHTML = '';

  setupData.playerNames.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <div class="player-num">#${i + 1}</div>
      <input
        type="text"
        value="${name}"
        placeholder="PLAYER ${i + 1}"
        maxlength="14"
        oninput="setupData.playerNames[${i}] = this.value.toUpperCase() || 'PLAYER_${i + 1}'; refreshUltiPanelLabel()"
      />
    `;
    list.appendChild(row);
  });

  count.textContent = `${setupData.playerNames.length} PLAYERS`;
}

function addPlayer() {
  if (setupData.playerNames.length >= 8) {
    toast('MAXIMUM 8 PLAYERS', 'danger');
    return;
  }
  const n = setupData.playerNames.length + 1;
  setupData.playerNames.push(`PLAYER_${n}`);
  renderPlayerList();
  renderUltiGrid(); // refresh nav pips
}

function removePlayer() {
  if (setupData.playerNames.length <= 2) {
    toast('MINIMUM 2 PLAYERS', 'danger');
    return;
  }
  const last = setupData.playerNames.length - 1;
  setupData.playerNames.pop();
  delete setupData.playerUltis[last];
  if (currentUltiPlayer >= setupData.playerNames.length) {
    currentUltiPlayer = setupData.playerNames.length - 1;
  }
  renderPlayerList();
  renderUltiGrid();
}

// ── CHAOS RULES ───────────────────────────────────────────────

function renderChaosGrid() {
  const grid = document.getElementById('chaos-grid');
  grid.innerHTML = '';

  CHAOS_RULES_DEF.forEach(rule => {
    const el = document.createElement('div');
    el.className = `chaos-item${setupData.chaosRules[rule.id] ? ' active' : ''}`;
    el.id = `chaos-${rule.id}`;
    el.innerHTML = `
      <div class="chaos-toggle"></div>
      <div class="chaos-info">
        <div class="chaos-name">${rule.name}</div>
        <div class="chaos-desc">${rule.desc}</div>
      </div>
    `;
    el.onclick = () => {
      setupData.chaosRules[rule.id] = !setupData.chaosRules[rule.id];
      el.classList.toggle('active', setupData.chaosRules[rule.id]);
    };
    grid.appendChild(el);
  });
}

// ── ULTI GRID ─────────────────────────────────────────────────

function renderUltiGrid() {
  const grid = document.getElementById('ulti-grid');
  grid.innerHTML = '';

  refreshUltiPanelLabel();

  // ULTI cards
  ULTIS_DEF.forEach(ulti => {
    const isSelected = setupData.playerUltis[currentUltiPlayer] === ulti.id;
    const card = document.createElement('div');
    card.className = `ulti-card${isSelected ? ' selected' : ''}`;
    card.innerHTML = `
      <div class="ulti-icon">${ulti.icon}</div>
      <div class="ulti-name">${ulti.name}</div>
      <div class="ulti-type">${ulti.type}${!ulti.passive ? ` • ${ulti.charge} CHARGE${ulti.charge > 1 ? 'S' : ''}` : ''}</div>
      <div class="ulti-desc">${ulti.desc}</div>
    `;
    card.onclick = () => {
      setupData.playerUltis[currentUltiPlayer] = ulti.id;
      renderUltiGrid();

      // Auto-advance to next player
      if (currentUltiPlayer < setupData.playerNames.length - 1) {
        setTimeout(() => {
          currentUltiPlayer++;
          renderUltiGrid();
          toast(`NOW: ${setupData.playerNames[currentUltiPlayer]} — PICK ULTI`, '');
        }, 500);
      } else {
        toast('ALL ULTIS SELECTED!', '');
      }
    };
    grid.appendChild(card);
  });

  // Player nav pips
  const nav = document.createElement('div');
  nav.style.cssText = 'grid-column:1/-1; display:flex; gap:8px; justify-content:center; margin-top:8px; flex-wrap:wrap;';

  setupData.playerNames.forEach((name, i) => {
    const pip = document.createElement('div');
    const isActive = i === currentUltiPlayer;
    const isPicked = !!setupData.playerUltis[i];
    pip.style.cssText = `
      width:10px; height:10px; cursor:pointer; transition:all .2s;
      border:1px solid ${isActive ? 'var(--cyan)' : isPicked ? 'var(--purple)' : 'var(--text-dim)'};
      background:${isActive ? 'var(--cyan)' : isPicked ? 'var(--purple)' : 'transparent'};
      box-shadow:${isActive ? '0 0 8px var(--cyan)' : 'none'};
    `;
    pip.title = name;
    pip.onclick = () => { currentUltiPlayer = i; renderUltiGrid(); };
    nav.appendChild(pip);
  });

  grid.appendChild(nav);
}

function refreshUltiPanelLabel() {
  const panel = document.querySelector('#ulti-grid')?.closest('.panel');
  if (!panel) return;
  const pname = setupData.playerNames[currentUltiPlayer] || `PLAYER ${currentUltiPlayer + 1}`;
  panel.setAttribute('data-label', `ULTI SELECTION — ${pname}`);
}

// ── START GAME VALIDATION ─────────────────────────────────────

function validateAndStart() {
  // Read latest input values
  const inputs = document.querySelectorAll('#player-list input');
  inputs.forEach((inp, i) => {
    setupData.playerNames[i] = inp.value.trim().toUpperCase() || `PLAYER_${i + 1}`;
  });

  // Auto-assign missing ultis
  setupData.playerNames.forEach((_, i) => {
    if (!setupData.playerUltis[i]) {
      setupData.playerUltis[i] = ULTIS_DEF[i % ULTIS_DEF.length].id;
    }
  });

  startGame(); // defined in game.js
}

// ── RULES MODAL ───────────────────────────────────────────────

function showRulesModal() {
  alert(
    'UNO CHAOS — HOW TO PLAY\n\n' +
    'GOAL: First player to empty their hand wins.\n\n' +
    'BASICS:\n' +
    '• Match top card by COLOR or VALUE\n' +
    '• Wild  → pick any color\n' +
    '• Wild+4 → pick color + next draws 4\n' +
    '• Skip   → next player loses turn\n' +
    '• Reverse → flip direction\n' +
    '• +2     → next player draws 2\n' +
    '• Call UNO when you have 1 card left!\n\n' +
    'CHAOS RULES: Toggle custom rules in setup.\n\n' +
    'ULTI SYSTEM:\n' +
    '• Each player picks 1 ULTI before game\n' +
    '• PASSIVE ultis are always active\n' +
    '• ACTIVE ultis cost charges (earn by playing cards)\n\n' +
    'TOKENS:\n' +
    '• Coming in Phase 3 — watch ads to earn tokens!\n' +
    '• Use tokens to unlock premium ultis.'
  );
}
