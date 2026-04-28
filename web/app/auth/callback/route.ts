import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/dashboard';

  // クライアントサイドで code を exchange してもらう（provider_token を保持するため）
  const redirectUrl = new URL(next, req.url);
  if (code) redirectUrl.searchParams.set('code', code);

  return NextResponse.redirect(redirectUrl);
}
