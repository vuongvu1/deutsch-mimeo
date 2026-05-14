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
