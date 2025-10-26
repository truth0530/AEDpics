# Tutorial2 실제 AED 데이터 연동 아키텍처

## 📊 현황 업데이트 (2025-09-16)
**실제 aed_data 테이블 분석 완료!**
- ✅ **80,766개 레코드** 확인 (전체 AED 데이터 업로드 완료)
- ✅ **79개 실제 제조사** 발견 (기존 예상 4개 → **1,975% 증가**)
- ✅ **198개 실제 모델** 발견 (기존 예상 10개 → **1,980% 증가**)
- ✅ **44개 컬럼**의 상세한 데이터 구조 확인
- ✅ **GPS 좌표 이상 탐지 시스템** 구현 (336개 이상 데이터 발견)
- ✅ **자동 GPS 분석** 매일 새벽 2시 실행 (Vercel Cron)

## 개요
Tutorial2는 **실제 수파베이스 aed_data 테이블**과 연동하여 80,766개의 AED 데이터를 효율적으로 처리할 수 있는 확장 가능한 구조로 설계되었습니다.

## 아키텍처 구조

### 1. 데이터 레이어 (실제 데이터 기반)
```
📁 tutorial2/
├── 📁 types/
│   ├── AEDTypes.ts           # 기존 호환성 타입
│   └── RealAEDTypes.ts       # 실제 aed_data 구조 (44개 컬럼)
├── 📁 services/
│   ├── AEDDataService.ts     # 기존 서비스 (호환성)
│   └── RealAEDDataService.ts # 실제 데이터 연동 서비스
├── 📁 hooks/
│   └── useInspectionData.ts  # 상태 관리 훅
└── 📁 components/            # 재사용 가능한 UI 컴포넌트
```

### 2. 실제 데이터 구조 (aed_data 테이블)
```typescript
interface RealAEDData {
  // 44개 컬럼으로 구성된 실제 데이터 구조
  id: number;
  management_number: string;    // 관리번호
  equipment_serial: string;     // 기기시리얼
  sido: string;                // 시도 (17개 지역)
  gugun: string;               // 구군
  manufacturer: string;         // 제조사 (79개)
  model_name: string;          // 모델명 (198개)
  // ... 총 44개 필드
}
```

### 3. 실제 데이터 기반 설계 (✅ 적용 완료)

#### 실제 vs 예상 데이터 비교
```typescript
// ❌ 기존 예상: 4개 제조사 로컬 데이터
AED_MANUFACTURERS: [필립스, CU메디칼, ZOLL, 피지오컨트롤]

// ✅ 실제 발견: 79개 제조사 실시간 조회
const manufacturers = await realAEDDataService.getUniqueManufacturers();
// 결과: ["(주)나눔테크", "씨유메디칠", "나눔테크", "필립스", ...]
```

#### 실제 제조사 분포 (상위 10개)
```typescript
TOP_MANUFACTURERS = [
  { name: "(주)나눔테크", count: 198, percentage: 19.8 },
  { name: "씨유메디칼", count: 190, percentage: 19.0 },
  { name: "나눔테크", count: 120, percentage: 12.0 },
  { name: "(주)라디안", count: 82, percentage: 8.2 },
  { name: "필립스", count: 48, percentage: 4.8 },  // 예상 1위 → 실제 5위
  // ... 총 79개 제조사
];
```

## 🚨 중요: 데이터 무결성 및 점검 시스템 설계

### 핵심 원칙
- ✅ **aed_data (8만개) = 읽기 전용 마스터 데이터** (수정 금지)
- ✅ **equipment_serial = 유일한 안정적 키** (id는 데이터 교체 시 변경됨)
- ✅ **점검 결과 = 별도 테이블**에 저장 (원본 데이터 보호)
- ✅ **점검 상태 가시성** = 통합 뷰로 실시간 확인

## 🔗 수파베이스 실제 연동 완료

