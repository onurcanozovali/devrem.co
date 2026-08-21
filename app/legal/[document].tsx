import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/common/EmptyState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { LegalDocumentScreen } from '@/features/legal/LegalDocumentScreen';
import { isLegalDocumentId } from '@/features/legal/legalDomain';

export default function LegalDocumentRoute() {
  const params = useLocalSearchParams<{ document?: string | string[] }>();
  const documentId = typeof params.document === 'string' ? params.document : '';
  if (!isLegalDocumentId(documentId)) return <ScreenContainer><EmptyState title="Belge bulunamadı" description="Bu yasal belge mevcut değil." /></ScreenContainer>;
  return <LegalDocumentScreen documentId={documentId} />;
}
