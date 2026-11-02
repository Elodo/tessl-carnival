import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 60;
export const WRONG_PENALTY = 10;
export const POINTS_PER_PUZZLE = 100;
export const POINTS_PER_SECOND_LEFT = 5;
export const SQUARE_SIZE = 50;
export const BOARD = { x: (WIDTH - SQUARE_SIZE * 8) / 2, y: 50 } as const;
const FILES = 'abcdefgh';

export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type Side = 'white' | 'black';

export interface Piece {
  type: PieceType;
  side: Side;
}

export interface Move {
  from: string;
  to: string;
}

export interface Puzzle {
  /** What the player is asked to find, e.g. "Mate in one". */
  goal: string;
  /** Pieces by square, such as `{ g1: 'wK', g8: 'bK' }`. */
  position: Record<string, string>;
  /** Every move that solves it. White is always to move. */
  solutions: Move[];
}

export const PUZZLES: readonly Puzzle[] = [
  {
    goal: 'Mate in one',
    position: {
      g1: 'wK',
      a1: 'wR',
      f2: 'wP',
      g2: 'wP',
      h2: 'wP',
      g8: 'bK',
      f7: 'bP',
      g7: 'bP',
      h7: 'bP',
    },
    solutions: [{ from: 'a1', to: 'a8' }],
  },
  {
    goal: 'Mate in one',
    position: {
      e1: 'wK',
      h5: 'wQ',
      g5: 'wN',
      e8: 'bK',
      d8: 'bQ',
      f8: 'bB',
      d7: 'bP',
      e7: 'bP',
      f7: 'bP',
    },
    solutions: [{ from: 'h5', to: 'f7' }],
  },
  {
    goal: 'Smothered mate in one',
    position: { g1: 'wK', g5: 'wN', h8: 'bK', g8: 'bR', g7: 'bP', h7: 'bP' },
    solutions: [{ from: 'g5', to: 'f7' }],
  },
  {
    goal: 'Mate in one',
    position: { g6: 'wK', a1: 'wR', g8: 'bK' },
    solutions: ['a8', 'b8', 'c8', 'd8', 'e8'].map((to) => ({ from: 'a1', to })),
  },
  {
    goal: 'Fork the king and win the rook',
    position: { g1: 'wK', b5: 'wN', e8: 'bK', a8: 'bR', f7: 'bP', g7: 'bP' },
    solutions: [{ from: 'b5', to: 'c7' }],
  },
  {
    goal: 'Mate in one',
    position: { g1: 'wK', d3: 'wB', h5: 'wQ', h8: 'bK', f8: 'bR', g7: 'bP', h7: 'bP' },
    solutions: [{ from: 'h5', to: 'h7' }],
  },
];

export interface Feedback {
  correct: boolean;
  age: number;
}

export interface ChessChallengeState {
  puzzles: Puzzle[];
  index: number;
  selected: string | null;
  timeLeft: number;
  score: number;
  solved: number;
  feedback: Feedback | null;
  phase: 'playing' | 'over';
}

/** Starts a round with the puzzles in a shuffled order. */
export function createState(random: () => number = Math.random): ChessChallengeState {
  const puzzles = [...PUZZLES];
  for (let i = puzzles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [puzzles[i], puzzles[j]] = [puzzles[j], puzzles[i]];
  }
  return {
    puzzles,
    index: 0,
    selected: null,
    timeLeft: ROUND_SECONDS,
    score: 0,
    solved: 0,
    feedback: null,
    phase: 'playing',
  };
}

export function currentPuzzle(state: ChessChallengeState): Puzzle | undefined {
  return state.puzzles[state.index];
}

export function pieceAt(puzzle: Puzzle, square: string): Piece | null {
  const code = puzzle.position[square];
  if (!code) return null;
  return { side: code[0] === 'w' ? 'white' : 'black', type: code[1] as PieceType };
}

/** The square under a point on the canvas, such as 'e4', or null off the board. */
export function squareAt(x: number, y: number): string | null {
  const file = Math.floor((x - BOARD.x) / SQUARE_SIZE);
  const row = Math.floor((y - BOARD.y) / SQUARE_SIZE);
  if (file < 0 || file > 7 || row < 0 || row > 7) return null;
  return `${FILES[file]}${8 - row}`;
}

/** Bonus for clearing every puzzle: 5 points per whole second left. */
export function timeBonus(timeLeft: number): number {
  return POINTS_PER_SECOND_LEFT * Math.floor(Math.max(timeLeft, 0));
}

function endRound(state: ChessChallengeState) {
  state.phase = 'over';
  state.selected = null;
}

/**
 * Plays a move on the current puzzle. The right move scores; any other move
 * costs time. Either way the next puzzle comes up.
 */
