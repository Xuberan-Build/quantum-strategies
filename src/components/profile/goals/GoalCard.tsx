'use client'

import { useState } from 'react'
import type { UserGoal } from '@/lib/profile/types'
import styles from './goals.module.css'

export type { UserGoal }

const STATUS_CYCLE: UserGoal['status'][] = ['active', 'achieved', 'paused']

const STATUS_META: Record<UserGoal['status'], { label: string; style: React.CSSProperties }> = {
  active:   { label: 'Active',   style: { color: '#cebeff', background: 'rgba(93,63,211,0.15)' } },
  achieved: { label: 'Achieved', style: { color: '#4ade80', background: 'rgba(74,222,128,0.1)' } },
  paused:   { label: 'Paused',   style: { color: 'rgba(206,190,255,0.4)', background: 'rgba(255,255,255,0.04)' } },
}

const STAGE_LABELS: Record<string, string> = {
  orientation: 'Rite I · Orientation',
  perception:  'Rite II · Perception',
  declaration: 'Rite III · Declaration',
  all:         'All Rites',
}

interface Props {
  goal: UserGoal
  onStatusChange: (id: string, status: UserGoal['status']) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Pick<UserGoal, 'title' | 'description'>>) => void
}

export default function GoalCard({ goal, onStatusChange, onDelete, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [description, setDescription] = useState(goal.description ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { label: statusLabel, style: statusStyle } = STATUS_META[goal.status]
  const hasInsights = Object.keys(goal.ai_insights).length > 0

  function cycleStatus() {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(goal.status) + 1) % STATUS_CYCLE.length]
    onStatusChange(goal.id, next)
  }

  async function saveEdit() {
    if (!title.trim()) return
    setSaving(true)
    await onUpdate(goal.id, {
      title: title.trim(),
      description: description.trim() || null,
    })
    setSaving(false)
    setEditing(false)
  }

  function cancelEdit() {
    setTitle(goal.title)
    setDescription(goal.description ?? '')
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this goal?')) return
    setDeleting(true)
    await onDelete(goal.id)
  }

  const titleClass = [
    styles.cardTitle,
    goal.status === 'achieved' ? styles.cardTitleAchieved : '',
    goal.status === 'paused'   ? styles.cardTitlePaused   : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={`${styles.card} ${deleting ? styles.cardDeleting : ''}`}>
      <div className={styles.cardRow}>
        <div className={styles.cardBody}>
          {editing ? (
            <input
              className={styles.editInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          ) : (
            <p className={titleClass}>{goal.title}</p>
          )}

          {goal.rite_stage && (
            <span className={styles.cardStage}>
              {STAGE_LABELS[goal.rite_stage] ?? goal.rite_stage}
            </span>
          )}
        </div>

        <div className={styles.cardActions}>
          <button className={styles.statusBadge} style={statusStyle} onClick={cycleStatus} title="Cycle status">
            {statusLabel}
          </button>

          {editing ? (
            <>
              <button className={`${styles.iconBtn} ${styles.iconBtnConfirm}`} onClick={saveEdit} disabled={saving}>
                {saving ? '…' : '✓'}
              </button>
              <button className={styles.iconBtn} onClick={cancelEdit}>✕</button>
            </>
          ) : (
            <>
              <button className={styles.iconBtn} onClick={() => setEditing(true)} title="Edit">✎</button>
              <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={handleDelete} disabled={deleting} title="Delete">×</button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          className={styles.editTextarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context or notes..."
          rows={2}
        />
      ) : goal.description ? (
        <p className={styles.cardDescription}>{goal.description}</p>
      ) : null}

      {hasInsights && (
        <button className={styles.insightsToggle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? '▲ Hide insights' : '▼ AI insights'}
        </button>
      )}

      {expanded && hasInsights && (
        <div className={styles.insightsPanel}>
          {typeof goal.ai_insights.summary === 'string'
            ? goal.ai_insights.summary
            : JSON.stringify(goal.ai_insights, null, 2)}
        </div>
      )}
    </div>
  )
}
