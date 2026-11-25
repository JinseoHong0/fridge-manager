import { prisma } from '../db.js';
import { Prisma, type SavedRecipe } from '../generated/prisma/client.js';
import { isPrismaError } from './prismaError.js';

export interface CreateRecipeInput {
  userId: number;
  title: string;
  usedIngredients: string;
  cookingTime: string;
  steps: string;
  memo: string;
  videoUrl: string;
}

export interface UpdateRecipeInput {
  title: string;
  usedIngredients: string;
  cookingTime: string;
  steps: string;
  memo: string;
  videoUrl: string;
}

// 저장한 레시피 목록 조회 (제목 키워드 검색 지원)
export function findAllByUser(userId: number, keyword?: string) {
  const where: Prisma.SavedRecipeWhereInput = { userId };
  if (keyword) where.title = { contains: keyword };

  return prisma.savedRecipe.findMany({
    where,
    orderBy: { id: 'desc' },
  });
}

// 저장한 레시피 단건 상세 조회 (404/403 구분을 위해 id만으로 조회)
export function findById(id: number): Promise<SavedRecipe | null> {
  return prisma.savedRecipe.findUnique({
    where: { id },
  });
}

// 소유자 id 조회
export async function findOwnerId(id: number): Promise<number | null> {
  const recipe = await prisma.savedRecipe.findUnique({
    where: { id },
    select: { userId: true },
  });
  return recipe ? recipe.userId : null;
}

// 레시피북에 새 레시피 저장
export function create(input: CreateRecipeInput): Promise<SavedRecipe> {
  return prisma.savedRecipe.create({
    data: {
      userId: input.userId,
      title: input.title,
      usedIngredients: input.usedIngredients,
      cookingTime: input.cookingTime,
      steps: input.steps,
      memo: input.memo,
      videoUrl: input.videoUrl,
    },
  });
}

// 저장한 레시피 수정 (개인 메모, 요리명 등 수정)
export async function update(
  id: number,
  input: UpdateRecipeInput,
): Promise<SavedRecipe | null> {
  try {
    return await prisma.savedRecipe.update({
      where: { id },
      data: {
        title: input.title,
        usedIngredients: input.usedIngredients,
        cookingTime: input.cookingTime,
        steps: input.steps,
        memo: input.memo,
        videoUrl: input.videoUrl,
      },
    });
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return null;
    throw err;
  }
}

// 저장한 레시피 삭제
export async function remove(id: number): Promise<boolean> {
  try {
    await prisma.savedRecipe.delete({
      where: { id },
    });
    return true;
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return false;
    throw err;
  }
}
