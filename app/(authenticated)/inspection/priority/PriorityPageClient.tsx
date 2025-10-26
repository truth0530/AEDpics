'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { toast } from 'sonner';

interface PriorityPageClientProps {
  userProfile: any;
}

export default function PriorityPageClient({ userProfile }: PriorityPageClientProps) {
  const router = useRouter();
  const [aedList, setAedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedAED, setSelectedAED] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [assignmentType, setAssignmentType] = useState<string>('scheduled');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // 데이터 로딩 (초기화)
  useEffect(() => {
    loadAEDList();
  }, []);

  async function loadAEDList() {
    try {
      setLoading(true);

      // 일정관리 페이지용 API (할당 상태 포함)
      const response = await fetch('/api/aed-data/priority?limit=100');

      if (!response.ok) {
        throw new Error('Failed to load AED data');
      }

      const result = await response.json();
      setAedList(result.data || []);
    } catch (error) {
      console.error('Error loading AED list:', error);
      toast.error('AED 목록 로딩 실패');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToSchedule() {
    if (!selectedAED) return;

    if (!scheduledDate) {
      toast.error('점검 예정일을 선택해주세요.');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch('/api/inspections/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentSerial: selectedAED.equipment_serial,
          assignedTo: userProfile.id,
          scheduledDate,
          scheduledTime,
          assignmentType,
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add schedule');
      }

      toast.success('일정추가가 완료되었습니다.');
      setScheduleModalOpen(false);
      setSelectedAED(null);
      setScheduledDate('');
      setScheduledTime('');
      setNotes('');

      // 목록 새로고침
      await loadAEDList();
    } catch (error: any) {
      console.error('Error adding schedule:', error);
      toast.error(error.message || '일정추가 실패');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <TableSkeleton rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">일정관리</h1>
          <p className="text-sm text-gray-400 mt-1">
            점검이 필요한 AED 장비 일정관리 및 일정추가
          </p>
        </div>

        <Button
          onClick={() => router.refresh()}
          variant="outline"
          className="border-gray-700 hover:bg-gray-800"
        >
          새로고침
        </Button>
      </div>

      {/* 통계 - 한 줄로 압축 */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
          <span className="text-gray-400">전체</span>
          <span className="font-bold text-gray-100">{aedList.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
          <span className="text-gray-400">일정추가</span>
          <span className="font-bold text-blue-400">{aedList.filter((a) => a.assignment_id).length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
          <span className="text-gray-400">미할당</span>
          <span className="font-bold text-yellow-400">{aedList.filter((a) => !a.assignment_id).length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
          <span className="text-gray-400">긴급</span>
          <span className="font-bold text-red-400">
            {aedList.filter((a) => a.days_until_battery_expiry < 30 || a.days_until_patch_expiry < 30).length}
          </span>
        </div>
      </div>

      {/* AED 목록 - 테이블 형식 */}
      {aedList.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">표시할 AED 장비가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">설치기관</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium hidden md:table-cell">주소</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium hidden lg:table-cell">제조번호</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium">배터리</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium">패드</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium">상태</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium">일정</th>
              </tr>
            </thead>
            <tbody>
              {aedList.map((aed) => {
                const isUrgent = aed.days_until_battery_expiry < 30 || aed.days_until_patch_expiry < 30;
                return (
                  <tr
                    key={aed.equipment_serial}
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {isUrgent && <span className="w-2 h-2 bg-red-500 rounded-full" title="긴급" />}
                        <span className="font-medium text-gray-100">{aed.installation_institution}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-gray-400 hidden md:table-cell">
                      <div className="max-w-xs truncate">{aed.installation_address}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-400 font-mono text-xs hidden lg:table-cell">
                      {aed.equipment_serial}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={aed.days_until_battery_expiry < 30 ? 'text-red-400 font-medium' : 'text-gray-400'}>
                        {aed.days_until_battery_expiry}일
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={aed.days_until_patch_expiry < 30 ? 'text-red-400 font-medium' : 'text-gray-400'}>
                        {aed.days_until_patch_expiry}일
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isUrgent && (
                        <Badge variant="destructive" className="bg-red-900/20 text-red-300 border-red-600/30 text-xs">
                          긴급
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {aed.assignment_id ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <CheckCircle2 className="w-4 h-4 text-blue-400" />
                          {aed.scheduled_date && (
                            <span className="text-xs text-gray-500">{aed.scheduled_date}</span>
                          )}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedAED(aed);
                            setScheduleModalOpen(true);
                          }}
                          className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          추가
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 일정추가 모달 */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-100">일정추가</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedAED?.installation_institution} - {selectedAED?.equipment_serial}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date" className="text-gray-300">
                점검 예정일 *
              </Label>
              <Input
                id="scheduled_date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled_time" className="text-gray-300">
                점검 예정 시간
              </Label>
              <Input
                id="scheduled_time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment_type" className="text-gray-300">
                할당 타입
              </Label>
              <Select value={assignmentType} onValueChange={setAssignmentType}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="scheduled">일반 점검</SelectItem>
                  <SelectItem value="urgent">긴급 점검</SelectItem>
                  <SelectItem value="follow_up">재점검</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-gray-300">
                메모
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="특이사항 또는 메모를 입력하세요"
                className="bg-gray-800 border-gray-700 text-gray-100"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScheduleModalOpen(false)}
              className="border-gray-700 hover:bg-gray-800"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleAddToSchedule}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? '저장 중...' : '일정추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
