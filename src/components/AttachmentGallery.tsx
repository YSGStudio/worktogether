import Link from "next/link";
import type { Attachment } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { formatDateTime } from "./ui";

export type GalleryItem = Attachment & { href: string | null; taskTitle: string; uploaderName: string };

const KIND_LABEL = { image: "이미지", pdf: "PDF", link: "링크", text: "글" } as const;

// 자료 모음: 이미지는 썸네일, PDF·링크는 아이콘. 할 일별·종류별 필터는 쿼리스트링으로.
export function AttachmentGallery({
  items,
  tasks,
  basePath,
  filter,
}: {
  items: GalleryItem[];
  tasks: { id: string; title: string }[];
  basePath: string;
  filter: { task?: string; kind?: string; view?: string };
}) {
  const shown = items.filter((i) => (!filter.task || i.task_id === filter.task) && (!filter.kind || i.kind === filter.kind));
  const withTaskIds = new Set(items.map((i) => i.task_id));
  return (
    <div>
      <form method="get" action={basePath} className="mb-3 flex flex-wrap items-end gap-2">
        {filter.view && <input type="hidden" name="view" value={filter.view} />}
        <label className="text-sm">
          <span className="mr-1 font-semibold">할 일</span>
          <select name="task" defaultValue={filter.task ?? ""} className="max-w-[12rem] rounded-md border border-stone-300 px-2 py-1">
            <option value="">전체</option>
            {tasks.filter((t) => withTaskIds.has(t.id)).map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mr-1 font-semibold">종류</span>
          <select name="kind" defaultValue={filter.kind ?? ""} className="rounded-md border border-stone-300 px-2 py-1">
            <option value="">전체</option>
            <option value="image">이미지</option>
            <option value="pdf">PDF</option>
            <option value="link">링크</option>
            <option value="text">글</option>
          </select>
        </label>
        <button className="rounded-md border border-stone-300 bg-white px-3 py-1 text-sm">거르기</button>
      </form>
      {shown.length === 0 ? (
        <p className="text-sm text-stone-500">올라온 자료가 없어요</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="gallery">
          {shown.map((a) => (
            <li key={a.id} className="min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {a.kind === "text" ? (
                // 글은 할 일 화면에서 전체를 읽는다
                <Link href={`${basePath.replace(/\/$/, "")}/tasks/${a.task_id}`} className="block h-28 overflow-hidden bg-[#f7f8fb] p-2 text-xs whitespace-pre-wrap break-words text-stone-700 hover:bg-[#f0f1ff]">
                  {a.body}
                </Link>
              ) : (
              <a href={a.href ?? "#"} target="_blank" rel="noopener noreferrer" className="block">
                {a.kind === "image" && a.href ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.href} alt={a.file_name} className="h-28 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-stone-50 text-3xl" aria-hidden>
                    {a.kind === "pdf" ? "📄" : "🔗"}
                  </div>
                )}
              </a>
              )}
              <div className="p-2 text-xs">
                <p className="truncate font-semibold" title={a.file_name}>
                  <span className="mr-1 text-stone-500">[{KIND_LABEL[a.kind]}]</span>
                  {a.file_name}
                </p>
                <p className="truncate text-stone-500">
                  <Link href={`${basePath.replace(/\/$/, "")}/tasks/${a.task_id}`} className="hover:underline">
                    {a.taskTitle}
                  </Link>
                </p>
                <p className="truncate text-stone-500">
                  {a.uploaderName} · {formatDateTime(a.created_at)}
                </p>
                {a.kind === "text" && a.body && (
                  <div className="mt-1.5">
                    <CopyButton text={a.body} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
