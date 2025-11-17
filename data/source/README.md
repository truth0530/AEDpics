# data/source - 원본 데이터 파일

이 디렉토리는 target_list_2025 데이터의 원본 파일을 저장하는 곳입니다.

## 사용 방법

1. **원본 엑셀 파일을 이곳에 저장하세요**
   - 파일명 예시: `target_list_2025_원본_20251117.xlsx`
   - 명확한 날짜 표기 권장

2. **파일 형식**
   - Excel (.xlsx) 권장
   - CSV (.csv) 가능
   - 인코딩: UTF-8 필수

3. **필수 칼럼 확인**
   - target_key (필수)
   - sido (필수)
   - gugun (선택)
   - institution_name (필수)
   - 기타 칼럼은 [docs/reference/target_list_2025_schema.json](../../docs/reference/target_list_2025_schema.json) 참조

## 주의사항

- 이 디렉토리의 파일은 Git에 커밋되지 않습니다 (.gitignore 설정됨)
- 원본 파일은 반드시 백업을 별도로 보관하세요
- 전처리 전 원본 파일을 절대 수정하지 마세요

## 다음 단계

원본 파일을 저장한 후:
1. `scripts/data-import/preprocess_target_list.py` 실행
2. 전처리된 파일은 `data/processed/` 에 생성됩니다
