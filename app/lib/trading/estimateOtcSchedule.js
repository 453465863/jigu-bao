import dayjs from 'dayjs';
import { isTradingDay } from '../tradingCalendar.js';

const nextTradingDay = (date) => {
  let current = date;
  for (let i = 0; i < 20; i++) {
    if (isTradingDay(current)) return current;
    current = current.add(1, 'day');
  }
  return null;
};

export function estimateOtcSchedule(requestAt, confirmDays) {
  const submitted = dayjs(requestAt);
  if (!submitted.isValid()) return { estimatedNavDate: null, estimatedConfirmDate: null };
  const afterCutoff = submitted.hour() >= 15;
  const navDate = nextTradingDay(submitted.startOf('day').add(afterCutoff ? 1 : 0, 'day'));
  if (!navDate) return { estimatedNavDate: null, estimatedConfirmDate: null };
  const days = Number(confirmDays);
  if (!Number.isInteger(days) || days < 1 || days > 10) {
    return { estimatedNavDate: navDate.format('YYYY-MM-DD'), estimatedConfirmDate: null };
  }
  let confirmDate = navDate;
  for (let i = 0; i < days; i++) {
    confirmDate = nextTradingDay(confirmDate.add(1, 'day'));
    if (!confirmDate) break;
  }
  return {
    estimatedNavDate: navDate.format('YYYY-MM-DD'),
    estimatedConfirmDate: confirmDate?.format('YYYY-MM-DD') || null
  };
}
