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
    version: '0.10.1',
    date: '2026-05-26',
    entries: [
      {
        type: 'fix',
        de: 'Letzte Aktivität: Hörverstehen-Einträge wurden als „(gelöschtes Video)" mit „0 Min" angezeigt, weil sie ohne Video gespeichert werden. Sie erscheinen jetzt als „… übte Hörverstehen · 1 Runde".',
        en: 'Recent activity: Hörverstehen entries used to show up as "(deleted video) · 0 min" because they have no video attached. They now read "… practiced listening comprehension · 1 round".',
      },
      {
        type: 'improvement',
        de: 'Startseite-Vergleich: die Zeilen „7-Tage gehört" und „7-Tage Vokabeln" sind aus der Übersicht entfernt — alle Wochenwerte bleiben weiterhin auf der „Alle Stats"-Seite sichtbar.',
        en: 'Home compare: the "7-day listened" and "7-day vocab" rows have been removed from the at-a-glance table — the full weekly numbers still live on the "Full stats" page.',
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-05-24',
    entries: [
      {
        type: 'feature',
        de: 'Neue Challenge „Hörverstehen 1×/Tag" — Niveau (A1–B2 oder Mix), Länge (1–5 Min) und Anzahl Fragen (5/10/15) wählen, die KI erstellt einen passenden deutschen Text plus Multiple-Choice-Fragen. Vorlesen, beliebig oft wiederholen, Transkript bei Bedarf einblenden — danach Antworten abschicken und zweisprachige Erklärungen lesen. Mehr als 50 % richtig = Tageschallenge erledigt.',
        en: 'New "Listening 1×/day" challenge — pick level (A1–B2 or mix), length (1–5 min) and number of questions (5/10/15); the AI generates a German paragraph plus multiple-choice questions. Play it back as often as you like, reveal the transcript when you need it, then submit and read bilingual explanations. More than 50% correct ticks the day\'s challenge.',
      },
      {
        type: 'improvement',
        de: 'Hörverstehen nutzt jetzt die warme Thorsten-Stimme aus dem Vokabelspiel statt der Systemstimme. Sätze werden im Hintergrund vorgerendert: der Text spielt nach ~3–5 s an und läuft dann lückenlos durch, während die nächsten Sätze synthetisiert werden.',
        en: 'Listening exercises now use the warm Thorsten voice from the vocab game instead of the system voice. Sentences pre-render in the background — audio starts in ~3–5s and plays through seamlessly while the next sentences synthesize.',
      },
      {
        type: 'feature',
        de: 'Stimmen-Auswahl im Header: Thorsten (männlich), Eva (weiblich, klein und schnell) oder Kerstin (weiblich, ruhig). Die Auswahl wird pro Browser gespeichert und gilt sowohl im Vokabelspiel als auch beim Hörverstehen.',
        en: 'Voice picker in the header: Thorsten (male), Eva (female, small and fast) or Kerstin (female, calm). Choice is per-browser and applies to both the vocab game and the listening exercise.',
      },
      {
        type: 'improvement',
        de: 'Hörverstehen spart KI-Aufrufe: der Text wird pro Tag und pro Person nur einmal generiert. Nach dem Aktualisieren bleibt der gleiche Text. Wer den Text wirklich neu erzeugen will, kann „Anderen Text generieren" tippen.',
        en: 'Listening saves AI calls: each user gets one generated text per day. Refreshing keeps the same text. If you really want a different one, tap "Generate a different text".',
      },
      {
        type: 'improvement',
        de: 'Hörverstehen: schon das Abschicken zählt für den Tag — die 50-%-Hürde ist weg. Score und Erklärungen sind weiterhin zu sehen, sie steuern aber nicht mehr, ob der Tag erledigt ist.',
        en: 'Listening: just submitting counts the day now — the 50% gate is gone. You still see your score and the explanations, but they no longer decide whether the day is complete.',
      },
      {
        type: 'improvement',
        de: 'Hörverstehen: der Fortschrittsbalken läuft jetzt flüssig (statt nur am Satzende zu springen) und der aktuelle Satz wird im sichtbaren Transkript hervorgehoben — bei langen Texten scrollt er auch von selbst ins Sichtfeld.',
        en: 'Listening: progress bar now animates smoothly (instead of jumping at sentence boundaries) and the active sentence is highlighted in the visible transcript — it also auto-scrolls into view for longer texts.',
      },
      {
        type: 'fix',
        de: 'Stimmen-Auswahl: Eva und Kerstin haben mit „JSON parse error" abgestürzt, weil die Sprachdateien lokal noch nicht ausgeliefert wurden. Während der Entwicklung serviert der Vite-Server jetzt /voices/ aus dem lokalen Repo, sodass alle drei Stimmen sofort funktionieren.',
        en: 'Voice picker: Eva and Kerstin crashed with a "JSON parse error" because the voice files weren\'t being served locally. The Vite dev server now serves /voices/ from the repo, so all three voices work immediately in development.',
      },
      {
        type: 'fix',
        de: 'Stimmen-Auswahl: Ein einmaliger Fehlversuch hatte 404-HTML in den OPFS-Cache geschrieben, der danach jeden weiteren Versuch zum Absturz brachte. Beim Start räumen wir die betroffenen Cache-Einträge auf, damit die Stimme frisch geladen wird.',
        en: 'Voice picker: a one-off failed load had cached the 404 HTML page in OPFS, which then crashed every subsequent attempt. We now evict the affected cache entries on startup so the voice loads fresh.',
      },
      {
        type: 'fix',
        de: 'Eva und Kerstin haben mitten im Absatz Sätze übersprungen, weil ihr Modell eine ältere kleinere Phoneme-Tabelle verwendet (130 statt 256 Symbolen) — der Phonemizer produzierte für seltene Laute IDs außerhalb des Wertebereichs und die ONNX-Inferenz brach ab. Wir filtern die zu großen IDs jetzt weg, bevor sie ins Modell gehen. Eva und Kerstin sprechen wieder durchgängig; einzelne Akzente / Zahlen klingen evtl. etwas flacher.',
        en: 'Eva and Kerstin used to skip sentences mid-paragraph because their model ships with a smaller phoneme table (130 vs 256 symbols) — the phonemizer emitted out-of-range IDs for rarer sounds and the ONNX inference crashed. We now filter the out-of-range IDs before they hit the model. Eva and Kerstin speak continuously again; rare emphasis / digit handling may sound slightly flatter.',
      },
      {
        type: 'fix',
        de: 'Stimmen-Auswahl: Ein Stimmenwechsel hat erst nach einem Reload gewirkt — die TTS-Bibliothek verwendet intern eine Singleton-Instanz, sodass das erste geladene Modell hängen blieb. Wir setzen die Instanz jetzt zurück, damit die neue Stimme sofort beim nächsten Abspielen verwendet wird.',
        en: "Voice picker: switching voice didn't take effect until a page refresh — the TTS library caches a singleton instance so the first-loaded model stuck around. We now reset that instance, so the new voice is used on the very next play.",
      },
      {
        type: 'improvement',
        de: 'Hörverstehen: die aktuelle Auswahl (Niveau · Länge · Fragenanzahl) ist jetzt während des gesamten Durchlaufs als Badges sichtbar — so weißt du immer, welche Einstellungen für den laufenden Text gelten.',
        en: 'Listening: the active selection (level · length · question count) now stays visible as badges throughout the round, so you always know which settings the current text was generated with.',
      },
      {
        type: 'improvement',
        de: 'Hörverstehen: „Anderen Text generieren" bringt dich jetzt erst zur Filterauswahl zurück, statt sofort einen neuen Text mit den alten Einstellungen zu erzeugen — du kannst Niveau, Länge oder Fragenzahl anpassen und dann erneut starten.',
        en: 'Listening: "Generate a different text" now drops you back to the filter screen instead of immediately regenerating with the previous settings — adjust level / length / question count, then hit Start.',
      },
      {
        type: 'fix',
        de: 'Startseite: Der Live-Punkt „Hört Hörverstehen" erscheint jetzt auch während der Audiowiedergabe und beim Beantworten — nicht erst nach dem Absenden. Wir markieren die Person ab dem ersten Generieren als aktiv und halten den Status während der ganzen Runde auf der anderen Person sichtbar.',
        en: 'Home page: the live "Doing listening comprehension" dot now shows during audio playback and while answering — not just after submit. We mark the user as active from the moment they start generating, and keep the status visible to the other user throughout the round.',
      },
      {
        type: 'improvement',
        de: 'Gemini-Aufrufe laufen über einen Cloudflare Worker (Schlüssel als Worker-Secret, nicht im Browser).',
        en: 'Gemini calls go through a Cloudflare Worker (key lives as a Worker secret, not in the browser bundle).',
      },
    ],
  },
  {
    version: '0.9.3',
    date: '2026-05-24',
    entries: [
      {
        type: 'improvement',
        de: 'Änderungsliste lädt jetzt erst beim Öffnen (mit Lade-Spinner während des Nachladens) — die Einträge sind aus dem Haupt-Bundle gewandert, damit die App beim ersten Aufruf etwas schneller startet.',
        en: 'Changelog content is now loaded on demand (with a loading spinner while the chunk fetches) — entries no longer ship in the main bundle, so first page load is a touch faster.',
      },
      {
        type: 'feature',
        de: '5 neue B1-Wortpakete: Gesellschaft & Politik, Gesundheit & Körper, Umwelt & Natur, Gefühle & Persönlichkeit, Medien & Technik. „Alle Wörter" zeigt jetzt häufiger fortgeschrittene Vokabeln (10 % A1, 25 % A2, 65 % B1) statt einfacher Grundwörter.',
        en: '5 new B1 word packs: Society & Politics, Health & Body, Environment & Nature, Feelings & Personality, Media & Technology. "All words" now surfaces advanced vocabulary much more often (10% A1, 25% A2, 65% B1) instead of repeating the easy basics.',
      },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-05-24',
    entries: [
      {
        type: 'feature',
        de: 'Hör-Challenge: Videos merken sich jetzt deine Wiedergabe-Position. Wenn du pausierst und später zurückkommst, startet das Video automatisch genau dort, wo du aufgehört hast. Nach dem Anschauen oder manuellem Abhaken springt die Position wieder auf den Anfang.',
        en: 'Listen challenge: videos now remember your playback position. Pause partway through and the player resumes at the same second when you come back. Position resets to the start once you finish a video or manually mark it as watched.',
      },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-05-20',
    entries: [
      {
        type: 'fix',
        de: '„Tage komplett" stand wieder auf 0 — eine versteckte dritte Challenge (Tagebuch) in der Datenbank hatte den Tag immer als unvollständig markiert. Die Challenge ist jetzt deaktiviert; die Zählung berücksichtigt wieder nur Hören und Vokabeln.',
        en: '"Days complete" was stuck at 0 — a hidden third challenge (Tagebuch) in the database was marking every day as incomplete. It is now deactivated, so the count once again reflects just Listen + Vocab.',
      },
      {
        type: 'improvement',
        de: 'Jede Challenge merkt sich jetzt ihr Startdatum (`activated_on`): „Tage komplett" verlangt eine Challenge nur für Tage ab ihrem Start. Eine neue Challenge setzt also nicht mehr die ganze Historie auf null zurück.',
        en: 'Every challenge now records the date it started counting (`activated_on`): "Days complete" only requires a challenge on days from that date onward. Adding a new challenge no longer wipes the historical day-complete count.',
      },
    ],
  },
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
        en: "Piper voice now starts loading in the background as soon as the app opens, so it's more often ready by the time you reach the vocab game.",
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
        en: "Movie mode in the player — enlarges the video, dims the background and shows today's minutes as a floating overlay. Switch next to autoplay; click backdrop or press Escape to exit.",
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
