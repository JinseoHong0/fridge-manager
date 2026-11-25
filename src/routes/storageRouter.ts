import { Router } from 'express';
import * as storage from '../controllers/storageController.js';
import { requireLogin } from '../middlewares/requireLogin.js';

const router = Router();

router.use(requireLogin); // 모든 보관 구역 API는 로그인 필수

router.get('/', storage.list);          // 보관 구역 목록 조회
router.get('/:id', storage.getById);    // 보관 구역 상세 조회
router.post('/', storage.create);       // 보관 구역 등록
router.put('/:id', storage.update);     // 보관 구역 수정
router.delete('/:id', storage.remove);  // 보관 구역 삭제

export default router;
