# AED Smart Check System - Project Specification

## Project Overview
전국 81,331대 AED(자동심장충격기) 통합 관리 및 점검 시스템

## Core Requirements

### What (무엇을)
- 261개 보건소의 AED 현지 점검 관리
- 우선순위 기반 스케줄링 시스템
- 실시간 동기화 및 오프라인 지원
- 모바일 최적화 PWA 애플리케이션

### Why (왜)
- 전국 AED 관리 체계의 효율성 증대
- 점검 누락 방지 및 생명 안전 보장
- 중앙응급의료센터 e-Gen 시스템 연동
- 체계적인 데이터 수집 및 분석

### Who (누가)
- Primary Users: 261개 보건소 담당자
- Secondary Users: 시도 관리자, 복지부 담당자
- Admin Users: 중앙응급의료센터 관리자

### Success Criteria
- 98% 점검 완료율 달성
- 250명 동시 접속 지원
- 2초 이내 페이지 로딩
- 99.9% 가용성

## Current Implementation Status

### ✅ Completed Features
- 튜토리얼 시스템 (95% 완성)
- 기본 UI/UX 구조
- Supabase 데이터베이스 스키마
- Next.js + TypeScript 기반 구조
- 점진적 개선 기능 (오프라인 지원, 동기화)

### 🔄 In Progress
- 컴포넌트 모듈화 (4000+ 라인 분리 필요)
- 상태 관리 개선
- 데이터베이스 스키마 적용

### 📋 Pending Features
1. 인증 체계 완성
2. AED 장치 등록 기능
3. 점검 일지 입력 폼
4. 관리자 대시보드
5. PWA 모바일 앱
6. 시스템 테스트

## Technical Architecture

### Frontend Stack
- Next.js 15.5.2 (App Router)
- TypeScript (엄격한 타입 체크)
- Tailwind CSS (반응형 디자인)
- PWA 지원 (next-pwa)

### Backend Stack
- Supabase (PostgreSQL + Auth + Realtime)
- Edge Functions (서버사이드 로직)
- Row Level Security (RLS)

### Development Standards
- CLAUDE.md 가이드라인 준수
- TypeScript/ESLint 검증 필수
- 이모지 사용 금지
- 단계적 진행 원칙

## Next Steps
1. 컴포넌트 모듈화 (Week 3-4)
2. 데이터 관리 CRUD (Week 4-5)
3. 점검 기능 구현 (Week 5-6)
4. PWA 모바일 앱 (Week 6-7)

---
*Last Updated: 2025-09-13*
*Specification Version: 1.0.0*