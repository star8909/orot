# 오롯 OROT — 동백 워터 크림

동백 봉오리가 피어나며 크림통이 떠오르고, 뚜껑이 열리고, 물방울 속에서 꽃잎 위에 내려앉는 과정을 스크롤 하나로 이어 보여주는 K-뷰티 화장품 랜딩 페이지입니다. 브랜드와 제품은 가상입니다.

- **스틸**: GPT Image 2.5 Flare (Atlas Cloud) — 앞 장면을 참조해 카메라·조명을 고정한 채 피사체만 바꿈
- **영상**: Seedance 2.0 Mini Image-to-Video — 앞 스틸을 첫 프레임, 다음 스틸을 마지막 프레임으로 지정해 클립끼리 끊김 없이 이어짐
- **재생**: 클립을 WebP 프레임으로 변환해 챕터별 스크롤 위치에 맞춰 캔버스에 표시
- **포맷**: 가로(16:9)와 세로(9:16)를 각각 만들고 화면 방향에 맞는 쪽을 재생
- **라인업**: 피부 타입 필터로 맞는 제품을 강조하고, 담기 버튼은 헤더의 장바구니 수를 바꿈 (페이지 안에서만 동작)

## 준비

```bash
npm install
cp .env.example .env   # ATLASCLOUD_API_KEY 입력
```

ffmpeg가 PATH에 있어야 합니다.

## 생성

```bash
npm run generate                 # 실행 계획과 예상 비용만 출력
npm run generate -- --yes        # 실제 생성 (스틸 → 클립 → 프레임)
```

| 옵션 | 설명 |
|---|---|
| `--format landscape,portrait` | 일부 포맷만 생성 |
| `--step image,video,frames` | 특정 단계만 실행 |
| `--force` | 이미 생성된 결과도 다시 생성 |

- 원본은 `generated/{stills,clips}/<format>/`, 제품 이미지는 `generated/extras/`에 캐시되며 이미 있는 파일은 건너뜁니다.

## 구성 변경

| 파일 | 수정 내용 |
|---|---|
| `story.config.mjs` | 공통 화풍(`style`), 포맷별 구도·해상도(`formats`), 스틸(`stills`)과 그 사이 움직임(`clips`), 제품 이미지(`extras`) |
| `index.html` | 챕터 순서·문구, 스크롤 길이(`--length`), 라인업 제품과 맞는 피부 타입(`data-skin`) |

`index.html`의 `data-clip` 값은 `clips`의 id와 일치해야 합니다. `data-clip`이 없는 마지막 챕터는 마지막 프레임을 유지합니다.

## 구조

| 파일 | 역할 |
|---|---|
| `src/main.js` | 클립 수집, 프리로드, 챕터별 재생·문구 전환 |
| `src/film/` | 캔버스 렌더링, 클립별 프레임 로딩, 화면 가까운 장면부터 받는 로더 |
| `src/shop/lineup.js` | 피부 타입 필터, 장바구니 담기 |
| `scripts/generate.mjs` | Atlas Cloud 생성 파이프라인 |
