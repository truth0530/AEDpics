export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-4
  feedback: string[];
  suggestions: string[];
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // 최소 길이 체크 (10자로 강화)
  if (password.length < 10) {
    feedback.push('비밀번호는 최소 10자 이상이어야 합니다.');
    return { isValid: false, score: 0, feedback, suggestions: ['10자 이상의 비밀번호를 사용하세요.'] };
  }

  // 길이 점수
  if (password.length >= 10) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // 소문자 포함 체크 (필수)
  const hasLowerCase = /[a-z]/.test(password);
  if (!hasLowerCase) {
    feedback.push('소문자는 필수입니다.');
    return { isValid: false, score: 0, feedback, suggestions: ['소문자를 반드시 포함하세요.'] };
  }

  // 대문자 포함 체크 (필수)
  const hasUpperCase = /[A-Z]/.test(password);
  if (!hasUpperCase) {
    feedback.push('대문자는 필수입니다.');
    return { isValid: false, score: 0, feedback, suggestions: ['대문자를 반드시 포함하세요.'] };
  }
  score++;

  // 숫자 포함 체크 (필수)
  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    feedback.push('숫자는 필수입니다.');
    return { isValid: false, score: 0, feedback, suggestions: ['숫자를 반드시 포함하세요.'] };
  }
  score++;

  // 특수문자 포함 체크 (필수)
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  if (!hasSpecialChar) {
    feedback.push('특수문자는 필수입니다.');
    return { isValid: false, score: 0, feedback, suggestions: ['특수문자(!@#$ 등)를 반드시 포함하세요.'] };
  }
  score++;

  // 연속된 문자 체크
  const hasSequential = /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789)/i.test(password);
  if (hasSequential) {
    score = Math.max(0, score - 1);
    feedback.push('연속된 문자나 숫자는 피하세요.');
  }

  // 반복된 문자 체크
  const hasRepeating = /(.)\1{2,}/.test(password);
  if (hasRepeating) {
    score = Math.max(0, score - 1);
    feedback.push('같은 문자를 3번 이상 반복하지 마세요.');
  }

  // 일반적인 패턴 체크
  const commonPatterns = ['password', 'qwerty', 'asdfgh', 'zxcvbn', 'admin', 'letmein', 'welcome', 'monkey', 'dragon'];
  const lowerPassword = password.toLowerCase();
  const hasCommonPattern = commonPatterns.some(pattern => lowerPassword.includes(pattern));
  if (hasCommonPattern) {
    score = Math.max(0, score - 2);
    feedback.push('일반적인 단어나 패턴은 사용하지 마세요.');
  }

  // 점수를 4점 만점으로 정규화
  score = Math.min(4, Math.max(0, score));

  // 강도 메시지 설정
  const strengthMessages = [
    '매우 약함',
    '약함',
    '보통',
    '강함',
    '매우 강함'
  ];

  if (score < 2) {
    feedback.push(`비밀번호 강도: ${strengthMessages[score]}`);
    return { isValid: false, score, feedback, suggestions };
  }

  // score가 2 이상이면 유효
  return {
    isValid: true,
    score,
    feedback: [`비밀번호 강도: ${strengthMessages[score]}`],
    suggestions
  };
}

export function getPasswordStrengthColor(score: number): string {
  const colors = [
    'text-red-500',    // 0: 매우 약함
    'text-orange-500', // 1: 약함
    'text-yellow-500', // 2: 보통
    'text-green-400',  // 3: 강함
    'text-green-600'   // 4: 매우 강함
  ];
  return colors[Math.min(4, Math.max(0, score))];
}

export function getPasswordStrengthBarColor(score: number): string {
  const colors = [
    'bg-red-500',    // 0: 매우 약함
    'bg-orange-500', // 1: 약함
    'bg-yellow-500', // 2: 보통
    'bg-green-400',  // 3: 강함
    'bg-green-600'   // 4: 매우 강함
  ];
  return colors[Math.min(4, Math.max(0, score))];
}