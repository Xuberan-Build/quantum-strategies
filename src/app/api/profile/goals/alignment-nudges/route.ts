import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { getRiteForProduct } from '@/lib/beta/constants'

export interface AlignmentNudge {
  productSlug: string
  productName: string
  riteStage: 'orientation' | 'perception' | 'declaration'
  items: string[]
}

async function extractActionItems(deliverable: string): Promise<string[]> {
  // Trim to avoid huge token counts — action plans are near the end
  const excerpt = deliverable.slice(-4000)

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Extract action plan items from the document. Return ONLY a JSON array of strings, one string per action item. Return [] if none found. No explanation, no markdown, just the JSON array.',
      },
      {
        role: 'user',
        content: excerpt,
      },
    ],
    max_completion_tokens: 400,
    temperature: 0,
  })

  try {
    const raw = res.choices[0]?.message?.content?.trim() ?? '[]'
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string' && s.trim()) : []
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: sessions } = await supabase
      .from('product_sessions')
      .select('product_slug, deliverable_content')
      .eq('user_id', user.id)
      .not('deliverable_content', 'is', null)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ nudges: [] })
    }

    // Fetch product names
    const slugs = sessions.map((s) => s.product_slug)
    const { data: products } = await supabase
      .from('product_definitions')
      .select('product_slug, name')
      .in('product_slug', slugs)

    const nameMap = Object.fromEntries((products ?? []).map((p) => [p.product_slug, p.name]))

    const nudges: AlignmentNudge[] = []

    await Promise.all(
      sessions.map(async (session) => {
        const riteStage = getRiteForProduct(session.product_slug)
        if (!riteStage) return

        const items = await extractActionItems(session.deliverable_content as string)
        if (items.length === 0) return

        nudges.push({
          productSlug: session.product_slug,
          productName: nameMap[session.product_slug] ?? session.product_slug,
          riteStage,
          items,
        })
      })
    )

    return NextResponse.json({ nudges })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
