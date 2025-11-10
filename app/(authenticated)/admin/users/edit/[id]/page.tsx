'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { REGIONS, getRegionCode, getRegionLabel } from '@/lib/constants/regions';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

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
  const { data: session } = useSession();
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

  // 편집 대상 사용자의 이메일 도메인에 따라 역할 선택지 결정
  const getRoleOptions = () => {
    const targetEmail = user?.email || '';

    // 역할 선택지 정의
    const allRoles = [
      { value: 'emergency_center_admin', label: '중앙응급의료센터' },
      { value: 'regional_emergency_center_admin', label: '응급의료지원센터' },
      { value: 'ministry_admin', label: '보건복지부' },
      { value: 'regional_admin', label: '시도 담당자' },
      { value: 'local_admin', label: '보건소 담당자' },
      { value: 'temporary_inspector', label: '임시점검원' }
    ];

    // @nmc.or.kr 계정: 중앙응급의료센터, 응급의료지원센터만 선택 가능
    if (targetEmail.endsWith('@nmc.or.kr')) {
      return allRoles.filter(r =>
        r.value === 'emergency_center_admin' ||
        r.value === 'regional_emergency_center_admin'
      );
    }

    // @korea.kr 계정: 보건복지부, 시도 담당자, 보건소 담당자만 선택 가능
    if (targetEmail.endsWith('@korea.kr')) {
      return allRoles.filter(r =>
        r.value === 'ministry_admin' ||
        r.value === 'regional_admin' ||
        r.value === 'local_admin'
      );
    }

    // 기타 이메일: 임시점검원만 선택 가능
    return allRoles.filter(r => r.value === 'temporary_inspector');
  };

  // 사용자 정보 로드
  useEffect(() => {
    fetchUser();
  }, [userId]);

  // 지역 변경 시 조직 목록 로드
  useEffect(() => {
    if (formData.region) {
      // 지역 레이블을 코드로 변환하여 API에 전달
      const regionCode = getRegionCode(formData.region);
      if (regionCode) {
        fetchOrganizations(regionCode);
      }
    }
  }, [formData.region]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error('사용자 정보를 불러올 수 없습니다');

      const data = await response.json();
      setUser(data.user);

      // region_code를 label로 변환 (DB에서는 code로 저장되어 있음)
      const regionLabel = data.user.region_code ? getRegionLabel(data.user.region_code) : (data.user.region || '');

      setFormData({
        role: data.user.role,
        region: regionLabel,
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
      // 편집 페이지에서는 모든 조직을 조회 (includeAll=true)
      const response = await fetch(`/api/organizations/with-admin?region=${encodeURIComponent(region)}&includeAll=true`);
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

      const response = await fetch(`/api/admin/users/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          role: formData.role,
          regionCode: regionCode,
          organizationId: formData.organization_id,
          organizationName: selectedOrg?.name || formData.organization_name,
          fullName: user?.full_name,
          email: user?.email,
          phone: null
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
          {/* 지역 | 구/군 | 소속 조직 (3열) */}
          <div className="grid grid-cols-3 gap-4">
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
                    organization_id: '' // 지역 변경 시 조직ID만 초기화 (직접 입력값은 유지)
                  });
                }}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
              >
                <option value="">지역을 선택하세요</option>
                {REGIONS.map(region => (
                  <option key={region.code} value={region.label}>
                    {region.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 구/군 입력 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                구/군 {(formData.role === 'local_admin' || formData.role === 'regional_admin' || formData.role === 'temporary_inspector') && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={formData.district || ''}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
                placeholder="구/군을 입력하세요"
                disabled={formData.role !== 'local_admin' && formData.role !== 'regional_admin' && formData.role !== 'temporary_inspector'}
              />
            </div>

            {/* 소속 조직 선택 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                소속 조직 {formData.role === 'temporary_inspector' && <span className="text-red-500">*</span>}
              </label>
              {loadingOrgs ? (
                <div className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  불러오는 중...
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
                      organization_name: org?.name || formData.organization_name // 선택하지 않으면 기존값 유지
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
                  disabled={!formData.region}
                >
                  <option value="">
                    {!formData.region
                      ? '지역 선택'
                      : organizations.length === 0
                      ? '조직 없음'
                      : '선택 (선택사항)'
                    }
                  </option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                      {org.hasAdmin
                        ? ` (담당자 ${org.adminCount}명)`
                        : ' (담당자 없음)'
                      }
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 조직 선택 후 안내 메시지 */}
          {formData.role === 'temporary_inspector' && formData.organization_id && (
            <Alert className={organizations.find(o => o.id === formData.organization_id)?.hasAdmin ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
              <AlertDescription className={organizations.find(o => o.id === formData.organization_id)?.hasAdmin ? "text-green-700" : "text-yellow-700"}>
                {organizations.find(o => o.id === formData.organization_id)?.hasAdmin
                  ? "✅ 이 보건소에는 담당자가 있어 정상적으로 장비 할당이 가능합니다"
                  : "⚠️ 이 보건소에는 담당자가 없습니다. 시스템 관리자가 대리 할당해야 합니다"}
              </AlertDescription>
            </Alert>
          )}

          {/* 조직명 직접 입력 (항상 표시) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              조직명 (직접 입력) {formData.role === 'temporary_inspector' && !formData.organization_id && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.organization_name}
              onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
              placeholder="조직을 선택하지 않은 경우 직접 입력하세요"
            />
            {formData.organization_id && formData.organization_name && (
              <p className="text-xs text-gray-500 mt-1">
                위의 선택된 조직으로 저장됩니다
              </p>
            )}
          </div>

          {/* 이름 | 이메일 (2열) */}
          <div className="grid grid-cols-2 gap-4">
            {/* 이름 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium mb-2">이름</label>
              <input
                type="text"
                value={user?.full_name || ''}
                disabled
                className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600"
              />
            </div>

            {/* 이메일 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium mb-2">이메일</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600"
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
              <option value="">역할을 선택하세요</option>
              {getRoleOptions().map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

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