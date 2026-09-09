import type { PrismaClient } from '@mytube-extract/db';
import { normalizeExtractedAssetTitle } from './worker.logic';

/** 요청 제목 저장에 필요한 Prisma client 표면. */
export type RequestTitleStoreClient = Pick<PrismaClient, 'extractionJob'>;

/** 요청에 처음 확보한 유효한 제목을 비어 있을 때만 저장한다. */
export async function saveRequestTitleIfMissing(
  client: RequestTitleStoreClient,
  jobId: string,
  title: string,
) {
  /** DB에 저장할 제목. */
  const normalizedTitle = normalizeExtractedAssetTitle(title);

  if (!normalizedTitle) {
    return false;
  }

  /** 조건부 저장 전에 읽을 현재 요청 제목. */
  const job = await client.extractionJob.findUnique({
    select: { title: true },
    where: { id: jobId },
  });

  if (!job || normalizeExtractedAssetTitle(job.title)) {
    return false;
  }

  // 읽은 제목을 조건에 포함해 동시 실행에서 먼저 저장된 제목을 보존한다.
  /** 조건부 제목 저장 결과. */
  const result = await client.extractionJob.updateMany({
    data: { title: normalizedTitle },
    where: {
      id: jobId,
      title: job.title,
    },
  });

  return result.count > 0;
}
