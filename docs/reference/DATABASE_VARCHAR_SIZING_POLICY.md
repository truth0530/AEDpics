# Database VarChar Sizing Policy

## 개요

PostgreSQL 데이터베이스에서 String 타입 필드에 대한 VarChar 크기 정책을 정의합니다.
일관된 크기 정책을 통해 스토리지 효율성과 데이터 무결성을 보장합니다.

**작성일**: 2025-11-05
**대상 데이터베이스**: PostgreSQL 14.18 (NCP)
**스키마**: aedpics

---

## 현황 분석 (2025-11-05)

### String 타입 필드 분류

| 분류 | 개수 | 설명 | 조치 필요 |
|------|------|------|-----------|
| UUID Fields (@db.Uuid) | 78 | 이미 UUID로 정의됨 | 불필요 |
| VarChar with Size | 42 | 이미 크기 정의됨 | 불필요 |
| VarChar without Size | 26 | 크기 정의 필요 | **필요** |
| String without annotation | 57 | VarChar/TEXT 추가 필요 | **필요** |
| String Arrays | 3 | 배열 타입 | 불필요 |
| TEXT Fields | 0 | TEXT로 정의됨 | 불필요 |

**총 변경 필요 필드**: 83개
- VarChar 크기 추가: 26개
- VarChar/TEXT 추가: 57개

### 기존 VarChar 크기 분포

| 크기 | 개수 | 용도 |
|------|------|------|
| VarChar(255) | 19 | 일반 텍스트, 이름, 주소 |
| VarChar(100) | 6 | 중간 길이 텍스트 |
| VarChar(50) | 5 | 코드, 타입, 상태 |
| VarChar(20) | 6 | 짧은 코드 |
| VarChar(500) | 2 | 긴 텍스트 |
| VarChar(200) | 2 | 중간 길이 텍스트 |
| VarChar(5) | 2 | 매우 짧은 코드 |

---

## VarChar 크기 정책

### 1. 원칙

1. **일관성**: 동일한 용도의 필드는 동일한 크기 사용
2. **여유**: 실제 데이터보다 20-30% 여유 크기 확보
3. **표준화**: 아래 정의된 표준 크기만 사용
4. **성능**: 불필요하게 큰 크기는 인덱스 성능 저하

### 2. 표준 크기 정의

| 크기 | 용도 | 예시 |
|------|------|------|
| **VarChar(20)** | 짧은 코드, 상태값 | status, type, code |
| **VarChar(50)** | 중간 코드, 카테고리 | priority, role, category |
| **VarChar(100)** | 짧은 이름, 부서명 | position, division, department |
| **VarChar(255)** | 표준 텍스트, 이름, 제목 | name, title, email, serial_number |
| **VarChar(500)** | 긴 텍스트, 주소, UserAgent | address, location, user_agent, token (짧은 것) |
| **TEXT** | 설명, 메시지, 노트, 긴 토큰 | description, message, notes, access_token, id_token |

### 3. 특수 케이스

| 필드 타입 | 크기 | 이유 |
|-----------|------|------|
| IP 주소 | VarChar(45) | IPv6 최대 길이 (39자) + 여유 |
| 이메일 | VarChar(255) | RFC 5321 표준 (64@255) |
| 전화번호 | VarChar(50) | 국제번호 + 구분자 고려 |
| OAuth 토큰 | TEXT | JWT는 1KB 이상 가능 |
| 세션 토큰 | VarChar(500) | 일반적으로 256자 이하 |
| 시리얼 번호 | VarChar(255) | AED 시리얼은 50자 이하지만 여유 확보 |

---

## 필드별 크기 권장사항

### accounts 테이블 (NextAuth)

| 필드 | 현재 타입 | 권장 타입 | 이유 |
|------|-----------|-----------|------|
| type | String | VarChar(50) | oauth, email 등 |
| provider | String | VarChar(50) | google, kakao 등 |
| provider_account_id | String | VarChar(500) | 프로바이더별 ID |
| refresh_token | String? | TEXT | OAuth refresh token은 길 수 있음 |
| access_token | String? | TEXT | JWT는 1KB 이상 가능 |
| token_type | String? | VarChar(50) | Bearer, Basic 등 |
| scope | String? | VarChar(255) | OAuth scope 목록 |
| id_token | String? | TEXT | OIDC ID token은 길 수 있음 |
| session_state | String? | VarChar(255) | 세션 상태값 |

### aed_data 테이블 (VarChar 크기 없음)

| 필드 | 현재 타입 | 권장 타입 | 이유 |
|------|-----------|-----------|------|
| management_number | String? @db.VarChar | VarChar(255) | 관리번호는 보통 50자 이하 |
| model_name | String? @db.VarChar | VarChar(255) | 모델명 |
| manufacturer | String? @db.VarChar | VarChar(255) | 제조사명 |
| serial_number | String? @db.VarChar | VarChar(255) | 시리얼 번호 |
| installation_address | String? @db.VarChar | VarChar(500) | 주소는 길 수 있음 |
| operation_status | String? @db.VarChar | VarChar(50) | 상태값 |
| data_status | String? | VarChar(50) | 상태값 |
| remarks | String? @db.VarChar | TEXT | 비고는 제한 없음 |

