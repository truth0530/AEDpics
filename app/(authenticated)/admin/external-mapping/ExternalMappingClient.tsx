'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExternalMapping {
  equipment_serial: string;
  external_system_id: string;
  external_system_name: string;
  matching_method: string;
  matching_confidence: number;
  matched_by: string;
  matched_at: string;
  verified_by: string | null;
  verified_at: string | null;
}

interface MappingStats {
  total_devices: number;
  matched_devices: number;
  verified_devices: number;
  pending_devices: number;
  conflict_devices: number;
  matching_rate: number;
  verification_rate: number;
}

export function ExternalMappingClient() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    matching_method: '',
    equipment_serial: '',
    external_system_name: '',
  });
  const [selectedMapping, setSelectedMapping] = useState<ExternalMapping | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    equipmentSerial: '',
    externalId: '',
    systemName: 'e-gen',
    notes: '',
  });

  // 통계 조회
  const { data: statsData } = useQuery<{ stats: MappingStats }>({
    queryKey: ['external-mapping-stats'],
    queryFn: async () => {
      const res = await fetch('/api/external-mapping/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 30000, // 30초마다 갱신
  });

  // 매핑 목록 조회
  const { data: mappingsData, isLoading } = useQuery<{
    mappings: ExternalMapping[];
    total: number;
  }>({
    queryKey: ['external-mappings', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.matching_method) params.append('matching_method', filters.matching_method);
      if (filters.equipment_serial) params.append('equipment_serial', filters.equipment_serial);
      if (filters.external_system_name) params.append('external_system_name', filters.external_system_name);

      const res = await fetch(`/api/external-mapping?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch mappings');
      return res.json();
    },
  });

  // 매핑 생성
  const createMappingMutation = useMutation({
    mutationFn: async (data: typeof newMapping) => {
      const res = await fetch('/api/external-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create mapping');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['external-mapping-stats'] });
      setIsModalOpen(false);
      setNewMapping({
        equipmentSerial: '',
        externalId: '',
        systemName: 'e-gen',
        notes: '',
      });
      alert('매핑이 생성되었습니다.');
    },
    onError: (error: Error) => {
      alert(`오류: ${error.message}`);
    },
  });

  // 검증 승인/취소
  const verifyMappingMutation = useMutation({
    mutationFn: async ({ equipmentSerial, verified }: { equipmentSerial: string; verified: boolean }) => {
      const res = await fetch('/api/external-mapping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentSerial, verified }),
      });
      if (!res.ok) throw new Error('Failed to verify mapping');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['external-mapping-stats'] });
      alert('검증 상태가 업데이트되었습니다.');
    },
  });

  const stats = statsData?.stats;

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">외부 시스템 매칭 관리</h1>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            + 새 매칭 추가
          </Button>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-900 border-gray-800 p-6">
              <div className="text-gray-400 text-sm">전체 장비</div>
              <div className="text-3xl font-bold text-white mt-2">{stats.total_devices.toLocaleString()}</div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-6">
              <div className="text-gray-400 text-sm">매칭 완료</div>
              <div className="text-3xl font-bold text-green-400 mt-2">{stats.matched_devices.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">{stats.matching_rate}%</div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-6">
              <div className="text-gray-400 text-sm">검증 완료</div>
              <div className="text-3xl font-bold text-blue-400 mt-2">{stats.verified_devices.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">{stats.verification_rate}%</div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-6">
              <div className="text-gray-400 text-sm">대기 중</div>
              <div className="text-3xl font-bold text-yellow-400 mt-2">{stats.pending_devices.toLocaleString()}</div>
            </Card>
          </div>
        )}

        {/* 필터 */}
        <Card className="bg-gray-900 border-gray-800 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">장비연번</label>
              <Input
                placeholder="AED-12345"
                value={filters.equipment_serial}
                onChange={(e) => setFilters({ ...filters, equipment_serial: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">매칭 상태</label>
              <Select
                value={filters.matching_method}
                onValueChange={(value) => setFilters({ ...filters, matching_method: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="manual">수작업</SelectItem>
                  <SelectItem value="auto">자동</SelectItem>
                  <SelectItem value="verified">검증완료</SelectItem>
                  <SelectItem value="pending">대기중</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">외부 시스템</label>
              <Select
                value={filters.external_system_name}
                onValueChange={(value) => setFilters({ ...filters, external_system_name: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="e-gen">e-gen</SelectItem>
                  <SelectItem value="fire-department">소방서</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* 매핑 목록 */}
        <Card className="bg-gray-900 border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">장비연번</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">외부 ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">시스템</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">매칭 방법</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">신뢰도</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-400">
                      로딩 중...
                    </td>
                  </tr>
                ) : mappingsData?.mappings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-400">
                      매핑 정보가 없습니다.
                    </td>
                  </tr>
                ) : (
                  mappingsData?.mappings.map((mapping) => (
                    <tr key={mapping.equipment_serial} className="hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-sm text-white font-mono">{mapping.equipment_serial}</td>
                      <td className="px-6 py-4 text-sm text-gray-300 font-mono">{mapping.external_system_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{mapping.external_system_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          mapping.matching_method === 'verified' ? 'bg-blue-900 text-blue-300' :
                          mapping.matching_method === 'auto' ? 'bg-purple-900 text-purple-300' :
                          mapping.matching_method === 'manual' ? 'bg-green-900 text-green-300' :
                          'bg-yellow-900 text-yellow-300'
                        }`}>
                          {mapping.matching_method === 'verified' ? '검증완료' :
                           mapping.matching_method === 'auto' ? '자동' :
                           mapping.matching_method === 'manual' ? '수작업' : '대기중'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{mapping.matching_confidence}%</td>
                      <td className="px-6 py-4 text-sm">
                        {mapping.verified_at ? (
                          <span className="text-green-400">✓ 검증됨</span>
                        ) : (
                          <span className="text-yellow-400">검증 대기</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        {!mapping.verified_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verifyMappingMutation.mutate({
                              equipmentSerial: mapping.equipment_serial,
                              verified: true
                            })}
                            className="border-green-700 text-green-400 hover:bg-green-900"
                          >
                            검증
                          </Button>
                        )}
                        {mapping.verified_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verifyMappingMutation.mutate({
                              equipmentSerial: mapping.equipment_serial,
                              verified: false
                            })}
                            className="border-yellow-700 text-yellow-400 hover:bg-yellow-900"
                          >
                            검증취소
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 새 매칭 모달 */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-gray-900 border-gray-800 p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-white mb-4">새 매칭 추가</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">장비연번</label>
                  <Input
                    placeholder="AED-12345"
                    value={newMapping.equipmentSerial}
                    onChange={(e) => setNewMapping({ ...newMapping, equipmentSerial: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">외부 시스템 ID</label>
                  <Input
                    placeholder="E-GEN-001"
                    value={newMapping.externalId}
                    onChange={(e) => setNewMapping({ ...newMapping, externalId: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">외부 시스템</label>
                  <Select
                    value={newMapping.systemName}
                    onValueChange={(value) => setNewMapping({ ...newMapping, systemName: value })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="e-gen">e-gen</SelectItem>
                      <SelectItem value="fire-department">소방서</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">메모 (선택)</label>
                  <Input
                    placeholder="수작업 매칭 사유"
                    value={newMapping.notes}
                    onChange={(e) => setNewMapping({ ...newMapping, notes: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="border-gray-700 text-gray-300"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={() => createMappingMutation.mutate(newMapping)}
                    disabled={!newMapping.equipmentSerial || !newMapping.externalId}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    생성
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
