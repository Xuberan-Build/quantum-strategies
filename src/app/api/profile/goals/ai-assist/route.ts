import { createServerSupabaseClient } from '@/lib/supabase/server'
import { openai, DEFAULT_MODEL } from '@/lib/openai/client'
import { checkRateLimit } from '@/lib/security/rate-limit'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const rateLimitKey = `goals-ai:${user.id}`
    const rateLimit = checkRateLimit(rateLimitKey, { maxRequests: 20, windowMs: 60 * 1000 })
    if (!rateLimit.allowed) {
      return new Response('Rate limit exceeded', { status: 429 })
    }

    const body = await req.json()
    const { messages = [], existingGoals = [], journey = null } = body

    // Fetch user context + completed deliverables for nudge injection
    const [{ data: userData }, { data: accessRows }, { data: deliverableSessions }] = await Promise.all([
      supabase.from('users').select('name, company_name, placements').eq('id', user.id).single(),
      supabase.from('product_access').select('product_slug, completed_at').eq('user_id', user.id),
      supabase.from('product_sessions').select('product_slug, deliverable_content').eq('user_id', user.id).not('deliverable_content', 'is', null),
    ])

    const placements = userData?.placements || {}
    const astro = placements.astrology || {}
    const hd = placements.human_design || {}
    const name = userData?.name || 'there'
    const company = userData?.company_name || ''

    const completedProducts = (accessRows || [])
      .filter((r) => r.completed_at)
      .map((r) => r.product_slug)

    const journeyContext = journey
      ? `Orientation: ${journey.orientation.completed.length}/${journey.orientation.total} complete
Perception: ${journey.perception.completed.length}/${journey.perception.total} complete
Declaration: ${journey.declaration.completed.length}/${journey.declaration.total} complete`
      : `Completed products: ${completedProducts.join(', ') || 'none yet'}`

    const existingGoalsList = existingGoals.length > 0
      ? existingGoals.map((g: any) => `- ${g.title} (${g.rite_stage}, ${g.status})`).join('\n')
      : 'No goals set yet.'

    // Extract action plan items from deliverables to inject as context
    const nudgeContext = (deliverableSessions ?? [])
      .map((s) => {
        const content = (s.deliverable_content as string) ?? ''
        // Pull the last part of the deliverable where action plans live
        const excerpt = content.slice(-2500)
        // Look for numbered action items inline rather than calling GPT again (already in stream context)
        const matches = [...excerpt.matchAll(/\d+[.)]\s+(.+)/g)].map((m) => m[1].trim())
        if (matches.length === 0) return null
        return `${s.product_slug}:\n${matches.map((i) => `  • ${i}`).join('\n')}`
      })
      .filter(Boolean)
      .join('\n\n')

    const systemPrompt = `You are a strategic guide helping ${name}${company ? ` of ${company}` : ''} identify and articulate meaningful goals aligned with their Three Rites journey and cosmic blueprint.

THEIR CHART:
Astrology — Sun: ${astro.sun || '?'}, Moon: ${astro.moon || '?'}, Rising: ${astro.rising || '?'}, Mercury: ${astro.mercury || '?'}, Venus: ${astro.venus || '?'}, Mars: ${astro.mars || '?'}
Human Design — Type: ${hd.type || '?'}, Strategy: ${hd.strategy || '?'}, Authority: ${hd.authority || '?'}, Profile: ${hd.profile || '?'}

THREE RITES JOURNEY:
${journeyContext}

EXISTING GOALS:
${existingGoalsList}
${nudgeContext ? `\nACTION ITEMS FROM THEIR COMPLETED BLUEPRINTS (reference these to propose specific, chart-grounded goals — don't just repeat them verbatim):\n${nudgeContext}` : ''}
YOUR ROLE:
- Help them articulate goals specific to each Rite stage (Orientation = understanding who they are, Perception = reading their environment accurately, Declaration = committing to a direction)
- Ground every insight in their specific placements — do not give generic advice
- Ask one question at a time to help them get specific
- When you have enough to propose a concrete goal, end your response with this exact block:

[GOAL_SUGGESTION]
{"title":"[concise goal title under 100 chars]","description":"[1-2 sentences of context]","rite_stage":"[orientation|perception|declaration|all]"}
[/GOAL_SUGGESTION]

Only include the [GOAL_SUGGESTION] block when you have a specific, actionable proposal. Do not include it in every message.`

    const fullMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // If this is the first message (empty history), open with a proactive assessment
    if (fullMessages.length === 0) {
      fullMessages.push({
        role: 'user',
        content: 'Help me think through my goals for this journey.',
      })
    }

    const stream = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...fullMessages],
      stream: true,
      max_completion_tokens: 600,
      temperature: 0.7,
    })

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: any) {
    console.error('[goals/ai-assist]', err)
    return new Response(err.message || 'AI request failed', { status: 500 })
  }
}
