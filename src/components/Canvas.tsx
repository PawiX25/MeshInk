'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect } from 'react-konva';
import { useChannel, useAbly } from 'ably/react';
import Konva from 'konva';
import { throttle } from 'lodash';
import { useTheme } from 'next-themes';
import clsx from 'clsx';
import { HexColorPicker } from 'react-colorful';

interface LineData {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'eraser';
}

interface StageState {
  scale: number;
  x: number;
  y: number;
}

const useClickOutside = (
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>;
const EraserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z" /><path d="M22 21H7" /><path d="m5 12 5 5" /></svg>;
const HandIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-4a2 2 0 1 1 0-4h4a4 4 0 1 0 0-8" /></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;

const ColorPicker = ({ color, onChange }: { color: string, onChange: (newColor: string) => void }) => {
  const popover = useRef<HTMLDivElement>(null);
  const [isOpen, toggle] = useState(false);
  const close = useCallback(() => toggle(false), []);
  useClickOutside(popover, close);

  return (
    <div className="relative">
      <button onClick={() => toggle(true)} className="w-10 h-10 rounded-lg border-2 border-slate-200 dark:border-slate-700" style={{ backgroundColor: color }} title="Select Color" />
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl" ref={popover}>
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  );
};

const Grid = ({ stage, width, height, theme }: { stage: StageState, width: number, height: number, theme: string | undefined }) => {
  const gridSize = 50;
  const strokeColor = theme === 'dark' ? '#2c3e50' : '#e0e0e0';
  const strokeWidth = 1;

  const lines = [];
  const scaledGridSize = gridSize * stage.scale;

  const stageRect = {
    x1: -stage.x / stage.scale,
    y1: -stage.y / stage.scale,
    x2: (width - stage.x) / stage.scale,
    y2: (height - stage.y) / stage.scale,
  };

  const startX = Math.floor(stageRect.x1 / gridSize) * gridSize;
  const endX = Math.ceil(stageRect.x2 / gridSize) * gridSize;
  const startY = Math.floor(stageRect.y1 / gridSize) * gridSize;
  const endY = Math.ceil(stageRect.y2 / gridSize) * gridSize;

  for (let i = startX; i < endX; i += gridSize) {
    lines.push(<Line key={`v-${i}`} points={[i, startY, i, endY]} stroke={strokeColor} strokeWidth={strokeWidth / stage.scale} />);
  }

  for (let i = startY; i < endY; i += gridSize) {
    lines.push(<Line key={`h-${i}`} points={[startX, i, endX, i]} stroke={strokeColor} strokeWidth={strokeWidth / stage.scale} />);
  }

  return <Layer>{lines}</Layer>;
};

const Canvas = ({ roomId }: { roomId: string }) => {
  const GridIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18M12 3v18"/></svg>;
  const [lines, setLines] = useState<LineData[]>([]);
  const [stage, setStage] = useState<StageState>({ scale: 1, x: 0, y: 0 });
  const [tool, setTool] = useState<'pen' | 'pan' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isGridVisible, setGridVisible] = useState(true);
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const ably = useAbly();
  const { theme, setTheme } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { channel } = useChannel(`canvas-drawings:${roomId}`, (message) => {
    if (message.clientId === ably.auth.clientId) return;

    if (message.name === 'new-line') {
      setLines((prev) => [...prev, message.data]);
    } else if (message.name === 'update-line') {
      setLines((prev) => prev.map((l) => (l.id === message.data.id ? message.data : l)));
    } else if (message.name === 'stage-update') {
      setStage(message.data);
    } else if (message.name === 'clear-canvas') {
      setLines([]);
    } else if (message.name === 'request-state') {
      channel.publish('sync-state', { lines, stage });
    } else if (message.name === 'sync-state') {
      setLines(message.data.lines);
      setStage(message.data.stage);
    }
  });

  useEffect(() => {
    channel.publish('request-state', {});
  }, [channel]);

  const publishStageUpdate = useCallback(throttle((s: StageState) => channel.publish('stage-update', s), 100), [channel]);
  const publishLineUpdate = useCallback(throttle((l: LineData) => channel.publish('update-line', l), 50), [channel]);

  const getPointerPosition = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return stage.getAbsoluteTransform().copy().invert().point(pointer);
  };

  const handleMouseDown = () => {
    if (tool === 'pan') return;
    isDrawing.current = true;
    const pos = getPointerPosition();
    if (!pos) return;
    const lineId = `${ably.auth.clientId}-${Date.now()}`;
    const newLine: LineData = { id: lineId, points: [pos.x, pos.y], color, strokeWidth, tool };
    setLines((prev) => [...prev, newLine]);
    channel.publish('new-line', newLine);
  };

  const handleMouseMove = () => {
    if (tool === 'pan' || !isDrawing.current) return;
    const pos = getPointerPosition();
    if (!pos) return;
    setLines((prev) => {
      const lastLine = prev[prev.length - 1];
      if (lastLine) {
        const newPoints = lastLine.points.concat([pos.x, pos.y]);
        const updatedLine = { ...lastLine, points: newPoints };
        publishLineUpdate(updatedLine);
        return [...prev.slice(0, -1), updatedLine];
      }
      return prev;
    });
  };

  const handleMouseUp = () => { isDrawing.current = false; };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const newStageState = { scale: newScale, x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
    setStage(newStageState);
    publishStageUpdate(newStageState);
  };

  const handleDragEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const newStageState = { scale: stage.scaleX(), ...stage.position() };
    setStage(newStageState);
    publishStageUpdate(newStageState);
  };

  const handleClearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the entire canvas for everyone?')) {
      setLines([]);
      channel.publish('clear-canvas', {});
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      const cursor = { pen: 'crosshair', pan: 'grab', eraser: 'cell' }[tool];
      stage.container().style.cursor = cursor;
    }
  }, [tool]);

  const ToolButton = ({ name, children }: { name: 'pen' | 'pan' | 'eraser', children: React.ReactNode }) => (
    <button onClick={() => setTool(name)} title={name.charAt(0).toUpperCase() + name.slice(1)} className={clsx("p-3 rounded-lg", { 'bg-blue-500 text-white': tool === name, 'hover:bg-slate-200 dark:hover:bg-slate-700': tool !== name })}>
      {children}
    </button>
  );

  return (
    <div className="font-sans" style={{ background: theme === 'dark' ? '#1a202c' : '#ffffff' }}>
      <div className="absolute top-1/2 -translate-y-1/2 left-4 z-10 flex flex-col items-center gap-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl w-16">
        <div className="flex flex-col gap-1">
          <ToolButton name="pen"><PencilIcon /></ToolButton>
          <ToolButton name="eraser"><EraserIcon /></ToolButton>
          <ToolButton name="pan"><HandIcon /></ToolButton>
        </div>
        <hr className="w-full border-slate-300 dark:border-slate-600" />
        <ColorPicker color={color} onChange={setColor} />
        <div className="flex flex-col items-center justify-center gap-2 w-full h-32">
          <label htmlFor="stroke-width" className="text-xs text-slate-500 dark:text-slate-400 mb-1">Width</label>
          <div className="h-24 w-full flex justify-center items-center">
             <input id="stroke-width" type="range" min="1" max="100" value={strokeWidth} onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))} className="custom-slider w-20 transform -rotate-90" />
          </div>
        </div>
        <hr className="w-full border-slate-300 dark:border-slate-600" />
        <div className="flex flex-col gap-1">
          <button onClick={() => setGridVisible(!isGridVisible)} title="Toggle Grid" className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            <GridIcon />
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme" className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={handleClearCanvas} title="Clear Canvas" className="p-3 hover:bg-red-500 hover:text-white rounded-lg">
            <TrashIcon />
          </button>
        </div>
      </div>

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        draggable={tool === 'pan'}
        scaleX={stage.scale}
        scaleY={stage.scale}
        x={stage.x}
        y={stage.y}
        ref={stageRef}
      >
        {isGridVisible && <Grid stage={stage} width={dimensions.width} height={dimensions.height} theme={theme} />}
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default Canvas;
