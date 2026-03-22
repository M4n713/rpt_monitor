import React, { useState, useEffect, useCallback, useRef } from 'react';

interface GeometryDashGameProps {
  onComplete: () => void;
  level?: number;
}

const GAME_WIDTH = 300;
const GAME_HEIGHT = 150;
const PLAYER_SIZE = 20;
const SPIKE_SIZE = 20;
const GRAVITY = 0.6;
const JUMP_STRENGTH = -8;
const GROUND_Y = GAME_HEIGHT - PLAYER_SIZE;

export function GeometryDashGame({ onComplete, level = 1 }: GeometryDashGameProps) {
  const targetScore = 5 + (level - 1) * 2;
  const speed = 4 + (level - 1) * 0.5;
  
  const [playerY, setPlayerY] = useState(GROUND_Y);
  const [playerVelocity, setPlayerVelocity] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [spikes, setSpikes] = useState<{ x: number, id: number }[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  const gameRef = useRef<HTMLDivElement>(null);
  const spikeIdCounter = useRef(0);
  const frameRef = useRef<number>(0);

  const jump = useCallback(() => {
    if (!isJumping && !gameOver) {
      setPlayerVelocity(JUMP_STRENGTH);
      setIsJumping(true);
    }
    if (gameOver) {
      resetGame();
    }
  }, [isJumping, gameOver]);

  const resetGame = () => {
    setPlayerY(GROUND_Y);
    setPlayerVelocity(0);
    setIsJumping(false);
    setSpikes([]);
    setScore(0);
    setGameOver(false);
    spikeIdCounter.current = 0;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  useEffect(() => {
    if (gameOver) return;

    const update = () => {
      // Update Player
      setPlayerY((y) => {
        let newY = y + playerVelocity;
        if (newY >= GROUND_Y) return GROUND_Y;
        return newY;
      });

      setPlayerVelocity((v) => {
        let newVel = v + GRAVITY;
        if (playerY >= GROUND_Y && newVel > 0) return 0;
        return newVel;
      });

      if (playerY >= GROUND_Y && isJumping) {
        setIsJumping(false);
      }

      // Update Spikes
      setSpikes((prevSpikes) => {
        const nextSpikes = prevSpikes
          .map(s => ({ ...s, x: s.x - speed }))
          .filter(s => s.x > -SPIKE_SIZE);

        // Collision Check
        const collision = nextSpikes.some(s => 
          s.x < 40 + PLAYER_SIZE && 
          s.x + SPIKE_SIZE > 40 && 
          playerY + PLAYER_SIZE > GROUND_Y
        );

        if (collision) {
          setGameOver(true);
          return prevSpikes;
        }

        // Scoring
        const passedSpikes = prevSpikes.filter(s => s.x >= 40 && s.x - speed < 40);
        if (passedSpikes.length > 0) {
          setScore(s => {
            const newScore = s + passedSpikes.length;
            if (newScore >= targetScore) onComplete();
            return newScore;
          });
        }

        // Spawn new spike
        if (nextSpikes.length === 0 || (GAME_WIDTH - nextSpikes[nextSpikes.length - 1].x > 150 && Math.random() < 0.02)) {
          nextSpikes.push({ x: GAME_WIDTH, id: spikeIdCounter.current++ });
        }

        return nextSpikes;
      });

      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playerVelocity, playerY, gameOver, onComplete, targetScore, speed]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-gray-50 select-none">
      <div className="flex justify-between w-full px-2">
        <p className="font-bold text-indigo-600 italic tracking-tighter">GEOMETRY DASH (LVL {level})</p>
        <p className="text-sm font-medium">Score: <span className="text-indigo-600">{score}</span>/{targetScore}</p>
      </div>
      
      <div 
        ref={gameRef}
        className="relative bg-white border-b-4 border-indigo-500 overflow-hidden cursor-pointer"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        onClick={jump}
      >
        {/* Player */}
        <div 
          className="absolute bg-indigo-500 rounded-sm shadow-sm transition-transform"
          style={{ 
            width: PLAYER_SIZE, 
            height: PLAYER_SIZE, 
            left: 40, 
            top: playerY,
            transform: isJumping ? `rotate(${score * 90}deg)` : 'none'
          }}
        />

        {/* Spikes */}
        {spikes.map(spike => (
          <div 
            key={spike.id}
            className="absolute bottom-0 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-red-500"
            style={{ left: spike.x }}
          />
        ))}

        {gameOver && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 text-center">
            <p className="text-xl font-bold mb-2">CRASHED!</p>
            <p className="text-sm opacity-90">Click or press Space to try again</p>
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-500">Tap or press Space to jump</p>
    </div>
  );
}
