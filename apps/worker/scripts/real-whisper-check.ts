/**
 * whisper.cpp 파이프라인(ffmpeg로 뽑은 오디오 → whisper-cli → SRT 파싱)이 실제로
 * 동작하는지 확인하는 opt-in 실통합 스크립트.
 *
 * 자동 실행(pre-push/CI)에는 연결돼 있지 않다 — 자막 코드를 건드릴 때 수동으로 실행한다.
 * whisper.cpp가 없는 개발자도 있어서 자동 파이프라인에는 넣지 않기로 했다.
 *
 * 사용법:
 *   WHISPER_CLI_PATH=/path/to/whisper-cli \
 *   WHISPER_MODEL_TINY_EN_PATH=/path/to/ggml-tiny.en.bin \
 *   pnpm --filter worker run test:whisper:real
 *
 * whisper.cpp 준비(README.md의 base_en/small_en 안내와 같은 흐름, tiny.en만 다름):
 *   git clone https://github.com/ggml-org/whisper.cpp
 *   cd whisper.cpp && cmake -B build && cmake --build build --config Release
 *   ./models/download-ggml-model.sh tiny.en
 *
 * 프로덕션이 실제 쓰는 base_en/small_en이 아니라 tiny.en(약 74MB)을 쓴다 — 이 스크립트의
 * 목적이 "정확한 트랜스크립션 검증"이 아니라 "배관이 실제로 도는가" 확인이기 때문이다.
 * 모델별 env 매핑(createWhisperModelEnvName)은 이미 유닛 테스트로 따로 검증돼 있다.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  appendProcessOutputTail,
  createWhisperCliArgs,
  createWhisperSrtOutputPath,
  DEFAULT_WHISPER_LANGUAGE,
  normalizeWhisperSrt,
  readWhisperFileEnv,
} from '../src/worker.logic';

/** 진단 출력을 무제한으로 쌓지 않기 위한 tail 길이 — main.ts의 동일 상수와 값만 맞춘 로컬 상수. */
const CHILD_PROCESS_LOG_TAIL_CHARACTERS = 12_000;

/** 합성 음성 fixture 경로 (macOS `say`로 생성 — YouTube 등 저작권 있는 소스를 재사용하지 않는다). */
const FIXTURE_AUDIO_PATH = resolve(__dirname, 'fixtures/sample-speech.wav');

/** fixture 문구("Testing one two three, this is a whisper pipeline check.")에서 뽑은 참고용 키워드. */
const EXPECTED_KEYWORDS = [
  'test',
  'whisper',
  'pipeline',
  'check',
  'one',
  'two',
  'three',
];

main().catch((error) => {
  console.error(
    `[real-whisper-check] FAIL — ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});

/** whisper.cpp 환경을 확인하고 fixture 음성을 실제로 트랜스크립션해본다. */
async function main() {
  console.log('[real-whisper-check] whisper.cpp 환경 변수 확인 중...');

  // 둘 중 하나라도 없거나 파일이 없으면 여기서 명확한 메시지로 throw된다(worker 본편과 동일한 검증 함수 재사용).
  const cliPath = readWhisperFileEnv('WHISPER_CLI_PATH');
  const modelPath = readWhisperFileEnv('WHISPER_MODEL_TINY_EN_PATH');

  if (!existsSync(FIXTURE_AUDIO_PATH)) {
    throw new Error(`fixture audio가 없습니다: ${FIXTURE_AUDIO_PATH}`);
  }

  /** whisper.cpp 출력 기준 경로(확장자 제외). */
  const outputBasePath = resolve(__dirname, 'fixtures/.sample-speech-output');
  /** whisper.cpp가 만들 SRT 경로. */
  const srtPath = createWhisperSrtOutputPath(outputBasePath);
  /** 실제 worker가 쓰는 것과 동일한 CLI 인자 빌더. */
  const args = createWhisperCliArgs({
    audioPath: FIXTURE_AUDIO_PATH,
    language: DEFAULT_WHISPER_LANGUAGE,
    modelPath,
    outputBasePath,
  });

  console.log(`[real-whisper-check] 실행: ${cliPath} ${args.join(' ')}`);
  await runCommand(cliPath, args);

  if (!existsSync(srtPath)) {
    throw new Error('whisper.cpp가 SRT 파일을 만들지 않았습니다');
  }

  /** whisper.cpp가 만든 원본 SRT. */
  const rawSrt = await readFile(srtPath, 'utf8');
  /** 비어있으면 여기서 throw하는 기존 정규화 함수. */
  const normalizedSrt = normalizeWhisperSrt(rawSrt);

  console.log(`[real-whisper-check] 생성된 SRT:\n${normalizedSrt}`);

  /** tiny 모델 인식 결과에서 찾은 참고용 키워드 — 못 찾아도 실패로 보지 않는다. */
  const matchedKeyword = EXPECTED_KEYWORDS.find((keyword) =>
    normalizedSrt.toLowerCase().includes(keyword),
  );

  if (matchedKeyword) {
    console.log(
      `[real-whisper-check] 참고: 예상 키워드 "${matchedKeyword}" 확인됨(tiny 모델이라 정확도는 참고용).`,
    );
  } else {
    console.warn(
      '[real-whisper-check] 참고: 예상 키워드가 안 보입니다(tiny 모델 정확도 한계일 수 있음, 실패로 보지 않음).',
    );
  }

  console.log(
    '[real-whisper-check] PASS — whisper-cli가 실제로 실행돼 비어있지 않은 SRT를 만들었습니다.',
  );
}

/** 장시간 실행되는 CLI 출력을 스트리밍하며 실행한다 (worker main.ts의 runCommand와 동일 패턴). */
async function runCommand(command: string, args: string[]) {
  /** 실행할 whisper-cli child process. */
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  /** 실패 원인 확인용 stdout/stderr tail. */
  let outputTail = '';

  child.stdout.on('data', (chunk: Buffer) => {
    process.stdout.write(chunk);
    outputTail = appendProcessOutputTail(
      outputTail,
      chunk.toString('utf8'),
      CHILD_PROCESS_LOG_TAIL_CHARACTERS,
    );
  });
  child.stderr.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
    outputTail = appendProcessOutputTail(
      outputTail,
      chunk.toString('utf8'),
      CHILD_PROCESS_LOG_TAIL_CHARACTERS,
    );
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `${command} exited with ${
            signal ? `signal ${signal}` : `code ${code}`
          }${outputTail ? `\n${outputTail}` : ''}`,
        ),
      );
    });
  });
}
