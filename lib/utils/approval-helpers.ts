import { UserRole } from '@/packages/types';

export interface ApprovalSuggestion {
  role: UserRole;
  regionCode?: string;
  organizationId?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ApprovalGuideline {
  id: string;
  description: string;
  status: 'pass' | 'warning' | 'fail';
  weight: number;
}

// 이메일 기반 역할 추천
export function getSuggestedRole(email: string, organizationName?: string): UserRole {
  // Master 계정 체크
  const masterEmails = [
    'truth0530@nmc.or.kr',
    'inhak@nmc.or.kr',
    'woo@nmc.or.kr'
  ];

  if (masterEmails.includes(email)) {
    return 'master';
  }

  // NMC 계정 체크
  if (email.endsWith('@nmc.or.kr')) {
    return 'emergency_center_admin';
  }

  // korea.kr 계정 - 조직명으로 세분화
  if (email.endsWith('@korea.kr')) {
    if (!organizationName) {
      return 'local_admin';
    }

    // 보건복지부
    if (organizationName.includes('보건복지부')) {
      return 'ministry_admin';
    }

    // 시도청 (광역자치단체) - 예: "서울특별시청", "경기도청"
    const regionalKeywords = [
      '서울특별시청', '부산광역시청', '대구광역시청', '인천광역시청',
      '광주광역시청', '대전광역시청', '울산광역시청', '세종특별자치시청',
      '경기도청', '강원특별자치도청', '충청북도청', '충청남도청',
      '전북특별자치도청', '전라남도청', '경상북도청', '경상남도청', '제주특별자치도청'
    ];

    for (const keyword of regionalKeywords) {
      if (organizationName.includes(keyword)) {
        return 'regional_admin';
      }
    }

    // 보건소 (기초자치단체 보건소) - 예: "강남구보건소", "달서구보건소"
    if (organizationName.includes('보건소')) {
      return 'local_admin';
    }

    // 기타 korea.kr
    return 'local_admin';
  }

  // 개인 이메일 계정 (gmail, naver, daum 등) - 임시 점검원
  return 'temporary_inspector';
}

// 이메일 기반 지역 추천
export function getSuggestedRegion(email: string, organizationName?: string): string {
  // NMC 계정은 중앙
  if (email.endsWith('@nmc.or.kr')) {
    return '중앙';
  }

  // 보건복지부 계정은 중앙
  if (email.endsWith('@korea.kr') && organizationName?.includes('보건복지부')) {
    return '중앙';
  }

  // 조직명 기반 지역 추정 (모든 계정이 @korea.kr 사용)
  if (organizationName) {
    const regionKeywords = [
      { keyword: '서울', region: '서울특별시' },
      { keyword: '부산', region: '부산광역시' },
      { keyword: '대구', region: '대구광역시' },
      { keyword: '인천', region: '인천광역시' },
      { keyword: '광주', region: '광주광역시' },
      { keyword: '대전', region: '대전광역시' },
      { keyword: '울산', region: '울산광역시' },
      { keyword: '세종', region: '세종특별자치시' },
      { keyword: '경기', region: '경기도' },
      { keyword: '강원', region: '강원특별자치도' },
      { keyword: '충북', region: '충청북도' },
      { keyword: '충남', region: '충청남도' },
      { keyword: '전북', region: '전북특별자치도' },
      { keyword: '전남', region: '전라남도' },
      { keyword: '경북', region: '경상북도' },
      { keyword: '경남', region: '경상남도' },
      { keyword: '제주', region: '제주특별자치도' }
    ];

    for (const { keyword, region } of regionKeywords) {
      if (organizationName.includes(keyword)) {
        return region;
      }
    }
  }

  return ''; // 지역 미지정
}

// 승인 제안 생성
export function generateApprovalSuggestion(
  email: string,
  organizationName?: string
): ApprovalSuggestion {
  const suggestedRole = getSuggestedRole(email, organizationName);
  const suggestedRegion = getSuggestedRegion(email, organizationName);

  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let reason = '';

  // 신뢰도 계산
  if (email.endsWith('@nmc.or.kr')) {
    confidence = 'high';
    reason = 'NMC 공식 이메일로 자동 승인 권장';
  } else if (email.endsWith('@korea.kr')) {
    confidence = 'high';
    reason = '정부기관 공식 이메일로 승인 권장';
  } else {
    confidence = 'low';
    reason = '개인 이메일로 신중한 검토 필요';
  }

  return {
    role: suggestedRole,
    regionCode: suggestedRegion,
    confidence,
    reason
  };
}

// 승인 가이드라인 체크
export function getApprovalGuidelines(
  email: string,
  organizationName?: string,
  phone?: string,
  remarks?: string
): ApprovalGuideline[] {
  const guidelines: ApprovalGuideline[] = [];

  // 이메일 도메인 체크
  if (email.endsWith('@nmc.or.kr') || email.endsWith('@korea.kr')) {
    guidelines.push({
      id: 'email_domain',
      description: '공식 기관 이메일 사용',
      status: 'pass',
      weight: 10
    });
  } else {
    guidelines.push({
      id: 'email_domain',
      description: '개인 이메일 사용 - 소속 확인 필요',
      status: 'warning',
      weight: 3
    });
  }

  // 소속기관 정보 체크
  if (organizationName && organizationName.trim().length > 0) {
    guidelines.push({
      id: 'organization',
      description: '소속기관 정보 제공됨',
      status: 'pass',
      weight: 7
    });
  } else {
    guidelines.push({
      id: 'organization',
      description: '소속기관 정보 미제공',
      status: 'warning',
      weight: 0
    });
  }

  // 연락처 체크
  if (phone && phone.trim().length > 0) {
    guidelines.push({
      id: 'phone',
      description: '연락처 정보 제공됨',
      status: 'pass',
      weight: 5
    });
  } else {
    guidelines.push({
      id: 'phone',
      description: '연락처 정보 미제공',
      status: 'warning',
      weight: 0
    });
  }

  // 신청 사유 체크
  if (remarks && remarks.trim().length > 10) {
    guidelines.push({
      id: 'remarks',
      description: '상세한 신청 사유 제공됨',
      status: 'pass',
      weight: 6
    });
  } else if (remarks && remarks.trim().length > 0) {
    guidelines.push({
      id: 'remarks',
      description: '간단한 신청 사유 제공됨',
      status: 'warning',
      weight: 3
    });
  } else {
    guidelines.push({
      id: 'remarks',
      description: '신청 사유 미제공',
      status: 'fail',
      weight: 0
    });
  }

  // 이메일과 소속기관 일치성 체크 (korea.kr 계정)
  if (organizationName && email.endsWith('@korea.kr')) {
    const hasMatchingKeywords = organizationName.includes('보건') ||
                               organizationName.includes('의료') ||
                               organizationName.includes('병원') ||
                               organizationName.includes('센터') ||
                               organizationName.includes('시청') ||
                               organizationName.includes('도청');

    if (hasMatchingKeywords) {
      guidelines.push({
        id: 'email_org_consistency',
        description: '이메일 도메인과 소속기관이 일치함',
        status: 'pass',
        weight: 8
      });
    } else {
      guidelines.push({
        id: 'email_org_consistency',
        description: '이메일 도메인과 소속기관 일치성 검토 필요',
        status: 'warning',
        weight: 2
      });
    }
  }

  // 의심스러운 패턴 체크
  const suspiciousPatterns = [
    { pattern: /test|temp|임시/i, description: '임시/테스트 계정으로 의심됨' },
    { pattern: /admin|root|system/i, description: '시스템 계정으로 의심됨' },
    { pattern: /^[a-z]+[0-9]+@/, description: '자동 생성된 계정으로 의심됨' }
  ];

  for (const { pattern, description } of suspiciousPatterns) {
    if (pattern.test(email) || (organizationName && pattern.test(organizationName))) {
      guidelines.push({
        id: 'suspicious_pattern',
        description: description,
        status: 'fail',
        weight: -5
      });
      break; // 하나만 체크하고 중단
    }
  }

  // 완성도 체크
  const providedFields = [email, organizationName, phone, remarks].filter(field =>
    field && field.trim().length > 0
  ).length;

  if (providedFields >= 4) {
    guidelines.push({
      id: 'completeness',
      description: '모든 정보가 완전히 제공됨',
      status: 'pass',
      weight: 5
    });
  } else if (providedFields >= 3) {
    guidelines.push({
      id: 'completeness',
      description: '대부분의 정보가 제공됨',
      status: 'pass',
      weight: 3
    });
  } else {
    guidelines.push({
      id: 'completeness',
      description: '제공된 정보가 부족함',
      status: 'warning',
      weight: 1
    });
  }

  return guidelines;
}

// 승인 추천 결정
export function getApprovalRecommendation(guidelines: ApprovalGuideline[]): {
  action: 'auto_approve' | 'review_approve' | 'careful_review' | 'reject';
  reason: string;
  score: number;
} {
  const totalScore = guidelines.reduce((sum, guideline) => sum + guideline.weight, 0);
  const failCount = guidelines.filter(g => g.status === 'fail').length;
  const passCount = guidelines.filter(g => g.status === 'pass').length;
  const warningCount = guidelines.filter(g => g.status === 'warning').length;

  // 의심스러운 패턴이 있으면 무조건 거부 또는 신중 검토
  const hasSuspiciousPattern = guidelines.some(g => g.id === 'suspicious_pattern' && g.status === 'fail');
  if (hasSuspiciousPattern) {
    return {
      action: 'reject',
      reason: '의심스러운 패턴 발견으로 거부 권장',
      score: totalScore
    };
  }

  // 점수 기반 결정 (개선된 기준)
  if (totalScore >= 30 && failCount === 0 && passCount >= 5) {
    return {
      action: 'auto_approve',
      reason: '모든 기준을 우수하게 충족하여 자동 승인 권장',
      score: totalScore
    };
  } else if (totalScore >= 22 && failCount === 0 && passCount >= 3) {
    return {
      action: 'review_approve',
      reason: '대부분의 기준을 충족하여 승인 권장',
      score: totalScore
    };
  } else if (totalScore >= 15 || (totalScore >= 10 && failCount <= 1)) {
    return {
      action: 'careful_review',
      reason: `추가 검토 필요 (통과: ${passCount}, 경고: ${warningCount}, 실패: ${failCount})`,
      score: totalScore
    };
  } else {
    return {
      action: 'reject',
      reason: `기본 요건 미충족으로 거부 권장 (점수: ${totalScore})`,
      score: totalScore
    };
  }
}

// 역할 표시명 반환
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    master: 'Master',
    emergency_center_admin: '중앙응급의료센터',
    regional_emergency_center_admin: '응급의료지원센터',
    ministry_admin: '보건복지부',
    regional_admin: '시도 관리자',
    local_admin: '보건소 담당자',
    temporary_inspector: '임시 점검원',
    pending_approval: '승인 대기',
    email_verified: '이메일 인증됨',
    rejected: '승인 거부됨'
  };
  return names[role] || role;
}

