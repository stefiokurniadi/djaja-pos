export type DateRange = { from: Date; to: Date };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function todayRange(now = new Date()): DateRange {
  return { from: startOfDay(now), to: endOfDay(now) };
}

export function yesterdayRange(now = new Date()): DateRange {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return { from: startOfDay(d), to: endOfDay(d) };
}

// Monday-Sunday
export function thisWeekRange(now = new Date()): DateRange {
  const d = startOfDay(now);
  const day = d.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  const from = startOfDay(d);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from, to: endOfDay(to) };
}

export function lastWeekRange(now = new Date()): DateRange {
  const thisWeek = thisWeekRange(now);
  const from = new Date(thisWeek.from);
  from.setDate(from.getDate() - 7);
  const to = new Date(thisWeek.to);
  to.setDate(to.getDate() - 7);
  return { from, to };
}

export function thisMonthRange(now = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: startOfDay(from), to: endOfDay(to) };
}

export function lastMonthRange(now = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: startOfDay(from), to: endOfDay(to) };
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

