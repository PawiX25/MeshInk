'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Stage, Layer, Line, Shape, Rect } from 'react-konva';
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


interface MoveSnapshot { id: string; points: number[] }
type UndoAction =
  | { type: 'add'; line: LineData; index: number }
  | { type: 'move'; before: MoveSnapshot[]; after: MoveSnapshot[] };

interface StageState {
  scale: number;
  x: number;
  y: number;
}

interface SavePreferenceNotificationProps {
    onAllow: () => void;
    onDeny: () => void;
}

const SavePreferenceNotification = ({ onAllow, onDeny }: SavePreferenceNotificationProps) => {
    return (
        <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98, transition: { duration: 0.18, ease: 'easeOut' } }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.7 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg p-4"
        >
            <div className="bg-slate-800 text-white rounded-xl shadow-2xl p-6 border border-slate-700 flex items-center justify-between gap-6">
                <div className="flex-grow">
                    <h4 className="font-bold text-lg">Save your work?</h4>
                    <p className="text-sm text-slate-300 mt-1">
                        Allow this site to save your canvas in this browser? You won&apos;t be asked again.
                    </p>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                    <button
                        onClick={onDeny}
                        className="px-5 py-2.5 font-semibold text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        Deny
                    </button>
                    <button
                        onClick={onAllow}
                        className="px-5 py-2.5 font-semibold text-sm bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                    >
                        Allow
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const AlertTriangleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;

interface ClearCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ClearCanvasModal: React.FC<ClearCanvasModalProps> = ({ isOpen, onClose, onConfirm }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md m-4 border border-slate-200 dark:border-slate-700"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangleIcon />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-slate-800 dark:text-white">
                Clear Canvas
              </h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Are you sure you want to clear the entire canvas? This action will affect everyone in the room and cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button
                onClick={onClose}
                className="px-6 py-3 font-semibold text-slate-700 bg-slate-200 rounded-xl hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-300 dark:focus:ring-slate-600 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-6 py-3 font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-300 dark:focus:ring-red-800 transition-all duration-300"
              >
                Clear Canvas
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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
  const [tool, setTool] = useState<'pen' | 'pan' | 'eraser' | 'select'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isGridVisible, setGridVisible] = useState(true);
  const [myUndoStack, setMyUndoStack] = useState<UndoAction[]>([]);
  const [myRedoStack, setMyRedoStack] = useState<UndoAction[]>([]);
  const [isClearCanvasModalOpen, setClearCanvasModalOpen] = useState(false);
  const [savePreference, setSavePreference] = useState<'allow' | 'deny' | 'prompt'>('prompt');
  
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
  const undoRef = useRef<UndoAction[]>([]);
  const redoRef = useRef<UndoAction[]>([]);
  const undoRedoBusyRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionBBox, setSelectionBBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionBaseRect, setSelectionBaseRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionAngle, setSelectionAngle] = useState(0);
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const marqueeRef = useRef<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const isMarqueeActiveRef = useRef(false);
  const isSelectionMovingRef = useRef(false);
  const moveOriginalSnapshotsRef = useRef<MoveSnapshot[] | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const isResizingRef = useRef(false);
  const resizeDataRef = useRef<{ handle: string; originBBox: { x: number; y: number; width: number; height: number }; originSnapshots: MoveSnapshot[]; originAngle?: number; center?: { x: number; y: number } } | null>(null);
  const isRotatingRef = useRef(false);
  const rotateDataRef = useRef<{ originSnapshots: MoveSnapshot[]; center: { x: number; y: number }; originAngle: number; originBBox: { x: number; y: number; width: number; height: number }; liveAngle: number } | null>(null);

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
    const preference = localStorage.getItem('meshink-save-preference');
    if (preference === 'allow' || preference === 'deny') {
      setSavePreference(preference);
    }

    if (preference === 'allow') {
      const savedLines = localStorage.getItem(`meshink-room-${roomId}`);
      if (savedLines) {
        try {
          setLines(JSON.parse(savedLines));
          return;
        } catch (e) {
          console.error("Failed to parse saved lines:", e);
        }
      }
    }
    channel.publish('request-state', {});
  }, [channel, roomId]);

  useEffect(() => {
    if (savePreference === 'allow') {
      localStorage.setItem(`meshink-room-${roomId}`, JSON.stringify(lines));
    }
  }, [lines, roomId, savePreference]);

  useEffect(() => {
    if (theme === 'dark' && color === '#000000') {
      setColor('#ffffff');
    } else if (theme === 'light' && color === '#ffffff') {
      setColor('#000000');
    }
  }, [theme, color]);

  const publishStageUpdate = useMemo(
    () => throttle((s: StageState) => channel.publish('stage-update', s), 100),
    [channel]
  );
  const publishLineUpdate = useMemo(
    () => throttle((l: LineData) => channel.publish('update-line', l), 50),
    [channel]
  );

  const getPointerPosition = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return stage.getAbsoluteTransform().copy().invert().point(pointer);
  };

  const handleMouseDown = () => {
    if (tool === 'pan') return;
    if (tool === 'select') {
      const stageObj = stageRef.current;
      if (!stageObj) return;
      const pointer = getPointerPosition();
      if (!pointer) return;
      if (selectionBBox && selectedIds.size > 0) {
        const rot = isOnRotationHandle(pointer);
        if (rot) {
          startRotate(pointer);
          return;
        }
      }
  if (selectionBBox && selectedIds.size > 0) {
        const h = getHandleUnderPointer(pointer);
        if (h) {
          startResize(h);
          return;
        }
      }
      const insideForMove = () => {
        if (!selectionBBox) return false;
        if (selectionAngle === 0) return pointer.x >= selectionBBox.x && pointer.x <= selectionBBox.x + selectionBBox.width && pointer.y >= selectionBBox.y && pointer.y <= selectionBBox.y + selectionBBox.height;
        const base = selectionBaseRect || selectionBBox;
        const a = selectionAngle;
        const cx = base.x + base.width / 2;
        const cy = base.y + base.height / 2;
        const cos = Math.cos(-a);
        const sin = Math.sin(-a);
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const lx = dx * cos - dy * sin + cx;
        const ly = dx * sin + dy * cos + cy;
        return lx >= base.x && lx <= base.x + base.width && ly >= base.y && ly <= base.y + base.height;
      };
      if (selectionBBox && insideForMove()) {
        if (selectedIds.size > 0) {
          moveOriginalSnapshotsRef.current = Array.from(selectedIds).map(id => {
            const line = linesRef.current.find(l => l.id === id)!;
            return { id, points: [...line.points] };
          });
        }
        isSelectionMovingRef.current = true;
        lastPointerPosRef.current = pointer;
        return;
      }
  isMarqueeActiveRef.current = true;
  marqueeRef.current = { start: pointer, current: pointer };
  setMarqueeBox({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
      setSelectionBBox(null);
      setSelectedIds(new Set());
      return;
    }
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
    if (tool === 'pan') return;
    if (tool === 'select') {
      const pointer = getPointerPosition();
      if (!pointer) return;
      if (isRotatingRef.current && rotateDataRef.current) {
        const { originSnapshots, center, originAngle } = rotateDataRef.current;
        const dx = pointer.x - center.x;
        const dy = pointer.y - center.y;
        const angle = Math.atan2(dy, dx);
        const delta = angle - originAngle;
        const cos = Math.cos(delta);
        const sin = Math.sin(delta);
        rotateDataRef.current.liveAngle = delta;
        const updated: Record<string, number[]> = {};
        originSnapshots.forEach(s => {
          const pts: number[] = [];
          for (let i = 0; i < s.points.length; i += 2) {
            const ox = s.points[i];
            const oy = s.points[i + 1];
            const rx = center.x + (ox - center.x) * cos - (oy - center.y) * sin;
            const ry = center.y + (ox - center.x) * sin + (oy - center.y) * cos;
            pts.push(rx, ry);
          }
          updated[s.id] = pts;
        });
        setLines(prev => prev.map(l => {
          if (!selectedIds.has(l.id)) return l;
          const pts = updated[l.id];
          if (!pts) return l;
          const upd = { ...l, points: pts };
          publishLineUpdate(upd);
          return upd;
        }));
        const stageObj = stageRef.current;
        if (stageObj) stageObj.container().style.cursor = 'grabbing';
        return;
      }
      if (isResizingRef.current && resizeDataRef.current) {
        const { handle, originBBox, originSnapshots, originAngle = 0, center } = resizeDataRef.current;
        const rotated = Math.abs(originAngle) > 1e-10;
        if (!rotated) {
          let x1 = originBBox.x, y1 = originBBox.y, x2 = originBBox.x + originBBox.width, y2 = originBBox.y + originBBox.height;
          if (handle.includes('w')) x1 = pointer.x; if (handle.includes('e')) x2 = pointer.x; if (handle.includes('n')) y1 = pointer.y; if (handle.includes('s')) y2 = pointer.y;
          if (x2 - x1 === 0 || y2 - y1 === 0) return;
          if (x2 < x1) [x1, x2] = [x2, x1]; if (y2 < y1) [y1, y2] = [y2, y1];
          const minW = 1e-6, minH = 1e-6; if (x2 - x1 < minW || y2 - y1 < minH) return;
          const scaleX = (x2 - x1) / originBBox.width; const scaleY = (y2 - y1) / originBBox.height;
          let anchorX: number; let anchorY: number;
          if (handle.includes('w')) anchorX = originBBox.x + originBBox.width; else if (handle.includes('e')) anchorX = originBBox.x; else anchorX = originBBox.x + originBBox.width / 2;
          if (handle.includes('n')) anchorY = originBBox.y + originBBox.height; else if (handle.includes('s')) anchorY = originBBox.y; else anchorY = originBBox.y + originBBox.height / 2;
          const updated: Record<string, number[]> = {};
          originSnapshots.forEach(s => {
            const np: number[] = [];
            for (let i=0;i<s.points.length;i+=2){
              const ox = s.points[i], oy = s.points[i+1];
              np.push(anchorX + (ox-anchorX)*scaleX, anchorY + (oy-anchorY)*scaleY);
            }
            updated[s.id] = np;
          });
          setLines(prev => prev.map(l => { if (!selectedIds.has(l.id)) return l; const pts = updated[l.id]; if (!pts) return l; const upd = { ...l, points: pts }; publishLineUpdate(upd); return upd; }));
          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,maxStroke=0;
          linesRef.current.forEach(l=>{ if(!selectedIds.has(l.id)) return; for(let i=0;i<l.points.length;i+=2){ const px=l.points[i], py=l.points[i+1]; if(px<minX)minX=px; if(py<minY)minY=py; if(px>maxX)maxX=px; if(py>maxY)maxY=py;} if(l.strokeWidth>maxStroke) maxStroke=l.strokeWidth;});
          if(isFinite(minX)){ const pad=maxStroke/2+4; setSelectionBBox({x:minX-pad,y:minY-pad,width:(maxX-minX)+pad*2,height:(maxY-minY)+pad*2}); setSelectionBaseRect({x:minX-pad,y:minY-pad,width:(maxX-minX)+pad*2,height:(maxY-minY)+pad*2}); }
          const stageObj=stageRef.current; if(stageObj) stageObj.container().style.cursor=getResizeCursor(handle); return;
        } else {
          if (!center) return;
          const cosA = Math.cos(-originAngle), sinA = Math.sin(-originAngle);
          const dxp = pointer.x - center.x, dyp = pointer.y - center.y;
          const localX = center.x + dxp * cosA - dyp * sinA;
          const localY = center.y + dxp * sinA + dyp * cosA;
          let x1 = originBBox.x, y1 = originBBox.y, x2 = originBBox.x + originBBox.width, y2 = originBBox.y + originBBox.height;
          if (handle.includes('w')) x1 = localX; if (handle.includes('e')) x2 = localX; if (handle.includes('n')) y1 = localY; if (handle.includes('s')) y2 = localY;
          if (x2 - x1 === 0 || y2 - y1 === 0) return; if (x2 < x1) [x1,x2]=[x2,x1]; if (y2<y1)[y1,y2]=[y2,y1];
          const minW=1e-6,minH=1e-6; if((x2-x1)<minW||(y2-y1)<minH) return;
          const scaleX=(x2-x1)/originBBox.width, scaleY=(y2-y1)/originBBox.height;
          let anchorX: number; let anchorY: number;
          if (handle.includes('w')) anchorX = originBBox.x + originBBox.width; else if (handle.includes('e')) anchorX = originBBox.x; else anchorX = originBBox.x + originBBox.width/2;
          if (handle.includes('n')) anchorY = originBBox.y + originBBox.height; else if (handle.includes('s')) anchorY = originBBox.y; else anchorY = originBBox.y + originBBox.height/2;
          const updated: Record<string, number[]> = {};
          originSnapshots.forEach(s => {
            const pts: number[] = [];
            for(let i=0;i<s.points.length;i+=2){
              const ox=s.points[i], oy=s.points[i+1];
              const dx0=ox-center.x, dy0=oy-center.y;
              const lx=center.x + dx0 * cosA - dy0 * sinA;
              const ly=center.y + dx0 * sinA + dy0 * cosA;
              const nxLocal = anchorX + (lx - anchorX) * scaleX;
              const nyLocal = anchorY + (ly - anchorY) * scaleY;
              const cosB = Math.cos(originAngle), sinB = Math.sin(originAngle);
              const dx1 = nxLocal - center.x, dy1 = nyLocal - center.y;
              const wx = center.x + dx1 * cosB - dy1 * sinB;
              const wy = center.y + dx1 * sinB + dy1 * cosB;
              pts.push(wx, wy);
            }
            updated[s.id]=pts;
          });
          setLines(prev=>prev.map(l=>{ if(!selectedIds.has(l.id)) return l; const pts=updated[l.id]; if(!pts) return l; const upd={...l, points: pts}; publishLineUpdate(upd); return upd;}));
          setSelectionBaseRect({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity, strokeMax=0;
          Object.values(updated).forEach(pts=>{ for(let i=0;i<pts.length;i+=2){ const px=pts[i], py=pts[i+1]; if(px<minX)minX=px; if(py<minY)minY=py; if(px>maxX)maxX=px; if(py>maxY)maxY=py; }});
          linesRef.current.forEach(l=>{ if(selectedIds.has(l.id)) strokeMax=Math.max(strokeMax,l.strokeWidth); });
          if(isFinite(minX)){ const pad=strokeMax/2+4; setSelectionBBox({x:minX-pad,y:minY-pad,width:(maxX-minX)+pad*2,height:(maxY-minY)+pad*2}); }
          const stageObj=stageRef.current; if(stageObj) stageObj.container().style.cursor=getResizeCursor(handle);
          return;
        }
      }
      if (isSelectionMovingRef.current && lastPointerPosRef.current) {
        const last = lastPointerPosRef.current;
        const dx = pointer.x - last.x;
        const dy = pointer.y - last.y;
        if (dx !== 0 || dy !== 0) {
          lastPointerPosRef.current = pointer;
          setLines(prev => prev.map(l => {
            if (!selectedIds.has(l.id)) return l;
            const newPoints = l.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
            const updated = { ...l, points: newPoints };
            publishLineUpdate(updated);
            return updated;
          }));
          if (selectionBBox) {
            setSelectionBBox({ x: selectionBBox.x + dx, y: selectionBBox.y + dy, width: selectionBBox.width, height: selectionBBox.height });
          }
        }
        const stageObj = stageRef.current;
        if (stageObj) stageObj.container().style.cursor = 'grabbing';
        return;
      }
      if (isMarqueeActiveRef.current && marqueeRef.current) {
        marqueeRef.current.current = pointer;
        const { start, current } = marqueeRef.current;
        setMarqueeBox({
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          width: Math.abs(start.x - current.x),
          height: Math.abs(start.y - current.y)
        });
        const stageObj = stageRef.current;
        if (stageObj) stageObj.container().style.cursor = 'crosshair';
        return;
      }
      const stageObj = stageRef.current;
      if (stageObj) {
        if (selectionBBox && selectedIds.size > 0) {
          if (isOnRotationHandle(pointer)) {
            stageObj.container().style.cursor = 'grab';
            return;
          }
        }
        if (selectionBBox && selectedIds.size > 0) {
          const h = getHandleUnderPointer(pointer);
          if (h) {
            stageObj.container().style.cursor = getResizeCursor(h);
            return;
          }
        }
        const isInsideRotated = () => {
          if (!selectionBBox) return false;
          if (selectionAngle === 0 && !(isRotatingRef.current && rotateDataRef.current)) {
            return pointer.x >= selectionBBox.x && pointer.x <= selectionBBox.x + selectionBBox.width && pointer.y >= selectionBBox.y && pointer.y <= selectionBBox.y + selectionBBox.height;
          }
          const base = selectionBaseRect || selectionBBox;
          const a = selectionAngle + (isRotatingRef.current && rotateDataRef.current ? rotateDataRef.current.liveAngle : 0);
          const cx = base.x + base.width / 2;
          const cy = base.y + base.height / 2;
          const cos = Math.cos(-a);
          const sin = Math.sin(-a);
          const dx = pointer.x - cx;
          const dy = pointer.y - cy;
          const lx = dx * cos - dy * sin + cx;
          const ly = dx * sin + dy * cos + cy;
          return lx >= base.x && lx <= base.x + base.width && ly >= base.y && ly <= base.y + base.height;
        };
        if (selectionBBox && isInsideRotated()) {
          stageObj.container().style.cursor = 'grab';
        } else {
          stageObj.container().style.cursor = 'default';
        }
      }
      return;
    }
    if (!isDrawing.current) return;
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
    if (tool === 'select') {
      if (isRotatingRef.current && rotateDataRef.current) {
        const before = rotateDataRef.current.originSnapshots;
        const after: MoveSnapshot[] = before.map(s => {
          const line = linesRef.current.find(l => l.id === s.id)!;
          return { id: s.id, points: [...line.points] };
        });
        const changed = after.some((a, i) => a.points.length !== before[i].points.length || a.points.some((v, idx) => v !== before[i].points[idx]));
        if (changed) {
          setMyUndoStack(prev => [...prev, { type: 'move', before, after }]);
          setMyRedoStack([]);
        }
  const delta = rotateDataRef.current.liveAngle;
  setSelectionAngle(a => a + delta);
  setSelectionBaseRect(prev => prev || rotateDataRef.current?.originBBox || null);
  setSelectionBBox(prev => prev ? { ...prev } : prev);
        isRotatingRef.current = false;
        rotateDataRef.current = null;
        return;
      }
      if (isResizingRef.current && resizeDataRef.current) {
        const before = resizeDataRef.current.originSnapshots;
        const after: MoveSnapshot[] = before.map(s => {
          const line = linesRef.current.find(l => l.id === s.id)!;
          return { id: s.id, points: [...line.points] };
        });
        const changed = after.some((a, i) => a.points.length !== before[i].points.length || a.points.some((v, idx) => v !== before[i].points[idx]));
        if (changed) {
          setMyUndoStack(prev => [...prev, { type: 'move', before, after }]);
          setMyRedoStack([]);
        }
        isResizingRef.current = false;
        resizeDataRef.current = null;
        return;
      }
      if (isSelectionMovingRef.current) {
        const before = moveOriginalSnapshotsRef.current;
        if (before && before.length > 0) {
          const after: MoveSnapshot[] = before.map(s => {
            const line = linesRef.current.find(l => l.id === s.id)!;
            return { id: s.id, points: [...line.points] };
          });
          const changed = after.some((a, i) => a.points.length !== before[i].points.length || a.points.some((v, idx) => v !== before[i].points[idx]));
          if (changed) {
            setMyUndoStack(prev => [...prev, { type: 'move', before, after }]);
            setMyRedoStack([]);
          }
        }
        moveOriginalSnapshotsRef.current = null;
        isSelectionMovingRef.current = false;
        lastPointerPosRef.current = null;
        return;
      }
      if (isMarqueeActiveRef.current) {
        const data = marqueeRef.current;
        isMarqueeActiveRef.current = false;
        if (data) {
          const { start, current } = data;
          const x1 = Math.min(start.x, current.x);
          const y1 = Math.min(start.y, current.y);
            const x2 = Math.max(start.x, current.x);
          const y2 = Math.max(start.y, current.y);
          const newSelected = new Set<string>();
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxStroke = 0;
          linesRef.current.forEach(l => {
            if (l.authorId !== (ably.auth.clientId as string)) return;
            for (let i = 0; i < l.points.length; i += 2) {
              const px = l.points[i];
              const py = l.points[i+1];
              if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
                newSelected.add(l.id);
                for (let j = 0; j < l.points.length; j += 2) {
                  const sx = l.points[j];
                  const sy = l.points[j+1];
                  if (sx < minX) minX = sx;
                  if (sy < minY) minY = sy;
                  if (sx > maxX) maxX = sx;
                  if (sy > maxY) maxY = sy;
                }
                if (l.strokeWidth > maxStroke) maxStroke = l.strokeWidth;
                break;
              }
            }
          });
          setSelectedIds(newSelected);
          if (newSelected.size > 0 && isFinite(minX)) {
            const pad = maxStroke / 2 + 4;
            setSelectionBBox({ x: minX - pad, y: minY - pad, width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 });
            setSelectionBaseRect({ x: minX - pad, y: minY - pad, width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 });
            setSelectionAngle(0);
          } else setSelectionBBox(null);
        }
        marqueeRef.current = null;
        setMarqueeBox(null);
        return;
      }
      return;
    }
    isDrawing.current = false;
    const currentId = currentLineIdRef.current;
    if (!currentId) return;
    const idx = linesRef.current.findIndex((l) => l.id === currentId);
    const latestLine = idx >= 0 ? linesRef.current[idx] : undefined;
    if (latestLine && latestLine.authorId === (ably.auth.clientId as string)) {
      setMyUndoStack((prev) => [...prev, { type: 'add', line: latestLine, index: idx }]);
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
    if (last.type === 'add') {
      setLines(prev => prev.filter(l => l.id !== last.line.id));
      channel.publish('delete-line', { id: last.line.id });
    } else if (last.type === 'move') {
      setLines(prev => prev.map(l => {
        const snap = last.before.find(s => s.id === l.id);
        return snap ? { ...l, points: snap.points } : l;
      }));
      last.before.forEach(snap => channel.publish('update-line', { ...linesRef.current.find(l => l.id === snap.id), points: snap.points }));
    }
    setMyUndoStack(prev => prev.slice(0, -1));
    setMyRedoStack(prev => [...prev, last]);
    undoRedoBusyRef.current = false;
  }, [channel]);

  const redo = useCallback(() => {
    if (undoRedoBusyRef.current) return;
    const last = redoRef.current[redoRef.current.length - 1];
    if (!last) return;
    undoRedoBusyRef.current = true;
    if (last.type === 'add') {
      const { line, index } = last;
      setLines(prev => {
        const without = prev.filter(l => l.id !== line.id);
        const idx = Math.max(0, Math.min(index, without.length));
        const arr = [...without];
        arr.splice(idx, 0, line);
        return arr;
      });
      channel.publish('restore-line', { line: last.line, index: last.index });
    } else if (last.type === 'move') {
      setLines(prev => prev.map(l => {
        const snap = last.after.find(s => s.id === l.id);
        return snap ? { ...l, points: snap.points } : l;
      }));
      last.after.forEach(snap => channel.publish('update-line', { ...linesRef.current.find(l => l.id === snap.id), points: snap.points }));
    }
    setMyRedoStack(prev => prev.slice(0, -1));
    setMyUndoStack(prev => [...prev, last]);
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
  setLines([]);
  localStorage.removeItem(`meshink-room-${roomId}`);
  channel.publish('clear-canvas', {});
  setMyUndoStack([]);
  setMyRedoStack([]);
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
      const cursor = { pen: 'crosshair', pan: 'grab', eraser: 'cell', select: 'default' }[tool];
      stage.container().style.cursor = cursor;
    }
    if (tool !== 'select') {
      setSelectedIds(new Set());
      setSelectionBBox(null);
  setSelectionBaseRect(null);
  setSelectionAngle(0);
      marqueeRef.current = null;
      setMarqueeBox(null);
      isResizingRef.current = false;
      resizeDataRef.current = null;
  isRotatingRef.current = false;
  rotateDataRef.current = null;
    }
  }, [tool]);

  const getHandleUnderPointer = (p: { x: number; y: number }) => {
    if (!selectionBBox || selectedIds.size === 0) return null;
    const sizeScreen = 14;
    const half = (sizeScreen / stage.scale) / 2;
    const base = (selectionAngle !== 0 || (isRotatingRef.current && rotateDataRef.current)) ? (selectionBaseRect || selectionBBox) : selectionBBox;
    const x1 = base.x, y1 = base.y, x2 = x1 + base.width, y2 = y1 + base.height;
    const xc = (x1 + x2) / 2, yc = (y1 + y2) / 2;
    const raw = [
      { h: 'nw', x: x1, y: y1 }, { h: 'n', x: xc, y: y1 }, { h: 'ne', x: x2, y: y1 },
      { h: 'e', x: x2, y: yc }, { h: 'se', x: x2, y: y2 }, { h: 's', x: xc, y: y2 },
      { h: 'sw', x: x1, y: y2 }, { h: 'w', x: x1, y: yc },
    ];
    const liveAngle = selectionAngle + (isRotatingRef.current && rotateDataRef.current ? rotateDataRef.current.liveAngle : 0);
    if (Math.abs(liveAngle) < 1e-10) {
      for (const h of raw) {
        if (Math.abs(p.x - h.x) <= half && Math.abs(p.y - h.y) <= half) return h.h;
      }
      return null;
    }
    const center = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
    for (const h of raw) {
      const dx = h.x - center.x;
      const dy = h.y - center.y;
      const rx = center.x + dx * Math.cos(liveAngle) - dy * Math.sin(liveAngle);
      const ry = center.y + dx * Math.sin(liveAngle) + dy * Math.cos(liveAngle);
      if (Math.abs(p.x - rx) <= half && Math.abs(p.y - ry) <= half) return h.h;
    }
    return null;
  };

  const getResizeCursor = (h: string) => {
    if (h === 'nw' || h === 'se') return 'nwse-resize';
    if (h === 'ne' || h === 'sw') return 'nesw-resize';
    if (h === 'n' || h === 's') return 'ns-resize';
    if (h === 'e' || h === 'w') return 'ew-resize';
    return 'default';
  };

  const startResize = (handle: string) => {
    if (!selectionBBox || selectedIds.size === 0) return;
    const originSnapshots: MoveSnapshot[] = Array.from(selectedIds).map(id => ({ id, points: [...(linesRef.current.find(l => l.id === id)!.points)] }));
    if (originSnapshots.length === 0) return;
    const base = (selectionAngle !== 0 || (isRotatingRef.current && rotateDataRef.current)) ? (selectionBaseRect || selectionBBox) : selectionBBox;
    const center = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
    isResizingRef.current = true;
    resizeDataRef.current = {
      handle,
      originBBox: { ...base },
      originSnapshots,
      originAngle: selectionAngle + (isRotatingRef.current && rotateDataRef.current ? rotateDataRef.current.liveAngle : 0),
      center
    };
    const stageObj = stageRef.current; if (stageObj) stageObj.container().style.cursor = getResizeCursor(handle);
  };

  const isOnRotationHandle = (p: { x: number; y: number }) => {
  if (!selectionBBox) return false;
  const offsetScreen = 30;
  const sizeScreen = 16;
  const r = sizeScreen / stage.scale / 2;
  const base = selectionBaseRect || selectionBBox;
  const a = selectionAngle + (isRotatingRef.current && rotateDataRef.current ? rotateDataRef.current.liveAngle : 0);
  const center = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
  const midTop = { x: base.x + base.width / 2, y: base.y };
  const dx0 = midTop.x - center.x;
  const dy0 = midTop.y - center.y;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rmx = center.x + dx0 * cos - dy0 * sin;
  const rmy = center.y + dx0 * sin + dy0 * cos;
  const len = Math.sqrt((rmx - center.x) ** 2 + (rmy - center.y) ** 2) || 1;
  const normX = (rmx - center.x) / len;
  const normY = (rmy - center.y) / len;
  const handleDist = offsetScreen / stage.scale;
  const cx = rmx + normX * handleDist;
  const cy = rmy + normY * handleDist;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy <= r * r;
  };

  const startRotate = (pointer: { x: number; y: number }) => {
  if (!selectionBBox) return;
    const originSnapshots: MoveSnapshot[] = Array.from(selectedIds).map(id => {
      const line = linesRef.current.find(l => l.id === id)!;
      return { id, points: [...line.points] };
    });
    if (originSnapshots.length === 0) return;
  const base = selectionBaseRect || selectionBBox;
  const center = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
    const dx = pointer.x - center.x;
    const dy = pointer.y - center.y;
    const originAngle = Math.atan2(dy, dx);
    isRotatingRef.current = true;
  rotateDataRef.current = { originSnapshots, center, originAngle, originBBox: { ...base }, liveAngle: 0 };
    const stageObj = stageRef.current;
    if (stageObj) stageObj.container().style.cursor = 'grabbing';
  };

  const handleSetSavePreference = (preference: 'allow' | 'deny') => {
    localStorage.setItem('meshink-save-preference', preference);
    setSavePreference(preference);

    if (preference === 'allow') {
        const savedRooms = localStorage.getItem('meshink-recent-rooms');
        const recentRooms = savedRooms ? JSON.parse(savedRooms) : [];
        if (!recentRooms.includes(roomId)) {
            recentRooms.unshift(roomId);
            localStorage.setItem('meshink-recent-rooms', JSON.stringify(recentRooms.slice(0, 10))); // Limit to 10 recent rooms
        }
    }
  };

  const ToolButton = ({ name, children }: { name: 'pen' | 'pan' | 'eraser' | 'select', children: React.ReactNode }) => (
    <button onClick={() => setTool(name)} title={name.charAt(0).toUpperCase() + name.slice(1)} className={clsx('p-3 rounded-lg', { 'bg-blue-500 text-white': tool === name, 'hover:bg-slate-200 dark:hover:bg-slate-700': tool !== name }) }>
      {children}
    </button>
  );

const SelectIcon = ({
  active,
  mode,
}: {
  active: boolean;
  mode: 'light' | 'dark' | undefined;
}) => {
  const accent = mode === 'dark' ? '#60a5fa' : '#2563eb';
  const stroke = 'currentColor';
  const innerFill = active
    ? mode === 'dark'
      ? '#ffffff22'
      : '#00000018'
    : 'none';

  const x = 3;
  const y = 3;
  const size = 18;
  const r = 3;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x={x} y={y} width={size} height={size} rx={r} ry={r} stroke={stroke} strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" pathLength={72} />
      <rect x={8.5} y={8.5} width={7} height={7} fill={innerFill} stroke={active ? accent : 'none'} strokeWidth={active ? 1 : 0} />
      {active && (
        <g fill={accent}>
          <circle cx={x} cy={y} r={2.7} />
          <circle cx={x + size} cy={y} r={2.7} />
          <circle cx={x} cy={y + size} r={2.7} />
          <circle cx={x + size} cy={y + size} r={2.7} />
        </g>
      )}
    </svg>
  );
};


  

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
      <ClearCanvasModal
        isOpen={isClearCanvasModalOpen}
        onClose={() => setClearCanvasModalOpen(false)}
        onConfirm={handleClearCanvas}
      />

      <AnimatePresence>
        {savePreference === 'prompt' && (
          <SavePreferenceNotification 
              onAllow={() => handleSetSavePreference('allow')} 
              onDeny={() => handleSetSavePreference('deny')}
          />
        )}
      </AnimatePresence>

  <div className="absolute top-1/2 -translate-y-1/2 left-4 z-10 flex flex-col items-center gap-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl w-16 select-none">
        <div className="flex flex-col gap-1">
          <ToolButton name="pen"><PencilIcon /></ToolButton>
          <ToolButton name="eraser"><EraserIcon /></ToolButton>
          <ToolButton name="pan"><HandIcon /></ToolButton>
          <ToolButton name="select"><SelectIcon active={tool === 'select'} mode={(theme === 'dark' || theme === 'light') ? theme : undefined} /></ToolButton>
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
          <button onClick={() => setClearCanvasModalOpen(true)} title="Clear Canvas" className="p-3 hover:bg-red-500 hover:text-white rounded-lg">
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
              onMouseDown={(e) => {
                if (tool === 'select') {
                  if (line.authorId !== (ably.auth.clientId as string)) return;
                  e.cancelBubble = true;
                  setSelectedIds(new Set([line.id]));
                  if (line.points.length >= 2) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (let i = 0; i < line.points.length; i += 2) {
                      const px = line.points[i];
                      const py = line.points[i+1];
                      if (px < minX) minX = px;
                      if (py < minY) minY = py;
                      if (px > maxX) maxX = px;
                      if (py > maxY) maxY = py;
                    }
                    const pad = line.strokeWidth / 2 + 4;
                    setSelectionBBox({ x: minX - pad, y: minY - pad, width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 });
                      setSelectionBaseRect({ x: minX - pad, y: minY - pad, width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 });
                      setSelectionAngle(0);
                  } else {
                    setSelectionBBox(null);
                      setSelectionBaseRect(null);
                      setSelectionAngle(0);
                  }
                  isSelectionMovingRef.current = false;
                  lastPointerPosRef.current = null;
                }
              }}
            />
          ))}
          {tool === 'select' && selectionBBox && selectedIds.size > 0 && ((isRotatingRef.current && rotateDataRef.current) || selectionAngle !== 0) && (() => {
            const active = isRotatingRef.current && rotateDataRef.current;
            const base = selectionBaseRect || selectionBBox;
            const a = (selectionAngle + (active ? rotateDataRef.current!.liveAngle : 0));
            const center = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
            const originBBox = base;
            const liveAngle = a;
            const x1 = originBBox.x;
            const y1 = originBBox.y;
            const x2 = x1 + originBBox.width;
            const y2 = y1 + originBBox.height;
            const corners = [
              { x: x1, y: y1 },
              { x: x2, y: y1 },
              { x: x2, y: y2 },
              { x: x1, y: y2 },
            ].map(p => {
              const dx = p.x - center.x;
              const dy = p.y - center.y;
              const rx = center.x + dx * Math.cos(liveAngle) - dy * Math.sin(liveAngle);
              const ry = center.y + dx * Math.sin(liveAngle) + dy * Math.cos(liveAngle);
              return { x: rx, y: ry };
            });
            const pts: number[] = [];
            corners.forEach(c => { pts.push(c.x, c.y); });
            pts.push(corners[0].x, corners[0].y);
            const midTop = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
            const dirX = midTop.x - center.x;
            const dirY = midTop.y - center.y;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            const normX = dirX / len;
            const normY = dirY / len;
            const handleDist = 30 / stage.scale;
            const rotHandle = { x: midTop.x + normX * handleDist, y: midTop.y + normY * handleDist };
            const r = 16 / stage.scale / 2;
            const sizeScreen = 14; const w = sizeScreen / stage.scale; const half = w/2;
            const handleDefs = [
              { h:'nw', p: corners[0] },
              { h:'n', p: { x:(corners[0].x+corners[1].x)/2, y:(corners[0].y+corners[1].y)/2 } },
              { h:'ne', p: corners[1] },
              { h:'e', p: { x:(corners[1].x+corners[2].x)/2, y:(corners[1].y+corners[2].y)/2 } },
              { h:'se', p: corners[2] },
              { h:'s', p: { x:(corners[2].x+corners[3].x)/2, y:(corners[2].y+corners[3].y)/2 } },
              { h:'sw', p: corners[3] },
              { h:'w', p: { x:(corners[3].x+corners[0].x)/2, y:(corners[3].y+corners[0].y)/2 } },
            ];
            return (
              <>
                <Line points={pts} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} dash={[6 / stage.scale, 4 / stage.scale]} closed listening={false} />
                <Line points={[midTop.x, midTop.y, rotHandle.x, rotHandle.y]} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} listening={false} />
                <Rect x={rotHandle.x - r} y={rotHandle.y - r} width={r * 2} height={r * 2} cornerRadius={r} fill={theme === 'dark' ? '#1e293b' : '#f1f5f9'} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} onMouseDown={e => { if (tool === 'select') { e.cancelBubble = true; startRotate(rotHandle); } }} />
                {!active && handleDefs.map(h => (
                  <Rect key={h.h} x={h.p.x - half} y={h.p.y - half} width={w} height={w} fill={theme === 'dark' ? '#1e293b' : '#f1f5f9'} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} onMouseDown={e => { if (tool === 'select') { e.cancelBubble = true; startResize(h.h); } }} />
                ))}
              </>
            );
          })()}
          {tool === 'select' && selectionBBox && selectedIds.size > 0 && selectionAngle === 0 && !isRotatingRef.current && (
            <Rect
              x={selectionBBox.x}
              y={selectionBBox.y}
              width={selectionBBox.width}
              height={selectionBBox.height}
              stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'}
              strokeWidth={1 / stage.scale}
              dash={[6 / stage.scale, 4 / stage.scale]}
              listening={false}
            />
          )}
          {tool === 'select' && selectionBBox && selectedIds.size > 0 && selectionAngle === 0 && !isRotatingRef.current && (
            <>
              {(() => {
                const sizeScreen = 14;
                const w = sizeScreen / stage.scale;
                const half = w / 2;
                const sb = selectionBBox;
                const x1 = sb.x;
                const y1 = sb.y;
                const x2 = sb.x + sb.width;
                const y2 = sb.y + sb.height;
                const xc = (x1 + x2) / 2;
                const yc = (y1 + y2) / 2;
                const data: { h: string; x: number; y: number }[] = [
                  { h: 'nw', x: x1, y: y1 },
                  { h: 'n', x: xc, y: y1 },
                  { h: 'ne', x: x2, y: y1 },
                  { h: 'w', x: x1, y: yc },
                  { h: 'e', x: x2, y: yc },
                  { h: 'sw', x: x1, y: y2 },
                  { h: 's', x: xc, y: y2 },
                  { h: 'se', x: x2, y: y2 },
                ];
                return !isRotatingRef.current ? data.map(d => (
                  <Rect
                    key={d.h}
                    x={d.x - half}
                    y={d.y - half}
                    width={w}
                    height={w}
                    fill={theme === 'dark' ? '#1e293b' : '#f1f5f9'}
                    stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'}
                    strokeWidth={1 / stage.scale}
                    onMouseDown={e => { if (tool === 'select') { e.cancelBubble = true; startResize(d.h); } }}
                  />
                )) : null;
              })()}
              {(() => {
                const offsetScreen = 30;
                const sizeScreen = 16;
                const offset = offsetScreen / stage.scale;
                const r = sizeScreen / stage.scale / 2;
                const cx = selectionBBox.x + selectionBBox.width / 2;
                const cy = selectionBBox.y - offset;
                return !isRotatingRef.current ? (
                  <>
                    <Line points={[cx, selectionBBox.y, cx, cy + r]} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} listening={false} />
                    <Rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} cornerRadius={r} fill={theme === 'dark' ? '#1e293b' : '#f1f5f9'} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} onMouseDown={e => { if (tool === 'select') { e.cancelBubble = true; startRotate({ x: cx, y: cy }); } }} />
                  </>
                ) : null;
              })()}
            </>
          )}
      {tool === 'select' && marqueeBox && (
            <>
              <Rect
                x={marqueeBox.x}
                y={marqueeBox.y}
                width={marqueeBox.width}
                height={marqueeBox.height}
                stroke={theme === 'dark' ? '#38bdf8' : '#0ea5e9'}
                strokeWidth={1 / stage.scale}
                dash={[4 / stage.scale, 3 / stage.scale]}
                listening={false}
              />
              <Rect
                x={marqueeBox.x}
                y={marqueeBox.y}
                width={marqueeBox.width}
                height={marqueeBox.height}
        fill={(theme === 'dark' ? '#38bdf8' : '#0ea5e9') + '33'}
                listening={false}
              />
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default Canvas;
