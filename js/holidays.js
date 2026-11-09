// Swedish public holidays and other days off (julafton, midsommarafton, nyårsafton),
// computed locally. Dates are handled as UTC midnight timestamps to avoid time zone issues.

const DAY = 24 * 60 * 60 * 1000;

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

// First date in [month/fromDay, month/fromDay+6] falling on weekday (0 = Sunday).
function weekdayInWindow(year, month, fromDay, weekday) {
  for (let d = fromDay; d < fromDay + 7; d++) {
    const t = Date.UTC(year, month, d);
    if (new Date(t).getUTCDay() === weekday) return t;
  }
}

const cache = new Map();

// Returns [{ date: 'YYYY-MM-DD', name }] sorted by date.
export function swedishHolidays(year) {
  if (cache.has(year)) return cache.get(year);
  const easter = easterSunday(year);
  const list = [
    [Date.UTC(year, 0, 1), 'Nyårsdagen'],
    [Date.UTC(year, 0, 6), 'Trettondedag jul'],
    [easter - 2 * DAY, 'Långfredagen'],
    [easter, 'Påskdagen'],
    [easter + DAY, 'Annandag påsk'],
    [Date.UTC(year, 4, 1), 'Första maj'],
    [easter + 39 * DAY, 'Kristi himmelsfärdsdag'],
    [Date.UTC(year, 5, 6), 'Sveriges nationaldag'],
    [easter + 49 * DAY, 'Pingstdagen'],
    [weekdayInWindow(year, 5, 19, 5), 'Midsommarafton'],
    [weekdayInWindow(year, 5, 20, 6), 'Midsommardagen'],
    [weekdayInWindow(year, 9, 31, 6), 'Alla helgons dag'],
    [Date.UTC(year, 11, 24), 'Julafton'],
    [Date.UTC(year, 11, 25), 'Juldagen'],
    [Date.UTC(year, 11, 26), 'Annandag jul'],
    [Date.UTC(year, 11, 31), 'Nyårsafton'],
  ]
    .sort((a, b) => a[0] - b[0])
    .map(([t, name]) => ({ date: new Date(t).toISOString().slice(0, 10), time: t, name }));
  cache.set(year, list);
  return list;
}

function toUTC(date) {
  if (typeof date === 'string') {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

// Number of weekdays in [start, end] (inclusive) that are not holidays.
// start/end: 'YYYY-MM-DD' strings or Date objects.
export function businessDays(start, end) {
  const from = toUTC(start);
  const to = toUTC(end);
  const holidayTimes = new Set();
  for (let y = new Date(from).getUTCFullYear(); y <= new Date(to).getUTCFullYear(); y++) {
    for (const h of swedishHolidays(y)) holidayTimes.add(h.time);
  }
  let count = 0;
  for (let t = from; t <= to; t += DAY) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6 && !holidayTimes.has(t)) count++;
  }
  return count;
}
