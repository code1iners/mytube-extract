import type { PrismaClient } from '@mytube-extract/db';
import { normalizeRequestVideoTitle } from './downloads.util';

/** 요청 제목 이관에 필요한 Prisma extractionJob 표면. */
export type RequestTitleBackfillClient = Pick<PrismaClient, 'extractionJob'>;

/** 요청 제목 이관 실행 옵션. */
export type RequestTitleBackfillOptions = {
  /** 실제 updateMany를 실행할지 여부. 기본값은 dry-run이다. */
  apply?: boolean;
  /** 한 번에 읽을 요청 수. */
  batchSize?: number;
  /** 테스트 또는 제한된 리허설에서 처리할 video ID 목록. */
  videoIds?: readonly string[];
};

/** 요청 제목 이관 결과. */
export type RequestTitleBackfillResult = {
  /** 연결 결과물의 유효한 제목을 가진 미확보 요청 수. */
  candidates: number;
  /** 조회한 요청 수. */
  scanned: number;
  /** 조건부 저장에 성공한 요청 수. */
  updated: number;
};

/** 기본 batch 크기. */
const DEFAULT_BATCH_SIZE = 100;

/** 결과물에 남아 있는 제목을 요청 제목으로 이관한다. */
export async function backfillRequestTitles(
  client: RequestTitleBackfillClient,
  options: RequestTitleBackfillOptions = {},
): Promise<RequestTitleBackfillResult> {
  /** 한 번의 DB 조회에서 처리할 요청 수. */
  const batchSize = normalizeBatchSize(options.batchSize);
  /** dry-run이면 false인 실제 변경 플래그. */
  const apply = options.apply === true;
  /** 리허설 범위가 있으면 해당 video ID만 조회하는 조건. */
  const where = options.videoIds
    ? { videoId: { in: [...options.videoIds] } }
    : undefined;
  /** 다음 batch의 cursor. */
  let cursor: string | undefined;
  /** 지금까지 읽은 요청 수. */
  let scanned = 0;
  /** 결과물 제목으로 채울 수 있는 요청 수. */
  let candidates = 0;
  /** 조건부 updateMany가 반영한 요청 수. */
  let updated = 0;

  while (true) {
    /** 요청 제목과 연결 결과물 제목을 한 번에 읽는 batch. */
    const jobs = await client.extractionJob.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: {
        asset: { select: { title: true } },
        id: true,
        title: true,
      },
      take: batchSize,
      where,
    });

    if (jobs.length === 0) {
      break;
    }

    for (const job of jobs) {
      scanned += 1;

      /** 현재 요청에 이미 보존된 유효한 제목. */
      const currentTitle = normalizeRequestVideoTitle(job.title);
      /** 연결 결과물에서 이관할 수 있는 유효한 제목. */
      const assetTitle = normalizeRequestVideoTitle(job.asset?.title);

      if (currentTitle || !assetTitle) {
        continue;
      }

      candidates += 1;

      if (!apply) {
        continue;
      }

      /** 조회 당시 제목을 조건에 포함해 동시 실행의 덮어쓰기를 막는다. */
      const result = await client.extractionJob.updateMany({
        data: { title: assetTitle },
        where: { id: job.id, title: job.title },
      });

      updated += result.count;
    }

    if (jobs.length < batchSize) {
      break;
    }

    cursor = jobs[jobs.length - 1]?.id;
  }

  return { candidates, scanned, updated };
}

/** batch 크기를 안전한 양의 정수로 정규화한다. */
function normalizeBatchSize(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_BATCH_SIZE;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      'request title backfill batchSize must be a positive integer',
    );
  }

  return value;
}
