// 학급코드: 학생이 쉽게 입력하도록 숫자 6자리. 이전에 발급한 영문·숫자 코드(0/O/1/I 제외)도 로그인에는 계속 쓸 수 있다.
export const CLASS_CODE_LENGTH = 6;
const NUMERIC_RE = /^\d{6}$/;
const LEGACY_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function generateClassCode(randomInt: (max: number) => number = defaultRandomInt): string {
  return String(randomInt(10 ** CLASS_CODE_LENGTH)).padStart(CLASS_CODE_LENGTH, "0");
}

export function normalizeClassCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function isValidClassCode(code: string): boolean {
  return NUMERIC_RE.test(code) || LEGACY_RE.test(code);
}

function defaultRandomInt(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}
