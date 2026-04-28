'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface UseProductDeliverableParams {
  sessionId: string;
  productSlug: string;
  productName: string;
  placements: any;
  sessionCompletedAt: string | null;
}

export function useProductDeliverable({
  sessionId,
  productSlug,
  productName,
  placements,
  sessionCompletedAt,
}: UseProductDeliverableParams) {
  const [deliverable, setDeliverable] = useState<string | null>(null);
  const [deliverableError, setDeliverableError] = useState<string | null>(null);
  const [isGeneratingDeliverable, setIsGeneratingDeliverable] = useState(false);
  const [actionableNudges, setActionableNudges] = useState<string[]>([]);

  const loadDeliverable = async () => {
    const { data } = await supabase
      .from('product_sessions')
      .select('deliverable_content')
      .eq('id', sessionId)
      .single();

    if (data?.deliverable_content) {
      setDeliverable(data.deliverable_content);
    }
  };

  useEffect(() => {
    if (sessionCompletedAt) {
      loadDeliverable();
    }
  }, [sessionCompletedAt]);

  useEffect(() => {
    const extractNudges = async () => {
      if (!deliverable) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('messages, step_number')
        .eq('session_id', sessionId)
        .order('step_number', { ascending: true });

      if (error || !data) return;

      const nudges: string[] = [];

      data.forEach((conversation: any) => {
        const messages = conversation.messages || [];

        for (let i = 1; i < messages.length; i++) {
          const msg = messages[i];
          const prevMsg = messages[i - 1];

          if (msg.role !== 'assistant' || prevMsg.role !== 'user') continue;
          if (!msg.content) continue;

          const content = String(msg.content);

          const blockMatches = content.match(
            /(?:^|\n)\s*(Actionable (?:alignment )?nudge(?:\s*\([^)]*\))?|One (?:alignment|micro-action|identity-shift|powerful) (?:nudge|action|step))\s*:\s*([\s\S]*?)(?=\n\s*\n|\n\s*(?:\*\*|#{1,3}\s)|$)/gi
          );
          if (blockMatches) {
            blockMatches.forEach((block: string) => {
              const cleaned = block
                .replace(/\*\*/g, '')
                .replace(/^\s+|\s+$/g, '')
                .replace(/\n{3,}/g, '\n\n');
              if (cleaned.length > 40) nudges.push(cleaned);
            });
          }

          const endNudges = content.match(/(?:^|\n)(?:This week|Next step|Try this|Start by|Begin with)[^.!?]{20,250}[.!]/gi);
          if (endNudges) {
            endNudges.forEach((nudge: string) => {
              const trimmed = nudge.trim();
              if (trimmed.length > 30 && trimmed.length < 250) nudges.push(trimmed);
            });
          }

          const insights = content.match(/Your [^.!?]{10,80}(?:says|means|shows|suggests|confirms|reveals)[^.!?]{20,120}[.!]/gi);
          if (insights) {
            insights.forEach((insight: string) => {
              const trimmed = insight.trim();
              if (
                !trimmed.includes('Example:') &&
                !trimmed.includes('Step ') &&
                trimmed.length > 50 &&
                trimmed.length < 200
              ) {
                nudges.push(trimmed);
              }
            });
          }

          const actions = content.match(
            /(?:^|\n)(?:Choose|Write|Pick|Post|Add|Send|Reach out|Schedule|Plan|Draft|Review|Try|Start|Begin|Consider|Focus on|Design|Build|Create|Shift to|Release|Let go of|Lean into|Explore|Test|Practice|Run|Launch|Set up|Configure|Update|Refine)[^.!?]{30,200}[.!]/gi
          );
          if (actions) {
            actions.forEach((action: string) => {
              const trimmed = action.trim();
              const lower = trimmed.toLowerCase();
              const isQuestion =
                trimmed.includes('?') ||
                lower.includes(': are you') ||
                lower.includes(': do you') ||
                lower.includes(': can you') ||
                lower.includes(': would you');

              if (
                !isQuestion &&
                !trimmed.includes('Example:') &&
                !trimmed.includes('Step ') &&
                trimmed.length > 40 &&
                trimmed.length < 250
              ) {
                nudges.push(trimmed);
              }
            });
          }
        }
      });

      const unique = [...new Set(nudges)]
        .filter((n) => {
          const lower = n.toLowerCase();
          return (
            !lower.includes('looking at') &&
            !lower.includes('based on') &&
            !lower.includes('let me show') &&
            !lower.includes('quick clarifier') &&
            !lower.includes('let me ask') &&
            !lower.includes('i need to know') &&
            !lower.includes('help me understand') &&
            !lower.includes('can you tell me') &&
            !lower.startsWith('you ') &&
            !lower.startsWith('question:') &&
            !n.includes('?')
          );
        })
        .slice(0, 6);

      setActionableNudges(unique);
    };

    extractNudges();
  }, [deliverable, sessionId]);

  const generateDeliverable = async () => {
    setIsGeneratingDeliverable(true);
    setDeliverableError(null);

    try {
      const response = await fetch('/api/products/final-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          placements,
          productSlug,
          productName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[generateDeliverable] API error:', response.status, errorText);
        throw new Error(`Failed to generate your report (${response.status}). Please try again.`);
      }

      const responseData = await response.json();
      const { briefing: generatedDeliverable } = responseData;

      if (!generatedDeliverable) {
        throw new Error('No report content returned. Please try again.');
      }

      await supabase
        .from('product_sessions')
        .update({
          deliverable_content: generatedDeliverable,
          deliverable_generated_at: new Date().toISOString(),
          is_complete: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      setDeliverable(generatedDeliverable);
    } catch (error: any) {
      setDeliverableError(
        error?.message || 'Something went wrong generating your report. Please try again.'
      );
    } finally {
      setIsGeneratingDeliverable(false);
    }
  };

  return {
    deliverable,
    deliverableError,
    isGeneratingDeliverable,
    actionableNudges,
    loadDeliverable,
    generateDeliverable,
  };
}
