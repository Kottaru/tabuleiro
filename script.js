// Xadrez JS – regras essenciais: movimentos, roque, en passant, promoção, xeque/xeque-mate.

const boardEl = document.getElementById("board");
const logEl = document.getElementById("log");
const turnLabel = document.getElementById("turn-label");
const statusLabel = document.getElementById("status-label");
const btnNew = document.getElementById("btn-new");
const btnUndo = document.getElementById("btn-undo");
const btnFlip = document.getElementById("btn-flip");
const fenInput = document.getElementById("fen-input");
const btnLoadFEN = document.getElementById("btn-load-fen");
const btnCopyFEN = document.getElementById("btn-copy-fen");

const FILES = ["a","b","c","d","e","f","g","h"];
const RANKS = ["1","2","3","4","5","6","7","8"];
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let state = {
  board: Array(64).fill(null),        // { type:'p','n','b','r','q','k', color:'w'|'b' }
  turn: "w",
  castle: { wK:true, wQ:true, bK:true, bQ:true },
  enpassant: "-",                     // square like "e3" or "-"
  halfmoveClock: 0,
  fullmove: 1,
  history: [],
  flipped: false
};

const pieceIcons = {
  w: { p:"♙", n:"♘", b:"♗", r:"♖", q:"♕", k:"♔" },
  b: { p:"♟", n:"♞", b:"♝", r:"♜", q:"♛", k:"♚" }
};

// Utils
function sqToIndex(sq){ const f = FILES.indexOf(sq[0]); const r = RANKS.indexOf(sq[1]); return r*8+f; }
function indexToSq(i){ const f = FILES[i%8]; const r = RANKS[Math.floor(i/8)]; return f+r; }
function onBoard(i){ return i>=0 && i<64; }
function sameColor(a,b){ return a && b && a.color === b.color; }
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function addLog(text){ const li = document.createElement("li"); li.textContent = text; logEl.prepend(li); }
function clearHints(){ [...boardEl.querySelectorAll(".hint")].forEach(h => h.remove()); }
function setStatus(msg){ statusLabel.textContent = msg || ""; }
function resetStatus(){ setStatus(""); }

// Render
function renderBoard(){
  boardEl.innerHTML = "";
  for(let i=0;i<64;i++){
    const rank = Math.floor(i/8), file = i%8;
    const isLight = (rank + file) % 2 === 0;
    const sq = document.createElement("div");
    sq.className = `square ${isLight ? "light":"dark"}`;
    sq.dataset.index = i;
    const fileCoord = document.createElement("div");
    fileCoord.className = "coord file";
    const rankCoord = document.createElement("div");
    rankCoord.className = "coord rank";
    // Coordinates only on edges
    if(rank===0) fileCoord.textContent = FILES[file];
    if(file===0) rankCoord.textContent = RANKS[rank];
    sq.appendChild(fileCoord); sq.appendChild(rankCoord);
    boardEl.appendChild(sq);
  }
  renderPieces();
}

function renderPieces(){
  // Clear existing pieces
  [...boardEl.querySelectorAll(".piece")].forEach(p => p.remove());
  for(let i=0;i<64;i++){
    const p = state.board[i];
    if(!p) continue;
    const el = document.createElement("div");
    el.className = "piece";
    el.draggable = true;
    el.dataset.index = i;
    el.textContent = pieceIcons[p.color][p.type];
    boardEl.children[i].appendChild(el);
  }
  turnLabel.textContent = state.turn === "w" ? "Brancas" : "Pretas";
}

// Orientation
function setOrientation(){
  const cells = [...boardEl.children];
  if(state.flipped){
    cells.reverse().forEach((cell, idx) => boardEl.appendChild(cell));
  } else {
    // Rebuild in correct order
    renderBoard();
  }
}

