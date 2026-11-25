-- 기존 체험 계정의 기본 레시피에 남아 있는 잘못된 영상 링크를 교체한다.
UPDATE "saved_recipes" AS recipe
SET "video_url" = 'https://www.youtube.com/watch?v=bnhqtin0ymg'
FROM "users" AS demo_user
WHERE recipe."user_id" = demo_user."id"
  AND demo_user."email" = 'a@test.com'
  AND recipe."title" = '초간단 두부 간장조림'
  AND recipe."video_url" = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
