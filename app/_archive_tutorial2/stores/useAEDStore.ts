/**
 * Zustand Store for AED Inspection System
 * 중앙집중식 상태 관리를 위한 스토어
 *
 * 81,331개 AED 장비 관리를 위한 확장 가능한 상태 관리 시스템
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ProductionAEDData, InspectionSession, FilterParams, ValidationResult } from '../types/ProductionAEDTypes';
import type { InspectionRecord } from '../types/ProductionAEDTypes';
import { AEDDataValidator, AEDSearchService } from '../types/ProductionAEDTypes';

/**
 * AED Store 상태 인터페이스
 */
interface AEDStoreState {
  // ===== 장비 데이터 =====
  devices: ProductionAEDData[];
  filteredDevices: ProductionAEDData[];
  selectedDevice: ProductionAEDData | null;
  totalDevices: number;

  // ===== 페이지네이션 =====
  currentPage: number;
  pageSize: number;
  totalPages: number;

  // ===== 필터링 & 검색 =====
  filters: FilterParams;
  searchText: string;
  sortBy: keyof ProductionAEDData;
  sortOrder: 'asc' | 'desc';

  // ===== 점검 세션 =====
  currentSession: InspectionSession | null;
  inspectionData: Partial<InspectionRecord>;
  completedItems: Set<string>;
  validationErrors: Record<string, string>;

  // ===== UI 상태 =====
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;

  // ===== 오프라인 지원 =====
  offlineMode: boolean;
  offlineQueue: Array<{ type: string; data: unknown; timestamp: Date }>;
  syncStatus: 'idle' | 'syncing' | 'error';

  // ===== 통계 =====
  statistics: {
    urgentCount: number;
    warningCount: number;
    normalCount: number;
    completedToday: number;
    pendingInspections: number;
  };
}

/**
 * AED Store 액션 인터페이스
 */
interface AEDStoreActions {
  // ===== 장비 관리 =====
  loadDevices: (devices: ProductionAEDData[]) => void;
  selectDevice: (device: ProductionAEDData | null) => void;
  updateDevice: (deviceId: string, updates: Partial<ProductionAEDData>) => void;

  // ===== 필터링 & 검색 =====
  setFilters: (filters: Partial<FilterParams>) => void;
  clearFilters: () => void;
  searchDevices: (searchText: string) => void;
  setSortBy: (field: keyof ProductionAEDData, order?: 'asc' | 'desc') => void;
  applyFiltersAndSort: () => void;

  // ===== 페이지네이션 =====
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // ===== 점검 세션 =====
  startInspection: (device: ProductionAEDData) => void;
  updateInspectionData: (field: string, value: unknown) => void;
  completeInspectionItem: (itemKey: string) => void;
  validateInspection: () => ValidationResult;
  saveInspection: () => Promise<void>;
  cancelInspection: () => void;

  // ===== 오프라인 지원 =====
  setOfflineMode: (offline: boolean) => void;
  addToOfflineQueue: (data: { type: string; data: unknown; timestamp: Date }) => void;
  syncOfflineData: () => Promise<void>;
  clearOfflineQueue: () => void;

  // ===== UI 상태 =====
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
  clearMessages: () => void;

  // ===== 통계 =====
  updateStatistics: () => void;

  // ===== 유틸리티 =====
  reset: () => void;
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

/**
 * AED Store 타입
 */
type AEDStore = AEDStoreState & AEDStoreActions;

/**
 * 초기 상태
 */
const initialState: AEDStoreState = {
  devices: [],
  filteredDevices: [],
  selectedDevice: null,
  totalDevices: 0,

  currentPage: 1,
  pageSize: 50,
  totalPages: 0,

  filters: {},
  searchText: '',
  sortBy: 'priority_score' as keyof ProductionAEDData,
  sortOrder: 'desc',

  currentSession: null,
  inspectionData: {},
  completedItems: new Set(),
  validationErrors: {},

  isLoading: false,
  isSaving: false,
  error: null,
  successMessage: null,

  offlineMode: false,
  offlineQueue: [],
  syncStatus: 'idle',

  statistics: {
    urgentCount: 0,
    warningCount: 0,
    normalCount: 0,
    completedToday: 0,
    pendingInspections: 0,
  },
};

/**
 * Zustand Store 생성
 */
export const useAEDStore = create<AEDStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ===== 장비 관리 =====
        loadDevices: (devices: ProductionAEDData[]) => set((state) => {
          state.devices = devices;
          state.totalDevices = devices.length;
          state.totalPages = Math.ceil(devices.length / state.pageSize);

          // 초기 필터링 및 정렬 적용
          get().applyFiltersAndSort();
          get().updateStatistics();
        }),

