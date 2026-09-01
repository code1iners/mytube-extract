# 10: 폰트 payload 최적화

**What to build:** 전체 weight axis(45-920)를 담은 2MB Pretendard Variable 파일 하나를 로드하는 대신, 실제 쓰는 weight(400/600)만 담은 정적 subset으로 교체하거나 최소한 preload 힌트를 추가해 폰트 로딩 비용을 줄인다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 400/600 weight 정적 subset 파일을 확보할 수 있으면 가변 폰트를 그 두 파일로 교체하고, 다운로드 용량이 눈에 띄게 줄어든 것을 확인한다.
- [ ] subset을 확보할 수 없으면 최소한 `<link rel="preload">`를 critical 폰트 파일에 추가한다.
- [ ] `font-display: swap`은 유지된다.
- [ ] 헤딩(600)과 본문(400) 타이포그래피가 교체 후에도 시각적으로 동일하게 보인다.
