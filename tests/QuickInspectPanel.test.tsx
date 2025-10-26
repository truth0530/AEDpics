import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';

vi.mock('@/app/aed-data/components/AEDDataProvider', () => ({
  useAEDData: () => ({
    userProfile: {
      fullName: '테스터',
      email: 'tester@example.com',
    },
  }),
}));

const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showSuccess, showError }),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

import { QuickInspectPanel } from '@/app/aed-data/components/QuickInspectPanel';

describe('QuickInspectPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    showSuccess.mockClear();
    showError.mockClear();
    push.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error cleanup
    delete global.fetch;
  });

  it('starts quick inspection and redirects to device inspection page', async () => {
    const device = {
      id: 'device-1',
      device_serial: 'SERIAL-123',
      equipment_serial: 'SERIAL-123',
      installation_org: '테스트 기관',
      installation_address: '서울시',
    } as const;

    const onClose = vi.fn();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inspectionId: 'insp-1' }),
    });
    // @ts-expect-error override global
    global.fetch = fetchMock;

    render(<QuickInspectPanel device={device} onClose={onClose} />);

    const startButton = screen.getByRole('button', { name: '점검 시작' });

    await act(async () => {
      fireEvent.click(startButton);
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/inspections/quick', expect.objectContaining({
      method: 'POST',
    }));
    expect(showSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/inspection/SERIAL-123');
  });
});
