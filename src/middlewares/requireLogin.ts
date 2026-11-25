import type { RequestHandler } from 'express';

// 로그인한 사용자의 요청만 다음 함수로 전달 (13강 Passport 표준, 비로그인 시 401)
export const requireLogin: RequestHandler<{}> = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: '로그인 필요' });
    return;
  }
  next();
};
