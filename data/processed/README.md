# data/processed - 전처리된 데이터 파일

이 디렉토리는 전처리 스크립트가 생성한 CSV 파일을 저장하는 곳입니다.

## 파일 종류

### 1. target_list_2025_processed.csv
- 전처리 완료된 데이터
- PostgreSQL 업로드 준비 완료
- UTF-8 인코딩
- 시도명 표준화 완료

### 2. validation_report.txt
- 전처리 과정의 검증 결과
- 발견된 오류 및 경고
- 통계 정보

## 생성 방법

```bash
cd scripts/data-import
python preprocess_target_list.py ../../data/source/원본파일.xlsx
```

## 검증 항목

- target_key 중복 체크
- 시도명 표준화 (17개 시도 표준명)
- 필수 필드 NULL 체크
- 문자열 공백 제거
- 특수문자 정리

## 주의사항

- 이 디렉토리의 파일은 Git에 커밋되지 않습니다
- 전처리된 파일은 검증 후 업로드하세요
- 문제 발견 시 원본 파일을 수정하고 재실행하세요

## 다음 단계

전처리 완료 후:
1. `validation_report.txt` 확인
2. 문제가 없으면 `python upload_target_list.py` 실행
