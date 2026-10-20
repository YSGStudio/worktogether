import { daysBetween } from "./dates";

export type Bar = { leftPct: number; widthPct: number; clippedStart: boolean; clippedEnd: boolean };

// 방 기간(rangeStart~rangeEnd, 양끝 포함)을 0~100%로 보고 할 일 막대 위치를 계산한다.
// 시작일이나 마감일 하나만 있으면 그 하루짜리 막대로 그린다. 둘 다 없으면 null(날짜 미정).
export function computeBar(
  rangeStart: string,
  rangeEnd: string,
  start: string | null,
  due: string | null,
): Bar | null {
  const s = start ?? due;
  const e = due ?? start;
  if (!s || !e) return null;
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  if (totalDays <= 0) return null;
  let from = daysBetween(rangeStart, s);
  let to = daysBetween(rangeStart, e) + 1;
  const clippedStart = from < 0;
  const clippedEnd = to > totalDays;
  from = Math.max(0, from);
  to = Math.min(totalDays, to);
  if (to <= from) return null;
  return {
    leftPct: (from / totalDays) * 100,
    widthPct: ((to - from) / totalDays) * 100,
    clippedStart,
    clippedEnd,
  };
}

// 오늘 세로선 위치(그날의 가운데). 기간 밖이면 null.
export function todayPosition(rangeStart: string, rangeEnd: string, today: string): number | null {
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const idx = daysBetween(rangeStart, today);
  if (idx < 0 || idx >= totalDays) return null;
  return ((idx + 0.5) / totalDays) * 100;
}

// 가로축 눈금: 날짜 수에 맞춰 간격을 넓힌다.
export function axisTicks(rangeStart: string, rangeEnd: string, maxTicks = 10): { date: string; pct: number }[] {
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const step = Math.max(1, Math.ceil(totalDays / maxTicks));
  const ticks: { date: string; pct: number }[] = [];
  for (let i = 0; i < totalDays; i += step) {
    const d = new Date(Date.parse(`${rangeStart}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    ticks.push({ date: d, pct: (i / totalDays) * 100 });
  }
  return ticks;
}
