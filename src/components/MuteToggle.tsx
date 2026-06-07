import { SpeakerLoudIcon, SpeakerOffIcon } from '@radix-ui/react-icons'
import { IconButton, Tooltip } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isMuted, setMuted, subscribeMute } from '@/lib/sounds'

export function MuteToggle() {
  const { t } = useTranslation()
  const [muted, setMutedState] = useState<boolean>(() => isMuted())
  useEffect(() => subscribeMute(setMutedState), [])
  const label = muted ? t('common.sound.unmute') : t('common.sound.mute')
  return (
    <Tooltip content={label}>
      <IconButton
        variant="soft"
        radius="full"
        aria-label={label}
        aria-pressed={muted}
        onClick={() => setMuted(!muted)}
      >
        {muted ? <SpeakerOffIcon /> : <SpeakerLoudIcon />}
      </IconButton>
    </Tooltip>
  )
}
