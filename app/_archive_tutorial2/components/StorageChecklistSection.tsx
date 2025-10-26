import React from 'react';
import { useRouter } from 'next/navigation';

interface StorageChecklistItem {
  key: keyof StorageChecklistData;
  label: string;
  description: string;
}

interface StorageChecklistData {
  hasStorage: string;        // 보관함 유무 (추가)
  theftAlarm: string;        // 도난경보장치 작동 여부
  guidanceText: string;      // 보관함 각종 안내문구상태
  emergencyContact: string;  // 비상연락망 표시 여부
  cprManual: string;        // 심폐소생술 방법 안내책자 여부
  expiryDisplay: string;     // 패드및배터리 유효기간 표시 여부
}

interface StorageChecklistSectionProps {
  storageChecklist: StorageChecklistData;
  setStorageChecklist: React.Dispatch<React.SetStateAction<StorageChecklistData>>;
}

const StorageChecklistSection: React.FC<StorageChecklistSectionProps> = ({
  storageChecklist,
  setStorageChecklist
}) => {
  const router = useRouter();
  // 보관함 형태 확인 항목
  const storageExistenceItem = {
    key: 'hasStorage' as keyof StorageChecklistData,
    label: '보관함 형태',
    description: '벽걸이형 또는 스탠드형 중 선택 (보관함이 없는 경우 해당없음 선택)'
  };

  const checklistItems: StorageChecklistItem[] = [
    {
      key: 'theftAlarm',
      label: '도난경보장치 작동 여부',
      description: '보관함의 도난경보장치가 정상적으로 작동하는지 확인'
    },
    {
      key: 'guidanceText',
      label: '보관함 각종 안내문구상태',
      description: '보관함에 부착된 안내문구들이 명확하게 보이는지 확인'
    },
    {
      key: 'emergencyContact',
      label: '비상연락망 표시 여부',
      description: '응급상황 시 연락할 수 있는 전화번호가 표시되어 있는지 확인'
    },
    {
      key: 'cprManual',
      label: '심폐소생술 방법 안내책자 여부',
      description: 'CPR 시행 방법이 담긴 안내책자가 비치되어 있는지 확인'
    },
    {
      key: 'expiryDisplay',
      label: '패드및배터리 유효기간 표시 여부',
      description: '패드와 배터리의 유효기간이 외부에서 확인 가능한지 점검'
    }
  ];

  const statusOptions = ['이상없음', '이상있음'];
  const storageOptions = ['벽걸이형', '스탠드형', '해당없음'];

  const getStatusColor = (status: string, isSelected: boolean = false) => {
    if (!isSelected) {
      return 'text-gray-400 bg-gray-800/50 border-gray-600 hover:border-gray-500';
    }

    switch (status) {
      case '이상없음':
      case '벽걸이형':
      case '스탠드형':
        return 'text-green-300 bg-green-500/20 border-green-500/60';
      case '이상있음':
        return 'text-red-300 bg-red-500/20 border-red-500/60';
      case '해당없음':
        return 'text-gray-300 bg-gray-500/20 border-gray-500/60';
      default:
        return 'text-gray-300 bg-gray-800 border-gray-600';
    }
  };

  const handleStatusChange = (itemKey: keyof StorageChecklistData, status: string) => {
    setStorageChecklist(prev => {
      // 해당없음을 선택한 경우 다른 모든 항목을 숨김 (비워둠)
      if (itemKey === 'hasStorage' && status === '해당없음') {
        return {
          hasStorage: status,
          theftAlarm: '',
          guidanceText: '',
          emergencyContact: '',
          cprManual: '',
          expiryDisplay: ''
        };
      }

      return {
        ...prev,
        [itemKey]: status
      };
    });
  };

  // 보관함이 없는 경우 다른 항목들을 숨김
  const isStorageAvailable = storageChecklist.hasStorage && storageChecklist.hasStorage !== '해당없음';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">보관함 상태 점검</h3>
        </div>
        <button
          type="button"
          onClick={() => router.push('/aed-storage-specifications')}
          className="text-xs px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          보관함 상세보기
        </button>
      </div>


      {/* 보관함 유무 확인 (최우선) */}
      <div className="p-4">
        <div className="mb-3">
          <h4 className="text-white font-medium mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {storageExistenceItem.label}
          </h4>
          {storageExistenceItem.description && (
            <p className="text-sm text-gray-400">{storageExistenceItem.description}</p>
          )}
        </div>

        <div className="flex gap-3">
          {storageOptions.map((option) => (
            <label
              key={option}
              className={`
                flex-1 flex items-center justify-center p-3 rounded-lg cursor-pointer
                transition-all duration-200 hover:scale-[1.02]
                ${getStatusColor(option, storageChecklist.hasStorage === option)}
              `}
            >
              <input
                type="radio"
                name="hasStorage"
                value={option}
                checked={storageChecklist.hasStorage === option}
                onChange={() => handleStatusChange('hasStorage', option)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 보관함 관련 세부 점검 항목들 */}
      {isStorageAvailable ? (
        <div className="space-y-4 transition-all duration-300">
          {checklistItems.map((item) => (
            <div key={item.key} className="p-4">
              <div className="mb-3">
                <h4 className="text-white font-medium mb-1">{item.label}</h4>
                <p className="text-gray-400 text-sm">{item.description}</p>
              </div>

              <div className="flex gap-2">
                {statusOptions.map((option) => (
                  <label
                    key={option}
                    className={`
                      flex-1 flex items-center justify-center p-2 rounded-lg cursor-pointer
                      transition-all duration-200 hover:scale-[1.02]
                      ${getStatusColor(option, storageChecklist[item.key] === option)}
                    `}
                  >
                    <input
                      type="radio"
                      name={item.key}
                      value={option}
                      checked={storageChecklist[item.key] === option}
                      onChange={() => handleStatusChange(item.key, option)}
                      className="sr-only"
                    />
                    <span className="text-xs font-medium">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3 mt-4">
          <p className="text-gray-400 text-sm text-center">
            보관함이 없어 관련 점검 항목을 건너뜁니다.
          </p>
        </div>
      )}

      {/* 점검 완료율 표시 */}
      <div className="bg-gray-800/30 border border-gray-600 rounded-lg p-4 mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300 text-sm">점검 완료율</span>
          <span className="text-white text-sm font-medium">
            {Math.round((Object.values(storageChecklist).filter(v => v !== '').length / checklistItems.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(Object.values(storageChecklist).filter(v => v !== '').length / checklistItems.length) * 100}%`
            }}
          ></div>
        </div>
      </div>

      {/* 이상있음 항목 요약 */}
      {Object.entries(storageChecklist).some(([, status]) => status === '이상있음') && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <h4 className="text-red-300 font-medium mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            주의가 필요한 항목
          </h4>
          <div className="space-y-1">
            {Object.entries(storageChecklist)
              .filter(([, status]) => status === '이상있음')
              .map(([key]) => {
                const item = checklistItems.find(item => item.key === key);
                return (
                  <p key={key} className="text-red-300 text-sm">
                    • {item?.label}
                  </p>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageChecklistSection;