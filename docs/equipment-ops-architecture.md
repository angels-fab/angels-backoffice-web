# 장비운영관리 (EquipmentOps) 아키텍처

> 작성: 2026-06-15 · 짝 문서: `docs/equipment-page-architecture.md`(장비도입관리)

## 한 줄 성격
**읽기 전용 "총괄 현황" 뷰.** 장비도입관리(타임라인+CRUD, STEP14~18)와 달리, 운영관리는 전체 자산을 **조회·집계만** 한다. 두 페이지는 **별도 시트**를 쓰지만 **같은 `eqSlice`** 상태를 공유한다.

## 데이터 흐름
```
구글시트 '장비운영관리' (2단 헤더: 그룹행 + 세부행)
        ↓  doGet(?sheet=장비운영관리)  [google-apps-script/Code.gs]
Apps Script → JSON 행배열  (src/api/sheets.ts: fetchSheet, SHEET_NAME_EQ)
        ↓  eqSlice.loadEqData (createAsyncThunk)  [src/store/slices/eqSlice.ts]
헤더명 기반 매핑(열 순서 비의존, 2단 헤더 병합)
   ├─ raw: EqRawItem[]     시트 1행 = 장비 1대
   └─ groups: EqGroup[]    장비명(baseName) 기준 그룹 — 변형 '(n)' 병합·금액 합산·codes/count
        ↓
Redux eq 상태 { raw, groups, months, schedule, ready, loading, error, updatedAt }
   (운영관리 · 도입관리 · 홈 미리보기 공유)
        ↓
EquipmentOps 페이지 (src/pages/EquipmentOps/index.tsx) — 전부 useMemo 파생, 저장 없음
```

## 상태 분류 (단일 기준)
- `EqStateKey` = **도입예정 / 도입중 / 가동중 / 비가동**.
- `eqStateKey(state)`(eqMeta) · `selectEqCounts`(store/selectors) · `EQ_STATE`(라벨·색) 가 **동일 규칙** 사용.
- 표시 라벨: 가동중→"운영중", 도입중→"설치중". 색은 StatusChip status가 테마에서 매핑.
- **대수(raw 행 수) vs 종(장비명 그룹 수)** 이중 집계 — `selectEqCounts`가 `units`(대) + `typesBy`(종) 동시 계산.

## 데이터 모델 (src/types/index.ts)
- `EqRawItem` (시트 1행): num/code/name/cat/use/type/bid/fund/mgr/state/price/installLoc/maker/model/note/assetNo/nfec/installDate/vendor/contact/timeline …
- `EqGroup` (장비명 그룹): name/cat/type/mgr/codes[]/prices[]/price/count/state/installLoc/note/variants[]/hasVariant/timeline.
- `EqCounts`: { total, types, units[EqStateKey], typesBy[EqStateKey] }.

## 페이지 구성 (index.tsx) — 모두 raw/groups에서 파생
- ① **KPI** StatTile×5: 총/운영중/설치중/도입예정/비가동 (대수 + 종) ← `selectEqCounts`
- ② **카테고리 현황**: 분류별 대수·도입예산·상태 칩 ← `raw` 집계(useMemo `categories`)
- ③ **담당자별 현황**: 담당자별 대수·상태 ← `raw` 집계(useMemo `managers`)
- ④ **예산 현황**: 총/지방비/국비(천원) ← `raw.price` 합(useMemo `budget`)
- ⑤ **전체 장비 목록**: `groups` → `EqCard`, 상태탭 + 카테고리 필터 + 검색(useMemo `listed`) → 클릭 시 `EqDetailDrawer`
- 통합검색 딥링크 `/equipment-ops?focus=<장비명>` → 해당 그룹 Drawer 자동 오픈.

## 구성 파일
- `src/pages/EquipmentOps/index.tsx` — 페이지(섹션 ①~⑤)
- `src/pages/EquipmentOps/eqMeta.ts` — `EQ_STATE`(라벨·색), `eqStateKey()`
- `src/pages/EquipmentOps/EqDetailDrawer.tsx` — 그룹 상세(관리번호/종류/금액/담당자/설치위치/비고)
- `src/store/slices/eqSlice.ts` — 로드·파싱(raw/groups), `selectEqCounts`(store/selectors.ts)

## 고도화 후보 (다음 단계 시)
- 현재 **조회 전용** → 도입관리의 CRUD 패턴(관리자 인증 + `updateXxx` + LockService + 재fetch) 재사용해 **상태 변경/편집** 추가.
- 상태 이력·점검(정비) 일정, 자산 라벨/QR, NAS 문서 연동 등.
