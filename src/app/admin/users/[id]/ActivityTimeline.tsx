export type TimelineEvent = {
  id: string;
  type: 'purchase' | 'session_start' | 'session_complete' | 'email_sent' | 'campaign_enrolled';
  label: string;
  detail?: string;
  timestamp: string;
};

const DOT_COLORS: Record<string, string> = {
  purchase: 'var(--admin-success)',
  session_complete: 'var(--admin-success)',
  session_start: 'var(--admin-primary)',
  email_sent: '#a78bfa',
  campaign_enrolled: '#fb923c',
};

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>No activity yet.</p>;
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div style={{ position: 'relative', paddingLeft: '1.375rem' }}>
      <div style={{
        position: 'absolute', left: '5px', top: '6px', bottom: 0,
        width: '2px', background: 'var(--admin-border)',
      }} />
      {sorted.map((event, i) => (
        <div key={`${event.id}-${i}`} style={{ position: 'relative', marginBottom: '1rem' }}>
          <div style={{
            position: 'absolute', left: '-1.375rem', top: '3px',
            width: '10px', height: '10px', borderRadius: '50%',
            background: DOT_COLORS[event.type] || 'var(--admin-border)',
            border: '2px solid var(--admin-bg-card)',
            flexShrink: 0,
          }} />
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.3 }}>{event.label}</div>
          {event.detail && (
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '1px' }}>{event.detail}</div>
          )}
          <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
            {new Date(event.timestamp).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
