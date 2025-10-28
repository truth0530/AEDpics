#!/bin/bash
# Node.js 20 설치 스크립트

set -e

echo "========================================="
echo "Node.js 20 설치 시작"
echo "========================================="

# NodeSource repository 추가
echo "NodeSource repository 추가 중..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Node.js 설치
echo "Node.js 설치 중..."
apt install -y nodejs

# 버전 확인
echo "========================================="
echo "설치 완료 - 버전 확인:"
node --version
npm --version
echo "========================================="
