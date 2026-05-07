import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title?.trim() || null
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.status !== undefined) updates.status = body.status
    if (body.rite_stage !== undefined) updates.rite_stage = body.rite_stage
    if (body.ai_insights !== undefined) updates.ai_insights = body.ai_insights

    const { data, error } = await supabase
      .from('user_goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ goal: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('user_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
