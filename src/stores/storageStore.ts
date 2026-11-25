import { prisma } from '../db.js';
import type { Storage } from '../generated/prisma/client.js';
import { isPrismaError } from './prismaError.js';

// 사용자의 보관 구역 목록 조회 (보관 구역별 식재료 개수 _count 포함)
export function findAllByUser(userId: number) {
  return prisma.storage.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      _count: { select: { ingredients: true } },
    },
  });
}

// 상세 조회 (소유권 검사를 위해 id만으로 조회 후 Controller에서 404/403 판별)
export function findById(id: number) {
  return prisma.storage.findUnique({
    where: { id },
    include: {
      ingredients: { orderBy: { expiresAt: 'asc' } },
    },
  });
}

// 작성자(소유자) id 조회 — 404와 403 구분용
export async function findOwnerId(id: number): Promise<number | null> {
  const storage = await prisma.storage.findUnique({
    where: { id },
    select: { userId: true },
  });
  return storage ? storage.userId : null;
}

// 보관 구역 등록
export function create(
  userId: number,
  name: string,
  tempInfo: string,
  sortOrder: number,
): Promise<Storage> {
  return prisma.storage.create({
    data: { userId, name, tempInfo, sortOrder },
  });
}

// 보관 구역 수정
export async function update(
  id: number,
  name: string,
  tempInfo: string,
  sortOrder: number,
): Promise<Storage | null> {
  try {
    return await prisma.storage.update({
      where: { id },
      data: { name, tempInfo, sortOrder },
    });
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return null;
    throw err;
  }
}

// 보관 구역 삭제 (Cascade로 소속 식재료 함께 삭제)
export async function remove(id: number): Promise<boolean> {
  try {
    await prisma.storage.delete({
      where: { id },
    });
    return true;
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return false;
    throw err;
  }
}
