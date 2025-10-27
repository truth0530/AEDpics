# Slack Webhook 설정 가이드

## 문서 정보
- 작성일: 2025-10-27
- 목적: GitHub Actions와 Slack 연동하여 배포 알림 받기
- 대상: 시스템 관리자, 개발팀

## Slack Webhook이란?

Slack Incoming Webhook은 외부 애플리케이션에서 Slack 채널로 메시지를 보낼 수 있게 하는 기능입니다.

### 사용 목적
- GitHub Actions 빌드 성공/실패 알림
- 프로덕션 배포 상태 모니터링
- 데이터베이스 백업 완료 알림
- 실시간 CI/CD 파이프라인 모니터링

## Slack Workspace 요구사항

### 필요한 권한
- Slack Workspace 관리자 권한 또는
- App 설치 권한이 있는 계정

### 권장 Workspace 구조
```
AEDpics Workspace
├── #general (일반 채널)
├── #dev-alerts (개발 알림)
├── #deploy-notifications (배포 알림) - 권장
└── #database-backups (백업 알림)
```

## Slack Webhook 생성 방법

### 1단계: Slack App 생성

1. https://api.slack.com/apps 접속
2. "Create New App" 클릭
3. "From scratch" 선택
4. App 정보 입력:
   - App Name: `AEDpics CI/CD Bot`
   - Workspace: 해당 Workspace 선택
5. "Create App" 클릭

### 2단계: Incoming Webhook 활성화

