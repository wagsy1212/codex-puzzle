(() => {
  const SIZE = 6;
  const TYPES = 5;
  const boardEl = document.querySelector('#board');
  const scoreEl = document.querySelector('#score');
  const levelEl = document.querySelector('#level');
  const movesEl = document.querySelector('#moves');
  const targetEl = document.querySelector('#target');
  const objectiveLevelEl = document.querySelector('#objective-level');
  const progressEl = document.querySelector('#progress');
  const comboEl = document.querySelector('#combo');
  const hintEl = document.querySelector('#hint');
  const overlayEl = document.querySelector('#overlay');
  const overlayTitleEl = document.querySelector('#overlay-title');
  const overlayTextEl = document.querySelector('#overlay-text');
  const finalScoreEl = document.querySelector('#final-score');
  const overlayButton = document.querySelector('#overlay-button');
  const restartButton = document.querySelector('#restart');

  let board = [];
  let score = 0;
  let level = 1;
  let levelScore = 0;
  let target = 750;
  let moves = 20;
  let selected = null;
  let locked = false;
  let gameFinished = false;

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const randomType = () => Math.floor(Math.random() * TYPES);
  const position = (index) => ({ row: Math.floor(index / SIZE), col: index % SIZE });
  const isAdjacent = (a, b) => Math.abs(position(a).row - position(b).row) + Math.abs(position(a).col - position(b).col) === 1;

  function targetForLevel(currentLevel) { return 750 + (currentLevel - 1) * 500; }

  function makeBoard() {
    board = Array.from({ length: SIZE * SIZE }, (_, index) => {
      let type;
      do { type = randomType(); } while (wouldMatchAt(index, type));
      return type;
    });
  }

  function wouldMatchAt(index, type) {
    const { row, col } = position(index);
    return (col >= 2 && board[index - 1] === type && board[index - 2] === type) ||
      (row >= 2 && board[index - SIZE] === type && board[index - SIZE * 2] === type);
  }

  function findMatches() {
    const matches = new Set();
    for (let row = 0; row < SIZE; row++) {
      let start = 0;
      for (let col = 1; col <= SIZE; col++) {
        if (col < SIZE && board[row * SIZE + col] === board[row * SIZE + start]) continue;
        if (col - start >= 3 && board[row * SIZE + start] !== null) for (let x = start; x < col; x++) matches.add(row * SIZE + x);
        start = col;
      }
    }
    for (let col = 0; col < SIZE; col++) {
      let start = 0;
      for (let row = 1; row <= SIZE; row++) {
        if (row < SIZE && board[row * SIZE + col] === board[start * SIZE + col]) continue;
        if (row - start >= 3 && board[start * SIZE + col] !== null) for (let y = start; y < row; y++) matches.add(y * SIZE + col);
        start = row;
      }
    }
    return matches;
  }

  function render(falling = []) {
    boardEl.innerHTML = '';
    board.forEach((type, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `tile tile-${type}${falling.includes(index) ? ' falling' : ''}`;
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', `Gem ${index + 1}`);
      tile.dataset.index = index;
      tile.addEventListener('click', () => chooseTile(index));
      boardEl.append(tile);
    });
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString();
    levelEl.textContent = level;
    movesEl.textContent = moves;
    targetEl.textContent = target.toLocaleString();
    objectiveLevelEl.textContent = level;
    progressEl.style.width = `${Math.min(100, levelScore / target * 100)}%`;
  }

  async function chooseTile(index) {
    if (locked || gameFinished) return;
    if (selected === null) {
      selected = index;
      boardEl.children[index].classList.add('selected');
      hintEl.textContent = 'Choose a neighboring gem to swap.';
      return;
    }
    if (selected === index) { clearSelection(); return; }
    if (!isAdjacent(selected, index)) {
      boardEl.children[selected].classList.remove('selected');
      selected = index;
      boardEl.children[index].classList.add('selected');
      return;
    }
    const first = selected;
    clearSelection();
    await attemptSwap(first, index);
  }

  function clearSelection() {
    if (selected !== null && boardEl.children[selected]) boardEl.children[selected].classList.remove('selected');
    selected = null;
    hintEl.textContent = 'Swap neighboring gems to make a match!';
  }

  async function attemptSwap(a, b) {
    locked = true;
    [board[a], board[b]] = [board[b], board[a]];
    moves--;
    updateHud();
    render([a, b]);
    await wait(190);
    if (findMatches().size === 0) {
      [board[a], board[b]] = [board[b], board[a]];
      render([a, b]);
      hintEl.textContent = 'That swap needs a match — try again!';
      await wait(300);
      hintEl.textContent = 'Swap neighboring gems to make a match!';
      locked = false;
      if (moves <= 0) gameOver();
      return;
    }
    await resolveMatches();
    locked = false;
  }

  async function resolveMatches() {
    let chain = 0;
    let matches = findMatches();
    while (matches.size) {
      chain++;
      const points = matches.size * 50 * chain;
      score += points;
      levelScore += points;
      updateHud();
      showCombo(chain, matches.size, points);
      matches.forEach(index => boardEl.children[index]?.classList.add('removing'));
      await wait(310);
      matches.forEach(index => { board[index] = null; });
      const falling = collapseBoard();
      render(falling);
      await wait(300);
      matches = findMatches();
    }
    if (levelScore >= target) finishLevel();
    else if (moves <= 0) gameOver();
  }

  function collapseBoard() {
    const falling = [];
    for (let col = 0; col < SIZE; col++) {
      const gems = [];
      for (let row = SIZE - 1; row >= 0; row--) if (board[row * SIZE + col] !== null) gems.push(board[row * SIZE + col]);
      for (let row = SIZE - 1, order = 0; row >= 0; row--, order++) {
        const index = row * SIZE + col;
        const newType = order < gems.length ? gems[order] : randomType();
        if (board[index] !== newType) falling.push(index);
        board[index] = newType;
      }
    }
    return falling;
  }

  function showCombo(chain, amount, points) {
    comboEl.textContent = chain > 1 ? `${chain}x COMBO! +${points}` : amount >= 4 ? `SUPER MATCH! +${points}` : `+${points}`;
    comboEl.classList.remove('show');
    void comboEl.offsetWidth;
    comboEl.classList.add('show');
  }

  function gameOver() {
    gameFinished = true;
    finalScoreEl.textContent = score.toLocaleString();
    overlayTitleEl.textContent = 'Out of Moves!';
    overlayTextEl.textContent = `You reached ${Math.floor(levelScore / target * 100)}% of Level ${level}.`;
    overlayButton.textContent = 'PLAY AGAIN';
    overlayEl.classList.remove('hidden');
  }

  function finishLevel() {
    gameFinished = true;
    finalScoreEl.textContent = score.toLocaleString();
    overlayTitleEl.textContent = `Level ${level} Complete!`;
    overlayTextEl.textContent = levelScore >= target * 1.6 ? 'An incredible gem storm!' : 'A dazzling display!';
    overlayButton.textContent = 'NEXT LEVEL';
    overlayEl.classList.remove('hidden');
  }

  function nextLevel() {
    level++;
    levelScore = 0;
    target = targetForLevel(level);
    moves = 20 + level * 2;
    selected = null;
    gameFinished = false;
    makeBoard();
    updateHud();
    render();
    overlayEl.classList.add('hidden');
    hintEl.textContent = `Level ${level}: make matches to fill the meter!`;
  }

  function restart() {
    score = 0;
    level = 1;
    levelScore = 0;
    target = targetForLevel(level);
    moves = 20;
    selected = null;
    locked = false;
    gameFinished = false;
    makeBoard();
    updateHud();
    render();
    overlayEl.classList.add('hidden');
    hintEl.textContent = 'Swap neighboring gems to make a match!';
  }

  overlayButton.addEventListener('click', () => overlayTitleEl.textContent === 'Out of Moves!' ? restart() : nextLevel());
  restartButton.addEventListener('click', restart);
  restart();
})();
