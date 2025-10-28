# 관리자 승인 기능 완성 계획

**작성일**: 2025-10-28
**상태**: 백엔드 API 완성 / 이메일 및 프론트엔드 구현 필요

## 현재 구현 상태

### 완성된 백엔드 API

#### 1. 사용자 승인 API
**Endpoint**: `POST /api/admin/users/[id]/approve`

**Request**:
```json
{
  "role": "local_admin" | "inspector" | "temporary_inspector",
  "notes": "승인 사유 (선택)"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@korea.kr",
    "role": "inspector",
    "approved_by": "admin-uuid",
    "approved_at": "2025-10-28T00:00:00Z"
  },
  "message": "사용자가 승인되었습니다."
}
```

**구현 내용**:
- 권한 검증 (APPROVE_USERS)
- 역할 변경 및 활성화
- Audit Log 기록
- approved_by, approved_at 기록

#### 2. 사용자 거부 API
**Endpoint**: `POST /api/admin/users/[id]/reject`

**Request**:
```json
{
  "reason": "거부 사유 (필수)"
}
```

**Response**:
```json
{
  "success": true,
  "message": "사용자가 거부되었습니다."
}
```

**구현 내용**:
- 권한 검증 (APPROVE_USERS)
- 거부 사유 필수 검증
- 사용자 삭제 (hard delete)
- Audit Log 기록

#### 3. 사용자 목록 조회 API
**Endpoint**: `GET /api/admin/users/list`

**Query Parameters**:
- `status`: pending_approval | approved | rejected
- `search`: 이름 또는 이메일 검색
- `limit`: 최대 개수 (기본 50, 최대 100)
- `offset`: 오프셋

**Response**:
```json
{
  "users": [
    {
      "id": "user-uuid",
      "email": "user@korea.kr",
      "fullName": "홍길동",
      "role": "pending_approval",
      "phone": "010-1234-5678",
      "organization_name": "서울특별시 강서구 보건소",
      "department": "의약과",
      "createdAt": "2025-10-28T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

## 미완성 작업

### 1. 이메일 발송 기능 구현

#### 1.1. 승인 이메일 발송

**파일**: `lib/email/approval-email.ts` (신규 생성 필요)

**요구사항**:
- NCP Cloud Outbound Mailer 사용
- 승인된 역할 정보 포함
- 로그인 링크 제공
- 역할별 권한 안내

**이메일 템플릿**:
```
제목: [AED관리시스템] 계정이 승인되었습니다

안녕하세요 {사용자 이름}님,

AED 관리 시스템 가입 신청이 승인되었습니다.

승인 정보:
- 이메일: {user.email}
- 역할: {role_korean}
- 소속: {organization_name}
- 승인 일시: {approved_at}

이제 시스템에 로그인하여 서비스를 이용하실 수 있습니다.

로그인: https://aed.pics/auth/login

역할별 권한:
{role_permissions_description}

문의사항이 있으시면 아래 연락처로 문의해 주세요.

관리자: admin@nmc.or.kr
기술지원: inhak@nmc.or.kr

감사합니다.
```

**역할별 권한 설명**:
- `local_admin`: 지역 관리자 - 소속 지역 내 전체 AED 데이터 조회 및 점검 관리
- `inspector`: 점검원 - 배정된 AED 점검 수행 및 보고서 작성
- `temporary_inspector`: 임시 점검원 - 제한된 기간 동안 점검 수행
- `field_admin`: 현장 관리자 - 현장 점검 활동 관리

#### 1.2. 거부 이메일 발송

**파일**: `lib/email/rejection-email.ts` (신규 생성 필요)

**요구사항**:
- NCP Cloud Outbound Mailer 사용
- 거부 사유 포함
- 재신청 안내
- 문의 연락처 제공

**이메일 템플릿**:
```
제목: [AED관리시스템] 가입 신청이 반려되었습니다

안녕하세요 {사용자 이름}님,

AED 관리 시스템 가입 신청이 반려되었습니다.

반려 사유:
{rejection_reason}

반려된 신청에 대해 문의사항이 있으시거나 재신청을 원하시는 경우,
아래 연락처로 문의해 주시기 바랍니다.

관리자: admin@nmc.or.kr
기술지원: inhak@nmc.or.kr

