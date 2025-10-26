/**
 * AES-256-GCM 암호화 유틸리티
 * 휴대전화 번호 등 민감 정보 암호화에 사용
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // GCM 표준 IV 길이
const AUTH_TAG_LENGTH = 16; // GCM 인증 태그 길이
const SALT_LENGTH = 32; // 키 유도용 솔트 길이

/**
 * 환경변수에서 암호화 키 가져오기
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
  }

  // 32바이트 (256비트) 키로 변환
  return Buffer.from(key, 'hex');
}

/**
 * 전화번호 암호화
 * @param phone - 암호화할 전화번호
 * @returns Base64 인코딩된 암호화 문자열
 */
export function encryptPhone(phone: string): string {
  if (!phone) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // 암호화
    let encrypted = cipher.update(phone, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // 인증 태그 가져오기
    const authTag = cipher.getAuthTag();

    // IV + 인증태그 + 암호문을 결합하여 Base64로 인코딩
    const result = Buffer.concat([iv, authTag, encrypted]);

    return result.toString('base64');
  } catch (error) {
    console.error('전화번호 암호화 실패:', error);
    throw new Error('전화번호 암호화에 실패했습니다.');
  }
}

/**
 * 전화번호 복호화
 * @param encryptedPhone - 암호화된 전화번호 (Base64)
 * @returns 복호화된 전화번호
 */
export function decryptPhone(encryptedPhone: string): string {
  if (!encryptedPhone) {
    return '';
  }

  try {
    // Base64 디코딩 시도
    let buffer: Buffer;
    try {
      buffer = Buffer.from(encryptedPhone, 'base64');
    } catch {
      // Base64가 아니면 이미 평문인 것으로 간주 (하위 호환성)
      console.warn('암호화되지 않은 전화번호 감지:', encryptedPhone.substring(0, 3) + '***');
      return encryptedPhone;
    }

    // 최소 길이 체크 (IV + AuthTag만 해도 32바이트)
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      console.warn('잘못된 암호화 형식, 평문으로 간주:', encryptedPhone.substring(0, 3) + '***');
      return encryptedPhone;
    }

    const key = getEncryptionKey();

    // IV, 인증태그, 암호문 분리
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // 복호화
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('전화번호 복호화 실패:', error);

    // 복호화 실패 시 평문으로 간주 (하위 호환성)
    console.warn('복호화 실패, 평문으로 처리:', encryptedPhone.substring(0, 3) + '***');
    return encryptedPhone;
  }
}

/**
 * 전화번호가 암호화되어 있는지 확인
 * @param phone - 확인할 전화번호
 * @returns 암호화 여부
 */
export function isEncrypted(phone: string): boolean {
  if (!phone) {
    return false;
  }

  try {
    // Base64 형식인지 확인
    const buffer = Buffer.from(phone, 'base64');

    // 최소 길이 체크
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return false;
    }

    // Base64 디코딩 후 다시 인코딩했을 때 원본과 같은지 확인
    return buffer.toString('base64') === phone;
  } catch {
    return false;
  }
}

/**
 * 전화번호 형식 검증 (복호화 후)
 * @param phone - 검증할 전화번호
 * @returns 유효성 여부
 */
export function isValidPhoneFormat(phone: string): boolean {
  if (!phone) {
    return false;
  }

  // 한국 전화번호 형식: 010-1234-5678, 02-123-4567, 031-123-4567 등
  const phoneRegex = /^(01[0-9]|02|0[3-9][0-9])-?[0-9]{3,4}-?[0-9]{4}$/;
  return phoneRegex.test(phone);
}
