import { differenceInCalendarDays, format, isPast, startOfDay } from "date-fns";

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDate(date?: Date | null) {
  return date ? format(date, "MMM d, yyyy") : "-";
}

export function daysInclusive(start?: Date | null, end = new Date()) {
  if (!start) return 0;
  return Math.max(1, differenceInCalendarDays(startOfDay(end), startOfDay(start)) + 1);
}

export function daysRemaining(end?: Date | null, today = new Date()) {
  if (!end) return 0;
  return differenceInCalendarDays(startOfDay(end), startOfDay(today));
}

export function isDateOverdue(date?: Date | null) {
  if (!date) return false;
  return isPast(startOfDay(date)) && differenceInCalendarDays(startOfDay(new Date()), startOfDay(date)) > 0;
}
