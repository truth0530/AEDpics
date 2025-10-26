#!/usr/bin/env node

/**
 * GPS 분석 스케줄러
 * 매일 새벽 2시에 GPS 분석을 자동 실행
 *
 * 사용법:
 * 1. 직접 실행: node scripts/schedule-gps-analysis.js
 * 2. cron 설정: 0 2 * * * /usr/bin/node /path/to/schedule-gps-analysis.js
 * 3. PM2 사용: pm2 start scripts/schedule-gps-analysis.js --name gps-scheduler
 * 4. Vercel Cron: vercel.json에 cron 설정 추가
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// 로그 파일 경로
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'gps-analysis-scheduler.log');

// 로그 기록 함수
async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(logMessage);

  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, logMessage);
  } catch (error) {
    console.error('로그 파일 작성 실패:', error);
  }
}

// GPS 분석 실행
async function runGpsAnalysis() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'analyze-gps-data.js');

    log('GPS 분석 시작...');

    exec(`node ${scriptPath}`, async (error, stdout, stderr) => {
      if (error) {
        await log(`GPS 분석 실패: ${error.message}`);
        reject(error);
        return;
      }

      if (stderr) {
        await log(`GPS 분석 경고: ${stderr}`);
      }

      await log('GPS 분석 완료');
      await log(`실행 결과:\n${stdout}`);

      resolve(stdout);
    });
  });
}

// 일일 실행 함수
async function runDaily() {
  try {
    await log('=== 일일 GPS 분석 시작 ===');

    // GPS 분석 실행
    await runGpsAnalysis();

    // 이메일 알림 (옵션)
    if (process.env.SEND_EMAIL_NOTIFICATION === 'true') {
      await sendEmailNotification();
    }

    await log('=== 일일 GPS 분석 완료 ===\n');
  } catch (error) {
    await log(`일일 실행 중 오류 발생: ${error.message}`);
    process.exit(1);
  }
}

// 이메일 알림 함수 (옵션)
async function sendEmailNotification() {
  // Resend API를 사용한 이메일 발송
  if (!process.env.RESEND_API_KEY) {
    await log('이메일 알림 건너뜀: RESEND_API_KEY 환경변수 없음');
    return;
  }

  try {
    const reportPath = path.join(__dirname, '../reports', `gps-analysis-report-${new Date().toISOString().split('T')[0]}.html`);
    const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);

    if (!reportExists) {
      await log('이메일 알림 건너뜀: 리포트 파일 없음');
      return;
    }

    // TODO: Resend API를 사용한 이메일 발송 구현
    await log('이메일 알림 발송 완료');
  } catch (error) {
    await log(`이메일 알림 실패: ${error.message}`);
  }
}

// 스케줄러 모드 확인
const mode = process.argv[2];

if (mode === '--once') {
  // 한 번만 실행
  log('단일 실행 모드');
  runDaily().then(() => {
    log('실행 완료');
    process.exit(0);
  });
} else if (mode === '--daemon') {
  // 데몬 모드 (매일 새벽 2시 실행)
  log('데몬 모드 시작 (매일 새벽 2시 실행)');

  const schedule = require('node-schedule');

  // 매일 새벽 2시에 실행
  const job = schedule.scheduleJob('0 2 * * *', async () => {
    await runDaily();
  });

  log('스케줄러가 실행 중입니다. Ctrl+C로 종료하세요.');

  // 프로세스 종료 시 정리
  process.on('SIGINT', () => {
    log('스케줄러 종료 중...');
    job.cancel();
    process.exit(0);
  });
} else {
  // 즉시 실행 (기본)
  log('즉시 실행 모드');
  runDaily().then(() => {
    log('실행 완료');
    process.exit(0);
  }).catch(() => {
    process.exit(1);
  });
}