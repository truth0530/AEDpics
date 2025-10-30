'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';

interface NotificationSettingsData {
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

export function NotificationSettings() {
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsData>({
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

  // 설정 불러오기
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications/settings');

      if (!response.ok) {
        throw new Error('설정을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Failed to fetch notification settings:', error);
      showError('알림 설정을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('설정 저장에 실패했습니다.');
      }

      showSuccess('알림 설정이 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      showError('알림 설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationSettingsData) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleIntervalChange = (value: number) => {
    setSettings((prev) => ({
      ...prev,
      reminderInterval: value,
    }));
  };

  const handleTimeChange = (key: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-2 text-sm text-gray-600">설정을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">알림 유형 설정</h3>

        <div className="space-y-4">
          {/* 소리 알림 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">소리 알림</label>
              <p className="text-sm text-gray-500">새로운 가입 신청 시 벨 소리가 재생됩니다.</p>
            </div>
            <button
              onClick={() => handleToggle('soundEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.soundEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 음성 알림 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">음성 알림</label>
              <p className="text-sm text-gray-500">새로운 가입 신청 시 음성 안내가 재생됩니다.</p>
            </div>
            <button
              onClick={() => handleToggle('voiceEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.voiceEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.voiceEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 브라우저 푸시 알림 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">브라우저 푸시 알림</label>
              <p className="text-sm text-gray-500">데스크톱 알림이 표시됩니다.</p>
            </div>
            <button
              onClick={() => handleToggle('browserPushEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.browserPushEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.browserPushEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Toast 알림 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">화면 알림</label>
              <p className="text-sm text-gray-500">화면에 알림 메시지가 표시됩니다.</p>
            </div>
            <button
              onClick={() => handleToggle('toastEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.toastEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.toastEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 재알림 설정 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">재알림 설정</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">재알림 활성화</label>
              <p className="text-sm text-gray-500">미처리 신청에 대해 주기적으로 알림을 받습니다.</p>
            </div>
            <button
              onClick={() => handleToggle('reminderEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.reminderEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {settings.reminderEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-900">재알림 간격</label>
              <select
                value={settings.reminderInterval}
                onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={30}>30초</option>
                <option value={60}>1분</option>
                <option value={120}>2분</option>
                <option value={300}>5분</option>
                <option value={600}>10분</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 조용한 시간 설정 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">조용한 시간</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">조용한 시간 활성화</label>
              <p className="text-sm text-gray-500">지정한 시간대에는 알림을 받지 않습니다.</p>
            </div>
            <button
              onClick={() => handleToggle('quietHoursEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.quietHoursEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {settings.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900">시작 시간</label>
                <input
                  type="time"
                  value={settings.quietHoursStart || '22:00'}
                  onChange={(e) => handleTimeChange('quietHoursStart', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">종료 시간</label>
                <input
                  type="time"
                  value={settings.quietHoursEnd || '08:00'}
                  onChange={(e) => handleTimeChange('quietHoursEnd', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSaving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}
