import type { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import * as userStore from '../stores/userStore.js';

interface RegisterBody {
  email?: string;
  password?: string;
  name?: string;
}

// POST /auth/register — 회원가입 (비밀번호 8자 이상 검증, bcrypt 해시, 기본 보관 구역 3개 자동 생성)
export const register: RequestHandler<{}, unknown, RegisterBody | undefined> =
  async (req, res) => {
    const email = req.body?.email?.trim();
    const password = req.body?.password;
    const name = req.body?.name?.trim();

    if (!email || !password || !name) {
      res.status(400).json({ message: '이메일, 비밀번호, 이름은 필수입니다' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다' });
      return;
    }

    const existing = await userStore.findByEmail(email);
    if (existing) {
      res.status(409).json({ message: '이미 가입된 이메일입니다' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userStore.create(email, passwordHash, name);

    res.status(201).json({ message: '회원가입 성공', user });
  };

// POST /auth/login — passport.authenticate('local') 통과 후 실행
export const login: RequestHandler = (req, res) => {
  res.json({ message: '로그인 성공', user: req.user });
};

// GET /auth/me — requireLogin 통과 후 실행
export const me: RequestHandler = (req, res) => {
  res.json({ user: req.user });
};

// POST /auth/logout — Passport 로그아웃
export const logout: RequestHandler = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    res.json({ message: '로그아웃' });
  });
};
