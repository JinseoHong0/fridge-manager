import { Router } from 'express';
import passport from '../passport.js';
import * as auth from '../controllers/authController.js';
import { requireLogin } from '../middlewares/requireLogin.js';

const router = Router();

router.post('/register', auth.register); // 회원가입
router.post('/login', passport.authenticate('local'), auth.login); // Passport 로그인
router.get('/me', requireLogin, auth.me); // 내 정보 확인
router.post('/logout', auth.logout); // 로그아웃

export default router;
