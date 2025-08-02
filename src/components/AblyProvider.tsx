
'use client';

import { AblyProvider } from "ably/react";
import * as Ably from "ably";

const client = new Ably.Realtime({ authUrl: 'api/ably-auth' });

export default function AblyProviderComponent({ children }) {
    return (
        <AblyProvider client={client}>
            {children}
        </AblyProvider>
    )
}
