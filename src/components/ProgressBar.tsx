import styles from './ProgressBar.module.css'

interface Props {
  value: number
  max: number
  complete?: boolean
}

export function ProgressBar({ value, max, complete }: Props) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  return (
    <div className={styles.track} data-complete={complete ? 'true' : 'false'}>
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  )
}
