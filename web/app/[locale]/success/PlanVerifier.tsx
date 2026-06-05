'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function PlanVerifier() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sessionId = searchParams.get('session_id');
  const [plan, setPlan] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  const isJa = pathname.startsWith('/ja');
  const verifyingText = isJa ? '確認中…' : 'Verifying…';
  const activatedText = (planLabel: string) =>
    isJa
      ? `${planLabel} プランが有効になりました。ダッシュボードに移動します…`
      : `${planLabel} plan is now active. Redirecting to dashboard…`;

  useEffect(() => {
    if (!sessionId) { setVerifying(false); return; }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setVerifying(false); return; }
      try {
        const { data, error } = await supabase.functions.invoke('verify-checkout', {
          body: { session_id: sessionId, supabase_token: session.access_token },
        });
        if (!error && data?.plan) {
          setPlan(data.plan);
          setTimeout(() => router.push('/dashboard?refetch=1'), 2000);
        }
      } catch (_) {}
      setVerifying(false);
    })();
  }, [sessionId, router]);

  if (verifying) return <p className="text-sm text-gray-400 mb-4">{verifyingText}</p>;
  if (!plan) return null;

  const label = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <p className="text-green-600 font-semibold text-sm mb-4">
      ✓ {activatedText(label)}
    </p>
  );
}
