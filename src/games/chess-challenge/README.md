# Chess Challenge

Find the winning move in a run of quick chess puzzles before the clock runs out.
White is always to move, and each puzzle tells you what to look for, such as
"Mate in one".

## How to play

- Click one of white's pieces to pick it up. It gets a gold outline. Click it
  again to put it down, or click another white piece to pick that one up instead.
- Click the square to move it to. The move is checked straight away, and the
  next puzzle comes up whether it was right or wrong.
- You have 60 seconds for all six puzzles, which come in a random order. The
  round ends when you have tried every puzzle or the clock reaches zero.
- Click on the game over screen to play another round.

The game checks your move against the puzzle's answer; it does not check
whether the move is legal.

## Scoring

| What                                  | Points or time                      |
| ------------------------------------- | ----------------------------------- |
| The winning move                      | 100 points                          |
| Any other move                        | 10 seconds off the clock            |
| Trying every puzzle before time is up | 5 points for each whole second left |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the puzzles (`PUZZLES`), the game logic (`createState`,
  `clickSquare`, `playMove`, `step`, `squareAt`, `timeBonus`) and the
  `chessChallenge` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