// FEN
function loadFEN(fen){
  const parts = fen.trim().split(/\s+/);
  if(parts.length < 4) throw new Error("FEN inválida");
  const rows = parts[0].split("/");
  const turn = parts[1];
  const castle = parts[2];
  const enp = parts[3];

  const board = Array(64).fill(null);
  for(let r=7;r>=0;r--){
    const row = rows[7-r];
    let file=0;
    for(const ch of row){
      if(/\d/.test(ch)){ file += parseInt(ch,10); }
      else {
        const color = ch === ch.toUpperCase() ? "w" : "b";
        const type = ch.toLowerCase();
        board[r*8 + file] = { type, color };
        file++;
      }
    }
  }

  state.board = board;
  state.turn = turn;
  state.castle = {
    wK: castle.includes("K"),
    wQ: castle.includes("Q"),
    bK: castle.includes("k"),
    bQ: castle.includes("q")
  };
  state.enpassant = enp;
  state.halfmoveClock = parts[4] ? parseInt(parts[4],10) : 0;
  state.fullmove = parts[5] ? parseInt(parts[5],10) : 1;
  state.history = [];

  renderBoard();
  setStatus("");
}

function exportFEN(){
  let rows = [];
  for(let r=7;r>=0;r--){
    let row="", empty=0;
    for(let f=0;f<8;f++){
      const p = state.board[r*8+f];
      if(!p){ empty++; }
      else {
        if(empty>0){ row += empty; empty=0; }
        const ch = p.type;
        row += p.color === "w" ? ch.toUpperCase() : ch;
      }
    }
    if(empty>0) row += empty;
    rows.push(row);
  }
  const board = rows.join("/");
  let castle = "";
  if(state.castle.wK) castle += "K";
  if(state.castle.wQ) castle += "Q";
  if(state.castle.bK) castle += "k";
  if(state.castle.bQ) castle += "q";
  if(castle === "") castle = "-";
  const fen = `${board} ${state.turn} ${castle} ${state.enpassant || "-"} ${state.halfmoveClock} ${state.fullmove}`;
  return fen;
}

// Move generation

function attacksSquare(color, targetIdx){
  // Generate pseudo-legal moves for opponent and see if they hit targetIdx
  const opp = color === "w" ? "b" : "w";
  for(let i=0;i<64;i++){
    const p = state.board[i];
    if(!p || p.color !== opp) continue;
    const moves = pieceMoves(i, true); // pseudo moves
    if(moves.some(m => m.to === targetIdx)) return true;
  }
  return false;
}

function kingIndex(color){
  for(let i=0;i<64;i++){
    const p = state.board[i];
    if(p && p.color===color && p.type==="k") return i;
  }
  return -1;
}

function lineMoves(i, deltas, color){
  const res = [];
  for(const d of deltas){
    let j = i + d;
    while(onBoard(j) && sameFileRankStep(i, j, d)){
      const target = state.board[j];
      if(!target){
        res.push({from:i, to:j});
      } else {
        if(target.color !== color) res.push({from:i, to:j, capture:true});
        break;
      }
      j += d;
    }
  }
  return res;
}

function sameFileRankStep(from, to, step){
  // Prevent wrapping across files
  const df = Math.abs((to%8) - (from%8));
  const dr = Math.abs(Math.floor(to/8) - Math.floor(from/8));
  const sf = Math.abs(step)%8;
  const sr = Math.floor(Math.abs(step)/8);
  // For straight lines, ensure we step consistently without wrapping
  if(step===1 || step===-1) return dr===0;          // horizontal
  if(step===8 || step===-8) return df===0;          // vertical
  if(step===9 || step===-9) return df===dr;         // diag
  if(step===7 || step===-7) return df===dr;
  return true;
}

