import { use } from 'react';
import { InspectionPageClient } from './InspectionPageClient';

interface InspectionPageProps {
  params: Promise<{ serial: string }>;
}

export default function InspectionPage({ params }: InspectionPageProps) {
  const { serial } = use(params);

  return <InspectionPageClient serial={serial} />;
}
