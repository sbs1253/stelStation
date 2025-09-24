import { NextResponse } from 'next/server';
import { parseFeedQueryFromURL } from '@/lib/validations/feed';
import { getFeedData } from '@/services/feed/getFeedData';

export async function GET(request: Request) {
  const url = new URL(request.url);

  let query: any;
  try {
    query = parseFeedQueryFromURL(url); // scope/creatorId/channelIds/...
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid query', details: e?.issues ?? String(e) }, { status: 400 });
  }

  const page = await getFeedData(query);
  return NextResponse.json(page);
}
