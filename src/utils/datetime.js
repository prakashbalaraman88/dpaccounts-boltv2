// Timestamp helpers that survive both storage formats this app has used:
//  - Supabase timestamptz: "2026-06-11T05:04:21.706707+00:00" (zone included)
//  - legacy SQLite datetime('now'): "2026-06-11 05:04:21" (UTC, no zone)
// Blindly appending 'Z' broke Supabase dates (→ "Invalid Date").

export function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  let s = String(value).trim();

  // Legacy SQLite format: no 'T', no zone → mark as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(value) {
  const d = parseTimestamp(value);
  if (!d) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** WhatsApp-style relative label: time today, "Yesterday", weekday, then date. */
export function formatRelativeDay(value) {
  const d = parseTimestamp(value);
  if (!d) return '';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);

  if (dayDiff <= 0) return formatTime(d);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
