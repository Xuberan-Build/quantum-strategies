'use client';

import { ReactNode } from 'react';
import { ProgressBar } from './ProgressBar';
import { StepView } from './StepView';
import { FollowUpChat } from './FollowUpChat';
import { DeliverableView } from './DeliverableView';
import { WelcomeBanner } from './WelcomeBanner';
import { FileUpload } from './FileUpload';
import { supabase } from '@/lib/supabase/client';
import { isPlacementsEmpty } from '@/lib/utils/placements';
import { useStep1StateMachine } from './useStep1StateMachine';
import { useProductPlacements } from './useProductPlacements';
import { useProductDeliverable } from './useProductDeliverable';
import { useProductSession } from './useProductSession';
import { THREE_RITES_PRODUCTS, getRiteForProduct } from '@/lib/beta/constants';
import ScanFeedbackForm from '@/components/beta/ScanFeedbackForm';
import BlueprintFeedbackForm from '@/components/beta/BlueprintFeedbackForm';
import DeclarationFeedbackForm from '@/components/beta/DeclarationFeedbackForm';
import RiteOneConsolidationForm from '@/components/beta/RiteOneConsolidationForm';
import RiteTwoConsolidationForm from '@/components/beta/RiteTwoConsolidationForm';
import CompleteJourneyForm from '@/components/beta/CompleteJourneyForm';

const RITE_META = {
  perception:  { roman: 'I',   label: 'Perception',  itemLabel: 'Scan' },
  orientation: { roman: 'II',  label: 'Orientation', itemLabel: 'Blueprint' },
  declaration: { roman: 'III', label: 'Declaration', itemLabel: 'Declaration' },
} as const;

