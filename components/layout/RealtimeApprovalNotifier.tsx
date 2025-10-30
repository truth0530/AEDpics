'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
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

interface NewSignupUser {
  id: string;
  email: string;
  full_name: string;
  region_code?: string;
  organization_name?: string;
  created_at: string;
}

interface NotificationSettings {
  soundEnabled: boolean;
  voiceEnabled: boolean;
  browserPushEnabled: boolean;
  toastEnabled: boolean;
  reminderEnabled: boolean;
  reminderInterval: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export function RealtimeApprovalNotifier({ userRole, userRegionCode, canApproveUsers }: RealtimeApprovalNotifierProps) {
  const pathname = usePathname();
  const { showInfo } = useToast();
  const shownNotifications = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInitialized = useRef<boolean>(false);
  const pendingReminders = useRef<Map<string, PendingReminder>>(new Map());
  const lastPathname = useRef<string>(pathname);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 알림 설정 상태
  const [settings, setSettings] = useState<NotificationSettings>({
    soundEnabled: true,
    voiceEnabled: true,
    browserPushEnabled: true,
    toastEnabled: true,
    reminderEnabled: true,
    reminderInterval: 60,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
  });

  // 알림 설정 불러오기
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/notifications/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
          console.log('[Settings] Notification settings loaded:', data.settings);
        }
      } catch (error) {
        console.error('[Settings] Failed to load notification settings:', error);
      }
    };

    if (canApproveUsers) {
      loadSettings();
    }
  }, [canApproveUsers]);

  // 조용한 시간대 체크
  const isQuietHours = (): boolean => {
    if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // 같은 날 (예: 09:00 - 18:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // 자정을 넘는 경우 (예: 22:00 - 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  };

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

  // 재알림 함수 (설정 간격 사용)
  const scheduleReminder = (userId: string, userData: any) => {
    // 이미 예약된 재알림이 있으면 취소
    const existing = pendingReminders.current.get(userId);
    if (existing) {
      clearTimeout(existing.timerId);
    }

    // 설정된 간격 후 재알림 예약
    const intervalMs = settings.reminderInterval * 1000;
    const intervalSec = settings.reminderInterval;

    const timerId = setTimeout(async () => {
      console.log(`[Reminder] ${intervalSec}초 경과 - 승인 상태 확인:`, userId);

      try {
        // 사용자 상태 재확인 (여전히 pending_approval인지?)
        const response = await fetch(`/api/admin/users/${userId}`);
        if (!response.ok) {
          console.error('[Reminder] 사용자 조회 실패:', response.status);
          pendingReminders.current.delete(userId);
          return;
        }

        const currentUser = await response.json();

        // 여전히 pending_approval이고, 본인 관할 지역인 경우만 재알림
        if (currentUser.role === 'pending_approval') {
          const shouldNotify = shouldShowNotification(userRole, userRegionCode, currentUser);

          if (shouldNotify) {
            // 조용한 시간대 체크
            if (isQuietHours()) {
              console.log('[Reminder] 조용한 시간대 - 재알림 생략');
              pendingReminders.current.delete(userId);
              return;
            }

            console.log('[Reminder] 미승인 사용자 재알림:', userId);

            const regionLabel = currentUser.region_code || '지역 미상';
            const orgName = currentUser.organization_name || '소속 미상';
            const userName = currentUser.full_name || currentUser.email;

            // 짧은 벨소리 재생 (설정 확인)
            if (settings.soundEnabled) {
              playNotificationSound(true);
            }

            // Toast 알림 (설정 확인)
            if (settings.toastEnabled) {
              showInfo(
                `⏰ 승인 대기 중\n${userName} (${regionLabel} - ${orgName})`,
                {
                  duration: 6000, // 6초간 표시
                }
              );
            }
          } else {
            console.log('[Reminder] 관할 지역 외 사용자 - 재알림 생략:', userId);
          }
        } else {
          console.log('[Reminder] 이미 승인됨 - 재알림 취소:', userId);
        }
      } catch (error) {
        console.error('[Reminder] 사용자 조회 오류:', error);
      }

      // 재알림 목록에서 제거
      pendingReminders.current.delete(userId);
    }, intervalMs);

    pendingReminders.current.set(userId, { userId, timerId, userData });
    console.log(`[Reminder] ${intervalSec}초 후 재알림 예약:`, userId);
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

    console.log('[SSE] 승인 알림 구독 시작:', { userRole, userRegionCode });

    // SSE 연결 생성
    const eventSource = new EventSource('/api/realtime/approvals');
    eventSourceRef.current = eventSource;

    // SSE 연결 성공
    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
    };

    // SSE 메시지 수신
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 연결 확인 메시지
        if (data.type === 'connected') {
          console.log('[SSE] Connection established:', data.message);
          return;
        }

        // 새로운 가입 신청 알림
        if (data.type === 'new_signup' && data.users) {
          console.log('[SSE] 새로운 가입 신청 감지:', data.users);

          data.users.forEach((newUser: NewSignupUser) => {
            const notificationId = `${newUser.id}-${newUser.created_at}`;

            // 중복 알림 방지
            if (shownNotifications.current.has(notificationId)) {
              console.log('[SSE] 중복 알림 방지:', notificationId);
              return;
            }

            shownNotifications.current.add(notificationId);

            // 5초 후에 중복 방지 목록에서 제거 (메모리 관리)
            setTimeout(() => {
              shownNotifications.current.delete(notificationId);
            }, 5000);

            const regionLabel = newUser.region_code || '지역 미상';
            const orgName = newUser.organization_name || '소속 미상';
            const userName = newUser.full_name || newUser.email;

            // 조용한 시간대 체크
            if (isQuietHours()) {
              console.log('[Notification] 조용한 시간대 - 알림 생략');
              return;
            }

            // 알림 소리 재생 (설정 확인)
            if (settings.soundEnabled) {
              playNotificationSound(false);
            }

            // 음성 알림 재생 (설정 확인, 소리 후 0.5초 뒤)
            if (settings.voiceEnabled) {
              setTimeout(() => {
                speakNotification('새로운 사용자가 가입했습니다');
              }, 500);
            }

            // Toast 알림 (설정 확인)
            if (settings.toastEnabled) {
              showInfo(
                `🔔 새로운 가입 신청\n${userName} (${regionLabel} - ${orgName})`,
                {
                  duration: 8000, // 8초간 표시
                }
              );
            }

            // 브라우저 알림 (설정 및 권한 확인)
            if (
              settings.browserPushEnabled &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification('AED 시스템 - 새로운 가입 신청', {
                body: `${userName}\n${regionLabel} - ${orgName}`,
                icon: '/icon.svg',
                tag: notificationId,
              });
            }

            // 재알림 예약 (설정 확인)
            if (settings.reminderEnabled) {
              scheduleReminder(newUser.id, newUser);
            }
          });
        }
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error);
      }
    };

    // SSE 오류 처리
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);

      // 재연결 시도 (5초 후)
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('[SSE] Connection closed, will retry in 5 seconds');
        setTimeout(() => {
          if (canApproveUsers && !eventSourceRef.current) {
            console.log('[SSE] Attempting to reconnect...');
            // useEffect가 다시 실행되도록 트리거
          }
        }, 5000);
      }
    };

    // 브라우저 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('[Notification] 권한 상태:', permission);
      });
    }

    return () => {
      console.log('[SSE] 구독 해제');

      // SSE 연결 종료
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // 모든 예약된 재알림 취소
      pendingReminders.current.forEach(({ timerId }) => {
        clearTimeout(timerId);
      });
      pendingReminders.current.clear();
    };
  }, [userRole, userRegionCode, canApproveUsers, showInfo]);

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

      try {
        const response = await fetch('/api/admin/users?role=pending_approval');
        if (!response.ok) {
          console.error('[Page Navigation] 승인 대기자 조회 실패:', response.status);
          return;
        }

        const data = await response.json();
        const pendingUsers = data.users || [];

        if (!pendingUsers || pendingUsers.length === 0) {
          console.log('[Page Navigation] 승인 대기자 없음');
          return;
        }

        // 본인 관할 지역 필터링
        const myPendingUsers = pendingUsers.filter((user: any) =>
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
      } catch (error) {
        console.error('[Page Navigation] 승인 대기자 조회 오류:', error);
      }
    };

    checkPendingApprovals();
  }, [pathname, userRole, userRegionCode, canApproveUsers, showInfo]);

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

  // 응급의료지원센터는 해당 지역만
  if (userRole === 'regional_emergency_center_admin') {
    const newUserRegion = newUser.region_code || newUser.region || '';
    return newUserRegion === userRegionCode;
  }

  // 기타 역할은 알림 없음
  return false;
}