감사합니다.
```

#### 1.3. 이메일 발송 함수 구현

**파일 구조**:
```
lib/email/
├── ncp-email.ts                    # 기존 NCP 이메일 모듈
├── approval-email.ts                # 승인 이메일 (신규)
├── rejection-email.ts               # 거부 이메일 (신규)
└── templates/
    ├── approval-template.html       # HTML 템플릿 (선택)
    └── rejection-template.html      # HTML 템플릿 (선택)
```

**구현 예시** (`lib/email/approval-email.ts`):
```typescript
import { sendSimpleEmail } from './ncp-email';
import { user_role } from '@prisma/client';

const NCP_CONFIG = {
  accessKey: process.env.NCP_ACCESS_KEY!,
  accessSecret: process.env.NCP_ACCESS_SECRET!,
  senderAddress: process.env.NCP_SENDER_EMAIL!,
  senderName: 'AED관리시스템'
};

const ROLE_KOREAN: Record<user_role, string> = {
  'local_admin': '지역 관리자',
  'inspector': '점검원',
  'temporary_inspector': '임시 점검원',
  'field_admin': '현장 관리자',
  // ... 기타 역할
};

export async function sendApprovalEmail(
  userEmail: string,
  userName: string,
  role: user_role,
  organizationName: string,
  approvedAt: Date
) {
  const roleKorean = ROLE_KOREAN[role] || role;

  const htmlBody = `
    <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px;">
      <h2>계정이 승인되었습니다</h2>

      <p>안녕하세요 <strong>${userName}</strong>님,</p>

      <p>AED 관리 시스템 가입 신청이 승인되었습니다.</p>

      <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
        <h3>승인 정보</h3>
        <ul>
          <li>이메일: ${userEmail}</li>
          <li>역할: ${roleKorean}</li>
          <li>소속: ${organizationName}</li>
          <li>승인 일시: ${approvedAt.toLocaleString('ko-KR')}</li>
        </ul>
      </div>

      <p>이제 시스템에 로그인하여 서비스를 이용하실 수 있습니다.</p>

      <a href="https://aed.pics/auth/login"
         style="display: inline-block; background-color: #0070f3; color: white;
                padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
        로그인하기
      </a>

      <hr style="margin: 30px 0;">

      <p style="font-size: 14px; color: #666;">
        문의사항: admin@nmc.or.kr<br>
        기술지원: inhak@nmc.or.kr
      </p>
    </div>
  `;

  return sendSimpleEmail(
    NCP_CONFIG,
    userEmail,
    userName,
    '[AED관리시스템] 계정이 승인되었습니다',
    htmlBody
  );
}
```

#### 1.4. API 엔드포인트 수정

**approve/route.ts 수정**:
```typescript
// 기존 코드 (줄 123-124)
// 9. TODO: 승인 이메일 발송
// await sendApprovalEmail(updatedUser.email, role);

// 수정 후:
import { sendApprovalEmail } from '@/lib/email/approval-email';

// ... (기존 코드)

// 9. 승인 이메일 발송
try {
  await sendApprovalEmail(
    targetUser.email,
    targetUser.full_name || targetUser.email,
    role as user_role,
    updatedUser.organizations?.name || '소속 없음',
    new Date()
  );
  console.log(`[Approval Email] Sent to ${targetUser.email}`);
} catch (emailError) {
  console.error(`[Approval Email] Failed to send to ${targetUser.email}:`, emailError);
  // 이메일 실패해도 승인은 완료된 상태
}
```

**reject/route.ts 수정**:
```typescript
// 기존 코드 (줄 124-125)
// 9. TODO: 거부 이메일 발송
// await sendRejectionEmail(targetUser.email, reason);

// 수정 후:
import { sendRejectionEmail } from '@/lib/email/rejection-email';

// ... (사용자 삭제 전에 이메일 발송)

// 8. 거부 이메일 발송 (삭제 전)
try {
  await sendRejectionEmail(
    targetUser.email,
    targetUser.full_name || targetUser.email,
    reason
  );
  console.log(`[Rejection Email] Sent to ${targetUser.email}`);
} catch (emailError) {
  console.error(`[Rejection Email] Failed to send to ${targetUser.email}:`, emailError);
  // 이메일 실패해도 거부 처리는 진행
}

