'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
// TODO: Supabase Realtime을 폴링 또는 SSE로 대체 필요
// import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { normalizeRegionCode } from '@/lib/constants/regions';
import type { UserRole } from '@/packages/types';

interface RealtimeApprovalNotifierProps {
  userRole: UserRole;
  userRegionCode: string;
  canApproveUsers: boolean;
}

interface PendingReminder {
  userId: string;
  timerId: NodeJS.Timeout;
  userData: any;
}

export function RealtimeApprovalNotifier({ userRole, userRegionCode, canApproveUsers }: RealtimeApprovalNotifierProps) {
  const pathname = usePathname();
  const { showInfo } = useToast();
  // TODO: Realtime 기능 임시 비활성화
  // const supabase = createClient();
  const supabase: any = null; // 임시: Supabase 비활성화
  const shownNotifications = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInitialized = useRef<boolean>(false);
  const pendingReminders = useRef<Map<string, PendingReminder>>(new Map());
  const lastPathname = useRef<string>(pathname);

  // AudioContext 초기화 함수 (사용자 제스처 후 호출)
  const initializeAudioContext = () => {
    if (audioContextRef.current) return true;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

      // AudioContext가 suspended 상태인 경우 resume
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      audioInitialized.current = true;
      console.log('[Audio] AudioContext 초기화 성공');
      return true;
    } catch (error) {
      console.error('[Audio] AudioContext 초기화 실패:', error);
      return false;
    }
  };

  // 알림 소리 재생 함수 (짧은 버전 지원)
  const playNotificationSound = (isShort: boolean = false) => {
    try {
      // AudioContext 초기화 시도
      if (!initializeAudioContext()) {
        console.warn('[Audio] AudioContext를 초기화할 수 없습니다.');
        return;
      }

      const audioContext = audioContextRef.current!;

      // 두 개의 톤을 연속으로 재생 (벨소리 효과)
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        // 볼륨 페이드 효과
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;

      if (isShort) {
        // 짧은 벨소리 (재알림용 - 한 번만)
        playTone(800, now, 0.1);
        console.log('[Notification] 재알림 소리 재생 (짧은 버전)');
      } else {
        // 긴 벨소리 (최초 알림용 - 두 번)
        playTone(800, now, 0.15); // 첫 번째 톤
        playTone(1000, now + 0.2, 0.15); // 두 번째 톤 (약간 높은 음)
        console.log('[Notification] 알림 소리 재생 (전체 버전)');
      }
    } catch (error) {
      console.error('[Notification] 소리 재생 실패:', error);
    }
  };

  // 음성 알림 재생 함수
  const speakNotification = (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        // 기존 음성이 재생 중이면 중단
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR'; // 한국어
        utterance.rate = 1.0; // 속도
        utterance.pitch = 1.0; // 음높이
        utterance.volume = 0.8; // 볼륨

        // 한국어 음성 선택 (가능한 경우)
        const voices = window.speechSynthesis.getVoices();
        const koreanVoice = voices.find(voice => voice.lang.includes('ko'));
        if (koreanVoice) {
          utterance.voice = koreanVoice;
        }

        window.speechSynthesis.speak(utterance);
        console.log('[Notification] 음성 알림 재생:', text);
      }
    } catch (error) {
      console.error('[Notification] 음성 재생 실패:', error);
    }
  };

  // 1분 후 재알림 함수 (지역 필터링 포함)
  const scheduleReminder = (userId: string, userData: any) => {
    // 이미 예약된 재알림이 있으면 취소
    const existing = pendingReminders.current.get(userId);
    if (existing) {
      clearTimeout(existing.timerId);
    }

    // 1분(60초) 후 재알림 예약
    const timerId = setTimeout(async () => {
      console.log('[Reminder] 1분 경과 - 승인 상태 확인:', userId);

      // 사용자 상태 재확인 (여전히 pending_approval인지?)
      const { data: currentUser, error } = await supabase
        .from('user_profiles')
        .select('role, region_code, full_name, email, organization_name')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Reminder] 사용자 조회 실패:', error);
        pendingReminders.current.delete(userId);
        return;
      }

      // 여전히 pending_approval이고, 본인 관할 지역인 경우만 재알림
      if (currentUser.role === 'pending_approval') {
        const shouldNotify = shouldShowNotification(userRole, userRegionCode, currentUser);

        if (shouldNotify) {
          console.log('[Reminder] 미승인 사용자 재알림:', userId);

          // 짧은 벨소리만 재생 (음성 없음)
          playNotificationSound(true);

          const regionLabel = currentUser.region_code || '지역 미상';
          const orgName = currentUser.organization_name || '소속 미상';
          const userName = currentUser.full_name || currentUser.email;

          showInfo(
            `⏰ 승인 대기 중\n${userName} (${regionLabel} - ${orgName})`,
            {
              duration: 6000, // 6초간 표시
            }
          );
        } else {
          console.log('[Reminder] 관할 지역 외 사용자 - 재알림 생략:', userId);
        }
      } else {
        console.log('[Reminder] 이미 승인됨 - 재알림 취소:', userId);
      }

      // 재알림 목록에서 제거
      pendingReminders.current.delete(userId);
    }, 60000); // 60초 = 1분

    pendingReminders.current.set(userId, { userId, timerId, userData });
    console.log('[Reminder] 1분 후 재알림 예약:', userId);
  };

  useEffect(() => {
    // 승인 권한이 없으면 구독하지 않음
    if (!canApproveUsers) {
      return;
    }

    // 음성 목록 미리 로드 (Web Speech API)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    // 사용자 제스처 후 AudioContext 초기화 (클릭/터치 이벤트)
    const handleUserGesture = () => {
      if (!audioInitialized.current) {
        initializeAudioContext();
        console.log('[Audio] 사용자 제스처 감지 - AudioContext 초기화 시도');
      }
    };

    // 전역 이벤트 리스너 등록 (한 번만)
    document.addEventListener('click', handleUserGesture, { once: true });
    document.addEventListener('touchstart', handleUserGesture, { once: true });
    document.addEventListener('keydown', handleUserGesture, { once: true });

    console.log('[Realtime] 승인 알림 구독 시작:', { userRole, userRegionCode });

    const channel = supabase
      .channel('user_approval_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_profiles',
          filter: 'role=eq.pending_approval',
        },
        async (payload) => {
          console.log('[Realtime] 새로운 가입 신청 감지:', payload);

          const newUser = payload.new as any;
          const notificationId = `${newUser.id}-${newUser.created_at}`;

          // 중복 알림 방지
          if (shownNotifications.current.has(notificationId)) {
            console.log('[Realtime] 중복 알림 방지:', notificationId);
            return;
          }

          // 지역 필터링 (본인 관할 지역만 알림)
          const shouldNotify = shouldShowNotification(userRole, userRegionCode, newUser);

          if (shouldNotify) {
            shownNotifications.current.add(notificationId);

            // 5초 후에 중복 방지 목록에서 제거 (메모리 관리)
            setTimeout(() => {
              shownNotifications.current.delete(notificationId);
            }, 5000);

            const regionLabel = newUser.region_code || '지역 미상';
            const orgName = newUser.organization_name || '소속 미상';
            const userName = newUser.full_name || newUser.email;

            // 알림 소리 재생 (전체 버전)
            playNotificationSound(false);

            // 음성 알림 재생 (소리 후 0.5초 뒤)
            setTimeout(() => {
              speakNotification('새로운 사용자가 가입했습니다');
            }, 500);

            showInfo(
              `🔔 새로운 가입 신청\n${userName} (${regionLabel} - ${orgName})`,
              {
                duration: 8000, // 8초간 표시
              }
            );

            // 브라우저 알림 (권한이 있는 경우)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('AED 시스템 - 새로운 가입 신청', {
                body: `${userName}\n${regionLabel} - ${orgName}`,
                icon: '/icon.svg',
                tag: notificationId,
              });
            }

            // 1분 후 재알림 예약 (본인 관할 지역만)
            scheduleReminder(newUser.id, newUser);
          } else {
            console.log('[Realtime] 관할 지역 외 가입 신청 - 알림 생략:', {
              userRegion: newUser.region_code,
              myRegion: userRegionCode,
              myRole: userRole
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] 구독 상태:', status);
      });

    // 브라우저 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('[Notification] 권한 상태:', permission);
      });
    }

    return () => {
      console.log('[Realtime] 구독 해제');

      // 모든 예약된 재알림 취소
      pendingReminders.current.forEach(({ timerId }) => {
        clearTimeout(timerId);
      });
      pendingReminders.current.clear();

      supabase.removeChannel(channel);
    };
  }, [userRole, userRegionCode, canApproveUsers, showInfo, supabase]);

  // 페이지 이동 시 무음 알림 (본인 관할 지역의 승인 대기자가 있는 경우)
  useEffect(() => {
    // 페이지가 변경되지 않았으면 실행하지 않음
    if (lastPathname.current === pathname) {
      return;
    }

    lastPathname.current = pathname;

    // 승인 권한이 없으면 체크하지 않음
    if (!canApproveUsers) {
      return;
    }

    // 비동기로 승인 대기 중인 사용자 확인
    const checkPendingApprovals = async () => {
      console.log('[Page Navigation] 승인 대기자 확인:', pathname);

      const { data: pendingUsers, error } = await supabase
        .from('user_profiles')
        .select('id, region_code, full_name, email, organization_name')
        .eq('role', 'pending_approval');

      if (error) {
        console.error('[Page Navigation] 승인 대기자 조회 실패:', error);
        return;
      }

      if (!pendingUsers || pendingUsers.length === 0) {
        console.log('[Page Navigation] 승인 대기자 없음');
        return;
      }

      // 본인 관할 지역 필터링
      const myPendingUsers = pendingUsers.filter((user) =>
        shouldShowNotification(userRole, userRegionCode, user)
      );

      if (myPendingUsers.length > 0) {
        console.log('[Page Navigation] 본인 관할 승인 대기자:', myPendingUsers.length);

        // 무음 토스트 알림 (소리 없음)
        showInfo(
          `💬 승인 대기 ${myPendingUsers.length}건`,
          {
            duration: 5000, // 5초간 표시
          }
        );
      } else {
        console.log('[Page Navigation] 본인 관할 승인 대기자 없음');
      }
    };

    checkPendingApprovals();
  }, [pathname, userRole, userRegionCode, canApproveUsers, showInfo, supabase]);

  return null; // UI를 렌더링하지 않음
}

/**
 * 사용자 역할과 지역에 따라 알림을 표시할지 결정
 */
function shouldShowNotification(
  userRole: UserRole,
  userRegionCode: string,
  newUser: any
): boolean {
  // Master는 모든 신청 알림
  if (userRole === 'master') {
    return true;
  }

  // 중앙응급의료센터는 모든 신청 알림
  if (userRole === 'emergency_center_admin') {
    return true;
  }

  // 지역응급의료지원센터는 해당 지역만
  if (userRole === 'regional_emergency_center_admin') {
    const newUserRegion = normalizeRegionCode(newUser.region_code || newUser.region || '');
    return newUserRegion === userRegionCode;
  }

  // 기타 역할은 알림 없음
  return false;
}
