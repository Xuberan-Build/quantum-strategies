'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface UseStepPersistenceOptions {
  sessionId: string;
  currentStep: number;
}

export function useStepPersistence({ sessionId, currentStep }: UseStepPersistenceOptions) {
  const cacheRef = useRef<Map<number, any[]>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [restoredReply, setRestoredReply] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Single batch fetch for all steps on mount — no per-step queries
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('conversations')
        .select('step_number, messages')
        .eq('session_id', sessionId);

      if (data) {
        const cache = new Map<number, any[]>();
        for (const row of data) {
          cache.set(row.step_number, row.messages || []);
        }
        cacheRef.current = cache;
      }

      setIsLoaded(true);
    })();
  }, [sessionId]);

  // Derive restoredReply synchronously from cache whenever step or load state changes
  useEffect(() => {
    if (!isLoaded) return;
    const messages = cacheRef.current.get(currentStep) || [];
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    setRestoredReply(lastAssistant?.content || '');
  }, [isLoaded, currentStep]);

  const setDraft = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const key = `qs:draft:${sessionId}:${currentStep}`;
      timerRef.current = setTimeout(() => {
        if (value) {
          localStorage.setItem(key, value);
        } else {
          localStorage.removeItem(key);
        }
      }, 500);
    },
    [sessionId, currentStep]
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem(`qs:draft:${sessionId}:${currentStep}`);
  }, [sessionId, currentStep]);

  return { restoredReply, isLoaded, setDraft, clearDraft };
}
