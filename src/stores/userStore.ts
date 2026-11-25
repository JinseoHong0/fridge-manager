import { prisma } from '../db.js';
import type { User } from '../generated/prisma/client.js';

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
}

// 로그인 검증용 (passwordHash 포함 반환)
export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email },
  });
}

// 세션 복원용 (passwordHash 제외하고 select)
export function findById(id: number): Promise<PublicUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
}

// 회원가입 시 기본 보관 구역 3개(냉장실, 냉동실, 실온 보관) 중첩 생성
export function create(
  email: string,
  passwordHash: string,
  name: string,
): Promise<PublicUser> {
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      storages: {
        create: [
          { name: '냉장실', tempInfo: '0~5°C 신선 보관', sortOrder: 1 },
          { name: '냉동실', tempInfo: '-18°C 이하 장기 보관', sortOrder: 2 },
          { name: '실온 보관', tempInfo: '직사광선 피한 상온', sortOrder: 3 },
        ],
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
}
