'use client'

import { useState } from 'react'
import type { UserGoal } from '@/lib/profile/types'
import type { RiteJourney } from '@/lib/profile/rite-journey'
import { riteStageLocked } from '@/lib/profile/rite-journey'
import GoalCard from './GoalCard'
import GoalAIAssistant from './GoalAIAssistant'
import styles from './goals.module.css'

type RiteKey = 'orientation' | 'perception' | 'declaration'

const SECTIONS: { key: RiteKey; roman: string; label: string }[] = [
  { key: 'orientation', roman: 'I',   label: 'Orientation' },
  { key: 'perception',  roman: 'II',  label: 'Perception' },
  { key: 'declaration', roman: 'III', label: 'Declaration' },
]

interface Props {
  initialGoals: UserGoal[]
  journey: RiteJourney
}

export default function GoalsList({ initialGoals, journey }: Props) {
  const [goals, setGoals] = useState<UserGoal[]>(initialGoals)
  const [showAssistant, setShowAssistant] = useState(false)

  async function handleStatusChange(id: string, status: UserGoal['status']) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)))
    await fetch(`/api/profile/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  async function handleDelete(id: string) {
    await fetch(`/api/profile/goals/${id}`, { method: 'DELETE' })
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }

  async function handleUpdate(id: string, updates: Partial<Pick<UserGoal, 'title' | 'description'>>) {
    const res = await fetch(`/api/profile/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const { goal } = await res.json()
      setGoals((prev) => prev.map((g) => (g.id === id ? goal : g)))
    }
  }

  function handleGoalSaved(goal: UserGoal) {
    setGoals((prev) => [...prev, goal])
  }

  const crossRiteGoals = goals.filter((g) => g.rite_stage === 'all' || g.rite_stage == null)

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>Your Goals</h2>
        <button
          className={`${styles.guideBtn} ${showAssistant ? styles.guideBtnOpen : styles.guideBtnClosed}`}
          onClick={() => setShowAssistant((v) => !v)}
        >
          {showAssistant ? '× Close Guide' : '+ Goal Guide'}
        </button>
      </div>

      {showAssistant && (
        <GoalAIAssistant
          journey={journey}
          existingGoals={goals}
          onGoalSaved={handleGoalSaved}
        />
      )}

      {SECTIONS.map(({ key, roman, label }) => {
        const locked = riteStageLocked(key, journey)
        const stageGoals = goals.filter((g) => g.rite_stage === key)

        const headerClass = `${styles.sectionHeader} ${locked ? styles.sectionHeaderLocked : ''}`
        const labelClass = `${styles.sectionLabel} ${locked ? styles.sectionLabelLocked : styles.sectionLabelUnlocked}`

        return (
          <section key={key} className={styles.section}>
            <div className={headerClass}>
              <span className={styles.sectionRoman}>Rite {roman}</span>
              <span className={labelClass}>{label}</span>
              {locked && <span className={styles.lockedHint}>· complete earlier Rites to unlock</span>}
            </div>

            {stageGoals.length > 0 ? (
              stageGoals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              ))
            ) : !locked ? (
              <div className={styles.emptySection}>
                No {label.toLowerCase()} goals yet — use the Goal Guide to add one
              </div>
            ) : null}
          </section>
        )
      })}

      {crossRiteGoals.length > 0 && (
        <section className={styles.section}>
          <div className={styles.allRitesLabel}>All Rites</div>
          {crossRiteGoals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </section>
      )}
    </div>
  )
}