function pieceMoves(i, pseudo=false){
  const p = state.board[i];
  if(!p) return [];
  const color = p.color;
  const forward = color === "w" ? 8 : -8;
  const enemy = color === "w" ? "b" : "w";
  const moves = [];

  switch(p.type){
    case "p":{
      const startRank = color==="w" ? 1 : 6;
      const rank = Math.floor(i/8);

      // One forward
      const one = i + forward;
      if(onBoard(one) && !state.board[one]) moves.push({from:i,to:one});

      // Two forward from start
      const two = i + 2*forward;
      if(rank===startRank && !state.board[one] && onBoard(two) && !state.board[two]) moves.push({from:i,to:two, double:true});

      // Captures
      for(const df of [-1, 1]){
        const to = i + forward + df;
        if(!onBoard(to)) continue;
        const target = state.board[to];
        if(target && target.color === enemy) moves.push({from:i,to, capture:true});
      }

      // En passant
      if(state.enpassant !== "-" && state.enpassant){
        const enpIdx = sqToIndex(state.enpassant);
        for(const df of [-1, 1]){
          const to = i + forward + df;
          if(to === enpIdx){
            moves.push({from:i, to, enpassant:true, capture:true});
          }
        }
      }

      // Promo flags (aplicadas no makeMove)
      break;
    }

    case "n":{
      const deltas = [15,17,10,-6,6,-10,-15,-17]; // Knight
      for(const d of deltas){
        const to = i + d;
        if(!onBoard(to)) continue;
        // Prevent wrap: knight unique step check
        const df = Math.abs((to%8) - (i%8));
        const dr = Math.abs(Math.floor(to/8) - Math.floor(i/8));
        if(!((df===1 && dr===2) || (df===2 && dr===1))) continue;
        const target = state.board[to];
        if(!target || target.color !== color) moves.push({from:i,to, capture: !!target});
      }
      break;
    }

    case "b":{
      moves.push(...lineMoves(i, [9,-9,7,-7], color));
      break;
    }

    case "r":{
      moves.push(...lineMoves(i, [1,-1,8,-8], color));
      break;
    }

    case "q":{
      moves.push(...lineMoves(i, [1,-1,8,-8,9,-9,7,-7], color));
      break;
    }

    case "k":{
      const deltas = [1,-1,8,-8,9,-9,7,-7];
      for(const d of deltas){
        const to = i + d;
        if(!onBoard(to)) continue;
        const df = Math.abs((to%8) - (i%8));
        const dr = Math.abs(Math.floor(to/8) - Math.floor(i/8));
        if(df>1 || dr>1) continue;
        const target = state.board[to];
        if(!target || target.color !== color) moves.push({from:i,to, capture: !!target});
      }

      if(!pseudo){
        // Castling
        const rank = color==="w" ? 0 : 7;
        const kingStart = rank*8 + 4;
        if(i === kingStart){
          const inCheck = squareInCheck(color, i);
          if(!inCheck){
            // King side castle
            if((color==="w" ? state.castle.wK : state.castle.bK)){
              const f5 = rank*8 + 5, f6 = rank*8 + 6, rook = rank*8 + 7;
              if(!state.board[f5] && !state.board[f6] && state.board[rook] && state.board[rook].type==="r" && state.board[rook].color===color){
                if(!squareInCheck(color, f5) && !squareInCheck(color, f6)){
                  moves.push({from:i, to:f6, castle:"K"});
                }
              }
            }
            // Queen side castle
            if((color==="w" ? state.castle.wQ : state.castle.bQ)){
              const f3 = rank*8 + 3, f2 = rank*8 + 2, f1 = rank*8 + 1, rook = rank*8 + 0;
              if(!state.board[f3] && !state.board[f2] && !state.board[f1] && state.board[rook] && state.board[rook].type==="r" && state.board[rook].color===color){
                if(!squareInCheck(color, f3) && !squareInCheck(color, f2)){
                  moves.push({from:i, to:f2, castle:"Q"});
                }
              }
            }
          }
        }
      }
      break;
    }
  }

  if(pseudo) return moves;

  // Filter out moves that leave king in check
  const legal = [];
  for(const m of moves){
    if(isLegalMove(m, i)) legal.push(m);
  }
  return legal;
}

function squareInCheck(color, idx){
  return attacksSquare(color, idx);
}

function isLegalMove(m, fromIndex){
  const snapshot = clone(state);
  makeMoveInternal(m, snapshot);
  const kIdx = kingIndex(snapshot.turn === "w" ? "b" : "w"); // after move, turn switches in snapshot?
  const colorMoved = state.turn; // original mover color
  const kingPos = kingIndex(colorMoved, snapshot.board);
  // Recompute king pos for mover color
  let movedKingPos = -1;
  for(let i=0;i<64;i++){
    const p = snapshot.board[i];
    if(p && p.color===colorMoved && p.type==="k"){ movedKingPos = i; break; }
  }
  return !attacksSquare(colorMoved, movedKingPos, snapshot);
}

