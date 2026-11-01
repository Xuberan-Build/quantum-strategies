'use client';

import { useRef, useState } from 'react';
import BaseFeedbackForm from './BaseFeedbackForm';
import RatingScale from './RatingScale';
import styles from './BetaFeedbackForm.module.css';

interface CompleteJourneyFormProps {
  onSubmitted?: () => void;
}

export default function CompleteJourneyForm({ onSubmitted }: CompleteJourneyFormProps) {
  const startTimeRef = useRef<number>(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [transformationScore, setTransformationScore] = useState<number | null>(null);
  const [clarityGained, setClarityGained] = useState<number | null>(null);
  const [confidenceGained, setConfidenceGained] = useState<number | null>(null);
  const [directionClarity, setDirectionClarity] = useState<number | null>(null);
  const [journeyCoherenceScore, setJourneyCoherenceScore] = useState<number | null>(null);
  const [riteIntegrationScore, setRiteIntegrationScore] = useState<number | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);

  const [mostValuableRite, setMostValuableRite] = useState('');
  const [mostValuableProduct, setMostValuableProduct] = useState('');
  const [leastValuableProduct, setLeastValuableProduct] = useState('');

  const [beforeJourneyState, setBeforeJourneyState] = useState('');
  const [afterJourneyState, setAfterJourneyState] = useState('');
  const [biggestBreakthrough, setBiggestBreakthrough] = useState('');
  const [unexpectedInsight, setUnexpectedInsight] = useState('');

  const [perceivedValueVs60, setPerceivedValueVs60] = useState('');
  const [willingnessToPay, setWillingnessToPay] = useState('');
  const [purchaseTimeline, setPurchaseTimeline] = useState('');
  const [whatWouldMakeYouSayYes, setWhatWouldMakeYouSayYes] = useState('');

  const [wouldReferOthers, setWouldReferOthers] = useState('');
  const [referralCommitmentCount, setReferralCommitmentCount] = useState('');

  const [foundingMemberInterest, setFoundingMemberInterest] = useState('');
  const [foundingMemberDecisionFactors, setFoundingMemberDecisionFactors] = useState('');

  const [testimonialConsent, setTestimonialConsent] = useState(false);
  const [testimonialText, setTestimonialText] = useState('');
  const [videoTestimonialInterest, setVideoTestimonialInterest] = useState(false);

  const [whatWorkedBest, setWhatWorkedBest] = useState('');
  const [whatNeedsImprovement, setWhatNeedsImprovement] = useState('');
  const [missingElements, setMissingElements] = useState('');
  const [additionalSupportNeeded, setAdditionalSupportNeeded] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/beta/submit-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'journey',
          surveyDurationSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
          responses: {
            transformation_score: transformationScore,
            clarity_gained: clarityGained,
            confidence_gained: confidenceGained,
            direction_clarity: directionClarity,
            journey_coherence_score: journeyCoherenceScore,
            rite_integration_score: riteIntegrationScore,
            most_valuable_rite: mostValuableRite || null,
            most_valuable_product_overall: mostValuableProduct.trim() || null,
            least_valuable_product_overall: leastValuableProduct.trim() || null,
            before_journey_state: beforeJourneyState.trim() || null,
            after_journey_state: afterJourneyState.trim() || null,
            biggest_breakthrough: biggestBreakthrough.trim() || null,
            unexpected_insight: unexpectedInsight.trim() || null,
            perceived_total_value_vs_60: perceivedValueVs60 || null,
            willingness_to_pay_amount: willingnessToPay ? Number(willingnessToPay) : null,
            purchase_timeline: purchaseTimeline || null,
            what_would_make_you_say_yes: whatWouldMakeYouSayYes.trim() || null,
            nps_score: npsScore,
            would_refer_others: wouldReferOthers === 'yes' ? true : wouldReferOthers === 'no' ? false : null,
            referral_commitment_count: referralCommitmentCount ? Number(referralCommitmentCount) : null,
            founding_member_interest: foundingMemberInterest || null,
            founding_member_decision_factors: foundingMemberDecisionFactors.trim() || null,
            testimonial_consent: testimonialConsent,
            testimonial_text: testimonialText.trim() || null,
            video_testimonial_interest: videoTestimonialInterest,
            what_worked_best: whatWorkedBest.trim() || null,
            what_needs_improvement: whatNeedsImprovement.trim() || null,
            missing_elements: missingElements.trim() || null,
            additional_support_needed: additionalSupportNeeded.trim() || null,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      onSubmitted?.();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseFeedbackForm
      title="Complete Journey Feedback"
      description="This is the deep reflection that powers the beta. Your answers guide the Initiation offer at the end."
      submitLabel="Submit Journey Feedback"
      isSubmitting={isSubmitting}
      error={error}
      success={success}
      successMessage="Your journey feedback is in. Thank you for going deep."
      onSubmit={handleSubmit}
    >
      <div className={styles.gridTwo}>
        <RatingScale
          label="Transformation"
          name="transformationScore"
          min={1}
          max={10}
          value={transformationScore}
          onChange={setTransformationScore}
          required
        />
        <RatingScale
          label="Clarity gained"
          name="clarityGained"
          min={1}
          max={10}
          value={clarityGained}
          onChange={setClarityGained}
          required
        />
        <RatingScale
          label="Confidence gained"
          name="confidenceGained"
          min={1}
          max={10}
          value={confidenceGained}
          onChange={setConfidenceGained}
          required
        />
        <RatingScale
          label="Direction clarity"
          name="directionClarity"
          min={1}
          max={10}
          value={directionClarity}
          onChange={setDirectionClarity}
          required
        />
        <RatingScale
          label="Journey coherence"
          name="journeyCoherence"
          min={1}
          max={10}
          value={journeyCoherenceScore}
          onChange={setJourneyCoherenceScore}
          required
        />
        <RatingScale
          label="Rite integration"
          name="riteIntegration"
          min={1}
          max={10}
          value={riteIntegrationScore}
          onChange={setRiteIntegrationScore}
          required
        />
        <RatingScale
          label="NPS score"
          name="npsScore"
          min={0}
          max={10}
          value={npsScore}
          onChange={setNpsScore}
          required
        />
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="mostValuableRite">
            Most valuable rite
          </label>
          <select
            id="mostValuableRite"
            className={styles.select}
            value={mostValuableRite}
            onChange={(event) => setMostValuableRite(event.target.value)}
            required
          >
            <option value="">Select one</option>
            <option value="perception">Perception</option>
            <option value="orientation">Orientation</option>
            <option value="declaration">Declaration</option>
          </select>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="perceivedValueVs60">
            Value vs $60
          </label>
          <select
            id="perceivedValueVs60"
            className={styles.select}
            value={perceivedValueVs60}
            onChange={(event) => setPerceivedValueVs60(event.target.value)}
            required
          >
            <option value="">Select one</option>
            <option value="much_less">Much less</option>
            <option value="less">Less</option>
            <option value="equal">Equal</option>
            <option value="more">More</option>
            <option value="much_more">Much more</option>
          </select>
        </div>
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="willingnessToPay">
            What would you pay for the full journey?
          </label>
          <input
            id="willingnessToPay"
            type="number"
            min="0"
            step="0.01"
            className={styles.input}
            value={willingnessToPay}
            onChange={(event) => setWillingnessToPay(event.target.value)}
            placeholder="e.g. 60"
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="purchaseTimeline">
            Purchase timeline
          </label>
          <select
            id="purchaseTimeline"
            className={styles.select}
            value={purchaseTimeline}
            onChange={(event) => setPurchaseTimeline(event.target.value)}
            required
          >
            <option value="">Select one</option>
            <option value="immediate">Immediate</option>
            <option value="1_month">Within 1 month</option>
            <option value="3_months">Within 3 months</option>
            <option value="no">Not planning to purchase</option>
          </select>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="whatWouldMakeYouSayYes">
          What would make you say yes to $60 right now?
        </label>
        <textarea
          id="whatWouldMakeYouSayYes"
          className={styles.textarea}
          value={whatWouldMakeYouSayYes}
          onChange={(event) => setWhatWouldMakeYouSayYes(event.target.value)}
          placeholder="Your real-time objections or missing elements."
          required
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="beforeJourneyState">
          Before the journey
        </label>
        <textarea
          id="beforeJourneyState"
          className={styles.textarea}
          value={beforeJourneyState}
          onChange={(event) => setBeforeJourneyState(event.target.value)}
          placeholder="Where were you before you started?"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="afterJourneyState">
          After the journey
        </label>
        <textarea
          id="afterJourneyState"
          className={styles.textarea}
          value={afterJourneyState}
          onChange={(event) => setAfterJourneyState(event.target.value)}
          placeholder="Where are you now?"
        />
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="mostValuableProduct">
            Most valuable product
          </label>
          <input
            id="mostValuableProduct"
            className={styles.input}
            value={mostValuableProduct}
            onChange={(event) => setMostValuableProduct(event.target.value)}
            placeholder="Product slug or name"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="leastValuableProduct">
            Least valuable product
          </label>
          <input
            id="leastValuableProduct"
            className={styles.input}
            value={leastValuableProduct}
            onChange={(event) => setLeastValuableProduct(event.target.value)}
            placeholder="Product slug or name"
          />
        </div>
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="biggestBreakthrough">
            Biggest breakthrough
          </label>
          <textarea
            id="biggestBreakthrough"
            className={styles.textarea}
            value={biggestBreakthrough}
            onChange={(event) => setBiggestBreakthrough(event.target.value)}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="unexpectedInsight">
            Unexpected insight
          </label>
          <textarea
            id="unexpectedInsight"
            className={styles.textarea}
            value={unexpectedInsight}
            onChange={(event) => setUnexpectedInsight(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="wouldReferOthers">
            Would you refer others?
          </label>
          <select
            id="wouldReferOthers"
            className={styles.select}
            value={wouldReferOthers}
            onChange={(event) => setWouldReferOthers(event.target.value)}
          >
            <option value="">Select one</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="referralCommitmentCount">
            How many people would you refer?
          </label>
          <input
            id="referralCommitmentCount"
            type="number"
            min="0"
            className={styles.input}
            value={referralCommitmentCount}
            onChange={(event) => setReferralCommitmentCount(event.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="foundingMemberInterest">
            Interest in the Initiation offer
          </label>
          <select
            id="foundingMemberInterest"
            className={styles.select}
            value={foundingMemberInterest}
            onChange={(event) => setFoundingMemberInterest(event.target.value)}
            required
          >
            <option value="">Select one</option>
            <option value="definitely">Definitely</option>
            <option value="probably">Probably</option>
            <option value="maybe">Maybe</option>
            <option value="probably_not">Probably not</option>
            <option value="definitely_not">Definitely not</option>
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="foundingMemberDecisionFactors">
            What would influence your decision?
          </label>
          <textarea
            id="foundingMemberDecisionFactors"
            className={styles.textarea}
            value={foundingMemberDecisionFactors}
            onChange={(event) => setFoundingMemberDecisionFactors(event.target.value)}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="whatWorkedBest">
          What worked best?
        </label>
        <textarea
          id="whatWorkedBest"
          className={styles.textarea}
          value={whatWorkedBest}
          onChange={(event) => setWhatWorkedBest(event.target.value)}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="whatNeedsImprovement">
          What needs improvement?
        </label>
        <textarea
          id="whatNeedsImprovement"
          className={styles.textarea}
          value={whatNeedsImprovement}
          onChange={(event) => setWhatNeedsImprovement(event.target.value)}
        />
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="missingElements">
            Anything missing?
          </label>
          <textarea
            id="missingElements"
            className={styles.textarea}
            value={missingElements}
            onChange={(event) => setMissingElements(event.target.value)}
            rows={3}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="additionalSupportNeeded">
            Additional support needed
          </label>
          <textarea
            id="additionalSupportNeeded"
            className={styles.textarea}
            value={additionalSupportNeeded}
            onChange={(event) => setAdditionalSupportNeeded(event.target.value)}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="testimonialText">
          Testimonial (optional)
        </label>
        <textarea
          id="testimonialText"
          className={styles.textarea}
          value={testimonialText}
          onChange={(event) => setTestimonialText(event.target.value)}
          placeholder="If you'd like to share a short testimonial, drop it here."
        />
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={testimonialConsent}
          onChange={(event) => setTestimonialConsent(event.target.checked)}
        />
        I give permission to use my testimonial.
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={videoTestimonialInterest}
          onChange={(event) => setVideoTestimonialInterest(event.target.checked)}
        />
        I am open to a short video testimonial.
      </label>
    </BaseFeedbackForm>
  );
}
