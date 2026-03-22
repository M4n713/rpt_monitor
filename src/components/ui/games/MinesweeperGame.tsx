import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/src/components/ui/button';

export function MinesweeperGame({ onComplete, level = 1 }: { onComplete: () => void, level?: number }) {
  const ROWS = 5 + (level - 1);
  const COLS = 5 + (level - 1);
  const MINES = 3 + (level - 1) * 2;

  const [grid, setGrid] = useState<any[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const initGame = useCallback(() => {
    let newGrid = Array(ROWS).fill(null).map(() => Array(COLS).fill(null).map(() => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborMines: 0
    })));

    let minesPlaced = 0;
    while (minesPlaced < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (!newGrid[r][c].isMine) {
        newGrid[r][c].isMine = true;
        minesPlaced++;
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!newGrid[r][c].isMine) {
          let count = 0;
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              if (r + i >= 0 && r + i < ROWS && c + j >= 0 && c + j < COLS) {
                if (newGrid[r + i][c + j].isMine) count++;
              }
            }
          }
          newGrid[r][c].neighborMines = count;
        }
      }
    }

    setGrid(newGrid);
    setGameOver(false);
    setWon(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const revealCell = (r: number, c: number) => {
    if (gameOver || won || grid[r][c].isRevealed || grid[r][c].isFlagged) return;

    const newGrid = grid.map(row => row.map(cell => ({...cell})));
    if (newGrid[r][c].isMine) {
      setGameOver(true);
      // Reveal all mines
      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          if (newGrid[i][j].isMine) newGrid[i][j].isRevealed = true;
        }
      }
      setGrid(newGrid);
      return;
    }

    const revealEmpty = (row: number, col: number) => {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS || newGrid[row][col].isRevealed) return;
      newGrid[row][col].isRevealed = true;
      if (newGrid[row][col].neighborMines === 0) {
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            revealEmpty(row + i, col + j);
          }
        }
      }
    };

    revealEmpty(r, c);
    setGrid(newGrid);

    // Check win
    let unrevealedSafe = 0;
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (!newGrid[i][j].isMine && !newGrid[i][j].isRevealed) unrevealedSafe++;
      }
    }
    if (unrevealedSafe === 0) {
      setWon(true);
      onComplete();
    }
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (gameOver || won || grid[r][c].isRevealed) return;
    const newGrid = grid.map(row => row.map(cell => ({...cell})));
    newGrid[r][c].isFlagged = !newGrid[r][c].isFlagged;
    setGrid(newGrid);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-sm font-semibold text-gray-700">Find all safe squares! (LVL {level})</div>
      <div className="grid gap-1 bg-gray-300 p-2 rounded" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {grid.map((row, r) => row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            onClick={() => revealCell(r, c)}
            onContextMenu={(e) => toggleFlag(e, r, c)}
            className={`w-10 h-10 flex items-center justify-center text-lg font-bold cursor-pointer select-none
              ${cell.isRevealed 
                ? (cell.isMine ? 'bg-red-500' : 'bg-gray-100') 
                : 'bg-gray-400 hover:bg-gray-500 border-2 border-t-white border-l-white border-b-gray-600 border-r-gray-600'
              }
            `}
          >
            {cell.isRevealed && !cell.isMine && cell.neighborMines > 0 && cell.neighborMines}
            {cell.isRevealed && cell.isMine && '💣'}
            {!cell.isRevealed && cell.isFlagged && '🚩'}
          </div>
        )))}
      </div>
      {(gameOver || won) && (
        <div className="flex flex-col items-center">
          <div className={`text-lg font-bold ${won ? 'text-green-600' : 'text-red-600'}`}>
            {won ? 'You Won!' : 'Game Over!'}
          </div>
          {!won && <Button onClick={initGame} className="mt-2" variant="outline" size="sm">Try Again</Button>}
        </div>
      )}
    </div>
  );
}
