# FM Validation

DDXX7 FM 엔진을 `dx7-synth-js` 고정 커밋 기준으로 정량 검증하는 파이프라인.

## Scope

- 기준 엔진: `mmontag/dx7-synth-js@f269f0e02fc67b2f824b01a8416339cd5c4829e0`
- 샘플레이트: `44.1kHz`
- 렌더 방식: dry signal, offline rendering (`OfflineAudioContext + AudioWorklet`)
- 케이스 수: `32`
1. 코어 12 케이스
2. 확장 16 케이스
3. 릴리즈 4 케이스

## Entrypoints

- `npm run validate:fm:prepare`
- `npm run validate:fm:render`
- `npm run validate:fm:analyze`
- `npm run validate:fm`

## Output Layout

- 레퍼런스 렌더: `validation/out/ref`
- DDXX7 렌더: `validation/out/test`
- A/B 분석: `validation/out/analysis`
- 정적 감사: `validation/out/audit`
- 최종 리포트: `validation/reports/<timestamp>`

최종 리포트는 아래 3개 파일을 생성한다.

- `summary.md`
- `issues.json`
- `fix_plan.md`

## Severity Rules

- `P0`: `|median_f0_delta_cents| > 15` 또는 NaN/Inf 출력
- `P1`: 아래 중 하나
1. `|centroid_delta_hz| > 250`
2. `|low_decay_t40_delta_seconds| > 0.06`
3. `|ring_ratio_delta| > 0.15`
- `P2`: 분석 스크립트 제안 항목(요약 제외)이 케이스 20% 이상 반복

## Dependencies

- `node`
- `python3`
- `ffmpeg`
- `sox`
- `playwright chromium`
