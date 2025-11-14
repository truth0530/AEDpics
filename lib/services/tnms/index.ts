/**
 * TNMS (Trusted Name Matching Service) Phase 1
 * 기관명 정규화 및 신뢰도 기반 자동 매칭 시스템
 *
 * 모듈 구조:
 * - text-normalizer: 기관명 텍스트 정규화
 * - address-normalizer: 주소 정규화 및 해싱
 * - score-engine: 다중 신호 기반 신뢰도 점수 계산
 * - tnms-service: 통합 서비스 (모든 모듈 조합)
 */

export {
  TextNormalizer,
  textNormalizer,
  type NormalizationSignal,
} from './text-normalizer';

export {
  AddressNormalizer,
  addressNormalizer,
  type AddressNormalizationResult,
} from './address-normalizer';

export {
  ScoreEngine,
  scoreEngine,
  type MatchSignal,
} from './score-engine';

export {
  TnmsService,
  tnmsService,
} from './tnms-service';
