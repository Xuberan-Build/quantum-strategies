'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { OnboardingData } from '@/lib/types/rite-iv';

interface OnboardingFormProps {
  userId: string;
  initialData?: Partial<OnboardingData>;
  styles: Record<string, string>;
}

const IDENTITY_PLACEHOLDERS = [
  'Who you are',
  'What you do',
  'Who you serve',
  "What you don't do",
];

export function OnboardingForm({ userId, initialData, styles }: OnboardingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState<OnboardingData>({
    system_config: {},
    canonical_identity: initialData?.canonical_identity ?? ['', '', '', ''],
    current_offer: initialData?.current_offer ?? '',
    current_price: initialData?.current_price ?? 0,
    current_channel: initialData?.current_channel ?? '',
    current_target: initialData?.current_target ?? '',
    initial_commitments: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          system_config: formData.system_config,
          canonical_identity: formData.canonical_identity,
          current_offer: formData.current_offer,
          current_price: formData.current_price,
          current_channel: formData.current_channel,
          current_target: formData.current_target,
        });

      if (profileError) throw profileError;

      if (formData.initial_commitments.length > 0) {
        const { error: commitmentsError } = await supabase
          .from('commitments')
          .insert(
            formData.initial_commitments.map(c => ({
              user_id: userId,
              source_rite: c.source_rite,
              declared_text: c.declared_text,
            }))
          );

        if (commitmentsError) throw commitmentsError;
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const updateIdentity = (index: number, value: string) => {
    const newIdentity = [...formData.canonical_identity];
    newIdentity[index] = value;
    setFormData({ ...formData, canonical_identity: newIdentity });
  };

  const addCommitment = () => {
    setFormData({
      ...formData,
      initial_commitments: [
        ...formData.initial_commitments,
        { source_rite: 'RITE_I', declared_text: '' },
      ],
    });
  };

  const updateCommitment = (index: number, field: string, value: string) => {
    const updated = [...formData.initial_commitments];
    (updated[index] as any)[field] = value;
    setFormData({ ...formData, initial_commitments: updated });
  };

  return (
    <>
      {/* Step indicator */}
      <div className={styles.stepIndicator}>
        <div className={`${styles.stepDot} ${step === 1 ? styles.stepDotActive : styles.stepDotComplete}`}>
          {step > 1 ? '✓' : '1'}
        </div>
        <div className={styles.stepLine} />
        <div className={`${styles.stepDot} ${step === 2 ? styles.stepDotActive : ''}`}>
          2
        </div>
      </div>

      <div className={styles.card}>
        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
            <h2 className={styles.stepTitle}>Business Configuration</h2>
            <p className={styles.stepDescription}>
              Import your Rites I–III outputs. This becomes your locked canonical configuration.
            </p>

            {/* Canonical Identity */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Canonical Identity</label>
              <p className={styles.sublabel}>Who, What, Who For, What Not</p>
              <div className={styles.identityStack}>
                {formData.canonical_identity.map((item, index) => (
                  <input
                    key={index}
                    type="text"
                    value={item}
                    onChange={(e) => updateIdentity(index, e.target.value)}
                    placeholder={IDENTITY_PLACEHOLDERS[index]}
                    className={styles.identityInput}
                    required
                  />
                ))}
              </div>
            </div>

            {/* Current Offer */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Current Offer</label>
              <input
                type="text"
                value={formData.current_offer}
                onChange={(e) => setFormData({ ...formData, current_offer: e.target.value })}
                placeholder="e.g. 90-day brand strategy intensive"
                className={styles.input}
                required
              />
            </div>

            {/* Price */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Current Price</label>
              <input
                type="number"
                value={formData.current_price || ''}
                onChange={(e) => setFormData({ ...formData, current_price: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 3000"
                className={styles.input}
                required
              />
            </div>

            {/* Channel */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Primary Channel</label>
              <input
                type="text"
                value={formData.current_channel}
                onChange={(e) => setFormData({ ...formData, current_channel: e.target.value })}
                placeholder="e.g. Instagram DMs, LinkedIn, referrals"
                className={styles.input}
                required
              />
            </div>

            {/* Target */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Target Client Profile</label>
              <textarea
                value={formData.current_target}
                onChange={(e) => setFormData({ ...formData, current_target: e.target.value })}
                placeholder="Describe who you serve — their situation, stage, and what they need"
                className={styles.textarea}
                rows={3}
                required
              />
            </div>

            <div className={styles.actions}>
              <button type="submit" className={`${styles.btnPrimary} ${styles.btnFullWidth}`}>
                Continue to Commitments →
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className={styles.stepTitle}>Initial Commitments</h2>
            <p className={styles.stepDescription}>
              Declare commitments carried forward from Rites I–III. Each one enters the integrity ledger permanently.
            </p>

            {formData.initial_commitments.map((commitment, index) => (
              <div key={index} className={styles.commitmentCard}>
                <select
                  value={commitment.source_rite}
                  onChange={(e) => updateCommitment(index, 'source_rite', e.target.value)}
                  className={styles.select}
                >
                  <option value="RITE_I">RITE I — Personal Alignment</option>
                  <option value="RITE_II">RITE II — Business Alignment</option>
                  <option value="RITE_III">RITE III — Brand Alignment</option>
                </select>
                <textarea
                  value={commitment.declared_text}
                  onChange={(e) => updateCommitment(index, 'declared_text', e.target.value)}
                  placeholder="State the commitment precisely — what you declared, not what you intended"
                  className={styles.textarea}
                  rows={2}
                />
              </div>
            ))}

            <button type="button" onClick={addCommitment} className={styles.addButton}>
              + Add Commitment
            </button>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={styles.btnSecondary}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className={styles.btnPrimary}
              >
                {loading ? 'Activating...' : 'Activate System'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
