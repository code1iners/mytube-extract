import { PrismaClient } from '@mytube-extract/db';
import { backfillRequestTitles } from '../src/downloads/request-title-backfill';

/** 명시적으로 허용하는 이관 CLI 옵션. */
const SUPPORTED_ARGUMENTS = new Set(['--apply']);

/** 명령행 인자를 실제 변경 모드로 해석한다. */
function parseApplyMode(argumentsList: string[]) {
  /** 인식하지 못한 명령행 인자. */
  const unknownArguments = argumentsList.filter(
    (argument) => !SUPPORTED_ARGUMENTS.has(argument),
  );

  if (unknownArguments.length > 0) {
    throw new Error(
      `unsupported request title backfill argument: ${unknownArguments.join(', ')}`,
    );
  }

  return argumentsList.includes('--apply');
}

/** 요청 제목 이관을 실행하고 결과를 한 줄로 기록한다. */
async function main() {
  /** dry-run을 기본값으로 하는 실제 변경 모드. */
  const apply = parseApplyMode(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for request title backfill');
  }

  /** 이관 대상 DB client. */
  const prisma = new PrismaClient();

  try {
    /** 이관 또는 dry-run 결과. */
    const result = await backfillRequestTitles(prisma, { apply });

    // 기본 실행은 조회만 하며, 실제 변경은 --apply를 명시해야 한다.
    console.log(
      `[request-title-backfill] mode=${apply ? 'apply' : 'dry-run'} scanned=${result.scanned} candidates=${result.candidates} updated=${result.updated}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  /** CLI 실패 원인. */
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[request-title-backfill] failed: ${message}`);
  process.exitCode = 1;
});
