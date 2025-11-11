'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BasketItem {
  management_number: string;
  institution_name: string;
  address: string;
  equipment_count: number;
  equipment_serials: string[];
  confidence: number | null;
  target_key: string;
  selected_serials?: string[]; // 선택된 장비연번 (undefined면 전체, 배열이면 일부만)
}

interface TargetInstitution {
  target_key: string;
  institution_name: string;
}

interface BasketPanelProps {
  basket: BasketItem[];
  selectedInstitution: TargetInstitution | null;
  onRemove: (managementNumber: string) => void;
  onClear: () => void;
  onMatch: () => Promise<void>;
}

export default function BasketPanel({
  basket,
  selectedInstitution,
  onRemove,
  onClear,
  onMatch
}: BasketPanelProps) {
  const [matching, setMatching] = useState(false);

  const handleMatch = async () => {
    if (basket.length === 0) {
      toast.error('매칭된 항목이 없습니다');
      return;
    }

    if (!selectedInstitution) {
      toast.error('의무설치기관이 선택되지 않았습니다');
      return;
    }

    setMatching(true);
    try {
      await onMatch();
      toast.success(`${basket.length}개 관리번호가 매칭되었습니다`);
    } catch (error) {
      toast.error('매칭 실패');
      console.error('Matching failed:', error);
    } finally {
      setMatching(false);
    }
  };

  const totalEquipment = basket.reduce((sum, item) => sum + item.equipment_count, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 통계 정보 - 상단 고정 */}
      {basket.length > 0 && (
        <div className="flex-shrink-0 grid grid-cols-2 gap-2 mb-4">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">관리번호</div>
            <div className="text-2xl font-bold">{basket.length}개</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">총 장비</div>
            <div className="text-2xl font-bold">{totalEquipment}대</div>
          </Card>
        </div>
      )}

      {/* 담긴 항목 리스트 */}
      <div className="flex-1 overflow-auto">
        {basket.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-muted-foreground text-sm">
              {selectedInstitution ? (
                <>
                  <span className="text-primary font-medium">{selectedInstitution.institution_name}</span>
                  에 아직 매칭된 항목이 없습니다
                </>
              ) : (
                '매칭된 항목이 없습니다'
              )}
            </div>
            <div className="text-muted-foreground text-xs mt-2">
              좌측에서 관리번호를 선택하여<br />매칭 리스트에 추가해주세요
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {basket.map((item) => (
              <Card
                key={item.management_number}
                className={cn(
                  "p-3 transition-all hover:shadow-md",
                  item.selected_serials && item.selected_serials.length > 0
                    ? "border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-2 border-green-400 bg-green-50/50 dark:bg-green-950/20"
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {item.management_number}
                        {item.confidence && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {item.confidence.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.institution_name}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(item.management_number)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{item.address}</span>
                  </div>
                  {item.selected_serials ? (
                    // 개별 장비연번이 선택된 경우
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        선택된 장비연번 ({item.selected_serials.length}개):
                      </div>
                      {item.selected_serials.map(serial => (
                        <Badge key={serial} variant="outline" className="text-xs font-mono mr-1">
                          {serial}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    // 전체 장비가 선택된 경우
                    <Badge variant="outline" className="text-xs">
                      장비 {item.equipment_count}대 (전체)
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 액션 버튼 - 하단 고정 */}
      {basket.length > 0 && (
        <div className="flex-shrink-0 mt-4 pt-4 border-t space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleMatch}
            disabled={!selectedInstitution || matching}
          >
            {matching ? '매칭 중...' : `전체 매칭하기 (${basket.length}개)`}
          </Button>
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            onClick={onClear}
            disabled={matching}
          >
            매칭 리스트 비우기
          </Button>
        </div>
      )}
    </div>
  );
}
