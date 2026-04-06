'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProgressBar } from './ProgressBar';
import { StepView } from './StepView';
import { FollowUpChat } from './FollowUpChat';
import { DeliverableView } from './DeliverableView';
import { WelcomeBanner } from './WelcomeBanner';
import { supabase } from '@/lib/supabase/client';
import { isPlacementsEmpty } from '@/lib/utils/placements';
import { chartAnalysisModel, conversationalModel } from '@/lib/ai/models';
import { useStep1StateMachine } from './useStep1StateMachine';
import { THREE_RITES_PRODUCTS } from '@/lib/beta/constants';
import ScanFeedbackForm from '@/components/beta/ScanFeedbackForm';
import BlueprintFeedbackForm from '@/components/beta/BlueprintFeedbackForm';
import DeclarationFeedbackForm from '@/components/beta/DeclarationFeedbackForm';
import RiteOneConsolidationForm from '@/components/beta/RiteOneConsolidationForm';
import RiteTwoConsolidationForm from '@/components/beta/RiteTwoConsolidationForm';
import CompleteJourneyForm from '@/components/beta/CompleteJourneyForm';

interface ProductExperienceProps {
  product: any;
  session: any;
  userId: string;
}

export default function ProductExperience({
  product,
  session,
  userId,
}: ProductExperienceProps) {
  const [currentStep, setCurrentStep] = useState(session.current_step);
  const [stepResponse, setStepResponse] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliverable, setDeliverable] = useState<string | null>(null);
  const [deliverableError, setDeliverableError] = useState<string | null>(null);
  const [isGeneratingDeliverable, setIsGeneratingDeliverable] = useState(false);
  const [actionableNudges, setActionableNudges] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [placements, setPlacements] = useState<any>(session.placements || null);
  const [placementsConfirmed, setPlacementsConfirmed] = useState<boolean>(
    !!session.placements_confirmed
  );
  const [uploadsLoaded, setUploadsLoaded] = useState<boolean>(false);
  const [userPlacements, setUserPlacements] = useState<any>(null);
  const [currentSection, setCurrentSection] = useState<number>(
    session.current_section || 1
  );
  const [followupCounts, setFollowupCounts] = useState<Record<number, number>>(
    session.followup_counts || {}
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementNotes, setPlacementNotes] = useState<string>('');
  const searchParams = useSearchParams();
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [showIntroReply, setShowIntroReply] = useState<boolean>(false);
  const [seedInsightShown, setSeedInsightShown] = useState(false);
  const [isBetaParticipant, setIsBetaParticipant] = useState(false);

  // Step 1 State Machine - replaces fragile boolean flags
  const hasPlacementData = !isPlacementsEmpty(placements);
  const step1Machine = useStep1StateMachine({
    hasInstructions: !!product.instructions,
    hasPlacementsData: hasPlacementData,
    placementsConfirmed,
    isExtracting,
    currentStep,
  });

  const appendConversation = async (stepNumber: number, newMessages: Array<{ role: string; content: string; type?: string }>) => {
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
    await supabase
      .from('conversations')
      .upsert(
        {
          session_id: session.id,
          step_number: stepNumber,
          messages: updated,
        },
        { onConflict: 'session_id,step_number' }
      );
  };
  useEffect(() => {
    console.log(
      '[PX] initial mount',
      JSON.stringify(
        {
          sessionId: session.id,
          sessionCurrentStep: session.current_step,
          sessionPlacementsConfirmed: session.placements_confirmed,
          sessionPlacementsEmpty: isPlacementsEmpty(session.placements),
          stateCurrentStep: currentStep,
          statePlacementsConfirmed: placementsConfirmed,
          statePlacementsEmpty: isPlacementsEmpty(placements),
        },
        null,
        2
      )
    );
  }, []); // log once on mount

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setStepResponse('');
  }, [currentStep, showFollowUp]);

  // Fetch user's profile placements on mount
  useEffect(() => {
    const fetchUserPlacements = async () => {
      try {
        const response = await fetch('/api/profile/placements');
        if (response.ok) {
          const data = await response.json();
          setUserPlacements(data.placements);
        }
      } catch (error) {
        console.error('Failed to fetch user profile placements:', error);
      }
    };
    fetchUserPlacements();
  }, []);

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
    console.log(
      '[PX] state change',
      JSON.stringify(
        {
          currentStep,
          placementsConfirmed,
          step1State: step1Machine.state,
          placementsEmpty: isPlacementsEmpty(placements),
          uploadedFiles: uploadedFiles.length,
          showFollowUp,
        },
        null,
        2
      )
    );
  }, [placementsConfirmed, currentStep, step1Machine.state, placements, uploadedFiles.length, showFollowUp]);

  // Use steps directly from product (now stored in Supabase), sorted by explicit order when present.
  const steps = (product.steps || []).slice().sort((a: any, b: any) => {
    const orderA = typeof a?.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
    const orderB = typeof b?.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
    if (orderA === orderB) return 0;
    return orderA - orderB;
  });
  const currentStepData = steps[currentStep - 1];
  const isLastStep = currentStep === steps.length;
  const completionPercentage = Math.round((currentStep / steps.length) * 100);

  // Check if session is complete and load deliverable
  useEffect(() => {
    if (session.completed_at) {
      loadDeliverable();
    }
  }, [session.completed_at]);

  // REMOVED: Legacy boolean flag useEffects (now handled by state machine)
  // - Force user back to step 1 if placements not confirmed
  // - Erasure logic that deleted auto-copied placements
  // - Query param confirm=1 handling

  // Extract actionable nudges from conversations when deliverable is ready
  useEffect(() => {
    const extractNudges = async () => {
      if (!deliverable) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('messages, step_number')
        .eq('session_id', session.id)
        .order('step_number', { ascending: true });

      if (error || !data) return;

      const nudges: string[] = [];

      // Extract actionable insights from assistant responses
      data.forEach((conversation: any) => {
        const messages = conversation.messages || [];

        // Only process messages that follow user input (actual AI responses, not prompts)
        for (let i = 1; i < messages.length; i++) {
          const msg = messages[i];
          const prevMsg = messages[i - 1];

          // Skip if not an assistant message following a user message
          if (msg.role !== 'assistant' || prevMsg.role !== 'user') continue;
          if (!msg.content) continue;

          // PRIORITY 1: Extract explicit "Actionable alignment nudge" blocks (can span multiple lines)
          // Capture content until a blank line or a new header-style line.
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
              if (cleaned.length > 40) {
                nudges.push(cleaned);
              }
            });
          }

          // PRIORITY 2: Extract end-of-response nudges/next steps
          // Pattern: Sentences at end that start with action verbs
          const endNudges = content.match(/(?:^|\n)(?:This week|Next step|Try this|Start by|Begin with)[^.!?]{20,250}[.!]/gi);
          if (endNudges) {
            endNudges.forEach((nudge: string) => {
              const trimmed = nudge.trim();
              if (trimmed.length > 30 && trimmed.length < 250) {
                nudges.push(trimmed);
              }
            });
          }

          // Extract specific insights/observations about them
          // Pattern: "Your [chart thing] says/means/shows [insight]"
          const insights = content.match(/Your [^.!?]{10,80}(?:says|means|shows|suggests|confirms|reveals)[^.!?]{20,120}[.!]/gi);
          if (insights) {
            insights.forEach((insight: string) => {
              const trimmed = insight.trim();
              if (!trimmed.includes('Example:') &&
                  !trimmed.includes('Step ') &&
                  trimmed.length > 50 &&
                  trimmed.length < 200) {
                nudges.push(trimmed);
              }
            });
          }

          // Extract actionable next steps (imperative statements with action verbs)
          // Expanded verb list to catch more actionable advice
          const actions = content.match(/(?:^|\n)(?:Choose|Write|Pick|Post|Add|Send|Reach out|Schedule|Plan|Draft|Review|Try|Start|Begin|Consider|Focus on|Design|Build|Create|Shift to|Release|Let go of|Lean into|Explore|Test|Practice|Run|Launch|Set up|Configure|Update|Refine)[^.!?]{30,200}[.!]/gi);
          if (actions) {
            actions.forEach((action: string) => {
              const trimmed = action.trim();
              // Filter out questions disguised as actions and template content
              const lower = trimmed.toLowerCase();
              const isQuestion = trimmed.includes('?') ||
                                 lower.includes(': are you') ||
                                 lower.includes(': do you') ||
                                 lower.includes(': can you') ||
                                 lower.includes(': would you');

              if (!isQuestion &&
                  !trimmed.includes('Example:') &&
                  !trimmed.includes('Step ') &&
                  trimmed.length > 40 &&
                  trimmed.length < 250) {
                nudges.push(trimmed);
              }
            });
          }
        }
      });

      // Deduplicate, remove generic statements and clarifying questions, limit to top 6
      const unique = [...new Set(nudges)]
        .filter(n => {
          const lower = n.toLowerCase();
          // Filter out overly generic, template-like content, and clarifying questions
          return !lower.includes('looking at') &&
                 !lower.includes('based on') &&
                 !lower.includes('let me show') &&
                 !lower.includes('quick clarifier') &&
                 !lower.includes('let me ask') &&
                 !lower.includes('i need to know') &&
                 !lower.includes('help me understand') &&
                 !lower.includes('can you tell me') &&
                 !lower.startsWith('you ') &&
                 !lower.startsWith('question:') &&
                 !n.includes('?'); // Exclude any remaining questions
        })
        .slice(0, 6);

      setActionableNudges(unique);
    };

    extractNudges();
  }, [deliverable, session.id]);

  // Preload any existing uploaded documents (handles refresh)
  useEffect(() => {
    const loadUploads = async () => {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('storage_path')
        .eq('session_id', session.id);
      if (!error && data) {
        const paths = data.map((d: any) => d.storage_path).filter(Boolean);
        if (paths.length) {
          setUploadedFiles(paths);
          setUploadsLoaded(true);
          return;
        }
      }

      // Fallback: reuse latest confirmed session uploads for this user
      const { data: sourceSession } = await supabase
        .from('product_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('placements_confirmed', true)
        .not('placements', 'is', null)
        .neq('id', session.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sourceSession?.id) {
        const { data: sourceDocs } = await supabase
          .from('uploaded_documents')
          .select('storage_path,file_name,file_type,file_size')
          .eq('session_id', sourceSession.id)
          .order('created_at', { ascending: false });

        if (sourceDocs && sourceDocs.length > 0) {
          const insertRows = sourceDocs.map((doc: any) => ({
            user_id: userId,
            session_id: session.id,
            step_number: 1,
            file_name: doc.file_name,
            storage_path: doc.storage_path,
            file_type: doc.file_type,
            file_size: doc.file_size,
          }));
          await supabase.from('uploaded_documents').insert(insertRows);
          const paths = sourceDocs.map((doc: any) => doc.storage_path).filter(Boolean);
          if (paths.length) setUploadedFiles(paths);
        }
      }

      setUploadsLoaded(true);
    };
    loadUploads();
  }, [session.id]);

  // REMOVED: Legacy confirmation gate useEffects (now handled by state machine)
  // - Force confirmation gate on first load
  // - Force reset if placements empty but confirmed

  // Auto intro reply after placements confirmed
  useEffect(() => {
    const sendIntro = async () => {
      if (placementsConfirmed && !assistantReply && currentStep === 1 && !showIntroReply) {
        try {
          // Product-specific intro prompts
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

  // Seed an initial chart insight when the user first lands on step 2
  useEffect(() => {
    console.log('[PX] seedInsight effect check:', {
      placementsConfirmed,
      currentStep,
      seedInsightShown,
      shouldTrigger: placementsConfirmed && currentStep === 2 && !seedInsightShown
    });

    const seedInsight = async () => {
      if (placementsConfirmed && currentStep === 2 && !seedInsightShown) {
        console.log('[PX] Triggering seed insight for step 2');
        try {
          // Product-specific seed prompts
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
              stepData: {
                title: seedTitle,
                question: seedQuestion,
              },
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
            console.log('[PX] Seed insight full data:', data);
            console.log('[PX] Seed insight response:', data.aiResponse?.slice(0, 100));
            console.log('[PX] Setting assistantReply to:', data.aiResponse ? 'CONTENT PRESENT' : 'EMPTY');
            setAssistantReply(data.aiResponse || '');
          } else {
            const errorData = await res.json();
            console.error('[PX] Seed insight API error:', res.status, errorData);
          }
        } catch (e) {
          console.error('[PX] Seed insight failed:', e);
        } finally {
          setSeedInsightShown(true);
        }
      }
    };
    seedInsight();
  }, [placementsConfirmed, currentStep, seedInsightShown, placements, product.system_prompt, product.name]);

  const formatPlacementsForChat = (pl: any) => {
    if (!pl) return 'No placements extracted yet.';
    const astro = pl.astrology || {};
    const hd = pl.human_design || {};
    const astroLines = [
      `Sun: ${astro.sun || 'UNKNOWN'}`,
      `Moon: ${astro.moon || 'UNKNOWN'}`,
      `Rising: ${astro.rising || 'UNKNOWN'}`,
      `Mercury: ${astro.mercury || 'UNKNOWN'}`,
      `Venus: ${astro.venus || 'UNKNOWN'}`,
      `Mars: ${astro.mars || 'UNKNOWN'}`,
      `Jupiter: ${astro.jupiter || 'UNKNOWN'}`,
      `Saturn: ${astro.saturn || 'UNKNOWN'}`,
      `Uranus: ${astro.uranus || 'UNKNOWN'}`,
      `Neptune: ${astro.neptune || 'UNKNOWN'}`,
      `Pluto: ${astro.pluto || 'UNKNOWN'}`,
      `Houses: ${astro.houses || 'UNKNOWN'}`,
    ];
    const hdLines = [
      `Type: ${hd.type || 'UNKNOWN'}`,
      `Strategy: ${hd.strategy || 'UNKNOWN'}`,
      `Authority: ${hd.authority || 'UNKNOWN'}`,
      `Profile: ${hd.profile || 'UNKNOWN'}`,
      `Centers: ${hd.centers || 'UNKNOWN'}`,
      `Gifts: ${hd.gifts || 'UNKNOWN'}`,
    ];
    return `Astrology:\n${astroLines.join('\n')}\n\nHuman Design:\n${hdLines.join('\n')}`;
  };

  const loadDeliverable = async () => {
    const { data } = await supabase
      .from('product_sessions')
      .select('deliverable_content')
      .eq('id', session.id)
      .single();

    if (data?.deliverable_content) {
      setDeliverable(data.deliverable_content);
    }
  };

  const handleStepSubmit = async () => {
    const isUploadStep = currentStepData?.allow_file_upload && !currentStepData?.question;

    // Require files for upload steps, text for others
    if (isUploadStep) {
      if (uploadedFiles.length === 0) {
        setUploadError('Please attach at least one file to continue.');
        return;
      }
      // For step 1, trigger extraction when files are ready
      if (currentStep === 1) {
        setUploadError(null);
        await handleExtractPlacements(); // This will trigger state machine transitions
        return;
      }
    } else {
      if (!stepResponse.trim()) return;
    }

    setIsSubmitting(true);

    try {
      // Persist step response in product_sessions.step_data for structured scans
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

      // Save conversation to database (append to messages array)
      await appendConversation(currentStep, [
        {
          role: 'user',
          content: isUploadStep
            ? `Uploaded files: ${uploadedFiles.join(', ')}`
            : stepResponse,
          type: 'main_response',
        },
      ]);

      // Check if step allows follow-up questions
      if (currentStepData.allow_followup && followUpCount < 3) {
        setShowFollowUp(true);
      } else {
        await moveToNextStep();
      }

      // Generate assistant reply for this step (inline chat)
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

  const moveToNextStep = async () => {
    setIsSubmitting(true);

    try {
      // Move to next step or complete
      const nextStep = currentStep + 1;
      const isComplete = nextStep > steps.length;

      if (isComplete) {
        // Generate final deliverable
        await generateDeliverable();
      } else {
        // Update session progress
        await supabase
          .from('product_sessions')
          .update({
            current_step: nextStep,
            current_section: Math.max(currentSection, 1),
            followup_counts: followupCounts,
          })
          .eq('id', session.id)
          .eq('user_id', userId);

        // Reset state for next step
        setCurrentStep(nextStep);
        setStepResponse('');
        setShowFollowUp(false);
        setFollowUpCount(0);
        setAssistantReply(''); // Clear previous assistant reply for new step
        setSeedInsightShown(false); // Reset so GPT can respond at each step
        setShowIntroReply(false); // Reset intro reply flag
      }
    } catch (error) {
      console.error('Error moving to next step:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateDeliverable = async () => {
    setIsGeneratingDeliverable(true);
    setDeliverableError(null);

    try {
      console.log('[generateDeliverable] Called with placements:', JSON.stringify(placements, null, 2));

      const response = await fetch('/api/products/final-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          placements,
          productSlug: product.product_slug,
          productName: product.name,
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

      // Single save — deliverable_content is the canonical column read by loadDeliverable
      await supabase
        .from('product_sessions')
        .update({
          deliverable_content: generatedDeliverable,
          deliverable_generated_at: new Date().toISOString(),
          is_complete: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      console.log('[generateDeliverable] Deliverable saved, length:', generatedDeliverable.length);
      setDeliverable(generatedDeliverable);
    } catch (error: any) {
      console.error('[generateDeliverable] Error:', error);
      setDeliverableError(error?.message || 'Something went wrong generating your report. Please try again.');
    } finally {
      setIsGeneratingDeliverable(false);
    }
  };

  const handleFollowUpComplete = () => {
    setShowFollowUp(false);
    moveToNextStep();
  };

  const handleReviewCharts = async () => {
    // Reset to step 1 to review/edit placements
    // Setting placementsConfirmed=false triggers REVIEW state in state machine
    setPlacementsConfirmed(false); // Client-side triggers state machine REVIEW state
    setCurrentStep(1);
    setStepResponse('');
    setShowFollowUp(false);
    await supabase
      .from('product_sessions')
      .update({ current_step: 1 }) // Don't reset placements_confirmed in DB
      .eq('id', session.id)
      .eq('user_id', userId)
      .throwOnError();
  };

  const handleFileUpload = async (files: File[]) => {
    setUploadError(null);
    const uploadedUrls: string[] = [];
    // If user uploads new files, force re-confirmation
    if (placementsConfirmed) {
      console.log('[PX] new upload - resetting placementsConfirmed false');
      setPlacementsConfirmed(false); // Triggers state machine UPLOAD state
      await supabase
        .from('product_sessions')
        .update({ placements_confirmed: false })
        .eq('id', session.id)
        .eq('user_id', userId)
        .throwOnError();
    }

    for (const file of files) {
      const fileName = `${userId}/${session.id}/${Date.now()}_${file.name}`;

      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, file);

      if (!error && data) {
        // Save to database
        await supabase.from('uploaded_documents').insert({
          user_id: userId,
          session_id: session.id,
          step_number: currentStep,
          file_name: file.name,
          storage_path: data.path,
          file_type: file.type,
          file_size: file.size,
        });

        uploadedUrls.push(data.path);
      } else if (error) {
        console.error('File upload error', error);
        const detail = (error as any)?.message || 'Unknown storage error';
        setUploadError(`Upload failed: ${detail}. Ensure bucket "user-uploads" exists and storage policies allow inserts for authenticated users.`);
        return;
      }
    }

    setUploadedFiles([...uploadedFiles, ...uploadedUrls]);
  };

  const handleRemoveFile = async (path: string) => {
    // Remove from state immediately
    setUploadedFiles((prev) => prev.filter((p) => p !== path));
    // Clean up DB entry
    await supabase
      .from('uploaded_documents')
      .delete()
      .eq('session_id', session.id)
      .eq('storage_path', path);
  };

  const handleExtractPlacements = async () => {
    if (uploadedFiles.length === 0) {
      setUploadError('Please attach at least one file to continue.');
      return;
    }
    console.log('=== CLIENT: EXTRACTION STARTED ===');
    console.log('[PX] extract placements trigger', {
      uploadedFiles,
      placementsConfirmed,
      currentStep,
    });
    console.log('Calling extraction API with:', {
      sessionId: session.id,
      storagePaths: uploadedFiles,
      fileCount: uploadedFiles.length
    });

    setPlacementsError(null);
    setIsExtracting(true);
    step1Machine.transitions.uploadComplete(); // Trigger EXTRACTING state

    try {
      const startTime = Date.now();
      console.log('Fetching /api/products/extract-placements...');

      const response = await fetch('/api/products/extract-placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, storagePaths: uploadedFiles }),
      });

      const elapsed = Date.now() - startTime;
      console.log(`API response received after ${elapsed}ms, status: ${response.status}`);

      if (!response.ok) {
        const text = await response.text();
        console.error('API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: text
        });
        throw new Error(text || 'Extraction failed');
      }

      const responseData = await response.json();
      console.log('API success response:', responseData);
      console.log('Extracted placements:', JSON.stringify(responseData.placements, null, 2));

      const { placements: extracted } = responseData;
      setPlacements(extracted);
      console.log('=== CLIENT: EXTRACTION COMPLETED ===');
      step1Machine.transitions.extractionComplete(); // Trigger REVIEW state
    } catch (err: any) {
      console.error('=== CLIENT: EXTRACTION FAILED ===');
      console.error('Error details:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
      setPlacementsError(err?.message || 'Failed to extract placements. Please try again.');
      // Stay in current state on error (don't transition)
    } finally {
      setIsExtracting(false);
    }
  };

  // REMOVED: Legacy gate and auto-advance useEffects (now handled by state machine)
  // - Show confirmation gate after files uploaded
  // - Auto-advance to step 2 if placements confirmed
  // - Guard effect to normalize state

  // Generating deliverable — show loading screen
  if (isGeneratingDeliverable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem' }}>✨</div>
        <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Building your {product.name}...
        </h2>
        <p style={{ color: 'rgba(206, 190, 255, 0.7)', fontSize: '1rem', maxWidth: '400px', margin: 0 }}>
          Synthesizing your chart data and responses. This takes about 20–30 seconds.
        </p>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Deliverable generation failed — show error with retry
  if (deliverableError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{ color: 'rgba(252, 165, 165, 0.9)', fontSize: '1rem', maxWidth: '420px', margin: 0 }}>
          {deliverableError}
        </p>
        <button
          onClick={() => generateDeliverable()}
          style={{ padding: '0.875rem 2rem', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // If deliverable is ready, show it
  if (deliverable) {
    const productSlug = product.product_slug;
    const feedbackBlocks: ReactNode[] = [];

    if (isBetaParticipant) {
      if (THREE_RITES_PRODUCTS.PERCEPTION.includes(productSlug)) {
        feedbackBlocks.push(
          <ScanFeedbackForm
            key={`${productSlug}-scan-feedback`}
            productSlug={productSlug}
            sessionId={session.id}
          />
        );

        if (productSlug === THREE_RITES_PRODUCTS.PERCEPTION[THREE_RITES_PRODUCTS.PERCEPTION.length - 1]) {
          feedbackBlocks.push(
            <RiteOneConsolidationForm key="rite-one-consolidation" />
          );
        }
      }

      if (THREE_RITES_PRODUCTS.ORIENTATION.includes(productSlug)) {
        feedbackBlocks.push(
          <BlueprintFeedbackForm
            key={`${productSlug}-blueprint-feedback`}
            productSlug={productSlug}
            sessionId={session.id}
          />
        );

        if (productSlug === THREE_RITES_PRODUCTS.ORIENTATION[THREE_RITES_PRODUCTS.ORIENTATION.length - 1]) {
          feedbackBlocks.push(
            <RiteTwoConsolidationForm key="rite-two-consolidation" />
          );
        }
      }

      if (THREE_RITES_PRODUCTS.DECLARATION.includes(productSlug)) {
        feedbackBlocks.push(
          <DeclarationFeedbackForm
            key={`${productSlug}-declaration-feedback`}
            productSlug={productSlug}
            sessionId={session.id}
          />
        );

        if (productSlug === THREE_RITES_PRODUCTS.DECLARATION[THREE_RITES_PRODUCTS.DECLARATION.length - 1]) {
          feedbackBlocks.push(
            <CompleteJourneyForm key="complete-journey-feedback" />
          );
        }
      }
    }

    return (
      <DeliverableView
        deliverable={deliverable}
        productName={product.name}
        instructions={product.instructions}
        actionableNudges={actionableNudges}
        feedback={feedbackBlocks.length ? <div className="space-y-10">{feedbackBlocks}</div> : undefined}
      />
    );
  }

  // Step 1 State Machine Render Logic
  if (currentStep === 1) {
    // WELCOME STATE
    if (step1Machine.shouldShowWelcome) {
      return (
        <WelcomeBanner
          instructions={product.instructions}
          onBegin={() => step1Machine.transitions.welcomeComplete()}
        />
      );
    }

    // CONFIRMATION STATE (show "Use existing placements?" screen)
    if (step1Machine.shouldShowConfirmation) {
      console.log('[PX] showing confirmation gate');
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-900 to-black p-6 md:p-10">
          <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur-xl shadow-[0_25px_120px_-40px_rgba(0,0,0,0.75)]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-teal-200/80">Chart Data Found</p>
              <h1 className="text-3xl font-semibold text-white">Ready to continue?</h1>
              <p className="text-slate-200/85">
                {userPlacements
                  ? 'Using your chart data from your Profile. You can use these placements or upload new charts if anything has changed.'
                  : 'We found your chart data from a previous product. You can use the same placements or upload new charts if anything has changed.'}
              </p>
              {userPlacements && (
                <p className="text-xs text-teal-400/80 mt-2">
                  💡 Manage your chart data anytime in{' '}
                  <a href="/dashboard/profile" className="underline hover:text-teal-300">
                    Profile Settings
                  </a>
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300/80">Your placements</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-white">Astrology</p>
                  <div className="space-y-2 text-sm text-slate-200">
                    {['sun', 'moon', 'rising', 'venus', 'mars'].map((key) => {
                      const val = placements?.astrology?.[key] || 'Unknown';
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize text-slate-400">{key}:</span>
                          <span className="font-medium">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-white">Human Design</p>
                  <div className="space-y-2 text-sm text-slate-200">
                    {['type', 'strategy', 'authority', 'profile'].map((key) => {
                      const val = placements?.human_design?.[key] || 'Unknown';
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize text-slate-400">{key}:</span>
                          <span className="font-medium text-right ml-2">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  // Use existing placements - save to profile if needed, then move to step 2
                  if (!userPlacements) {
                    try {
                      await fetch('/api/profile/placements', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ placements, confirmed: true }),
                      });
                      setUserPlacements(placements);
                    } catch (error) {
                      console.error('Failed to save placements to profile:', error);
                    }
                  }

                  await supabase
                    .from('product_sessions')
                    .update({ current_step: 2, current_section: 1, placements_confirmed: true })
                    .eq('id', session.id)
                    .eq('user_id', userId);
                  setPlacementsConfirmed(true);
                  setCurrentStep(2);
                }}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-teal-500/30 transition-all hover:shadow-xl hover:shadow-teal-500/40 hover:scale-[1.02]"
              >
                ✓ Continue to Questions →
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => step1Machine.transitions.confirmEditPlacements()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02]"
                >
                  ✏️ Review & Edit
                </button>
                <button
                  onClick={async () => {
                    // Reset placements and go to upload
                    setPlacements(null);
                    setPlacementsConfirmed(false);
                    await supabase
                      .from('product_sessions')
                      .update({ placements: null, placements_confirmed: false })
                      .eq('id', session.id)
                      .eq('user_id', userId);
                    step1Machine.transitions.confirmUploadNew();
                  }}
                  className="flex-1 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 font-semibold text-white transition-all hover:bg-white/10"
                >
                  Upload New
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // EXTRACTING STATE - show loading animation
    if (step1Machine.shouldShowExtracting) {
      const AILoadingAnimation = require('./AILoadingAnimation').default;
      return (
        <AILoadingAnimation message="Extracting your chart data..." />
      );
    }

    // UPLOAD STATE - show upload interface (falls through to StepView)
    if (step1Machine.shouldShowUpload) {
      console.log('[PX] showing upload state');
      // Falls through to StepView which has upload UI
    }

    // REVIEW STATE - show review/edit placements gate
    if (step1Machine.shouldShowReview) {
      console.log('[PX] showing review state');
      // Continue to confirmation gate below (existing review UI)
    }

    // READY STATE - auto-advance to step 2
    if (step1Machine.isReadyForStep2) {
      console.log('[PX] auto-advancing to step 2');
      supabase
        .from('product_sessions')
        .update({ current_step: 2, current_section: 1 })
        .eq('id', session.id)
        .eq('user_id', userId);
      setCurrentStep(2);
      return null; // Will re-render as step 2
    }
  }

  // REVIEW STATE RENDER: Placements confirmation/edit gate (after extraction)
  if (currentStep === 1 && step1Machine.shouldShowReview) {
    console.log('[PX] showing review/edit placements gate');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-900 to-black p-6 md:p-10">
        <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur-xl shadow-[0_25px_120px_-40px_rgba(0,0,0,0.75)]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-teal-200/80">Chart intake</p>
            <h1 className="text-3xl font-semibold text-white">Review your uploads</h1>
            <p className="text-slate-200/85">
              Confirm we should use these chart files for extraction before moving forward. If something is wrong, go back and re-upload. After extraction, review placements and confirm.
            </p>
          </div>

          {uploadedFiles.length > 0 ? (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300/80">Files ready</p>
              <div className="space-y-2">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 12l4 4L19 6" />
                      </svg>
                    </span>
                    <span className="truncate text-sm font-semibold text-white flex-1">{file.split('/').pop()}</span>
                    <button
                      onClick={() => handleRemoveFile(file)}
                      className="text-slate-300 hover:text-red-300"
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
              No files detected. Please go back and upload your charts.
            </div>
          )}

          {placements ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300/80">Extracted placements</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-white">Astrology</p>
                  <div className="space-y-2 text-sm text-slate-200">
                    {[
                      'sun','moon','rising','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','houses'
                    ].map((key) => (
                      <label key={key} className="block">
                        <span className="text-xs uppercase tracking-[0.14em] text-slate-400">{key}</span>
                        <input
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white text-sm"
                          value={placements?.astrology?.[key] ?? ''}
                          onChange={(e) =>
                            setPlacements((prev: any) => ({
                              ...prev,
                              astrology: { ...(prev?.astrology || {}), [key]: e.target.value },
                            }))
                          }
                          placeholder="UNKNOWN"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-white">Human Design</p>
                  <div className="space-y-2 text-sm text-slate-200">
                    {['type','strategy','authority','profile','centers','gifts'].map((key) => (
                      <label key={key} className="block">
                        <span className="text-xs uppercase tracking-[0.14em] text-slate-400">{key}</span>
                        <input
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white text-sm"
                          value={placements?.human_design?.[key] ?? ''}
                          onChange={(e) =>
                            setPlacements((prev: any) => ({
                              ...prev,
                              human_design: { ...(prev?.human_design || {}), [key]: e.target.value },
                            }))
                          }
                          placeholder="UNKNOWN"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Notes (gifts, channels, extra house data)</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white text-sm h-20"
                      value={placementNotes}
                      onChange={(e) => setPlacementNotes(e.target.value)}
                      placeholder="Add any HD gifts, channels, or extra house details not visible."
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300/80">Chat review</p>
                <div className="space-y-2">
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-teal-200/80 mb-2">Assistant</p>
                    <pre className="whitespace-pre-wrap text-sm text-slate-100">
                      {formatPlacementsForChat(placements)}
                    </pre>
                    <p className="mt-3 text-xs text-slate-300">
                      If anything is wrong or missing, type corrections below or edit the fields above. When accurate, click Confirm.
                    </p>
                  </div>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Your corrections (optional)</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white text-sm h-20"
                      value={placementNotes}
                      onChange={(e) => setPlacementNotes(e.target.value)}
                      placeholder="E.g., Sun: Taurus, Rising: Gemini, HD Type: Generator..."
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    setIsSubmitting(true);
                    setPlacementsError(null);

                    const updatedPlacements = { ...(placements || {}), notes: placementNotes };

                    // If user profile doesn't have placements, save to profile (dual-write)
                    if (!userPlacements) {
                      try {
                        await fetch('/api/profile/placements', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ placements: updatedPlacements, confirmed: true }),
                        });
                        setUserPlacements(updatedPlacements);
                      } catch (error) {
                        console.error('Failed to save placements to profile:', error);
                      }
                    }

                    const { error } = await supabase
                      .from('product_sessions')
                      .update({
                        placements: updatedPlacements,
                        placements_confirmed: true,
                        current_section: 1,
                      })
                      .eq('id', session.id)
                      .eq('user_id', userId);
                if (!error) {
                  setPlacementsConfirmed(true);
                  step1Machine.transitions.reviewConfirmed(); // Trigger READY state → auto-advance to step 2
                } else {
                  setPlacementsError('Could not save placements. Please try again.');
                }
                    setIsSubmitting(false);
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_15px_45px_-18px_rgba(20,184,166,0.75)] transition hover:scale-105 hover:shadow-[0_18px_50px_-16px_rgba(20,184,166,0.85)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                >
                  Confirm and continue
                </button>
                <button
                  onClick={async () => {
                    // Delete uploaded files from database
                    await supabase
                      .from('uploaded_documents')
                      .delete()
                      .eq('session_id', session.id);

                    // Clear state
                    setPlacements(null);
                    setUploadedFiles([]);
                    setUploadError(null);
                    setPlacementsError(null);
                    step1Machine.transitions.reviewReupload(); // Go back to UPLOAD state
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Re-upload
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExtractPlacements}
                disabled={isExtracting || uploadedFiles.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_15px_45px_-18px_rgba(20,184,166,0.75)] transition hover:scale-105 hover:shadow-[0_18px_50px_-16px_rgba(20,184,166,0.85)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
              >
                {isExtracting ? 'Extracting…' : 'Extract placements'}
              </button>
              <button
                onClick={async () => {
                  // Delete uploaded files from database
                  await supabase
                    .from('uploaded_documents')
                    .delete()
                    .eq('session_id', session.id);

                  // Clear state - state machine will handle showing upload UI
                  setUploadedFiles([]);
                  setUploadError(null);
                  setPlacementsError(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Re-upload
              </button>
            </div>
          )}

          {uploadError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {uploadError}
            </div>
          )}
          {placementsError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {placementsError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {!showFollowUp ? (
        <StepView
          step={currentStepData}
          stepNumber={currentStep}
          totalSteps={steps.length}
          response={stepResponse}
          onResponseChange={setStepResponse}
          onSubmit={handleStepSubmit}
          onBack={() => {
            if (currentStep > 1) {
              const prev = currentStep - 1;
              setCurrentStep(prev);
              supabase
                .from('product_sessions')
                .update({
                  current_step: prev,
                })
                .eq('id', session.id)
                .eq('user_id', userId);
            }
          }}
          onReviewCharts={handleReviewCharts}
          showReviewCharts={Boolean(steps[0]?.allow_file_upload && placementsConfirmed && currentStep > 1)}
          onFileUpload={handleFileUpload}
          uploadedFiles={uploadedFiles}
          uploadError={uploadError}
          assistantReply={assistantReply}
          isSubmitting={isSubmitting}
          onRemoveFile={handleRemoveFile}
          processingMessages={product.instructions?.processing}
        />
      ) : (
        <FollowUpChat
          sessionId={session.id}
          stepNumber={currentStep}
          stepData={currentStepData}
          systemPrompt={product.system_prompt}
          mainResponse={stepResponse}
          productSlug={product.product_slug}
          followUpCount={followUpCount}
          onFollowUpCountChange={setFollowUpCount}
          onComplete={handleFollowUpComplete}
          userId={userId}
          placements={placements}
        />
      )}
    </>
  );
}
