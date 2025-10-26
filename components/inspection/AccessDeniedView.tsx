'use client';

import { UserRole } from '@/packages/types';
import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';

interface AccessDeniedViewProps {
  role: UserRole;
}

export function AccessDeniedView({ role }: AccessDeniedViewProps) {
  const router = useRouter();

  const getMessage = () => {
    switch (role) {
      case 'pending_approval':
        return {
          title: '승인 대기 중',
          description: '관리자의 승인을 기다리고 있습니다. 승인 후 시스템을 이용할 수 있습니다.',
          action: '승인 상태 확인',
          actionUrl: '/pending-approval'
        };
      case 'email_verified':
        return {
          title: '프로필 설정 필요',
          description: '시스템 이용을 위해 프로필 설정을 완료해 주세요.',
          action: '프로필 설정',
          actionUrl: '/profile/setup'
        };
      default:
        return {
          title: '접근 권한 없음',
          description: '이 페이지에 접근할 권한이 없습니다.',
          action: '대시보드로 이동',
          actionUrl: '/dashboard'
        };
    }
  };

  const { title, description, action, actionUrl } = getMessage();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <ShieldOff className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600 mb-6">{description}</p>
          <button
            onClick={() => router.push(actionUrl)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}