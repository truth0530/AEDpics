'use client';

import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { Database, ClipboardList, House, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialSidebarProps {
  user: any;
}

export function TutorialSidebar({ user }: TutorialSidebarProps) {
  const { collapsed, setCollapsed } = useSidebar();
  const isExpanded = !collapsed;

  const handleNavigate = (page: 'aed-data' | 'inspection') => {
    if (typeof window !== 'undefined' && (window as any).tutorialNavigate) {
      (window as any).tutorialNavigate(page);
    }
  };

  return (
    <Sidebar className="hidden md:flex bg-gray-950 text-white border-r border-gray-800/50">
      <SidebarHeader>
        <div className={cn(
          "flex items-center py-2 px-3",
          isExpanded ? "justify-end" : "justify-center"
        )}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            aria-label={isExpanded ? "사이드바 닫기" : "사이드바 열기"}
          >
            {isExpanded ? (
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav className="p-2 space-y-1">
          <button
            data-tutorial="sidebar-aed-data"
            onClick={() => handleNavigate('aed-data')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 hover:bg-gray-800/80 hover:text-white text-gray-400"
          >
            <Database className="w-5 h-5" />
            <span>일정관리</span>
          </button>
          <button
            data-tutorial="sidebar-inspection"
            onClick={() => handleNavigate('inspection')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 hover:bg-gray-800/80 hover:text-white text-gray-400"
          >
            <ClipboardList className="w-5 h-5" />
            <span>현장점검</span>
          </button>
          <a
            href="#"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 hover:bg-gray-800/80 hover:text-white text-gray-400 pointer-events-none opacity-50"
          >
            <House className="w-5 h-5" />
            <span>대시보드</span>
          </a>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
