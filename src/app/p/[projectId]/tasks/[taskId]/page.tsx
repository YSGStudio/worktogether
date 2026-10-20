import { notFound } from "next/navigation";
import { addLink, uploadAttachment } from "@/actions/attachments";
import { deleteTask, updateTask } from "@/actions/tasks";
import { ActionForm } from "@/components/ActionForm";
import { AttachmentList } from "@/components/AttachmentList";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatusToggle } from "@/components/StatusToggle";
import { TaskForm } from "@/components/TaskForm";
import { BackLink, btn, Card, Field, formatRange, input, OverdueBadge, SectionTitle } from "@/components/ui";
import { isOverdue, todayKST } from "@/lib/domain/dates";
import { canChangeStatus, canEditScope } from "@/lib/domain/scope";
import { toGalleryItems } from "@/lib/gallery";
import { editableScopes, loadProject, nameMap, scopeLabel } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { loadAttachments } from "@/lib/workspace";
import { assigneeLabel, withAssignees } from "@/lib/assignees";
import type { Task } from "@/lib/types";

export default async function TaskDetail({ params }: PageProps<"/p/[projectId]/tasks/[taskId]">) {
  const { projectId, taskId } = await params;
  const ctx = await loadProject(projectId);
  const supabase = await createClient();
  // 볼 수 없는 범위의 할 일은 RLS가 막아 404가 된다(다른 모둠 할 일 직접 링크 포함)
  const { data } = await supabase.from("tasks").select("*").eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (!data) notFound();
  const [task] = await withAssignees(supabase, [data as Task]);
  const names = nameMap(ctx);
  const items = await toGalleryItems(await loadAttachments([task.id]), [task], names);
  const canEdit = canEditScope(ctx.scope, task.group_id);
  const canStatus = canChangeStatus(ctx.scope, task, ctx.me.id);
  const scopes = editableScopes(ctx);
  // 모둠장이 수정할 때는 소속이 고정된다
  const formScopes = ctx.scope.isTeacher || ctx.scope.isProjectLeader ? scopes : scopes.filter((s) => s.groupId === task.group_id);
  const today = todayKST();
  const base = `/p/${projectId}`;

  return (
    <>
      <BackLink href={`${base}/tasks`}>할 일 목록</BackLink>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <p className="text-sm text-stone-500">{scopeLabel(ctx, task.group_id)}</p>
            <h2 className="text-2xl font-bold break-words">{task.title}</h2>
            <p className="mt-1 text-stone-700">
              담당 {assigneeLabel(task, names)} · {formatRange(task.start_date, task.due_date)}{" "}
              {isOverdue(task, today) && <OverdueBadge />}
            </p>
            {task.description && <p className="mt-3 whitespace-pre-wrap break-words">{task.description}</p>}
            <div className="mt-4">
              <StatusToggle taskId={task.id} status={task.status} canChange={canStatus} />
              {!canStatus && <p className="mt-1 text-xs text-stone-500">상태는 담당자와 팀장·모둠장, 선생님이 바꿀 수 있어요.</p>}
            </div>
          </Card>

          <Card>
            <SectionTitle>결과물</SectionTitle>
            <AttachmentList items={items} meId={ctx.me.id} isTeacher={ctx.scope.isTeacher} />
            {canStatus && (
              <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
                <ActionForm action={uploadAttachment.bind(null, task.id)} resetOnSuccess className="space-y-2">
                  <Field label="파일 올리기" hint="PDF, 이미지(PNG·JPG·WEBP·GIF), 10MB 이하. 개인정보가 담긴 사진은 올리지 마세요.">
                    <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/png,image/jpeg,image/webp,image/gif" className="block w-full text-sm" />
                  </Field>
                  <button className={btn.primary}>올리기</button>
                </ActionForm>
                <ActionForm action={addLink.bind(null, task.id)} resetOnSuccess className="space-y-2">
                  <Field label="링크 올리기">
                    <input name="url" type="url" required placeholder="https://" className={input} />
                  </Field>
                  <input name="title" maxLength={200} placeholder="링크 이름 (선택)" className={input} aria-label="링크 이름" />
                  <button className={btn.secondary}>링크 추가</button>
                </ActionForm>
              </div>
            )}
          </Card>
        </div>

        {canEdit && (
          <Card>
            <SectionTitle>할 일 고치기</SectionTitle>
            <TaskForm action={updateTask.bind(null, task.id)} scopes={formScopes} task={task} range={{ start: ctx.project.start_date, end: ctx.project.end_date }} submitLabel="저장" />
            <div className="mt-4 border-t pt-4">
              <ConfirmButton action={deleteTask.bind(null, task.id, `${base}/tasks`)} confirm="이 할 일을 지울까요? 올린 결과물도 함께 지워져요.">
                할 일 삭제
              </ConfirmButton>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
