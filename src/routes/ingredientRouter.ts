import { Router } from 'express';
import * as ingredient from '../controllers/ingredientController.js';
import { requireLogin } from '../middlewares/requireLogin.js';

const router = Router();

router.use(requireLogin); // 모든 식재료 API는 로그인 필수

// 고유 기능 3 — 월별 소비율·폐기율 및 낭비 금액 통계 (/:id보다 위에 배치)
router.get('/stats/monthly', ingredient.monthlyStats);

router.get('/', ingredient.list);                     // 식재료 목록 조회 (필터·검색·D-Day 포함)
router.get('/:id', ingredient.getById);               // 식재료 상세 조회
router.post('/', ingredient.create);                  // 식재료 등록
router.put('/:id', ingredient.update);                // 식재료 수정
router.patch('/:id/status', ingredient.changeStatus); // 식재료 상태 변경 (만료 식재료 소비완료 차단)
router.delete('/:id', ingredient.remove);             // 식재료 삭제

export default router;
