# 10: 폰트 payload 최적화

**What to build:** 전체 weight axis(45-920)를 담은 2MB Pretendard Variable 파일 하나를 로드하는 대신, 실제 쓰는 weight(400/600)만 담은 정적 subset으로 교체하거나 최소한 preload 힌트를 추가해 폰트 로딩 비용을 줄인다.

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-01)

- [x] 400/600 weight 정적 subset 파일을 확보할 수 있으면 가변 폰트를 그 두 파일로 교체하고, 다운로드 용량이 눈에 띄게 줄어든 것을 확인한다.
- [x] subset을 확보할 수 없으면 최소한 `<link rel="preload">`를 critical 폰트 파일에 추가한다. (subset을 확보했으므로 해당 fallback은 적용하지 않음.)
- [x] `font-display: swap`은 유지된다.
- [x] 헤딩(600)과 본문(400) 타이포그래피가 교체 후에도 시각적으로 동일하게 보인다.

## Comments

- `pretendard@1.3.9`가 제공하는 `Pretendard-Regular.subset.woff2`(267,096 bytes)와 `Pretendard-SemiBold.subset.woff2`(268,752 bytes)를 Web 앱의 정적 자산으로 복사하고, `global.css`의 가변 `45 920` face를 400/600 face로 교체했다. 기존 2,057,688 bytes에서 합계 535,848 bytes로 약 74% 줄었다.
- `font-display: swap`과 `Pretendard Variable` family 이름은 유지했다. 앱 소스의 비ASCII glyph 전체가 패키지 subset glyph 목록에 포함되는지 확인했으며, 브라우저에서 두 face의 실제 로드와 subset URL 요청을 확인했다. 동일 패키지의 가변 원본과 대표 헤딩·본문 문구 폭을 비교한 결과 최대 차이는 약 0.014px이었다.
- 검증: `pnpm --filter web run lint`, `pnpm --filter web run test`(88 tests), `pnpm --filter web run build`, `pnpm exec turbo run lint build test --force`(18 tasks) 통과. `pnpm --filter web run test:browser`는 기존 `verifySubtitleNavigationLock`이 자막 in-place 흐름 대신 `/history` 이동을 기다리는 stale 기대치로 실패했으며 이번 변경과 무관하다.
