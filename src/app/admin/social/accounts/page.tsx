import AccountsView from '@/components/admin/social/AccountsView';

export const dynamic = 'force-dynamic';

export default async function SocialAccountsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const sp = await searchParams;
  // Same base the OAuth routes use (src/lib/social/registry.ts redirectUriFor). Not a secret.
  const oauthBase = (process.env.SOCIAL_OAUTH_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return <AccountsView connected={sp.connected} error={sp.error} oauthBase={oauthBase} />;
}
