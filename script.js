// Configuração básica
const BOARD_SIZE = 50;          // total de casas
const COLS = 10;                // colunas visuais no grid
const EVENTS = {
  bonus: { label: "+2", effect: (pos) => pos + 2, desc: "Avançou +2!" },
  trap:  { label: "-2", effect: (pos) => Math.max(0, pos - 2), desc: "Voltou -2!" },
  skip:  { label: "X",  effect: (pos) => pos, skip: true, desc: "Vai perder o próximo turno!" },
};

// Estado do jogo
const state = {
  current: 0,                  // 0: Jogador 1, 1: Jogador 2
  players: [
    { pos: 0, skipNext: false },
    { pos: 0, skipNext: false }
  ],
  tiles: [],                   // tipo de eventos por casa
  gameOver: false
};

// DOM refs
const boardEl = document.getElementById("board");
const btnNew = document.getElementById("btn-new");
const btnRoll = document.getElementById("btn-roll");
const currentPlayerEl = document.getElementById("current-player");
const diceValueEl = document.getElementById("dice-value");

const posP1El = document.getElementById("pos-p1");
const posP2El = document.getElementById("pos-p2");
const skipP1El = document.getElementById("skip-p1");
const skipP2El = document.getElementById("skip-p2");
const logListEl = document.getElementById("log-list");

let pieceP1, pieceP2;

// Utilidades
function rand(n) { return Math.floor(Math.random() * n); }
function rollDice() { return 1 + rand(6); }
function log(msg) {
  const li = document.createElement("li");
  li.textContent = msg;
  logListEl.prepend(li);
}

// Inicializa o tabuleiro e eventos
function setupBoard() {
  boardEl.innerHTML = "";
  state.tiles = Array(BOARD_SIZE).fill(null);

  // Distribui eventos: cerca de 15% de casas têm eventos
  const eventIndices = new Set();
  while (eventIndices.size < Math.floor(BOARD_SIZE * 0.15)) {
    const i = 1 + rand(BOARD_SIZE - 2); // evita primeira e última
    eventIndices.add(i);
  }

  eventIndices.forEach(i => {
    const types = ["bonus", "trap", "skip"];
    const t = types[rand(types.length)];
    state.tiles[i] = t;
  });

  // Render das casas (snake-like: linhas alternam direção só visual)
  for (let i = 0; i < BOARD_SIZE; i++) {
    const tile = document.createElement("div");
    const type = state.tiles[i];
    tile.className = "tile" + (type ? " " + type : "");
    if (type) tile.textContent = EVENTS[type].label;
    if (i === BOARD_SIZE - 1) tile.classList.add("goal");
    boardEl.appendChild(tile);
  }

  // Peças
  if (!pieceP1) {
    pieceP1 = document.createElement("div");
    pieceP1.className = "piece p1";
    boardEl.appendChild(pieceP1);
  }
  if (!pieceP2) {
    pieceP2 = document.createElement("div");
    pieceP2.className = "piece p2";
    boardEl.appendChild(pieceP2);
  }

  updatePieces();
}

// Calcula coordenadas absolutas de uma posição no grid
function tileCenter(pos) {
  const idx = pos;
  const row = Math.floor(idx / COLS);
  const col = idx % COLS;
  const tile = boardEl.children[idx];
  const rect = tile.getBoundingClientRect();
  const parentRect = boardEl.getBoundingClientRect();
  return {
    x: rect.left - parentRect.left + rect.width / 2,
    y: rect.top - parentRect.top + rect.height / 2
  };
}

// Atualiza UI das peças e status
function updatePieces() {
  const c1 = tileCenter(state.players[0].pos);
  pieceP1.style.left = `${c1.x - 10}px`;  // desloca para não sobrepor exatamente
  pieceP1.style.top = `${c1.y - 10}px`;

  const c2 = tileCenter(state.players[1].pos);
  pieceP2.style.left = `${c2.x + 10}px`;
  pieceP2.style.top = `${c2.y + 10}px`;

  posP1El.textContent = state.players[0].pos;
  posP2El.textContent = state.players[1].pos;
  skipP1El.textContent = state.players[0].skipNext ? "Sim" : "Não";
  skipP2El.textContent = state.players[1].skipNext ? "Sim" : "Não";

  currentPlayerEl.textContent = state.current === 0 ? "Jogador 1" : "Jogador 2";
}

// Nova partida
function newGame() {
  state.current = 0;
  state.players[0] = { pos: 0, skipNext: false };
  state.players[1] = { pos: 0, skipNext: false };
  state.gameOver = false;
  diceValueEl.textContent = "-";
  logListEl.innerHTML = "";
  setupBoard();
  log("Novo jogo iniciado!");
}

// Avança turno
function nextTurn() {
  state.current = 1 - state.current;
  updatePieces();
}

// Processa eventos da casa
function applyTileEvent(playerIndex) {
  const player = state.players[playerIndex];
  const type = state.tiles[player.pos];
  if (!type) return;

  const ev = EVENTS[type];
  if (ev.skip) {
    player.skipNext = true;
  }
  player.pos = ev.effect(player.pos);
  log(`Evento: ${ev.desc}`);
}

// Checa vitória
function checkWin() {
  for (let i = 0; i < 2; i++) {
    if (state.players[i].pos >= BOARD_SIZE - 1) {
      state.players[i].pos = BOARD_SIZE - 1;
      state.gameOver = true;
      updatePieces();
      log(`Vitória do Jogador ${i + 1}! 🎉`);
      alert(`Vitória do Jogador ${i + 1}!`);
      return true;
    }
  }
  return false;
}

// Jogar dado e mover
function play() {
  if (state.gameOver) return;

  const i = state.current;
  const player = state.players[i];

  if (player.skipNext) {
    player.skipNext = false;
    log(`Jogador ${i + 1} perdeu o turno.`);
    nextTurn();
    return;
  }

  const dice = rollDice();
  diceValueEl.textContent = dice;

  player.pos = Math.min(BOARD_SIZE - 1, player.pos + dice);
  log(`Jogador ${i + 1} rolou ${dice} e foi para ${player.pos}.`);
  updatePieces();

  if (checkWin()) return;

  applyTileEvent(i);
  updatePieces();

  if (checkWin()) return;

  nextTurn();
}

// Eventos de UI
btnNew.addEventListener("click", newGame);
btnRoll.addEventListener("click", play);

// Inicialização
window.addEventListener("load", () => {
  setupBoard();
  updatePieces();
});
