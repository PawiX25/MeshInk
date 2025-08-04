
import * as Ably from "ably";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ABLY_API_KEY is not configured" });
    return;
  }

  const client = new Ably.Rest(apiKey);
  const clientId = `client-${Math.random().toString(36).substr(2, 9)}`;
  const tokenRequestData = await client.auth.createTokenRequest({ clientId });
  res.status(200).json(tokenRequestData);
}
