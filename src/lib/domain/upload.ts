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

export const MAX_FILES = 10;
export const MAX_LINKS = 10;

export type LinksCheck = { ok: true; links: { url: string; title: string }[] } | { ok: false; error: string };

// 링크 여러 개: 주소와 이름이 모두 빈 칸은 건너뛰고, 이름 없이 주소만 있으면 도메인을 이름으로 쓴다
export function validateLinks(rows: { url: string; title: string }[]): LinksCheck {
  const filled = rows.map((r) => ({ url: r.url.trim(), title: r.title.trim() })).filter((r) => r.url || r.title);
  if (filled.length === 0) return { ok: false, error: "링크 주소를 입력하세요" };
  if (filled.length > MAX_LINKS) return { ok: false, error: `링크는 한 번에 ${MAX_LINKS}개까지 올릴 수 있어요` };
  const links: { url: string; title: string }[] = [];
  for (const [i, r] of filled.entries()) {
    const link = validateLink(r.url);
    if (!link.ok) return { ok: false, error: filled.length > 1 ? `${i + 1}번째 링크: ${link.error}` : link.error };
    links.push({ url: link.url, title: (r.title || new URL(link.url).hostname).slice(0, 200) });
  }
  return { ok: true, links };
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 200) || "file";
}

export const MAX_TEXT_RESULT = 5000;

export type TextResultCheck = { ok: true; title: string; body: string } | { ok: false; error: string };

// 글 결과물: 제목을 비우면 본문 첫 줄(40자)을 제목으로 쓴다
export function validateTextResult(input: { title: string; body: string }): TextResultCheck {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "결과물 내용을 적어 주세요" };
  if (body.length > MAX_TEXT_RESULT) return { ok: false, error: `글은 ${MAX_TEXT_RESULT}자 이하로 적어 주세요` };
  const firstLine = body.split("\n")[0].trim();
  const title = (input.title.trim() || (firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine)).slice(0, 200);
  return { ok: true, title, body };
}