function RiteProgressHeader({ productSlug, productName }: { productSlug: string; productName: string }) {
  const rite = getRiteForProduct(productSlug);
  if (!rite) return null;

  const meta = RITE_META[rite];
  const riteProducts = THREE_RITES_PRODUCTS[rite.toUpperCase() as 'PERCEPTION' | 'ORIENTATION' | 'DECLARATION'];
  const position = (riteProducts as readonly string[]).indexOf(productSlug) + 1;
  const total = riteProducts.length;

  return (
    <div className="relative bg-gradient-to-r from-purple-950/50 via-black/40 to-purple-950/30 backdrop-blur-sm px-6 py-2.5">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-300/20 to-transparent" />
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <span className="shrink-0 text-[11px] font-bold tracking-widest uppercase bg-gradient-to-r from-[#cebeff] to-[#B399FF] bg-clip-text text-transparent">
          Rite {meta.roman} · {meta.label}
        </span>
        <span className="text-[13px] text-white/40 font-medium truncate text-center">
          {productName}
        </span>
        <span className="shrink-0 text-[11px] text-white/25 tabular-nums">
          {meta.itemLabel} {position} of {total}
        </span>
      </div>
    </div>
  );
}

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
  // Step 1 state machine — initialized from session values; all transitions are called
  // explicitly in handlers, so initial values are sufficient for correct behavior.
  const step1Machine = useStep1StateMachine({
    hasInstructions: !!product.instructions,
    hasPlacementsData: !isPlacementsEmpty(session.placements),
    placementsConfirmed: !!session.placements_confirmed,
    isExtracting: false,
    currentStep: session.current_step,
  });

  const {
    placements,
    setPlacements,
    placementsConfirmed,
    setPlacementsConfirmed,
    userPlacements,
    setUserPlacements,
    isExtracting,
    placementsError,
    setPlacementsError,
    placementNotes,
    setPlacementNotes,
    uploadedFiles,
    setUploadedFiles,
    uploadError,
    setUploadError,
    handleFileUpload,
    handleRemoveFile,
    handleExtractPlacements,
    formatPlacementsForChat,
  } = useProductPlacements({
    sessionId: session.id,
    userId,
    initialPlacements: session.placements || null,
    initialPlacementsConfirmed: !!session.placements_confirmed,
    step1MachineTransitions: step1Machine.transitions,
  });

  const {
    deliverable,
    deliverableError,
    isGeneratingDeliverable,
    actionableNudges,
    generateDeliverable,
  } = useProductDeliverable({
    sessionId: session.id,
    productSlug: product.product_slug,
    productName: product.name,
    placements,
    sessionCompletedAt: session.completed_at ?? null,
  });

  const {
    currentStep,
    setCurrentStep,
    stepResponse,
    setStepResponse,
    stepInitialValue,
    handleResponseChange,
    handleBack,
    showFollowUp,
    followUpCount,
    setFollowUpCount,
    isSubmitting,
    setIsSubmitting,
    assistantReply,
    isBetaParticipant,
    handleStepSubmit,
    handleFollowUpComplete,
    handleReviewCharts,
  } = useProductSession({
    session,
    product,
    userId,
    placements,
    uploadedFiles,
    placementsConfirmed,
    generateDeliverable,
    handleExtractPlacements,
    step1MachineTransitions: step1Machine.transitions,
    setPlacementsConfirmed,
    setUploadError,
  });

  const steps = (product.steps || []).slice().sort((a: any, b: any) => {
    const orderA = typeof a?.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
    const orderB = typeof b?.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
    if (orderA === orderB) return 0;
    return orderA - orderB;
  });
  const currentStepData = steps[currentStep - 1];
  const isLastStep = currentStep === steps.length;
  const completionPercentage = Math.round((currentStep / steps.length) * 100);

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
        <>
          <RiteProgressHeader productSlug={product.product_slug} productName={product.name} />
          <WelcomeBanner
            instructions={product.instructions}
            onBegin={() => step1Machine.transitions.welcomeComplete()}
          />
        </>
      );
    }

    // CONFIRMATION STATE (show "Use existing placements?" screen)
    if (step1Machine.shouldShowConfirmation) {
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
                  // Always sync confirmed placements to profile
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

    // UPLOAD STATE - show upload interface
    if (step1Machine.shouldShowUpload) {
      // If the product has no dedicated upload step, render a standalone upload gate
      if (!currentStepData?.allow_file_upload) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-900 to-black p-6 md:p-10">
            <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur-xl shadow-[0_25px_120px_-40px_rgba(0,0,0,0.75)]">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-teal-200/80">Step 1 of {steps.length + 1}</p>
                <h1 className="text-3xl font-semibold text-white">Upload Your Charts</h1>
                <p className="text-slate-200/85">
                  Upload your Birth Chart and Human Design Chart so we can extract your placements and personalize your experience.
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  We accept PDFs or images from astro.com, astro-seek.com, jovianarchive.com, mybodygraph.com, etc.
                </p>
              </div>

              <FileUpload
                onUpload={handleFileUpload}
                uploadedFiles={uploadedFiles}
              />

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300/80">Files ready</p>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 12l4 4L19 6" />
                          </svg>
                        </span>
                        <span className="truncate text-sm font-semibold text-white flex-1">{file.split('/').pop()}</span>
                        <button onClick={() => handleRemoveFile(file)} className="text-slate-300 hover:text-red-300" title="Remove file">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {uploadError}
                </div>
              )}

              <button
                onClick={handleExtractPlacements}
                disabled={isExtracting || uploadedFiles.length === 0}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-teal-500/30 transition-all hover:shadow-xl hover:shadow-teal-500/40 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {isExtracting ? 'Extracting placements...' : 'Extract Placements →'}
              </button>
            </div>
          </div>
        );
      }
      // Has an explicit upload step — falls through to StepView which renders the upload UI inline
    }

    // REVIEW STATE - show review/edit placements gate
    if (step1Machine.shouldShowReview) {
      // Continue to confirmation gate below (existing review UI)
    }

    // READY STATE - auto-advance to step 2
    if (step1Machine.isReadyForStep2) {
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

                    // Always sync confirmed placements to profile
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
      <RiteProgressHeader productSlug={product.product_slug} productName={product.name} />
      {!showFollowUp ? (
        <StepView
          step={currentStepData}
          stepNumber={currentStep}
          totalSteps={steps.length}
          response={stepResponse}
          onResponseChange={handleResponseChange}
          onSubmit={handleStepSubmit}
          onBack={currentStep > 1 ? handleBack : undefined}
          onReviewCharts={handleReviewCharts}
          showReviewCharts={Boolean(steps[0]?.allow_file_upload && placementsConfirmed && currentStep > 1)}
          onFileUpload={handleFileUpload}
          uploadedFiles={uploadedFiles}
          uploadError={uploadError}
          assistantReply={assistantReply}
          isSubmitting={isSubmitting}
          onRemoveFile={handleRemoveFile}
          processingMessages={product.instructions?.processing}
          initialValue={stepInitialValue}
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
