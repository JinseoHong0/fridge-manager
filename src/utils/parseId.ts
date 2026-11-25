// 경로 매개변수 문자열을 양의 정수로 변환. 아니면 null
export function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}
