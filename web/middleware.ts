import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/((?!dashboard|api|_next|_static|_vercel|favicon|icon|og|.*\\..*).*)',
  ],
};
