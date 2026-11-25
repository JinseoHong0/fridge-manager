import { Router } from 'express';
import * as recipe from '../controllers/recipeController.js';
import { requireLogin } from '../middlewares/requireLogin.js';

const router = Router();

router.use(requireLogin); // 모든 레시피 API는 로그인 필수

// 고유 기능 4 — 보유 식재료 기반 AI 맞춤 레시피 실시간 생성 및 유튜브 매칭
router.post('/recommend', recipe.recommend);

router.get('/', recipe.list);          // 저장한 레시피 목록 조회 (검색 포함)
router.get('/:id', recipe.getById);    // 저장한 레시피 상세 조회
router.post('/', recipe.create);       // 추천 레시피 저장
router.put('/:id', recipe.update);     // 저장한 레시피(개인 메모 등) 수정
router.delete('/:id', recipe.remove);  // 저장한 레시피 삭제

export default router;