// AttacksSquare adapted to snapshot (optional state)
function attacksSquare(color, targetIdx, snapshot=state){
  const opp = color === "w" ? "b" : "w";
  for(let i=0;i<64;i++){
    const p = snapshot.board[i];
    if(!p || p.color !== opp) continue;
    const moves = pseudoMoves(i, snapshot);
    if(moves.some(m => m.to === targetIdx)) return true;
  }
  return false;
}

function pseudoMoves(i, snap){
  const original = state;
  state = snap; // temporarily reuse pieceMoves in pseudo mode
  const res = pieceMoves(i, true);
  state = original;
  return res;
}

function makeMoveInternal(m, snap){
  const s = snap || state;
  const from = m.from; const to = m.to;
  const p = s.board[from];
  s.board[from] = null;

  // En passant capture
  if(m.enpassant){
    const dir = p.color==="w" ? -8 : 8;
    s.board[to + dir] = null;
  }

  // Castle rook move
  if(m.castle==="K"){
    const rank = p.color==="w" ? 0 : 7;
    const rookFrom = rank*8 + 7;
    const rookTo = rank*8 + 5;
    s.board[rookTo] = s.board[rookFrom];
    s.board[rookFrom] = null;
  } else if(m.castle==="Q"){
    const rank = p.color==="w" ? 0 : 7;
    const rookFrom = rank*8 + 0;
    const rookTo = rank*8 + 3;
    s.board[rookTo] = s.board[rookFrom];
    s.board[rookFrom] = null;
  }

  // Promotion
  const toRank = Math.floor(to/8);
  const promoteRank = p.color==="w" ? 7 : 0;

  let movedPiece = clone(p);

  if(p.type==="p" && toRank===promoteRank){
    const choice = prompt("Promover para: q/r/b/n (dama/torre/bispo/cavalo)?", "q");
    const map = { q:"q", r:"r", b:"b", n:"n" };
    const t = map[(choice||"q").toLowerCase()] || "q";
    movedPiece.type = t;
  }

  s.board[to] = movedPiece;

  // Update en passant
  s.enpassant = "-";
  if(p.type==="p" && m.double){
    const dir = p.color==="w" ? 8 : -8;
    s.enpassant = indexToSq(from + dir);
  }

  // Update castling rights
  const color = p.color;
  // If king moved
  if(p.type==="k"){
    if(color==="w"){ s.castle.wK=false; s.castle.wQ=false; }
    else { s.castle.bK=false; s.castle.bQ=false; }
  }
  // If rook moved or captured
  const updateRook = (i) => {
    const rank = color==="w" ? 0 : 7;
    if(i === rank*8 + 0){ color==="w" ? s.castle.wQ=false : s.castle.bQ=false; }
    if(i === rank*8 + 7){ color==="w" ? s.castle.wK=false : s.castle.bK=false; }
  };
  updateRook(from);
  if(m.capture) updateRook(to);

  // Halfmove clock
  if(p.type==="p" || m.capture) s.halfmoveClock = 0; else s.halfmoveClock++;

  // Turn
  s.turn = s.turn === "w" ? "b" : "w";
  if(s.turn === "w") s.fullmove++;
}

function makeMove(m){
  const snap = clone(state);
  makeMoveInternal(m, snap);

  // Validate king safety for actual move
  const movedColor = state.turn;
  const kPos = kingIndex(movedColor, snap.board);
  // Recompute king pos for movedColor
  let kingPos = -1;
  for(let i=0;i<64;i++){ const p = snap.board[i]; if(p && p.color===movedColor && p.type==="k"){ kingPos=i; break; } }
  if(attacksSquare(movedColor, kingPos, snap)){
    setStatus("Movimento ilegal: deixa o rei em xeque.");
    return false;
  }

  state = snap;
  state.history.push(m);
  renderPieces();
  clearHints();
  logMove(m);
  evaluateGameEnd();
  resetStatus();
  return true;
}

