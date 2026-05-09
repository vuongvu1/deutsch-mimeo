import { formatMinutes } from '@/lib/dates'

import styles from './Heatmap.module.css'

interface Props {
  totals: Record<string, number>
  goalSeconds: number
  weeks?: number
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function intensity(seconds: number, goal: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0
  const ratio = seconds / Math.max(1, goal)
  if (ratio >= 1) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.25) return 2
  return 1
}

export function Heatmap({ totals, goalSeconds, weeks = 13 }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Monday-based: getDay() returns 0 for Sun, 1 for Mon. Map Mon=0..Sun=6.
  const dayOfWeekMon = (today.getDay() + 6) % 7

  const gridStart = new Date(today)
  gridStart.setDate(gridStart.getDate() - dayOfWeekMon - (weeks - 1) * 7)

  const cols: { weekDate: Date; days: { date: Date; iso: string; future: boolean }[] }[] = []
  for (let w = 0; w < weeks; w++) {
    const weekDate = new Date(gridStart)
    weekDate.setDate(weekDate.getDate() + w * 7)
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekDate)
      date.setDate(date.getDate() + d)
      days.push({ date, iso: localDateString(date), future: date > today })
    }
    cols.push({ weekDate, days })
  }

  const monthMarkers: { col: number; label: string }[] = []
  let lastMonth = -1
  for (let i = 0; i < cols.length; i++) {
    const m = cols[i].days[0].date.getMonth()
    if (m !== lastMonth) {
      monthMarkers.push({ col: i, label: MONTH_LABELS[m] })
      lastMonth = m
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.monthRow}>
        {monthMarkers.map((m) => (
          <span
            key={`${m.col}-${m.label}`}
            className={styles.monthLabel}
            style={{ gridColumn: m.col + 2 }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        <div className={styles.weekdayCol}>
          {WEEKDAY_LABELS.map((d, i) => (
            <span key={d} className={styles.weekdayLabel} data-show={i % 2 === 0 ? 'true' : 'false'}>
              {d}
            </span>
          ))}
        </div>
        {cols.map((col, i) => (
          <div key={i} className={styles.col}>
            {col.days.map((d) => {
              const seconds = totals[d.iso] ?? 0
              const lvl = d.future ? -1 : intensity(seconds, goalSeconds)
              return (
                <div
                  key={d.iso}
                  className={styles.cell}
                  data-level={lvl}
                  title={
                    d.future
                      ? d.iso
                      : `${d.iso} · ${formatMinutes(seconds)}${seconds >= goalSeconds ? ' ✓' : ''}`
                  }
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span className="subtle">Weniger</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <div key={lvl} className={styles.cell} data-level={lvl} aria-hidden />
        ))}
        <span className="subtle">Mehr</span>
      </div>
    </div>
  )
}
