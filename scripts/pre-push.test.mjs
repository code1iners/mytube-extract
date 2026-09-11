import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

/** 외부 서비스 없이 실제 훅의 ref 판정과 검사 선택을 실행한다. */
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

test('원격 main은 DB 설정이 없으면 검사 실행 전에 실패한다', () => {
  /** 로컬 feature에서 원격 main을 갱신하는 결과. */
  const result = runHook(refUpdate('refs/heads/feature', 'refs/heads/main'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL/);
  assert.equal(result.commands, '');
});

test('DB가 설정된 main은 전체 실제 통합 검사를 선택한다', () => {
  /** 연결 자체는 대역 처리하고 검사 선택만 확인한다. */
  const result = runHook(refUpdate('HEAD', 'refs/heads/main'), 'postgresql://test-only');
  assert.equal(result.status, 0);
  assert.match(result.commands, /run test:e2e:real\n/);
  assert.doesNotMatch(result.commands, /test:e2e:media/);
});

test('로컬 main에서 다른 원격 브랜치로 보내면 DB 없이 기존 검사를 유지한다', () => {
  /** 원격 feature를 갱신하는 결과. */
  const result = runHook(refUpdate('refs/heads/main', 'refs/heads/feature'));
  assert.equal(result.status, 0);
  assert.equal(result.commands, 'test\ntest:e2e\n--filter api run test:e2e:media\n--filter chrome-extension run test:browser\n');
});

test('여러 ref 중 main이 포함되면 DB 설정을 요구한다', () => {
  /** feature와 main을 함께 보내는 결과. */
  const result = runHook(refUpdate('HEAD', 'refs/heads/feature') + refUpdate('HEAD', 'refs/heads/main'));
  assert.equal(result.status, 1);
  assert.equal(result.commands, '');
});

test('main 삭제와 main이라는 태그에는 DB 설정을 요구하지 않는다', () => {
  for (const refs of [refUpdate('(delete)', 'refs/heads/main', '0'.repeat(40)), refUpdate('refs/tags/main', 'refs/tags/main')]) {
    /** 코드 갱신이 아닌 ref를 처리한 결과. */
    const result = runHook(refs);
    assert.equal(result.status, 0);
    assert.match(result.commands, /test:e2e:media/);
  }
});
