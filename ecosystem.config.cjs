// Load environment variables from .env.production
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.production' });

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
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Explicitly load key environment variables from .env.production
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://aed.pics',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://aed.pics',
      DATABASE_URL: process.env.DATABASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      JWT_SECRET: process.env.JWT_SECRET,
      NEXT_PUBLIC_KAKAO_MAP_APP_KEY: process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY,
      NCP_ACCESS_KEY: process.env.NCP_ACCESS_KEY,
      NCP_ACCESS_SECRET: process.env.NCP_ACCESS_SECRET,
      NCP_SENDER_EMAIL: process.env.NCP_SENDER_EMAIL,
      MASTER_EMAIL: process.env.MASTER_EMAIL,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY
    },
    error_file: '/home/aedpics/logs/pm2-error.log',
    out_file: '/home/aedpics/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
