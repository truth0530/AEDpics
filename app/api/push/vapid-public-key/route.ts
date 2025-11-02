import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/push/vapid';

/**
 * GET: VAPID 공개 키 조회
 *
 * 클라이언트에서 푸시 알림 구독 시 필요한 VAPID 공개 키를 반환합니다.
 */
export async function GET() {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID 공개 키가 설정되지 않았습니다' },
      { status: 500 }
    );
  }

  return NextResponse.json({ publicKey });
}
