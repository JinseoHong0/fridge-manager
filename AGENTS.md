# 프로젝트 작업 지침 (고급웹프로그래밍 기말 프로젝트)

## 1. 프로젝트 개요
- **서비스명:** 자취생의 식재료 소비기한 관리 및 AI 맞춤 레시피 추천 서비스 (`fridge-manager`)
- **백엔드 스택:** Node.js, Express 5, TypeScript (ESM, `"module": "nodenext"`), Prisma 7 (`@prisma/adapter-pg`), PostgreSQL(Supabase), `express-session` + `passport` + `passport-local` + `bcrypt`, `@google/genai`, `yt-search`
- **프론트엔드 스택:** `public/` 디렉터리 내 순수 HTML, CSS, Vanilla JS (`fetch` API 사용, `express.static('public')` 서빙)

## 2. 절대 유지해야 할 백엔드 아키텍처 & 평가 규칙
1. **모듈 경로:** 모든 내부 TypeScript import는 `.js` 확장자를 명시한다 (예: `import { prisma } from '../db.js';`).
2. **계층 분리:** `src/routes/` -> `src/controllers/` -> `src/stores/` -> `prisma/schema.prisma` 구조를 엄격히 지킨다.
3. **Passport 세션 인증(401) vs 인가(403):**
   - `src/passport.ts`의 `LocalStrategy`, `serializeUser`, `deserializeUser`로 `req.user`를 복원한다.
   - 비로그인 요청은 `requireLogin` 미들웨어(`req.isAuthenticated()`)에서 `401 Unauthorized` 반환.
   - 수정(`PUT`/`PATCH`) 및 삭제(`DELETE`) 시 먼저 대상의 존재 여부를 조회(`findOwnerId`)하여 없으면 `404 Not Found`, `ownerId !== req.user!.id`이면 **`403 Forbidden`** 반환.
4. **평가자 자동 실행 명령어 (`npm run reset`):**
   - `package.json`의 `reset` 스크립트와 `prisma/seed.ts`, `requests.http`의 ID 순서(시드 데이터 기준)가 서로 깨지지 않도록 유지한다.
   - `requests.http`의 모든 요청 제목 형식(`### 번호. 설명 → 기대상태코드`)과 반환 상태 코드는 100% 일치해야 한다.

## 3. 프론트엔드(`public/`) 구현 시 지침
- 화면 4종 이상 필수 포함:
  1. **로그인 / 회원가입 화면** (시드 체험 계정 `a@test.com` / `pass1234` 빠른 입력 버튼 포함, 비밀번호 8자 이상 검증)
  2. **내 냉장고 현황 (목록 화면)** — 보관 구역 탭 필터, 상태 필터, 식재료명 키워드 검색, D-Day 뱃지(`SAFE` 초록 / `IMMINENT` 주황 / `EXPIRED` 빨강) 표시
  3. **식재료 및 보관 구역 등록/수정/상세 화면** — 만료(`EXPIRED`) 식재료는 '소비완료' 버튼 비활성화 및 서버 `400` 응답 메시지 안내 처리
  4. **AI 맞춤 레시피 추천 & 내 레시피북 + 월별 소비/폐기 통계 대시보드 화면**
- 모든 API 호출은 같은 오리진(`/auth`, `/storages`, `/ingredients`, `/recipes`)으로 `fetch` 호출하며, 응답 상태 코드(`401`, `403`, `400`)에 따른 사용자 알림을 명확히 표시한다.