export function playMove(state: ChessChallengeState, from: string, to: string): boolean {
  const puzzle = currentPuzzle(state);
  if (state.phase !== 'playing' || !puzzle) return false;
  const correct = puzzle.solutions.some((move) => move.from === from && move.to === to);
  state.selected = null;
  state.feedback = { correct, age: 0 };
  if (correct) {
    state.score += POINTS_PER_PUZZLE;
    state.solved += 1;
  } else {
    state.timeLeft = Math.max(state.timeLeft - WRONG_PENALTY, 0);
  }
  state.index += 1;
  if (state.timeLeft === 0) {
    endRound(state);
  } else if (state.index >= state.puzzles.length) {
    state.score += timeBonus(state.timeLeft);
    endRound(state);
  }
  return correct;
}

/**
 * Handles a click on a square: the first click picks up one of white's pieces,
 * the next click plays it. Clicking another white piece picks that one up instead.
 */
export function clickSquare(state: ChessChallengeState, square: string): void {
  const puzzle = currentPuzzle(state);
  if (state.phase !== 'playing' || !puzzle) return;
  const piece = pieceAt(puzzle, square);
  if (piece?.side === 'white') {
    state.selected = state.selected === square ? null : square;
  } else if (state.selected) {
    playMove(state, state.selected, square);
  }
}

/** Advances the clock by `dt` seconds. */
export function step(state: ChessChallengeState, dt: number): void {
  if (state.feedback) {
    state.feedback.age += dt;
    if (state.feedback.age > 0.6) state.feedback = null;
  }
  if (state.phase !== 'playing') return;
  state.timeLeft = Math.max(state.timeLeft - dt, 0);
  if (state.timeLeft === 0) endRound(state);
}

const GLYPHS: Record<PieceType, string> = {
  K: '♚',
  Q: '♛',
  R: '♜',
  B: '♝',
  N: '♞',
  P: '♟',
};

function draw(ctx: CanvasRenderingContext2D, state: ChessChallengeState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  const puzzle = currentPuzzle(state);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < 8; row++) {
    for (let file = 0; file < 8; file++) {
      const square = `${FILES[file]}${8 - row}`;
      const x = BOARD.x + file * SQUARE_SIZE;
      const y = BOARD.y + row * SQUARE_SIZE;
      ctx.fillStyle = (row + file) % 2 === 0 ? colors.muted : colors.wood;
      ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);
      if (square === state.selected) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 2, y + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4);
      }
      const piece = puzzle && pieceAt(puzzle, square);
      if (piece) {
        ctx.font = canvasFont('title');
        ctx.lineWidth = 2;
        ctx.strokeStyle = piece.side === 'white' ? colors.background : colors.text;
        ctx.fillStyle = piece.side === 'white' ? colors.text : colors.background;
        ctx.strokeText(GLYPHS[piece.type], x + SQUARE_SIZE / 2, y + SQUARE_SIZE / 2 + 2);
        ctx.fillText(GLYPHS[piece.type], x + SQUARE_SIZE / 2, y + SQUARE_SIZE / 2 + 2);
      }
    }
  }

  if (state.feedback) {
    ctx.globalAlpha = 0.4 * (1 - state.feedback.age / 0.6);
    ctx.fillStyle = state.feedback.correct ? colors.water : colors.danger;
    ctx.fillRect(BOARD.x, BOARD.y, SQUARE_SIZE * 8, SQUARE_SIZE * 8);
    ctx.globalAlpha = 1;
  }

  // Side panels.
  const panel = BOARD.x / 2;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.fillText(`Score ${state.score}`, panel, 100);
  ctx.fillText(`Time ${Math.ceil(state.timeLeft)}`, panel, 140);
  ctx.font = canvasFont('small');
  ctx.fillStyle = colors.muted;
  ctx.fillText(
    `Puzzle ${Math.min(state.index + 1, state.puzzles.length)}/${state.puzzles.length}`,
    panel,
    180,
  );

  if (puzzle) {
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('body', 'bold');
    ctx.fillText('White to move', WIDTH - panel, 100);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('small');
    wrapText(ctx, puzzle.goal, WIDTH - panel, 135, BOARD.x - 20);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Checkmate! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText(
      `${state.solved} of ${state.puzzles.length} solved. Click to play again`,
      WIDTH / 2,
      HEIGHT / 2 + 40,
    );
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
) {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      ctx.fillText(line, x, y);
      line = word;
      y += 20;
    } else {
      line = next;
    }
  }
  ctx.fillText(line, x, y);
}

export const chessChallenge: CarnivalGame = {
  id: 'chess-challenge',
  name: 'Chess Challenge',
  description: 'Find the winning move before the clock runs out. Wrong moves cost time.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const square = squareAt(
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
      if (square) clickSquare(state, square);
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't eat the clock in one go.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(chessChallenge.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default chessChallenge;
