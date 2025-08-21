'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import Link from 'next/link';

const ArrowRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>;
const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [isCreating, startCreating] = useTransition();
  const [isJoining, startJoining] = useTransition();
  const [recentRooms, setRecentRooms] = useState<string[]>([]);

  const MiniCanvasIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-slate-300">
      <rect width="18" height="18" x="3" y="3" rx="2"/>
      <path d="M3 12h18M12 3v18"/>
    </svg>
  );

  const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );

  useEffect(() => {
    const loadRecentRooms = () => {
        const savedRooms = localStorage.getItem('meshink-recent-rooms');
        if (savedRooms) {
            setRecentRooms(JSON.parse(savedRooms));
        }
    }
    loadRecentRooms();

    window.addEventListener('focus', loadRecentRooms);
    return () => {
        window.removeEventListener('focus', loadRecentRooms);
    };
  }, []);

  const createRoom = () => {
    startCreating(() => {
      const newRoomId = nanoid(7);
      router.push(`/canvas/${newRoomId}?creator=true`);
    });
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      startJoining(() => {
        router.push(`/canvas/${roomId.trim()}`);
      });
    }
  };

  const handleClearRecent = () => {
    localStorage.removeItem('meshink-recent-rooms');
    setRecentRooms([]);
  };

  const isLoading = isCreating || isJoining;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 font-sans p-4">
      <div className="text-center p-8 max-w-2xl mx-auto">
        <h1 className="text-8xl font-bold text-slate-800 dark:text-white tracking-tighter">
          Mesh<span className="text-blue-500">Ink</span>
        </h1>
        <p className="mt-4 text-2xl text-slate-500 dark:text-slate-300">
          Your collaborative canvas. Real-time, intuitive, and ready for your ideas.
        </p>
      </div>

      <div className="mt-12 bg-white dark:bg-slate-800/50 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <button
          onClick={createRoom}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-semibold text-white bg-blue-500 rounded-xl shadow-lg hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-300 ease-in-out transform hover:-translate-y-px hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? <Spinner /> : <PlusIcon />}
          {isCreating ? 'Creating...' : 'Create a New Canvas'}
        </button>

        <div className="mt-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300 dark:border-slate-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Or join an existing one
              </span>
            </div>
          </div>
          <form onSubmit={joinRoom} className="flex items-center justify-center mt-6">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room code"
              disabled={isLoading}
              className="w-full px-5 py-4 text-lg text-center text-slate-700 bg-slate-100 border-2 border-slate-200 rounded-xl dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 dark:focus:ring-blue-500/30 transition-all duration-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="ml-3 p-4 font-semibold text-white bg-slate-700 rounded-xl shadow-md hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-500/50 dark:bg-slate-600 dark:hover:bg-slate-500 transition-all duration-300 transform hover:-translate-y-px hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Join Room"
            >
              {isJoining ? <Spinner /> : <ArrowRightIcon />}
            </button>
          </form>
        </div>
      </div>

      {recentRooms.length > 0 && (
        <div className="mt-12 w-full max-w-md">
          <div className="bg-white dark:bg-slate-800/50 p-5 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">Recent Canvases</h2>
              <button
                onClick={handleClearRecent}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {recentRooms.map((room) => (
                <Link key={room} href={`/canvas/${room}`} className="group">
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-500/70 dark:hover:border-blue-500/70">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700 p-2">
                        <MiniCanvasIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-blue-600 dark:text-blue-400 truncate">{room}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Click to re-open this canvas</p>
                      </div>
                      <ChevronRightIcon />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
