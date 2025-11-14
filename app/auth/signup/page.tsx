'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isAllowedEmailDomain, getAccountType } from '@/lib/auth/config';
import { getAllowedRolesForDomain } from '@/lib/auth/access-control';
import { SignUpData } from '@/packages/types';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';
import { getAvailableRegions, getOrganizationsByEmailDomain } from '@/lib/data/organizations';
import { getRegionCode } from '@/lib/constants/regions';
import { OTPInput } from '@/components/ui/otp-input';
import { TermsModal } from '@/components/ui/terms-modal';
import { TermsContent } from '@/components/content/terms';
import { PrivacyContent } from '@/components/content/privacy';
import { validatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthBarColor } from '@/lib/auth/password-validator';
import { OrganizationAutocomplete } from '@/components/ui/organization-autocomplete';
import { extractRetryInfo } from '@/lib/utils/rate-limit-helper';
import { formatPhoneNumber, validatePhoneNumber, getPhoneErrorMessage, isMobilePhone } from '@/lib/utils/phone';
import { getRegionFromPhone } from '@/lib/utils/area-code';

export default function ImprovedSignUpPage() {
  const router = useRouter();
  
  // 단계별 상태 관리
  const [currentStep, setCurrentStep] = useState(1); // 1: 이메일, 2: OTP, 3: 정보입력, 4: 완료
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 이메일 인증 상태
  const [email, setEmail] = useState('');
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailCheckMessage, setEmailCheckMessage] = useState<string>('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0); // 재발송 쿨다운 (3분)
  const [resendAttemptsLeft, setResendAttemptsLeft] = useState(3); // 남은 재발송 횟수
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // 타이머 참조 (메모리 누수 방지)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null); // 리다이렉트 타이머 추가
  const emailCheckTimerRef = useRef<NodeJS.Timeout | null>(null); // 이메일 체크 디바운스
  const emailMessageTimerRef = useRef<NodeJS.Timeout | null>(null); // 이메일 메시지 타이머

  // 약관 동의
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  
  // 회원가입 폼 데이터
  const [formData, setFormData] = useState<SignUpData>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    region: '',
    organizationName: '',
    customOrganizationName: '', // 기타 선택 시 수기 입력값
    remarks: '',
    organizationId: ''
  });
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string[]; suggestions: string[] }>({ score: 0, feedback: [], suggestions: [] });
  const [showOrgWarning, setShowOrgWarning] = useState(false);
  const [orgWarningConfirmed, setOrgWarningConfirmed] = useState(false);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);

  // Supabase 실시간 데이터 상태
  const [dynamicRegions, setDynamicRegions] = useState<string[]>([]);
  const [dynamicOrganizations, setDynamicOrganizations] = useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);

  // 기존 하드코딩된 데이터를 폴백으로 사용
  const regions = dynamicRegions.length > 0 ? dynamicRegions : (verifiedEmail ? getAvailableRegions(verifiedEmail) : []);
  const accountType = verifiedEmail ? getAccountType(verifiedEmail) : null;

  // Supabase에서 지역 목록 가져오기
  useEffect(() => {
    const fetchRegions = async () => {
      if (!verifiedEmail) return;

      setLoadingRegions(true);
      try {
        const response = await fetch('/api/health-centers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          // 이메일 도메인에 따른 필터링
          const domain = verifiedEmail.split('@')[1];
          let filteredRegions = data.regions;

          if (domain === 'nmc.or.kr') {
            // nmc.or.kr 사용자는 모든 지역 선택 가능
            // 조직 선택에 따라 지역이 자동 결정됨
            filteredRegions = data.regions;
          } else if (domain !== 'korea.kr') {
            filteredRegions = data.regions.filter((r: string) => r !== '중앙');
          }

          setDynamicRegions(filteredRegions);
        }
      } catch (error) {
        console.error('Failed to fetch regions:', error);
        // 폴백으로 하드코딩된 데이터 사용
      } finally {
        setLoadingRegions(false);
      }
    };

    fetchRegions();
  }, [verifiedEmail]);

  // 지역 선택 시 해당 지역의 조직 목록 가져오기
  useEffect(() => {
    if (!formData.region) {
      setDynamicOrganizations([]);
      return;
    }

    const fetchOrganizations = async () => {
      const emailToUse = verifiedEmail || email;
      if (!emailToUse) return;

      const domain = emailToUse.split('@')[1];

      // 임시 점검원(일반 이메일)인 경우 local_admin이 있는 조직만 가져오기
      if (domain !== 'korea.kr' && domain !== 'nmc.or.kr') {
        try {
          const response = await fetch(`/api/organizations/with-admin?region=${encodeURIComponent(formData.region)}`);
          if (response.ok) {
            const data = await response.json();
            const orgNames = data.organizations.map((org: any) =>
              org.adminCount > 0 ? org.name : `${org.name} ⚠️ (담당자 없음)`
            );
            setDynamicOrganizations(orgNames);
          }
        } catch (error) {
          console.error('Failed to fetch organizations with admin:', error);
          // 폴백으로 기존 방식 사용
          const organizations = getOrganizationsByEmailDomain(emailToUse, formData.region);
          setDynamicOrganizations(organizations);
        }
      } else {
        // korea.kr 또는 nmc.or.kr은 기존 방식 유지
        const organizations = getOrganizationsByEmailDomain(emailToUse, formData.region);
        setDynamicOrganizations(organizations);
      }
    };

    fetchOrganizations();
  }, [formData.region, verifiedEmail, email]);

  // 실시간 이메일 중복 체크
  useEffect(() => {
    if (!email || email.length < 5) {
      setEmailAvailable(null);
      setEmailCheckMessage('');
      return;
    }

    // 디바운스 처리
    if (emailCheckTimerRef.current) {
      clearTimeout(emailCheckTimerRef.current);
    }

    setEmailCheckLoading(true);
    emailCheckTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          cache: 'no-store',
          body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
          setEmailAvailable(data.available);
          setEmailCheckMessage(data.message || '');
        } else if (response.status === 429) {
          // Rate limit 에러 시 사용자에게 알림
          const { message } = extractRetryInfo(response, data);
          setEmailAvailable(null);
          setEmailCheckMessage(message);

          // 이전 타이머 정리
          if (emailMessageTimerRef.current) {
            clearTimeout(emailMessageTimerRef.current);
          }

          // 3초 후 메시지 제거
          emailMessageTimerRef.current = setTimeout(() => {
            setEmailCheckMessage('');
            emailMessageTimerRef.current = null;
          }, 3000);
        }
      } catch (error) {
        // 네트워크 에러는 조용히 처리 (실시간 체크는 보조 기능)
        console.debug('Email check error:', error);
      } finally {
        setEmailCheckLoading(false);
      }
    }, 500); // 500ms 디바운스
  }, [email]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      if (emailCheckTimerRef.current) {
        clearTimeout(emailCheckTimerRef.current);
      }
    };
  }, []);

  // Step 1: 이메일 입력 및 OTP 발송
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 이전 리다이렉트 타이머 정리
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    // 이메일 도메인 검증
    if (!isAllowedEmailDomain(email)) {
      setError('허용되지 않은 이메일 도메인입니다.');
      setLoading(false);
      return;
    }

    try {
      // Custom OTP API 호출
      console.log('Attempting to send OTP');
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        // Rate limiting 처리
        if (response.status === 429) {
          const { message } = extractRetryInfo(response, data);
          setError(message);
        }
        // 이미 가입된 이메일인 경우 로그인 페이지로 유도
        else if (data.code === 'EMAIL_ALREADY_EXISTS') {
          setError(data.error || '이미 가입된 이메일입니다.');
          // 3초 후 로그인 페이지로 이동
          redirectTimerRef.current = setTimeout(() => {
            router.push('/auth/login?email=' + encodeURIComponent(email));
          }, 3000);
        } else {
          setError(data.error || '인증번호 발송 실패');
        }
      } else {
        setCurrentStep(2); // OTP 입력 단계로
        setRemainingTime(900); // 15분
        setResendCooldown(180); // 3분 쿨다운
        setResendAttemptsLeft(3); // 재발송 횟수 초기화
        startCountdown();
        startResendCooldown();
        console.log('인증번호가 이메일로 발송되었습니다.');
      }
    } catch {
      setError('인증번호 발송 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP 검증
  const handleVerifyOTP = async (otp: string) => {
    setOtpLoading(true);
    setOtpError(null);
    setOtpSuccess(false);

    try {
      // Custom OTP 검증 API 호출
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp })
      });

      const data = await response.json();

      if (!response.ok) {
        // Rate limiting 처리
        if (response.status === 429) {
          const { message } = extractRetryInfo(response, data);
          setOtpError(message);
        }
        // 이미 가입된 이메일인 경우
        else if (data.code === 'EMAIL_ALREADY_EXISTS') {
          setOtpError(data.error || '이미 가입된 이메일입니다.');
          // 이전 리다이렉트 타이머 정리
          if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
          }
          // 3초 후 로그인 페이지로 이동
          redirectTimerRef.current = setTimeout(() => {
            router.push('/auth/login?email=' + encodeURIComponent(email));
          }, 3000);
        } else {
          setOtpError(data.error || '인증번호가 올바르지 않습니다.');
        }
      } else {
        setOtpSuccess(true);
        setVerifiedEmail(email);
        setFormData({ ...formData, email });

        // 인증 성공 - 정보 입력 단계로
        setTimeout(() => {
          setCurrentStep(3);
        }, 1500);
      }
    } catch {
      setOtpError('인증 중 오류가 발생했습니다.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 3: 회원가입 완료
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('회원가입 시작');
    setLoading(true);
    setError(null);

    // 비밀번호 강도 검증
    const passwordValidation = validatePasswordStrength(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.feedback.join(' '));
      setLoading(false);
      return;
    }

    // 비밀번호 일치 확인
    if (formData.password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (!formData.fullName || !formData.region || !formData.organizationName) {
      setError('필수 항목을 모두 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError('약관에 동의해주세요.');
      setLoading(false);
      return;
    }

    // 소속기관 검증 - 목록에 없는 기관인 경우 경고
    const isOrgInList = dynamicOrganizations.includes(formData.organizationName);
    console.log('소속기관 검증:', {
      organizationName: formData.organizationName,
      dynamicOrganizations,
      isOrgInList,
      orgWarningConfirmed
    });

    if (!isOrgInList && formData.organizationName !== '기타 (직접 입력)' && !orgWarningConfirmed) {
      console.log('경고 모달 표시');
      setShowOrgWarning(true);
      setLoading(false);
      return;
    }

    try {
      // 기타 선택 시 customOrganizationName을 사용, 아니면 organizationName 사용
      const finalOrgName = (formData.organizationName === '기타 (직접 입력)' && formData.customOrganizationName)
        ? formData.customOrganizationName
        : formData.organizationName;

      // 조직 ID 조회 (API를 통해)
      const regionCode = getRegionCode(formData.region);
      let organizationId = null;

      if (finalOrgName && finalOrgName !== '기타 (직접 입력)') {
        console.log('[DEBUG] 조직 조회 시작:', { finalOrgName });
        const orgResponse = await fetch(`/api/organizations/search?name=${encodeURIComponent(finalOrgName)}`);

        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          if (orgData.id) {
            organizationId = orgData.id;
          }
        }
        console.log('[DEBUG] 조직 조회 결과:', { organizationId });
      }

      // NextAuth Signup API 호출 (bcrypt 비밀번호 해싱 포함)
      console.log('[DEBUG] NextAuth Signup API 호출 시작');
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifiedEmail,
          password: formData.password,
          profileData: {
            email: verifiedEmail,
            fullName: formData.fullName,
            phone: formData.phone,
            region: formData.region,
            regionCode: regionCode,
            organizationName: finalOrgName,
            organizationId: organizationId,
            remarks: formData.remarks,
            accountType: accountType ?? 'public',
            role: 'pending_approval',
            isActive: false
          }
        })
      });

      const signupResult = await signupResponse.json();
      console.log('[DEBUG] NextAuth Signup API 결과:', signupResult);

      if (!signupResponse.ok || !signupResult.success) {
        const errorMsg = signupResult.error || '회원가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
        console.error('Signup error details:', signupResult);

        // 이메일 중복인 경우 (409 Conflict) 로그인 페이지로 리다이렉트
        if (signupResponse.status === 409 || signupResult.code === 'EMAIL_ALREADY_EXISTS') {
          setError('이미 가입된 이메일입니다. 3초 후 로그인 페이지로 이동합니다.');
          setTimeout(() => {
            router.push('/auth/signin?email=' + encodeURIComponent(verifiedEmail));
          }, 3000);
          return;
        }

        throw new Error(errorMsg);
      }

      const data = { user: signupResult.user };

      if (data.user) {
        // 프로필은 서버에서 이미 생성됨

        // 관리자에게 실시간 알림 및 이메일 발송
        try {
          const regionCode = getRegionCode(formData.region);

          // regionCode 검증 로깅 (매핑 실패 감지)
          if (!regionCode || regionCode === formData.region) {
            console.warn(
              '[SIGNUP] Region code mapping issue',
              {
                region: formData.region,
                regionCode: regionCode,
                status: regionCode === formData.region ? 'UNMAPPED' : 'INVALID',
                userEmail: verifiedEmail,
                message: 'Region label might not be properly mapped. This will cause admin notifications to only go to master/central admins'
              }
            );
          }

          // 실시간 알림 발송
          await fetch('/api/notifications/new-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: verifiedEmail,
              userName: formData.fullName,
              organizationName: finalOrgName,
              region: formData.region,
              regionCode: regionCode,
              accountType: accountType
            })
          });

          // 기존 이메일 알림도 유지
          await fetch('/api/admin/notify-new-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: verifiedEmail,
              fullName: formData.fullName,
              organizationName: finalOrgName,
              region: formData.region,
              regionCode: regionCode,
              accountType: accountType
            })
          });
        } catch (notifyError) {
          console.error('Admin notification error:', notifyError);
          // 알림 실패해도 회원가입은 계속 진행
        }

        // 회원가입 완료 단계로 이동
        setCurrentStep(4);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 카운트다운 타이머
  const startCountdown = () => {
    // 기존 타이머가 있다면 정리
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 재발송 쿨다운 타이머
  const startResendCooldown = () => {
    // 기존 타이머가 있다면 정리
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
    }

    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) {
            clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 인증번호 재발송
  const handleResendOTP = async () => {
    setOtpError(null);
    setOtpSuccess(false);
    
    try {
      // Custom OTP API 호출 (초기 발송과 동일)
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (!response.ok) {
        setOtpError(data.error || '재발송에 실패했습니다.');
      } else {
        setRemainingTime(900); // 15분
        setResendCooldown(180); // 3분 쿨다운
        setResendAttemptsLeft(prev => Math.max(0, prev - 1));
        startCountdown();
        startResendCooldown();
        console.log('인증번호가 재발송되었습니다.');
      }
    } catch {
      setOtpError('재발송 중 오류가 발생했습니다.');
    }
  };

  // 시간 포맷팅
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 재발송 버튼 상태 계산
  const getResendButtonState = () => {
    if (resendCooldown > 0) {
      return {
        disabled: true,
        text: `재발송 가능 (${formatTime(resendCooldown)})`
      };
    }
    if (resendAttemptsLeft <= 0) {
      return {
        disabled: true,
        text: '재발송 횟수 초과'
      };
    }
    return {
      disabled: false,
      text: `인증번호 재발송`
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md mx-auto pt-8">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
        >
          ← 뒤로가기
        </button>

        <GlassCard glow>
          <h1 className="text-2xl font-bold text-white mb-2 text-center">
            AED 픽스 회원가입
          </h1>
          
          {/* 진행 단계 표시 */}
          <div className="flex items-center justify-center mb-8 space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep >= 1 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>1</div>
            <div className={`w-16 h-1 ${currentStep >= 2 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep >= 2 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>2</div>
            <div className={`w-16 h-1 ${currentStep >= 3 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep >= 3 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>3</div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: 이메일 입력 */}
          {currentStep === 1 && (
            <form onSubmit={handleEmailSubmit}>
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-400 text-sm font-semibold mb-2">
                  📧 이메일 도메인에 따른 역할 안내
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <div>
                      <span className="text-green-400 font-medium">@korea.kr</span>
                      <span className="text-gray-300"> → 보건복지부/시도/보건소 관리자</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <div>
                      <span className="text-green-400 font-medium">@nmc.or.kr</span>
                      <span className="text-gray-300"> → 중앙/권역 응급의료센터 관리자</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">⚠</span>
                    <div>
                      <span className="text-yellow-400 font-medium">기타 도메인</span>
                      <span className="text-gray-300"> → 임시 점검원 (제한된 권한)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    이메일 <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      className={`w-full px-4 py-3 pr-10 bg-gray-800/50 backdrop-blur-xl border ${
                        emailAvailable === false ? 'border-red-500' :
                        emailAvailable === true ? 'border-green-500' :
                        'border-gray-700'
                      } rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors`}
                      placeholder="example@korea.kr"
                      required
                    />
                    {/* 실시간 상태 표시 */}
                    {emailCheckLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                    {!emailCheckLoading && emailAvailable === true && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                        ✓
                      </div>
                    )}
                    {!emailCheckLoading && emailAvailable === false && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                        ✗
                      </div>
                    )}
                  </div>
                  {/* 상태 메시지 */}
                  {emailCheckMessage && (
                    <p className={`text-xs mt-1 ${
                      emailAvailable === true ? 'text-green-400' :
                      emailAvailable === false ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {emailCheckMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* 일반 이메일 입력 시 경고 메시지 */}
              {(() => {
                if (!email.includes('@')) return false;

                const domain = email.split('@')[1] || '';

                // korea.kr 또는 nmc.or.kr로 완성되었거나 진행 중이면 숨김
                if (email.endsWith('@korea.kr') || email.endsWith('@nmc.or.kr')) return false;

                // nmc.or.kr 입력 중이면 숨김 (n, nm, nmc, nmc., nmc.o, nmc.or, nmc.or., nmc.or.k, nmc.or.kr)
                if (domain.length > 0 && 'nmc.or.kr'.startsWith(domain)) return false;

                // korea.kr 입력 중이면 숨김 (k, ko, kor, kore, korea, korea., korea.k, korea.kr)
                if (domain.length > 0 && 'korea.kr'.startsWith(domain)) return false;

                // @ 다음에 k가 아닌 다른 문자가 입력되었을 때만 표시
                if (domain.length > 0 && !domain.startsWith('k') && !domain.startsWith('n')) {
                  return true;
                }

                // @ 다음에 k로 시작하지만 korea.kr이 될 가능성이 없을 때
                if (domain.startsWith('k') && domain.length > 1 && !'korea.kr'.startsWith(domain)) {
                  return true;
                }

                // @ 다음에 n으로 시작하지만 nmc.or.kr이 될 가능성이 없을 때
                if (domain.startsWith('n') && domain.length > 1 && !'nmc.or.kr'.startsWith(domain)) {
                  return true;
                }

                return false;
              })() && (
                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <p className="text-orange-400 text-sm font-medium mb-2">
                    ⚠️ korea.kr계정이 아니면 임시 점검원으로 등록됩니다.
                  </p>
                  <ul className="text-gray-400 text-xs space-y-0.5 mb-2">
                    <li>• 보건소에서 할당한 AED만 점검 가능</li>
                    <li>• 전체 데이터 열람 불가</li>
                    <li>• 보고서 생성 기능 불가</li>
                  </ul>
                  <p className="text-gray-300 text-xs font-medium mb-1">
                    계속하시려면 아래 &apos;인증번호 발송&apos; 버튼을 눌러주세요.
                  </p>
                  <p className="text-gray-400 text-xs">
                    모든 계정은 관리자 승인 후 활성화됩니다.
                  </p>
                </div>
              )}

              <div className="mt-6">
                <NeoButton
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  disabled={loading || !email || emailAvailable === false}
                >
                  인증번호 발송
                </NeoButton>
              </div>
            </form>
          )}

          {/* Step 2: OTP 입력 */}
          {currentStep === 2 && (
            <div className="text-center py-4">
              <h2 className="text-xl font-semibold text-white mb-3">
                이메일 인증번호 입력
              </h2>
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-4 mb-4">
                <p className="text-green-400 font-semibold mb-2">{email}</p>
                <p className="text-gray-400 text-sm">
                  위 이메일로 6자리 인증번호를 발송했습니다
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
                  {remainingTime > 0 && (
                    <div className="text-left">
                      <p className="text-gray-500 text-xs">인증번호 유효시간</p>
                      <p className="text-yellow-400 text-sm font-semibold">
                        {formatTime(remainingTime)}
                      </p>
                    </div>
                  )}
                  {resendAttemptsLeft < 3 && (
                    <div className="text-right">
                      <p className="text-gray-500 text-xs">남은 재발송 횟수</p>
                      <p className={`text-sm font-semibold ${
                        resendAttemptsLeft > 0 ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        {resendAttemptsLeft}회
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <OTPInput
                  length={6}
                  onComplete={handleVerifyOTP}
                  loading={otpLoading}
                  error={otpError}
                  success={otpSuccess}
                />
              </div>

              {/* 스팸메일함 확인 안내 */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
                <p className="text-yellow-400 text-sm font-medium mb-1 text-left">
                  이메일이 오지 않았나요?
                </p>
                <ul className="text-gray-400 text-xs space-y-1 text-left">
                  <li>• noreply@aed.pics에서 발송된 메일을 찾아주세요</li>
                  <li>• 스팸메일함을 확인해주세요</li>
                  <li>• 이메일 도착까지 최대 1분이 소요될 수 있습니다</li>
                </ul>
              </div>

              {/* 재발송 정책 안내 */}
              {resendCooldown > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
                  <p className="text-blue-400 text-xs text-left">
                    재발송은 3분 간격으로 가능합니다. 기존 인증번호는 15분간 유효하니 먼저 이메일 수신 여부를 확인해주세요.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <NeoButton
                  variant="secondary"
                  fullWidth
                  size="sm"
                  onClick={handleResendOTP}
                  disabled={getResendButtonState().disabled}
                >
                  {getResendButtonState().text}
                </NeoButton>
                <NeoButton
                  variant="ghost"
                  fullWidth
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                >
                  이메일 변경
                </NeoButton>
              </div>
            </div>
          )}

          {/* Step 3: 정보 입력 */}
          {currentStep === 3 && (
            <form onSubmit={handleCompleteSignup}>
              <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-green-400 text-lg">✓</span>
                  <div className="flex-1">
                    <p className="text-green-400 text-sm font-semibold">
                      이메일 인증 완료
                    </p>
                    <p className="text-gray-300 text-xs mt-0.5">
                      {verifiedEmail}
                    </p>
                  </div>
                </div>
                {(() => {
                  const domain = verifiedEmail.split('@')[1]?.toLowerCase();
                  const allowedRoles = getAllowedRolesForDomain(verifiedEmail);

                  if (domain === 'korea.kr') {
                    return (
                      <div className="mt-3 pt-3 border-t border-green-500/20">
                        <p className="text-green-400 text-xs font-medium mb-2">
                          🏛️ 정부기관 이메일 (@korea.kr)
                        </p>
                        <ul className="text-gray-300 text-xs space-y-1">
                          <li>• 승인 가능 역할: 보건복지부, 시도 관리자, 보건소 담당자</li>
                          <li>• 관리자가 소속 기관에 따라 적절한 역할 부여</li>
                          <li>• 전체 데이터 열람 및 보고서 생성 가능</li>
                        </ul>
                      </div>
                    );
                  } else if (domain === 'nmc.or.kr') {
                    return (
                      <div className="mt-3 pt-3 border-t border-green-500/20">
                        <p className="text-green-400 text-xs font-medium mb-2">
                          🏥 응급의료센터 이메일 (@nmc.or.kr)
                        </p>
                        <ul className="text-gray-300 text-xs space-y-1">
                          <li>• 승인 가능 역할: 중앙응급의료센터, 응급의료지원센터</li>
                          <li>• AED 시스템 전체 관리 권한</li>
                          <li>• 전국 데이터 통계 및 분석 가능</li>
                        </ul>
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-3 pt-3 border-t border-yellow-500/20">
                        <p className="text-yellow-400 text-xs font-medium mb-2">
                          ⚠️ korea메일이 아니면?(@{domain})
                        </p>
                        <ul className="text-gray-400 text-xs space-y-1">
                          <li>• 보건소에서 할당한 AED만 점검 가능</li>
                          <li>• 전체 데이터 열람 및 보고서 생성 불가</li>
                          <li className="text-yellow-400">• 더 많은 권한이 필요하면 @korea.kr 계정으로 재가입</li>
                        </ul>
                      </div>
                    );
                  }
                })()}
              </div>

              <div className="space-y-4">
                {/* 비밀번호 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    비밀번호 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      const strength = validatePasswordStrength(e.target.value);
                      setPasswordStrength(strength);
                    }}
                    className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="대소문자, 숫자, 특수문자 포함 10자 이상"
                    minLength={10}
                    required
                  />

                  {formData.password && (
                    <div className="mt-2">
                      {/* 비밀번호 강도 바 */}
                      <div className="flex gap-1 mb-2">
                        {[0, 1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              level <= passwordStrength.score
                                ? getPasswordStrengthBarColor(passwordStrength.score)
                                : 'bg-gray-700'
                            }`}
                          />
                        ))}
                      </div>

                      {/* 피드백 메시지 */}
                      {passwordStrength.feedback.length > 0 && (
                        <p className={`text-xs ${getPasswordStrengthColor(passwordStrength.score)}`}>
                          {passwordStrength.feedback[0]}
                        </p>
                      )}

                      {/* 개선 제안 */}
                      {passwordStrength.suggestions.length > 0 && passwordStrength.score < 3 && (
                        <ul className="text-xs text-gray-400 mt-1 space-y-0.5">
                          {passwordStrength.suggestions.map((suggestion, idx) => (
                            <li key={idx}>• {suggestion}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* 비밀번호 확인 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    비밀번호 확인 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-800/50 backdrop-blur-xl border ${
                      passwordConfirm && formData.password !== passwordConfirm
                        ? 'border-red-500'
                        : passwordConfirm && formData.password === passwordConfirm
                        ? 'border-green-500'
                        : 'border-gray-700'
                    } rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors`}
                    placeholder="비밀번호를 다시 입력하세요"
                    minLength={10}
                    required
                  />
                  {passwordConfirm && (
                    <p className={`text-xs mt-1 ${
                      formData.password === passwordConfirm
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}>
                      {formData.password === passwordConfirm
                        ? '✓ 비밀번호가 일치합니다'
                        : '✗ 비밀번호가 일치하지 않습니다'}
                    </p>
                  )}
                </div>

                {/* 이름 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    이름 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="홍길동"
                    required
                  />
                </div>

                {/* 연락처 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    담당자 유선 연락처(휴대전화 기재금지)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);

                      // 지역번호 기반 자동 지역 선택
                      const detectedRegion = getRegionFromPhone(formatted);
                      if (detectedRegion && regions.includes(detectedRegion) && !formData.region) {
                        // 지역이 아직 선택되지 않았고, 유효한 지역이 감지된 경우에만 자동 선택
                        setFormData({
                          ...formData,
                          phone: formatted,
                          region: detectedRegion
                        });
                      } else {
                        setFormData({ ...formData, phone: formatted });
                      }
                    }}
                    className={`w-full px-4 py-3 bg-gray-800/50 backdrop-blur-xl border ${
                      formData.phone && isMobilePhone(formData.phone)
                        ? 'border-red-500'
                        : 'border-gray-700'
                    } rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors`}
                    placeholder="02-1234-5678 또는 031-1234-5678"
                    maxLength={13}
                  />
                  {formData.phone && isMobilePhone(formData.phone) && (
                    <p className="text-xs text-red-400 mt-1">
                      ✗ 개인정보 문제로 휴대전화는 입력이 제한됩니다. 소속기관의 유선 번호만 입력해주세요.
                    </p>
                  )}
                  {formData.phone && !isMobilePhone(formData.phone) && !validatePhoneNumber(formData.phone) && (
                    <p className="text-xs text-red-400 mt-1">
                      {getPhoneErrorMessage(formData.phone)}
                    </p>
                  )}
                  {formData.phone && formData.region && getRegionFromPhone(formData.phone) === formData.region && (
                    <p className="text-xs text-green-400 mt-1">
                      ✓ 지역번호에 따라 '{formData.region}'이(가) 자동으로 선택되었습니다
                    </p>
                  )}
                </div>

                {/* 지역 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    지역 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        region: e.target.value,
                        organizationName: '',
                        customOrganizationName: ''
                      });
                    }}
                    className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors appearance-none"
                    required
                    disabled={loadingRegions}
                  >
                    <option value="">
                      {loadingRegions ? '지역 목록 불러오는 중...' : '지역을 선택하세요'}
                    </option>
                    {regions.map(region => (
                      <option key={region} value={region} className="bg-gray-800">
                        {region}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 소속기관 선택 - 자동완성 컴포넌트 사용 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    소속기관 <span className="text-red-400">*</span>
                  </label>

                  {/* 임시 점검원 경고 메시지 */}
                  {(() => {
                    const emailDomain = (verifiedEmail || email).split('@')[1];
                    if (emailDomain !== 'korea.kr' && emailDomain !== 'nmc.or.kr' && formData.region) {
                      return (
                        <div className="mb-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                          <p className="text-yellow-400 text-xs font-medium mb-1">
                            ⚠️ 임시 점검원 소속 제한 안내
                          </p>
                          <ul className="text-gray-400 text-xs space-y-0.5">
                            <li>• 담당자(local_admin)가 있는 보건소만 선택 가능</li>
                            <li>• 담당자가 없으면 장비 할당이 불가능합니다</li>
                            <li>• 목록에 원하는 보건소가 없다면 해당 보건소에 담당자 등록을 요청하세요</li>
                          </ul>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <OrganizationAutocomplete
                    value={formData.organizationName || ''}
                    onChange={(value) => setFormData({ ...formData, organizationName: value })}
                    region={formData.region}
                    organizations={dynamicOrganizations}
                    placeholder={!formData.region ? '지역을 먼저 선택하세요' : '소속 기관을 검색하세요'}
                    disabled={!formData.region}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    기관명을 입력하면 자동으로 검색됩니다. 목록에 없는 경우 직접 입력 가능합니다.
                  </p>
                </div>

                {/* 비고 */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    비고
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors resize-none"
                    placeholder="추가 사항이 있으면 작성해주세요"
                    rows={3}
                  />
                </div>
              </div>

              {/* 약관 동의 */}
              <div className="mt-6 space-y-3 p-4 bg-gray-800/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onClick={(e) => {
                      if (!termsRead) {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }
                    }}
                    onChange={(e) => {
                      if (termsRead) {
                        setTermsAccepted(e.target.checked);
                      }
                    }}
                    className={`w-4 h-4 mt-0.5 cursor-pointer ${termsRead ? 'text-green-500' : 'text-gray-500'} bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2`}
                  />
                  <label className="text-sm text-gray-300 flex-1">
                    <span className="text-red-400">*</span> 서비스 이용약관에 동의합니다
                    {termsRead && <span className="text-green-400 text-xs ml-1">(읽음)</span>}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className={`ml-2 ${!termsRead ? 'text-yellow-400 animate-pulse' : 'text-green-400'} hover:text-green-300 underline text-xs`}
                    >
                      {!termsRead ? '필수: 내용보기' : '다시보기'}
                    </button>
                  </label>
                </div>
                
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="privacy"
                    checked={privacyAccepted}
                    onClick={(e) => {
                      if (!privacyRead) {
                        e.preventDefault();
                        setShowPrivacyModal(true);
                      }
                    }}
                    onChange={(e) => {
                      if (privacyRead) {
                        setPrivacyAccepted(e.target.checked);
                      }
                    }}
                    className={`w-4 h-4 mt-0.5 cursor-pointer ${privacyRead ? 'text-green-500' : 'text-gray-500'} bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2`}
                  />
                  <label className="text-sm text-gray-300 flex-1">
                    <span className="text-red-400">*</span> 개인정보 처리방침에 동의합니다
                    {privacyRead && <span className="text-green-400 text-xs ml-1">(읽음)</span>}
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className={`ml-2 ${!privacyRead ? 'text-yellow-400 animate-pulse' : 'text-green-400'} hover:text-green-300 underline text-xs`}
                    >
                      {!privacyRead ? '필수: 내용보기' : '다시보기'}
                    </button>
                  </label>
                </div>
                
                {(!termsRead || !privacyRead) && (
                  <p className="text-yellow-400 text-xs text-center mt-2">
                    ⚠️ 약관을 읽고 동의해주세요
                  </p>
                )}
              </div>

              <div className="mt-6">
                <NeoButton
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  disabled={loading || !termsAccepted || !privacyAccepted}
                >
                  회원가입 승인요청
                </NeoButton>
              </div>
            </form>
          )}

          {/* Step 4: 완료 */}
          {currentStep === 4 && (
            <div className="text-center py-8">
              {/* 성공 아이콘 */}
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full"></div>
                <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
              </div>

              {/* 메인 타이틀 */}
              <h2 className="text-2xl font-bold text-white mb-2">
                회원가입 신청 완료
              </h2>
              <p className="text-gray-400 text-sm mb-8">
                관리자 승인 후 시스템을 이용하실 수 있습니다
              </p>

              {/* 다음 단계 안내 */}
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 mb-6 text-left">
                <div className="mb-4">
                  <p className="text-gray-300 text-sm leading-relaxed">
                    관할지역 응급의료지원센터로 연락해주세요
                  </p>
                  <p className="text-gray-400 mt-2 whitespace-nowrap" style={{ fontSize: '0.6rem', lineHeight: '1.4' }}>
                    휴대전화 보다는 소속기관 유선전화로 연락하셔야 신원확인이 원활하게 진행됩니다
                  </p>
                </div>

                {/* 연락처 보기 버튼 */}
                <button
                  type="button"
                  onClick={() => setShowEmergencyContacts(true)}
                  className="w-full px-4 py-3 bg-transparent border-2 border-gray-600 hover:border-gray-500 hover:bg-gray-800/30 text-gray-300 hover:text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  관할지역 응급의료지원센터 연락처 보기
                </button>
              </div>

              {/* 로그인 버튼 */}
              <NeoButton
                fullWidth
                onClick={() => router.push('/auth/signin')}
                className="mt-4"
              >
                로그인 페이지로 이동
              </NeoButton>
            </div>
          )}
        </GlassCard>
      </div>

      {/* 서비스 이용약관 모달 */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAgree={() => {
          setTermsRead(true);
          setTermsAccepted(true);
        }}
        title="서비스 이용약관"
        content={<TermsContent />}
      />

      {/* 개인정보 처리방침 모달 */}
      <TermsModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAgree={() => {
          setPrivacyRead(true);
          setPrivacyAccepted(true);
        }}
        title="개인정보 처리방침"
        content={<PrivacyContent />}
      />

      {/* 소속기관 경고 모달 */}
      {showOrgWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-red-500/50 rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                ⚠️ 소속기관 확인 필요
              </h3>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="text-red-400 text-sm font-medium mb-3">
                현재 데이터베이스에는 &quot;{formData.organizationName}&quot; 기관이 존재하지 않습니다.
              </p>
              <p className="text-gray-300 text-sm mb-2">
                그래도 해당 기관으로 가입을 진행하면
              </p>
              <p className="text-gray-300 text-sm mb-3">
                &quot;{formData.organizationName}&quot; 기관이 없어 가입 이후에도 소속 장비를 볼 수가 없는 상황입니다.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-gray-300 text-xs">
                  관할 응급의료지원센터로 연락하여 &quot;{formData.organizationName}&quot; 기관을 생성할 수 있도록 요청을 하셔야 합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOrgWarning(false);
                  setOrgWarningConfirmed(false);
                }}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
              >
                소속기관 수정
              </button>
              <button
                onClick={() => {
                  setShowOrgWarning(false);
                  setOrgWarningConfirmed(true);
                  // 폼 자동 재제출
                  setTimeout(() => {
                    const form = document.querySelector('form');
                    if (form) {
                      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                  }, 100);
                }}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
              >
                가입 강행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 응급의료지원센터 연락처 모달 */}
      {showEmergencyContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl p-5 max-w-4xl w-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                응급의료지원센터 연락처
              </h3>
              <button
                onClick={() => setShowEmergencyContacts(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700/50 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Grid layout for compact display */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { region: '서울', phone: '02-2133-7542' },
                { region: '부산', phone: '051-254-3114' },
                { region: '대구', phone: '053-427-0530' },
                { region: '인천', phone: '032-440-3254' },
                { region: '광주', phone: '062-233-1339' },
                { region: '대전', phone: '042-223-5101' },
                { region: '울산', phone: '052-229-3666' },
                { region: '세종', phone: '044-715-5471' },
                { region: '경기', phone: '031-8008-5641' },
                { region: '강원', phone: '033-748-4911' },
                { region: '충북', phone: '043-266-6124' },
                { region: '충남', phone: '041-634-9351' },
                { region: '전북', phone: '063-276-9573' },
                { region: '전남', phone: '061-274-1339' },
                { region: '경북', phone: '054-441-1339' },
                { region: '경남', phone: '055-286-9548' },
                { region: '제주', phone: '064-710-2337' },
              ].map((center, index) => (
                <a
                  key={index}
                  href={`tel:${center.phone}`}
                  className="flex items-center gap-2 p-3 bg-gradient-to-br from-gray-800/50 to-gray-800/30 hover:from-gray-700/60 hover:to-gray-700/40 border border-gray-700/50 hover:border-green-500/30 rounded-xl transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center w-7 h-7 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{center.region}</p>
                    <p className="text-gray-400 text-xs group-hover:text-green-400 transition-colors">{center.phone}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
