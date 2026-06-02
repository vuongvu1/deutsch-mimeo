import { Select } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getSpeechRate,
  SPEECH_RATES,
  type SpeechRate,
  setSpeechRate,
  subscribeSpeechRate,
} from '@/lib/sounds'

export function SpeedPicker() {
  const { t } = useTranslation()
  const [rate, setRateState] = useState<SpeechRate>(() => getSpeechRate())

  useEffect(() => subscribeSpeechRate(setRateState), [])

  return (
    <Select.Root value={String(rate)} onValueChange={(v) => setSpeechRate(Number(v) as SpeechRate)}>
      <Select.Trigger variant="soft" aria-label={t('header.speedLabel')} />
      <Select.Content>
        {SPEECH_RATES.map((r) => (
          <Select.Item key={r} value={String(r)}>
            {r}×
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}