// 9. 사용자 삭제
await prisma.user_profiles.delete({
  where: { id }
});
```

### 2. 관리자 페이지 UI 구현

#### 2.1. 사용자 승인 대기 목록 페이지

**파일**: `app/admin/users/pending/page.tsx` (신규 생성 필요)

**요구사항**:
- pending_approval 상태 사용자 목록 표시
- 검색 기능 (이름, 이메일)
- 페이지네이션
- 승인/거부 버튼
- 사용자 상세 정보 모달

**UI 구성**:
```
┌──────────────────────────────────────────────────────────────┐
│  승인 대기 중인 사용자 (12명)                                 │
│                                                                │
│  [검색: ________]  [새로고침]                                  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 이름       이메일              소속              신청일  │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ 홍길동     hong@korea.kr      서울 강서구 보건소  10/25 │  │
│  │                                     [승인] [거부] [상세] │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ 김철수     kim@korea.kr       부산 해운대구 ...  10/24  │  │
│  │                                     [승인] [거부] [상세] │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  << 1 2 3 4 5 >>                                              │
└──────────────────────────────────────────────────────────────┘
```

**기능 상세**:
- **승인 버튼**: 역할 선택 모달 → API 호출 → 성공 메시지 → 목록 새로고침
- **거부 버튼**: 거부 사유 입력 모달 → API 호출 → 성공 메시지 → 목록 새로고침
- **상세 버튼**: 사용자 정보 상세 보기 모달

#### 2.2. 승인 모달

**요구사항**:
- 역할(role) 선택 드롭다운
- 승인 사유 입력 (선택)
- 확인/취소 버튼

**모달 구성**:
```
┌──────────────────────────────────────────┐
│  사용자 승인                              │
│                                           │
│  사용자: 홍길동 (hong@korea.kr)           │
│  소속: 서울특별시 강서구 보건소            │
│                                           │
│  역할 선택: [▼ inspector        ]         │
│             - local_admin                 │
│             - inspector                   │
│             - temporary_inspector         │
│             - field_admin                 │
│                                           │
│  승인 사유 (선택):                        │
│  [_______________________________]        │
│                                           │
│                    [취소]  [승인 확인]     │
└──────────────────────────────────────────┘
```

#### 2.3. 거부 모달

**요구사항**:
- 거부 사유 입력 (필수)
- 확인/취소 버튼

**모달 구성**:
```
┌──────────────────────────────────────────┐
│  사용자 거부                              │
│                                           │
│  사용자: 홍길동 (hong@korea.kr)           │
│  소속: 서울특별시 강서구 보건소            │
│                                           │
│  거부 사유 (필수):                        │
│  [_______________________________]        │
│  [_______________________________]        │
│  [_______________________________]        │
│                                           │
│  주의: 거부 시 해당 사용자 데이터가        │
│        영구적으로 삭제됩니다.              │
│                                           │
│                    [취소]  [거부 확인]     │
└──────────────────────────────────────────┘
```

#### 2.4. 사용자 상세 정보 모달

**요구사항**:
- 모든 사용자 정보 표시
- 소속 조직 정보
- 신청 일시
- 승인/거부 버튼

**모달 구성**:
```
┌─────────────────────────────────────────────┐
│  사용자 상세 정보                            │
│                                              │
│  기본 정보                                   │
│  - 이름: 홍길동                              │
│  - 이메일: hong@korea.kr                     │
│  - 전화번호: 010-1234-5678                   │
│  - 부서: 의약과                              │
│                                              │
│  소속 정보                                   │
│  - 조직: 서울특별시 강서구 보건소             │
│  - 지역 코드: 11-110                         │
│  - 조직 유형: health_center                  │
│                                              │
│  신청 정보                                   │
│  - 신청일: 2025-10-25 14:30:22               │
│  - 상태: pending_approval                    │
│                                              │
│                        [승인]  [거부]  [닫기] │
└─────────────────────────────────────────────┘
```

#### 2.5. 라우팅 및 권한 보호

**Next.js 라우팅**:
```
app/admin/
├── layout.tsx                    # 관리자 레이아웃
├── page.tsx                      # 관리자 대시보드
└── users/
    ├── pending/page.tsx          # 승인 대기 목록
    ├── approved/page.tsx         # 승인된 사용자 목록
    └── components/
        ├── UserTable.tsx         # 사용자 테이블
        ├── ApprovalModal.tsx     # 승인 모달
        ├── RejectionModal.tsx    # 거부 모달
        └── UserDetailModal.tsx   # 상세 정보 모달
