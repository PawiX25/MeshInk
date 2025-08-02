'use client';

import AblyProviderComponent from '@/components/AblyProvider';
import { ChannelProvider } from 'ably/react';
import dynamic from 'next/dynamic';

const Canvas = dynamic(() => import('@/components/Canvas'), { ssr: false });

export default function Home() {
  return (
    <AblyProviderComponent>
      <ChannelProvider channelName="canvas-drawings">
        <Canvas />
      </ChannelProvider>
    </AblyProviderComponent>
  );
}