### 1. 실제 데이터베이스 스키마 (✅ 확인 완료)
**실제 테이블**: `aed_data` (44개 컬럼, 80,766개 레코드)
```sql
-- 실제 운영 중인 aed_data 테이블 구조
CREATE TABLE aed_data (
  id INTEGER PRIMARY KEY,
  management_number VARCHAR,           -- 관리번호 (예: "20150717-03")
  equipment_serial VARCHAR,            -- 기기시리얼 (예: "12-0000397")
  
  -- 지역 정보
  sido VARCHAR,                        -- 시도 (17개 지역)
  gugun VARCHAR,                       -- 구군
  
  -- 설치 기관 정보  
  installation_institution VARCHAR,     -- 설치기관
  installation_address TEXT,           -- 설치주소
  jurisdiction_health_center VARCHAR,  -- 관할보건소
  installation_position VARCHAR,       -- 설치위치 상세
  
  -- 장비 정보
  manufacturer VARCHAR,                 -- 제조사 (79개 실제 발견)
  model_name VARCHAR,                  -- 모델명 (198개 실제 발견)
  manufacturing_country VARCHAR,       -- 제조국
  serial_number VARCHAR,               -- 시리얼번호
  manufacturing_date DATE,             -- 제조일
  
  -- 소모품 정보
  battery_expiry_date DATE,            -- 배터리 만료일
  patch_expiry_date DATE,              -- 패드 만료일 
  patch_available VARCHAR,             -- 패드 보유 ('Y'/'N')
  
  -- 점검 정보
  last_inspection_date DATE,           -- 최근 점검일
  last_use_date DATE,                  -- 최근 사용일
  
  -- 위치 정보
  longitude DECIMAL,                   -- 경도
  latitude DECIMAL,                    -- 위도
  
  -- 관리 정보
  manager VARCHAR,                     -- 관리자
  institution_contact VARCHAR,         -- 기관 연락처
  establisher VARCHAR,                 -- 설치자
  
  -- 카테고리 분류
  category_1 VARCHAR,                  -- 대분류 (구비의무기관/외)
  category_2 VARCHAR,                  -- 중분류
  category_3 VARCHAR,                  -- 소분류
  
  -- 운영 정보
  operation_status VARCHAR,            -- 운영상태 ('운영')
  display_allowed VARCHAR,             -- 표출허용
  external_display VARCHAR,            -- 외부표출 ('Y'/'N')
  external_non_display_reason TEXT,    -- 미표출 사유
  government_support VARCHAR,          -- 정부지원 구분
  
  -- 날짜 정보
  report_date DATE,                    -- 신고일
  registration_date DATE,              -- 등록일
  first_installation_date DATE,        -- 최초설치일
  installation_date DATE,              -- 설치일
  replacement_date DATE,               -- 교체일
  
  -- 기타
  purchase_institution VARCHAR,        -- 구매기관
  installation_method VARCHAR,         -- 설치방법
  installation_location_address TEXT,  -- 설치위치주소
  remarks TEXT,                        -- 비고
  saeum_deletion_status VARCHAR,       -- 새올삭제상태 ('Y'/'N')
  
  -- 시스템 관리
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 🔑 고유 제약조건 추가 (데이터 무결성 보장)
ALTER TABLE aed_data ADD CONSTRAINT uk_aed_equipment_serial 
UNIQUE (equipment_serial);
```

### 2. 점검 시스템 데이터베이스 설계 (✅ 신규 추가)

