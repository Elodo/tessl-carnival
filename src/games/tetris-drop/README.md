# Tetris Drop

Stack the falling blocks and clear rows before the clock runs out.

## How to play

- **Left** and **right** arrows move the piece one column.
- **Up** arrow turns the piece clockwise. Next to a wall it shifts over to make room.
- **Down** arrow drops the piece one row.
- **Space** drops the piece straight to the bottom.
- The piece also falls one row every half second on its own. It locks when it lands.
- A round lasts 90 seconds. It also ends early if a new piece has no room at the top.
- Click or press **Enter** on the game over screen to play another round.

## Scoring

A full row clears when a piece locks. One piece that clears several rows at
once scores more:

| Rows cleared | Points |
| ------------ | ------ |
| 1            | 100    |
| 2            | 300    |
| 3            | 500    |
| 4            | 800    |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `move`, `rotate`, `softDrop`, `hardDrop`,
  `step`, `clearRows`, `scoreForLines`) and the `tetrisDrop` entry, the default
  export the midway finds.
- `game.test.ts`: tests for the game logic.
