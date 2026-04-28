import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const url = new URL('/dashboard', req.url);
  if (code) url.searchParams.set('notion_code', code);
  return NextResponse.redirect(url);
}
