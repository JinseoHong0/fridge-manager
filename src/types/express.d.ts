// Passport가 req.user에 저장하는 사용자의 타입 (13강 표준)
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string;
    }
  }
}

export {};
