import type { RequestHandler } from 'express';
import { ApiError, GoogleGenAI, Type } from '@google/genai';
import yts from 'yt-search';
import { config } from '../config.js';
import * as recipeStore from '../stores/recipeStore.js';
import * as ingredientStore from '../stores/ingredientStore.js';
import { parseId } from '../utils/parseId.js';
import { calculateDday } from '../utils/dday.js';

interface IdParams {
  id: string;
}

interface RecipeQuery {
  keyword?: string;
}

interface RecommendBody {
  ingredientIds?: number[];
  ingredientNames?: string[];
}

interface SaveRecipeBody {
  title?: string;
  usedIngredients?: string | string[];
  cookingTime?: string;
  steps?: string | string[];
  memo?: string;
  videoUrl?: string;
}

interface GeneratedRecipe {
  title: string;
  cookingTime: string;
  usedIngredients: string[];
  steps: string[];
}

const VIDEO_TIMEOUT_MS = 4_000;

function isGeneratedRecipe(value: unknown): value is GeneratedRecipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Partial<GeneratedRecipe>;
  const isText = (text: unknown) => typeof text === 'string' && text.trim() !== '';
  const isTextList = (list: unknown) =>
    Array.isArray(list) && list.length > 0 && list.every(isText);

  return isText(recipe.title) && isText(recipe.cookingTime) &&
    isTextList(recipe.usedIngredients) && isTextList(recipe.steps);
}

async function findYoutubeVideoIds(title: string): Promise<string[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // 참고 영상 검색이 지연되어도 레시피는 반환한다.
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), VIDEO_TIMEOUT_MS);
    });
    const result = await Promise.race([yts(title), deadline]);
    return result?.videos.map((video) => video.videoId) ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function generateAiRecipes(targetNames: string[]): Promise<GeneratedRecipe[]> {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: `보유 식재료: ${targetNames.join(', ')}. 이 식재료들과 기본 자취방 양념(간장, 설탕, 소금, 식용유, 고추장 등)만 활용해서 15분 이내에 만들 수 있는 현실적인 자취 요리 레시피 2개를 추천해줘.`,
    config: {
      httpOptions: { timeout: 15_000, retryOptions: { attempts: 1 } },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            cookingTime: { type: Type.STRING },
            usedIngredients: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'title',
            'cookingTime',
            'usedIngredients',
            'steps',
          ],
        },
      },
    },
  });

  const parsed: unknown = JSON.parse(response.text ?? 'null');
  if (!Array.isArray(parsed) || parsed.length !== 2 || !parsed.every(isGeneratedRecipe)) {
    throw new Error('Invalid Gemini recipe response');
  }
  return parsed;
}

// [고유 기능 4] POST /recipes/recommend — 보유/임박 식재료 기반 AI 맞춤 레시피 실시간 생성 + 유튜브 영상 매칭
export const recommend: RequestHandler<{}, unknown, RecommendBody | undefined> =
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const allActive = await ingredientStore.findAllByUser(userId, { status: 'ACTIVE' });
      const validActive = allActive.filter(
        (item) => calculateDday(item.expiresAt).riskLevel !== 'EXPIRED',
      );
      let targetNames: string[] = [];

      if (
        Array.isArray(req.body?.ingredientNames) &&
        req.body.ingredientNames.length > 0
      ) {
        const eligibleNames = new Set(validActive.map((item) => item.name));
        targetNames = req.body.ingredientNames
          .filter((name) => typeof name === 'string')
          .map((name) => name.trim())
          .filter((name) => eligibleNames.has(name));
      } else if (
        Array.isArray(req.body?.ingredientIds) &&
        req.body.ingredientIds.length > 0
      ) {
        const idSet = new Set(req.body.ingredientIds.map(Number));
        targetNames = validActive
          .filter((item) => idSet.has(item.id))
          .map((item) => item.name);
      } else {
        // 선택된 식재료가 없으면 보관중(ACTIVE) 식재료 중 임박/안전 순으로 자동 선택
        targetNames = validActive.slice(0, 5).map((item) => item.name);
      }

      if (targetNames.length === 0) {
        res.status(400).json({
          message: '추천에 사용할 수 있는 식재료가 없습니다. 소비기한이 지나지 않은 보관 중 재료를 선택해 주세요.',
        });
        return;
      }

      let recipes: GeneratedRecipe[] = [];

      if (config.GEMINI_API_KEY) {
        try {
          recipes = await generateAiRecipes(targetNames);
        } catch (err) {
          const reason = err instanceof ApiError ? err.status :
            err instanceof Error ? err.name : 'unknown';
          console.warn('Gemini 레시피 생성 실패, 기본 추천 사용:', reason);
        }
      }

      const source = recipes.length > 0 ? 'ai' : 'fallback';
      if (source === 'fallback') {
        const mainItem = targetNames[0] ?? '식재료';
        const subItem = targetNames[1] ?? '대파';
        recipes = [
          {
            title: `초간단 ${mainItem} 간장덮밥`,
            cookingTime: '10분',
            usedIngredients: targetNames,
            steps: [
              `${mainItem}과(와) ${subItem}을(를) 한 입 크기로 썰어 준비합니다.`,
              '달군 팬에 식용유를 두르고 중불에서 노릇하게 볶습니다.',
              '간장 1.5큰술, 설탕 0.5큰술을 넣고 빠르게 졸여 따뜻한 밥 위에 얹어 완성합니다.',
            ],
          },
          {
            title: `자취방 ${mainItem} 매콤 볶음`,
            cookingTime: '15분',
            usedIngredients: targetNames,
            steps: [
              `준비한 ${targetNames.join(', ')} 재료를 먹기 좋게 손질합니다.`,
              '고추장 1큰술, 간장 1큰술, 설탕 0.5큰술로 양념장을 만듭니다.',
              '팬에 재료를 먼저 볶다가 양념장을 넣고 강불에서 빠르게 볶아 완성합니다.',
            ],
          },
        ];
      }

      const videoCandidates = await Promise.all(
        recipes.map((recipe) => findYoutubeVideoIds(recipe.title)),
      );
      const usedVideoIds = new Set<string>();
      const recipesWithVideo = recipes.map((recipe, index) => {
        const videoId = videoCandidates[index]?.find((id) => id && !usedVideoIds.has(id));
        if (videoId) usedVideoIds.add(videoId);
        return {
          ...recipe,
          searchKeyword: recipe.title,
          videoUrl: videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '',
        };
      });

      res.json({
        selectedIngredients: targetNames,
        recommendations: recipesWithVideo,
        source,
      });
    } catch (err) {
      next(err);
    }
  };

