import { DocumentIngestionStatus } from '../../../../generated/prisma/client';

export interface RequesterContext {
  userId: string;
}

export interface IngestDocumentJobPayload {
  documentId: string;
  organizationId: string;
  workspaceId: string | null;
  uploadedByUserId: string;
  filename: string;
  storageUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  checksumSha256: string | null;
  requestedAt: string;
}

export interface IngestDocumentJobResult {
  documentId: string;
  organizationId: string;
  status: DocumentIngestionStatus;
  chunksCreated?: number;
  completedAt?: string;
}

export interface EnqueueDocumentIngestionResult {
  documentId: string;
  organizationId: string;
  workspaceId: string | null;
  status: DocumentIngestionStatus;
  queueJobId: string;
}
