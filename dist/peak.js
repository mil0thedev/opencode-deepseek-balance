const PEAK_WINDOWS_UTC = [[1, 4], [6, 10]];
const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_CHANGE_SCAN_HOURS = 24 * 40;
/**
 * Mainland China public holidays published by the State Council.
 * DeepSeek bills Chinese public holidays as off-peak for the whole day.
 * 2027 dates are provisional until the State Council publishes the official calendar.
 */
const HOLIDAYS = {
  2026: [{
    name: "New Year",
    start: "2026-01-01",
    end: "2026-01-03"
  }, {
    name: "Spring Festival",
    start: "2026-02-15",
    end: "2026-02-23"
  }, {
    name: "Qingming Festival",
    start: "2026-04-04",
    end: "2026-04-06"
  }, {
    name: "Labour Day",
    start: "2026-05-01",
    end: "2026-05-05"
  }, {
    name: "Dragon Boat Festival",
    start: "2026-06-19",
    end: "2026-06-21"
  }, {
    name: "Mid-Autumn Festival",
    start: "2026-09-25",
    end: "2026-09-27"
  }, {
    name: "National Day",
    start: "2026-10-01",
    end: "2026-10-07"
  }],
  2027: [{
    name: "New Year",
    start: "2027-01-01",
    end: "2027-01-01",
    provisional: true
  }, {
    name: "Spring Festival",
    start: "2027-02-05",
    end: "2027-02-11",
    provisional: true
  }, {
    name: "Qingming Festival",
    start: "2027-04-05",
    end: "2027-04-05",
    provisional: true
  }, {
    name: "Labour Day",
    start: "2027-05-01",
    end: "2027-05-02",
    provisional: true
  }, {
    name: "Dragon Boat Festival",
    start: "2027-06-07",
    end: "2027-06-09",
    provisional: true
  }, {
    name: "Mid-Autumn Festival",
    start: "2027-09-15",
    end: "2027-09-17",
    provisional: true
  }, {
    name: "National Day",
    start: "2027-10-01",
    end: "2027-10-07",
    provisional: true
  }]
};
function chinaDateKey(date) {
  // China has no daylight saving time, so a fixed offset is exact.
  const china = new Date(date.getTime() + CHINA_UTC_OFFSET_MS);
  const year = china.getUTCFullYear();
  const month = String(china.getUTCMonth() + 1).padStart(2, "0");
  const day = String(china.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function holidayFor(date) {
  const key = chinaDateKey(date);
  const year = Number(key.slice(0, 4));
  return HOLIDAYS[year]?.find(holiday => key >= holiday.start && key <= holiday.end);
}
export function holidayCalendarStatus(date) {
  const key = chinaDateKey(date);
  const year = Number(key.slice(0, 4));
  const holidays = HOLIDAYS[year];
  if (!holidays) return "missing";
  return holidays.some(holiday => holiday.provisional) ? "provisional" : "official";
}
export function isPeak(date) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  if (holidayFor(date)) return false;
  const hour = date.getUTCHours();
  return PEAK_WINDOWS_UTC.some(([start, end]) => hour >= start && hour < end);
}
export function billingState(date) {
  if (holidayFor(date)) return "holiday";
  return isPeak(date) ? "peak" : "off-peak";
}
export function nextPeakChange(from) {
  const current = isPeak(from);
  const cursor = new Date(from);
  cursor.setUTCMinutes(0, 0, 0);
  cursor.setUTCHours(cursor.getUTCHours() + 1);
  for (let i = 0; i < MAX_CHANGE_SCAN_HOURS; i++) {
    if (isPeak(cursor) !== current) return cursor;
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  return undefined;
}
export function countdown(date, from) {
  const minutes = Math.max(1, Math.ceil((date.getTime() - from.getTime()) / 60_000));
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor(minutes % 1_440 / 60);
  const rest = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return hours > 0 ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${rest}m`;
}
export function formatChangeTime(date, from = new Date(), options = {}) {
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const sameDay = dayFormatter.format(date) === dayFormatter.format(from);
  return new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timeZone,
    weekday: sameDay ? undefined : "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
//# sourceMappingURL=peak.js.map