// GET /recipes — 내 레시피북 목록 조회 (키워드 검색 지원)
export const list: RequestHandler<{}, unknown, unknown, RecipeQuery> = async (
  req,
  res,
) => {
  const userId = req.user!.id;
  const { keyword } = req.query;
  const recipes = await recipeStore.findAllByUser(userId, keyword);
  res.json(recipes);
};

// GET /recipes/:id — 저장한 레시피 상세 조회 (없으면 404, 타인 소유면 403)
export const getById: RequestHandler<IdParams> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const recipe = await recipeStore.findById(id);
  if (!recipe) {
    res.status(404).json({ message: '저장한 레시피 없음' });
    return;
  }
  if (recipe.userId !== userId) {
    res.status(403).json({ message: '접근 권한 없음' });
    return;
  }
  res.json(recipe);
};

// POST /recipes — 추천받은 AI 레시피를 개인 레시피북에 저장
export const create: RequestHandler<{}, unknown, SaveRecipeBody | undefined> =
  async (req, res) => {
    const userId = req.user!.id;
    const title = req.body?.title?.trim();
    const cookingTime = req.body?.cookingTime?.trim() ?? '15분';
    const rawIngredients = req.body?.usedIngredients;
    const rawSteps = req.body?.steps;
    const memo = req.body?.memo?.trim() ?? '';
    const videoUrl = req.body?.videoUrl?.trim() ?? '';

    const usedIngredients = Array.isArray(rawIngredients)
      ? rawIngredients.join(', ')
      : (rawIngredients?.trim() ?? '');

    const steps = Array.isArray(rawSteps)
      ? rawSteps.join('\n')
      : (rawSteps?.trim() ?? '');

    if (!title || !usedIngredients || !steps) {
      res.status(400).json({
        message: '요리명(title), 활용 식재료(usedIngredients), 조리 순서(steps)는 필수입니다',
      });
      return;
    }

    const saved = await recipeStore.create({
      userId,
      title,
      usedIngredients,
      cookingTime,
      steps,
      memo,
      videoUrl,
    });

    res.status(201).json(saved);
  };

// PUT /recipes/:id — 저장한 레시피 및 개인 요리 메모 수정 (없으면 404, 타인 소유면 403)
export const update: RequestHandler<
  IdParams,
  unknown,
  SaveRecipeBody | undefined
> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const ownerId = await recipeStore.findOwnerId(id);
  if (ownerId === null) {
    res.status(404).json({ message: '저장한 레시피 없음' });
    return;
  }
  if (ownerId !== userId) {
    res.status(403).json({ message: '본인의 레시피만 수정할 수 있습니다' });
    return;
  }

  const title = req.body?.title?.trim();
  const cookingTime = req.body?.cookingTime?.trim() ?? '15분';
  const rawIngredients = req.body?.usedIngredients;
  const rawSteps = req.body?.steps;
  const memo = req.body?.memo?.trim() ?? '';
  const videoUrl = req.body?.videoUrl?.trim() ?? '';

  const usedIngredients = Array.isArray(rawIngredients)
    ? rawIngredients.join(', ')
    : (rawIngredients?.trim() ?? '');

  const steps = Array.isArray(rawSteps)
    ? rawSteps.join('\n')
    : (rawSteps?.trim() ?? '');

  if (!title || !usedIngredients || !steps) {
    res.status(400).json({
      message: '요리명(title), 활용 식재료(usedIngredients), 조리 순서(steps)는 필수입니다',
    });
    return;
  }

  const updated = await recipeStore.update(id, {
    title,
    usedIngredients,
    cookingTime,
    steps,
    memo,
    videoUrl,
  });

  if (!updated) {
    res.status(404).json({ message: '저장한 레시피 없음' });
    return;
  }
  res.json(updated);
};

// DELETE /recipes/:id — 저장한 레시피 삭제 (없으면 404, 타인 소유면 403)
export const remove: RequestHandler<IdParams> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const ownerId = await recipeStore.findOwnerId(id);
  if (ownerId === null) {
    res.status(404).json({ message: '저장한 레시피 없음' });
    return;
  }
  if (ownerId !== userId) {
    res.status(403).json({ message: '본인의 레시피만 삭제할 수 있습니다' });
    return;
  }

  if (!(await recipeStore.remove(id))) {
    res.status(404).json({ message: '저장한 레시피 없음' });
    return;
  }
  res.sendStatus(204);
};
