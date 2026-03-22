import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/src/components/ui/button';

export function FallingBrickGame({ onComplete, level = 1 }: { onComplete: () => void, level?: number }) {
  const ROWS = 12;
  const COLS = 8;
  const EMPTY = 0;
  const linesRequired = 1 + (level - 1);
  const fallInterval = 500 - (level - 1) * 75;

  const [grid, setGrid] = useState<number[][]>(Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY)));
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [linesClearedTotal, setLinesClearedTotal] = useState(0);
  
  const pieceRef = useRef({
    shape: [[1, 1], [1, 1]],
    r: 0,
    c: 3
  });

  const gridRef = useRef(grid);
  const gameOverRef = useRef(gameOver);
  const wonRef = useRef(won);

  useEffect(() => {
    gridRef.current = grid;
    gameOverRef.current = gameOver;
    wonRef.current = won;
  }, [grid, gameOver, won]);

  const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1]], // T
    [[1, 0, 0], [1, 1, 1]], // L
    [[0, 0, 1], [1, 1, 1]], // J
    [[0, 1, 1], [1, 1, 0]], // S
    [[1, 1, 0], [0, 1, 1]]  // Z
  ];

  const checkCollision = useCallback((shape: number[][], r: number, c: number) => {
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j]) {
          const newR = r + i;
          const newC = c + j;
          if (newR >= ROWS || newC < 0 || newC >= COLS || (newR >= 0 && gridRef.current[newR][newC])) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const spawnPiece = useCallback(() => {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    pieceRef.current = {
      shape,
      r: 0,
      c: Math.floor((COLS - shape[0].length) / 2)
    };
    
    // Check if spawn is blocked
    if (checkCollision(pieceRef.current.shape, pieceRef.current.r, pieceRef.current.c)) {
      setGameOver(true);
    }
  }, [checkCollision]);

  const initGame = useCallback(() => {
    setGrid(Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY)));
    setGameOver(false);
    setWon(false);
    spawnPiece();
  }, [spawnPiece]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const mergePiece = useCallback(() => {
    const newGrid = gridRef.current.map(row => [...row]);
    const { shape, r, c } = pieceRef.current;
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j] && r + i >= 0) {
          newGrid[r + i][c + j] = 1;
        }
      }
    }

    // Check lines
    let linesCleared = 0;
    for (let i = ROWS - 1; i >= 0; i--) {
      if (newGrid[i].every(cell => cell !== EMPTY)) {
        newGrid.splice(i, 1);
        newGrid.unshift(Array(COLS).fill(EMPTY));
        linesCleared++;
        i++; // Check the same row again since everything shifted down
      }
    }

    setGrid(newGrid);

    if (linesCleared > 0) {
      setLinesClearedTotal(prev => {
        const next = prev + linesCleared;
        if (next >= linesRequired) {
          setWon(true);
          onComplete();
        }
        return next;
      });
      if (linesClearedTotal + linesCleared < linesRequired) {
        spawnPiece();
      }
    } else {
      spawnPiece();
    }
  }, [onComplete, spawnPiece]);

  const moveDown = useCallback(() => {
    if (gameOverRef.current || wonRef.current) return;
    
    if (!checkCollision(pieceRef.current.shape, pieceRef.current.r + 1, pieceRef.current.c)) {
      pieceRef.current.r++;
      setGrid([...gridRef.current]); // Force re-render
    } else {
      mergePiece();
    }
  }, [checkCollision, mergePiece]);

  useEffect(() => {
    const interval = setInterval(moveDown, fallInterval);
    return () => clearInterval(interval);
  }, [moveDown, fallInterval]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current || wonRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'ArrowLeft') {
        if (!checkCollision(pieceRef.current.shape, pieceRef.current.r, pieceRef.current.c - 1)) {
          pieceRef.current.c--;
          setGrid([...gridRef.current]);
        }
      } else if (e.key === 'ArrowRight') {
        if (!checkCollision(pieceRef.current.shape, pieceRef.current.r, pieceRef.current.c + 1)) {
          pieceRef.current.c++;
          setGrid([...gridRef.current]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveDown();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // Rotate
        const shape = pieceRef.current.shape;
        const newShape = shape[0].map((_, i) => shape.map(row => row[i]).reverse());
        if (!checkCollision(newShape, pieceRef.current.r, pieceRef.current.c)) {
          pieceRef.current.shape = newShape;
          setGrid([...gridRef.current]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveDown, checkCollision]);

  // Render grid with current piece
  const displayGrid = grid.map(row => [...row]);
  if (!gameOver && !won) {
    const { shape, r, c } = pieceRef.current;
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j] && r + i >= 0 && r + i < ROWS && c + j >= 0 && c + j < COLS) {
          displayGrid[r + i][c + j] = 2; // 2 represents active piece
        }
      }
    }
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-sm font-semibold text-gray-700">Clear {linesRequired} line{linesRequired > 1 ? 's' : ''} to login! (LVL {level})</div>
      <div className="text-xs text-gray-500">Progress: {linesClearedTotal}/{linesRequired}</div>
      <div className="text-xs text-gray-500">Use arrow keys to move and rotate</div>
      <div className="bg-gray-300 p-1 rounded">
        {displayGrid.map((row, r) => (
          <div key={r} className="flex">
            {row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className={`w-6 h-6 border border-gray-400
                  ${cell === 0 ? 'bg-gray-100' : cell === 1 ? 'bg-indigo-600' : 'bg-indigo-400'}
                `}
              />
            ))}
          </div>
        ))}
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
