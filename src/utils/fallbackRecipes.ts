// 기본 레시피는 필요한 주재료가 모두 있을 때만 사용한다.
// 등록명에서 수량·보관 표기를 정리하되 '두부과자'를 '두부'로 인식하지 않는다.
interface PantryRecipe {
  title: string;
  ingredients: RegExp[];
  seasonings: string[];
  minutes: number;
  steps: string[];
}

const tofu = /^(찌개용|부침용)?두부$/;
const kimchi = /^(배추|포기)?김치$/;
const egg = /^(달걀|계란)$/;
const onion = /^양파$/;
const greenOnion = /^(대파|쪽파)$/;
const zucchini = /^애호박$/;
const pasta = /^(스파게티면?|파스타면)$/;
const garlic = /^(다진)?마늘$/;

const cookbook: PantryRecipe[] = [
  { title: '볶은 김치를 곁들인 두부', ingredients: [tofu, kimchi], seasonings: ['식용유'], minutes: 12,
    steps: ['두부는 도톰하게 썰어 끓는 물에 2분 데친 뒤 물기를 뺍니다.', '김치를 잘게 썰어 기름 두른 팬에서 중불로 4분 볶습니다.', '따뜻한 두부를 접시에 펼치고 볶은 김치를 얹습니다.'] },
  { title: '두부 김치국', ingredients: [tofu, kimchi], seasonings: ['간장'], minutes: 15,
    steps: ['냄비에 잘게 썬 김치 반 컵과 물 두 컵을 넣고 7분 끓입니다.', '두부 반 모를 깍둑썰기해 넣고 4분 더 끓입니다.', '국물을 맛보고 싱거우면 간장을 조금 넣습니다.'] },
  { title: '두부 달걀부침', ingredients: [tofu, egg], seasonings: ['소금', '식용유'], minutes: 12,
    steps: ['두부를 얇게 썰어 물기를 닦고 소금을 살짝 뿌립니다.', '달걀을 풀어 두부에 입힙니다.', '기름 두른 팬에 올려 달걀옷이 익고 양면이 노릇해질 때까지 부칩니다.'] },
  { title: '파 달걀국', ingredients: [greenOnion, egg], seasonings: ['소금'], minutes: 8,
    steps: ['파를 잘게 썰고 달걀 한 개를 풀어 둡니다.', '물 한 컵을 끓여 소금으로 간하고 파를 넣습니다.', '달걀물을 가늘게 둘러 넣고 달걀이 익을 때까지 끓입니다.'] },
  { title: '마늘 오일 스파게티', ingredients: [pasta, garlic], seasonings: ['식용유', '소금'], minutes: 15,
    steps: ['끓는 소금물에 면을 포장지에 표시된 시간만큼 삶고 면수를 조금 남깁니다.', '팬에 기름과 잘게 다진 마늘을 넣어 약불에서 향을 냅니다.', '면과 면수 두 숟갈을 넣고 기름이 면에 고루 묻도록 섞습니다.'] },
  { title: '양파 스파게티', ingredients: [pasta, onion], seasonings: ['식용유', '소금'], minutes: 15,
    steps: ['면을 포장지에 표시된 시간만큼 삶고 면수를 조금 남깁니다.', '양파 반 개를 가늘게 채 썰어 기름 두른 팬에 부드러워질 때까지 볶습니다.', '면과 면수를 조금 넣고 섞은 뒤 소금으로 간합니다.'] },
  { title: '오일 스파게티', ingredients: [pasta], seasonings: ['소금', '식용유'], minutes: 15,
    steps: ['면을 끓는 소금물에 삶아 건지고 면수를 반 컵 남깁니다.', '팬에 면과 식용유 한 숟갈, 면수 두 숟갈을 넣습니다.', '중불에서 잘 섞어 면에 윤기가 돌면 간을 맞춥니다.'] },
  { title: '바삭한 스파게티전', ingredients: [pasta], seasonings: ['식용유', '소금'], minutes: 20,
    steps: ['면을 푹 삶아 짧게 자르고 소금을 조금 뿌립니다.', '기름 두른 작은 팬에 면을 얇게 펼쳐 주걱으로 누릅니다.', '중약불로 바닥을 바삭하게 익힌 뒤 뒤집어 반대쪽도 굽습니다.'] },
  { title: '두부 소금구이', ingredients: [tofu], seasonings: ['소금', '식용유'], minutes: 10,
    steps: ['두부를 손가락 두께로 썰어 물기를 닦습니다.', '기름 두른 팬에서 중불로 앞뒤를 노릇하게 굽습니다.', '접시에 옮겨 소금을 가볍게 뿌립니다.'] },
  { title: '으깬 두부조림', ingredients: [tofu], seasonings: ['간장', '설탕'], minutes: 10,
    steps: ['두부 반 모를 포크로 굵게 으깹니다.', '팬에 두부와 물 세 숟갈, 간장 한 작은술, 설탕 한 꼬집을 넣습니다.', '중약불에서 가볍게 저으며 국물이 자작해질 때까지 졸입니다.'] },
  { title: '달걀찜', ingredients: [egg], seasonings: ['소금'], minutes: 12,
    steps: ['달걀 두 개에 물 반 컵과 소금 한 꼬집을 넣어 풉니다.', '작은 냄비에 담고 약불에서 바닥을 저으며 익힙니다.', '몽글몽글해지면 뚜껑을 덮고 약불에서 가운데까지 익힙니다.'] },
  { title: '달걀말이', ingredients: [egg], seasonings: ['소금', '식용유'], minutes: 10,
    steps: ['달걀 두 개를 소금 한 꼬집과 섞습니다.', '약불로 달군 팬에 기름을 얇게 바르고 달걀물을 반만 붓습니다.', '가장자리부터 말아 한쪽으로 밀고 남은 달걀물을 부어 다시 말아 속까지 익힙니다.'] },
  { title: '애호박 반달구이', ingredients: [zucchini], seasonings: ['소금', '식용유'], minutes: 10,
    steps: ['애호박을 반달 모양으로 얇게 썹니다.', '기름 두른 팬에 겹치지 않게 펴고 양면을 노릇하게 굽습니다.', '소금을 살짝 뿌려 마무리합니다.'] },
  { title: '애호박 맑은국', ingredients: [zucchini], seasonings: ['간장', '소금'], minutes: 12,
    steps: ['애호박을 가늘게 채 썹니다.', '물 두 컵이 끓으면 애호박과 간장 한 작은술을 넣습니다.', '호박이 부드러워지면 소금으로 간을 맞춥니다.'] },
];

export function findFallbackRecipes(names: string[]) {
  const ingredients = names.map(name => ({
    name,
    key: name.replace(/\s+/g, '').replace(/^냉동/, '').replace(/\d+(?:\.\d+)?(?:kg|ml|g|구|개|모|봉|단)$/i, ''),
  }));

  const matches = cookbook.flatMap(recipe => {
    const used: string[] = [];
    for (const pattern of recipe.ingredients) {
      const item = ingredients.find(ingredient => pattern.test(ingredient.key));
      if (!item) return [];
      used.push(item.name);
    }
    return [{ recipe, used, priority: Math.min(...used.map(name => names.indexOf(name))) }];
  });

  // 여러 재료를 함께 쓰는 요리, 그다음 선택 순서(자동 선택 시 소비기한 순)를 우선한다.
  return matches.sort((a, b) => b.used.length - a.used.length || a.priority - b.priority)
    .slice(0, 2).map(({ recipe, used }) => ({
      title: recipe.title, cookingTime: `${recipe.minutes}분`,
      usedIngredients: [...used, ...recipe.seasonings], steps: recipe.steps,
    }));
}
