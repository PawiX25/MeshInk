
'use client';

import { AblyProvider } from "ably/react";
import * as Ably from "ably";
import type { ReactNode } from "react";

const client = new Ably.Realtime({ authUrl: 'api/ably-auth' });

export default function AblyProviderComponent({
  children,
}: {
  children: ReactNode;
}) {
  return <AblyProvider client={client}>{children}</AblyProvider>;
}