#### 점검 결과 테이블
```sql
-- 현장 점검 결과 저장 테이블 (원본 데이터와 분리)
CREATE TABLE aed_inspection_records (
    id BIGSERIAL PRIMARY KEY,
    
    -- 원본 AED 참조 (읽기 전용, equipment_serial 기준)
    source_equipment_serial VARCHAR(255) REFERENCES aed_data(equipment_serial),
    
    -- 점검 메타데이터
    inspection_date DATE NOT NULL,
    inspector_id UUID REFERENCES auth.users(id) NOT NULL,
    inspector_name VARCHAR(100) NOT NULL,
    inspection_type VARCHAR(50) DEFAULT 'routine', -- 'routine', 'emergency', 'maintenance'
    inspection_duration_minutes INTEGER,
    
    -- 📋 점검 시점의 실제 확인된 정보 (원본과 다를 수 있음)
    confirmed_manufacturer VARCHAR(255),
    confirmed_model_name VARCHAR(255),
    confirmed_serial_number VARCHAR(255),
    confirmed_location TEXT,
    confirmed_installation_position TEXT,
    confirmed_battery_expiry DATE,
    confirmed_pad_expiry DATE,
    confirmed_device_expiry DATE,
    
    -- 🔍 점검 결과 (상태)
    battery_status VARCHAR(50) NOT NULL, -- 'normal', 'warning', 'expired', 'missing', 'damaged'
    battery_level_percentage INTEGER, -- 실제 측정값
    battery_visual_condition VARCHAR(50), -- 'good', 'swollen', 'corroded'
    
    pad_status VARCHAR(50) NOT NULL, -- 'normal', 'warning', 'expired', 'missing', 'damaged'
    pad_package_intact BOOLEAN,
    pad_expiry_readable BOOLEAN,
    
    device_status VARCHAR(50) NOT NULL, -- 'working', 'error', 'damaged', 'missing'
    device_display_working BOOLEAN,
    device_self_test_passed BOOLEAN,
    device_physical_damage TEXT,
    
    -- 🏢 접근성 및 환경
    accessibility_status VARCHAR(50) NOT NULL, -- 'excellent', 'good', 'poor', 'blocked'
    accessibility_issues TEXT,
    signage_visible BOOLEAN,
    signage_condition VARCHAR(50), -- 'good', 'faded', 'damaged', 'missing'
    qr_code_readable BOOLEAN,
    cabinet_locked BOOLEAN,
    cabinet_condition VARCHAR(50),
    
    -- 📍 위치 검증
    gps_coordinates POINT, -- 실제 측정된 GPS
    location_matches_record BOOLEAN,
    location_access_notes TEXT,
    
    -- 🛠️ 조치 사항
    action_required VARCHAR(100) NOT NULL, -- 'none', 'battery_replace', 'pad_replace', 'repair', 'relocate'
    action_notes TEXT,
    action_urgency VARCHAR(20) DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
    follow_up_date DATE,
    follow_up_assigned_to UUID REFERENCES auth.users(id),
    
    -- 📸 증빙 자료
    photos JSONB, -- [{url: string, description: string, type: 'device'|'location'|'damage'}]
    additional_files JSONB, -- 추가 첨부파일
    
    -- 🌡️ 환경 조건
    temperature_celsius DECIMAL(4,1),
    humidity_percentage INTEGER,
    environmental_notes TEXT,
    
    -- ✅ 점검 완료 여부
    inspection_completed BOOLEAN DEFAULT false,
    completion_notes TEXT,
    quality_check_passed BOOLEAN,
    supervisor_approval UUID REFERENCES auth.users(id),
    
    -- 📊 시스템 정보
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 💡 추가 메모
    inspector_comments TEXT,
    public_notes TEXT, -- 외부 공개 가능한 메모
    internal_notes TEXT -- 내부용 메모
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_inspection_equipment_serial ON aed_inspection_records(source_equipment_serial);
CREATE INDEX idx_inspection_date ON aed_inspection_records(inspection_date DESC);
CREATE INDEX idx_inspection_status ON aed_inspection_records(inspection_completed, action_required);
CREATE INDEX idx_inspection_inspector ON aed_inspection_records(inspector_id);
CREATE INDEX idx_inspection_priority ON aed_inspection_records(action_urgency, follow_up_date);
```

