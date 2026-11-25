import bcrypt from 'bcrypt';
import { prisma } from '../src/db.js';

async function main() {
  // 기존 데이터 정리 (안전한 재실행 보장)
  await prisma.savedRecipe.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.storage.deleteMany();
  await prisma.user.deleteMany();

  const passwordHashA = await bcrypt.hash('pass1234', 10);
  const passwordHashB = await bcrypt.hash('pass1234', 10);

  // 사용자 A (시드 기준 id=1, 기본 보관 구역 id=1,2,3)
  const userA = await prisma.user.create({
    data: {
      email: 'a@test.com',
      passwordHash: passwordHashA,
      name: '김자취',
      storages: {
        create: [
          { name: '냉장실', tempInfo: '0~5°C 신선 보관', sortOrder: 1 },
          { name: '냉동실', tempInfo: '-18°C 이하 장기 보관', sortOrder: 2 },
          { name: '실온 보관', tempInfo: '직사광선 피한 상온', sortOrder: 3 },
        ],
      },
    },
    include: { storages: { orderBy: { id: 'asc' } } },
  });

  // 사용자 B (시드 기준 id=2, 다른 사용자 403 권한 테스트용)
  await prisma.user.create({
    data: {
      email: 'b@test.com',
      passwordHash: passwordHashB,
      name: '이자취',
      storages: {
        create: [
          { name: '냉장실', tempInfo: '0~5°C 신선 보관', sortOrder: 1 },
        ],
      },
    },
  });

  const fridgeId = userA.storages[0]!.id;
  const freezerId = userA.storages[1]!.id;
  const pantryId = userA.storages[2]!.id;

  const now = new Date();
  const dateAt = (monthOffset: number, day: number) =>
    new Date(Date.UTC(now.getFullYear(), now.getMonth() + monthOffset, day));
  const daysFromNow = (days: number) =>
    dateAt(0, now.getDate() + days);
  const thisMonthDaysAgo = (days: number) =>
    dateAt(0, Math.max(1, now.getDate() - days));

  // 평가 요청에서 쓰는 식재료 id 1~3을 먼저 생성한다.
  await prisma.ingredient.createMany({
    data: [
      {
        userId: userA.id,
        storageId: freezerId,
        name: '냉동 닭가슴살',
        purchasedAt: daysFromNow(-3),
        expiresAt: daysFromNow(14),
        price: 6500,
        memo: '샐러드 및 볶음밥용',
        status: 'ACTIVE',
      },
      {
        userId: userA.id,
        storageId: fridgeId,
        name: '찌개용 두부',
        purchasedAt: daysFromNow(-2),
        expiresAt: daysFromNow(2), // 임박 (D-2)
        price: 2200,
        memo: '반 모 남음',
        status: 'ACTIVE',
      },
      {
        userId: userA.id,
        storageId: fridgeId,
        name: '서울우유 500ml',
        purchasedAt: daysFromNow(-10),
        expiresAt: daysFromNow(-2), // 만료 (D+2)
        price: 1800,
        memo: '소비기한 경과',
        status: 'ACTIVE',
      },
    ],
  });

  // 추천 탭에서 고를 수 있도록 냉장실, 냉동실, 실온에 재료를 골고루 배치한다.
  const currentStock = [
    { name: '달걀 6구', storageId: fridgeId, boughtAgo: 2, expiresIn: 9, price: 3200, memo: '볶음밥이나 덮밥에 사용' },
    { name: '대파', storageId: fridgeId, boughtAgo: 3, expiresIn: 1, price: 1600, memo: '한 대 남음' },
    { name: '애호박', storageId: fridgeId, boughtAgo: 2, expiresIn: 3, price: 1900, memo: '두부 된장국에 사용' },
    { name: '팽이버섯', storageId: fridgeId, boughtAgo: 3, expiresIn: 2, price: 1200 },
    { name: '배추김치', storageId: fridgeId, boughtAgo: 5, expiresIn: 16, price: 5900 },
    { name: '냉동 칵테일새우', storageId: freezerId, boughtAgo: 7, expiresIn: 38, price: 8900 },
    { name: '냉동 다진 마늘', storageId: freezerId, boughtAgo: 4, expiresIn: 50, price: 3600 },
    { name: '양파', storageId: pantryId, boughtAgo: 2, expiresIn: 12, price: 2500 },
    { name: '스파게티 면', storageId: pantryId, boughtAgo: 1, expiresIn: 90, price: 2400 },
  ];
  await prisma.ingredient.createMany({
    data: currentStock.map(({ boughtAgo, expiresIn, ...item }) => ({
      ...item,
      userId: userA.id,
      purchasedAt: thisMonthDaysAgo(boughtAgo),
      expiresAt: daysFromNow(expiresIn),
      status: 'ACTIVE',
    })),
  });

  // 이번 달 처리 기록은 월초에 실행해도 구매일과 소비기한이 이번 달에 들어간다.
  const processedThisMonth = [
    { name: '삼겹살', storageId: fridgeId, boughtAgo: 8, expiresAgo: 6, price: 7800, status: 'CONSUMED' },
    { name: '콩나물', storageId: fridgeId, boughtAgo: 6, expiresAgo: 4, price: 1400, status: 'CONSUMED' },
    { name: '오이', storageId: fridgeId, boughtAgo: 7, expiresAgo: 3, price: 1700, status: 'CONSUMED' },
    { name: '즉석 현미밥', storageId: pantryId, boughtAgo: 12, expiresAgo: 0, price: 2600, status: 'CONSUMED' },
    { name: '훈제오리', storageId: fridgeId, boughtAgo: 10, expiresAgo: 3, price: 6800, status: 'CONSUMED' },
    { name: '냉동 만두', storageId: freezerId, boughtAgo: 11, expiresAgo: 0, price: 4800, status: 'CONSUMED' },
    { name: '샐러드 채소', storageId: fridgeId, boughtAgo: 7, expiresAgo: 3, price: 4200, status: 'DISCARDED' },
    { name: '생크림', storageId: fridgeId, boughtAgo: 8, expiresAgo: 2, price: 3900, status: 'DISCARDED' },
    { name: '딸기', storageId: fridgeId, boughtAgo: 6, expiresAgo: 1, price: 6500, status: 'DISCARDED' },
  ];
  await prisma.ingredient.createMany({
    data: processedThisMonth.map(({ boughtAgo, expiresAgo, ...item }) => ({
      ...item,
      userId: userA.id,
      purchasedAt: thisMonthDaysAgo(boughtAgo),
      expiresAt: thisMonthDaysAgo(expiresAgo),
    })),
  });

  // 지난달 표본은 구매일과 소비기한이 모두 지난달이라 이번 달 처리 기록과 섞이지 않는다.
  const processedLastMonth = [
    { name: '돼지 앞다리살', storageId: fridgeId, boughtOn: 1, expiresOn: 4, price: 8900, status: 'CONSUMED' },
    { name: '양배추', storageId: fridgeId, boughtOn: 2, expiresOn: 10, price: 2600, status: 'CONSUMED' },
    { name: '순두부', storageId: fridgeId, boughtOn: 3, expiresOn: 8, price: 1800, status: 'CONSUMED' },
    { name: '숙주나물', storageId: fridgeId, boughtOn: 5, expiresOn: 7, price: 1500, status: 'CONSUMED' },
    { name: '냉동 고등어', storageId: freezerId, boughtOn: 6, expiresOn: 25, price: 6200, status: 'CONSUMED' },
    { name: '감자', storageId: pantryId, boughtOn: 9, expiresOn: 23, price: 2900, status: 'CONSUMED' },
    { name: '당근', storageId: fridgeId, boughtOn: 11, expiresOn: 20, price: 1600, status: 'CONSUMED' },
    { name: '모차렐라 치즈', storageId: fridgeId, boughtOn: 14, expiresOn: 26, price: 4400, status: 'CONSUMED' },
    { name: '우동면', storageId: pantryId, boughtOn: 16, expiresOn: 27, price: 2300, status: 'CONSUMED' },
    { name: '블루베리 요거트', storageId: fridgeId, boughtOn: 3, expiresOn: 11, price: 3900, status: 'DISCARDED' },
    { name: '깻잎', storageId: fridgeId, boughtOn: 7, expiresOn: 12, price: 1900, status: 'DISCARDED' },
    { name: '손질 오징어', storageId: fridgeId, boughtOn: 13, expiresOn: 16, price: 6900, status: 'DISCARDED' },
    { name: '브로콜리', storageId: fridgeId, boughtOn: 15, expiresOn: 21, price: 2800, status: 'DISCARDED' },
    { name: '모둠 베이글', storageId: pantryId, boughtOn: 19, expiresOn: 24, price: 5500, status: 'DISCARDED' },
  ];
  await prisma.ingredient.createMany({
    data: processedLastMonth.map(({ boughtOn, expiresOn, ...item }) => ({
      ...item,
      userId: userA.id,
      purchasedAt: dateAt(-1, boughtOn),
      expiresAt: dateAt(-1, expiresOn),
    })),
  });

  // 사용자 A 초기 저장 레시피 1건
  await prisma.savedRecipe.create({
    data: {
      userId: userA.id,
      title: '초간단 두부 간장조림',
      usedIngredients: '찌개용 두부, 대파, 간장, 설탕',
      cookingTime: '10분',
      steps: '1. 두부를 한 입 크기로 썰어 물기를 제거합니다.\n2. 팬에 노릇하게 부친 뒤 간장 양념을 넣고 졸입니다.',
      memo: '자취 반찬으로 최고',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  });

  console.log('시드 데이터 등록 완료: a@test.com / b@test.com (비밀번호: pass1234)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
