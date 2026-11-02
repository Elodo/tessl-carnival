import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const COLS = 10;
export const ROWS = 16;
export const ROUND_SECONDS = 90;
/** Seconds between each row the falling piece drops on its own. */
export const DROP_INTERVAL = 0.5;
/** Points for clearing 1, 2, 3 or 4 rows with one piece. */
export const LINE_POINTS = [0, 100, 300, 500, 800] as const;

const CELL = 28;
const BOARD_X = (WIDTH - COLS * CELL) / 2;
const BOARD_Y = (HEIGHT - ROWS * CELL) / 2;

export type BlockColor = 'stripeA' | 'accent' | 'water' | 'danger' | 'stripeB' | 'muted' | 'wood';

/** Each shape is a square grid; `#` is a block. */
const SHAPES: { rows: string[]; color: BlockColor }[] = [
  { rows: ['....', '####', '....', '....'], color: 'water' }, // I
  { rows: ['##', '##'], color: 'accent' }, // O
  { rows: ['.#.', '###', '...'], color: 'muted' }, // T
  { rows: ['.##', '##.', '...'], color: 'stripeB' }, // S
  { rows: ['##.', '.##', '...'], color: 'stripeA' }, // Z
  { rows: ['#..', '###', '...'], color: 'danger' }, // J
  { rows: ['..#', '###', '...'], color: 'wood' }, // L
];
export const PIECE_COUNT = SHAPES.length;

export type Board = (BlockColor | null)[][];

export interface Piece {
  /** A square grid of booleans; true is a block. */
  shape: boolean[][];
  color: BlockColor;
  /** Board column and row of the grid's top-left corner. */
  x: number;
  y: number;
}

export interface TetrisDropState {
  board: Board;
  piece: Piece;
  next: number;
  score: number;
  lines: number;
  timeLeft: number;
  dropTimer: number;
  phase: 'playing' | 'over';
  /** Returns a number in [0, 1); picks the next piece. */
  random: () => number;
}

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<BlockColor | null>(COLS).fill(null));
}

/** The piece with index `kind`, centred at the top of the board. */
export function spawnPiece(kind: number): Piece {
  const { rows, color } = SHAPES[kind];
  const shape = rows.map((row) => [...row].map((c) => c === '#'));
  return { shape, color, x: Math.floor((COLS - shape.length) / 2), y: 0 };
}

function pickKind(random: () => number): number {
  return Math.min(Math.floor(random() * PIECE_COUNT), PIECE_COUNT - 1);
}

export function createState(random: () => number = Math.random): TetrisDropState {
  return {
    board: emptyBoard(),
    piece: spawnPiece(pickKind(random)),
    next: pickKind(random),
    score: 0,
    lines: 0,
    timeLeft: ROUND_SECONDS,
    dropTimer: 0,
    phase: 'playing',
    random,
  };
}

/** True if the piece overlaps a block or sticks out of the board. */
export function collides(board: Board, piece: Piece): boolean {
  return piece.shape.some((row, dy) =>
    row.some((filled, dx) => {
      if (!filled) return false;
      const x = piece.x + dx;
      const y = piece.y + dy;
      return x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x] !== null;
    }),
  );
}

/** Removes every full row and returns how many it removed. */
export function clearRows(board: Board): number {
  const kept = board.filter((row) => row.some((cell) => cell === null));
  const cleared = ROWS - kept.length;
  const fresh = Array.from({ length: cleared }, () => Array<BlockColor | null>(COLS).fill(null));
  board.splice(0, ROWS, ...fresh, ...kept);
  return cleared;
}

export function scoreForLines(count: number): number {
  return LINE_POINTS[Math.min(count, LINE_POINTS.length - 1)];
}

/** Moves the piece sideways by `dx` columns. Returns false if it could not move. */
export function move(state: TetrisDropState, dx: number): boolean {
  if (state.phase !== 'playing') return false;
  const moved = { ...state.piece, x: state.piece.x + dx };
  if (collides(state.board, moved)) return false;
  state.piece = moved;
  return true;
}

/** Turns the piece clockwise, nudging it sideways if it would hit a wall. */
export function rotate(state: TetrisDropState): boolean {
  if (state.phase !== 'playing') return false;
  const { shape } = state.piece;
  const size = shape.length;
  const turned = shape.map((_, y) => shape.map((_, x) => shape[size - 1 - x][y]));
  for (const kick of [0, -1, 1, -2, 2]) {
    const candidate = { ...state.piece, shape: turned, x: state.piece.x + kick };
    if (!collides(state.board, candidate)) {
      state.piece = candidate;
      return true;
    }
  }
  return false;
}