#### 점검 상태 통합 뷰
```sql
-- 🎯 점검원이 보는 통합 뷰 (점검 상태 포함)
CREATE VIEW aed_with_inspection_status AS
SELECT 
    a.*,
    
    -- 최근 점검 정보
    COALESCE(i.last_inspection_date, NULL) as last_inspection_date,
    COALESCE(i.inspection_status, 'never_inspected') as inspection_status,
    COALESCE(i.inspector_name, NULL) as last_inspector,
    COALESCE(i.action_required, 'unknown') as last_action_required,
    
    -- 다음 점검 예정일 계산
    COALESCE(i.follow_up_date, 
             COALESCE(i.last_inspection_date + INTERVAL '3 months',
                     a.last_inspection_date + INTERVAL '3 months',
                     NOW() + INTERVAL '1 day')) as next_inspection_due,
    
    -- 🚨 점검 우선순위 자동 계산
    CASE 
        WHEN i.last_inspection_date IS NULL THEN 'never_inspected'
        WHEN i.action_required IN ('battery_replace', 'pad_replace', 'repair') 
             AND i.action_urgency = 'urgent' THEN 'action_urgent'
        WHEN i.last_inspection_date < NOW() - INTERVAL '6 months' THEN 'overdue'
        WHEN i.last_inspection_date < NOW() - INTERVAL '3 months' THEN 'due'
        WHEN a.battery_expiry_date < NOW() + INTERVAL '30 days' THEN 'battery_warning'
        WHEN a.patch_expiry_date < NOW() + INTERVAL '30 days' THEN 'pad_warning'
        ELSE 'current'
    END as inspection_priority,
    
    -- 우선순위 점수 (정렬용)
    CASE 
        WHEN i.last_inspection_date IS NULL THEN 100
        WHEN i.action_required IN ('battery_replace', 'pad_replace', 'repair') 
             AND i.action_urgency = 'urgent' THEN 95
        WHEN i.last_inspection_date < NOW() - INTERVAL '6 months' THEN 80
        WHEN i.last_inspection_date < NOW() - INTERVAL '3 months' THEN 60
        WHEN a.battery_expiry_date < NOW() + INTERVAL '30 days' THEN 50
        WHEN a.patch_expiry_date < NOW() + INTERVAL '30 days' THEN 45
        ELSE 10
    END as priority_score,
    
    -- 📊 추가 정보
    i.total_inspections,
    i.last_photos,
    i.last_completion_status
    
FROM aed_data a
LEFT JOIN LATERAL (
    SELECT 
        inspection_date as last_inspection_date,
        inspector_name,
        action_required,
        action_urgency,
        follow_up_date,
        inspection_completed,
        photos as last_photos,
        
        -- 점검 상태 계산
        CASE 
            WHEN NOT inspection_completed THEN 'in_progress'
            WHEN action_required = 'none' THEN 'completed_ok'
            WHEN action_required IN ('battery_replace', 'pad_replace') THEN 'completed_action_needed'
            WHEN action_required IN ('repair', 'relocate') THEN 'completed_issues'
            ELSE 'completed_unknown'
        END as inspection_status,
        
        -- 완료 상태
        inspection_completed as last_completion_status,
        
        -- 총 점검 횟수 (서브쿼리)
        (SELECT COUNT(*) FROM aed_inspection_records ir2 
         WHERE ir2.source_equipment_serial = a.equipment_serial) as total_inspections
        
    FROM aed_inspection_records ir
    WHERE ir.source_equipment_serial = a.equipment_serial
    ORDER BY ir.inspection_date DESC, ir.created_at DESC
    LIMIT 1
) i ON true;

-- 성능 최적화용 인덱스
CREATE INDEX idx_aed_equipment_serial ON aed_data(equipment_serial);
CREATE INDEX idx_aed_sido_gugun ON aed_data(sido, gugun);
CREATE INDEX idx_aed_battery_expiry ON aed_data(battery_expiry_date);
CREATE INDEX idx_aed_patch_expiry ON aed_data(patch_expiry_date);
```

#### 점검 통계 뷰
```sql
-- 📈 점검 통계 요약 뷰
CREATE VIEW inspection_statistics AS
SELECT 
    sido,
    gugun,
    COUNT(*) as total_devices,
    COUNT(CASE WHEN inspection_priority = 'never_inspected' THEN 1 END) as never_inspected,
    COUNT(CASE WHEN inspection_priority = 'overdue' THEN 1 END) as overdue,
    COUNT(CASE WHEN inspection_priority = 'due' THEN 1 END) as due,
    COUNT(CASE WHEN inspection_priority = 'current' THEN 1 END) as current,
    COUNT(CASE WHEN inspection_priority LIKE '%warning' THEN 1 END) as warnings,
    COUNT(CASE WHEN inspection_priority = 'action_urgent' THEN 1 END) as urgent_actions,
    
    -- 완료율 계산
    ROUND(
        COUNT(CASE WHEN inspection_priority = 'current' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completion_percentage,
    
    -- 평균 점검 간격
    AVG(EXTRACT(days FROM (NOW() - last_inspection_date))) as avg_days_since_inspection
    
FROM aed_with_inspection_status
GROUP BY sido, gugun
ORDER BY sido, gugun;
```

### 3. 데이터 마이그레이션 및 연동 계획

