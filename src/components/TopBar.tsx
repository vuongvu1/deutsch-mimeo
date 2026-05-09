import { Link } from 'react-router-dom'

import styles from './TopBar.module.css'

interface Props {
  back?: { to: string; label?: string }
  title?: string
  emoji?: string
  rightSlot?: React.ReactNode
}

export function TopBar({ back, title, emoji, rightSlot }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        {back ? (
          <Link to={back.to} className={styles.back} aria-label={back.label ?? 'Back'}>
            ←
          </Link>
        ) : null}
        {emoji ? <span className={styles.emoji}>{emoji}</span> : null}
        {title ? <h1 className={styles.title}>{title}</h1> : null}
      </div>
      {rightSlot ? <div className={styles.right}>{rightSlot}</div> : null}
    </header>
  )
}
