/**
 * Doorbell for the Telegram notifier. Deliberately dumb: it reports that a
 * challenge was touched and lets the Worker decide whether the goal is met and
 * whether that was already announced. No goal math or before/after state here.
 *
 * `keepalive` lets the ping outlive an unmount or tab close — the same window
 * useSessionTracker's final flush already fights. Failures are swallowed: a
 * missed notification must never surface in the UI or break a session write.
 */
export function pingProgress(userId: string, challengeId: string) {
  void fetch('/api/notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId, challengeId }),
    keepalive: true,
  }).catch(() => {})
}
