import { createHmac } from "node:crypto";

const PIN_RE = /^\d{4}$/;

// 학생 등록·비밀번호 재설정 때 따로 정하지 않으면 쓰는 처음 비밀번호
export const DEFAULT_PIN = "1234";

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin);
}

// Supabase Auth 비밀번호 최소 길이 때문에 PIN 대신 HMAC 값을 비밀번호로 쓴다.
export function pinToPassword(studentId: string, pin: string, pepper: string): string {
  if (!pepper) throw new Error("STUDENT_PIN_PEPPER가 설정되지 않았어요");
  return createHmac("sha256", pepper).update(`${studentId}:${pin}`).digest("hex");
}

export function studentAuthEmail(studentId: string): string {
  return `${studentId}@student.local`;
}
