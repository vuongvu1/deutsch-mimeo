import { Progress } from '@radix-ui/themes'

interface Props {
  value: number
  max: number
  complete?: boolean
}

export function ProgressBar({ value, max, complete }: Props) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  return <Progress value={pct} max={100} color={complete ? 'green' : 'amber'} size="2" />
}
