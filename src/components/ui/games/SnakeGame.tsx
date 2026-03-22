import { useState, useEffect, useCallback } from 'react';

const GRID_SIZE = 20;
const CELL_SIZE = 15;

export function SnakeGame({ onComplete, level = 1 }: { onComplete: () => void, level?: number }) {
  const targetScore = 5 + (level - 1) * 3;
  const tickInterval = 150 - (level - 1) * 15;
  
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [score, setScore] = useState(0);

  const resetFood = useCallback(() => {
    setFood({
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && direction.y === 0) setDirection({ x: 0, y: -1 });
      if (e.key === 'ArrowDown' && direction.y === 0) setDirection({ x: 0, y: 1 });
      if (e.key === 'ArrowLeft' && direction.x === 0) setDirection({ x: -1, y: 0 });
      if (e.key === 'ArrowRight' && direction.x === 0) setDirection({ x: 1, y: 0 });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSnake((prev) => {
        const newSnake = [...prev];
        const head = { x: newSnake[0].x + direction.x, y: newSnake[0].y + direction.y };
        
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE || 
            newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          setScore(0);
          return [{ x: 10, y: 10 }];
        }

        newSnake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          const newScore = score + 1;
          setScore(newScore);
          resetFood();
          if (newScore >= targetScore) onComplete();
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, tickInterval);
    return () => clearInterval(timer);
  }, [direction, food, score, onComplete, resetFood, targetScore, tickInterval]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-gray-50">
      <p className="font-bold">Snake Challenge (LVL {level})</p>
      <div 
        className="relative bg-black rounded-lg"
        style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}
      >
        {snake.map((segment, i) => (
          <div key={i} className="absolute bg-green-500" style={{ width: CELL_SIZE, height: CELL_SIZE, left: segment.x * CELL_SIZE, top: segment.y * CELL_SIZE }} />
        ))}
        <div className="absolute bg-red-500" style={{ width: CELL_SIZE, height: CELL_SIZE, left: food.x * CELL_SIZE, top: food.y * CELL_SIZE }} />
      </div>
      <p>Score: {score}/{targetScore}</p>
    </div>
  );
}
