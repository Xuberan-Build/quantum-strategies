import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getFoundingOffer, markOfferPresented } from '@/lib/beta/founding-member-server';
import { FOUNDING_OFFER_CLOSES_AT } from '@/lib/beta/founding-member';
import { BETA_CALENDAR_URL, FOUNDING_MEMBER_PRICE } from '@/lib/beta/constants';
import FoundingCheckoutButton from './FoundingCheckoutButton';
import dashboardStyles from '../dashboard.module.css';
import styles from './founding.module.css';

export const dynamic = 'force-dynamic';

const closesLabel = new Date(FOUNDING_OFFER_CLOSES_AT).toLocaleDateString('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export default async function FoundingMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { session_id: returnedFromCheckout } = await searchParams;
  const offer = await getFoundingOffer(user.id, user.email);
  const { participant, eligibility, pricing } = offer;

  if (!participant || (!eligibility.eligible && eligibility.reason === 'not_beta')) {
    redirect('/dashboard/products');
  }
  if (!eligibility.eligible && eligibility.reason === 'withdrawn') {
    redirect('/dashboard/products');
  }

  const isMember = !eligibility.eligible && eligibility.reason === 'already_member';
  const isClosed = !eligibility.eligible && eligibility.reason === 'closed';

  if (eligibility.eligible && pricing) {
    await markOfferPresented(participant.id, pricing.price);
  }

  const done =
    (participant.perception_completed_count ?? 0) +
    (participant.orientation_completed_count ?? 0) +
    (participant.declaration_completed_count ?? 0);

  return (
    <div className={dashboardStyles.container}>
      <header className={dashboardStyles.header}>
        <h1>Founding Member</h1>
        <p className={dashboardStyles.subtitle}>For the 12 people in the first beta cohort.</p>
      </header>

      <main className={styles.main}>
        {isMember && (
          <section className={styles.card}>
            <h2>You&apos;re a Founding Member. Thank you.</h2>
            <p>
              Book your debrief call with me here. Pick any open slot that works for you.
            </p>
            <a className={styles.button} href={BETA_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
              Book the debrief call
            </a>
            <p className={styles.small}>
              I&apos;ll add your Founding Member role in Discord myself. Reply to any of my emails
              with your Discord name if I don&apos;t have it.
            </p>
          </section>
        )}

        {!isMember && returnedFromCheckout && (
          <section className={styles.notice}>
            Payment received. It can take a minute to show up here, so refresh in a moment.
          </section>
        )}

        {isClosed && !isMember && (
          <section className={styles.card}>
            <h2>The founding offer closed on {closesLabel}.</h2>
            <p>
              Your beta access hasn&apos;t changed. All 11 products are still yours, with no end date.
            </p>
            <Link className={styles.button} href="/dashboard/products">Back to your products</Link>
          </section>
        )}

        {eligibility.eligible && pricing && (
          <>
            <section className={styles.card}>
              <h2>
                {pricing.covered
                  ? 'What you have paid already covers it.'
                  : `Your price: ${money(pricing.price)}`}
              </h2>
              <p>
                When you joined the beta I said you&apos;d get the chance to become a Founding Member
                for {money(FOUNDING_MEMBER_PRICE)}, minus anything you&apos;d already bought.
                {pricing.credit > 0
                  ? ` You've paid ${money(pricing.credit)} so far, so that comes off.`
                  : ''}
              </p>
              <p>
                You don&apos;t have to pay to keep what you have. All 11 products stay yours either way,
                with no end date. Founding Member is for the people who want to back this early and
                get the things below.
              </p>
              {pricing.covered ? (
                <p>Reply to my email and I&apos;ll mark you as a Founding Member myself.</p>
              ) : (
                <FoundingCheckoutButton label={`Become a Founding Member for ${money(pricing.price)}`} />
              )}
              <p className={styles.small}>Open until {closesLabel}, 11:59pm Pacific. One payment, nothing recurring.</p>
            </section>

            <section className={styles.card}>
              <h2>What Founding Members get</h2>
              <ul className={styles.list}>
                <li>
                  <strong>Every new Rite and app product I release, included.</strong> The three Rites are
                  live today. Anything self-serve I add to the app after this is yours at no extra cost.
                </li>
                <li>
                  <strong>A 45-minute debrief call with me.</strong> We go through what your scans showed
                  and pick the next move for your business. You book it after you join.
                </li>
                <li>
                  <strong>The Founding Member role in Discord</strong>, and your name on the founding circle
                  list if you want it there. I&apos;ll ask before I list anyone.
                </li>
                <li>
                  <strong>First access and priority support.</strong> You see new products before they go
                  public, and your messages go to the top of my list.
                </li>
              </ul>
            </section>

            <section className={styles.card}>
              <h2>Where you are</h2>
              <p>
                You&apos;ve finished {done} of 11. Perception {participant.perception_completed_count ?? 0} of 5,
                Orientation {participant.orientation_completed_count ?? 0} of 3, Declaration{' '}
                {participant.declaration_completed_count ?? 0} of 3.
              </p>
              <p>
                You don&apos;t need to finish to join. If you&apos;re stuck in Rite I, the debrief call is
                a good place to sort out why.
              </p>
              <Link className={styles.secondary} href="/dashboard/products">Go to your products</Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
