import { describe, expect, it } from 'vitest';
import {
  COLS,
  DROP_INTERVAL,
  ROUND_SECONDS,
  ROWS,
  clearRows,
  collides,
  createState,
  emptyBoard,
  hardDrop,
  move,
  rotate,
  scoreForLines,
  softDrop,
  spawnPiece,
  step,
} from './game';

const O = 1;
const T = 2;
/** Always picks the O piece. */
const alwaysO = () => O / 7;

function fillRow(board: ReturnType<typeof emptyBoard>, y: number, gapAt?: number) {
  for (let x = 0; x < COLS; x++) board[y][x] = x === gapAt ? null : 'wood';
}

describe('tetris drop', () => {
  it('starts with an empty board, no score and a full clock', () => {
    const state = createState(alwaysO);
    expect(state.board.flat().every((cell) => cell === null)).toBe(true);
    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
    expect(state.timeLeft).toBe(ROUND_SECONDS);
    expect(state.phase).toBe('playing');
  });

  it('drops the piece one row every drop interval', () => {
    const state = createState(alwaysO);
    const y = state.piece.y;
    step(state, DROP_INTERVAL);
    expect(state.piece.y).toBe(y + 1);
  });

  it('moves sideways but not through the wall', () => {
    const state = createState(alwaysO);
    expect(move(state, -1)).toBe(true);
    while (move(state, -1)) {
      // Slide to the left wall.
    }
    expect(state.piece.x).toBe(0);
    expect(move(state, -1)).toBe(false);
  });

  it('rotates a piece clockwise', () => {
    const state = createState(() => T / 7);
    rotate(state);
    expect(state.piece.shape).toEqual([
      [false, true, false],
      [false, true, true],
      [false, true, false],
    ]);
  });

  it('nudges a turning piece off the wall instead of refusing', () => {
    const state = createState(() => 0); // I piece
    rotate(state);
    while (move(state, -1)) {
      // Slide the upright I to the left wall.
    }
    expect(rotate(state)).toBe(true);
    expect(collides(state.board, state.piece)).toBe(false);
  });

  it('hard drop lands the piece on the floor and brings on the next', () => {
    const state = createState(alwaysO);
    hardDrop(state);
    expect(state.board[ROWS - 1].filter(Boolean)).toHaveLength(2);
    expect(state.board[ROWS - 2].filter(Boolean)).toHaveLength(2);
    expect(state.piece.y).toBe(0);
  });

  it('clears full rows and drops the rows above', () => {
    const board = emptyBoard();
    fillRow(board, ROWS - 1);
    fillRow(board, ROWS - 2, 3);
    board[ROWS - 3][5] = 'accent';
    expect(clearRows(board)).toBe(1);
    expect(board).toHaveLength(ROWS);
    expect(board[ROWS - 1][3]).toBeNull();
    expect(board[ROWS - 1][4]).toBe('wood');
    expect(board[ROWS - 2][5]).toBe('accent');
    expect(board[0].every((cell) => cell === null)).toBe(true);
  });

  it('scores cleared rows when a piece locks', () => {
    const state = createState(alwaysO);
    // Two rows full except for the two columns the O piece falls into.
    const { x } = state.piece;
    for (const y of [ROWS - 1, ROWS - 2]) {
      fillRow(state.board, y);
      state.board[y][x] = null;
      state.board[y][x + 1] = null;
    }
    hardDrop(state);
    expect(state.lines).toBe(2);
    expect(state.score).toBe(scoreForLines(2));
    expect(state.board.flat().every((cell) => cell === null)).toBe(true);
  });

  it('pays more for clearing several rows at once', () => {
    expect(scoreForLines(0)).toBe(0);
    expect(scoreForLines(1)).toBe(100);
    expect(scoreForLines(4)).toBe(800);
    expect(scoreForLines(2)).toBeGreaterThan(2 * scoreForLines(1));
  });

  it('ends the round when the clock runs out', () => {
    const state = createState(alwaysO);
    state.timeLeft = 0.01;
    step(state, 0.05);
    expect(state.timeLeft).toBe(0);
    expect(state.phase).toBe('over');
  });

  it('ends the round when a new piece has no room', () => {
    const state = createState(alwaysO);
    for (let y = 2; y < ROWS; y++) fillRow(state.board, y, 0);
    hardDrop(state);
    expect(state.phase).toBe('over');
  });

  it('ignores moves once the round is over', () => {
    const state = createState(alwaysO);
    state.phase = 'over';
    const before = { ...state.piece };
    expect(move(state, 1)).toBe(false);
    expect(rotate(state)).toBe(false);
    expect(softDrop(state)).toBe(false);
    step(state, 10);
    expect(state.piece).toEqual(before);
  });

  it('spawns pieces inside the board', () => {
    for (let kind = 0; kind < 7; kind++) {
      expect(collides(emptyBoard(), spawnPiece(kind))).toBe(false);
    }
  });
});
