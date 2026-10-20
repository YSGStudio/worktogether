type PgError = { code?: string; message?: string } | null | undefined;

// DB 오류를 학생·교사가 읽을 수 있는 문구로 바꾼다. 트리거(P0001)는 이미 한국어 문구를 담고 있다.
export function friendlyError(error: PgError, fallback = "저장하지 못했어요. 다시 시도해 주세요."): string {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) return "권한이 없어요";
  if (error.code === "23505") return "이미 있는 값이에요";
  if (error.code === "23514") return "입력한 값을 확인해 주세요";
  if (error.code === "23503") return "연결된 항목을 찾을 수 없어요";
  return fallback;
}
