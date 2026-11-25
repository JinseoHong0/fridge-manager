const PORT = Number(process.env.PORT ?? 3000);
const SESSION_SECRET = process.env.SESSION_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

// 필수값이 없으면 서버를 시작하지 않음
if (!SESSION_SECRET || !DATABASE_URL) {
  throw new Error('.env에 SESSION_SECRET · DATABASE_URL 필요');
}

export const config = {
  PORT,
  SESSION_SECRET,
  DATABASE_URL,
  GEMINI_API_KEY,
};