/** Fixes the piece to the board, clears rows, scores them and brings on the next piece. */
function lock(state: TetrisDropState): void {
  const { piece, board } = state;
  piece.shape.forEach((row, dy) =>
    row.forEach((filled, dx) => {
      if (filled) board[piece.y + dy][piece.x + dx] = piece.color;
    }),
  );
  const cleared = clearRows(board);
  state.lines += cleared;
  state.score += scoreForLines(cleared);
  state.piece = spawnPiece(state.next);
  state.next = pickKind(state.random);
  state.dropTimer = 0;
  if (collides(board, state.piece)) state.phase = 'over';
}

/** Drops the piece one row, locking it if it has landed. Returns true if it locked. */
export function softDrop(state: TetrisDropState): boolean {
  if (state.phase !== 'playing') return false;
  const lower = { ...state.piece, y: state.piece.y + 1 };
  state.dropTimer = 0;
  if (collides(state.board, lower)) {
    lock(state);
    return true;
  }
  state.piece = lower;
  return false;
}

/** Drops the piece straight to the bottom and locks it. */
export function hardDrop(state: TetrisDropState): void {
  if (state.phase !== 'playing') return;
  while (!softDrop(state)) {
    // Keep falling until the piece locks.
  }
}

/** Advances the game by `dt` seconds. */
export function step(state: TetrisDropState, dt: number): void {
  if (state.phase !== 'playing') return;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft === 0) {
    state.phase = 'over';
    return;
  }
  state.dropTimer += dt;
  while (state.phase === 'playing' && state.dropTimer >= DROP_INTERVAL) {
    state.dropTimer -= DROP_INTERVAL;
    const lower = { ...state.piece, y: state.piece.y + 1 };
    if (collides(state.board, lower)) lock(state);
    else state.piece = lower;
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: BlockColor) {
  ctx.fillStyle = theme.colors[color];
  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
}

function draw(ctx: CanvasRenderingContext2D, state: TetrisDropState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning down each side of the board.
  const stripe = HEIGHT / 10;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(0, i * stripe, 24, stripe);
    ctx.fillRect(WIDTH - 24, i * stripe, 24, stripe);
  }

  ctx.fillStyle = colors.wood;
  ctx.fillRect(BOARD_X - 6, BOARD_Y - 6, COLS * CELL + 12, ROWS * CELL + 12);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);

  state.board.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell) drawBlock(ctx, BOARD_X + x * CELL, BOARD_Y + y * CELL, cell);
    }),
  );

  const { piece } = state;
  if (state.phase === 'playing') {
    piece.shape.forEach((row, dy) =>
      row.forEach((filled, dx) => {
        if (filled) {
          drawBlock(
            ctx,
            BOARD_X + (piece.x + dx) * CELL,
            BOARD_Y + (piece.y + dy) * CELL,
            piece.color,
          );
        }
      }),
    );
  }

  const sideX = BOARD_X + COLS * CELL + 40;
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'left';
  ctx.font = canvasFont('body', 'bold');
  ctx.fillText(`Score ${state.score}`, sideX, BOARD_Y + 20);
  ctx.fillText(`Rows ${state.lines}`, sideX, BOARD_Y + 50);
  ctx.fillStyle = state.timeLeft <= 10 ? colors.danger : colors.text;
  ctx.fillText(`Time ${Math.ceil(state.timeLeft)}`, sideX, BOARD_Y + 80);

  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small');
  ctx.fillText('Next', sideX, BOARD_Y + 120);
  const next = spawnPiece(state.next);
  next.shape.forEach((row, dy) =>
    row.forEach((filled, dx) => {
      if (filled) drawBlock(ctx, sideX + dx * CELL, BOARD_Y + 132 + dy * CELL, next.color);
    }),
  );

  const helpX = BOARD_X - 40;
  ctx.textAlign = 'right';
  ['← → move', '↑ turn', '↓ drop one row', 'Space drop'].forEach((line, i) =>
    ctx.fillText(line, helpX, BOARD_Y + 20 + i * 24),
  );

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    const headline = state.timeLeft === 0 ? "Time's up!" : 'Stacked out!';
    ctx.fillText(`${headline} You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press Enter to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const tetrisDrop: CarnivalGame = {
  id: 'tetris-drop',
  name: 'Tetris Drop',
  description: 'Stack the falling blocks and clear rows before the clock runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const restart = () => {
      state = createState();
      scoreRecorded = false;
    };
    const onKey = (event: KeyboardEvent) => {
      const actions: Record<string, () => unknown> = {
        ArrowLeft: () => move(state, -1),
        ArrowRight: () => move(state, 1),
        ArrowUp: () => rotate(state),
        ArrowDown: () => softDrop(state),
        ' ': () => hardDrop(state),
      };
      if (state.phase === 'over') {
        if (event.key === 'Enter') restart();
        return;
      }
      const action = actions[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    const onDown = () => {
      if (state.phase === 'over') restart();
    };
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't drop a whole stack at once.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(tetrisDrop.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default tetrisDrop;
