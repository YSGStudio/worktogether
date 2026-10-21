import { deleteAttachment } from "@/actions/attachments";
import type { GalleryItem } from "./AttachmentGallery";
import { ConfirmButton } from "./ConfirmButton";
import { btn, formatDateTime } from "./ui";

const KIND = { image: "이미지", pdf: "PDF", link: "링크", text: "글" } as const;

// 첨부 목록: 종류, 이름, 올린 사람, 올린 시각. 올린 사람과 교사는 지울 수 있다.
export function AttachmentList({ items, meId, isTeacher }: { items: GalleryItem[]; meId: string; isTeacher: boolean }) {
  if (items.length === 0) return <p className="text-sm text-stone-500">아직 결과물이 없어요</p>;
  return (
    <ul className="divide-y divide-stone-100" data-testid="attachment-list">
      {items.map((a) => (
        <li key={a.id} className={`flex flex-col gap-1 py-2 sm:flex-row sm:justify-between ${a.kind === "text" ? "sm:items-start" : "sm:items-center"}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {a.kind === "image" && a.href && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.href} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            )}
            <div className="min-w-0">
              {a.kind === "text" ? (
                <>
                  <p className="font-semibold break-words text-[#24253a]">
                    <span className="mr-1 text-xs text-stone-500">[{KIND[a.kind]}]</span>
                    {a.file_name}
                  </p>
                  <p className="mt-1 rounded-lg bg-[#f7f8fb] px-3 py-2 text-sm whitespace-pre-wrap break-words text-stone-800">{a.body}</p>
                </>
              ) : (
                <a href={a.href ?? "#"} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-blue-800 hover:underline">
                  <span className="mr-1 text-xs text-stone-500">[{KIND[a.kind]}]</span>
                  {a.file_name}
                </a>
              )}
              <p className="text-xs text-stone-500">
                {a.uploaderName} · {formatDateTime(a.created_at)}
                {a.size_bytes ? ` · ${(a.size_bytes / 1024 / 1024).toFixed(1)}MB` : ""}
              </p>
            </div>
          </div>
          {(a.uploaded_by === meId || isTeacher) && (
            <ConfirmButton action={deleteAttachment.bind(null, a.id)} confirm={`"${a.file_name}"을(를) 지울까요?`} className={btn.danger}>
              삭제
            </ConfirmButton>
          )}
        </li>
      ))}
    </ul>
  );
}