1. 생성된 App 설정 페이지에서 왼쪽 메뉴의 "Incoming Webhooks" 클릭
2. "Activate Incoming Webhooks" 토글을 ON으로 변경
3. 페이지 하단의 "Add New Webhook to Workspace" 클릭
4. 메시지를 받을 채널 선택 (예: #deploy-notifications)
5. "Allow" 클릭

### 3단계: Webhook URL 복사

생성된 Webhook URL 예시:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

이 URL을 안전하게 보관하세요. 이 URL을 통해 Slack 채널로 메시지를 보낼 수 있습니다.

## GitHub Secrets 등록

### 1. GitHub Repository 설정 이동
```
https://github.com/[organization]/AEDpics/settings/secrets/actions
```

### 2. New repository secret 클릭

### 3. Secret 정보 입력
- Name: `SLACK_WEBHOOK_URL`
- Value: 위에서 복사한 Webhook URL 전체
- "Add secret" 클릭

## 현재 워크플로우에서 Slack 알림 사용 현황

### deploy-production.yml
이미 Slack 알림이 구현되어 있습니다:

1. 배포 성공 알림 (라인 71-85)
2. 배포 실패 알림 (라인 87-101)

### database-backup.yml
데이터베이스 백업 알림이 구현되어 있습니다:

1. 백업 성공 알림 (라인 41-55)
2. 백업 실패 알림 (라인 57-71)

### build-check.yml
현재 Slack 알림 미구현 (선택사항)

## Slack 알림 테스트

### 방법 1: 수동 워크플로우 실행

deploy-production.yml은 workflow_dispatch를 지원합니다:

1. GitHub Repository > Actions 탭
2. "Deploy to NCP Production" 워크플로우 선택
3. "Run workflow" 클릭
4. main 브랜치 선택
5. "Run workflow" 실행

### 방법 2: curl 명령어로 직접 테스트

```bash
curl -X POST \
  -H 'Content-type: application/json' \
  --data '{
    "text": "Test message from AEDpics CI/CD Bot",
    "attachments": [{
      "color": "good",
      "text": "Slack webhook is working correctly!"
    }]
  }' \
  YOUR_WEBHOOK_URL
```

### 방법 3: 테스트 브랜치로 배포

```bash
git checkout -b test/slack-notification
git commit --allow-empty -m "test: Slack notification test"
git push origin test/slack-notification
```

## Slack 메시지 커스터마이징

### 현재 메시지 포맷

**배포 성공**:
```json
{
  "text": "Production deployment successful",
  "attachments": [{
    "color": "good",
    "text": "Deployed to NCP Production\nCommit: abc1234\nAuthor: username"
  }]
}
```

**배포 실패**:
```json
{
  "text": "Production deployment failed",
  "attachments": [{
    "color": "danger",
    "text": "Failed to deploy to NCP Production\nCommit: abc1234\nAuthor: username"
  }]
}
```

### 메시지 개선 아이디어

더 많은 정보를 포함하려면:

```yaml
custom_payload: |
  {
    "text": "Production deployment successful",
    "attachments": [{
      "color": "good",
      "fields": [
        {"title": "Environment", "value": "NCP Production", "short": true},
        {"title": "Branch", "value": "${{ github.ref_name }}", "short": true},
        {"title": "Commit", "value": "${{ github.sha }}", "short": true},
        {"title": "Author", "value": "${{ github.actor }}", "short": true},
        {"title": "Workflow", "value": "${{ github.workflow }}", "short": true},
        {"title": "Time", "value": "$(date)", "short": true}
      ],
      "footer": "AEDpics CI/CD",
      "footer_icon": "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
    }]
  }
```

## 멘션 추가

특정 사용자나 그룹에게 알림을 보내려면:

```yaml
custom_payload: |
  {
    "text": "<!channel> Production deployment failed!",
    "attachments": [...]
  }
```

멘션 종류:
- `<!channel>`: 채널의 모든 활성 사용자
- `<!here>`: 현재 온라인인 사용자
- `<@USER_ID>`: 특정 사용자 (User ID는 Slack에서 확인)
- `<!subteam^ID>`: 특정 그룹

## 보안 주의사항

### Webhook URL 보호
- Webhook URL은 절대 코드에 하드코딩하지 마세요
- 반드시 GitHub Secrets에 저장
- Public repository의 경우 특히 주의

### 민감 정보 노출 방지
- 배포 메시지에 환경변수나 비밀 정보 포함 금지
- 데이터베이스 연결 정보 노출 금지
- API 키나 토큰 정보 노출 금지

### URL 회전 (Rotation)
Webhook URL이 노출된 것으로 의심되면:
1. Slack App 설정에서 기존 Webhook 삭제
2. 새로운 Webhook 생성
3. GitHub Secrets 업데이트

## 트러블슈팅

### 메시지가 전송되지 않는 경우

1. **Webhook URL 확인**
   ```bash
   # URL 형식이 올바른지 확인
   echo $SLACK_WEBHOOK_URL
   ```

2. **GitHub Secret 확인**
   - Repository Settings > Secrets에서 SLACK_WEBHOOK_URL 존재 확인
   - Secret 이름 대소문자 정확히 일치

3. **워크플로우 로그 확인**
   - Actions 탭에서 실행 로그 확인
   - Slack 단계에서 에러 메시지 확인

4. **Slack App 상태 확인**
   - App이 Workspace에 설치되어 있는지 확인
   - Incoming Webhook이 활성화되어 있는지 확인

### 메시지가 잘못된 채널로 가는 경우

- Webhook URL을 재생성하고 올바른 채널 선택
- 각 알림 유형별로 별도의 Webhook URL 생성 고려

### Rate Limiting

Slack은 초당 1개의 메시지로 제한됩니다.
- 짧은 시간에 많은 알림 발생 시 제한될 수 있음
- 필요한 경우에만 알림 전송

## 알림 채널 전략

### 권장 채널 구조

1. **#deploy-notifications**
   - 프로덕션 배포 성공/실패
   - 스테이징 배포 알림

2. **#database-ops**
   - 데이터베이스 백업 완료
   - 마이그레이션 실행 알림

3. **#build-status** (선택)
   - 빌드 실패 알림만 (성공은 제외)
   - Pull Request 빌드 상태

4. **#critical-alerts**
   - Health check 실패
   - 서비스 다운타임
   - 보안 관련 알림

## 추가 개선 아이디어

### 1. 빌드 시간 추적
```yaml
- name: Record build time
  run: echo "BUILD_TIME=$(date -u +%s)" >> $GITHUB_ENV

- name: Calculate duration
  run: echo "DURATION=$(($(date -u +%s) - $BUILD_TIME))s" >> $GITHUB_ENV
```

### 2. 배포 롤백 알림
배포 실패 시 자동 롤백되면 알림 전송

### 3. 승인 요청 알림
중요한 배포는 Slack에서 승인 후 진행

### 4. 메트릭 대시보드 연동
배포 성공률, 평균 빌드 시간 등 통계 정보 포함

## 다음 단계

1. Slack Workspace 생성 또는 기존 Workspace 확인
2. Incoming Webhook 생성 및 채널 설정
3. GitHub Secrets에 SLACK_WEBHOOK_URL 등록
4. 테스트 배포로 알림 확인
5. 필요시 메시지 포맷 커스터마이징

## 참고 자료

- Slack API 문서: https://api.slack.com/messaging/webhooks
- Slack 메시지 포맷: https://api.slack.com/reference/surfaces/formatting
- GitHub Actions 문서: https://docs.github.com/en/actions
- 8398a7/action-slack: https://github.com/8398a7/action-slack

---

**마지막 업데이트**: 2025-10-27
**담당자**: 시스템 관리자 (truth0530@nmc.or.kr)
