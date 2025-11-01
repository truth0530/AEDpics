#!/bin/bash
# PM2 로그 로테이션 설정 스크립트
# 1인 개발자를 위한 간단한 로그 관리

# PM2 로그 로테이션 모듈 설치
pm2 install pm2-logrotate

# 로그 로테이션 설정
pm2 set pm2-logrotate:max_size 10M        # 10MB마다 로테이션
pm2 set pm2-logrotate:retain 7            # 최근 7개 파일만 보관
pm2 set pm2-logrotate:compress true       # gzip 압축
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateModule true   # PM2 자체 로그도 로테이션

echo "✅ PM2 로그 로테이션 설정 완료"
echo "- 로그 크기: 10MB마다 자동 로테이션"
echo "- 보관 기간: 최근 7개 파일 (약 1주일)"
echo "- 압축: gzip으로 자동 압축"
