'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/Toast';
import { NotificationProvider } from '@/lib/hooks/useNotifications';
import { TutorialSidebar } from './components/TutorialSidebar';
import { TutorialHeader } from './components/TutorialHeader';
import { TutorialMobileNav } from './components/TutorialMobileNav';

// 튜토리얼용 더미 프로필
const TUTORIAL_PROFILE = {
  id: 'tutorial-user',
  email: 'tutorial@example.com',
  name: 'Tutorial User',
  role: 'admin' as const,
  region: '서울',
  region_code: '11',
  city: '강남구',
  city_code: '11010',
  phone: '010-0000-0000',
  organization: {
    id: 'tutorial-org',
    name: 'AED 시스템',
    region_code: '11',
    city_code: '11010',
    latitude: 37.4979,
    longitude: 127.0276,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function TutorialLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NotificationProvider>
        <SidebarProvider>
          <div className="flex h-screen bg-black relative">
            <TutorialSidebar user={TUTORIAL_PROFILE} />
            <SidebarInset>
              <TutorialHeader user={TUTORIAL_PROFILE} />
              <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
            </SidebarInset>
            <TutorialMobileNav user={TUTORIAL_PROFILE} />
          </div>
        </SidebarProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}
