import type { RequestHandler, ErrorRequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client.js';

// 404 — 어떤 Router도 응답하지 않은 요청
export const notFound: RequestHandler = (req, res) => {
  const msg = `Cannot ${req.method} ${req.path}`;
  res.status(404).json({ message: msg });
};

// 에러 핸들러 — 매개변수 4개
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  // Prisma 오류 — 응답에는 오류 코드만 전달
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 — 고유 제약(@unique) 위반 → 409
    const status = err.code === 'P2002' ? 409 : 500;
    res.status(status).json({
      message: '데이터베이스 요청 오류',
      code: err.code,
    });
    return;
  }
  const message = err instanceof Error ? err.message : '알 수 없는 오류';
  res.status(500).json({ message });
};