```

**권한 보호 미들웨어**:
```typescript
// app/admin/layout.tsx
export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/login');
  }

  const profile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id }
  });

  if (!checkPermission(profile.role, 'LIST_USERS')) {
    return (
      <div>
        <h1>권한 없음</h1>
        <p>관리자 페이지에 접근할 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
```

### 3. 테스트 계획

#### 3.1. 이메일 발송 테스트

1. **승인 이메일 테스트**:
   - pending_approval 사용자 생성
   - 관리자로 로그인
   - 사용자 승인
   - 이메일 수신 확인
   - 이메일 내용 검증 (역할, 소속, 로그인 링크)

2. **거부 이메일 테스트**:
   - pending_approval 사용자 생성
   - 관리자로 로그인
   - 사용자 거부 (사유 입력)
   - 이메일 수신 확인
   - 이메일 내용 검증 (거부 사유, 문의 연락처)

3. **이메일 실패 처리 테스트**:
   - NCP API 키 임시 무효화
   - 승인/거부 실행
   - 이메일 실패해도 승인/거부는 완료되는지 확인
   - 로그에 에러 기록 확인

#### 3.2. 관리자 페이지 UI 테스트

1. **페이지 접근 권한 테스트**:
   - 비로그인 사용자 → 로그인 페이지로 리다이렉트
   - 권한 없는 사용자 → 권한 없음 메시지
   - 관리자 사용자 → 정상 접근

2. **사용자 목록 표시 테스트**:
   - pending_approval 사용자 목록 확인
   - 검색 기능 확인
   - 페이지네이션 확인

3. **승인 플로우 테스트**:
   - 승인 버튼 클릭 → 모달 표시
   - 역할 선택 → 승인 확인
   - API 호출 성공 → 목록 새로고침
   - 사용자 상태 변경 확인

4. **거부 플로우 테스트**:
   - 거부 버튼 클릭 → 모달 표시
   - 거부 사유 입력 → 거부 확인
   - API 호출 성공 → 목록 새로고침
   - 사용자 삭제 확인

5. **에러 처리 테스트**:
   - 네트워크 에러 → 에러 메시지 표시
   - API 에러 → 적절한 에러 메시지
   - 타임아웃 → 재시도 안내

## 구현 우선순위

### Phase 1: 이메일 발송 기능 (즉시 구현 가능)
1. `lib/email/approval-email.ts` 작성
2. `lib/email/rejection-email.ts` 작성
3. approve/route.ts 수정 (TODO 제거)
4. reject/route.ts 수정 (TODO 제거)
5. 로컬에서 이메일 발송 테스트

**예상 소요 시간**: 2-3시간

### Phase 2: 관리자 페이지 UI (프론트엔드 개발 필요)
1. Admin Layout 구성
2. 사용자 목록 페이지 작성
3. 승인/거부 모달 컴포넌트 작성
4. API 연동
5. 테스트

**예상 소요 시간**: 1-2일

### Phase 3: 통합 테스트 및 배포
1. 로컬 환경 통합 테스트
2. 프로덕션 환경 배포
3. 실제 사용자로 E2E 테스트
4. 버그 수정 및 개선

**예상 소요 시간**: 0.5-1일

## 성공 기준

관리자 승인 기능이 완성되었다고 판단하는 기준:

- [ ] 관리자가 pending_approval 사용자 목록을 볼 수 있다
- [ ] 관리자가 사용자를 승인할 수 있다 (역할 선택)
- [ ] 관리자가 사용자를 거부할 수 있다 (사유 입력)
- [ ] 승인 시 사용자에게 이메일이 발송된다
- [ ] 거부 시 사용자에게 이메일이 발송된다
- [ ] 이메일에 올바른 정보가 포함되어 있다
- [ ] 승인/거부 후 사용자 상태가 올바르게 변경된다
- [ ] Audit Log가 정확히 기록된다
- [ ] 권한 없는 사용자는 접근할 수 없다
- [ ] 에러가 발생해도 시스템이 안정적으로 작동한다

## 관련 문서

- [이메일 인증 테스트 계획](../testing/EMAIL_AUTHENTICATION_TEST_PLAN.md)
- [NCP 마이그레이션 가이드](../migration/NCP_마이그레이션_완전가이드.md)
- [권한 체계 가이드](../reference/PERMISSION_SYSTEM.md)

## 담당자

- 백엔드 구현: Claude (AI Assistant)
- 프론트엔드 구현: 개발팀
- 테스트: QA 팀
- 프로젝트 매니저: woo@nmc.or.kr

---

**마지막 업데이트**: 2025-10-28
**문서 버전**: 1.0.0
