# 모둠 프로젝트 플래너

학급 → 주제 → 프로젝트 방 → (선택) 모둠 구조로 학생 모둠 프로젝트를 "목표 → 할 일 → 담당자 → 일정 → 진행 상태 → 결과물" 흐름으로 관리하는 웹앱입니다.
Next.js 16(App Router) · TypeScript · Tailwind CSS 4 · Supabase(Postgres/Auth/Storage) · OpenAI API.

## 처음 설정 (사람이 할 일)

1. Supabase 프로젝트를 만들고 Auth(이메일), Database, Storage를 켭니다.
2. `.env.example`을 `.env.local`로 복사해 값을 채웁니다.
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)
   - `STUDENT_PIN_PEPPER` (서버 전용, 긴 무작위 문자열. 예: `openssl rand -hex 32`. 바꾸면 모든 학생 비밀번호를 다시 설정해야 함)
   - `OPENAI_API_KEY` (서버 전용), `OPENAI_MODEL` (선택, 기본 `gpt-5.4-mini`)
3. 마이그레이션 적용: `supabase link` 후 `supabase db push`, 또는 SQL 편집기에서 `supabase/migrations/20261019000000_init.sql` 실행.
   - 되돌리기: `supabase/migrations/down/20261019000000_init.down.sql` (모든 데이터 삭제)
4. Supabase 콘솔 설정
   - Authentication → Providers → Email: 교사 가입에 메일 확인을 쓸지 정합니다(끄면 가입 즉시 로그인).
   - Authentication → URL Configuration: Site URL을 배포 주소로.
   - Storage: 마이그레이션이 비공개 버킷 `task-files`(10MB, PDF/PNG/JPG/WEBP/GIF)를 만듭니다.

## 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

## 검증 명령

```bash
npm run lint
npm run typecheck    # next typegen && tsc --noEmit
npm test             # Vitest 단위·컴포넌트·AI 라우트 로직 테스트
npm run build

# 로컬 Supabase가 필요한 테스트
supabase start && supabase db reset
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:rls
npm run test:e2e     # .env.local이 로컬 Supabase를 가리키는 상태에서
```

## 구조

- `supabase/migrations/` 테이블·트리거·RLS·Storage 정책. 권한 판정은 `can_view_scope` / `can_edit_scope`에 모았습니다.
- `src/lib/domain/` 순수 함수(학급코드, PIN, 잠금, 날짜, 흐름도 좌표, 공개 범위, AI 응답 검증, 업로드 검증)와 테스트.
- `src/actions/` 서버 액션(쓰기). 사용자 세션으로 실행되어 RLS가 적용됩니다. service role은 학생 등록·PIN 재설정·학생 로그인 조회·잠금 해제·파일 정리에서만 씁니다.
- `src/app/api/projects/[projectId]/ai-tasks` AI 할 일 초안(저장하지 않음, 작업 공간별 하루 20회).
- `scripts/rls-test.ts` 11개 역할 계정 권한 테스트, `e2e/flow.spec.ts` 대표 흐름 E2E.
