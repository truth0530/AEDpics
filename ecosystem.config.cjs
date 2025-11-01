module.exports = {
  apps: [{
    name: 'aedpics',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    instances: 2, // 2개 프로세스로 클러스터 실행
    exec_mode: 'cluster', // 클러스터 모드 (Zero-Downtime 핵심)
    wait_ready: true, // ready 이벤트 대기
    listen_timeout: 10000, // 10초 내 ready 신호 없으면 실패
    kill_timeout: 5000, // 프로세스 종료 시 5초 대기
    max_memory_restart: '1G', // 메모리 1GB 초과 시 자동 재시작
    autorestart: true, // 크래시 시 자동 재시작
    watch: false, // 파일 변경 감지 비활성화 (프로덕션)
    max_restarts: 10, // 최대 재시작 횟수
    min_uptime: '10s', // 최소 가동 시간 (10초 미만이면 불안정으로 판단)
    env_file: '.env.production', // 환경변수 파일 로드
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/aedpics/logs/pm2-error.log',
    out_file: '/home/aedpics/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Next.js의 ready 신호를 기다리도록 설정
    wait_ready: true,
    listen_timeout: 10000
  }]
};
