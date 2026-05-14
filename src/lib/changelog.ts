export type ChangelogEntryType = 'feature' | 'fix' | 'improvement' | 'chore'

export interface ChangelogEntry {
  type: ChangelogEntryType
  de: string
  en: string
}

export interface ChangelogVersion {
  version: string
  date: string
  entries: ChangelogEntry[]
}

export const changelog: ChangelogVersion[] = [
  {
    version: '0.6.1',
    date: '2026-05-15',
    entries: [
      {
        type: 'feature',
        de: 'Kinomodus im Player — vergrößert das Video, dimmt den Hintergrund und zeigt die heutigen Minuten als schwebendes Overlay. Schalter neben Autoplay, Klick auf den Hintergrund oder Escape beendet ihn.',
        en: 'Movie mode in the player — enlarges the video, dims the background and shows today\'s minutes as a floating overlay. Switch next to autoplay; click backdrop or press Escape to exit.',
      },
      {
        type: 'improvement',
        de: '„Diese Session" zählt jetzt über Videowechsel hinweg weiter und zählt erst beim Schließen des Browser-Tabs zurück auf 0.',
        en: '"This session" counter now keeps running across video changes and only resets when you close the browser tab.',
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-14',
    entries: [
      {
        type: 'feature',
        de: 'Neue Challenge „Vokabeln" — Match-Pairs-Minispiel auf Deutsch ↔ Englisch.',
        en: 'New "Vocabulary" challenge — German ↔ English match-pairs mini-game.',
      },
      {
        type: 'feature',
        de: 'Fünf Wortpakete (A1-Grundlagen, Essen, Reisen, Familie, A2-Arbeit) — im Spiel umschaltbar.',
        en: 'Five word packs (A1 Basics, Food, Travel, Family, A2 Work) — switchable mid-game.',
      },
      {
        type: 'feature',
        de: 'Soundeffekte für Treffer, Runde fertig und Tagesziel — mit Stummschalter im Header.',
        en: 'Sound effects for matches, round-done and daily goal — with a mute toggle in the header.',
      },
      {
        type: 'improvement',
        de: 'Stats-Seite und Heatmap zeigen jetzt beide Challenges.',
        en: 'Stats page and heatmap now cover both challenges.',
      },
      {
        type: 'feature',
        de: 'Aussprache des deutschen Worts beim Antippen — via Web Speech API.',
        en: 'Pronounces the German word when a tile is tapped — via the Web Speech API.',
      },
      {
        type: 'fix',
        de: 'Vokabel-Treffer wurden manchmal verloren, wenn man die Seite schnell verließ — alle Treffer werden jetzt korrekt gespeichert.',
        en: 'Vocab matches could be lost when leaving the page quickly — all matches now persist correctly.',
      },
      {
        type: 'fix',
        de: 'Letzte-Aktivität zeigt jetzt korrekt „spielte Vokabeln" mit Treffer-Zahl statt Hörminuten.',
        en: 'Recent activity now correctly shows "played vocabulary" with match count instead of listening minutes.',
      },
      {
        type: 'improvement',
        de: '„Heute · Vergleich" zeigt jetzt Vokabel-Treffer für heute und die letzten 7 Tage.',
        en: '"Today · Compare" now includes today\'s and 7-day vocab match counts.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-14',
    entries: [
      {
        type: 'feature',
        de: 'Änderungsprotokoll im Header — was hier steht.',
        en: 'Changelog button in the header — what you’re looking at.',
      },
      {
        type: 'feature',
        de: 'Paginierung in der Video-Bibliothek.',
        en: 'Pagination in the video library.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-05-13',
    entries: [
      {
        type: 'improvement',
        de: 'Lade-Skeletons für Videos statt nur „Lade…".',
        en: 'Loading skeletons for videos instead of just “Loading…”.',
      },
      {
        type: 'feature',
        de: '„Nach ganz oben" Button für Videos in der Bibliothek.',
        en: '“Move to top” button for videos in the library.',
      },
      {
        type: 'feature',
        de: 'Bulk-Import aus YouTube-Playlists (mit Duplikat-Erkennung).',
        en: 'Bulk import from YouTube playlists (with duplicate detection).',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-05-12',
    entries: [
      {
        type: 'feature',
        de: 'Letzte-Aktivität-Log auf der Startseite.',
        en: 'Recent activity log on the home page.',
      },
      {
        type: 'feature',
        de: 'Admin-Modus für destruktive Aktionen (`?admin=true`).',
        en: 'Admin mode for destructive actions (`?admin=true`).',
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-11',
    entries: [
      {
        type: 'feature',
        de: 'Video-Reihenfolge per Drag & Drop.',
        en: 'Reorder videos via drag & drop.',
      },
      {
        type: 'feature',
        de: 'Autoplay-Modus auf der Player-Seite.',
        en: 'Autoplay mode on the player page.',
      },
      {
        type: 'feature',
        de: 'Video löschen mit Bestätigungs-Dialog.',
        en: 'Delete videos with confirmation dialog.',
      },
      {
        type: 'feature',
        de: 'Avatare und Vergleichs-Tabelle auf der Startseite.',
        en: 'Avatars and comparison table on the home page.',
      },
      {
        type: 'feature',
        de: '„Als gesehen" markieren für Videos.',
        en: 'Mark videos as watched.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-10',
    entries: [
      {
        type: 'feature',
        de: 'Erste Version: alle Seiten, Supabase-Anbindung, Hör-Counter.',
        en: 'Initial version: all pages, Supabase integration, listening counter.',
      },
      {
        type: 'feature',
        de: '13-Wochen Aktivitäts-Heatmap auf der Stats-Seite.',
        en: '13-week activity heatmap on the stats page.',
      },
      {
        type: 'chore',
        de: 'Deploy auf Cloudflare Workers.',
        en: 'Deploy to Cloudflare Workers.',
      },
    ],
  },
]
