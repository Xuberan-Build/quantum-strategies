'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { RiteJourney } from '@/lib/profile/rite-journey'
import type { UserGoal } from '@/lib/profile/types'
import styles from './goals.module.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SuggestedGoal {
  title: string
  description: string
  rite_stage: 'orientation' | 'perception' | 'declaration' | 'all'
}

const GOAL_BLOCK_RE = /\[GOAL_SUGGESTION\]([\s\S]*?)\[\/GOAL_SUGGESTION\]/

function parseGoalBlock(text: string): { display: string; goal: SuggestedGoal | null } {
  const match = GOAL_BLOCK_RE.exec(text)
  if (!match) return { display: text, goal: null }
  try {
    const goal = JSON.parse(match[1].trim()) as SuggestedGoal
    return { display: text.replace(GOAL_BLOCK_RE, '').trim(), goal }
  } catch {
    return { display: text.replace(GOAL_BLOCK_RE, '').trim(), goal: null }
  }
}

interface Props {
  journey: RiteJourney
  existingGoals: UserGoal[]
  onGoalSaved: (goal: UserGoal) => void
}

export default function GoalAIAssistant({ journey, existingGoals, onGoalSaved }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [suggestedGoal, setSuggestedGoal] = useState<SuggestedGoal | null>(null)
  const [savingGoal, setSavingGoal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  const sendMessage = useCallback(async (userText: string, isInit = false) => {
    if (streaming) return
    if (!isInit && !userText.trim()) return

    const outgoing: Message[] = isInit
      ? []
      : [...messages, { role: 'user', content: userText }]

    if (!isInit) {
      setMessages(outgoing)
      setInput('')
    }
    setStreaming(true)
    setStreamText('')
    setSuggestedGoal(null)
    setError(null)

    try {
      const res = await fetch('/api/profile/goals/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: outgoing,
          existingGoals: existingGoals.map((g) => ({
            title: g.title,
            rite_stage: g.rite_stage,
            status: g.status,
          })),
          journey: {
            orientation: { completed: journey.orientation.completed, total: journey.orientation.total },
            perception:  { completed: journey.perception.completed,  total: journey.perception.total  },
            declaration: { completed: journey.declaration.completed, total: journey.declaration.total },
          },
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(await res.text())
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setStreamText(full)
      }

      const { display, goal } = parseGoalBlock(full)
      setMessages((prev) => [...prev, { role: 'assistant', content: display }])
      setStreamText('')
      if (goal) setSuggestedGoal(goal)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setStreaming(false)
    }
  }, [streaming, messages, existingGoals, journey])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    sendMessage('', true)
  }, [sendMessage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  async function saveGoal() {
    if (!suggestedGoal) return
    setSavingGoal(true)
    try {
      const res = await fetch('/api/profile/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestedGoal),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onGoalSaved(data.goal)
      setSuggestedGoal(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingGoal(false)
    }
  }

  const displayMessages: Message[] = [
    ...messages,
    ...(streaming || streamText ? [{ role: 'assistant' as const, content: streamText }] : []),
  ]

  return (
    <div className={styles.assistant}>
      <div className={styles.thread}>
        {displayMessages.length === 0 && streaming && (
          <span className={styles.loadingText}>Reading your journey…</span>
        )}

        {displayMessages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant}`}
          >
            <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
              {msg.content
                ? msg.content
                : streaming && i === displayMessages.length - 1
                  ? <span className={styles.cursor}>▊</span>
                  : null}
            </div>
          </div>
        ))}

        {error && <div className={styles.errorBanner}>{error}</div>}

        {suggestedGoal && (
          <div className={styles.suggestionCard}>
            <span className={styles.suggestionLabel}>Suggested Goal</span>
            <p className={styles.suggestionTitle}>{suggestedGoal.title}</p>
            {suggestedGoal.description && (
              <p className={styles.suggestionDescription}>{suggestedGoal.description}</p>
            )}
            <div className={styles.suggestionActions}>
              <button className={styles.saveBtnPrimary} onClick={saveGoal} disabled={savingGoal}>
                {savingGoal ? 'Saving…' : 'Save this goal'}
              </button>
              <button className={styles.saveBtnSecondary} onClick={() => setSuggestedGoal(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <input
          className={styles.chatInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(input)
            }
          }}
          placeholder={streaming ? 'Guide is responding…' : 'Reply or ask a question…'}
          disabled={streaming}
        />
        <button
          className={`${styles.sendBtn} ${!streaming && input.trim() ? styles.sendBtnActive : styles.sendBtnDisabled}`}
          onClick={() => sendMessage(input)}
          disabled={streaming || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
