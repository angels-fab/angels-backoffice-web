/**
 * 데모결과(장비사 데모센터 테스트 결과) — 화면 시안용 샘플 데이터.
 * ※ 아직 저장(Supabase)·입력 폼 전 단계라 상수로 화면부터 확인한다(행사 FAB_EVENTS와 같은 방식).
 *   실제 데이터/업로드는 다음 단계에서 DB(demo_results 테이블 + 저장소)로 옮긴다.
 *
 * 묶음 = 장비 + 제조사(=카드 1장). 여러 번 방문하면 rounds(회차)로 쌓는다(회차 오름차순, 마지막=최신).
 * photos[0] = 대표사진. src가 없으면 화면에선 플레이스홀더로 표시(샘플이라 실제 이미지 없음).
 */

export interface DemoPhoto {
  name: string
  /** 이미지 경로/URL (없으면 플레이스홀더) */
  src?: string
}

export interface DemoFileRef {
  name: string
  /** 파일 경로/URL (없으면 열기 비활성) */
  src?: string
  /** MIME 타입 — 유형별 아이콘 매칭용(공지 첨부와 동일) */
  type?: string
}

export interface DemoMetric {
  label: string
  value: string
}

export interface DemoRound {
  /** 회차 (1,2,3…) */
  round: number
  /** 방문일 'YYYY-MM-DD' */
  date: string
  /** 데모센터/장소 */
  place: string
  /** 테스트 조건(자유 입력) */
  conditions?: string
  /** 핵심 수치(카드엔 앞 3개 표시) */
  metrics: DemoMetric[]
  photos: DemoPhoto[]
  files: DemoFileRef[]
}

export interface DemoResult {
  id: string
  /** 장비(공정) — 예: 건식식각 */
  equipment: string
  /** 제조사 — 예: A사 */
  maker: string
  /** 모델(선택) — 예: X-200 */
  model?: string
  /** 회차들(오름차순, 마지막이 최신) */
  rounds: DemoRound[]
}

const PDF = 'application/pdf'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const ph = (n: string): DemoPhoto => ({ name: n })

export const DEMO_RESULTS: DemoResult[] = [
  {
    id: 'dryetch-a',
    equipment: '건식식각',
    maker: 'A사',
    model: 'X-200',
    rounds: [
      {
        round: 1, date: '2026-06-18', place: '용인 데모센터',
        conditions: '챔버압 20mTorr · RF 700W',
        metrics: [{ label: '식각률', value: '120nm/min' }, { label: '균일도', value: '±1.8%' }, { label: '파티클', value: '3ea' }],
        photos: [ph('웨이퍼 전'), ph('웨이퍼 후'), ph('SEM 단면'), ph('균일도 맵'), ph('장비 전경'), ph('챔버 내부')],
        files: [{ name: '데모결과_1차.pdf', type: PDF }],
      },
      {
        round: 2, date: '2026-07-02', place: '용인 데모센터',
        conditions: '챔버압 18mTorr · RF 750W',
        metrics: [{ label: '식각률', value: '124nm/min' }, { label: '균일도', value: '±1.5%' }, { label: '파티클', value: '2ea' }],
        photos: [ph('웨이퍼 후'), ph('SEM 단면'), ph('균일도 맵'), ph('프로파일'), ph('챔버'), ph('장비'), ph('측정 화면')],
        files: [{ name: '데모결과_2차.pdf', type: PDF }, { name: '측정데이터_2차.xlsx', type: XLSX }],
      },
      {
        round: 3, date: '2026-07-16', place: '용인 데모센터',
        conditions: '챔버압 15mTorr · RF 800W',
        metrics: [{ label: '식각률', value: '128nm/min' }, { label: '균일도', value: '±1.2%' }, { label: '파티클', value: '1ea' }],
        photos: [ph('웨이퍼 후'), ph('SEM 단면'), ph('SEM 평면'), ph('균일도 맵'), ph('프로파일'), ph('CD 측정'), ph('챔버'), ph('장비')],
        files: [{ name: '최종결과_3차.pdf', type: PDF }, { name: '측정데이터_3차.xlsx', type: XLSX }],
      },
    ],
  },
  {
    id: 'pecvd-b',
    equipment: 'PECVD 증착',
    maker: 'B사',
    model: 'P-500',
    rounds: [
      {
        round: 1, date: '2026-06-11', place: '화성 데모센터',
        conditions: '350℃ · SiH4/N2O',
        metrics: [{ label: '막두께', value: '452Å' }, { label: '균일도', value: '±2.3%' }, { label: '증착률', value: '85Å/s' }],
        photos: [ph('웨이퍼'), ph('막두께 맵'), ph('단면 SEM'), ph('장비'), ph('챔버'), ph('레시피 화면')],
        files: [{ name: '증착데모결과.pdf', type: PDF }],
      },
    ],
  },
  {
    id: 'clean-c',
    equipment: '세정',
    maker: 'C사',
    model: 'WS-3',
    rounds: [
      {
        round: 1, date: '2026-05-29', place: '평택 데모센터',
        conditions: 'SC-1 / DIW 린스',
        metrics: [{ label: '파티클 제거율', value: '99.2%' }, { label: '잔류금속', value: '<0.1ppb' }],
        photos: [ph('웨이퍼 전'), ph('웨이퍼 후'), ph('파티클 맵'), ph('장비'), ph('배스')],
        files: [{ name: '세정데모결과.pdf', type: PDF }],
      },
    ],
  },
]
