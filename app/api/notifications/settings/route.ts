import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithProfile, isErrorResponse } from '@/lib/auth/session-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notifications/settings
 * 사용자의 알림 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile } = authResult;

    // 사용자 알림 설정 조회 (없으면 기본값 생성)
    let settings = await prisma.notification_settings.findUnique({
      where: { user_id: profile.id },
    });

    // 설정이 없으면 기본값으로 생성
    if (!settings) {
      settings = await prisma.notification_settings.create({
        data: {
          user_id: profile.id,
          sound_enabled: true,
          voice_enabled: true,
          browser_push_enabled: true,
          toast_enabled: true,
          reminder_enabled: true,
          reminder_interval: 60, // 60초 (1분)
          quiet_hours_enabled: false,
        },
      });
    }

    return NextResponse.json({
      settings: {
        soundEnabled: settings.sound_enabled,
        voiceEnabled: settings.voice_enabled,
        browserPushEnabled: settings.browser_push_enabled,
        toastEnabled: settings.toast_enabled,
        reminderEnabled: settings.reminder_enabled,
        reminderInterval: settings.reminder_interval,
        quietHoursEnabled: settings.quiet_hours_enabled,
        quietHoursStart: settings.quiet_hours_start,
        quietHoursEnd: settings.quiet_hours_end,
      },
    });
  } catch (error) {
    console.error('[GET /api/notifications/settings] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/settings
 * 사용자의 알림 설정 업데이트
 *
 * Request Body:
 * {
 *   soundEnabled?: boolean,
 *   voiceEnabled?: boolean,
 *   browserPushEnabled?: boolean,
 *   toastEnabled?: boolean,
 *   reminderEnabled?: boolean,
 *   reminderInterval?: number,
 *   quietHoursEnabled?: boolean,
 *   quietHoursStart?: string,
 *   quietHoursEnd?: string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile } = authResult;
    const body = await request.json();

    // 입력값 검증
    const updateData: any = {};

    if (typeof body.soundEnabled === 'boolean') {
      updateData.sound_enabled = body.soundEnabled;
    }
    if (typeof body.voiceEnabled === 'boolean') {
      updateData.voice_enabled = body.voiceEnabled;
    }
    if (typeof body.browserPushEnabled === 'boolean') {
      updateData.browser_push_enabled = body.browserPushEnabled;
    }
    if (typeof body.toastEnabled === 'boolean') {
      updateData.toast_enabled = body.toastEnabled;
    }
    if (typeof body.reminderEnabled === 'boolean') {
      updateData.reminder_enabled = body.reminderEnabled;
    }
    if (typeof body.reminderInterval === 'number' && body.reminderInterval > 0) {
      updateData.reminder_interval = body.reminderInterval;
    }
    if (typeof body.quietHoursEnabled === 'boolean') {
      updateData.quiet_hours_enabled = body.quietHoursEnabled;
    }
    if (typeof body.quietHoursStart === 'string') {
      // 시간 형식 검증 (HH:mm)
      if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(body.quietHoursStart)) {
        updateData.quiet_hours_start = body.quietHoursStart;
      }
    }
    if (typeof body.quietHoursEnd === 'string') {
      // 시간 형식 검증 (HH:mm)
      if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(body.quietHoursEnd)) {
        updateData.quiet_hours_end = body.quietHoursEnd;
      }
    }

    // 설정 업데이트 또는 생성
    const settings = await prisma.notification_settings.upsert({
      where: { user_id: profile.id },
      update: updateData,
      create: {
        user_id: profile.id,
        sound_enabled: body.soundEnabled ?? true,
        voice_enabled: body.voiceEnabled ?? true,
        browser_push_enabled: body.browserPushEnabled ?? true,
        toast_enabled: body.toastEnabled ?? true,
        reminder_enabled: body.reminderEnabled ?? true,
        reminder_interval: body.reminderInterval ?? 60,
        quiet_hours_enabled: body.quietHoursEnabled ?? false,
        quiet_hours_start: body.quietHoursStart ?? null,
        quiet_hours_end: body.quietHoursEnd ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      settings: {
        soundEnabled: settings.sound_enabled,
        voiceEnabled: settings.voice_enabled,
        browserPushEnabled: settings.browser_push_enabled,
        toastEnabled: settings.toast_enabled,
        reminderEnabled: settings.reminder_enabled,
        reminderInterval: settings.reminder_interval,
        quietHoursEnabled: settings.quiet_hours_enabled,
        quietHoursStart: settings.quiet_hours_start,
        quietHoursEnd: settings.quiet_hours_end,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/notifications/settings] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
