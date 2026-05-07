export interface UserGoal {
  id: string
  user_id: string
  title: string
  description: string | null
  rite_stage: 'orientation' | 'perception' | 'declaration' | 'all' | null
  status: 'active' | 'achieved' | 'paused'
  ai_insights: Record<string, unknown>
  created_at: string
  updated_at: string
}
