'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useStep1StateMachine } from './useStep1StateMachine';

interface UseProductSessionParams {
  session: any;
  product: any;
  userId: string;
  placements: any;
  uploadedFiles: string[];
  placementsConfirmed: boolean;
  generateDeliverable: () => Promise<void>;
  handleExtractPlacements: () => Promise<void>;
  step1MachineTransitions: ReturnType<typeof useStep1StateMachine>['transitions'];
  setPlacementsConfirmed: (v: boolean) => void;
  setUploadError: (err: string | null) => void;
}

export function useProductSession({
  session,
  product,
  userId,
  placements,
  uploadedFiles,
  placementsConfirmed,
  generateDeliverable,
  handleExtractPlacements,
  step1MachineTransitions,
  setPlacementsConfirmed,
  setUploadError,
}: UseProductSessionParams) {
  const [currentStep, setCurrentStep] = useState<number>(session.current_step);
  const [stepResponse, setStepResponse] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState<number>(session.current_section || 1);
  const [followupCounts, setFollowupCounts] = useState<Record<number, number>>(
    session.followup_counts || {}
  );
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [showIntroReply, setShowIntroReply] = useState<boolean>(false);
  const [seedInsightShown, setSeedInsightShown] = useState(false);
  const [isBetaParticipant, setIsBetaParticipant] = useState(false);

  const steps = (product.steps || []).slice().sort((a: any, b: any) => {
    const orderA = typeof a?.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
    const orderB = typeof b?.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
    if (orderA === orderB) return 0;
    return orderA - orderB;
  });

  useEffect(() => {
    const fetchBetaStatus = async () => {
      try {
        const { data } = await supabase
          .from('beta_participants')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        setIsBetaParticipant(Boolean(data?.id));
      } catch (error) {
        console.error('Failed to fetch beta participant status:', error);
      }
    };
    fetchBetaStatus();
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setStepResponse('');
  }, [currentStep, showFollowUp]);

  useEffect(() => {
    const sendIntro = async () => {
      if (placementsConfirmed && !assistantReply && currentStep === 1 && !showIntroReply) {
        try {
          const isPersonalAlignment = product.product_slug === 'personal-alignment';
          const introQuestion = isPersonalAlignment
            ? 'Acknowledge placements and core identity/values themes using Sun/Moon/Rising, Venus, and HD type.'
            : 'Acknowledge placements and money/creation themes.';

          const res = await fetch('/api/products/step-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stepNumber: 0,
              stepData: { title: 'Chart Read', question: introQuestion },
              mainResponse: 'Confirmed chart placements.',
              placements,
              sessionId: session.id,
              userId,
              productSlug: product.product_slug,
              systemPrompt: product.system_prompt,
              productName: product.name,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setAssistantReply(data.aiResponse || '');
            setShowIntroReply(true);
          }
        } catch (e) {
          console.error('Intro reply failed', e);
        }
      }
    };
    sendIntro();
  }, [placementsConfirmed, assistantReply, currentStep, showIntroReply, placements, product.system_prompt, product.name]);

  useEffect(() => {
    const seedInsight = async () => {
      if (placementsConfirmed && currentStep === 2 && !seedInsightShown) {
        try {
          const isPersonalAlignment = product.product_slug === 'personal-alignment';
          const seedTitle = isPersonalAlignment
            ? 'Initial chart + identity clarity'
            : 'Initial chart + money clarity';
          const seedQuestion = isPersonalAlignment
            ? 'Give 2-3 sentences on their core identity, natural energy design, and value system using confirmed placements only. Reference Sun/Moon/Rising for core self, Venus for values, Mars for action style, and HD type/strategy/authority for energy design. Include one actionable alignment nudge. No speculation on unknowns.'
            : 'Give 2-3 sentences on money/self-worth/creation using confirmed placements only. Include: 2nd house sign+ruler+its location; if 2nd is empty, say what that means; note key money houses (2/8/10/11) only when known; one actionable business/money takeaway. No speculation on unknowns.';

          const res = await fetch('/api/products/step-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stepNumber: 0,
              stepData: { title: seedTitle, question: seedQuestion },
              mainResponse: 'Use confirmed placements to orient the user before Q&A.',
              placements,
              sessionId: session.id,
              userId,
              productSlug: product.product_slug,
              systemPrompt: product.system_prompt,
              productName: product.name,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setAssistantReply(data.aiResponse || '');
          } else {
            const errorData = await res.json();
            console.error('Seed insight API error:', res.status, errorData);
          }
        } catch (e) {
          console.error('Seed insight failed:', e);
        } finally {
          setSeedInsightShown(true);
        }
      }
    };
    seedInsight();
  }, [placementsConfirmed, currentStep, seedInsightShown, placements, product.system_prompt, product.name]);

  const appendConversation = async (
    stepNumber: number,
    newMessages: Array<{ role: string; content: string; type?: string }>
  ) => {
    const { data } = await supabase
      .from('conversations')
      .select('messages')
      .eq('session_id', session.id)
      .eq('step_number', stepNumber)
      .maybeSingle();
    const existing = (data?.messages as any[]) || [];
    const updated = [
      ...existing,
      ...newMessages.map((m) => ({
        ...m,
        created_at: new Date().toISOString(),
      })),
    ];
    await supabase.from('conversations').upsert(
      {
        session_id: session.id,
        step_number: stepNumber,
        messages: updated,
      },
      { onConflict: 'session_id,step_number' }
    );
  };

  const moveToNextStep = async () => {
    setIsSubmitting(true);

    try {
      const nextStep = currentStep + 1;
      const isComplete = nextStep > steps.length;

      if (isComplete) {
        await generateDeliverable();
      } else {
        await supabase
          .from('product_sessions')
          .update({
            current_step: nextStep,
            current_section: Math.max(currentSection, 1),
            followup_counts: followupCounts,
          })
          .eq('id', session.id)
          .eq('user_id', userId);

        setCurrentStep(nextStep);
        setStepResponse('');
        setShowFollowUp(false);
        setFollowUpCount(0);
        setAssistantReply('');
        setSeedInsightShown(false);
        setShowIntroReply(false);
      }
    } catch (error) {
      console.error('Error moving to next step:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepSubmit = async () => {
    const currentStepData = steps[currentStep - 1];
    const isUploadStep = currentStepData?.allow_file_upload && !currentStepData?.question;

    if (isUploadStep) {
      if (uploadedFiles.length === 0) {
        setUploadError('Please attach at least one file to continue.');
        return;
      }
      if (currentStep === 1) {
        setUploadError(null);
        await handleExtractPlacements();
        return;
      }
    } else {
      if (!stepResponse.trim()) return;
    }

    setIsSubmitting(true);

    try {
      try {
        const stepKey = `step_${currentStep}`;
        const { data: stepDataRecord } = await supabase
          .from('product_sessions')
          .select('step_data')
          .eq('id', session.id)
          .single();
        const existingStepData = (stepDataRecord?.step_data as Record<string, any>) || {};
        const nextStepData = {
          ...existingStepData,
          [stepKey]: {
            answer: isUploadStep
              ? `Uploaded files: ${uploadedFiles.join(', ')}`
              : stepResponse,
            completed_at: new Date().toISOString(),
          },
        };

        await supabase
          .from('product_sessions')
          .update({ step_data: nextStepData, last_activity_at: new Date().toISOString() })
          .eq('id', session.id)
          .eq('user_id', userId);
      } catch (e) {
        console.error('[step-data] Failed to persist step data', e);
      }

      await appendConversation(currentStep, [
        {
          role: 'user',
          content: isUploadStep
            ? `Uploaded files: ${uploadedFiles.join(', ')}`
            : stepResponse,
          type: 'main_response',
        },
      ]);

      if (currentStepData.allow_followup && followUpCount < 3) {
        setShowFollowUp(true);
      } else {
        await moveToNextStep();
      }

      if (!isUploadStep) {
        try {
          const insightRes = await fetch('/api/products/step-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stepNumber: currentStep,
              stepData: currentStepData,
              mainResponse: stepResponse,
              placements,
              sessionId: session.id,
              userId,
              productSlug: product.product_slug,
              systemPrompt: product.system_prompt,
              productName: product.name,
            }),
          });
          if (insightRes.ok) {
            const data = await insightRes.json();
            setAssistantReply(data.aiResponse || '');
          }
        } catch (e) {
          console.error('Assistant reply failed', e);
        }
      }
    } catch (error) {
      console.error('Error submitting step:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUpComplete = () => {
    setShowFollowUp(false);
    moveToNextStep();
  };

  const handleReviewCharts = async () => {
    setPlacementsConfirmed(false);
    setCurrentStep(1);
    setStepResponse('');
    setShowFollowUp(false);
    await supabase
      .from('product_sessions')
      .update({ current_step: 1 })
      .eq('id', session.id)
      .eq('user_id', userId)
      .throwOnError();
  };

  return {
    currentStep,
    setCurrentStep,
    stepResponse,
    setStepResponse,
    showFollowUp,
    setShowFollowUp,
    followUpCount,
    setFollowUpCount,
    isSubmitting,
    setIsSubmitting,
    currentSection,
    followupCounts,
    assistantReply,
    showIntroReply,
    seedInsightShown,
    isBetaParticipant,
    appendConversation,
    handleStepSubmit,
    moveToNextStep,
    handleFollowUpComplete,
    handleReviewCharts,
  };
}