### audit_logs 테이블

| 필드 | 현재 타입 | 권장 타입 | 이유 |
|------|-----------|-----------|------|
| action | String | VarChar(100) | create, update, delete 등 |
| entity_type | String? | VarChar(100) | 테이블명 또는 엔티티 타입 |
| resource_type | String? | VarChar(100) | 리소스 타입 |
| ip_address | String? | VarChar(45) | IPv6 최대 길이 |
| user_agent | String? | VarChar(500) | UserAgent 문자열 |

### inspection 관련 테이블

| 필드 | 현재 타입 | 권장 타입 | 이유 |
|------|-----------|-----------|------|
| inspection_type | String? | VarChar(50) | regular, emergency 등 |
| visual_status | String? | VarChar(50) | good, damaged 등 |
| battery_status | String? | VarChar(50) | normal, expired 등 |
| operation_status | String? | VarChar(50) | working, broken 등 |
| assignment_type | String? | VarChar(50) | scheduled, urgent 등 |
| notes | String? | TEXT | 점검 노트는 길 수 있음 |

### organizations 테이블

| 필드 | 현재 타입 | 권장 타입 | 이유 |
|------|-----------|-----------|------|
| name | String | VarChar(255) | 조직명 |
| region_code | String? | VarChar(50) | 지역 코드 (SEO, BUS 등) |
| city_code | String? | VarChar(50) | 시군구 코드 |
| address | String? | VarChar(500) | 주소 |
| contact | String? | VarChar(255) | 연락처 |

### user_profiles 테이블

| 필드 | 현재 타입 | 권장 타입 | 이유 |
|------|-----------|-----------|------|
| email | String | VarChar(255) | RFC 5321 표준 |
| full_name | String | VarChar(255) | 사용자 이름 |
| phone | String? | VarChar(50) | 전화번호 |
| region | String? | VarChar(255) | 지역명 (한글) |
| district | String? | VarChar(255) | 시군구명 (한글) |
| employee_id | String? | VarChar(100) | 직원 ID |
| lock_reason | String? | TEXT | 계정 잠금 사유 |

---

## 마이그레이션 우선순위

### Priority 1: Critical (즉시 적용 권장)

1. **accounts 테이블**: NextAuth 인증 관련, 토큰 길이 제한 필수
2. **user_profiles 테이블**: 사용자 데이터 무결성
3. **aed_data.data_status**: 쿼리 성능 영향

### Priority 2: High (단기 적용)

1. **audit_logs**: 로그 데이터 표준화
2. **inspection 관련 테이블**: 점검 데이터 일관성
3. **organizations**: 조직 데이터 표준화

### Priority 3: Medium (중기 적용)

1. **aed_data VarChar 크기 없는 필드**: 데이터 이미 존재, 신중히 진행
2. **notification 관련 테이블**: 알림 시스템

### Priority 4: Low (장기 또는 선택)

1. **legacy 데이터 테이블**: 사용 빈도 낮음
2. **임시 테이블**: 마이그레이션 완료 후 제거 예정

---

## 마이그레이션 주의사항

### 1. 데이터 검증

변경 전 반드시 현재 데이터의 최대 길이 확인:

```sql
-- 예시: access_token 최대 길이 확인
SELECT MAX(LENGTH(access_token)) as max_length
FROM aedpics.accounts
WHERE access_token IS NOT NULL;
```

### 2. 단계적 적용

- 한 번에 모든 필드 변경 금지
- 테이블별로 순차 진행
- 각 변경 후 프로덕션 모니터링

### 3. 백업

- 변경 전 전체 데이터베이스 백업
- 롤백 계획 수립

### 4. 애플리케이션 영향

- Prisma 스키마와 데이터베이스 동기화
- TypeScript 타입 재생성
- 빌드 및 테스트 필수

---

## 정책 예외 처리

### 기존 데이터와 충돌 시

1. 현재 데이터 최대 길이 측정
2. 최대 길이 + 30% 여유로 크기 결정
3. 정책 문서에 예외사항 기록

### 특수 요구사항

- 법적 요구사항 (개인정보보호법 등) 우선
- 외부 API 스펙에 따른 제약
- 레거시 시스템 호환성

---

## 참조

- PostgreSQL 공식 문서: https://www.postgresql.org/docs/14/datatype-character.html
- Prisma String 타입: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#string
- RFC 5321 (이메일 표준): https://tools.ietf.org/html/rfc5321

---

**다음 단계**: 이 정책을 바탕으로 마이그레이션 SQL 작성 및 순차 적용
