import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import type { GalleryItem } from "@/components/AttachmentGallery";
import type { Attachment, Task } from "@/lib/types";

// 첨부에 열람 주소를 붙인다: 파일은 서명 URL(1시간), 링크는 원래 주소
export async function toGalleryItems(attachments: Attachment[], tasks: Pick<Task, "id" | "title">[], names: Record<string, string>): Promise<GalleryItem[]> {
  const supabase = await createClient();
  const urls = await signedUrls(supabase, attachments.filter((a) => a.storage_path).map((a) => a.storage_path as string));
  const titles = Object.fromEntries(tasks.map((t) => [t.id, t.title]));
  return attachments.map((a) => ({
    ...a,
    href: a.kind === "link" ? a.url : urls[a.storage_path ?? ""] ?? null,
    taskTitle: titles[a.task_id] ?? "",
    uploaderName: (a.uploaded_by && names[a.uploaded_by]) || "(방을 나간 학생)",
  }));
}
