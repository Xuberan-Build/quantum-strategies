import { useState, useEffect } from 'react';

/**
 * Step 1 State Machine
 *
 * Replaces fragile boolean flags with a single state enum.
 * Makes the flow predictable and resilient.
 */

export type Step1State =
  | 'WELCOME'        // Show welcome modal
  | 'CONFIRMATION'   // Show "Use existing placements?" confirmation screen
  | 'UPLOAD'         // Show upload interface
  | 'EXTRACTING'     // Extraction in progress
  | 'REVIEW'         // Show review/edit gate with extracted placements
  | 'READY'          // Placements confirmed, ready to move to step 2
  | 'NO_CHART';      // Product has requires_chart = false: no gate, step 1 is a normal step

interface Step1StateMachineProps {
  hasInstructions: boolean;
  hasPlacementsData: boolean;
  placementsConfirmed: boolean;
  isExtracting: boolean;
  currentStep: number;
  /** product_definitions.requires_chart; false skips the chart gate entirely. Default true. */
  requiresChart?: boolean;
}

export function useStep1StateMachine({
  hasInstructions,
  hasPlacementsData,
  placementsConfirmed,
  isExtracting,
  currentStep,
  requiresChart = true,
}: Step1StateMachineProps) {
  const [state, setState] = useState<Step1State>(() => {
    // Only apply state machine to step 1
    // (chart-free products use NO_CHART so going Back to step 1 shows step 1, not an auto-advance)
    if (currentStep !== 1) return requiresChart ? 'READY' : 'NO_CHART';

    // Initial state determination
    if (hasInstructions) return 'WELCOME';
    if (!requiresChart) return 'NO_CHART';
    if (hasPlacementsData && !placementsConfirmed) return 'CONFIRMATION';
    if (hasPlacementsData && placementsConfirmed) return 'READY';
    return 'UPLOAD';
  });

  // Update state when extraction status changes
  useEffect(() => {
    if (currentStep !== 1 || !requiresChart) return;

    if (isExtracting && state !== 'EXTRACTING') {
      setState('EXTRACTING');
    }
  }, [isExtracting, currentStep, state, requiresChart]);

  // State transition functions
  const transitions = {
    welcomeComplete: () => {
      if (!requiresChart) {
        setState('NO_CHART');
      } else if (hasPlacementsData) {
        setState('CONFIRMATION');
      } else {
        setState('UPLOAD');
      }
    },

    confirmUseExisting: () => {
      setState('READY');
    },

    confirmEditPlacements: () => {
      setState('REVIEW');
    },

    confirmUploadNew: () => {
      setState('UPLOAD');
    },

    uploadComplete: () => {
      setState('EXTRACTING');
    },

    extractionComplete: () => {
      setState('REVIEW');
    },

    reviewConfirmed: () => {
      setState('READY');
    },

    reviewReupload: () => {
      setState('UPLOAD');
    },
  };

  return {
    state,
    transitions,
    // Helper booleans for render logic
    shouldShowWelcome: state === 'WELCOME',
    shouldShowConfirmation: state === 'CONFIRMATION',
    shouldShowUpload: state === 'UPLOAD',
    shouldShowExtracting: state === 'EXTRACTING',
    shouldShowReview: state === 'REVIEW',
    isReadyForStep2: state === 'READY',
    /** True for chart-free products once past the welcome: render step 1 as a normal step. */
    skipsChart: state === 'NO_CHART',
  };
}
