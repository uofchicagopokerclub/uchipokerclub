// Schedule helpers. Dates in content/club.js are Chicago-local, so "now" is converted to Chicago time
// before comparing, and display formatting never shifts a date across midnight.

const CHICAGO = 'America/Chicago';

// "2026-10-09" -> "Friday, October 9"
export function formatDay(iso, { weekday = 'long', month = 'long' } = {}) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { weekday, month, day: 'numeric', timeZone: 'UTC' }).format(d);
}

// "18:00" -> { h: 6, m: "00", ap: "PM" }
function clock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: h % 12 || 12, m: String(m).padStart(2, '0'), ap: h < 12 ? 'AM' : 'PM' };
}

// ("18:00", "20:00") -> "6:00 to 8:00 PM"; ("10:30", "13:30") -> "10:30 AM to 1:30 PM"
export function formatTimeRange(start, end) {
  const a = clock(start);
  const b = clock(end);
  const first = a.ap === b.ap ? `${a.h}:${a.m}` : `${a.h}:${a.m} ${a.ap}`;
  return `${first} to ${b.h}:${b.m} ${b.ap}`;
}

// Current Chicago wall-clock time as "YYYY-MM-DDTHH:MM", comparable as a string.
export function chicagoNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CHICAGO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// `now` is a chicagoNow() string, computed once on the server so the page and the browser agree.
export function isOver(meeting, now) {
  return `${meeting.date}T${meeting.end}` <= now;
}

// The first meeting that has not ended yet, or null once the term's schedule is over.
export function nextMeeting(meetings, now) {
  const sorted = meetings.slice().sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
  return sorted.find((m) => !isOver(m, now)) || null;
}
