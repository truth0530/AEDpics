# e-gen CSV 파일 구조 분석

**분석 일자**: 2025-10-25
**최종 업데이트**: 2025-10-26
**출처**: `scripts/upload_to_ncp.py` (NCP PostgreSQL 버전)
**데이터 소스**: e-gen 포털 (https://portal.nemc.or.kr:444)

## CSV 파일 개요

### 파일명 패턴
```
AED등록현황*.xls
```
- 실제로는 HTML 형식의 테이블 데이터 (`.xls` 확장자이지만 HTML)
- BeautifulSoup로 파싱하여 pandas DataFrame으로 변환
- 각 시도별로 별도 파일 다운로드 (17개 파일)

### 파일 우선순위
스크립트는 다음 기준으로 파일 우선순위를 계산합니다:
1. **파일 크기** (40% 가중치): 큰 파일이 우선순위 높음
2. **최신성** (60% 가중치): 최근 다운로드된 파일이 우선순위 높음

## CSV 컬럼 목록 (50개)

### 1. 핵심 식별 정보
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 장비연번 | equipment_serial | 필수 | 고유 식별자 (Primary Key) |
| 관리번호 | management_number | 선택 | 기관별 관리 번호 |

### 2. 행정구역 정보
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 시_도 | sido | 필수 | 시도 코드/이름 (17개) |
| 구_군 | gugun | 필수 | 시군구 |
| 관할보건소 | jurisdiction_health_center | 선택 | 관리 보건소 |

### 3. 장비 상세 정보
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 모델명 | model_name | 선택 | AED 모델명 |
| 제조사 | manufacturer | 선택 | 제조사명 |
| 제조국 | manufacturing_country | 선택 | 제조 국가 |
| 제조일자 (또는 제조일) | manufacturing_date | 선택 | YYYY-MM-DD 형식 |
| 제조번호 | serial_number | 선택 | 제조사 일련번호 |

### 4. 설치 기관 정보
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 설치기관명 | installation_institution | 필수 | 설치 기관 이름 |
| 설치기관_주소 | installation_address | 선택 | 기관 주소 |
| 기관_연락처 | institution_contact | 선택 | 연락처 |
| 설립자 (또는 개설자) | establisher | 선택 | 기관 설립자 |
| 관리책임자 | manager | 선택 | 관리 담당자 |

### 5. 설치 위치 정보
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 설치장소_주소 | installation_location_address | 선택 | 설치 장소 주소 |
| 설치위치 | installation_position | 필수 | 상세 설치 위치 |
| 설치방법 | installation_method | 선택 | 설치 방법 |
| 분류1 | category_1 | 선택 | 장소 분류 1단계 |
| 분류2 | category_2 | 선택 | 장소 분류 2단계 |
| 분류3 | category_3 | 선택 | 장소 분류 3단계 |

### 6. GPS 좌표
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 경도 | longitude | 선택 | Float (11, 8) |
| 위도 | latitude | 선택 | Float (10, 8) |

### 7. 운영 상태
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 운영현황 (또는 운영상태) | operation_status | 선택 | 운영/폐기 상태 |
| 표출허용여부 | display_allowed | 선택 | 공개 여부 |
| 외부표출여부 | external_display | 선택 | 외부 공개 여부 |
| 외부미표출사유 | external_non_display_reason | 선택 | 비공개 사유 |

### 8. 지원 정보
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 정부지원여부 (또는 국고지원여부) | government_support | 선택 | 국비 지원 여부 |
| 구입기관 (또는 구매기관) | purchase_institution | 선택 | 구입 기관명 |

### 9. 날짜 정보
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 신고일자 | report_date | 선택 | 최초 등록일 |
| 최초설치일 (또는 설치일자) | first_installation_date | 필수 | 최초 설치일 (기본값: 2023-01-01) |
| 설치일자 (또는 최초설치일) | installation_date | 필수 | 설치일 (기본값: 2023-01-01) |
| 등록일자 | registration_date | 선택 | e-gen 등록일 |

### 10. 점검 관련
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 최근점검일 | last_inspection_date | 선택 | 마지막 점검 날짜 |
| 최근사용일 | last_use_date | 선택 | 실제 사용 날짜 |

### 11. 소모품 관리
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 배터리_유효기간 | battery_expiry_date | 선택 | 배터리 만료일 |
| 패치_유_무 | patch_available | 선택 | 패치 보유 여부 |
| 패치_유효기간 | patch_expiry_date | 선택 | 패치 만료일 |

### 12. 기타
| 컬럼명 | Python 코드 필드명 | 필수 여부 | 설명 |
|--------|-------------------|----------|------|
| 교체_폐기일자 (또는 교체_예정일) | replacement_date | 선택 | 교체 예정일 |
| 사음_삭제여부 (또는 새올_삭제여부) | saeum_deletion_status | 선택 | 시스템 삭제 여부 |
| 비고 | remarks | 선택 | 기타 메모 |

### 13. 추적 시스템 필드 (Python 스크립트에서 자동 생성)
이 필드들은 CSV에 없고 스크립트가 자동으로 추가합니다:

| 필드명 | 설명 |
|--------|------|
| data_status | 'active', 'missing', 'deletion_suspected' |
| consecutive_missing_days | 연속 누락 일수 |
| first_seen_date | 최초 발견일 |
| last_seen_date | 마지막 확인일 |
| deletion_suspected_date | 삭제 의심 시작일 |
| sync_batch_id | 동기화 배치 ID |
| created_at | 생성 시각 (UTC) |
| updated_at | 수정 시각 (UTC) |

## 데이터 변환 규칙

### 1. 날짜 변환
```python
# 지원 형식:
- YYYY-MM-DD
- YYYY/MM/DD
- YYYY.MM.DD
- YYYYMMDD
- DD-MM-YYYY

# 특수 텍스트 처리:
"필요", "신규", "미정", "없음" → NULL
```

### 2. NULL 값 처리
```python
# NULL로 처리되는 값들:
- NaN
- 'nan'
- 'None'
- 'null'
- 빈 문자열 ''
```

### 3. Float 변환
```python
# 경도/위도 변환:
try:
    float(value)
except:
    None
```

## CSV 파일 예시

```csv
장비연번,시_도,구_군,관리번호,모델명,제조사,설치기관명,설치위치,경도,위도,...
20230001,서울특별시,강남구,GN-2023-001,AED Plus,ZOLL,강남구청,1층 로비,127.0495556,37.5172363,...
20230002,서울특별시,서초구,SC-2023-001,CR2,Philips,서초구청,정문 입구,127.0276368,37.4836977,...
```

## 마이그레이션 매핑

### Supabase → NCP PostgreSQL

**변경된 주요 사항**:
1. 테이블명: `aed_data` (동일)
2. Primary Key: `equipment_serial` (장비연번)
3. 필수 필드:
   - `equipment_serial`: 장비연번
   - `installation_institution`: 설치기관명
   - `installation_position`: 설치위치
   - `sido`: 시_도
   - `gugun`: 구_군
   - `first_installation_date`: 최초설치일 (기본값: '2023-01-01')
   - `installation_date`: 설치일자 (기본값: '2023-01-01')

4. 날짜 필드는 모두 `DATE` 타입
5. GPS 좌표는 `DECIMAL(11,8)` (경도), `DECIMAL(10,8)` (위도)

## 데이터 품질 이슈

### Python 스크립트에서 처리하는 문제들:

1. **중복 제거**:
   - 같은 `equipment_serial`이 여러 파일에 있을 수 있음
   - 우선순위: 파일 크기 (40%) + 최신성 (60%)

2. **누락 추적**:
   - 이전 배치에는 있었지만 현재 배치에 없는 데이터 → `missing`
   - 7일 이상 누락 → `deletion_suspected`

3. **복구 감지**:
   - 이전에 `missing`이었다가 다시 나타난 데이터 → `restored`

4. **배치 처리**:
   - 한 번에 500개씩 UPSERT
   - 트랜잭션 안전성 확보
   - 실패 시 3회 재시도

## 총 레코드 수

**공식 통계**: 81,331개 (2025년 9월 인트라넷 집계)

## 다음 단계

1. e-gen 포털에서 CSV 파일 다운로드 (17개 시도별)
2. Python 스크립트 수정: Supabase → NCP PostgreSQL
3. 81,331개 AED 데이터 import
4. 데이터 검증 및 무결성 확인
