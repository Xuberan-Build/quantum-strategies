/**
 * Human approval of a studio agent run (content_agent_runs).
 *
 * Pure logic with an injected store so the route handler stays thin and the rules
 * are unit-testable. Columns follow supabase/migrations/20260507000003_content_agent_runs.sql:
 * human_approved, approved_by (auth user id), feedback, status
 * ('pending' | 'running' | 'completed' | 'failed' | 'rejected').
 */

export const MAX_FEEDBACK_LENGTH = 4000;

export interface AgentRunRecord {
  id: string;
  status: string;
  human_approved: boolean | null;
}

export interface AgentRunApprovalPatch {
  human_approved: boolean;
  approved_by: string | null;
  status: 'completed' | 'rejected';
  feedback?: string | null;
}

export interface AgentRunStore {
  getRun(id: string): Promise<{ data: AgentRunRecord | null; error: string | null }>;
  updateRun(id: string, patch: AgentRunApprovalPatch): Promise<{ data: Record<string, unknown> | null; error: string | null }>;
}

export type ApprovalOutcome =
  | { ok: true; status: 200; run: Record<string, unknown> }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string };

export type ParsedApproval = { ok: true; approved: boolean; feedback: string | null | undefined } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the PATCH body: `{ human_approved: boolean, feedback?: string | null }`. */
export function parseApprovalBody(body: unknown): ParsedApproval {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const { human_approved, feedback } = body as Record<string, unknown>;
  if (typeof human_approved !== 'boolean') {
    return { ok: false, error: 'human_approved must be true or false.' };
  }
  if (feedback !== undefined && feedback !== null && typeof feedback !== 'string') {
    return { ok: false, error: 'feedback must be a string.' };
  }
  if (typeof feedback === 'string' && feedback.length > MAX_FEEDBACK_LENGTH) {
    return { ok: false, error: `feedback must be at most ${MAX_FEEDBACK_LENGTH} characters.` };
  }
  const trimmed = typeof feedback === 'string' ? feedback.trim() || null : feedback;
  return { ok: true, approved: human_approved, feedback: trimmed };
}

/** Only finished runs can be reviewed; approving a running or failed run is a client bug. */
export function canReview(status: string): boolean {
  return status === 'completed' || status === 'rejected';
}

export async function applyAgentRunApproval(args: {
  runId: string;
  body: unknown;
  adminUserId: string;
  store: AgentRunStore;
}): Promise<ApprovalOutcome> {
  const { runId, body, adminUserId, store } = args;
  if (!UUID.test(runId)) return { ok: false, status: 400, error: 'Invalid agent run id.' };

  const parsed = parseApprovalBody(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const existing = await store.getRun(runId);
  if (existing.error) return { ok: false, status: 500, error: existing.error };
  if (!existing.data) return { ok: false, status: 404, error: 'Agent run not found.' };
  if (!canReview(existing.data.status)) {
    return { ok: false, status: 409, error: `Agent run is ${existing.data.status}; only completed runs can be reviewed.` };
  }

  const patch: AgentRunApprovalPatch = {
    human_approved: parsed.approved,
    approved_by: parsed.approved ? adminUserId : null,
    status: parsed.approved ? 'completed' : 'rejected',
  };
  if (parsed.feedback !== undefined) patch.feedback = parsed.feedback;

  const updated = await store.updateRun(runId, patch);
  if (updated.error) return { ok: false, status: 500, error: updated.error };
  if (!updated.data) return { ok: false, status: 404, error: 'Agent run not found.' };
  return { ok: true, status: 200, run: updated.data };
}
