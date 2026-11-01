'use client'

import { RITE_STAGES, riteStageLocked, type RiteJourney } from '@/lib/profile/rite-journey'
import styles from './goals.module.css'

interface Props {
  journey: RiteJourney
}

export default function JourneyProgress({ journey }: Props) {
  return (
    <div className={styles.journey}>
      {RITE_STAGES.map(({ key, roman, label }, i) => {
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
            {i < RITE_STAGES.length - 1 && <div className={styles.riteDivider} />}
          </div>
        )
      })}
    </div>
  )
}
