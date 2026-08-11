export type ChangelogEntryType = 'feature' | 'fix' | 'improvement' | 'chore'

export interface ChangelogEntry {
  type: ChangelogEntryType
  text: string
}

export interface ChangelogVersion {
  version: string
  date: string
  entries: ChangelogEntry[]
}

export const changelog: ChangelogVersion[] = [
  {
    version: '0.24.1',
    date: '2026-08-11',
    entries: [
      {
        type: 'improvement',
        text: '"Days complete" renamed to "Days done" — one task clears it.',
      },
      {
        type: 'improvement',
        text: 'Home compare table trimmed to totals only.',
      },
    ],
  },
  {
    version: '0.24.0',
    date: '2026-08-11',
    entries: [
      {
        type: 'feature',
        text: 'New alerts: almost done, perfect day, rival finished.',
      },
      {
        type: 'feature',
        text: 'End-of-day recap at 22:00 names the daily winner.',
      },
    ],
  },
  {
    version: '0.23.0',
    date: '2026-08-11',
    entries: [
      {
        type: 'feature',
        text: 'Notifications are bilingual — German, then English.',
      },
    ],
  },
  {
    version: '0.22.1',
    date: '2026-08-11',
    entries: [
      {
        type: 'fix',
        text: 'Notifications no longer mix English and German.',
      },
    ],
  },
  {
    version: '0.22.0',
    date: '2026-08-11',
    entries: [
      {
        type: 'feature',
        text: 'Bot checks in every 2 hours with both your statuses.',
      },
      {
        type: 'feature',
        text: 'Get called out when the other one overtakes you.',
      },
      {
        type: 'improvement',
        text: 'Notification copy is English now, and far more annoying.',
      },
    ],
  },
  {
    version: '0.21.1',
    date: '2026-08-10',
    entries: [
      {
        type: 'improvement',
        text: 'Updates install automatically — no more refresh prompt.',
      },
      {
        type: 'fix',
        text: 'Telegram notifications now send reliably.',
      },
    ],
  },
  {
    version: '0.21.0',
    date: '2026-08-09',
    entries: [
      {
        type: 'feature',
        text: 'Telegram bot posts finished challenges and complete days.',
      },
      {
        type: 'feature',
        text: 'Reminder at 21:00 when nothing is done yet today.',
      },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-08-09',
    entries: [
      {
        type: 'improvement',
        text: 'A day counts as complete after one finished challenge.',
      },
      {
        type: 'improvement',
        text: 'Optional challenges removed — counter now shows all four.',
      },
    ],
  },
  {
    version: '0.19.1',
    date: '2026-07-20',
    entries: [
      {
        type: 'fix',
        text: 'Listening answer feedback shows English explanation too.',
      },
    ],
  },
  {
    version: '0.19.0',
    date: '2026-07-13',
    entries: [
      {
        type: 'feature',
        text: 'Recall reveal shows an example sentence, word underlined.',
      },
      {
        type: 'feature',
        text: 'Skip button in the recall quiz for words you don’t know.',
      },
      {
        type: 'improvement',
        text: 'Wrong recall answers show your typed answer for comparison.',
      },
      {
        type: 'improvement',
        text: 'Abfrage challenge is optional — no longer gates a complete day.',
      },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-07-10',
    entries: [
      {
        type: 'feature',
        text: 'New Abfrage challenge: type your saved words from memory.',
      },
      {
        type: 'improvement',
        text: 'Listen 30 min challenge no longer required for a complete day.',
      },
      {
        type: 'improvement',
        text: 'Optional challenges are listed after required ones.',
      },
    ],
  },
  {
    version: '0.17.1',
    date: '2026-07-09',
    entries: [
      {
        type: 'chore',
        text: 'Upgrade to TypeScript 7.0 (native compiler).',
      },
    ],
  },
  {
    version: '0.17.0',
    date: '2026-06-25',
    entries: [
      {
        type: 'fix',
        text: 'Listening: retry + fallback model when Gemini is busy.',
      },
      {
        type: 'improvement',
        text: 'Listening: clearer “try again” message on generation fail.',
      },
    ],
  },
  {
    version: '0.16.0',
    date: '2026-06-24',
    entries: [
      {
        type: 'improvement',
        text: 'Listening: shows correct answer as you pick.',
      },
      {
        type: 'improvement',
        text: 'Listening: transcript on by default; exam mode gone.',
      },
    ],
  },
  {
    version: '0.15.0',
    date: '2026-06-10',
    entries: [
      {
        type: 'feature',
        text: 'Vokabeln: part of speech + example after each match.',
      },
      {
        type: 'improvement',
        text: 'Hörverstehen: topics drawn from a 100-topic pool.',
      },
    ],
  },
  {
    version: '0.14.1',
    date: '2026-06-07',
    entries: [
      {
        type: 'fix',
        text: 'Listening: sound toggle so audio isn’t muted by vocab.',
      },
      {
        type: 'improvement',
        text: 'Listening: hint when sound is off so play isn’t silent.',
      },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-06-04',
    entries: [
      {
        type: 'feature',
        text: 'Installable PWA with offline app shell.',
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-06-02',
    entries: [
      {
        type: 'feature',
        text: 'Adjustable voice speed in header; slower by default.',
      },
      {
        type: 'feature',
        text: 'Listening: Goethe-style true/false + choice tasks per level.',
      },
      {
        type: 'feature',
        text: 'Listening exam mode caps replays and hides the transcript.',
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-06-01',
    entries: [
      {
        type: 'feature',
        text: 'New vocab packs: clothing, animals, house, free time.',
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-05-31',
    entries: [
      {
        type: 'feature',
        text: 'Cheat mode (?cheat=true) counts listen time 2× for busy days.',
      },
      {
        type: 'feature',
        text: 'Watch Together counts listen time for both users on one screen.',
      },
    ],
  },
  {
    version: '0.10.3',
    date: '2026-05-30',
    entries: [
      {
        type: 'improvement',
        text: "Compare table shows today's correct listening answers.",
      },
    ],
  },
  {
    version: '0.10.2',
    date: '2026-05-27',
    entries: [
      {
        type: 'improvement',
        text: 'Default voice is now Kerstin instead of Thorsten. Existing picks are preserved.',
      },
      {
        type: 'fix',
        text: 'Listening answer labels now show pointer cursor on hover.',
      },
      {
        type: 'improvement',
        text: 'Compare tables award the crown to both users when their numbers tie.',
      },
    ],
  },
  {
    version: '0.10.1',
    date: '2026-05-26',
    entries: [
      {
        type: 'chore',
        text: 'Switched to Gemini 2.5 Flash-Lite to reduce token costs.',
      },
      {
        type: 'fix',
        text: 'Listening exercises now show correctly in recent activity.',
      },
      {
        type: 'improvement',
        text: 'Removed 7-day rows from home comparison (still available on full stats page).',
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-05-24',
    entries: [
      {
        type: 'feature',
        text: 'New "Listening 1×/day" challenge with AI-generated German texts, multiple-choice questions, and bilingual explanations.',
      },
      {
        type: 'feature',
        text: 'Voice picker in header: Thorsten, Eva, or Kerstin (applies to both vocab and listening).',
      },
      {
        type: 'improvement',
        text: 'Listening exercises use warm Thorsten voice with background sentence pre-rendering.',
      },
      {
        type: 'improvement',
        text: 'One generated text per user per day; submission alone counts as day complete.',
      },
      {
        type: 'improvement',
        text: 'Smooth progress bar animation and active sentence highlighting with auto-scroll.',
      },
      {
        type: 'improvement',
        text: 'Active listening settings displayed as persistent badges throughout the round.',
      },
      {
        type: 'improvement',
        text: 'Gemini calls proxied through Cloudflare Worker for key security.',
      },
      {
        type: 'fix',
        text: 'Fixed Eva and Kerstin voice loading crashes in development.',
      },
      {
        type: 'fix',
        text: 'Fixed OPFS cache clearing for fresh voice model loads.',
      },
      {
        type: 'fix',
        text: 'Fixed voice picker singleton instance persistence across switches.',
      },
    ],
  },
  {
    version: '0.9.3',
    date: '2026-05-24',
    entries: [
      {
        type: 'improvement',
        text: 'Changelog now loads on demand to reduce initial bundle size.',
      },
      {
        type: 'feature',
        text: '5 new B1 word packs (Society, Health, Environment, Feelings, Media).',
      },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-05-24',
    entries: [
      {
        type: 'feature',
        text: 'Videos remember playback position; resumes from where you paused.',
      },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-05-20',
    entries: [
      {
        type: 'fix',
        text: 'Fixed days-complete counter stuck at 0 (deactivated hidden Tagebuch challenge).',
      },
      {
        type: 'improvement',
        text: "Challenges track activation date; new challenges don't erase historical day-complete counts.",
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-05-18',
    entries: [
      {
        type: 'feature',
        text: 'New "Full stats" comparison page with all stats and heatmaps side-by-side.',
      },
      {
        type: 'feature',
        text: 'Live status dot on user cards showing current active challenge.',
      },
      {
        type: 'feature',
        text: 'Version number in header with changelog modal; update banner on new release.',
      },
      {
        type: 'improvement',
        text: 'Removed "longest session" from comparison table.',
      },
      {
        type: 'improvement',
        text: 'Vocab challenge now counts completed rounds (10/day) instead of individual matches.',
      },
      {
        type: 'fix',
        text: 'Fixed vocab "today" counter doubling after each round.',
      },
    ],
  },
  {
    version: '0.8.1',
    date: '2026-05-17',
    entries: [
      {
        type: 'fix',
        text: 'Fixed movie-mode floating bar visibility in light theme.',
      },
      {
        type: 'fix',
        text: 'Fixed vocab pronunciation when matching English tile first.',
      },
      {
        type: 'fix',
        text: 'Piper voice loads from repo instead of HuggingFace mirror.',
      },
      {
        type: 'improvement',
        text: 'Piper voice pre-loads in background on app startup.',
      },
      {
        type: 'chore',
        text: 'Fixed pnpm 11 CI build (protobufjs script decision).',
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-05-16',
    entries: [
      {
        type: 'improvement',
        text: 'Added high-quality neural voice (Thorsten) with background pre-loading.',
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-05-16',
    entries: [
      {
        type: 'feature',
        text: 'Save words while playing vocab game via bookmark button.',
      },
      {
        type: 'feature',
        text: 'New "Saved words" pack option in dropdown.',
      },
    ],
  },
  {
    version: '0.6.1',
    date: '2026-05-15',
    entries: [
      {
        type: 'feature',
        text: 'Movie mode in player with fullscreen video and floating stats.',
      },
      {
        type: 'improvement',
        text: 'Session counter persists across video changes until tab closes.',
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-14',
    entries: [
      {
        type: 'feature',
        text: 'New "Vocabulary" challenge — German ↔ English match-pairs mini-game.',
      },
      {
        type: 'feature',
        text: 'Five word packs (A1 Basics, Food, Travel, Family, A2 Work) with "All words" default.',
      },
      {
        type: 'feature',
        text: 'Sound effects for matches with mute toggle in header.',
      },
      {
        type: 'feature',
        text: 'German word pronunciation on tile tap via Web Speech API.',
      },
      {
        type: 'improvement',
        text: 'Stats page and heatmap now cover both challenges.',
      },
      {
        type: 'fix',
        text: 'Fixed vocab matches being lost when navigating away quickly.',
      },
      {
        type: 'fix',
        text: 'Recent activity now correctly displays vocab counts.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-14',
    entries: [
      {
        type: 'feature',
        text: 'Changelog button in header.',
      },
      {
        type: 'feature',
        text: 'Pagination in video library.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-05-13',
    entries: [
      {
        type: 'improvement',
        text: 'Loading skeletons for videos.',
      },
      {
        type: 'feature',
        text: '"Move to top" button for videos in library.',
      },
      {
        type: 'feature',
        text: 'Bulk import from YouTube playlists with duplicate detection.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-05-12',
    entries: [
      {
        type: 'feature',
        text: 'Recent activity log on home page.',
      },
      {
        type: 'feature',
        text: 'Admin mode for destructive actions.',
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-11',
    entries: [
      {
        type: 'feature',
        text: 'Reorder videos via drag & drop.',
      },
      {
        type: 'feature',
        text: 'Autoplay mode on player page.',
      },
      {
        type: 'feature',
        text: 'Delete videos with confirmation.',
      },
      {
        type: 'feature',
        text: 'Avatars and comparison table on home page.',
      },
      {
        type: 'feature',
        text: 'Mark videos as watched.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-10',
    entries: [
      {
        type: 'feature',
        text: 'Initial version: all pages, Supabase integration, listening counter.',
      },
      {
        type: 'feature',
        text: '13-week activity heatmap on stats page.',
      },
      {
        type: 'chore',
        text: 'Deploy to Cloudflare Workers.',
      },
    ],
  },
]
