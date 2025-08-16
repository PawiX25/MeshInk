'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Stage, Layer, Line, Shape } from 'react-konva';
import { useChannel, useAbly } from 'ably/react';
import Konva from 'konva';
import { throttle } from 'lodash';
import { useTheme } from 'next-themes';
import { animate, motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { HexColorPicker } from 'react-colorful';

interface LineData {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'eraser';
  authorId: string;
}

interface StackEntry {
  line: LineData;
  index: number;
}

interface StageState {
  scale: number;
  x: number;
  y: number;
}

 

const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>;
const EraserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z" /><path d="M22 21H7" /><path d="m5 12 5 5" /></svg>;
const HandIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-4a2 2 0 1 1 0-4h4a4 4 0 1 0 0-8" /></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>;
const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;

const ColorPicker = ({ color, onChange }: { color: string; onChange: (newColor: string) => void }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const positionPopover = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;
    const rect = trigger.getBoundingClientRect();
    const cRect = content.getBoundingClientRect();
    const margin = 8;

    let left = rect.right + margin;
    let top = rect.top + rect.height / 2 - cRect.height / 2;

    if (left + cRect.width > window.innerWidth - margin) {
      left = clamp(rect.left + rect.width / 2 - cRect.width / 2, margin, window.innerWidth - cRect.width - margin);
      top = rect.top - cRect.height - margin;

      if (top < margin) {
        top = rect.bottom + margin;
      }
    }

    top = clamp(top, margin, window.innerHeight - cRect.height - margin);
    left = clamp(left, margin, window.innerWidth - cRect.width - margin);

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (contentRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => positionPopover();
    window.addEventListener('mousedown', onDown);
  window.addEventListener('touchstart', onDown, { passive: true } as AddEventListenerOptions);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    requestAnimationFrame(() => positionPopover());
    return () => {
      window.removeEventListener('mousedown', onDown);
  window.removeEventListener('touchstart', onDown as unknown as EventListener);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [isOpen, positionPopover]);

  return (
    <div>
      <button
        ref={triggerRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="w-10 h-10 rounded-lg border-2 border-slate-200 dark:border-slate-700 transition-transform active:scale-95"
        style={{ backgroundColor: color }}
        title="Select Color"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      />

      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={contentRef}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: pos?.top ?? -9999,
                  left: pos?.left ?? -9999,
                  zIndex: 9999,
                  opacity: pos ? undefined : 0,
                  pointerEvents: pos ? 'auto' : 'none',
                }}
                className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60"
                onWheel={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Color picker"
              >
                <HexColorPicker color={color} onChange={onChange} />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

const GridLayer = ({ stage, width, height, theme }: { stage: StageState, width: number, height: number, theme: string | undefined }) => {
  const baseStep = 50;
  const strokeColor = theme === 'dark' ? '#2c3e50' : '#e0e0e0';

  const sceneFunc = (context: Konva.Context) => {
    const buffer = 0.15;
    const stageRect = {
      x1: -stage.x / stage.scale - (width * buffer) / stage.scale,
      y1: -stage.y / stage.scale - (height * buffer) / stage.scale,
      x2: (width - stage.x) / stage.scale + (width * buffer) / stage.scale,
      y2: (height - stage.y) / stage.scale + (height * buffer) / stage.scale,
    };

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const smoothstep = (e0: number, e1: number, x: number) => {
      const t = clamp((x - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    };

    const s = Math.max(1e-12, Math.min(1e12, stage.scale));
    const targetPx = 32;
    const fRaw = Math.log2((targetPx + 1e-6) / (baseStep * s));
    const f = Math.max(-60, Math.min(60, fRaw));
    const k = Math.floor(f);
    const frac = f - k;
    const t = smoothstep(0.2, 0.8, frac);

    const stepLo = baseStep * Math.pow(2, k);
    const stepHi = stepLo * 2;
    const majorLo = stepLo * 5;
    const majorHi = stepHi * 5;

    const startEndForGap = (gap: number) => ({
      startX: Math.floor(stageRect.x1 / gap) * gap,
      endX: Math.ceil(stageRect.x2 / gap) * gap,
      startY: Math.floor(stageRect.y1 / gap) * gap,
      endY: Math.ceil(stageRect.y2 / gap) * gap,
    });

    const alignX = (xWorld: number) => {
      const sx = xWorld * stage.scale + stage.x;
      const aligned = Math.floor(sx) + 0.5;
      return (aligned - stage.x) / stage.scale;
    };
    const alignY = (yWorld: number) => {
      const sy = yWorld * stage.scale + stage.y;
      const aligned = Math.floor(sy) + 0.5;
      return (aligned - stage.y) / stage.scale;
    };

    const drawTier = (gap: number, alpha: number, pxWidth: number) => {
      if (alpha <= 0.02) return;
      const { startX, endX, startY, endY } = startEndForGap(gap);
      context.beginPath();
      for (let x = Math.ceil(startX / gap) * gap; x <= endX; x += gap) {
        const ax = alignX(x);
        context.moveTo(ax, startY);
        context.lineTo(ax, endY);
      }
      for (let y = Math.ceil(startY / gap) * gap; y <= endY; y += gap) {
        const ay = alignY(y);
        context.moveTo(startX, ay);
        context.lineTo(endX, ay);
      }
      context.setAttr('strokeStyle', strokeColor);
      context.setAttr('globalAlpha', alpha);
      context.setAttr('lineWidth', (pxWidth || 1) / stage.scale);
      context.setAttr('lineCap', 'butt');
      context.setAttr('lineJoin', 'miter');
      context.stroke();
      context.setAttr('globalAlpha', 1);
    };

    const minorAlphaLo = (1 - t) * 0.45;
    const minorAlphaHi = t * 0.45;
    const majorAlphaLo = (1 - t) * 0.9;
    const majorAlphaHi = t * 0.9;
    drawTier(stepLo, minorAlphaLo, 1);
    drawTier(stepHi, minorAlphaHi, 1);
    drawTier(majorLo, majorAlphaLo, 1.5);
    drawTier(majorHi, majorAlphaHi, 2);
  };

  return (
    <Layer listening={false} hitGraphEnabled={false}>
      <Shape listening={false} hitGraphEnabled={false} sceneFunc={sceneFunc} />
    </Layer>
  );
};

const Canvas = ({ roomId }: { roomId: string }) => {
  const GridIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18M12 3v18"/></svg>;

  const [lines, setLines] = useState<LineData[]>([]);
  const [stage, setStage] = useState<StageState>({ scale: 1, x: 0, y: 0 });
  const [tool, setTool] = useState<'pen' | 'pan' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isGridVisible, setGridVisible] = useState(true);
  const [myUndoStack, setMyUndoStack] = useState<StackEntry[]>([]);
  const [myRedoStack, setMyRedoStack] = useState<StackEntry[]>([]);
  
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const zoomTargetRef = useRef<StageState>({ scale: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const ably = useAbly();
  const { theme, setTheme } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const linesRef = useRef<LineData[]>([]);
  const currentLineIdRef = useRef<string | null>(null);
  const undoRef = useRef<StackEntry[]>([]);
  const redoRef = useRef<StackEntry[]>([]);
  const undoRedoBusyRef = useRef(false);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  useEffect(() => {
    undoRef.current = myUndoStack;
    redoRef.current = myRedoStack;
  }, [myUndoStack, myRedoStack]);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    zoomTargetRef.current = stage;
  }, [stage]);

  const ensureZoomRAF = useCallback(() => {
    if (rafRef.current != null) return;
    const step = (ts: number) => {
      const target = zoomTargetRef.current;
      const current = stageRef.current
        ? ({ scale: stageRef.current.scaleX(), x: stageRef.current.x(), y: stageRef.current.y() } as StageState)
        : stage;

      const last = lastTimeRef.current ?? ts;
  const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
      lastTimeRef.current = ts;
  const k = 14;
      const alpha = 1 - Math.exp(-k * dt);

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const ns = lerp(current.scale, target.scale, alpha);
      const nx = lerp(current.x, target.x, alpha);
      const ny = lerp(current.y, target.y, alpha);

      setStage({ scale: ns, x: nx, y: ny });

  const done =
        Math.abs(ns - target.scale) < 0.0005 &&
        Math.abs(nx - target.x) < 0.25 &&
        Math.abs(ny - target.y) < 0.25;
      if (!done) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setStage(target);
        rafRef.current = null;
        lastTimeRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [stage]);

  const { channel } = useChannel(`canvas-drawings:${roomId}`, (message) => {
    if (message.clientId === ably.auth.clientId) return;

    if (message.name === 'new-line') {
      setLines((prev) => [...prev, message.data]);
    } else if (message.name === 'update-line') {
      setLines((prev) => prev.map((l) => (l.id === message.data.id ? message.data : l)));
    } else if (message.name === 'stage-update') {
      zoomTargetRef.current = message.data as StageState;
      ensureZoomRAF();
    } else if (message.name === 'clear-canvas') {
      setLines([]);
      setMyUndoStack([]);
      setMyRedoStack([]);
    } else if (message.name === 'request-state') {
      channel.publish('sync-state', { lines, stage });
    } else if (message.name === 'sync-state') {
      setLines(message.data.lines);
      setStage(message.data.stage);
  setMyUndoStack([]);
  setMyRedoStack([]);
  } else if (message.name === 'delete-line') {
      const id: string = message.data.id;
      setLines((prev) => {
        const target = prev.find((l) => l.id === id);
        if (target && target.authorId === message.clientId) {
          return prev.filter((l) => l.id !== id);
        }
        return prev;
      });
    } else if (message.name === 'restore-line') {
      const payload = message.data;
      const line: LineData = payload.line ?? payload;
      const index: number | undefined = payload.index;
      if (line.authorId !== message.clientId) return;
      setLines((prev) => {
        const without = prev.filter((l) => l.id !== line.id);
        if (typeof index === 'number') {
          const idx = Math.max(0, Math.min(index, without.length));
          const arr = [...without];
          arr.splice(idx, 0, line);
          return arr;
        }
        return [...without, line];
      });
    }
  });

  useEffect(() => {
    channel.publish('request-state', {});
  }, [channel]);

  useEffect(() => {
    if (theme === 'dark' && color === '#000000') {
      setColor('#ffffff');
    } else if (theme === 'light' && color === '#ffffff') {
      setColor('#000000');
    }
  }, [theme, color]);

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
  const newLine: LineData = { id: lineId, points: [pos.x, pos.y], color, strokeWidth, tool, authorId: ably.auth.clientId as string };
    setLines((prev) => [...prev, newLine]);
    channel.publish('new-line', newLine);
  currentLineIdRef.current = lineId;
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

  const handleMouseUp = () => {
    isDrawing.current = false;
    const currentId = currentLineIdRef.current;
    if (!currentId) return;
    const idx = linesRef.current.findIndex((l) => l.id === currentId);
    const latestLine = idx >= 0 ? linesRef.current[idx] : undefined;
  if (latestLine && latestLine.authorId === (ably.auth.clientId as string)) {
      setMyUndoStack((prev) => [...prev, { line: latestLine, index: idx }]);
      setMyRedoStack([]);
    }
    currentLineIdRef.current = null;
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };

  const zoomIntensity = 0.0015;
  const direction = -e.evt.deltaY;
    const scaleFactor = Math.exp(direction * zoomIntensity);
  const newScaleUnclamped = oldScale * scaleFactor;
  const newScale = Math.max(1e-9, Math.min(1e9, newScaleUnclamped));

    const newX = pointer.x - mousePointTo.x * newScale;
    const newY = pointer.y - mousePointTo.y * newScale;
    const newTarget = { scale: newScale, x: newX, y: newY } as StageState;
    zoomTargetRef.current = newTarget;
    ensureZoomRAF();
  publishStageUpdate(newTarget);
  };

  const handleDragEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const newStageState = { scale: stage.scaleX(), ...stage.position() } as StageState;
    setStage(newStageState);
    publishStageUpdate(newStageState);
  };

  const handleDragMove = throttle((e: Konva.KonvaEventObject<DragEvent>) => {
    const s = e.target as Konva.Stage;
    const next = { scale: s.scaleX(), x: s.x(), y: s.y() } as StageState;
    setStage(next);
    publishStageUpdate(next);
  }, 50);

  const undo = useCallback(() => {
    if (undoRedoBusyRef.current) return;
    const last = undoRef.current[undoRef.current.length - 1];
    if (!last) return;
    undoRedoBusyRef.current = true;
    const { line } = last;
    setLines((prev) => prev.filter((l) => l.id !== line.id));
    channel.publish('delete-line', { id: line.id });
    setMyUndoStack((prev) => prev.slice(0, -1));
    setMyRedoStack((prev) => [...prev, last]);
    undoRedoBusyRef.current = false;
  }, [channel]);

  const redo = useCallback(() => {
    if (undoRedoBusyRef.current) return;
    const last = redoRef.current[redoRef.current.length - 1];
    if (!last) return;
    undoRedoBusyRef.current = true;
    const { line, index } = last;
    setLines((prev) => {
      const without = prev.filter((l) => l.id !== line.id);
      const idx = Math.max(0, Math.min(index, without.length));
      const arr = [...without];
      arr.splice(idx, 0, line);
      return arr;
    });
    channel.publish('restore-line', last);
    setMyRedoStack((prev) => prev.slice(0, -1));
    setMyUndoStack((prev) => [...prev, last]);
    undoRedoBusyRef.current = false;
  }, [channel]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);


  const handleClearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the entire canvas for everyone?')) {
      setLines([]);
      channel.publish('clear-canvas', {});
  setMyUndoStack([]);
  setMyRedoStack([]);
    }
  };

  const handleResetView = () => {
    publishStageUpdate({ scale: 1, x: 0, y: 0 });
    animate(stage.scale, 1, {
      duration: 0.8,
      ease: 'easeInOut',
      onUpdate: (latest) => {
        setStage((prev) => ({ ...prev, scale: latest }));
      },
    });
    animate(stage.x, 0, {
      duration: 0.8,
      ease: 'easeInOut',
      onUpdate: (latest) => {
        setStage((prev) => ({ ...prev, x: latest }));
      },
    });
    animate(stage.y, 0, {
      duration: 0.8,
      ease: 'easeInOut',
      onUpdate: (latest) => {
        setStage((prev) => ({ ...prev, y: latest }));
      },
    });
  };

  useEffect(() => {
    isDrawing.current = false;
    const stage = stageRef.current;
    if (stage) {
      const cursor = { pen: 'crosshair', pan: 'grab', eraser: 'cell' }[tool];
      stage.container().style.cursor = cursor;
    }
  }, [tool]);

  const ToolButton = ({ name, children }: { name: 'pen' | 'pan' | 'eraser', children: React.ReactNode }) => (
    <button onClick={() => setTool(name)} title={name.charAt(0).toUpperCase() + name.slice(1)} className={clsx('p-3 rounded-lg', { 'bg-blue-500 text-white': tool === name, 'hover:bg-slate-200 dark:hover:bg-slate-700': tool !== name })}>
      {children}
    </button>
  );

  const UndoIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="feather feather-rotate-ccw"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
  const RedoIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="feather feather-rotate-cw"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );

  const ZoomIndicator = ({ scale }: { scale: number }) => {
    const pct = scale * 100;
    const compact = (n: number) => {
      const abs = Math.abs(n);
      if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
      if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
      return `${Math.round(n)}`;
    };
    let pctStr: string;
    if (!isFinite(pct) || pct <= 0) {
      pctStr = '0%';
    } else if (pct >= 10000) {
      pctStr = `${(pct / 1000).toFixed(1)}k%`;
    } else if (pct >= 100) {
      pctStr = `${Math.round(pct)}%`;
    } else if (pct >= 1) {
      pctStr = `${pct.toFixed(1)}%`;
    } else if (pct >= 0.1) {
      pctStr = `${pct.toFixed(2)}%`;
    } else if (pct >= 0.001) {
      pctStr = `${pct.toFixed(3)}%`;
    } else {
      pctStr = '<0.001%';
    }

    let ratio = '';
    let showRatioInline = false;
    if (scale > 0 && isFinite(scale)) {
      if (scale >= 1) {
        ratio = `${compact(scale)}:1`;
      } else {
        const inv = 1 / scale;
        ratio = `1:${compact(inv)}`;
  showRatioInline = pct < 0.1;
      }
    }

    return (
      <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/70 dark:bg-slate-700/60 text-xs w-full">
        <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-300 select-none">Zoom</span>
        <span
          className="font-semibold text-slate-800 dark:text-slate-100 text-[11px] leading-tight tracking-tight tabular-nums whitespace-nowrap select-none"
          title={`Scale ${scale} (${ratio})`}
        >
          {pctStr}
        </span>
        {showRatioInline && (
          <span className="text-[10px] text-slate-500 dark:text-slate-300 tabular-nums leading-none select-none" aria-hidden>{ratio}</span>
        )}
      </div>
    );
  };

  return (
    <div className="font-sans" style={{ background: theme === 'dark' ? '#1a202c' : '#ffffff' }}>
  <div className="absolute top-1/2 -translate-y-1/2 left-4 z-10 flex flex-col items-center gap-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl w-16 select-none">
        <div className="flex flex-col gap-1">
          <ToolButton name="pen"><PencilIcon /></ToolButton>
          <ToolButton name="eraser"><EraserIcon /></ToolButton>
          <ToolButton name="pan"><HandIcon /></ToolButton>
        </div>
        <hr className="w-full border-slate-300 dark:border-slate-600" />
  <ZoomIndicator scale={stage.scale} />
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
          <button onClick={undo} disabled={myUndoStack.length === 0} title="Undo (Ctrl+Z)" className={clsx('p-3 rounded-lg', myUndoStack.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-700')}>
            <UndoIcon />
          </button>
          <button onClick={redo} disabled={myRedoStack.length === 0} title="Redo (Ctrl+Y / Ctrl+Shift+Z)" className={clsx('p-3 rounded-lg', myRedoStack.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-700')}>
            <RedoIcon />
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme" className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={handleResetView} title="Reset View" className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            <HomeIcon />
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
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
  draggable={tool === 'pan'}
        scaleX={stage.scale}
        scaleY={stage.scale}
        x={stage.x}
        y={stage.y}
        ref={stageRef}
      >
  {isGridVisible && <GridLayer stage={stage} width={dimensions.width} height={dimensions.height} theme={theme} />}
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              lineCap="round"
              lineJoin="round"
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
              globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default Canvas;