// 역할 배지 색상 반환
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    master: 'bg-purple-500',
    emergency_center_admin: 'bg-red-500',
    regional_emergency_center_admin: 'bg-red-600',
    ministry_admin: 'bg-blue-500',
    regional_admin: 'bg-green-500',
    local_admin: 'bg-yellow-500',
    temporary_inspector: 'bg-orange-500',
    pending_approval: 'bg-gray-500',
    email_verified: 'bg-gray-400',
    rejected: 'bg-red-700'
  };
  return colors[role] || 'bg-gray-500';
}

// 승인 가이드라인 통계 계산
export function getGuidelineStats(guidelines: ApprovalGuideline[]): {
  totalScore: number;
  maxPossibleScore: number;
  passRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  categories: {
    pass: number;
    warning: number;
    fail: number;
  };
} {
  const totalScore = guidelines.reduce((sum, guideline) => sum + guideline.weight, 0);
  const maxPossibleScore = guidelines.reduce((sum, guideline) => {
    return sum + (guideline.weight > 0 ? guideline.weight : 0);
  }, 0);

  const passRate = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

  const categories = {
    pass: guidelines.filter(g => g.status === 'pass').length,
    warning: guidelines.filter(g => g.status === 'warning').length,
    fail: guidelines.filter(g => g.status === 'fail').length
  };

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (categories.fail > 0 || passRate < 50) {
    riskLevel = 'high';
  } else if (categories.warning > 2 || passRate < 75) {
    riskLevel = 'medium';
  }

  return {
    totalScore,
    maxPossibleScore,
    passRate,
    riskLevel,
    categories
  };
}

// 빠른 승인 가능성 체크
export function canQuickApprove(guidelines: ApprovalGuideline[]): boolean {
  const stats = getGuidelineStats(guidelines);
  const recommendation = getApprovalRecommendation(guidelines);

  return (
    recommendation.action === 'auto_approve' ||
    (recommendation.action === 'review_approve' && stats.riskLevel === 'low')
  );
}

// 가이드라인 요약 텍스트 생성
export function getGuidelineSummary(guidelines: ApprovalGuideline[]): string {
  const stats = getGuidelineStats(guidelines);
  const recommendation = getApprovalRecommendation(guidelines);

  const riskMessages = {
    low: '낮은 위험도',
    medium: '보통 위험도',
    high: '높은 위험도'
  };

  return `점수 ${stats.totalScore}/${stats.maxPossibleScore} (${stats.passRate.toFixed(0)}%) - ${riskMessages[stats.riskLevel]} - ${recommendation.reason}`;
}