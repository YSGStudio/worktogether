import Link from "next/link";
import {
  addProjectMembers,
  createGroup,
  deleteGroup,
  deleteProject,
  removeProjectMember,
  renameGroup,
  setGroupLeader,
  setGroupMember,
  setProjectLeaders,
  updateProject,
} from "@/actions/projects";
import { ActionForm } from "@/components/ActionForm";
import { LeaderCheckboxes } from "@/components/RoomCreateForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Badge, btn, Card, Empty, Field, input, SectionTitle } from "@/components/ui";
import { loadProject, workspaceMembers } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

export default async function MembersPage({ params }: PageProps<"/p/[projectId]/members">) {
  const { projectId } = await params;
  const ctx = await loadProject(projectId);
  const { scope, project, topic, groups, members } = ctx;
  const isTeacher = scope.isTeacher;
  const groupName = (id: string | undefined) => groups.find((g) => g.id === id)?.name;
  const studentHref = (id: string) => `/teacher/topics/${topic.id}/students/${id}`;

  // 교사: 학급 학생 중 추가할 수 있는 학생, 이미 다른 방에 있으면 "○○방 소속"으로 비활성
  let candidates: { id: string; name: string; otherRoom: string | null }[] = [];
  let leaderChoices: { id: string; name: string }[] = [];
  if (isTeacher) {
    const supabase = await createClient();
    const [{ data: students }, { data: taken }, { data: leaders }] = await Promise.all([
      supabase.from("profiles").select("id, name").eq("class_id", topic.class_id).order("name"),
      supabase.from("project_members").select("student_id, projects(name)").eq("topic_id", topic.id),
      supabase.from("topic_leaders").select("student_id").eq("topic_id", topic.id),
    ]);
    const roomOf = new Map((taken ?? []).map((t) => [t.student_id as string, (t.projects as unknown as { name: string } | null)?.name ?? "다른 방"]));
    const memberIds = new Set(members.map((m) => m.id));
    candidates = (students ?? [])
      .filter((s) => !memberIds.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, otherRoom: roomOf.get(s.id) ?? null }));
    const nameOf = new Map((students ?? []).map((s) => [s.id, s.name]));
    // 공동 팀장 후보: 주제 팀장 중 이 방 구성원이거나 아직 어느 방에도 없는 학생
    leaderChoices = (leaders ?? [])
      .map((l) => l.student_id as string)
      .filter((id) => memberIds.has(id) || !roomOf.has(id))
      .map((id) => ({ id, name: nameOf.get(id) ?? "?" }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle>구성원 {members.length}명</SectionTitle>
        {members.length === 0 ? (
          <Empty>아직 구성원이 없어요</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {members.map((m) => {
              const gid = ctx.groupOf[m.id];
              return (
                <li key={m.id} className="flex flex-col gap-2 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {isTeacher ? (
                      <Link href={studentHref(m.id)} className="font-semibold text-blue-800 hover:underline">{m.name}</Link>
                    ) : (
                      <span className="font-semibold">{m.name}</span>
                    )}
                    {ctx.leaderIds.includes(m.id) && <Badge tone="blue">팀장</Badge>}
                    {groups.some((g) => g.leader_id === m.id) && <Badge tone="violet">모둠장</Badge>}
                    {ctx.kind === "grouped" && (gid ? <Badge>{groupName(gid)}</Badge> : <Badge tone="amber">미배치</Badge>)}
                  </div>
                  {isTeacher && (
                    <div className="flex flex-wrap items-start gap-2">
                      {groups.length > 0 && (
                        <ActionForm action={setGroupMember.bind(null, projectId, m.id)} className="flex items-start gap-1">
                          <select name="group_id" defaultValue={gid ?? ""} className={`${input} w-32 py-1 text-sm`} aria-label={`${m.name} 모둠`}>
                            <option value="">미배치</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          <button className={btn.small}>모둠 바꾸기</button>
                        </ActionForm>
                      )}
                      <ConfirmButton
                        action={removeProjectMember.bind(null, projectId, m.id)}
                        confirm={`${m.name} 학생을 방에서 뺄까요? 맡은 할 일은 "미배정"이 돼요.`}
                      >
                        방에서 빼기
                      </ConfirmButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {isTeacher && groups.length > 0 && (
          <p className="mt-2 text-xs text-stone-500">학생을 다른 모둠으로 옮기면 이전 모둠에서 맡은 할 일은 &quot;미배정&quot;이 돼요.</p>
        )}
      </Card>

      {isTeacher && (
        <Card>
          <SectionTitle>학생 추가</SectionTitle>
          {candidates.length === 0 ? (
            <Empty>추가할 수 있는 학생이 없어요</Empty>
          ) : (
            <ActionForm action={addProjectMembers.bind(null, projectId)} className="space-y-3">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {candidates.map((c) => (
                  <label key={c.id} className={`flex items-center gap-2 rounded-md px-2 py-1 ${c.otherRoom ? "text-stone-400" : "hover:bg-stone-50"}`}>
                    <input type="checkbox" name="student_ids" value={c.id} disabled={!!c.otherRoom} className="h-4 w-4" />
                    <span className="truncate">{c.name}</span>
                    {c.otherRoom && <span className="truncate text-xs">({c.otherRoom} 소속)</span>}
                  </label>
                ))}
              </div>
              <button className={btn.primary}>고른 학생 추가</button>
            </ActionForm>
          )}
        </Card>
      )}

      {(isTeacher || ctx.kind === "grouped") && (
        <Card>
          <SectionTitle>모둠 {groups.length}개</SectionTitle>
          {ctx.kind === "whole" && <p className="mb-3 text-sm text-stone-600">모둠이 없으면 방 전체가 하나의 작업 공간이에요. 모둠을 만들면 지금 있는 할 일·공지는 &quot;방 공통&quot; 항목이 돼요.</p>}
          <ul className="space-y-3">
            {groups.map((g) => {
              const gm = workspaceMembers(ctx, g.id);
              return (
                <li key={g.id} className="rounded-lg border border-stone-200 p-3">
                  <p className="font-bold">
                    {g.name} <span className="text-sm font-normal text-stone-500">{gm.length}명 · 모둠장 {gm.find((m) => m.id === g.leader_id)?.name ?? "없음"}</span>
                  </p>
                  <p className="text-sm text-stone-600">{gm.map((m) => m.name).join(", ") || "아직 모둠원이 없어요"}</p>
                  {isTeacher && (
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      <ActionForm action={setGroupLeader.bind(null, g.id)} className="flex items-start gap-1">
                        <select name="leader_id" defaultValue={g.leader_id ?? ""} className={`${input} w-32 py-1 text-sm`} aria-label={`${g.name} 모둠장`}>
                          <option value="">모둠장 없음</option>
                          {gm.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <button className={btn.small}>모둠장 정하기</button>
                      </ActionForm>
                      <ActionForm action={renameGroup.bind(null, g.id)} className="flex items-start gap-1">
                        <input name="name" defaultValue={g.name} required maxLength={30} className={`${input} w-28 py-1 text-sm`} aria-label={`${g.name} 이름`} />
                        <button className={btn.small}>이름 바꾸기</button>
                      </ActionForm>
                      <ConfirmButton
                        action={deleteGroup.bind(null, g.id)}
                        confirm={`${g.name}을(를) 지울까요? 이 모둠의 할 일·공지는 지워지지 않고 "방 공통" 항목이 돼요.${groups.length === 1 ? " 마지막 모둠이라 방이 다시 하나의 작업 공간(전체 방)이 돼요." : ""}`}
                      >
                        모둠 삭제
                      </ConfirmButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {isTeacher && (
            <ActionForm action={createGroup.bind(null, projectId)} resetOnSuccess className="mt-3 flex gap-2">
              <input name="name" required maxLength={30} placeholder={`${groups.length + 1}모둠`} className={input} aria-label="새 모둠 이름" />
              <button className={`${btn.secondary} shrink-0`}>모둠 만들기</button>
            </ActionForm>
          )}
        </Card>
      )}

      {(isTeacher || scope.isProjectLeader) && (
        <Card>
          <SectionTitle>방 정보</SectionTitle>
          <ActionForm action={updateProject.bind(null, projectId)} className="space-y-3">
            <Field label="방 이름">
              <input name="name" required maxLength={50} defaultValue={project.name} className={input} />
            </Field>
            <Field label="설명">
              <textarea name="description" rows={2} defaultValue={project.description ?? ""} className={input} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="시작일">
                <input type="date" name="start_date" required min={topic.start_date} max={topic.end_date} defaultValue={project.start_date} className={input} />
              </Field>
              <Field label="종료일">
                <input type="date" name="end_date" required min={topic.start_date} max={topic.end_date} defaultValue={project.end_date} className={input} />
              </Field>
            </div>
            <button className={btn.primary}>저장</button>
          </ActionForm>
          {isTeacher && (
            <>
              <ActionForm action={setProjectLeaders.bind(null, projectId)} className="mt-4 space-y-2 border-t pt-4">
                <LeaderCheckboxes choices={leaderChoices} selected={ctx.leaderIds} />
                <button className={btn.secondary}>팀장 저장</button>
              </ActionForm>
              <div className="mt-4 border-t pt-4">
                <ConfirmButton action={deleteProject.bind(null, projectId)} confirm={`${project.name} 방을 지울까요? 할 일·자료·공지가 모두 지워져요.`}>
                  방 삭제
                </ConfirmButton>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
