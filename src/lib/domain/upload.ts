export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, { mime: string[]; kind: "pdf" | "image" }> = {
  pdf: { mime: ["application/pdf"], kind: "pdf" },
  png: { mime: ["image/png"], kind: "image" },
  jpg: { mime: ["image/jpeg"], kind: "image" },
  jpeg: { mime: ["image/jpeg"], kind: "image" },
  webp: { mime: ["image/webp"], kind: "image" },
  gif: { mime: ["image/gif"], kind: "image" },
};

export type UploadCheck =
  | { ok: true; kind: "pdf" | "image"; ext: string; mime: string }
  | { ok: false; error: string };

export function validateUpload(file: { name: string; size: number; type: string }): UploadCheck {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const rule = ALLOWED[ext];
  if (!rule) return { ok: false, error: "PDF나 이미지(PNG, JPG, WEBP, GIF)만 올릴 수 있어요" };
  if (file.type && !rule.mime.includes(file.type)) {
    return { ok: false, error: "파일 형식이 확장자와 맞지 않아요" };
  }
  if (file.size <= 0) return { ok: false, error: "빈 파일은 올릴 수 없어요" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "파일은 10MB 이하만 올릴 수 있어요" };
  return { ok: true, kind: rule.kind, ext: ext === "jpeg" ? "jpg" : ext, mime: rule.mime[0] };
}

export type LinkCheck = { ok: true; url: string } | { ok: false; error: string };

export function validateLink(input: string): LinkCheck {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "링크 주소를 바르게 입력하세요 (https://로 시작)" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "http 또는 https 링크만 올릴 수 있어요" };
  }
  if (raw.length > 2000) return { ok: false, error: "링크가 너무 길어요" };
  return { ok: true, url: url.toString() };
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 200) || "file";
}
