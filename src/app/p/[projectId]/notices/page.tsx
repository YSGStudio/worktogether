import { addComment, createNotice, deleteComment, deleteNotice, updateComment, updateNotice } from "@/actions/notices";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { GroupTabs, UnassignedNotice } from "@/components/GroupTabs";
import { btn, Card, Empty, Field, formatDateTime, input, SectionTitle } from "@/components/ui";
import { canEditScope } from "@/lib/domain/scope";
import { editableScopes, loadProject, nameMap, resolveView, scopeLabel } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { loadNotices } from "@/lib/workspace";
import type { NoticeComment } from "@/lib/types";

export default async function NoticesPage({ params, searchParams }: PageProps<"/p/[projectId]/notices">) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const ctx = await loadProject(projectId);
  const v = resolveView(ctx, typeof view === "string" ? view : undefined);
  const notices = await loadNotices(ctx, v);
  const supabase = await createClient();
  const { data: commentRows } = notices.length
    ? await supabase.from("notice_comments").select("*").in("notice_id", notices.map((n) => n.id)).order("created_at")
    : { data: [] };
  const comments = (commentRows ?? []) as NoticeComment[];
  const names = nameMap(ctx);
  const scopes = editableScopes(ctx);
  const canModerate = ctx.scope.isTeacher || ctx.scope.isProjectLeader;
  const unassigned = ctx.kind === "grouped" && ctx.scope.isMember && !ctx.scope.myGroupId && !canModerate;

  return (
    <>
      <GroupTabs ctx={ctx} basePath={`/p/${projectId}/notices`} view={v} />
      {unassigned && <UnassignedNotice />}
      <div className={`grid gap-4 ${scopes.length ? "lg:grid-cols-[1fr_360px]" : ""}`}>
        <div className="space-y-4">
          {notices.length === 0 && <Empty>공지가 없어요</Empty>}
          {notices.map((n) => {
            const canEdit = canEditScope(ctx.scope, n.group_id);
            const list = comments.filter((c) => c.notice_id === n.id);
            return (
              <Card key={n.id}>
                <article id={`notice-${n.id}`}>
                  <p className="text-xs text-stone-500">
                    {scopeLabel(ctx, n.group_id)} · {(n.author_id && names[n.author_id]) || "(알 수 없음)"} · {formatDateTime(n.created_at)}
                  </p>
                  <h2 className="text-lg font-bold break-words">{n.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap break-words">{n.body}</p>
                  {canEdit && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-blue-700">공지 고치기·지우기</summary>
                      <ActionForm action={updateNotice.bind(null, n.id)} className="mt-2 space-y-2">
                        <input name="title" defaultValue={n.title} required maxLength={100} className={input} aria-label="제목" />
                        <textarea name="body" defaultValue={n.body} required rows={3} maxLength={5000} className={input} aria-label="내용" />
                        <button className={btn.secondary}>저장</button>
                      </ActionForm>
                      <div className="mt-2">
                        <ConfirmButton action={deleteNotice.bind(null, n.id)} confirm="이 공지를 지울까요? 댓글도 함께 지워져요.">
                          공지 삭제
                        </ConfirmButton>
                      </div>
                    </details>
                  )}

                  <div className="mt-4 border-t pt-3">
                    <h3 className="mb-2 text-sm font-bold">댓글 {list.length}</h3>
                    <ul className="space-y-2">
                      {list.map((c) => (
                        <li key={c.id} className="rounded-md bg-stone-50 p-2">
                          <p className="text-xs text-stone-500">
                            {(c.author_id && names[c.author_id]) || "(알 수 없음)"} · {formatDateTime(c.created_at)}
                            {c.updated_at !== c.created_at && " (고침)"}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{c.body}</p>
                          <div className="mt-1 flex flex-wrap items-start gap-2">
                            {c.author_id === ctx.me.id && (
                              <details>
                                <summary className="cursor-pointer text-xs text-blue-700">고치기</summary>
                                <ActionForm action={updateComment.bind(null, c.id)} className="mt-1 flex gap-1">
                                  <input name="body" defaultValue={c.body} required maxLength={1000} className={`${input} py-1 text-sm`} aria-label="댓글 고치기" />
                                  <button className={btn.small}>저장</button>
                                </ActionForm>
                              </details>
                            )}
                            {(c.author_id === ctx.me.id || canModerate) && (
                              <ConfirmButton action={deleteComment.bind(null, c.id)} confirm="댓글을 지울까요?" className="text-xs text-red-700 hover:underline">
                                지우기
                              </ConfirmButton>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <ActionForm action={addComment.bind(null, n.id)} resetOnSuccess className="mt-2 flex gap-2">
                      <input name="body" required maxLength={1000} placeholder="댓글 쓰기" className={input} aria-label="댓글" />
                      <button className={`${btn.secondary} shrink-0`}>등록</button>
                    </ActionForm>
                  </div>
                </article>
              </Card>
            );
          })}
        </div>
        {scopes.length > 0 && (
          <Card>
            <SectionTitle>공지 쓰기</SectionTitle>
            <ActionForm action={createNotice.bind(null, projectId)} resetOnSuccess className="space-y-3">
              {scopes.length > 1 ? (
                <Field label="누구에게">
                  <select name="group_id" className={input} defaultValue="">
                    {scopes.map((s) => (
                      <option key={s.groupId ?? "common"} value={s.groupId ?? ""}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <input type="hidden" name="group_id" value={scopes[0].groupId ?? ""} />
              )}
              <Field label="제목">
                <input name="title" required maxLength={100} className={input} />
              </Field>
              <Field label="내용">
                <textarea name="body" required rows={4} maxLength={5000} className={input} />
              </Field>
              <button className={btn.primary}>올리기</button>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
