// 데이터 검증 경고 표시 컴포넌트
'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { ValidationReport, validationService } from '../services/ValidationService';
import { RealAEDData } from '../types/RealAEDTypes';

interface DataValidationWarningsProps {
  device: RealAEDData | null;
  onClose?: () => void;
}

// 필드명 한글 변환 매핑
const fieldNameMap: { [key: string]: string } = {
  'serial_number': '제조번호',
  'management_number': '관리번호',
  'equipment_serial': '장비일련번호',
  'battery_expiry_date': '배터리 유효기간',
  'patch_expiry_date': '패드 유효기간',
  'last_inspection_date': '최근 점검일',
  'installation_date': '설치일자',
  'manufacturing_date': '제조일자',
  'installation_position': '설치위치',
  'installation_institution': '설치기관',
  'model_name': '모델명',
  'sido': '시도',
  'gugun': '시군구',
  'operation_status': '운영상태'
};

export const DataValidationWarnings: React.FC<DataValidationWarningsProps> = ({ device, onClose }) => {
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const validateDeviceAsync = async () => {
      if (!device) return;

      setIsLoading(true);
      try {
        const report = await validationService.validateDevice(device);
        setValidationReport(report);

        // 모든 카테고리가 바로 표시됨 (펼침 기능 제거)
      } catch (error) {
        console.error('데이터 검증 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (device) {
      validateDeviceAsync();
    }
  }, [device]);




  const getIssueBgColor = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error':
        return 'bg-red-900/20 border-red-600/30';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-600/30';
      case 'info':
        return 'bg-blue-900/20 border-blue-600/30';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 rounded-xl backdrop-blur-sm border border-gray-700/50 p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-400"></div>
          <span className="text-gray-300">데이터 검증 중...</span>
        </div>
      </div>
    );
  }

  if (!validationReport || validationReport.issues.length === 0) {
    return (
      <div className="bg-green-900/20 rounded-xl backdrop-blur-sm border border-green-600/30 p-4">
        <div className="flex items-center space-x-2">
          <CheckCircleIcon className="w-5 h-5 text-green-400" />
          <span className="text-green-400 font-medium">데이터 검증 완료: 이상 없음</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl backdrop-blur-sm border border-gray-700/50 shadow-2xl">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-white">데이터 검증 결과</h3>
          <div className="flex items-center space-x-2 text-sm">
            {validationReport.criticalIssues > 0 && (
              <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full border border-red-600/30">
                오류 {validationReport.criticalIssues}
              </span>
            )}
            {validationReport.warningIssues > 0 && (
              <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full border border-yellow-600/30">
                경고 {validationReport.warningIssues}
              </span>
            )}
            {validationReport.totalIssues - validationReport.criticalIssues - validationReport.warningIssues > 0 && (
              <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full border border-blue-600/30">
                정보 {validationReport.totalIssues - validationReport.criticalIssues - validationReport.warningIssues}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 장치 정보 */}
      <div className="px-4 py-2 bg-gray-900/30 border-b border-gray-700/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">관리번호: <span className="text-gray-300">{validationReport.managementNumber}</span></span>
          <span className="text-gray-400">설치기관: <span className="text-gray-300">{validationReport.institution}</span></span>
        </div>
      </div>

      {/* 이슈 목록 */}
      <div className="max-h-96 overflow-y-auto px-4 py-3 space-y-2">
        {validationReport.issues.map((issue, index) => {
          const itemKey = `issue-${index}`;
          const isExpanded = expandedItems.has(itemKey);
          return (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getIssueBgColor(issue.type)} relative`}
            >
              {/* 중요도 표시 */}
              {issue.type === 'error' && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  긴급
                </div>
              )}

              <div className="flex items-start space-x-2">
                <div className="flex-1">
                  {/* 이슈 메시지를 메인으로 표시, 관련 항목이 있을 때만 화살표 */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-200 font-medium">{issue.message}</p>
                    {issue.relatedData && Array.isArray(issue.relatedData) ? (
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedItems);
                          if (isExpanded) {
                            newExpanded.delete(itemKey);
                          } else {
                            newExpanded.add(itemKey);
                          }
                          setExpandedItems(newExpanded);
                        }}
                        className="text-gray-400 hover:text-gray-200 transition-colors p-1"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  {/* 관련 항목 - 펼침 시에만 표시 */}
                  {issue.relatedData && Array.isArray(issue.relatedData) && isExpanded ? (
                    <div className="mt-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <div className="space-y-1">
                        {(issue.relatedData as Array<{managementNumber: string; institution: string}>).map((data, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400">
                              관리번호: <span className="text-gray-300">{data.managementNumber}</span>
                            </span>
                            <span className="text-gray-500">|</span>
                            <span className="text-gray-400">
                              기관: <span className="text-gray-300">{data.institution}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* 기타 관련 데이터 (배터리, 패드 등) - 항상 표시 */}
                  {issue.relatedData && !Array.isArray(issue.relatedData) && typeof issue.relatedData === 'object' ? (
                    <div className="mt-2 text-xs text-gray-400">
                      {(() => {
                        const data = issue.relatedData as {
                          batteryExpiry?: string;
                          padExpiry?: string;
                          lastInspection?: string;
                          daysSinceLastInspection?: number;
                          [key: string]: string | number | undefined;
                        };
                        if (data.batteryExpiry && data.padExpiry) {
                          return (
                            <div className="space-y-1">
                              <div>배터리 만료: <span className="text-gray-300">{data.batteryExpiry}</span></div>
                              <div>패드 만료: <span className="text-gray-300">{data.padExpiry}</span></div>
                              {data.lastInspection && (
                                <div>최근 점검: <span className="text-gray-300">{data.lastInspection}</span></div>
                              )}
                            </div>
                          );
                        } else if (data.daysSinceLastInspection !== undefined) {
                          return (
                            <div>
                              점검 경과일: <span className="text-yellow-400 font-medium">{data.daysSinceLastInspection}일</span>
                            </div>
                          );
                        } else {
                          return (
                            <>
                              {Object.entries(data).map(([key, value]) => (
                                <div key={key}>
                                  {fieldNameMap[key] || key}: <span className="text-gray-300">{String(value)}</span>
                                </div>
                              ))}
                            </>
                          );
                        }
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 요약 */}
      <div className="px-4 py-3 bg-gray-900/30 text-sm text-gray-400">
        <div className="flex items-center justify-between">
          <span>총 <span className="text-white font-medium">{validationReport.totalIssues}</span>개 문제 발견</span>
          <button
            onClick={async () => {
              if (!device) return;
              setIsLoading(true);
              try {
                const report = await validationService.validateDevice(device);
                setValidationReport(report);
                // 모든 카테고리가 바로 표시됨 (펼침 기능 제거)
              } catch (error) {
                console.error('데이터 검증 오류:', error);
              } finally {
                setIsLoading(false);
              }
            }}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            다시 검증
          </button>
        </div>
      </div>
    </div>
  );
};

// 간단한 경고 배지 컴포넌트
export const ValidationBadge: React.FC<{
  criticalCount: number;
  warningCount: number;
}> = ({ criticalCount, warningCount }) => {
  if (criticalCount === 0 && warningCount === 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-600/30">
        <CheckCircleIcon className="w-3 h-3 mr-1" />
        정상
      </span>
    );
  }

  return (
    <div className="inline-flex items-center space-x-1">
      {criticalCount > 0 && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-600/30">
          <ExclamationCircleIcon className="w-3 h-3 mr-1" />
          오류 {criticalCount}
        </span>
      )}
      {warningCount > 0 && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-600/30">
          <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
          경고 {warningCount}
        </span>
      )}
    </div>
  );
};