        selectDevice: (device) => set((state) => {
          state.selectedDevice = device;
        }),

        updateDevice: (deviceId, updates) => set((state) => {
          const index = state.devices.findIndex((d: ProductionAEDData) => d.equipment_serial === deviceId);
          if (index !== -1) {
            Object.assign(state.devices[index], updates);
            get().applyFiltersAndSort();
          }
        }),

        // ===== 필터링 & 검색 =====
        setFilters: (filters) => set((state) => {
          state.filters = { ...state.filters, ...filters };
          state.currentPage = 1; // 필터 변경 시 첫 페이지로
          get().applyFiltersAndSort();
        }),

        clearFilters: () => set((state) => {
          state.filters = {};
          state.searchText = '';
          state.currentPage = 1;
          get().applyFiltersAndSort();
        }),

        searchDevices: (searchText) => set((state) => {
          state.searchText = searchText;
          state.currentPage = 1;
          get().applyFiltersAndSort();
        }),

        setSortBy: (field, order) => set((state) => {
          state.sortBy = field;
          if (order) state.sortOrder = order;
          else state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
          get().applyFiltersAndSort();
        }),

        applyFiltersAndSort: () => set((state) => {
          let filtered = [...state.devices];

          // 텍스트 검색
          if (state.searchText) {
            filtered = AEDSearchService.searchDevices(filtered, state.searchText);
          }

          // 필터 적용
          filtered = AEDSearchService.filterDevices(filtered, state.filters);

          // 정렬
          filtered = AEDSearchService.sortDevices(filtered, state.sortBy, state.sortOrder);

          state.filteredDevices = filtered;
          state.totalPages = Math.ceil(filtered.length / state.pageSize);
        }),

        // ===== 페이지네이션 =====
        setPage: (page) => set((state) => {
          state.currentPage = Math.max(1, Math.min(page, state.totalPages));
        }),

        setPageSize: (size) => set((state) => {
          state.pageSize = size;
          state.totalPages = Math.ceil(state.filteredDevices.length / size);
          state.currentPage = 1;
        }),

        nextPage: () => {
          const { currentPage, totalPages } = get();
          if (currentPage < totalPages) {
            get().setPage(currentPage + 1);
          }
        },

        prevPage: () => {
          const { currentPage } = get();
          if (currentPage > 1) {
            get().setPage(currentPage - 1);
          }
        },

        // ===== 점검 세션 =====
        startInspection: (device) => set((state) => {
          state.selectedDevice = device;
          state.currentSession = {
            sessionId: `session-${Date.now()}`,
            deviceId: device.equipment_serial,
            inspectorId: 'current-user', // TODO: 실제 사용자 ID
            startTime: new Date(),
            currentStep: 1,
            totalSteps: 20,
            completedItems: new Set(),
            skippedItems: new Set(),
            changes: [],
            autoSaveEnabled: true,
            draftData: {},
            validationErrors: {},
            warnings: {},
            offlineMode: state.offlineMode,
            syncQueue: [],
          };
          state.inspectionData = {
            deviceId: device.equipment_serial,
            inspectionDate: new Date(),
          };
          state.completedItems = new Set();
          state.validationErrors = {};
        }),

        updateInspectionData: (field, value) => set((state) => {
          state.inspectionData[field as keyof InspectionRecord] = value;

          // 변경사항 추적
          if (state.currentSession) {
            state.currentSession.changes.push({
              field,
              oldValue: state.selectedDevice?.[field as keyof ProductionAEDData],
              newValue: value,
              timestamp: new Date(),
            });
          }

          // 실시간 검증
          const validation = AEDDataValidator.validateInspection(state.inspectionData);
          state.validationErrors = {};
          validation.errors.forEach(error => {
            state.validationErrors[error.field] = error.message;
          });
        }),

        completeInspectionItem: (itemKey) => set((state) => {
          state.completedItems.add(itemKey);
          if (state.currentSession) {
            state.currentSession.completedItems.add(itemKey);
          }
        }),

        validateInspection: () => {
          const { inspectionData } = get();
          return AEDDataValidator.validateInspection(inspectionData);
        },

