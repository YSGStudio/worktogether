export const MAX_NAME_LENGTH = 30;

export type ParsedNames = {
  names: string[];
  duplicates: string[];
  invalid: string[];
};

// 줄바꿈·쉼표·탭으로 나뉜 이름 목록을 읽는다.
export function parseNameList(text: string): ParsedNames {
  const seen = new Set<string>();
  const names: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\n,\t]+/)) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (name.length > MAX_NAME_LENGTH) {
      invalid.push(name);
      continue;
    }
    if (seen.has(name)) {
      if (!duplicates.includes(name)) duplicates.push(name);
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return { names, duplicates, invalid };
}
