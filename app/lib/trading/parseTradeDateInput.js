export function parseTradeDateInput(value, allowDateOnly = false) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const hasTime = digits.length === 11 || digits.length === 12;
  if (![7, 8, 11, 12].includes(digits.length) || (!allowDateOnly && !hasTime)) return null;

  const shortDay = digits.length === 7 || digits.length === 11;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, shortDay ? 7 : 8));
  const timeStart = shortDay ? 7 : 8;
  const hour = hasTime ? Number(digits.slice(timeStart, timeStart + 2)) : 0;
  const minute = hasTime ? Number(digits.slice(timeStart + 2, timeStart + 4)) : 0;
  const checked = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    year < 2000 ||
    year > 2100 ||
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() + 1 !== month ||
    checked.getUTCDate() !== day ||
    checked.getUTCHours() !== hour ||
    checked.getUTCMinutes() !== minute
  ) {
    return null;
  }
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return hasTime ? `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : date;
}
