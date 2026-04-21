'use client';

import { useState } from 'react';
import TiptapEditor from './TiptapEditor';
import styles from '@/app/admin/admin-layout.module.css';

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

interface StepEditorModalProps {
  step: ProductStep;
  stepIndex: number;
  onSave: (stepIndex: number, updatedStep: ProductStep) => void;
  onClose: () => void;
}

export default function StepEditorModal({
  step,
  stepIndex,
  onSave,
  onClose,
}: StepEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'settings'>('content');
  const [editedStep, setEditedStep] = useState<ProductStep>({ ...step });

  const handleSave = () => {
    onSave(stepIndex, editedStep);
    onClose();
  };

  const updateField = (field: string, value: unknown) => {
    setEditedStep((prev) => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...(prev[parent as keyof ProductStep] as Record<string, unknown> || {}),
            [child]: value,
          },
        };
      }
      return { ...prev, [field]: value };
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Edit Step {step.step}: {step.title}
          </h2>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className={styles.tabNav}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'content' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('content')}
          >
            Content
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        <div className={styles.modalBody}>
          {activeTab === 'content' && (
            <>
              {/* Title & Subtitle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Title</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={editedStep.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="Step title"
                  />
                </div>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Subtitle (optional)</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={editedStep.subtitle || ''}
                    onChange={(e) => updateField('subtitle', e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
              </div>

              {/* Question */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Question</label>
                <p className={styles.formHint} style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                  The question shown to users. Supports formatting.
                </p>
                <TiptapEditor
                  content={editedStep.question || ''}
                  onChange={(content) => updateField('question', content)}
                  placeholder="Enter the question to ask users..."
                  minHeight="100px"
                />
              </div>

              {/* AI Prompt */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>AI Prompt</label>
                <p className={styles.formHint} style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                  Instructions for the AI. Use variables like {'{{user_response}}'}, {'{{placements.astrology.sun}}'}.
                </p>
                <TiptapEditor
                  content={editedStep.prompt || ''}
                  onChange={(content) => updateField('prompt', content)}
                  placeholder="Enter the AI prompt..."
                  minHeight="180px"
                />
              </div>

              {/* File Upload Prompt (conditional) */}
              {editedStep.allow_file_upload && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>File Upload Instructions</label>
                  <p className={styles.formHint} style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                    Additional instructions when a file is uploaded.
                  </p>
                  <TiptapEditor
                    content={editedStep.file_upload_prompt || ''}
                    onChange={(content) => updateField('file_upload_prompt', content)}
                    placeholder="Instructions for processing uploaded files..."
                    minHeight="100px"
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                {/* Required */}
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Required Step</label>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={editedStep.required !== false}
                      onChange={(e) => updateField('required', e.target.checked)}
                    />
                    <span className={styles.toggleSlider} />
                    <span className={styles.toggleLabel}>
                      {editedStep.required !== false ? 'Yes' : 'No'}
                    </span>
                  </label>
                  <p className={styles.formHint}>User must complete this step</p>
                </div>

                {/* Allow File Upload */}
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Allow File Upload</label>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={editedStep.allow_file_upload || false}
                      onChange={(e) => updateField('allow_file_upload', e.target.checked)}
                    />
                    <span className={styles.toggleSlider} />
                    <span className={styles.toggleLabel}>
                      {editedStep.allow_file_upload ? 'Yes' : 'No'}
                    </span>
                  </label>
                  <p className={styles.formHint}>Users can upload files</p>
                </div>

                {/* Max Follow-ups */}
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Max Follow-up Questions</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editedStep.max_follow_ups || 0}
                    onChange={(e) => updateField('max_follow_ups', parseInt(e.target.value) || 0)}
                    min={0}
                    max={10}
                    style={{ width: '100px' }}
                  />
                  <p className={styles.formHint}>AI follow-up questions (0-10)</p>
                </div>

                {/* Min Character Length */}
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Minimum Characters</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editedStep.text_input?.min_length || 0}
                    onChange={(e) => updateField('text_input.min_length', parseInt(e.target.value) || 0)}
                    min={0}
                    max={5000}
                    style={{ width: '100px' }}
                  />
                  <p className={styles.formHint}>Minimum response length</p>
                </div>
              </div>

              {/* Text Input Settings */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--admin-text)' }}>
                  Input Field Settings
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Label</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={editedStep.text_input?.label || ''}
                      onChange={(e) => updateField('text_input.label', e.target.value)}
                      placeholder="Your response"
                    />
                  </div>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Placeholder</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={editedStep.text_input?.placeholder || ''}
                      onChange={(e) => updateField('text_input.placeholder', e.target.value)}
                      placeholder="Type your answer here..."
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
