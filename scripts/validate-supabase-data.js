#!/usr/bin/env node

/**
 * Supabase AED 데이터 품질 검증 도구
 * 매일 1회 실행하여 데이터 품질 리포트 생성
 *
 * 사용법:
 * node scripts/validate-supabase-data.js
 *
 * 또는 package.json에 스크립트 추가:
 * "validate:data": "node scripts/validate-supabase-data.js"
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// 환경 변수 로드
require('dotenv').config({ path: '.env.local' });

// Supabase 설정 - 신규 프로젝트 (aieltmidsagiobpuebvv) 사용
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aieltmidsagiobpuebvv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 한국 GPS 범위
const KOREA_BOUNDS = {
  lat: { min: 33.0, max: 39.0 },
  lng: { min: 124.0, max: 132.0 }
};

class AEDDataValidator {
  constructor() {
    this.report = {
      timestamp: new Date().toISOString(),
      totalRecords: 0,
      issues: {
        duplicateSerialNumbers: [],
        dateLogicErrors: [],
        gpsErrors: [],
        missingFields: [],
        statusInconsistencies: [],
        expiredItems: [],
        inspectionIssues: [],
        categoryErrors: [],
        contactFormatErrors: [],
        manufacturerModelIssues: []
      },
      summary: {}
    };
  }

  /**
   * 1. 제조번호 중복 검사
   */
  async checkDuplicateSerialNumbers() {
    console.log('1. 제조번호 중복 검사 중...');

    try {
      // aed_data 테이블만 사용 (실제 운영 테이블)
      const tableName = 'aed_data';

      const { data, error } = await supabase
        .from(tableName)
        .select('serial_number, management_number, installation_institution')
        .not('serial_number', 'is', null)
        .not('serial_number', 'eq', '');

      if (error) throw error;

      const serialMap = {};
      data.forEach(item => {
        if (item.serial_number) {
          if (!serialMap[item.serial_number]) {
            serialMap[item.serial_number] = [];
          }
          serialMap[item.serial_number].push({
            managementNumber: item.management_number,
            institution: item.installation_institution
          });
        }
      });

      // 중복 찾기
      Object.entries(serialMap).forEach(([serial, items]) => {
        if (items.length > 1) {
          this.report.issues.duplicateSerialNumbers.push({
            serialNumber: serial,
            count: items.length,
            devices: items
          });
        }
      });

      console.log(`- 중복 제조번호: ${this.report.issues.duplicateSerialNumbers.length}건`);
    } catch (error) {
      console.error('제조번호 중복 검사 실패:', error.message);
    }
  }

  /**
   * 2. 날짜 논리 오류 검사
   */
  async checkDateLogicErrors() {
    console.log('2. 날짜 논리 오류 검사 중...');

    try {
      let tableName = 'aed_data';
      const { data, error } = await supabase
        .from(tableName)
        .select('id, management_number, manufacturing_date, installation_date, first_installation_date, battery_expiry_date, patch_expiry_date, replacement_date')
        .limit(5000); // 샘플링

      if (error) {
        tableName = 'aed_devices';
      }

      if (data) {
        data.forEach(item => {
          const errors = [];

          // 제조일 > 설치일
          if (item.manufacturing_date && item.installation_date) {
            const mfgDate = new Date(item.manufacturing_date);
            const installDate = new Date(item.installation_date);
            if (mfgDate > installDate) {
              errors.push({
                type: '제조일 > 설치일',
                manufacturing_date: item.manufacturing_date,
                installation_date: item.installation_date
              });
            }
          }

          // 최초설치일 > 현재설치일
          if (item.first_installation_date && item.installation_date) {
            const firstDate = new Date(item.first_installation_date);
            const currentDate = new Date(item.installation_date);
            if (firstDate > currentDate) {
              errors.push({
                type: '최초설치일 > 현재설치일',
                first_installation_date: item.first_installation_date,
                installation_date: item.installation_date
              });
            }
          }

          // 미래 날짜
          const today = new Date();
          if (item.manufacturing_date && new Date(item.manufacturing_date) > today) {
            errors.push({
              type: '미래 제조일',
              manufacturing_date: item.manufacturing_date
            });
          }

          if (errors.length > 0) {
            this.report.issues.dateLogicErrors.push({
              managementNumber: item.management_number,
              errors: errors
            });
          }
        });
      }

      console.log(`- 날짜 논리 오류: ${this.report.issues.dateLogicErrors.length}건`);
    } catch (error) {
      console.error('날짜 논리 검사 실패:', error.message);
    }
  }

  /**
   * 3. GPS 좌표 오류 검사
   */
  async checkGPSErrors() {
    console.log('3. GPS 좌표 오류 검사 중...');

    try {
      let tableName = 'aed_data';
      const { data, error } = await supabase
        .from(tableName)
        .select('id, management_number, latitude, longitude, installation_institution')
        .limit(10000);

      if (error) {
        tableName = 'aed_devices';
      }

      if (data) {
        data.forEach(item => {
          const errors = [];

          // GPS 없음
          if (!item.latitude || !item.longitude) {
            errors.push({ type: 'GPS 좌표 없음' });
          }
          // 0,0 좌표
          else if (item.latitude === 0 && item.longitude === 0) {
            errors.push({ type: '0,0 좌표' });
          }
          // 한국 범위 벗어남
          else if (
            item.latitude < KOREA_BOUNDS.lat.min ||
            item.latitude > KOREA_BOUNDS.lat.max ||
            item.longitude < KOREA_BOUNDS.lng.min ||
            item.longitude > KOREA_BOUNDS.lng.max
          ) {
            errors.push({
              type: '한국 범위 벗어남',
              lat: item.latitude,
              lng: item.longitude
            });
          }

          if (errors.length > 0) {
            this.report.issues.gpsErrors.push({
              managementNumber: item.management_number,
              institution: item.installation_institution,
              errors: errors
            });
          }
        });
      }

      console.log(`- GPS 오류: ${this.report.issues.gpsErrors.length}건`);
    } catch (error) {
      console.error('GPS 검사 실패:', error.message);
    }
  }

  /**
   * 4. 필수 필드 누락 검사
   */
  async checkMissingFields() {
    console.log('4. 필수 필드 누락 검사 중...');

    const requiredFields = [
      'management_number',
      'installation_institution',
      'installation_position',
      'model_name',
      'manufacturer',
      'battery_expiry_date',
      'patch_expiry_date'
    ];

    try {
      let tableName = 'aed_data';

      for (const field of requiredFields) {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .or(`${field}.is.null,${field}.eq.`);

        if (!error) {
          if (count > 0) {
            this.report.issues.missingFields.push({
              field: field,
              count: count
            });
          }
        }
      }

      console.log(`- 필수 필드 누락: ${this.report.issues.missingFields.length}개 필드`);
    } catch (error) {
      console.error('필수 필드 검사 실패:', error.message);
    }
  }

  /**
   * 5. 운영 상태 일관성 검사
   */
  async checkStatusInconsistencies() {
    console.log('5. 운영 상태 일관성 검사 중...');

    try {
      let tableName = 'aed_data';

      // 운영 중인데 외부 미표출이고 사유 없음
      const { data: noReasonData, error: error1 } = await supabase
        .from(tableName)
        .select('management_number, operation_status, external_display, external_non_display_reason')
        .eq('operation_status', '운영')
        .eq('external_display', 'N')
        .or('external_non_display_reason.is.null,external_non_display_reason.eq.')
        .limit(100);

      if (!error1 && noReasonData) {
        noReasonData.forEach(item => {
          this.report.issues.statusInconsistencies.push({
            type: '운영 중 + 외부 미표출 + 사유 없음',
            managementNumber: item.management_number
          });
        });
      }

      console.log(`- 운영 상태 불일치: ${this.report.issues.statusInconsistencies.length}건`);
    } catch (error) {
      console.error('운영 상태 검사 실패:', error.message);
    }
  }

  /**
   * 6. 유효기간 만료 검사
   */
  async checkExpiredItems() {
    console.log('6. 유효기간 만료 검사 중...');

    try {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      const thirtyDaysStr = thirtyDaysLater.toISOString().split('T')[0];

      let tableName = 'aed_data';

      // 배터리 만료
      const { count: batteryExpired } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .lt('battery_expiry_date', today);

      // 배터리 30일 이내 만료
      const { count: batterySoon } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .gte('battery_expiry_date', today)
        .lt('battery_expiry_date', thirtyDaysStr);

      // 패드 만료
      const { count: padExpired } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .lt('patch_expiry_date', today);

      // 패드 30일 이내 만료
      const { count: padSoon } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .gte('patch_expiry_date', today)
        .lt('patch_expiry_date', thirtyDaysStr);

      this.report.issues.expiredItems = {
        battery: {
          expired: batteryExpired || 0,
          expiringSoon: batterySoon || 0
        },
        pad: {
          expired: padExpired || 0,
          expiringSoon: padSoon || 0
        }
      };

      console.log(`- 배터리 만료: ${batteryExpired || 0}건, 패드 만료: ${padExpired || 0}건`);
    } catch (error) {
      console.error('유효기간 검사 실패:', error.message);
    }
  }

  /**
   * 7. 점검 현황 분석 (점검 주기가 아닌 최근 점검일 기반)
   */
  async analyzeInspectionStatus() {
    console.log('7. 점검 현황 분석 중...');

    try {
      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      let tableName = 'aed_data';

      // 6개월 이상 미점검
      const { count: overSixMonths } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .lt('last_inspection_date', sixMonthsAgo.toISOString().split('T')[0]);

      // 3-6개월 미점검
      const { count: threeToSix } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .gte('last_inspection_date', sixMonthsAgo.toISOString().split('T')[0])
        .lt('last_inspection_date', threeMonthsAgo.toISOString().split('T')[0]);

      // 점검 이력 없음
      const { count: noInspection } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .is('last_inspection_date', null);

      this.report.issues.inspectionIssues = {
        noInspection: noInspection || 0,
        overSixMonths: overSixMonths || 0,
        threeToSixMonths: threeToSix || 0,
        note: '주의: 점검 주기 패턴은 알 수 없음. 최근 점검일만 기준으로 분석'
      };

      console.log(`- 점검 이력 없음: ${noInspection || 0}건, 6개월 이상: ${overSixMonths || 0}건`);
    } catch (error) {
      console.error('점검 현황 분석 실패:', error.message);
    }
  }

  /**
   * 8. 카테고리 분류 오류 검사
   */
  async checkCategoryErrors() {
    console.log('8. 카테고리 분류 오류 검사 중...');

    try {
      let tableName = 'aed_data';

      // 구비의무기관 키워드
      const mandatoryKeywords = [
        '병원', '의원', '약국', '보건소', '학교', '어린이집', '유치원',
        '경찰서', '소방서', '공항', '역', '터미널', '항만', '체육시설'
      ];

      const { data, error } = await supabase
        .from(tableName)
        .select('management_number, category_1, category_2, category_3, installation_institution')
        .limit(5000);

      if (!error && data) {
        data.forEach(item => {
          const errors = [];

          // 구비의무기관 분류 검증
          if (item.category_1 === '구비의무기관') {
            const isMandatory = mandatoryKeywords.some(keyword =>
              item.installation_institution?.includes(keyword) ||
              item.category_2?.includes(keyword) ||
              item.category_3?.includes(keyword)
            );

            if (!isMandatory) {
              errors.push({
                type: '구비의무기관 분류 의심',
                institution: item.installation_institution
              });
            }
          }

          // 분류 누락
          if (!item.category_2 || !item.category_3) {
            errors.push({
              type: '중/소분류 누락'
            });
          }

          if (errors.length > 0) {
            this.report.issues.categoryErrors.push({
              managementNumber: item.management_number,
              errors: errors
            });
          }
        });
      }

      console.log(`- 카테고리 분류 오류: ${this.report.issues.categoryErrors.length}건`);
    } catch (error) {
      console.error('카테고리 검사 실패:', error.message);
    }
  }

  /**
   * 9. 연락처 형식 검사
   */
  async checkContactFormat() {
    console.log('9. 연락처 형식 검사 중...');

    try {
      let tableName = 'aed_data';
      const phoneRegex = /^(\d{2,3}-\d{3,4}-\d{4}|\d{9,11})$/;

      const { data, error } = await supabase
        .from(tableName)
        .select('management_number, institution_contact')
        .not('institution_contact', 'is', null)
        .limit(5000);

      if (!error && data) {
        data.forEach(item => {
          if (item.institution_contact) {
            const cleaned = item.institution_contact.replace(/[^\d-]/g, '');
            if (!phoneRegex.test(cleaned)) {
              this.report.issues.contactFormatErrors.push({
                managementNumber: item.management_number,
                contact: item.institution_contact
              });
            }
          }
        });
      }

      console.log(`- 연락처 형식 오류: ${this.report.issues.contactFormatErrors.length}건`);
    } catch (error) {
      console.error('연락처 검사 실패:', error.message);
    }
  }

  /**
   * 10. 제조사/모델 일관성 검사
   */
  async checkManufacturerModel() {
    console.log('10. 제조사/모델 일관성 검사 중...');

    const knownMappings = {
      '씨유메디칼': ['CU-SP1', 'CU-SP1 Plus', 'i-PAD CU-SP1'],
      '나눔테크': ['NT-381.C', 'ReHeart NT-381.C'],
      '라디안': ['HR-501', 'HR-501-B'],
      '필립스': ['HeartStart HS1', 'HeartStart FRx'],
      '메디아나': ['HeartSaver-A', 'Heart Saver-A']
    };

    try {
      let tableName = 'aed_data';

      const { data, error } = await supabase
        .from(tableName)
        .select('management_number, manufacturer, model_name')
        .not('manufacturer', 'is', null)
        .not('model_name', 'is', null)
        .limit(5000);

      if (!error && data) {
        data.forEach(item => {
          const normalizedManufacturer = item.manufacturer
            ?.replace(/\(주\)/g, '')
            ?.replace(/주식회사/g, '')
            ?.trim();

          Object.entries(knownMappings).forEach(([manufacturer, models]) => {
            if (normalizedManufacturer?.includes(manufacturer)) {
              const modelMatched = models.some(model =>
                item.model_name?.includes(model)
              );

              if (!modelMatched && item.model_name) {
                this.report.issues.manufacturerModelIssues.push({
                  managementNumber: item.management_number,
                  manufacturer: item.manufacturer,
                  model: item.model_name,
                  issue: '알려지지 않은 모델'
                });
              }
            }
          });
        });
      }

      console.log(`- 제조사/모델 불일치: ${this.report.issues.manufacturerModelIssues.length}건`);
    } catch (error) {
      console.error('제조사/모델 검사 실패:', error.message);
    }
  }

  /**
   * 전체 데이터 개수 확인
   */
  async getTotalCount() {
    try {
      let tableName = 'aed_data';
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        tableName = 'aed_devices';
        const { count: altCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        this.report.totalRecords = altCount || 0;
      } else {
        this.report.totalRecords = count || 0;
      }

      console.log(`\n총 레코드 수: ${this.report.totalRecords}개`);
    } catch (error) {
      console.error('전체 개수 확인 실패:', error.message);
    }
  }

  /**
   * 요약 생성
   */
  generateSummary() {
    this.report.summary = {
      totalRecords: this.report.totalRecords,
      duplicateSerialNumbers: this.report.issues.duplicateSerialNumbers.length,
      dateLogicErrors: this.report.issues.dateLogicErrors.length,
      gpsErrors: this.report.issues.gpsErrors.length,
      missingFieldTypes: this.report.issues.missingFields.length,
      statusInconsistencies: this.report.issues.statusInconsistencies.length,
      expiredBatteries: this.report.issues.expiredItems.battery?.expired || 0,
      expiredPads: this.report.issues.expiredItems.pad?.expired || 0,
      noInspectionHistory: this.report.issues.inspectionIssues.noInspection || 0,
      categoryErrors: this.report.issues.categoryErrors.length,
      contactFormatErrors: this.report.issues.contactFormatErrors.length,
      manufacturerModelIssues: this.report.issues.manufacturerModelIssues.length
    };
  }

  /**
   * 리포트 저장
   */
  async saveReport() {
    const reportDir = path.join(process.cwd(), 'reports');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `aed-validation-report-${dateStr}.json`;
    const filePath = path.join(reportDir, fileName);

    try {
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(this.report, null, 2));
      console.log(`\n리포트 저장 완료: ${filePath}`);
    } catch (error) {
      console.error('리포트 저장 실패:', error.message);
    }
  }

  /**
   * 실행
   */
  async run() {
    console.log('=== Supabase AED 데이터 검증 시작 ===');
    console.log(`실행 시간: ${new Date().toLocaleString('ko-KR')}\n`);

    await this.getTotalCount();
    await this.checkDuplicateSerialNumbers();
    await this.checkDateLogicErrors();
    await this.checkGPSErrors();
    await this.checkMissingFields();
    await this.checkStatusInconsistencies();
    await this.checkExpiredItems();
    await this.analyzeInspectionStatus();
    await this.checkCategoryErrors();
    await this.checkContactFormat();
    await this.checkManufacturerModel();

    this.generateSummary();
    await this.saveReport();

    console.log('\n=== 검증 완료 ===');
    console.log('\n요약:');
    console.log(JSON.stringify(this.report.summary, null, 2));
  }
}

// 실행
const validator = new AEDDataValidator();
validator.run().catch(console.error);