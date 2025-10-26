'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface RegionStats {
  region: string;
  total: number;
  mandatory: number;
  nonMandatory: number;
  completed: number;
  completedMandatory: number;
  completedNonMandatory: number;
  assigned: number;
  assignedMandatory: number;
  assignedNonMandatory: number;
  fieldInspected: number;
  fieldInspectedMandatory: number;
  fieldInspectedNonMandatory: number;
  rate: number;
  blocked: number;
  blockedMandatory: number;
  blockedNonMandatory: number;
  uninspected: number;
  uninspectedMandatory: number;
  uninspectedNonMandatory: number;
}

interface RegionDetailModalProps {
  region: RegionStats | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function RegionDetailModal({ region, isOpen, onClose }: RegionDetailModalProps) {
  if (!region) return null;

  const formatNumber = (num: number) => {
    return num.toLocaleString('ko-KR');
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-950 border-gray-800">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-white">
              {region.region} 상세 통계
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            실시간 AED 점검 현황을 확인하세요
          </p>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* 5개 상세 카드 */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* 1. 전체 AED */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-4">전체 AED</h3>

              <div className="space-y-2.5">
                {/* 관리자점검 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-purple-400">1</span>
                      </div>
                      <span className="text-xs text-gray-400">관리자점검</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-400">
                      {formatNumber(region.completed)}/{formatNumber(region.total)}
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.completed, region.total)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-blue-500 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.completed, region.total)}%`}}
                    />
                  </div>
                </div>

                {/* 일정추가 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-orange-400">2</span>
                      </div>
                      <span className="text-xs text-gray-400">일정추가</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-400">
                      {formatNumber(region.assigned)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.assigned, region.total)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-orange-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.assigned, region.total)}%`}}
                    />
                  </div>
                </div>

                {/* 현장점검 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-green-400">3</span>
                      </div>
                      <span className="text-xs text-gray-400">현장점검</span>
                    </div>
                    <span className="text-sm font-semibold text-green-400">
                      {formatNumber(region.fieldInspected)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.fieldInspected, region.total)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.fieldInspected, region.total)}%`}}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 구비의무기관 */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-4">구비의무기관</h3>

              <div className="space-y-2.5">
                {/* 관리자점검 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-purple-400">1</span>
                      </div>
                      <span className="text-xs text-gray-400">관리자점검</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-400">
                      {formatNumber(region.completedMandatory)}/{formatNumber(region.mandatory)}
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.completedMandatory, region.mandatory)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-blue-500 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.completedMandatory, region.mandatory)}%`}}
                    />
                  </div>
                </div>

                {/* 일정추가 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-orange-400">2</span>
                      </div>
                      <span className="text-xs text-gray-400">일정추가</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-400">
                      {formatNumber(region.assignedMandatory)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.assignedMandatory, region.mandatory)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-orange-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.assignedMandatory, region.mandatory)}%`}}
                    />
                  </div>
                </div>

                {/* 현장점검 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-green-400">3</span>
                      </div>
                      <span className="text-xs text-gray-400">현장점검</span>
                    </div>
                    <span className="text-sm font-semibold text-green-400">
                      {formatNumber(region.fieldInspectedMandatory)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.fieldInspectedMandatory, region.mandatory)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.fieldInspectedMandatory, region.mandatory)}%`}}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 구비의무기관 외 */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-4">구비의무기관 외</h3>

              <div className="space-y-2.5">
                {/* 관리자점검 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-purple-400">1</span>
                      </div>
                      <span className="text-xs text-gray-400">관리자점검</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-400">
                      {formatNumber(region.completedNonMandatory)}/{formatNumber(region.nonMandatory)}
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.completedNonMandatory, region.nonMandatory)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-blue-500 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.completedNonMandatory, region.nonMandatory)}%`}}
                    />
                  </div>
                </div>

                {/* 일정추가 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-orange-400">2</span>
                      </div>
                      <span className="text-xs text-gray-400">일정추가</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-400">
                      {formatNumber(region.assignedNonMandatory)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.assignedNonMandatory, region.nonMandatory)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-orange-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.assignedNonMandatory, region.nonMandatory)}%`}}
                    />
                  </div>
                </div>

                {/* 현장점검 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-green-400">3</span>
                      </div>
                      <span className="text-xs text-gray-400">현장점검</span>
                    </div>
                    <span className="text-sm font-semibold text-green-400">
                      {formatNumber(region.fieldInspectedNonMandatory)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.fieldInspectedNonMandatory, region.nonMandatory)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.fieldInspectedNonMandatory, region.nonMandatory)}%`}}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. 외부표출 차단 */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-4">외부표출 차단</h3>

              <div className="space-y-2.5">
                {/* 전체 차단 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">전체</span>
                    <span className="text-sm font-semibold text-red-400">
                      {formatNumber(region.blocked)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.blocked, region.total)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-red-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.blocked, region.total)}%`}}
                    />
                  </div>
                </div>

                {/* 구비의무 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">구비의무</span>
                    <span className="text-sm font-semibold text-red-400">
                      {formatNumber(region.blockedMandatory)}대
                    </span>
                  </div>
                </div>

                {/* 의무 외 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">의무 외</span>
                    <span className="text-sm font-semibold text-red-400">
                      {formatNumber(region.blockedNonMandatory)}대
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 미점검 장비 */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-4">미점검 장비</h3>

              <div className="space-y-2.5">
                {/* 전체 미점검 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">전체</span>
                    <span className="text-sm font-semibold text-yellow-400">
                      {formatNumber(region.uninspected)}대
                      <span className="text-xs text-gray-500 ml-1">
                        ({getPercentage(region.uninspected, region.total)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-yellow-500 h-1.5 rounded-full"
                      style={{width: `${getPercentage(region.uninspected, region.total)}%`}}
                    />
                  </div>
                </div>

                {/* 구비의무 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">구비의무</span>
                    <span className="text-sm font-semibold text-yellow-400">
                      {formatNumber(region.uninspectedMandatory)}대
                    </span>
                  </div>
                </div>

                {/* 의무 외 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">의무 외</span>
                    <span className="text-sm font-semibold text-yellow-400">
                      {formatNumber(region.uninspectedNonMandatory)}대
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
