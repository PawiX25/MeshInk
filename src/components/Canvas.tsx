'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Stage, Layer, Line, Shape, Rect, Circle, Text } from 'react-konva';
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

const NicknameModal: React.FC<{
  isOpen: boolean;
  initial?: string;
  onSave: (name: string) => void;
}> = ({ isOpen, initial = '', onSave }) => {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial || ''), [initial]);
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md m-4 border border-slate-200 dark:border-slate-700"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-8 text-center">
              <h2 className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">Choose your nickname</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This nickname will be visible to others in the room.</p>
              <div className="mt-6">
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSave(value.trim()); }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                  placeholder="e.g., Anna, Ben..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button
                onClick={() => { if (value.trim()) onSave(value.trim()); }}
                className="px-6 py-3 font-semibold text-white bg-blue-500 rounded-xl hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-300 disabled:opacity-50"
                disabled={!value.trim()}
              >
                Save
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
  const [tool, setTool] = useState<'pen' | 'pan' | 'eraser' | 'select' | 'rect' | 'circle' | 'line'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isGridVisible, setGridVisible] = useState(true);
  const [myUndoStack, setMyUndoStack] = useState<UndoAction[]>([]);
  const [myRedoStack, setMyRedoStack] = useState<UndoAction[]>([]);
  const [isClearCanvasModalOpen, setClearCanvasModalOpen] = useState(false);
  const [savePreference, setSavePreference] = useState<'allow' | 'deny' | 'prompt'>('prompt');
  
  const isDrawing = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeTypeRef = useRef<'rect' | 'circle' | 'line' | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const zoomTargetRef = useRef<StageState>({ scale: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const ably = useAbly();
  const provisionalIdRef = useRef<string>('local-' + Math.random().toString(36).slice(2));
  const [clientIdResolved, setClientIdResolved] = useState<boolean>(false);
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
  const isShiftPressedRef = useRef(false);
  const [nickname, setNickname] = useState('');
  const [isNickModalOpen, setNickModalOpen] = useState(false);
  const [members, setMembers] = useState<{ clientId: string; nick: string }[]>([]);
  const stagesByClientRef = useRef<Record<string, StageState>>({});
  const presenceEnteredRef = useRef(false);
  const fallbackNick = useCallback((id: string) => `User ${String(id || '').slice(0, 4).toUpperCase()}`, []);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number; t: number }>>({});
  const [cursorColors, setCursorColors] = useState<Record<string, string>>({});
  const cursorColorStorageKey = 'meshink-cursor-color-map';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cursorColorStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setCursorColors(parsed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(cursorColorStorageKey, JSON.stringify(cursorColors)); } catch {}
  }, [cursorColors]);
  const generateColorForId = useCallback((id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    const sat = 65;
    const light = 55;
    return `hsl(${hue} ${sat}% ${light}%)`;
  }, []);
  useEffect(() => {
    if (members.length === 0) return;
    setCursorColors(prev => {
      let changed = false;
      const next = { ...prev };
      members.forEach(m => {
        if (!next[m.clientId]) {
          next[m.clientId] = generateColorForId(m.clientId);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [members, generateColorForId]);
  const updateCursorColor = (clientId: string, color: string) => {
    setCursorColors(prev => ({ ...prev, [clientId]: color }));
  };
  const [openColorEditor, setOpenColorEditor] = useState<null | { clientId: string; anchorRect: DOMRect }>(null);
  const [showCustomCursorPicker, setShowCustomCursorPicker] = useState(false);
  const colorSwatches = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#10b981','#06b6d4','#0ea5e9','#6366f1','#8b5cf6','#d946ef','#ec4899','#f43f5e','#6b7280','#ffffff','#000000'];
  const closeColorEditor = () => setOpenColorEditor(null);
  useEffect(() => {
    if (!openColorEditor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeColorEditor(); };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-cursor-color-popover]')) return;
      if (target.closest('[data-cursor-color-trigger]')) return;
      closeColorEditor();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [openColorEditor]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  useEffect(() => {
    const realId = ably?.auth?.clientId as string | undefined;
    if (!clientIdResolved && realId) {
      setClientIdResolved(true);
      const provisional = provisionalIdRef.current;
      if (provisional && provisional !== realId) {
        setLines(prev => prev.map(l => l.authorId === provisional ? { ...l, authorId: realId } : l));
      }
    }
  }, [ably?.auth?.clientId, clientIdResolved]);
  useEffect(() => {
    undoRef.current = myUndoStack;
    redoRef.current = myRedoStack;
  }, [myUndoStack, myRedoStack]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressedRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressedRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('meshink-nickname');
    if (saved && saved.trim()) {
      setNickname(saved.trim());
    } else {
      setNickModalOpen(true);
    }
  }, []);


  useEffect(() => {
    const cid = ably?.auth?.clientId as string | undefined;
    if (!cid) return;
    stagesByClientRef.current[cid] = stage;
  }, [stage, ably?.auth?.clientId]);

  const teleportToPoint = (wx: number, wy: number, desiredScale: number = 1) => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const targetX = cx - wx * desiredScale;
    const targetY = cy - wy * desiredScale;
    animate(stage.scale, desiredScale, {
      duration: 0.8,
      ease: 'easeInOut',
      onUpdate: (latest) => setStage((prev) => ({ ...prev, scale: latest }))
    });
    animate(stage.x, targetX, {
      duration: 0.8,
      ease: 'easeInOut',
      onUpdate: (latest) => setStage((prev) => ({ ...prev, x: latest }))
    });
    animate(stage.y, targetY, {
      duration: 0.8,
      ease: 'easeInOut',
      onUpdate: (latest) => setStage((prev) => ({ ...prev, y: latest }))
    });
  };

  const getLastClientPoint = (clientId: string): { x: number; y: number } | null => {
    const c = remoteCursors[clientId];
    if (c) return { x: c.x, y: c.y };
    const authored = linesRef.current.filter(l => l.authorId === clientId);
    if (authored.length > 0) {
      const last = authored[authored.length - 1];
      const pts = last.points;
      if (pts && pts.length >= 2) return { x: pts[pts.length - 2], y: pts[pts.length - 1] };
    }
    return null;
  };

  const teleportToClient = (clientId: string) => {
    const p = getLastClientPoint(clientId);
    if (!p) return;
    teleportToPoint(p.x, p.y, 1);
  };

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
      try {
        const pts: number[] = message.data?.points;
        if (Array.isArray(pts) && pts.length >= 2) {
          setRemoteCursors(prev => ({ ...prev, [message.clientId as string]: { x: pts[pts.length - 2], y: pts[pts.length - 1], t: Date.now() } }));
        }
      } catch {}
    } else if (message.name === 'update-line') {
      setLines((prev) => prev.map((l) => (l.id === message.data.id ? message.data : l)));
      try {
        const pts: number[] = message.data?.points;
        if (Array.isArray(pts) && pts.length >= 2) {
          setRemoteCursors(prev => ({ ...prev, [message.clientId as string]: { x: pts[pts.length - 2], y: pts[pts.length - 1], t: Date.now() } }));
        }
      } catch {}
    } else if (message.name === 'stage-update' || message.name === 'stage-snapshot') {
      try { stagesByClientRef.current[message.clientId as string] = message.data as StageState; } catch {}
    } else if (message.name === 'clear-canvas') {
      setLines([]);
      setMyUndoStack([]);
      setMyRedoStack([]);
    } else if (message.name === 'request-state') {
      channel.publish('sync-state', { lines, stage });
    } else if (message.name === 'sync-state') {
      setLines(message.data.lines);
  setMyUndoStack([]);
  setMyRedoStack([]);
      try { stagesByClientRef.current[message.clientId as string] = message.data.stage as StageState; } catch {}
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
    } else if (message.name === 'cursor') {
      const data = message.data as { x: number; y: number };
      if (typeof data?.x === 'number' && typeof data?.y === 'number') {
        setRemoteCursors(prev => ({ ...prev, [message.clientId as string]: { x: data.x, y: data.y, t: Date.now() } }));
      }
    } else if (message.name === 'stage-snapshot-request') {
      try { channel.publish('stage-snapshot', stage); } catch {}
    }
  });

  useEffect(() => {
    if (!channel) return;

    const refreshMembers = async () => {
      try {
        const list: any[] = await (channel.presence as any).get();
        if (!Array.isArray(list)) return;
        setMembers(
          list.map((m) => ({
            clientId: m.clientId,
            nick: (m.data && (m.data.nick as string)) || fallbackNick(m.clientId),
          }))
        );
      } catch {}
    };

    const onEnter = () => refreshMembers();
    const onLeave = () => refreshMembers();
    const onUpdate = () => refreshMembers();

    try {
      channel.presence.subscribe('enter', onEnter);
      channel.presence.subscribe('leave', onLeave);
      channel.presence.subscribe('update', onUpdate);
    } catch {}
    refreshMembers();

    return () => {
      try {
        channel.presence.unsubscribe('enter', onEnter);
        channel.presence.unsubscribe('leave', onLeave);
        channel.presence.unsubscribe('update', onUpdate);
      } catch {}
    };
  }, [channel, fallbackNick]);

  useEffect(() => {
    const cid = ably?.auth?.clientId as string | undefined;
    if (!channel || !cid || !nickname) return;
    try {
      if (!presenceEnteredRef.current) {
        channel.presence.enter({ nick: nickname });
        presenceEnteredRef.current = true;
      } else {
        channel.presence.update({ nick: nickname });
      }
    } catch {}
  }, [channel, ably?.auth?.clientId, nickname]);

  useEffect(() => {
    return () => {
      try {
        if (presenceEnteredRef.current && channel) {
          channel.presence.leave();
          presenceEnteredRef.current = false;
        }
      } catch {}
    };
  }, [channel]);

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
        } catch (e) {
          console.error("Failed to parse saved lines:", e);
        }
      }
    }
    channel.publish('request-state', {});
    try { channel.publish('stage-snapshot-request', {}); } catch {}
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
    const cid = (ably?.auth?.clientId as string) || provisionalIdRef.current;
    const lineId = `${cid}-${Date.now()}`;
    const shapeTools: Set<string> = new Set(['rect', 'circle', 'line']);
    if (shapeTools.has(tool)) {
      shapeStartRef.current = { x: pos.x, y: pos.y };
      shapeTypeRef.current = tool as 'rect' | 'circle' | 'line';
      const newLine: LineData = { id: lineId, points: [pos.x, pos.y], color, strokeWidth, tool: 'pen', authorId: cid };
      setLines((prev) => [...prev, newLine]);
      channel.publish('new-line', newLine);
      currentLineIdRef.current = lineId;
      return;
    }
    const newLine: LineData = { id: lineId, points: [pos.x, pos.y], color, strokeWidth, tool: tool === 'eraser' ? 'eraser' : 'pen', authorId: cid };
    setLines((prev) => [...prev, newLine]);
    channel.publish('new-line', newLine);
    currentLineIdRef.current = lineId;
  };

  const publishCursor = useMemo(() => throttle((pos: { x: number; y: number }) => {
    try { channel.publish('cursor', pos); } catch {}
  }, 40), [channel]);

  const handleMouseMove = () => {
    if (tool === 'pan') return;
    if (tool === 'select') {
      const pointer = getPointerPosition();
      if (!pointer) return;
      publishCursor({ x: pointer.x, y: pointer.y });
      if (isRotatingRef.current && rotateDataRef.current) {
        const { originSnapshots, center, originAngle } = rotateDataRef.current;
        const dx = pointer.x - center.x;
        const dy = pointer.y - center.y;
        const angle = Math.atan2(dy, dx);
        let delta = angle - originAngle;
        if (isShiftPressedRef.current) {
          const step = Math.PI / 12;
          delta = Math.round(delta / step) * step;
        }
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
          if (isShiftPressedRef.current) {
            const aspect = originBBox.width / originBBox.height;
            const isCorner = (handle.includes('w') || handle.includes('e')) && (handle.includes('n') || handle.includes('s'));
            const rawW = x2 - x1;
            const rawH = y2 - y1;
            if (isCorner) {
              const dw = Math.abs(rawW - originBBox.width);
              const dh = Math.abs(rawH - originBBox.height);
              if (dw > dh) {
                const targetH = rawW / aspect;
                if (handle.includes('n')) y1 = y2 - targetH; else y2 = y1 + targetH;
              } else {
                const targetW = rawH * aspect;
                if (handle.includes('w')) x1 = x2 - targetW; else x2 = x1 + targetW;
              }
            } else {
              if (handle.includes('e') || handle.includes('w')) {
                const targetH = (x2 - x1) / aspect;
                const centerY = originBBox.y + originBBox.height / 2;
                const anchorY = handle.includes('n') ? originBBox.y + originBBox.height : (handle.includes('s') ? originBBox.y : centerY);
                if (anchorY === centerY) { y1 = centerY - targetH / 2; y2 = centerY + targetH / 2; }
                else if (anchorY === originBBox.y) { y1 = anchorY; y2 = anchorY + targetH; }
                else { y1 = anchorY - targetH; y2 = anchorY; }
              } else {
                const targetW = (y2 - y1) * aspect;
                const centerX = originBBox.x + originBBox.width / 2;
                const anchorX = handle.includes('w') ? originBBox.x + originBBox.width : (handle.includes('e') ? originBBox.x : centerX);
                if (anchorX === centerX) { x1 = centerX - targetW / 2; x2 = centerX + targetW / 2; }
                else if (anchorX === originBBox.x) { x1 = anchorX; x2 = anchorX + targetW; }
                else { x1 = anchorX - targetW; x2 = anchorX; }
              }
            }
          }
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
          originSnapshots.forEach(s=>{ const pts=updated[s.id]||s.points; for(let i=0;i<pts.length;i+=2){ const px=pts[i], py=pts[i+1]; if(px<minX)minX=px; if(py<minY)minY=py; if(px>maxX)maxX=px; if(py>maxY)maxY=py; } const line=linesRef.current.find(l=>l.id===s.id); if(line && line.strokeWidth>maxStroke) maxStroke=line.strokeWidth; });
          if(isFinite(minX)){ const pad=maxStroke/2+4; const bbox={x:minX-pad,y:minY-pad,width:(maxX-minX)+pad*2,height:(maxY-minY)+pad*2}; setSelectionBBox(bbox); setSelectionBaseRect(bbox); }
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
          if (isShiftPressedRef.current) {
            const aspect = originBBox.width / originBBox.height;
            const isCorner = (handle.includes('w') || handle.includes('e')) && (handle.includes('n') || handle.includes('s'));
            const rawW = x2 - x1;
            const rawH = y2 - y1;
            const dw = Math.abs(rawW - originBBox.width);
            const dh = Math.abs(rawH - originBBox.height);
            if (isCorner) {
              if (dw > dh) {
                const targetH = rawW / aspect;
                if (handle.includes('n')) y1 = y2 - targetH; else y2 = y1 + targetH;
              } else {
                const targetW = rawH * aspect;
                if (handle.includes('w')) x1 = x2 - targetW; else x2 = x1 + targetW;
              }
            } else {
              if (handle.includes('e') || handle.includes('w')) {
                const targetH = (x2 - x1) / aspect;
                const centerY = originBBox.y + originBBox.height / 2;
                const anchorY = handle.includes('n') ? originBBox.y + originBBox.height : (handle.includes('s') ? originBBox.y : centerY);
                if (anchorY === centerY) { y1 = centerY - targetH / 2; y2 = centerY + targetH / 2; }
                else if (anchorY === originBBox.y) { y1 = anchorY; y2 = anchorY + targetH; }
                else { y1 = anchorY - targetH; y2 = anchorY; }
              } else {
                const targetW = (y2 - y1) * aspect;
                const centerX = originBBox.x + originBBox.width / 2;
                const anchorX = handle.includes('w') ? originBBox.x + originBBox.width : (handle.includes('e') ? originBBox.x : centerX);
                if (anchorX === centerX) { x1 = centerX - targetW / 2; x2 = centerX + targetW / 2; }
                else if (anchorX === originBBox.x) { x1 = anchorX; x2 = anchorX + targetW; }
                else { x1 = anchorX - targetW; x2 = anchorX; }
              }
            }
          }
          if (x2 - x1 === 0 || y2 - y1 === 0) return; if (x2 < x1) [x1,x2]=[x2,x1]; if (y2<y1)[y1,y2]=[y2,y1];
          const minW=1e-6,minH=1e-6; if((x2-x1)<minW||(y2-y1)<minH) return;
          const scaleX=(x2-x1)/originBBox.width, scaleY=(y2-y1)/originBBox.height;
          let anchorX: number; let anchorY: number;
          if (handle.includes('w')) anchorX = originBBox.x + originBBox.width; else if (handle.includes('e')) anchorX = originBBox.x; else anchorX = originBBox.x + originBBox.width/2;
          if (handle.includes('n')) anchorY = originBBox.y + originBBox.height; else if (handle.includes('s')) anchorY = originBBox.y; else anchorY = originBBox.y + originBBox.height/2;

          const newCenterX = (x1 + x2) / 2;
          const newCenterY = (y1 + y2) / 2;

          const cosB = Math.cos(originAngle), sinB = Math.sin(originAngle);
          const updated: Record<string, number[]> = {};
          originSnapshots.forEach(s => {
            const pts: number[] = [];
            for(let i=0;i<s.points.length;i+=2){
              const ox=s.points[i], oy=s.points[i+1];
              const dx0=ox-center.x, dy0=oy-center.y;
              const lx=center.x + dx0 * cosA - dy0 * sinA;
              const ly=center.y + dx0 * sinA + dy0 * cosA;
              const sx = anchorX + (lx - anchorX) * scaleX;
              const sy = anchorY + (ly - anchorY) * scaleY;

              const dx1 = sx - newCenterX, dy1 = sy - newCenterY;
              const wx = newCenterX + dx1 * cosB - dy1 * sinB;
              const wy = newCenterY + dx1 * sinB + dy1 * cosB;
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
            setSelectionBBox(prev => prev ? { x: prev.x + dx, y: prev.y + dy, width: prev.width, height: prev.height } : prev);
          }
          if (selectionAngle !== 0 || (isRotatingRef.current && rotateDataRef.current)) {
            setSelectionBaseRect(prev => prev ? { x: prev.x + dx, y: prev.y + dy, width: prev.width, height: prev.height } : prev);
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
    publishCursor({ x: pos.x, y: pos.y });
    if (shapeTypeRef.current && shapeStartRef.current && currentLineIdRef.current) {
      const start = shapeStartRef.current;
      const kind = shapeTypeRef.current;
      let points: number[] = [];
      if (kind === 'line') {
        points = [start.x, start.y, pos.x, pos.y];
      } else if (kind === 'rect') {
        const x1 = start.x, y1 = start.y, x2 = pos.x, y2 = pos.y;
        points = [x1, y1, x2, y1, x2, y2, x1, y2, x1, y1]; 
      } else if (kind === 'circle') {
        const cx = (start.x + pos.x) / 2;
        const cy = (start.y + pos.y) / 2;
        const rx = Math.abs(pos.x - start.x) / 2;
        const ry = Math.abs(pos.y - start.y) / 2;
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI * 2;
            points.push(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
        }
      }
      setLines(prev => prev.map(l => {
        if (l.id !== currentLineIdRef.current) return l;
        const updated = { ...l, points };
        publishLineUpdate(updated);
        return updated;
      }));
      return;
    }
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
  shapeStartRef.current = null;
  shapeTypeRef.current = null;
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
  };

  const handleDragEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const newStageState = { scale: stage.scaleX(), ...stage.position() } as StageState;
    setStage(newStageState);
  };

  const handleDragMove = throttle((e: Konva.KonvaEventObject<DragEvent>) => {
    const s = e.target as Konva.Stage;
    const next = { scale: s.scaleX(), x: s.x(), y: s.y() } as StageState;
    setStage(next);
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
      const cursor = { pen: 'crosshair', pan: 'grab', eraser: 'cell', select: 'default', rect: 'crosshair', circle: 'crosshair', line: 'crosshair' }[tool];
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
    const originSnapshots: MoveSnapshot[] = Array.from(selectedIds).map(id => {
      const src = (lines.find(l => l.id === id) || linesRef.current.find(l => l.id === id))!;
      return { id, points: [...src.points] };
    });
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
  const base = (selectionAngle !== 0 || (isRotatingRef.current && rotateDataRef.current)) ? (selectionBaseRect || selectionBBox) : selectionBBox;
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
      const src = (lines.find(l => l.id === id) || linesRef.current.find(l => l.id === id))!;
      return { id, points: [...src.points] };
    });
    if (originSnapshots.length === 0) return;
  const base = (selectionBaseRect || selectionBBox) as { x: number; y: number; width: number; height: number };
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

  const ToolButton = ({ name, children }: { name: 'pen' | 'pan' | 'eraser' | 'select' | 'rect' | 'circle' | 'line', children: React.ReactNode }) => (
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

  const RectIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="12" rx="2"/></svg>
  );
  const EllipseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="12" rx="8" ry="5"/></svg>
  );
  const LineIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>
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

      <NicknameModal
        isOpen={isNickModalOpen}
        initial={nickname}
        onSave={(name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          localStorage.setItem('meshink-nickname', trimmed);
          setNickname(trimmed);
          setNickModalOpen(false);
        }}
      />

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl w-64 select-none">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Participants</span>
          <button
            className="text-xs px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
            onClick={() => setNickModalOpen(true)}
            title="Change nickname"
          >
            Change
          </button>
        </div>
        <div className="flex flex-col gap-1 max-h-60 overflow-auto">
          {members
            .slice()
            .sort((a, b) => (a.clientId === (ably?.auth?.clientId as string) ? -1 : b.clientId === (ably?.auth?.clientId as string) ? 1 : a.nick.localeCompare(b.nick)))
            .map((m) => {
              const self = m.clientId === (ably?.auth?.clientId as string);
              const canTeleport = !!getLastClientPoint(m.clientId);
              const color = cursorColors[m.clientId] || '#0ea5e9';
              return (
                <div key={m.clientId} className="flex items-center gap-2 group relative">
                  <button
                    type="button"
                    data-cursor-color-trigger
                    onClick={(e) => {
                      if (self) return; // user cannot change their own representation? (we allow editing others only as requested)
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setOpenColorEditor({ clientId: m.clientId, anchorRect: rect });
                    }}
                    title={self ? 'Your color is automatic' : 'Change this user\'s cursor color (local only)'}
                    className={clsx('w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm shrink-0', !self && 'cursor-pointer hover:scale-110 transition-transform', self && 'opacity-80')}
                    style={{ background: color }}
                    aria-label={!self ? `Edit color for ${m.nick}` : undefined}
                  />
                  <button
                    onClick={() => !self && canTeleport && teleportToClient(m.clientId)}
                    disabled={self || !canTeleport}
                    className={clsx(
                      'flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                      self ? 'bg-blue-500 text-white cursor-default' : 'bg-white/60 dark:bg-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-600/80',
                      (!self && !canTeleport) && 'opacity-60 cursor-not-allowed'
                    )}
                    title={self ? 'This is you' : (canTeleport ? 'Jump to this user view' : 'No view data yet')}
                  >
                    <span className="truncate">{self ? `${m.nick} (You)` : m.nick}</span>
                    {!self && <span className="text-xs opacity-70 group-hover:opacity-90">Teleport</span>}
                  </button>
                </div>
              );
            })}
          {openColorEditor && typeof window !== 'undefined' && createPortal(
            (() => {
              const { anchorRect, clientId } = openColorEditor;
              const existing = cursorColors[clientId] || '#0ea5e9';
              const top = anchorRect.top + window.scrollY + anchorRect.height + 6;
              const left = Math.min(
                Math.max(anchorRect.left + window.scrollX - 80, 8),
                window.innerWidth - 256 - 8
              );
              const setColor = (c: string) => updateCursorColor(clientId, c);
              return (
                <div
                  data-cursor-color-popover
                  className="fixed z-[9999] w-64 p-3 rounded-xl bg-slate-900/95 dark:bg-slate-900 backdrop-blur border border-slate-700 shadow-2xl flex flex-col gap-3 text-xs font-sans"
                  style={{ top, left }}
                  role="dialog"
                  aria-label="Edit cursor color"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 truncate mr-2">Cursor Color</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setShowCustomCursorPicker(false); }}
                        className={clsx('px-2 py-1 rounded-md text-[10px] transition-colors', !showCustomCursorPicker ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}
                      >Presets</button>
                      <button
                        onClick={() => { setShowCustomCursorPicker(true); }}
                        className={clsx('px-2 py-1 rounded-md text-[10px] transition-colors', showCustomCursorPicker ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}
                      >Custom</button>
                      <button
                        onClick={() => { setColor(generateColorForId(clientId)); }}
                        className="px-2 py-1 rounded-md text-[10px] bg-slate-700 text-slate-300 hover:bg-slate-600"
                        title="Reset to auto"
                      >Reset</button>
                    </div>
                  </div>
                  {!showCustomCursorPicker && (
                    <div className="grid grid-cols-8 gap-1" aria-label="Preset colors">
                      {colorSwatches.map(c => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className={clsx('w-6 h-6 rounded-md border border-black/20 dark:border-white/10 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500', existing.toLowerCase() === c.toLowerCase() && 'ring-2 ring-offset-1 ring-blue-500 ring-offset-slate-900')}
                          style={{ background: c }}
                          aria-label={`Set color ${c}`}
                        />
                      ))}
                    </div>
                  )}
                  {showCustomCursorPicker && (
                    <div className="flex flex-col gap-2" aria-label="Custom color picker">
                      <HexColorPicker color={(/^#([0-9a-fA-F]{3,8})$/.test(existing) ? existing : '#0ea5e9')} onChange={(c) => setColor(c)} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400 shrink-0">Hex</span>
                    <input
                      type="text"
                      value={existing.startsWith('#') ? existing : '#'}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (/^#([0-9a-fA-F]{3,8})$/.test(val)) setColor(val);
                      }}
                      maxLength={9}
                      className="flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Hex color value"
                    />
                    <div className="w-6 h-6 rounded-md border border-slate-600 shrink-0" style={{ background: existing }} aria-hidden />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { closeColorEditor(); setShowCustomCursorPicker(false); }}
                      className="px-3 py-1.5 rounded-md text-[11px] bg-slate-700 text-slate-200 hover:bg-slate-600"
                    >Close</button>
                  </div>
                </div>
              );
            })(),
            document.body
          )}
        </div>
      </div>

  <div className="absolute top-1/2 -translate-y-1/2 left-4 z-10 flex flex-col items-center gap-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl w-16 select-none">
        <div className="flex flex-col gap-1">
          <ToolButton name="pen"><PencilIcon /></ToolButton>
          <ToolButton name="eraser"><EraserIcon /></ToolButton>
          <ToolButton name="pan"><HandIcon /></ToolButton>
          <ToolButton name="select"><SelectIcon active={tool === 'select'} mode={(theme === 'dark' || theme === 'light') ? theme : undefined} /></ToolButton>
          <ToolButton name="rect"><RectIcon /></ToolButton>
          <ToolButton name="circle"><EllipseIcon /></ToolButton>
          <ToolButton name="line"><LineIcon /></ToolButton>
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
          {Object.entries(remoteCursors).map(([cid, c]) => {
            const isSelf = cid === (ably?.auth?.clientId as string);
            if (isSelf) return null;
            if (Date.now() - c.t > 3000) return null;
            const user = members.find(m => m.clientId === cid);
            const nick = user?.nick || fallbackNick(cid);
            const r = Math.max(3, Math.min(8, 6 / stage.scale));
            const yOffset = -10 / stage.scale;
            const fillColor = cursorColors[cid] || (theme === 'dark' ? '#38bdf8' : '#0ea5e9');
            return (
              <React.Fragment key={cid}>
                <Circle x={c.x} y={c.y} radius={r} fill={fillColor} listening={false} />
                <Text x={c.x + 8 / stage.scale} y={c.y + yOffset} text={nick} fontSize={12 / stage.scale} fill={theme === 'dark' ? '#e2e8f0' : '#0f172a'} listening={false} />
              </React.Fragment>
            );
          })}
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
                <Rect x={rotHandle.x - r} y={rotHandle.y - r} width={r * 2} height={r * 2} cornerRadius={r} fill={theme === 'dark' ? '#1e293b' : '#f1f5f9'} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} onMouseDown={e => { if (tool === 'select') { e.cancelBubble = true; const p = getPointerPosition(); startRotate(p || rotHandle); } }} />
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
                    <Rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} cornerRadius={r} fill={theme === 'dark' ? '#1e293b' : '#f1f5f9'} stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'} strokeWidth={1 / stage.scale} onMouseDown={e => { if (tool === 'select') { e.cancelBubble = true; const p = getPointerPosition(); startRotate(p || { x: cx, y: cy }); } }} />
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