#### Phase 1: 현장 점검 시스템 구현 (✅ 우선)
```typescript
// 🎯 점검 프로세스 플로우
class InspectionWorkflow {
  
  // 1. 점검 대상 장비 조회 (통합 뷰 사용)
  async getInspectionQueue(inspectorId: string, region?: string) {
    return supabase
      .from('aed_with_inspection_status')
      .select('*')
      .eq('sido', region || await this.getInspectorRegion(inspectorId))
      .in('inspection_priority', ['never_inspected', 'overdue', 'due', 'action_urgent'])
      .order('priority_score', { ascending: false })
      .limit(50);
  }
  
  // 2. 점검 시작 (원본 데이터 읽기 전용 조회)
  async startInspection(equipmentSerial: string, inspectorId: string) {
    // 원본 데이터 조회 (읽기 전용)
    const { data: originalData } = await supabase
      .from('aed_data')
      .select('*')
      .eq('equipment_serial', equipmentSerial)
      .single();
    
    // 점검 세션 시작
    const inspectionRecord = {
      source_equipment_serial: equipmentSerial,
      inspector_id: inspectorId,
      inspector_name: await this.getInspectorName(inspectorId),
      inspection_date: new Date().toISOString().split('T')[0],
      inspection_type: 'routine',
      
      // 원본 정보 복사 (기본값)
      confirmed_manufacturer: originalData.manufacturer,
      confirmed_model_name: originalData.model_name,
      confirmed_serial_number: originalData.serial_number,
      confirmed_location: originalData.installation_position,
      confirmed_battery_expiry: originalData.battery_expiry_date,
      confirmed_pad_expiry: originalData.patch_expiry_date,
      
      inspection_completed: false
    };
    
    return supabase
      .from('aed_inspection_records')
      .insert(inspectionRecord)
      .select()
      .single();
  }
  
  // 3. 점검 데이터 입력 ("일치" 또는 "수정")
  async updateInspectionData(inspectionId: number, data: {
    dataMatches: boolean; // "일치" 버튼 클릭 시 true
    confirmedData?: Partial<InspectionConfirmedData>;
    inspectionResults: InspectionResults;
  }) {
    
    const updateData: any = {
      ...data.inspectionResults,
      updated_at: new Date().toISOString()
    };
    
    // "수정" 한 경우에만 확인된 데이터 업데이트
    if (!data.dataMatches && data.confirmedData) {
      Object.assign(updateData, data.confirmedData);
    }
    
    return supabase
      .from('aed_inspection_records')
      .update(updateData)
      .eq('id', inspectionId);
  }
  
  // 4. 점검 완료
  async completeInspection(inspectionId: number, finalData: {
    actionRequired: string;
    actionUrgency: string;
    photos?: Array<{url: string, description: string}>;
    inspectorComments?: string;
  }) {
    
    return supabase
      .from('aed_inspection_records')
      .update({
        ...finalData,
        inspection_completed: true,
        completion_notes: finalData.inspectorComments,
        photos: JSON.stringify(finalData.photos || []),
        updated_at: new Date().toISOString()
      })
      .eq('id', inspectionId);
  }
}
```

#### Phase 2: 실시간 점검 상태 동기화
```typescript
// 🔄 실시간 점검 상태 업데이트
export function useInspectionStatusSync() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // 점검 완료 시 다른 점검원들에게 실시간 알림
    const subscription = supabase
      .channel('inspection_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public', 
        table: 'aed_inspection_records'
      }, (payload) => {
        // 점검 큐 새로고침
        queryClient.invalidateQueries(['inspection-queue']);
        
        // 완료 알림
        toast.success(
          `${payload.new.source_equipment_serial} 점검이 완료되었습니다 (${payload.new.inspector_name})`
        );
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'aed_inspection_records',
        filter: 'inspection_completed=eq.true'
      }, (payload) => {
        // 점검 완료 시 상태 업데이트
        queryClient.invalidateQueries(['aed-status', payload.new.source_equipment_serial]);
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, []);
}

// 📊 점검원 대시보드
export function InspectionDashboard() {
  const { data: inspectionQueue } = useQuery(
    ['inspection-queue'],
    () => inspectionService.getInspectionQueue(currentUser.id)
  );
  
  const { data: stats } = useQuery(
    ['inspection-stats'],
    () => supabase.from('inspection_statistics').select('*')
  );
  
  return (
    <div className="space-y-6">
      {/* 우선순위별 점검 대상 */}
      <InspectionPriorityCards data={inspectionQueue} />
      
      {/* 점검 진행 상황 */}
      <InspectionProgress stats={stats} />
      
      {/* 점검 대상 목록 */}
      <InspectionQueueList data={inspectionQueue} />
    </div>
  );
}
```

