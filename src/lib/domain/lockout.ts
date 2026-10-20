export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 10;
export const IP_LIMIT_PER_MINUTE = 30;

export type AttemptKind = "fail" | "success" | "unlock";
export type Attempt = { kind: AttemptKind; at: Date };

export type LockState = { locked: boolean; until: Date | null; failures: number };

// 시간순 시도 기록으로 잠금 여부를 계산한다.
// 연속 실패가 5번이 되면 그 시각부터 10분 잠기고, 잠금이 끝나면 다시 0부터 센다.
// 성공이나 교사의 잠금 해제는 연속 실패를 지운다.
export function computeLockState(attempts: Attempt[], now: Date): LockState {
  const sorted = [...attempts].sort((a, b) => a.at.getTime() - b.at.getTime());
  let failures = 0;
  let lockedUntil: Date | null = null;
  for (const a of sorted) {
    if (a.kind !== "fail") {
      failures = 0;
      lockedUntil = null;
      continue;
    }
    if (lockedUntil && a.at < lockedUntil) continue; // 잠긴 동안의 시도는 세지 않는다
    if (lockedUntil && a.at >= lockedUntil) {
      lockedUntil = null;
      failures = 0;
    }
    failures++;
    if (failures >= MAX_FAILURES) {
      lockedUntil = new Date(a.at.getTime() + LOCK_MINUTES * 60_000);
    }
  }
  if (lockedUntil && now < lockedUntil) {
    return { locked: true, until: lockedUntil, failures };
  }
  return { locked: false, until: null, failures: lockedUntil ? 0 : failures };
}

export function isIpLimited(recentAttemptsInLastMinute: number): boolean {
  return recentAttemptsInLastMinute >= IP_LIMIT_PER_MINUTE;
}
