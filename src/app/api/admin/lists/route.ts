import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

async function resolveSmartListCount(filterCriteria: Record<string, any>): Promise<number> {
  const source = filterCriteria?.source as string | undefined;
  switch (source) {
    case 'discord_linked': {
      const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'is', null).not('discord_id', 'is', null);
      return count ?? 0;
    }
    case 'affiliates': {
      const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'is', null).eq('is_affiliate', true);
      return count ?? 0;
    }
    case 'placements_confirmed': {
      const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'is', null).eq('placements_confirmed', true);
      return count ?? 0;
    }
    case 'stripe_customers': {
      const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'is', null).not('stripe_customer_id', 'is', null);
      return count ?? 0;
    }
    case 'completed_product': {
      let q = supabaseAdmin.from('product_sessions').select('user_id', { count: 'exact', head: true }).not('completed_at', 'is', null);
      if (filterCriteria.product_slug) q = q.eq('product_slug', filterCriteria.product_slug);
      const { count } = await q;
      return count ?? 0;
    }
    case 'beta_participants': {
      const { count } = await supabaseAdmin.from('beta_participants').select('user_id', { count: 'exact', head: true });
      return count ?? 0;
    }
    case 'hd_type': {
      const hdType = filterCriteria.hd_type as string;
      const { count } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .not('email', 'is', null)
        .filter('placements->human_design->>type', 'ilike', `%${hdType}%`);
      return count ?? 0;
    }
    case 'sun_sign': {
      const sunSign = filterCriteria.sun_sign as string;
      const { count } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .not('email', 'is', null)
        .filter('placements->astrology->>sun', 'ilike', `%${sunSign}%`);
      return count ?? 0;
    }
    default: {
      const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('email', 'is', null);
      return count ?? 0;
    }
  }
}

export async function GET() {
  try {
    const { data: lists, error } = await supabaseAdmin
      .from('contact_lists')
      .select('*, list_members(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = await Promise.all(
      (lists || []).map(async (l: any) => {
        let memberCount = l.list_members?.[0]?.count ?? 0;

        if (l.list_type === 'smart') {
          memberCount = await resolveSmartListCount(l.filter_criteria || {});
        }

        return { ...l, member_count: memberCount, list_members: undefined };
      })
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, list_type = 'static', filter_criteria, created_by } = body;

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('contact_lists')
      .insert({ name, description, list_type, filter_criteria, created_by })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
