import { prisma } from '../db.js';
import { Prisma, type Ingredient } from '../generated/prisma/client.js';
import { isPrismaError } from './prismaError.js';

export interface IngredientFilter {
  storageId?: number | undefined;
  status?: string | undefined;
  keyword?: string | undefined;
}

export interface CreateIngredientInput {
  userId: number;
  storageId: number;
  name: string;
  purchasedAt: Date;
  expiresAt: Date;
  price: number;
  memo: string;
}

export interface UpdateIngredientInput {
  storageId: number;
  name: string;
  purchasedAt: Date;
  expiresAt: Date;
  price: number;
  memo: string;
  status: string;
}

// 목록 조회 — 보관 구역별, 상태별 필터 및 식재료명 키워드 검색
export function findAllByUser(userId: number, filter: IngredientFilter) {
  const where: Prisma.IngredientWhereInput = { userId };
  if (filter.storageId !== undefined) where.storageId = filter.storageId;
  if (filter.status) where.status = filter.status;
  if (filter.keyword) where.name = { contains: filter.keyword };

  return prisma.ingredient.findMany({
    where,
    orderBy: [{ expiresAt: 'asc' }, { id: 'desc' }],
    include: {
      storage: { select: { id: true, name: true, tempInfo: true } },
    },
  });
}

// 단건 상세 조회 (404와 403 구분을 위해 id만으로 조회)
export function findById(id: number) {
  return prisma.ingredient.findUnique({
    where: { id },
    include: {
      storage: { select: { id: true, name: true, tempInfo: true } },
    },
  });
}

// 소유자 id 조회
export async function findOwnerId(id: number): Promise<number | null> {
  const item = await prisma.ingredient.findUnique({
    where: { id },
    select: { userId: true },
  });
  return item ? item.userId : null;
}

// 식재료 등록 — 본인 소유 storageId인지 확인 후 등록
export async function create(
  input: CreateIngredientInput,
): Promise<Ingredient | null> {
  const storage = await prisma.storage.findFirst({
    where: { id: input.storageId, userId: input.userId },
  });
  if (!storage) return null;

  try {
    return await prisma.ingredient.create({
      data: {
        userId: input.userId,
        storageId: input.storageId,
        name: input.name,
        purchasedAt: input.purchasedAt,
        expiresAt: input.expiresAt,
        price: input.price,
        memo: input.memo,
      },
    });
  } catch (err) {
    if (isPrismaError(err, 'P2003')) return null;
    throw err;
  }
}

// 식재료 전체 수정
export async function update(
  userId: number,
  id: number,
  input: UpdateIngredientInput,
): Promise<Ingredient | null> {
  const storage = await prisma.storage.findFirst({
    where: { id: input.storageId, userId },
  });
  if (!storage) return null;

  try {
    return await prisma.ingredient.update({
      where: { id },
      data: {
        storageId: input.storageId,
        name: input.name,
        purchasedAt: input.purchasedAt,
        expiresAt: input.expiresAt,
        price: input.price,
        memo: input.memo,
        status: input.status,
      },
    });
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return null;
    throw err;
  }
}

// 식재료 처리 상태만 변경 (ACTIVE | CONSUMED | DISCARDED)
export async function updateStatus(
  id: number,
  status: string,
): Promise<Ingredient | null> {
  try {
    return await prisma.ingredient.update({
      where: { id },
      data: { status },
    });
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return null;
    throw err;
  }
}

// 식재료 삭제
export async function remove(id: number): Promise<boolean> {
  try {
    await prisma.ingredient.delete({
      where: { id },
    });
    return true;
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return false;
    throw err;
  }
}
