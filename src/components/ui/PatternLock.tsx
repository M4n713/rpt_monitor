import React, { useState, useRef, useEffect, useCallback } from 'react';

interface PatternLockProps {
  letters: string[]; // Array of 9 letters
  onComplete: (pattern: number[]) => void;
  onReset: () => void;
  size?: number;
}

export function PatternLock({ letters, onComplete, onReset, size = 300 }: PatternLockProps) {
  const [path, setPath] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<{ x: number; y: number }[]>([]);

  const GRID_SIZE = 3;
  const NODE_RADIUS = size / 10;
  const PADDING = size / 6;
  const SPACING = (size - 2 * PADDING) / (GRID_SIZE - 1);

  useEffect(() => {
    const positions = [];
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / GRID_SIZE);
      const col = i % GRID_SIZE;
      positions.push({
        x: PADDING + col * SPACING,
        y: PADDING + row * SPACING,
      });
    }
    setNodePositions(positions);
  }, [size]);

  const getTouchedNode = (clientX: number, clientY: number) => {
    if (!containerRef.current) return -1;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = 0; i < nodePositions.length; i++) {
      const pos = nodePositions[i];
      const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      if (dist <= NODE_RADIUS * 1.5) {
        return i;
      }
    }
    return -1;
  };

  const handleStart = (clientX: number, clientY: number) => {
    setIsDrawing(true);
    const node = getTouchedNode(clientX, clientY);
    if (node !== -1) {
      setPath([node]);
    } else {
      setPath([]);
    }
    updateCurrentPos(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    updateCurrentPos(clientX, clientY);
    const node = getTouchedNode(clientX, clientY);
    if (node !== -1 && !path.includes(node)) {
      setPath((prev) => [...prev, node]);
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentPos(null);
    if (path.length > 0) {
      onComplete(path);
    }
  };

  const updateCurrentPos = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCurrentPos({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => handleEnd();

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    // e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    // e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };
  const onTouchEnd = () => handleEnd();

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        style={{ width: size, height: size, position: 'relative', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="bg-white rounded-xl shadow-inner border border-gray-200"
      >
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {/* Draw completed path lines */}
          {path.map((node, i) => {
            if (i === 0) return null;
            const prev = nodePositions[path[i - 1]];
            const curr = nodePositions[node];
            return (
              <line
                key={`line-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={curr.x}
                y2={curr.y}
                stroke="#4f46e5"
                strokeWidth={size / 30}
                strokeLinecap="round"
              />
            );
          })}
          {/* Draw current drawing line */}
          {isDrawing && path.length > 0 && currentPos && (
            <line
              x1={nodePositions[path[path.length - 1]].x}
              y1={nodePositions[path[path.length - 1]].y}
              x2={currentPos.x}
              y2={currentPos.y}
              stroke="#4f46e5"
              strokeWidth={size / 30}
              strokeLinecap="round"
              opacity={0.5}
            />
          )}
        </svg>

        {/* Draw nodes (letters) */}
        {nodePositions.map((pos, i) => {
          const isSelected = path.includes(i);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: pos.x - NODE_RADIUS,
                top: pos.y - NODE_RADIUS,
                width: NODE_RADIUS * 2,
                height: NODE_RADIUS * 2,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSelected ? '#4f46e5' : '#f3f4f6',
                color: isSelected ? 'white' : '#1f2937',
                fontWeight: 'bold',
                fontSize: NODE_RADIUS,
                boxShadow: isSelected ? '0 0 0 4px rgba(79, 70, 229, 0.2)' : 'none',
                transition: 'all 0.2s ease',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {letters[i]}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setPath([]);
            onReset();
          }}
          className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          Clear Pattern
        </button>
      </div>
    </div>
  );
}