        saveInspection: async () => {
          const { inspectionData, offlineMode } = get();

          set((state) => {
            state.isSaving = true;
            state.error = null;
          });

          try {
            if (offlineMode) {
              // 오프라인 모드: 로컬 저장
              get().addToOfflineQueue({
                type: 'inspection',
                data: inspectionData,
                timestamp: new Date(),
              });

              set((state) => {
                state.successMessage = '오프라인 저장 완료';
              });
            } else {
              // 온라인 모드: 서버 저장
              // TODO: 실제 API 호출
              await new Promise(resolve => setTimeout(resolve, 1000)); // 시뮬레이션

              set((state) => {
                state.successMessage = '점검 결과가 저장되었습니다';
              });
            }

            // 세션 종료
            set((state) => {
              state.currentSession = null;
              state.inspectionData = {};
              state.completedItems = new Set();
              state.validationErrors = {};
            });

            get().updateStatistics();
          } catch (err) {
            set((state) => {
              state.error = err instanceof Error ? err.message : '저장 실패';
            });
          } finally {
            set((state) => {
              state.isSaving = false;
            });
          }
        },

        cancelInspection: () => set((state) => {
          state.currentSession = null;
          state.inspectionData = {};
          state.completedItems = new Set();
          state.validationErrors = {};
          state.selectedDevice = null;
        }),

        // ===== 오프라인 지원 =====
        setOfflineMode: (offline) => set((state) => {
          state.offlineMode = offline;
        }),

        addToOfflineQueue: (data) => set((state) => {
          state.offlineQueue.push(data);
        }),

        syncOfflineData: async () => {
          const { offlineQueue } = get();

          if (offlineQueue.length === 0) return;

          set((state) => {
            state.syncStatus = 'syncing';
          });

          try {
            // TODO: 실제 동기화 로직
            // 현재는 시뮬레이션을 위해 각 항목당 100ms 지연
            await new Promise(resolve => setTimeout(resolve, offlineQueue.length * 100));

            set((state) => {
              state.offlineQueue = [];
              state.syncStatus = 'idle';
              state.successMessage = `${offlineQueue.length}개 항목 동기화 완료`;
            });
          } catch {
            set((state) => {
              state.syncStatus = 'error';
              state.error = '동기화 실패';
            });
          }
        },

        clearOfflineQueue: () => set((state) => {
          state.offlineQueue = [];
        }),

        // ===== UI 상태 =====
        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        setError: (error) => set((state) => {
          state.error = error;
        }),

        setSuccessMessage: (message) => set((state) => {
          state.successMessage = message;
        }),

        clearMessages: () => set((state) => {
          state.error = null;
          state.successMessage = null;
        }),

        // ===== 통계 =====
        updateStatistics: () => set((state) => {
          const devices = state.devices;

          state.statistics = {
            urgentCount: devices.filter((d: ProductionAEDData) => d.riskLevel === 'critical').length,
            warningCount: devices.filter((d: ProductionAEDData) => d.riskLevel === 'high').length,
            normalCount: devices.filter((d: ProductionAEDData) => d.riskLevel === 'low' || d.riskLevel === 'medium').length,
            completedToday: 0, // TODO: 실제 계산
            pendingInspections: devices.filter((d: ProductionAEDData) => {
              const lastInspection = new Date(d.last_inspection_date);
              const daysSince = Math.floor((Date.now() - lastInspection.getTime()) / (1000 * 60 * 60 * 24));
              return daysSince > 30;
            }).length,
          };
        }),

        // ===== 유틸리티 =====
        reset: () => set(() => initialState),

        loadFromLocalStorage: () => {
          // persist 미들웨어가 자동 처리
        },

        saveToLocalStorage: () => {
          // persist 미들웨어가 자동 처리
        },
      })),
      {
        name: 'aed-store',
        partialize: (state) => ({
          filters: state.filters,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          pageSize: state.pageSize,
          offlineQueue: state.offlineQueue,
        }),
      }
    )
  )
);

/**
 * Selector Hooks
 */
export const useCurrentPageDevices = () => {
  const { filteredDevices, currentPage, pageSize } = useAEDStore();
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  return filteredDevices.slice(start, end);
};

export const useDeviceById = (deviceId: string) => {
  const devices = useAEDStore((state) => state.devices);
  return devices.find(d => d.equipment_serial === deviceId);
};

export const useInspectionProgress = () => {
  const { completedItems, currentSession } = useAEDStore();
  const totalSteps = currentSession?.totalSteps || 20;
  const completed = completedItems.size;
  const percentage = Math.round((completed / totalSteps) * 100);

  return {
    completed,
    total: totalSteps,
    percentage,
    isComplete: completed === totalSteps,
  };
};

export default useAEDStore;