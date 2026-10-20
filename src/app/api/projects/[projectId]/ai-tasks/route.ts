import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { openaiCaller, generateTaskDrafts } from "@/lib/aiTasks";
import { AI_DAILY_LIMIT } from "@/lib/domain/ai";
import { canEditScope } from "@/lib/domain/scope";
import { loadProject, workspaceMembers, type ProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  groupId: z.string().uuid().nullable().optional(),
  instruction: z.string().max(300).optional(),
});

// AI 할 일 초안(작업 공간별). 저장하지 않고 미리보기용 초안만 돌려준다.
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/ai-tasks">) {
  const { projectId } = await params;
  const me = await getSessionProfile();
  if (!me) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청을 확인하세요" }, { status: 400 });
  const groupId = parsed.data.groupId ?? null;

  let ctx: ProjectContext;
  try {
    ctx = await loadProject(projectId);
  } catch {
    return NextResponse.json({ error: "방을 찾을 수 없어요" }, { status: 404 });
  }
  if (groupId && !ctx.groups.some((g) => g.id === groupId)) {
    return NextResponse.json({ error: "모둠을 확인하세요" }, { status: 400 });
  }
  if (!canEditScope(ctx.scope, groupId)) {
    return NextResponse.json({ error: "이 작업 공간에 할 일을 만들 권한이 없어요" }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI 설정(OPENAI_API_KEY)이 아직 안 되어 있어요" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: used } = await supabase.rpc("ai_usage_today", { p_project: projectId, p_group: groupId });
  if ((used ?? 0) >= AI_DAILY_LIMIT) {
    return NextResponse.json({ error: `AI 할 일 만들기는 작업 공간마다 하루 ${AI_DAILY_LIMIT}번까지 쓸 수 있어요` }, { status: 429 });
  }
  const { error: logError } = await supabase.from("ai_generation_log").insert({ project_id: projectId, group_id: groupId, requested_by: me.id });
  if (logError) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const group = ctx.groups.find((g) => g.id === groupId) ?? null;
  const result = await generateTaskDrafts(
    {
      topicTitle: ctx.topic.title,
      topicGoal: ctx.topic.goal,
      roomName: ctx.project.name,
      roomDescription: ctx.project.description,
      groupName: group?.name ?? null,
      startDate: ctx.project.start_date,
      endDate: ctx.project.end_date,
      memberCount: workspaceMembers(ctx, groupId).length,
      extraInstruction: parsed.data.instruction?.trim() || null,
    },
    { start: ctx.project.start_date, end: ctx.project.end_date },
    openaiCaller(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ drafts: result.drafts });
}
