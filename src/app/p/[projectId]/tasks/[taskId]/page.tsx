import { notFound } from "next/navigation";
import { addLink, addTextResult, uploadAttachment } from "@/actions/attachments";
import { deleteTask, updateTask } from "@/actions/tasks";
import { ActionForm } from "@/components/ActionForm";
import { AttachmentList } from "@/components/AttachmentList";
import { ConfirmButton } from "@/components/ConfirmButton";
import { FileUploadForm } from "@/components/FileUploadForm";
import { LinkRows } from "@/components/LinkRows";
import { StatusToggle } from "@/components/StatusToggle";
import { TaskForm } from "@/components/TaskForm";
import { BackLink, btn, Card, Field, formatRange, input, OverdueBadge, SectionTitle } from "@/components/ui";
import { isOverdue, todayKST } from "@/lib/domain/dates";
import { MAX_TEXT_RESULT } from "@/lib/domain/upload";
import { canChangeStatus, canEditScope } from "@/lib/domain/scope";
import { toGalleryItems } from "@/lib/gallery";
import { editableScopes, loadProject, nameMap, scopeLabel } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { loadAttachments } from "@/lib/workspace";
import { assigneeLabel, fromTaskRows, TASK_WITH_ASSIGNEES } from "@/lib/assignees";

export default async function TaskDetail({ params }: PageProps<"/p/[projectId]/tasks/[taskId]">) {
  const { projectId, taskId } = await params;
  const ctx = await loadProject(projectId);
  const supabase = await createClient();
  // 볼 수 없는 범위의 할 일은 RLS가 막아 404가 된다(다른 모둠 할 일 직접 링크 포함)
  const [{ data }, attachments] = await Promise.all([
    supabase.from("tasks").select(TASK_WITH_ASSIGNEES).eq("id", taskId).eq("project_id", projectId).maybeSingle(),
    loadAttachments([taskId]),
  ]);
  if (!data) notFound();
  const [task] = fromTaskRows([data]);
  const names = nameMap(ctx);
  // 글을 먼저 읽도록 글 결과물을 위로 올린다(같은 종류 안에서는 원래 순서 유지)
  const items = (await toGalleryItems(attachments, [task], names)).sort((a, b) => Number(b.kind === "text") - Number(a.kind === "text"));
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
            <SectionTitle>올린 결과물</SectionTitle>
            <AttachmentList items={items} meId={ctx.me.id} isTeacher={ctx.scope.isTeacher} />
          </Card>

          {canStatus && (
            <Card>
              <SectionTitle>내 결과물 올리기</SectionTitle>
              <ActionForm action={addTextResult.bind(null, task.id)} resetOnSuccess className="space-y-3">
                <Field label="글로 남기기" hint={`한 일, 알게 된 점, 조사 내용 등을 적어 주세요. ${MAX_TEXT_RESULT}자 이하.`}>
                  <textarea name="body" required rows={7} maxLength={MAX_TEXT_RESULT} placeholder="오늘 한 일과 결과를 적어 주세요" className={`${input} resize-y`} />
                </Field>
                <input name="title" maxLength={200} placeholder="제목 (비우면 첫 줄이 제목이 돼요)" className={input} aria-label="글 제목" />
                <button className={btn.primary}>글 올리기</button>
              </ActionForm>

              <div className="mt-5 grid gap-4 border-t border-stone-200 pt-5 md:grid-cols-2">
                <FileUploadForm action={uploadAttachment.bind(null, task.id)} className="space-y-3 rounded-xl bg-[#f8f8fc] p-4" />
                <ActionForm action={addLink.bind(null, task.id)} resetOnSuccess className="space-y-3 rounded-xl bg-[#f8f8fc] p-4">
                  <p className="text-sm font-extrabold text-[#4c4f68]">링크 첨부</p>
                  <LinkRows />
                  <button className={btn.secondary}>링크 올리기</button>
                </ActionForm>
              </div>
            </Card>
          )}
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
