import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('rite_stage', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ goals: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title, description, rite_stage, ai_insights } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_goals')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        rite_stage: rite_stage || 'all',
        ai_insights: ai_insights || {},
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A goal with this title already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ goal: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
