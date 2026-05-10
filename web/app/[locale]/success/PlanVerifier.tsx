'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function PlanVerifier() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const { data, error } = await supabase.functions.invoke('verify-checkout', {
          body: { session_id: sessionId, supabase_token: session.access_token },
        });
        if (!error && data?.plan) setPlan(data.plan);
      } catch (_) {}
    })();
  }, [sessionId]);

  if (!plan) return null;

  const label = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <p className="text-green-600 font-semibold text-sm mb-4">
      ✓ {label} プランが有効になりました / {label} plan is now active
    </p>
  );
}
