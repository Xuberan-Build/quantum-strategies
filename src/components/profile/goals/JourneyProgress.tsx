'use client'

import type { RiteJourney } from '@/lib/profile/rite-journey'
import { riteStageLocked } from '@/lib/profile/rite-journey'
import styles from './goals.module.css'

interface Props {
  journey: RiteJourney
}

const RITES: { key: keyof Pick<RiteJourney, 'orientation' | 'perception' | 'declaration'>; roman: string; label: string }[] = [
  { key: 'orientation', roman: 'I',   label: 'Orientation' },
  { key: 'perception',  roman: 'II',  label: 'Perception' },
  { key: 'declaration', roman: 'III', label: 'Declaration' },
]

export default function JourneyProgress({ journey }: Props) {
  return (
    <div className={styles.journey}>
      {RITES.map(({ key, roman, label }, i) => {
        const status = journey[key]
        const locked = riteStageLocked(key, journey)
        const complete = status.isComplete
        const inProgress = status.hasAny && !status.isComplete

        const cardClass = [
          styles.riteCard,
          locked     ? styles.riteCardLocked     : '',
          complete   ? styles.riteCardComplete   : '',
          inProgress ? styles.riteCardInProgress : '',
          !locked && !complete && !inProgress ? styles.riteCardIdle : '',
        ].filter(Boolean).join(' ')

        const iconClass = [
          styles.riteIcon,
          complete   ? styles.riteIconComplete   : '',
          inProgress ? styles.riteIconInProgress : '',
          !complete && !inProgress ? styles.riteIconIdle : '',
        ].filter(Boolean).join(' ')

        const nameClass = [
          styles.riteName,
          complete   ? styles.riteNameComplete   : '',
          inProgress ? styles.riteNameInProgress : '',
          !complete && !inProgress ? styles.riteNameIdle : '',
        ].filter(Boolean).join(' ')

        return (
          <div key={key} className={styles.journeyItem}>
            <div className={cardClass}>
              <div className={iconClass}>
                {complete ? '✓' : roman}
              </div>
              <div>
                <div className={nameClass}>{label}</div>
                <div className={`${styles.riteCount} ${locked ? styles.riteCountLocked : styles.riteCountNormal}`}>
                  {locked ? 'Locked' : `${status.completed.length} / ${status.total}`}
                </div>
              </div>
            </div>
            {i < RITES.length - 1 && <div className={styles.riteDivider} />}
          </div>
        )
      })}
    </div>
  )
}
