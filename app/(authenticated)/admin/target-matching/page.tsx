import { Metadata } from 'next';
import { TargetMatchingClient } from './TargetMatchingClient';

export const metadata: Metadata = {
  title: '2024년 구비의무기관 매칭 | AED Smart Check',
  description: 'AED 구비의무기관 매칭 및 검토 (2024년)',
};

export default function TargetMatchingPage() {
  return <TargetMatchingClient year={2024} />;
}
