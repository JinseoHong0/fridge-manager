import type { RequestHandler } from 'express';
import * as ingredientStore from '../stores/ingredientStore.js';
import { parseId } from '../utils/parseId.js';
import { calculateDday } from '../utils/dday.js';

interface IdParams {
  id: string;
}

interface IngredientQuery {
  storageId?: string;
  status?: string;
  keyword?: string;
  riskLevel?: string;
}

interface StatsQuery {
  month?: string; // 예: "2026-11"
}

interface IngredientBody {
  storageId?: number;
  name?: string;
  purchasedAt?: string;
  expiresAt?: string;
  price?: number;
  memo?: string;
  status?: string;
}

interface StatusBody {
  status?: string;
}

const VALID_STATUSES = ['ACTIVE', 'CONSUMED', 'DISCARDED'];

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// [고유 기능 1 포함] GET /ingredients — 목록 조회 + D-Day 자동 계산 및 위험도 분류
export const list: RequestHandler<{}, unknown, unknown, IngredientQuery> =
  async (req, res) => {
    const userId = req.user!.id;
    const { storageId: rawStorageId, status, keyword, riskLevel } = req.query;

    let parsedStorageId: number | undefined;
    if (rawStorageId !== undefined && rawStorageId !== '') {
      const id = parseId(rawStorageId);
      if (id === null) {
        res.status(400).json({ message: '잘못된 storageId' });
        return;
      }
      parsedStorageId = id;
    }

    const items = await ingredientStore.findAllByUser(userId, {
      storageId: parsedStorageId,
      status,
      keyword,
    });

    // 각 식재료마다 D-Day 및 위험도(SAFE | IMMINENT | EXPIRED) 동적 부여
    const enriched = items.map((item) => ({
      ...item,
      ...calculateDday(item.expiresAt),
    }));

    const filtered = riskLevel
      ? enriched.filter((item) => item.riskLevel === riskLevel)
      : enriched;

    res.json(filtered);
  };

// GET /ingredients/:id — 식재료 상세 조회 (없으면 404, 타인 소유면 403)
export const getById: RequestHandler<IdParams> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const item = await ingredientStore.findById(id);
  if (!item) {
    res.status(404).json({ message: '식재료 없음' });
    return;
  }
  if (item.userId !== userId) {
    res.status(403).json({ message: '접근 권한 없음' });
    return;
  }

  res.json({
    ...item,
    ...calculateDday(item.expiresAt),
  });
};

// POST /ingredients — 식재료 등록
export const create: RequestHandler<{}, unknown, IngredientBody | undefined> =
  async (req, res) => {
    const userId = req.user!.id;
    const storageId = Number(req.body?.storageId);
    const name = req.body?.name?.trim();
    const purchasedAt = parseDate(req.body?.purchasedAt);
    const expiresAt = parseDate(req.body?.expiresAt);
    const price = Number(req.body?.price ?? 0);
    const memo = req.body?.memo?.trim() ?? '';

    if (
      !Number.isInteger(storageId) ||
      storageId < 1 ||
      !name ||
      !purchasedAt ||
      !expiresAt
    ) {
      res.status(400).json({
        message: 'storageId, 식재료명, 구매일, 소비기한은 필수입니다',
      });
      return;
    }

    if (price < 0 || !Number.isFinite(price)) {
      res.status(400).json({ message: '가격은 0 이상의 숫자여야 합니다' });
      return;
    }

    const created = await ingredientStore.create({
      userId,
      storageId,
      name,
      purchasedAt,
      expiresAt,
      price: Math.floor(price),
      memo,
    });

    if (!created) {
      res.status(404).json({ message: '보관 구역 없음' });
      return;
    }

    res.status(201).json({
      ...created,
      ...calculateDday(created.expiresAt),
    });
  };

// PUT /ingredients/:id — 식재료 정보 수정 (없으면 404, 타인 소유면 403, 만료 식재료 소비완료 차단)
export const update: RequestHandler<
  IdParams,
  unknown,
  IngredientBody | undefined
> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const ownerId = await ingredientStore.findOwnerId(id);
  if (ownerId === null) {
    res.status(404).json({ message: '식재료 없음' });
    return;
  }
  if (ownerId !== userId) {
    res.status(403).json({ message: '본인의 식재료만 수정할 수 있습니다' });
    return;
  }

  const storageId = Number(req.body?.storageId);
  const name = req.body?.name?.trim();
  const purchasedAt = parseDate(req.body?.purchasedAt);
  const expiresAt = parseDate(req.body?.expiresAt);
  const price = Number(req.body?.price ?? 0);
  const memo = req.body?.memo?.trim() ?? '';
  const status = req.body?.status ?? 'ACTIVE';

  if (
    !Number.isInteger(storageId) ||
    storageId < 1 ||
    !name ||
    !purchasedAt ||
    !expiresAt ||
    !VALID_STATUSES.includes(status)
  ) {
    res.status(400).json({ message: '입력값이 올바르지 않습니다' });
    return;
  }

  const ddayInfo = calculateDday(expiresAt);
  if (ddayInfo.riskLevel === 'EXPIRED' && status === 'CONSUMED') {
    res.status(400).json({
      message:
        '소비기한이 지난 만료 식재료는 "소비완료(CONSUMED)"로 변경할 수 없습니다. "폐기(DISCARDED)"만 허용됩니다.',
    });
    return;
  }

  const updated = await ingredientStore.update(userId, id, {
    storageId,
    name,
    purchasedAt,
    expiresAt,
    price: Math.floor(price),
    memo,
    status,
  });

  if (!updated) {
    res.status(404).json({ message: '보관 구역 없음' });
    return;
  }

  res.json({
    ...updated,
    ...calculateDday(updated.expiresAt),
  });
};

// [고유 기능 2] PATCH /ingredients/:id/status — 만료 식재료의 '소비완료' 변경 차단 로직
export const changeStatus: RequestHandler<
  IdParams,
  unknown,
  StatusBody | undefined
> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  const status = req.body?.status;

  if (id === null || !status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      message: '올바른 id와 상태(ACTIVE | CONSUMED | DISCARDED)가 필요합니다',
    });
    return;
  }

  const existing = await ingredientStore.findById(id);
  if (!existing) {
    res.status(404).json({ message: '식재료 없음' });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ message: '본인의 식재료 상태만 변경할 수 있습니다' });
    return;
  }

  const ddayInfo = calculateDday(existing.expiresAt);
  if (ddayInfo.riskLevel === 'EXPIRED' && status === 'CONSUMED') {
    res.status(400).json({
      message:
        '소비기한이 지난 만료 식재료는 "소비완료(CONSUMED)"로 변경할 수 없습니다. "폐기(DISCARDED)"만 가능합니다.',
    });
    return;
  }

  const updated = await ingredientStore.updateStatus(id, status);
  if (!updated) {
    res.status(404).json({ message: '식재료 없음' });
    return;
  }

  res.json({
    ...updated,
    ...calculateDday(updated.expiresAt),
  });
};

// DELETE /ingredients/:id — 식재료 삭제 (없으면 404, 타인 소유면 403)
export const remove: RequestHandler<IdParams> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const ownerId = await ingredientStore.findOwnerId(id);
  if (ownerId === null) {
    res.status(404).json({ message: '식재료 없음' });
    return;
  }
  if (ownerId !== userId) {
    res.status(403).json({ message: '본인의 식재료만 삭제할 수 있습니다' });
    return;
  }

  if (!(await ingredientStore.remove(id))) {
    res.status(404).json({ message: '식재료 없음' });
    return;
  }
  res.sendStatus(204);
};

// [고유 기능 3] GET /ingredients/stats/monthly?month=YYYY-MM — 월별 소비율·폐기율 및 식비 낭비금액 집계
export const monthlyStats: RequestHandler<{}, unknown, unknown, StatsQuery> =
  async (req, res) => {
    const userId = req.user!.id;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = req.query.month ?? defaultMonth;

    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      res.status(400).json({ message: 'month 형식은 YYYY-MM이어야 합니다' });
      return;
    }

    const allItems = await ingredientStore.findAllByUser(userId, {});

    // 구매일(purchasedAt) 또는 소비기한(expiresAt)이 해당 월에 속하는 식재료 필터
    const monthlyItems = allItems.filter((item) => {
      const pMonth = item.purchasedAt.toISOString().slice(0, 7);
      const eMonth = item.expiresAt.toISOString().slice(0, 7);
      return pMonth === targetMonth || eMonth === targetMonth;
    });

    const totalCount = monthlyItems.length;
    const activeItems = monthlyItems.filter((i) => i.status === 'ACTIVE');
    const consumedItems = monthlyItems.filter((i) => i.status === 'CONSUMED');
    const discardedItems = monthlyItems.filter((i) => i.status === 'DISCARDED');

    const totalSpent = monthlyItems.reduce((sum, i) => sum + i.price, 0);
    const consumedAmount = consumedItems.reduce((sum, i) => sum + i.price, 0);
    const wastedAmount = discardedItems.reduce((sum, i) => sum + i.price, 0);

    const consumptionRate =
      totalCount > 0
        ? Number(((consumedItems.length / totalCount) * 100).toFixed(1))
        : 0;
    const discardRate =
      totalCount > 0
        ? Number(((discardedItems.length / totalCount) * 100).toFixed(1))
        : 0;

    res.json({
      month: targetMonth,
      totalCount,
      activeCount: activeItems.length,
      consumedCount: consumedItems.length,
      discardedCount: discardedItems.length,
      consumptionRate,
      discardRate,
      totalSpent,
      consumedAmount,
      wastedAmount,
    });
  };
