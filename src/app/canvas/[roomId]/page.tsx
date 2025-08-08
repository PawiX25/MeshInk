'use client';

import AblyProviderComponent from "@/components/AblyProvider";
import Canvas from "@/components/Canvas";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ChannelProvider } from "ably/react";
import { CollapsibleShareNotification } from "@/components/CollapsibleShareNotification";

const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;

const InvalidRoomPage = () => {
  const router = useRouter();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      <div className="text-center p-8 max-w-2xl mx-auto">
        <h1 className="text-8xl font-bold text-slate-800 dark:text-white tracking-tighter">
          Mesh<span className="text-blue-500">Ink</span>
        </h1>
      </div>

      <div className="mt-12 bg-white dark:bg-slate-800/50 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-red-500/50 dark:border-red-500/30">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-red-500">Canvas Not Found</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            The canvas you are looking for does not exist or the code is invalid.
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="mt-8 w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-semibold text-white bg-blue-500 rounded-xl shadow-lg hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-300 ease-in-out transform hover:-translate-y-px hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HomeIcon />
          Back to Homepage
        </button>
      </div>
    </main>
  );
};

export default function Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
  
  const [isCreator] = useState(() => searchParams.get('creator') === 'true');

  const isValid = typeof roomId === 'string' && roomId.length === 7;

  useEffect(() => {
    if (isCreator) {
      const newUrl = `${window.location.pathname}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    }
  }, [isCreator]);

  if (!isValid) {
    return <InvalidRoomPage />;
  }

  return (
    <div className="relative min-h-screen">
      <AblyProviderComponent>
        <ChannelProvider channelName={`canvas-drawings:${roomId}`}>
          <Canvas roomId={roomId} />
        </ChannelProvider>
      </AblyProviderComponent>
      <CollapsibleShareNotification roomId={roomId} isCreator={isCreator} />
    </div>
  );
}