/**
 * PM2 Ecosystem Configuration
 * Naver Cloud Platform 배포용
 */

module.exports = {
  apps: [
    {
      name: 'aedpics',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2, // CPU 코어 수에 맞게 조정
      exec_mode: 'cluster',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // 로그 설정
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // 자동 재시작 설정
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,

      // 모니터링
      instance_var: 'INSTANCE_ID',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // 환경별 설정
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
    },
  ],

  deploy: {
    production: {
      user: 'ubuntu', // NCP 서버 사용자명
      host: ['your-ncp-server-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/AEDpics.git',
      path: '/home/ubuntu/aedpics',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
    },
  },
};
