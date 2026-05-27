import { Select } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AVAILABLE_VOICES,
  getVoiceId,
  type PiperVoiceId,
  setVoiceId,
  subscribeVoiceId,
} from '@/lib/sounds'

const VOICE_EMOJI: Record<'male' | 'female', string> = {
  male: '🧔',
  female: '👩',
}

export function VoicePicker() {
  const { t } = useTranslation()
  const [voiceId, setVoiceIdState] = useState<PiperVoiceId>(() => getVoiceId())

  useEffect(() => subscribeVoiceId(setVoiceIdState), [])

  return (
    <Select.Root value={voiceId} onValueChange={(v) => setVoiceId(v as PiperVoiceId)}>
      <Select.Trigger variant="soft" aria-label={t('header.voiceLabel')} />
      <Select.Content>
        {AVAILABLE_VOICES.map((v) => (
          <Select.Item key={v.id} value={v.id}>
            {VOICE_EMOJI[v.gender]} {t(`header.voices.${v.id}`)}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}
