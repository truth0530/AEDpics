/**
 * PM2 Ecosystem Configuration
 * Naver Cloud Platform 배포용
 *
 * Phase 7: Production Deployment
 */

module.exports = {
  apps: [
    {
      name: 'aedpics',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 4, // 4 vCPU에 맞춰 4개 인스턴스
      exec_mode: 'cluster',
      cwd: '/home/aedpics/apps/AEDpics',

      // 환경 변수 파일
      env_file: '.env.production',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // 로그 설정
      error_file: '/home/aedpics/logs/pm2-error.log',
      out_file: '/home/aedpics/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json', // JSON 형식으로 로그 저장 (ELK Stack 연동 용이)

      // 자동 재시작 설정
      max_memory_restart: '1G', // 16GB RAM 기준 1GB per instance
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      exp_backoff_restart_delay: 100, // 재시작 백오프

      // 모니터링
      instance_var: 'INSTANCE_ID',
      pmx: true, // PM2 Plus monitoring

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      wait_ready: true,

      // 환경별 설정
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // Watch (개발 환경에서만 사용)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.next'],

      // Source maps (디버깅용)
      source_map_support: true,

      // Time zone
      time: true,
    },
  ],

  deploy: {
    production: {
      user: 'aedpics', // NCP 서버 사용자명
      host: ['aedpics-server.ncloud.com'], // NCP 서버 호스트
      ref: 'origin/main',
      repo: 'git@github.com:truth0530/AEDpics.git',
      path: '/home/aedpics/apps/AEDpics',
      ssh_options: 'StrictHostKeyChecking=no',

      // 배포 전 실행
      'pre-deploy-local': 'echo "Deploying to production..."',

      // 배포 후 실행
      'post-deploy': [
        'npm install',
        'npx prisma generate',
        'npm run build',
        'pm2 reload ecosystem.config.js --env production --update-env',
        'pm2 save',
      ].join(' && '),

      // 배포 후 스크립트
      'post-setup': [
        'npm install',
        'npx prisma migrate deploy',
        'npx prisma generate',
        'npm run build',
      ].join(' && '),
    },
  },
};
