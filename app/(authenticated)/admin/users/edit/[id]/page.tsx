'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { REGIONS, getRegionCode } from '@/lib/constants/regions';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  region?: string;
  district?: string;
  region_code?: string;
  organization_id?: string;
  organization_name?: string;
  is_active: boolean;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  region_code?: string;
  city_code?: string;
  hasAdmin: boolean;
  adminCount: number;
}

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    role: '',
    region: '',
    district: '',
    organization_id: '',
    organization_name: '',
    is_active: false
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // 사용자 정보 로드
  useEffect(() => {
    fetchUser();
  }, [userId]);

  // 지역 변경 시 조직 목록 로드
  useEffect(() => {
    if (formData.region) {
      fetchOrganizations(formData.region);
    }
  }, [formData.region]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error('사용자 정보를 불러올 수 없습니다');

      const data = await response.json();
      setUser(data.user);
      setFormData({
        role: data.user.role,
        region: data.user.region || '',
        district: data.user.district || '',
        organization_id: data.user.organization_id || '',
        organization_name: data.user.organization_name || '',
        is_active: data.user.is_active
      });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      toast.error('사용자 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async (region: string) => {
    setLoadingOrgs(true);
    try {
      // local_admin이 있는 조직만 조회
      const response = await fetch(`/api/organizations/with-admin?region=${encodeURIComponent(region)}`);
      if (!response.ok) throw new Error('조직 목록을 불러올 수 없습니다');

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      toast.error('조직 목록을 불러오는데 실패했습니다');
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // 선택한 조직의 정보 가져오기
      const selectedOrg = organizations.find(org => org.id === formData.organization_id);

      // region_code 계산
      const regionCode = getRegionCode(formData.region);

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: formData.role,
          region: formData.region,
          district: formData.district,
          region_code: regionCode,
          organization_id: formData.organization_id,
          organization_name: selectedOrg?.name || formData.organization_name,
          is_active: formData.is_active
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '저장에 실패했습니다');
      }

      toast.success('사용자 정보가 성공적으로 업데이트되었습니다');

      // 임시점검원이고 조직이 변경된 경우 장비 재할당 필요 알림
      if (formData.role === 'temporary_inspector' && selectedOrg) {
        if (!selectedOrg.hasAdmin) {
          toast.warning('선택한 보건소에 담당자가 없어 장비 할당이 필요합니다');
        } else {
          toast.info('조직이 변경되어 장비 재할당이 필요할 수 있습니다');
        }
      }

      // 목록으로 돌아가기
      setTimeout(() => {
        router.push('/admin/users');
      }, 1500);
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error instanceof Error ? error.message : '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">사용자 정보를 불러오는 중...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Alert>
          <AlertDescription>
            사용자를 찾을 수 없습니다.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>사용자 정보 수정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 기본 정보 (읽기 전용) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">이메일</label>
              <input
                type="text"
                value={user.email}
                disabled
                className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">이름</label>
              <input
                type="text"
                value={user.full_name}
                disabled
                className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-500"
              />
            </div>
          </div>

          {/* 역할 선택 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              역할 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
            >
              <option value="pending_approval">승인 대기</option>
              <option value="temporary_inspector">임시 점검원</option>
              <option value="local_admin">보건소 담당자</option>
              <option value="regional_admin">시도 관리자</option>
              <option value="master">중앙 관리자</option>
            </select>
            {formData.role === 'temporary_inspector' && (
              <p className="text-sm text-yellow-600 mt-1">
                ⚠️ 임시점검원은 local_admin이 있는 보건소에만 소속될 수 있습니다
              </p>
            )}
          </div>

          {/* 지역 선택 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              지역 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.region}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  region: e.target.value,
                  organization_id: '', // 지역 변경 시 조직 초기화
                  organization_name: ''
                });
              }}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
            >
              <option value="">지역을 선택하세요</option>
              {Object.keys(REGIONS).map(region => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          {/* 구/군 입력 */}
          <div>
            <label className="block text-sm font-medium mb-2">구/군</label>
            <input
              type="text"
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              placeholder="예: 중구, 충주시"
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 소속 조직 선택 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              소속 조직 {formData.role === 'temporary_inspector' && <span className="text-red-500">*</span>}
            </label>
            {loadingOrgs ? (
              <div className="w-full px-3 py-2 border rounded-md bg-gray-50">
                조직 목록을 불러오는 중...
              </div>
            ) : (
              <select
                value={formData.organization_id}
                onChange={(e) => {
                  const orgId = e.target.value;
                  const org = organizations.find(o => o.id === orgId);
                  setFormData({
                    ...formData,
                    organization_id: orgId,
                    organization_name: org?.name || ''
                  });
                }}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
                disabled={!formData.region}
              >
                <option value="">
                  {!formData.region
                    ? '지역을 먼저 선택하세요'
                    : organizations.length === 0
                    ? '선택 가능한 조직이 없습니다'
                    : '조직을 선택하세요'
                  }
                </option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                    {org.hasAdmin
                      ? ` (담당자 ${org.adminCount}명)`
                      : ' ⚠️ (담당자 없음)'
                    }
                  </option>
                ))}
              </select>
            )}

            {formData.role === 'temporary_inspector' && formData.organization_id && (
              <div className="mt-2">
                {organizations.find(o => o.id === formData.organization_id)?.hasAdmin ? (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-700">
                      ✅ 이 보건소에는 담당자가 있어 정상적으로 장비 할당이 가능합니다
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertDescription className="text-yellow-700">
                      ⚠️ 이 보건소에는 담당자가 없습니다. 시스템 관리자가 대리 할당해야 합니다
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* 조직명 직접 입력 (필요시) */}
          {!formData.organization_id && formData.organization_name && (
            <div>
              <label className="block text-sm font-medium mb-2">조직명 (직접 입력)</label>
              <input
                type="text"
                value={formData.organization_name}
                onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* 계정 활성화 */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary focus:ring-primary"
            />
            <label htmlFor="is_active" className="text-sm font-medium">
              계정 활성화
            </label>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/users')}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}