#### Phase 3: 점검 UI 컴포넌트
```typescript
// 🎯 점검 상태 표시 컴포넌트
function InspectionStatusBadge({ priority, status }) {
  const getBadgeStyle = (priority: string) => {
    switch(priority) {
      case 'never_inspected': return 'bg-red-600 text-white';
      case 'action_urgent': return 'bg-red-500 text-white animate-pulse';
      case 'overdue': return 'bg-orange-500 text-white';
      case 'due': return 'bg-yellow-500 text-black';
      case 'battery_warning': return 'bg-amber-500 text-white';
      case 'pad_warning': return 'bg-amber-400 text-black';
      case 'current': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  const getLabel = (priority: string) => {
    switch(priority) {
      case 'never_inspected': return '미점검';
      case 'action_urgent': return '긴급조치';
      case 'overdue': return '점검연체';
      case 'due': return '점검필요';
      case 'battery_warning': return '배터리교체';
      case 'pad_warning': return '패드교체';
      case 'current': return '점검완료';
      default: return '상태불명';
    }
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeStyle(priority)}`}>
      {getLabel(priority)}
    </span>
  );
}

// 📋 점검 폼 컴포넌트
function InspectionForm({ equipmentSerial, originalData }) {
  const [dataMatches, setDataMatches] = useState<boolean | null>(null);
  const [confirmedData, setConfirmedData] = useState(originalData);
  const [inspectionResults, setInspectionResults] = useState({});
  
  return (
    <form className="space-y-6">
      {/* 원본 데이터 확인 */}
      <DataVerificationSection
        originalData={originalData}
        onConfirm={() => setDataMatches(true)}
        onModify={() => setDataMatches(false)}
        confirmedData={confirmedData}
        onDataChange={setConfirmedData}
        showEditFields={dataMatches === false}
      />
      
      {/* 점검 결과 입력 */}
      <InspectionResultsSection
        results={inspectionResults}
        onChange={setInspectionResults}
      />
      
      {/* 사진 및 메모 */}
      <PhotoUploadSection />
      <NotesSection />
      
      {/* 완료 버튼 */}
      <CompleteInspectionButton 
        onComplete={() => handleComplete(dataMatches, confirmedData, inspectionResults)}
      />
    </form>
  );
}
```

#### Phase 4: 데이터 무결성 및 권한 관리
```sql
-- 🔒 보안 정책 (RLS - Row Level Security)

-- aed_data: 읽기 전용 (모든 인증된 사용자)
ALTER TABLE aed_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY aed_data_read_only ON aed_data 
FOR SELECT 
TO authenticated 
USING (true);

-- aed_inspection_records: 점검원만 수정 가능
ALTER TABLE aed_inspection_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY inspection_records_insert ON aed_inspection_records 
FOR INSERT 
TO authenticated 
WITH CHECK (
  inspector_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' IN ('inspector', 'admin')
  )
);

