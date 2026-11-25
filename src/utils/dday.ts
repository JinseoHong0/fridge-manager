export type RiskLevel = 'SAFE' | 'IMMINENT' | 'EXPIRED';

export interface DdayInfo {
  dDay: number;
  dDayLabel: string;
  riskLevel: RiskLevel;
  riskLabel: string;
}

// 현재 날짜(자정 기준)와 소비기한(expiresAt)을 비교하여 D-Day 및 위험도 분류
export function calculateDday(expiresAt: Date): DdayInfo {
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expUtc = Date.UTC(
    expiresAt.getFullYear(),
    expiresAt.getMonth(),
    expiresAt.getDate(),
  );

  const diffDays = Math.floor((expUtc - todayUtc) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      dDay: diffDays,
      dDayLabel: `D+${Math.abs(diffDays)}`,
      riskLevel: 'EXPIRED',
      riskLabel: '만료',
    };
  }
  if (diffDays <= 3) {
    return {
      dDay: diffDays,
      dDayLabel: diffDays === 0 ? 'D-Day' : `D-${diffDays}`,
      riskLevel: 'IMMINENT',
      riskLabel: '임박',
    };
  }
  return {
    dDay: diffDays,
    dDayLabel: `D-${diffDays}`,
    riskLevel: 'SAFE',
    riskLabel: '안전',
  };
}
