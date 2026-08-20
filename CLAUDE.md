# mytube-extract

## Agent skills

### Issue tracker

이슈와 spec은 `.scratch/<feature-slug>/` 아래 마크다운 파일로 관리한다. 자세한 내용은 `docs/agents/issue-tracker.md` 참고.

### Triage labels

기본 5개 canonical label(`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`)을 그대로 사용한다. 자세한 내용은 `docs/agents/triage-labels.md` 참고.

### Domain docs

멀티 컨텍스트 구조 — 루트 `CONTEXT-MAP.md`가 `apps/*`, `packages/*` 각 context의 `CONTEXT.md`를 가리킨다. 자세한 내용은 `docs/agents/domain.md` 참고.
