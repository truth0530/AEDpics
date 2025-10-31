'use client';

import { UserRole } from '@/packages/types';

interface AccessDeniedViewProps {
  role: UserRole;
}

export default function AccessDeniedView({ role }: AccessDeniedViewProps) {
  const getRoleMessage = () => {
    switch (role) {
      case 'pending_approval':
        return {
          title: '승인 대기 중',
          message: '관리자 승인을 기다리고 있습니다. 승인 후 대시보드를 이용하실 수 있습니다.',
          action: '승인이 완료되면 이메일로 알려드립니다.'
        };
      case 'email_verified':
        return {
          title: '프로필 설정 필요',
          message: '프로필 설정을 완료해주세요.',
          action: '프로필 페이지로 이동하여 정보를 입력해주세요.'
        };
      case 'rejected':
        return {
          title: '가입 거부됨',
          message: '귀하의 계정 신청이 거부되었습니다.',
          action: '자세한 내용은 관리자에게 문의해주세요.'
        };
      default:
        return {
          title: '접근 권한 없음',
          message: '대시보드에 접근할 권한이 없습니다.',
          action: '권한이 필요한 경우 관리자에게 문의해주세요.'
        };
    }
  };

  const { title, message, action } = getRoleMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <svg
            className="w-20 h-20 mx-auto text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
        <p className="text-gray-300 mb-2">{message}</p>
        <p className="text-gray-400 text-sm mb-8">{action}</p>

        <div className="space-y-3">
          <a
            href="/inspection"
            className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            현장점검으로 이동
          </a>
          <a
            href="/profile"
            className="block w-full px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            프로필로 이동
          </a>
        </div>
      </div>
    </div>
  );
}