CREATE POLICY inspection_records_update ON aed_inspection_records 
FOR UPDATE 
TO authenticated 
USING (
  inspector_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY inspection_records_select ON aed_inspection_records 
FOR SELECT 
TO authenticated 
USING (true); -- 모든 점검 결과는 조회 가능

-- 🚫 aed_data 수정 방지 (INSERT, UPDATE, DELETE 차단)
-- 관리자만 데이터 갱신 가능하도록 제한
```

## 성능 최적화 전략

### 1. 대용량 데이터 처리
- **페이지네이션**: 한 번에 50-100개씩 로드
- **가상화**: React Window로 대량 리스트 렌더링
- **인덱싱**: 우선순위, 지역, 제조사별 인덱스
- **캐싱**: React Query로 서버 상태 관리

### 2. 검색 및 필터링
```typescript
// 복합 인덱스 활용 검색
const searchDevices = async (filters: {
  region?: string;
  manufacturer?: string;
  priority?: string;
  expiryRange?: [Date, Date];
}) => {
  // 수파베이스 쿼리 최적화
  let query = supabase.from('aed_devices').select('*');
  
  if (filters.region) query = query.ilike('installation_org', `%${filters.region}%`);
  if (filters.manufacturer) query = query.eq('manufacturer', filters.manufacturer);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.expiryRange) {
    query = query.gte('battery_expiry', filters.expiryRange[0])
                 .lte('battery_expiry', filters.expiryRange[1]);
  }
  
  return query;
};
```

## 확장 포인트

### 1. 새로운 제조사 자동 감지
```typescript
// 새로운 제조사가 데이터에 추가되면 자동으로 감지하고 목록 업데이트
const updateManufacturerList = async () => {
  const currentManufacturers = await getManufacturers();
  const deviceManufacturers = await extractManufacturersFromDevices();
  
  const newManufacturers = deviceManufacturers.filter(
    mfg => !currentManufacturers.some(current => current.name === mfg)
  );
  
  // 새로운 제조사 자동 등록
  for (const newMfg of newManufacturers) {
    await addManufacturer({ name: newMfg, country: 'Unknown' });
  }
};
```

### 2. 지역별 특성 확장
```typescript
// 지역별 기후/환경 특성을 실제 설치 위치 데이터와 연동
const getRegionalCharacteristics = (latitude: number, longitude: number) => {
  // 위치 기반 특성 자동 분류
  if (isCoastalArea(latitude, longitude)) return ['해안', '염분', '습도'];
  if (isMountainousArea(latitude, longitude)) return ['산간', '혹한', '접근성'];
  if (isUrbanArea(latitude, longitude)) return ['도시', '인구밀도', '교통'];
  return ['일반'];
};
```

## 테스트 전략

### 1. 단위 테스트
```typescript
describe('AEDDataService', () => {
  test('should handle large dataset pagination', async () => {
    const devices = await aedDataService.getAEDDevices(1000, 5000);
    expect(devices).toHaveLength(1000);
  });
  
  test('should extract unique manufacturers', async () => {
    const manufacturers = await aedDataService.extractManufacturersFromDevices();
    expect(new Set(manufacturers).size).toBe(manufacturers.length);
  });
});
```

### 2. 통합 테스트
```typescript
describe('Supabase Integration', () => {
  test('should sync with real database', async () => {
    const devices = await aedDataService.getAEDDevices(10);
    expect(devices[0]).toHaveProperty('manufacturer');
    expect(devices[0]).toHaveProperty('priority');
  });
});
```

## 배포 시나리오

### 1. 단계적 마이그레이션
1. **Phase 0**: 현재 로컬 데이터 (완료)
2. **Phase 1**: 수파베이스 연결 + 샘플 데이터
3. **Phase 2**: 실제 8만대 데이터 연동
4. **Phase 3**: 실시간 동기화 + 성능 최적화

### 2. 롤백 계획
```typescript
// 수파베이스 연결 실패 시 로컬 데이터로 자동 fallback
const loadDevicesWithFallback = async () => {
  try {
    return await loadFromSupabase();
  } catch (error) {
    console.warn('Supabase connection failed, using local data');
    return loadFromLocal();
  }
};
```

## 🎯 구현 우선순위 로드맵

### Week 1-2: 점검 시스템 기반 구축
- [ ] `aed_inspection_records` 테이블 생성
- [ ] `aed_with_inspection_status` 뷰 생성
- [ ] InspectionWorkflow 클래스 구현
- [ ] 기본 점검 UI 컴포넌트 개발

### Week 3-4: 점검 프로세스 완성
- [ ] "일치/수정" 기능 구현
- [ ] 사진 업로드 시스템 
- [ ] 실시간 상태 동기화
- [ ] 점검원 대시보드 완성

### Week 5-6: 최적화 및 테스트
- [ ] 성능 최적화 (인덱싱, 쿼리 튜닝)
- [ ] 권한 관리 (RLS) 적용
- [ ] 통합 테스트 및 버그 수정
- [ ] 사용자 교육 자료 제작

## 🚨 중요 참고사항

### 데이터 무결성 원칙
1. **절대 수정 금지**: `aed_data` 테이블은 읽기 전용
2. **안정적 키 사용**: `equipment_serial`만을 외래키로 사용
3. **점검 데이터 분리**: 모든 점검 결과는 별도 테이블에 저장
4. **실시간 가시성**: 통합 뷰로 점검 상태 실시간 확인

### 확장성 고려사항
- **8만대 데이터 대응**: 페이지네이션, 인덱싱 최적화
- **다중 점검원**: 실시간 동기화, 충돌 방지
- **모바일 지원**: PWA 기반 오프라인 점검 지원
- **백업 및 복구**: 점검 데이터 안전성 보장

---

**Last Updated**: 2025-09-13  
**Version**: 2.0.0 (현장 점검 시스템 설계 완료)  
**Next Milestone**: 점검 시스템 구현 및 테스트