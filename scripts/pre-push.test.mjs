import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

/** 외부 서비스 없이 실제 훅의 검사 선택을 실행한다. */
function runHook(refs, databaseUrl = '') {
  /** pnpm 실행 기록을 격리할 임시 디렉터리. */
  const directory = mkdtempSync(join(tmpdir(), 'mytube-pre-push-'));
  /** 실행된 검사 목록 파일. */
  const log = join(directory, 'commands');
  try {
    writeFileSync(log, '');
    writeFileSync(join(directory, 'pnpm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOOK_TEST_LOG"\n', { mode: 0o755 });
    /** Git이 전달하는 stdin과 환경으로 실행한 훅 결과. */
    const result = spawnSync('sh', [resolve('.husky/pre-push')], {
      input: refs,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, DATABASE_URL: databaseUrl, HOOK_TEST_LOG: log },
    });
    return { ...result, commands: readFileSync(log, 'utf8') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** 테스트용 Git ref 업데이트 한 줄. */
function refUpdate(local, remote, oid = '1'.repeat(40)) {
  return `${local} ${oid} ${remote} ${'0'.repeat(40)}\n`;
}

/** 모든 푸시가 실행하는 검사 목록. */
const EXPECTED_COMMANDS = 'test\ntest:e2e\n--filter api run test:e2e:media\n--filter chrome-extension run test:browser\n';

test('원격 main도 DB 설정 없이 다른 브랜치와 같은 검사를 실행한다', () => {
  /** 로컬 feature에서 원격 main을 갱신하는 결과. */
  const result = runHook(refUpdate('refs/heads/feature', 'refs/heads/main'));
  assert.equal(result.status, 0);
  assert.equal(result.commands, EXPECTED_COMMANDS);
});

test('DB가 설정돼 있어도 실제 DB 검사는 선택하지 않는다', () => {
  /** DATABASE_URL이 있는 환경에서 main을 갱신하는 결과. */
  const result = runHook(refUpdate('HEAD', 'refs/heads/main'), 'postgresql://test-only');
  assert.equal(result.status, 0);
  assert.equal(result.commands, EXPECTED_COMMANDS);
});

test('다른 원격 브랜치와 여러 ref 푸시도 같은 검사를 실행한다', () => {
  for (const refs of [refUpdate('refs/heads/main', 'refs/heads/feature'), refUpdate('HEAD', 'refs/heads/feature') + refUpdate('HEAD', 'refs/heads/main')]) {
    /** 대상 ref와 무관하게 실행한 결과. */
    const result = runHook(refs);
    assert.equal(result.status, 0);
    assert.equal(result.commands, EXPECTED_COMMANDS);
  }
});
