'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';

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

  const isLoading = isCreating || isJoining;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
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
    </main>
  );
}