function logMove(m){
  const from = indexToSq(m.from);
  const to = indexToSq(m.to);
  const p = state.board[m.to];
  const symbol = p.type.toUpperCase() !== "P" ? p.type.toUpperCase() : "";
  const capture = m.capture ? "x" : "-";
  const castle = m.castle==="K" ? "O-O" : m.castle==="Q" ? "O-O-O" : "";
  const txt = castle || `${symbol}${from}${capture}${to}`;
  addLog(`${state.turn === "w" ? "..." : ""} ${txt}`);
}

function evaluateGameEnd(){
  const color = state.turn;
  const legalExists = anyLegalMove(color);
  const inCheck = squareInCheck(color, kingIndex(color));
  if(!legalExists && inCheck){
    setStatus(`Xeque-mate! ${color==="w"?"Pretas":"Brancas"} venceram.`);
    alert(`Xeque-mate! ${color==="w"?"Pretas":"Brancas"} venceram.`);
  } else if(!legalExists){
    setStatus("Empate por afogamento (stalemate).");
    alert("Empate por afogamento.");
  } else if(inCheck){
    setStatus("Xeque.");
  }
}

function anyLegalMove(color){
  for(let i=0;i<64;i++){
    const p = state.board[i];
    if(!p || p.color!==color) continue;
    const moves = pieceMoves(i);
    if(moves.length>0) return true;
  }
  return false;
}

// Hints
function showHints(i){
  clearHints();
  const moves = pieceMoves(i);
  for(const m of moves){
    const el = document.createElement("div");
    el.className = "hint legal";
    if(m.capture) el.classList.add("capture");
    if(m.castle) el.classList.add("castle");
    if(m.enpassant) el.classList.add("enpassant");
    boardEl.children[m.to].appendChild(el);
  }
}

// Interaction
let dragFrom = null;

boardEl.addEventListener("click", (e) => {
  const pieceEl = e.target.closest(".piece");
  const squareEl = e.target.closest(".square");
  if(!squareEl) return;
  const idx = parseInt(squareEl.dataset.index,10);

  if(pieceEl){
    const from = parseInt(pieceEl.dataset.index,10);
    const p = state.board[from];
    if(!p || p.color !== state.turn) return;
    dragFrom = from;
    showHints(from);
  } else if(dragFrom !== null){
    // Try move
    const legal = pieceMoves(dragFrom);
    const move = legal.find(m => m.to === idx);
    if(move) makeMove(move);
    dragFrom = null;
    clearHints();
  }
});

boardEl.addEventListener("dragstart", (e) => {
  const pieceEl = e.target.closest(".piece");
  if(!pieceEl) return;
  const from = parseInt(pieceEl.dataset.index,10);
  const p = state.board[from];
  if(!p || p.color !== state.turn){ e.preventDefault(); return; }
  dragFrom = from;
  showHints(from);
});

boardEl.addEventListener("dragover", (e) => { e.preventDefault(); });

boardEl.addEventListener("drop", (e) => {
  e.preventDefault();
  const squareEl = e.target.closest(".square");
  if(!squareEl || dragFrom===null) return;
  const idx = parseInt(squareEl.dataset.index,10);
  const legal = pieceMoves(dragFrom);
  const move = legal.find(m => m.to === idx);
  if(move) makeMove(move);
  dragFrom = null;
  clearHints();
});

btnNew.addEventListener("click", () => { loadFEN(START_FEN); setStatus("Novo jogo."); });
btnUndo.addEventListener("click", () => {
  if(state.history.length===0) return;
  // Rebuild from history except last
  const fen = START_FEN;
  loadFEN(fen);
  const hist = state.history;
  state.history = [];
  for(let i=0;i<hist.length-1;i++){
    makeMove(hist[i]);
  }
  setStatus("Desfeito último lance.");
});
btnFlip.addEventListener("click", () => {
  state.flipped = !state.flipped;
  renderBoard();
});
btnLoadFEN.addEventListener("click", () => {
  try{ loadFEN(fenInput.value.trim()); setStatus("FEN carregada."); } catch(e){ setStatus("FEN inválida."); }
});
btnCopyFEN.addEventListener("click", async () => {
  const fen = exportFEN();
  try{ await navigator.clipboard.writeText(fen); setStatus("FEN copiada."); } catch{ setStatus(fen); }
});

// Init
window.addEventListener("load", () => { loadFEN(START_FEN); });
