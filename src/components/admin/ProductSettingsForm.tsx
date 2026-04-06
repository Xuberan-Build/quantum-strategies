'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import styles from '@/app/admin/admin-layout.module.css';

const StepEditorModal = dynamic(() => import('./StepEditorModal'), { ssr: false });

interface ProductStep {
  step: number;
  title: string;
  subtitle?: string;
  question?: string;
  prompt?: string;
  required?: boolean;
  max_follow_ups?: number;
  allow_file_upload?: boolean;
  file_upload_prompt?: string;
  text_input?: {
    label?: string;
    placeholder?: string;
    min_length?: number;
  };
  text_inputs?: Array<{
    key: string;
    label?: string;
    placeholder?: string;
    min_length?: number;
  }>;
}

interface Product {
  id: string;
  product_slug: string;
  name: string;
  description: string | null;
  price: number | null;
  total_steps: number;
  estimated_duration: string | null;
  model: string;
  system_prompt: string;
  final_deliverable_prompt: string;
  steps: ProductStep[];
  is_active: boolean;
  is_purchasable: boolean;
  product_group: string | null;
}

interface ProductSettingsFormProps {
  product: Product;
}

export default function ProductSettingsForm({ product }: ProductSettingsFormProps) {
  const [name, setName] = useState(product.name || '');
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState<number | ''>(product.price ?? '');
  const [estimatedDuration, setEstimatedDuration] = useState(product.estimated_duration || '');
  const [isActive, setIsActive] = useState(product.is_active);
  const [isPurchasable, setIsPurchasable] = useState(product.is_purchasable);
  const [model, setModel] = useState(product.model || 'gpt-4');
  const [systemPrompt, setSystemPrompt] = useState(product.system_prompt || '');
  const [finalDeliverablePrompt, setFinalDeliverablePrompt] = useState(product.final_deliverable_prompt || '');
  const [steps, setSteps] = useState<ProductStep[]>(product.steps || []);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const response = await fetch(`/api/admin/products/${product.product_slug}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          price: price === '' ? null : price,
          estimated_duration: estimatedDuration,
          is_active: isActive,
          is_purchasable: isPurchasable,
          model,
          system_prompt: systemPrompt,
          final_deliverable_prompt: finalDeliverablePrompt,
          steps,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      setSaveStatus('saved');
      setSaveMessage(`Saved: ${result.updated?.join(', ') || 'all fields'}`);
      setLastSaved(new Date().toLocaleTimeString());
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 5000);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/admin/products/${product.product_slug}/settings`);
      const result = await response.json();

      if (!response.ok || !result.product) {
        throw new Error(result.error || 'Failed to refresh');
      }

      // Update local state with database values
      setName(result.product.name || '');
      setDescription(result.product.description || '');
      setPrice(result.product.price ?? '');
      setEstimatedDuration(result.product.estimated_duration || '');
      setIsActive(result.product.is_active);
      setIsPurchasable(result.product.is_purchasable);
      setModel(result.product.model || 'gpt-4');
      setSystemPrompt(result.product.system_prompt || '');
      setFinalDeliverablePrompt(result.product.final_deliverable_prompt || '');
      setSteps(result.product.steps || []);
      setSaveStatus('saved');
      setSaveMessage('Refreshed from database');
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Refresh failed:', error);
      setSaveStatus('error');
      setSaveMessage('Failed to refresh from database');
    } finally {
      setRefreshing(false);
    }
  };

  const updateStep = (stepIndex: number, field: string, value: unknown) => {
    setSteps((prev) => {
      const updated = [...prev];
      if (field.includes('.')) {
        // Nested field like "text_input.min_length"
        const [parent, child] = field.split('.');
        updated[stepIndex] = {
          ...updated[stepIndex],
          [parent]: {
            ...(updated[stepIndex][parent as keyof ProductStep] as Record<string, unknown> || {}),
            [child]: value,
          },
        };
      } else {
        updated[stepIndex] = { ...updated[stepIndex], [field]: value };
      }
      return updated;
    });
  };

  const handleStepEditorSave = (stepIndex: number, updatedStep: ProductStep) => {
    setSteps((prev) => {
      const updated = [...prev];
      updated[stepIndex] = updatedStep;
      return updated;
    });
  };

  return (
    <div>
      {/* Product Settings */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Product Settings</h2>
        </div>

        {/* Name & Description */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Product Name</label>
            <input
              type="text"
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Description</label>
            <input
              type="text"
              className={styles.formInput}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Price (USD cents)</label>
            <input
              type="number"
              className={styles.formInput}
              value={price}
              onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
              min={0}
              placeholder="e.g. 9700 = $97"
            />
            <p className={styles.formHint}>Stored in cents. 9700 = $97.00</p>
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Estimated Duration</label>
            <input
              type="text"
              className={styles.formInput}
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(e.target.value)}
              placeholder="e.g. 45–60 minutes"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          {/* Live Toggle */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Live for Users</label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
              <span className={styles.toggleLabel}>{isActive ? 'Active' : 'Inactive'}</span>
            </label>
            <p className={styles.formHint}>When off, product is hidden from users</p>
          </div>

          {/* Purchasable Toggle */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Purchasable</label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={isPurchasable}
                onChange={(e) => setIsPurchasable(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
              <span className={styles.toggleLabel}>{isPurchasable ? 'Yes' : 'No'}</span>
            </label>
            <p className={styles.formHint}>Can users purchase this product</p>
          </div>

          {/* Model Selector */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>AI Model</label>
            <select
              className={styles.formInput}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
            <p className={styles.formHint}>OpenAI model for AI responses</p>
          </div>
        </div>
      </div>

      {/* AI Prompts */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>AI Prompts</h2>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>System Prompt</label>
          <p className={styles.formHint} style={{ marginBottom: '0.5rem' }}>
            Governs the AI&apos;s persona and behavior for every step in this product.
          </p>
          <textarea
            className={styles.formInput}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: '0.8125rem', resize: 'vertical', width: '100%' }}
          />
        </div>

        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
          <label className={styles.formLabel}>Final Deliverable Prompt</label>
          <p className={styles.formHint} style={{ marginBottom: '0.5rem' }}>
            Used to generate the final briefing/deliverable at the end of the session.
          </p>
          <textarea
            className={styles.formInput}
            value={finalDeliverablePrompt}
            onChange={(e) => setFinalDeliverablePrompt(e.target.value)}
            rows={14}
            style={{ fontFamily: 'monospace', fontSize: '0.8125rem', resize: 'vertical', width: '100%' }}
          />
        </div>
      </div>

      {/* Steps Configuration */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Steps Configuration</h2>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>
            {steps.length} steps
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {steps.map((step, index) => (
            <div
              key={`step-${index}`}
              style={{
                border: '1px solid var(--admin-border)',
                borderRadius: '0.5rem',
                overflow: 'hidden',
              }}
            >
              {/* Step Header */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.875rem 1rem',
                  background: expandedStep === index ? 'var(--admin-bg)' : 'transparent',
                }}
              >
                <div
                  onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1 }}
                >
                  <span style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    background: 'var(--admin-primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>
                    {step.step}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--admin-text)' }}>{step.title}</div>
                    {step.subtitle && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        {step.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {step.prompt && (
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                      Has Prompt
                    </span>
                  )}
                  {step.text_input?.min_length ? (
                    <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                      Min {step.text_input.min_length} chars
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEditingStepIndex(index)}
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    style={{ marginLeft: '0.25rem' }}
                  >
                    Edit
                  </button>
                  <div
                    onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronIcon expanded={expandedStep === index} />
                  </div>
                </div>
              </div>

              {/* Expanded Step Settings */}
              {expandedStep === index && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--admin-border)', background: 'var(--admin-bg)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    {/* Required Toggle */}
                    <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                      <label className={styles.formLabel}>Required</label>
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          className={styles.toggleInput}
                          checked={step.required !== false}
                          onChange={(e) => updateStep(index, 'required', e.target.checked)}
                        />
                        <span className={styles.toggleSlider} />
                      </label>
                    </div>

                    {/* Min Length */}
                    {(step.text_input || step.text_inputs) && (
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>Min Characters</label>
                        <input
                          type="number"
                          className={styles.formInput}
                          value={step.text_input?.min_length || 0}
                          onChange={(e) => updateStep(index, 'text_input.min_length', parseInt(e.target.value) || 0)}
                          min={0}
                          max={1000}
                          style={{ width: '100px' }}
                        />
                      </div>
                    )}

                    {/* Max Follow-ups */}
                    <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                      <label className={styles.formLabel}>Max Follow-ups</label>
                      <input
                        type="number"
                        className={styles.formInput}
                        value={step.max_follow_ups || 0}
                        onChange={(e) => updateStep(index, 'max_follow_ups', parseInt(e.target.value) || 0)}
                        min={0}
                        max={10}
                        style={{ width: '100px' }}
                      />
                    </div>

                    {/* File Upload Toggle */}
                    <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                      <label className={styles.formLabel}>Allow File Upload</label>
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          className={styles.toggleInput}
                          checked={step.allow_file_upload || false}
                          onChange={(e) => updateStep(index, 'allow_file_upload', e.target.checked)}
                        />
                        <span className={styles.toggleSlider} />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || refreshing}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          {saving ? 'Saving...' : 'Save to Database'}
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={saving || refreshing}
          className={`${styles.btn} ${styles.btnSecondary}`}
        >
          {refreshing ? 'Loading...' : 'Refresh from DB'}
        </button>
        {saveStatus === 'saved' && (
          <span style={{ color: 'var(--admin-success)', fontSize: '0.875rem' }}>
            {saveMessage}
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{ color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
            {saveMessage || 'Failed to save changes'}
          </span>
        )}
        {lastSaved && (
          <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>
            Last saved: {lastSaved}
          </span>
        )}
      </div>

      {/* Step Editor Modal */}
      {editingStepIndex !== null && steps[editingStepIndex] && (
        <StepEditorModal
          step={steps[editingStepIndex]}
          stepIndex={editingStepIndex}
          onSave={handleStepEditorSave}
          onClose={() => setEditingStepIndex(null)}
        />
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      style={{
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
        color: 'var(--admin-text-muted)',
      }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
