// Daily reminder hooks (0008 §6). v0.5 has the toggle, the permission request and
// sendReminder(); nothing schedules it. A web app can't fire a notification at a
// set time while closed, so the scheduler is a later piece (phone reminder or Capacitor build).

export type NotifyResult = 'granted' | 'denied' | 'unsupported'

export const notificationsSupported = () => typeof Notification !== 'undefined'

/** Ask for permission. Call only from a user action (a click on the toggle). */
export async function requestNotifications(): Promise<NotifyResult> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try { return (await Notification.requestPermission()) === 'granted' ? 'granted' : 'denied' } catch { return 'denied' }
}

/** Show the end-of-day reminder now, if allowed. A future scheduler calls this once a day. */
export function sendReminder(): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try { new Notification('Simple Budget', { body: 'Did you add all your purchases?' }); return true } catch { return false }
}
