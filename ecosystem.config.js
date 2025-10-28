module.exports = {
  apps: [{
    name: 'aedpics',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/aedpics',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,

      // Database - 환경변수로 참조
      DATABASE_URL: process.env.DATABASE_URL,

      // NextAuth - 환경변수로 참조
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://aed.pics',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      JWT_SECRET: process.env.JWT_SECRET,

      // Master Account - 환경변수로 참조
      MASTER_EMAIL: process.env.MASTER_EMAIL,

      // Kakao Maps - 환경변수로 참조
      NEXT_PUBLIC_KAKAO_MAP_APP_KEY: process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY,

      // NCP Email (Cloud Outbound Mailer) - 환경변수로 참조
      NCP_ACCESS_KEY: process.env.NCP_ACCESS_KEY,
      NCP_ACCESS_SECRET: process.env.NCP_ACCESS_SECRET,
      NCP_SENDER_EMAIL: process.env.NCP_SENDER_EMAIL,

      // NCP Object Storage - 환경변수로 참조
      NCP_OBJECT_STORAGE_REGION: process.env.NCP_OBJECT_STORAGE_REGION || 'kr-standard',
      NCP_OBJECT_STORAGE_ENDPOINT: process.env.NCP_OBJECT_STORAGE_ENDPOINT || 'https://kr.object.ncloudstorage.com',
      NCP_OBJECT_STORAGE_ACCESS_KEY: process.env.NCP_OBJECT_STORAGE_ACCESS_KEY,
      NCP_OBJECT_STORAGE_SECRET_KEY: process.env.NCP_OBJECT_STORAGE_SECRET_KEY,
      NCP_OBJECT_STORAGE_BUCKET: process.env.NCP_OBJECT_STORAGE_BUCKET || 'aedpics-inspections',

      // Application URL - 환경변수로 참조
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://aed.pics',

      // Security - 환경변수로 참조
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

      // Cron Jobs - 환경변수로 참조
      CRON_SECRET: process.env.CRON_SECRET,
    },
    error_file: '/var/www/aedpics/logs/pm2-error.log',
    out_file: '/var/www/aedpics/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
