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
    version: '0.9.0',
    date: '2026-05-18',
    entries: [
      {
        type: 'feature',
        de: 'Neue Vergleichsseite „Alle Stats" — Knopf unter der Heute-Vergleichstabelle führt zu einer Seite, die alle Stats-Zahlen (Hören, Vokabeln, Tage) und beide Aktivitäts-Heatmaps für Mi und Meo nebeneinander zeigt.',
        en: 'New "Full stats" comparison page — a button under the today-comparison table opens a page that puts every stats number (listening, vocab, days) and both activity heatmaps side-by-side for Mi and Meo.',
      },
      {
        type: 'improvement',
        de: 'Vergleichstabelle: Zeile „Längste Session" entfernt — die Info findest du weiterhin auf der Stats-Seite.',
        en: 'Comparison table: removed the "Longest session" row — that stat still lives on the stats page.',
      },
      {
        type: 'feature',
        de: 'Startseite: Jede Personen-Karte zeigt jetzt einen Live-Punkt mit der gerade aktiven Challenge, einen Tageszähler „X / Y Challenges" und einen Haken, sobald alles für heute geschafft ist. Derselbe Zähler erscheint auch neben „Heutige Challenges" auf der Challenge-Seite.',
        en: 'Home page: each user card now shows a live dot with the challenge they\'re currently doing, a daily "X / Y challenges" counter, and a check icon as soon as they finish everything for the day. The same counter now also sits next to the "Today\'s Challenges" heading on the challenge list page.',
      },
      {
        type: 'fix',
        de: 'Vokabelspiel: „Heute"-Anzeige sprang nach jeder fertigen Runde um 2 statt 1 — der Tagesstart wird jetzt einmal eingefroren, damit der Server-Refetch nicht doppelt zählt.',
        en: 'Vocab game: the "Today" total jumped by 2 instead of 1 after each finished round — the day\'s baseline is now snapshotted once so the server refetch can\'t double-count alongside the in-session counter.',
      },
      {
        type: 'improvement',
        de: 'Vokabel-Challenge umgestellt: das Tagesziel zählt jetzt komplett abgeschlossene Runden (10/Tag) statt einzelner Treffer (vorher 50). Eine Runde = ein Brett aus 6 Paaren geleert. Alte Statistiken wurden zu Runden umgerechnet.',
        en: 'Vocab challenge retuned: the daily goal now counts fully cleared rounds (10/day) instead of individual matches (previously 50). One round = one board of 6 pairs cleared. Past stats were converted to rounds.',
      },
      {
        type: 'feature',
        de: 'Vergleichstabelle auf der Startseite: neue Zeile „Challenges komplett" 🎯 — zählt jeden Tag, an dem Mi oder Meo das Tagesziel einer Challenge geschafft hat (Hören und Vokabeln werden einzeln gezählt).',
        en: 'Home comparison table: new "Challenges complete" 🎯 row — counts every challenge goal Mi or Meo has cleared across all days (listen and vocab count individually).',
      },
      {
        type: 'feature',
        de: 'Versionsnummer im Header neben dem Raketen-Symbol — klicke darauf, um die Änderungsliste zu öffnen.',
        en: 'Version number in the header next to the rocket icon — click it to open the changelog.',
      },
      {
        type: 'feature',
        de: 'Update-Hinweis im Header: Wenn eine neue Version live ist, erscheint ein grüner Aktualisieren-Knopf, mit dem du die App neu lädst.',
        en: 'Update banner in the header: when a new version is live, a green refresh button appears so you can reload the app.',
      },
    ],
  },
  {
    version: '0.8.1',
    date: '2026-05-17',
    entries: [
      {
        type: 'fix',
        de: 'Kino-Modus: Die „Heute"-Anzeige oben ist im hellen Design wieder lesbar — die Schrift war auf dem dunklen Hintergrund zu dunkel.',
        en: 'Movie mode: the floating "today total" bar is readable again in light theme — its labels were rendering too dark on the dark backdrop.',
      },
      {
        type: 'fix',
        de: 'Vokabelspiel: Das deutsche Wort wird jetzt auch dann vorgelesen, wenn du zuerst die englische Karte und danach die passende deutsche anklickst.',
        en: 'Vocab game: the German word is now spoken when you match by picking the English tile first and the German tile second (previously only the German-first order spoke it).',
      },
      {
        type: 'chore',
        de: 'CI-Build repariert: pnpm 11 verlangt eine ausdrückliche Entscheidung über das protobufjs-Build-Skript — auf „false" gesetzt, da es nur ungenutzte CLIs erzeugt.',
        en: 'CI build fixed: pnpm 11 requires an explicit decision on the protobufjs build script — set to false since it only builds unused CLIs.',
      },
      {
        type: 'fix',
        de: 'Piper-Stimme zuverlässiger: das Modell wird jetzt aus dem eigenen Repo geladen statt vom externen HuggingFace-Mirror, der gelegentlich 404 zurückgab.',
        en: 'Piper voice more reliable: the model now loads from this repo instead of the external HuggingFace mirror that occasionally returned 404.',
      },
      {
        type: 'improvement',
        de: 'Piper-Stimme lädt jetzt sofort im Hintergrund, sobald die App geöffnet ist — beim Erreichen des Vokabelspiels ist sie häufiger schon einsatzbereit.',
        en: 'Piper voice now starts loading in the background as soon as the app opens, so it\'s more often ready by the time you reach the vocab game.',
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-05-16',
    entries: [
      {
        type: 'improvement',
        de: 'Wärmere deutsche Aussprache — beim ersten Klick auf eine Vorlesetaste startet im Hintergrund der Download einer hochwertigen neuronalen Stimme (Thorsten). Bis sie bereit ist, spricht die Systemstimme; danach klingt jedes „Wort sprechen" konstant und natürlicher.',
        en: 'Warmer German pronunciation — the first tap on a speak button kicks off a background download of a high-quality neural voice (Thorsten). The system voice covers the gap; once ready, every speak action sounds consistently warmer and more natural.',
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-05-16',
    entries: [
      {
        type: 'feature',
        de: 'Wörter merken im Vokabelspiel — tippe das Lesezeichen-Symbol auf einer deutschen Karte, um sie in deine persönliche Liste zu speichern. Über das Lesezeichen-Symbol oben kannst du sie ansehen, anhören oder löschen.',
        en: 'Save words in the vocab game — tap the bookmark on a German tile to add it to your personal notebook. Use the bookmark button in the header to review, pronounce, or remove them.',
      },
      {
        type: 'feature',
        de: 'Neues Paket „🔖 Gemerkte Wörter" im Dropdown — spiele nur mit deinen markierten Vokabeln.',
        en: 'New "🔖 Saved words" option in the pack dropdown — play only with words you\'ve bookmarked.',
      },
    ],
  },
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
      {
        type: 'improvement',
        de: 'Neue Standardauswahl „Alle Wörter" im Vokabel-Dropdown — mischt Wörter aus allen Paketen.',
        en: 'New default "All words" option in the vocab dropdown — mixes words from every pack.',
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
