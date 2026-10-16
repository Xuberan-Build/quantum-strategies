import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';
import { applyAgentRunApproval, type AgentRunStore } from '@/lib/content/agent-run-approval';

type Params = { params: Promise<{ id: string }> };

const store: AgentRunStore = {
  async getRun(id) {
    const { data, error } = await supabaseAdmin
      .from('content_agent_runs')
      .select('id, status, human_approved')
      .eq('id', id)
      .maybeSingle();
    return { data, error: error?.message ?? null };
  },
  async updateRun(id, patch) {
    const { data, error } = await supabaseAdmin
      .from('content_agent_runs')
      .update(patch)
      .eq('id', id)
      .select('id, agent_type, status, human_approved, approved_by, feedback, content_angle_id')
      .maybeSingle();
    return { data, error: error?.message ?? null };
  },
};

/** Record a human approve/reject on an agent run. Body: { human_approved: boolean, feedback?: string }. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const outcome = await applyAgentRunApproval({ runId: id, body, adminUserId: admin.id, store });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: outcome.run.human_approved ? 'content_agent_run_approved' : 'content_agent_run_rejected',
    targetType: 'content_agent_run',
    targetId: id,
    newValue: { human_approved: outcome.run.human_approved, status: outcome.run.status },
  });

  return NextResponse.json({ run: outcome.run });
}
