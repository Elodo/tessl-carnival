import { describe, expect, it } from 'vitest';
import {
  BOARD,
  POINTS_PER_PUZZLE,
  PUZZLES,
  ROUND_SECONDS,
  SQUARE_SIZE,
  WRONG_PENALTY,
  clickSquare,
  createState,
  currentPuzzle,
  pieceAt,
  playMove,
  squareAt,
  step,
  timeBonus,
} from './game';

function solve(state: ReturnType<typeof createState>) {
  const { from, to } = currentPuzzle(state)!.solutions[0];
  return playMove(state, from, to);
}

describe('chess challenge', () => {
  it('starts a round with every puzzle, a full clock and no score', () => {
    const state = createState();
    expect(state.puzzles).toHaveLength(PUZZLES.length);
    expect(new Set(state.puzzles)).toEqual(new Set(PUZZLES));
    expect(state.timeLeft).toBe(ROUND_SECONDS);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('gives every solution a white piece to move and a free target', () => {
    for (const puzzle of PUZZLES) {
      for (const move of puzzle.solutions) {
        expect(pieceAt(puzzle, move.from)?.side, puzzle.goal).toBe('white');
        expect(pieceAt(puzzle, move.to)?.side, puzzle.goal).not.toBe('white');
      }
    }
  });

  it('scores the winning move and moves on to the next puzzle', () => {
    const state = createState();
    expect(solve(state)).toBe(true);
    expect(state.score).toBe(POINTS_PER_PUZZLE);
    expect(state.solved).toBe(1);
    expect(state.index).toBe(1);
  });

  it('takes time off the clock for a wrong move, and scores nothing', () => {
    const state = createState();
    const { from } = currentPuzzle(state)!.solutions[0];
    expect(playMove(state, from, 'a2')).toBe(false);
    expect(state.score).toBe(0);
    expect(state.timeLeft).toBe(ROUND_SECONDS - WRONG_PENALTY);
    expect(state.index).toBe(1);
  });

  it('ends the round with a time bonus when every puzzle is solved', () => {
    const state = createState();
    while (state.phase === 'playing') solve(state);
    expect(state.solved).toBe(PUZZLES.length);
    expect(state.score).toBe(PUZZLES.length * POINTS_PER_PUZZLE + timeBonus(ROUND_SECONDS));
  });

  it('ends the round when the clock runs out', () => {
    const state = createState();
    step(state, ROUND_SECONDS - 1);
    expect(state.phase).toBe('playing');
    step(state, 2);
    expect(state.timeLeft).toBe(0);
    expect(state.phase).toBe('over');
  });

  it('ends the round with no bonus when a wrong move empties the clock', () => {
    const state = createState();
    state.timeLeft = WRONG_PENALTY - 1;
    playMove(state, 'a1', 'a2');
    expect(state.phase).toBe('over');
    expect(state.score).toBe(0);
  });

  it('ignores moves once the round is over', () => {
    const state = createState();
    step(state, ROUND_SECONDS);
    expect(solve(state)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('picks up a white piece with one click and plays it with the next', () => {
    const state = createState();
    const { from, to } = currentPuzzle(state)!.solutions[0];
    clickSquare(state, from);
    expect(state.selected).toBe(from);
    clickSquare(state, to);
    expect(state.selected).toBeNull();
    expect(state.score).toBe(POINTS_PER_PUZZLE);
  });

  it('does not pick up a black piece or an empty square', () => {
    const state = createState();
    const puzzle = currentPuzzle(state)!;
    const black = Object.keys(puzzle.position).find((sq) => pieceAt(puzzle, sq)?.side === 'black')!;
    clickSquare(state, black);
    expect(state.selected).toBeNull();
    expect(state.index).toBe(0);
  });

  it('maps canvas points to squares, with a8 top left and h1 bottom right', () => {
    expect(squareAt(BOARD.x + 1, BOARD.y + 1)).toBe('a8');
    expect(squareAt(BOARD.x + SQUARE_SIZE * 8 - 1, BOARD.y + SQUARE_SIZE * 8 - 1)).toBe('h1');
    expect(squareAt(BOARD.x - 1, BOARD.y + 1)).toBeNull();
  });

  it('gives 5 points per whole second left', () => {
    expect(timeBonus(12.7)).toBe(60);
    expect(timeBonus(-1)).toBe(0);
  });

  it('shuffles the puzzles with the given random source', () => {
    const order = createState(() => 0).puzzles;
    expect(order).not.toEqual([...PUZZLES]);
    expect(createState(() => 0).puzzles).toEqual(order);
  });
});
