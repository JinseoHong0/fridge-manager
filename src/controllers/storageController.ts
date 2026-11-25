import type { RequestHandler } from 'express';
import * as storageStore from '../stores/storageStore.js';
import { parseId } from '../utils/parseId.js';
import { calculateDday } from '../utils/dday.js';

interface IdParams {
  id: string;
}

interface StorageBody {
  name?: string;
  tempInfo?: string;
  sortOrder?: number;
}

// GET /storages — 내 보관 구역 목록 조회
export const list: RequestHandler = async (req, res) => {
  const userId = req.user!.id;
  const storages = await storageStore.findAllByUser(userId);
  res.json(storages);
};

// GET /storages/:id — 보관 구역 상세 조회 (없으면 404, 타인 소유면 403)
export const getById: RequestHandler<IdParams> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const storage = await storageStore.findById(id);
  if (!storage) {
    res.status(404).json({ message: '보관 구역 없음' });
    return;
  }
  if (storage.userId !== userId) {
    res.status(403).json({ message: '접근 권한 없음' });
    return;
  }

  const ingredientsWithDday = storage.ingredients.map((item) => ({
    ...item,
    ...calculateDday(item.expiresAt),
  }));

  res.json({
    ...storage,
    ingredients: ingredientsWithDday,
  });
};

// POST /storages — 보관 구역 등록
export const create: RequestHandler<{}, unknown, StorageBody | undefined> =
  async (req, res) => {
    const userId = req.user!.id;
    const name = req.body?.name?.trim();
    const tempInfo = req.body?.tempInfo?.trim() ?? '';
    const sortOrder = Number(req.body?.sortOrder ?? 1);

    if (!name) {
      res.status(400).json({ message: '보관 구역 이름은 필수입니다' });
      return;
    }

    const storage = await storageStore.create(
      userId,
      name,
      tempInfo,
      Number.isInteger(sortOrder) ? sortOrder : 1,
    );
    res.status(201).json(storage);
  };

// PUT /storages/:id — 보관 구역 수정 (없으면 404, 타인 소유면 403)
export const update: RequestHandler<IdParams, unknown, StorageBody | undefined> =
  async (req, res) => {
    const userId = req.user!.id;
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: '잘못된 id' });
      return;
    }

    const ownerId = await storageStore.findOwnerId(id);
    if (ownerId === null) {
      res.status(404).json({ message: '보관 구역 없음' });
      return;
    }
    if (ownerId !== userId) {
      res.status(403).json({ message: '본인의 보관 구역만 수정할 수 있습니다' });
      return;
    }

    const name = req.body?.name?.trim();
    const tempInfo = req.body?.tempInfo?.trim() ?? '';
    const sortOrder = Number(req.body?.sortOrder ?? 1);

    if (!name) {
      res.status(400).json({ message: '보관 구역 이름은 필수입니다' });
      return;
    }

    const updated = await storageStore.update(
      id,
      name,
      tempInfo,
      Number.isInteger(sortOrder) ? sortOrder : 1,
    );
    if (!updated) {
      res.status(404).json({ message: '보관 구역 없음' });
      return;
    }
    res.json(updated);
  };

// DELETE /storages/:id — 보관 구역 삭제 (없으면 404, 타인 소유면 403)
export const remove: RequestHandler<IdParams> = async (req, res) => {
  const userId = req.user!.id;
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ message: '잘못된 id' });
    return;
  }

  const ownerId = await storageStore.findOwnerId(id);
  if (ownerId === null) {
    res.status(404).json({ message: '보관 구역 없음' });
    return;
  }
  if (ownerId !== userId) {
    res.status(403).json({ message: '본인의 보관 구역만 삭제할 수 있습니다' });
    return;
  }

  if (!(await storageStore.remove(id))) {
    res.status(404).json({ message: '보관 구역 없음' });
    return;
  }
  res.sendStatus(204);
};
