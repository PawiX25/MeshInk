'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const CollapsibleShareNotification = ({
  roomId,
  isCreator,
}: { roomId: string; isCreator: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedItem, setCopiedItem] = useState<'link' | 'code' | null>(null);
  const [link, setLink] = useState('');

  useEffect(() => {
    setLink(`${window.location.origin}/canvas/${roomId}`);
    if (isCreator) {
      const t1 = setTimeout(() => setIsExpanded(true), 500);
      const t2 = setTimeout(() => setIsExpanded(false), 10000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [roomId, isCreator]);

  const handleCopy = (item: 'link' | 'code') => {
    const text = item === 'link' ? link : roomId;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedItem(item);
      setTimeout(() => setCopiedItem(null), 2500);
    });
  };

  return (
    <div className="fixed top-4 right-0 z-50 font-sans">
      <div className="flex items-stretch">
        <div
          className={clsx(
            'overflow-hidden transition-[width] duration-300 ease-out',
            isExpanded ? 'w-72' : 'w-0'
          )}
        >
          <div
            id="share-panel"
            className="h-full w-72 bg-slate-800 shadow-lg p-4
                       flex flex-col gap-3 rounded-l-xl rounded-r-none
                       border border-slate-700 border-r-0"
          >
            <h3 className="text-base font-semibold text-white">Share Canvas</h3>

            <div className="bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400">Room Code</p>
              <p className="text-lg font-mono font-bold text-white tracking-wider">{roomId}</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleCopy('link')}
                className={clsx(
                  'flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60',
                  'bg-blue-500 text-white hover:bg-blue-600'
                )}
                disabled={copiedItem !== null}
              >
                {copiedItem === 'link' ? <CheckIcon /> : <CopyIcon />}
                {copiedItem === 'link' ? 'Copied!' : 'Copy Link'}
              </button>

              <button
                onClick={() => handleCopy('code')}
                className={clsx(
                  'flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60',
                  'bg-slate-700 text-white hover:bg-slate-600'
                )}
                disabled={copiedItem !== null}
              >
                {copiedItem === 'code' ? <CheckIcon /> : <CopyIcon />}
                {copiedItem === 'code' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(v => !v)}
          className={clsx(
            isExpanded
              ? 'self-stretch w-10 rounded-l-none rounded-r-xl'
              : 'h-10 w-8 self-center rounded-l-xl rounded-r-none',
            'grid place-items-center',
            'transition-[width,height,border-radius] duration-300 ease-out',
            'bg-slate-800 text-white hover:bg-slate-700',
            'border border-slate-700 border-l-0 -ml-px',
            'shadow-lg select-none'
          )}
          title={isExpanded ? 'Zwiń' : 'Rozwiń'}
          aria-expanded={isExpanded}
          aria-controls="share-panel"
        >
          <span className={clsx('transition-transform duration-300', { 'rotate-180': isExpanded })}>
            <ChevronLeftIcon />
          </span>
        </button>
      </div>
    </div>
  );
};
