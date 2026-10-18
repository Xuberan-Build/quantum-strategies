import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStep1StateMachine } from '../useStep1StateMachine';
import { productRequiresChart } from '@/lib/utils/placements';

const base = {
  hasInstructions: false,
  hasPlacementsData: false,
  placementsConfirmed: false,
  isExtracting: false,
  currentStep: 1,
};

describe('productRequiresChart', () => {
  it('defaults to true; only an explicit false skips the chart', () => {
    expect(productRequiresChart({})).toBe(true);
    expect(productRequiresChart({ requires_chart: null })).toBe(true);
    expect(productRequiresChart({ requires_chart: true })).toBe(true);
    expect(productRequiresChart(null)).toBe(true);
    expect(productRequiresChart({ requires_chart: false })).toBe(false);
  });
});

describe('useStep1StateMachine chart gate', () => {
  it('unchanged for chart products (default): no placements → UPLOAD', () => {
    const { result } = renderHook(() => useStep1StateMachine(base));
    expect(result.current.state).toBe('UPLOAD');
    expect(result.current.skipsChart).toBe(false);
  });

  it('unchanged for chart products: welcome → confirmation when placements exist', () => {
    const { result } = renderHook(() =>
      useStep1StateMachine({ ...base, hasInstructions: true, hasPlacementsData: true })
    );
    expect(result.current.state).toBe('WELCOME');
    act(() => result.current.transitions.welcomeComplete());
    expect(result.current.state).toBe('CONFIRMATION');
  });

  it('unchanged for chart products past step 1: READY', () => {
    const { result } = renderHook(() => useStep1StateMachine({ ...base, currentStep: 3 }));
    expect(result.current.state).toBe('READY');
  });

  it('requires_chart false: no upload, no confirmation, no auto-advance', () => {
    const { result } = renderHook(() => useStep1StateMachine({ ...base, requiresChart: false }));
    expect(result.current.state).toBe('NO_CHART');
    expect(result.current.skipsChart).toBe(true);
    expect(result.current.shouldShowUpload).toBe(false);
    expect(result.current.shouldShowConfirmation).toBe(false);
    expect(result.current.isReadyForStep2).toBe(false);
  });

  it('requires_chart false: welcome still shows, then goes straight to step 1', () => {
    const { result } = renderHook(() =>
      useStep1StateMachine({ ...base, hasInstructions: true, hasPlacementsData: true, requiresChart: false })
    );
    expect(result.current.state).toBe('WELCOME');
    act(() => result.current.transitions.welcomeComplete());
    expect(result.current.state).toBe('NO_CHART');
  });

  it('requires_chart false: never enters EXTRACTING', () => {
    const { result, rerender } = renderHook((props) => useStep1StateMachine(props), {
      initialProps: { ...base, requiresChart: false },
    });
    rerender({ ...base, requiresChart: false, isExtracting: true });
    expect(result.current.state).toBe('NO_CHART');
  });

  it('requires_chart false past step 1: Back to step 1 shows step 1 instead of auto-advancing', () => {
    const { result } = renderHook(() => useStep1StateMachine({ ...base, currentStep: 4, requiresChart: false }));
    expect(result.current.isReadyForStep2).toBe(false);
    expect(result.current.state).toBe('NO_CHART');
  });
});
