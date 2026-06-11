import type { Notice } from '@/types'
import noticeCustomsImg from '@/assets/notice-customs.png'

export const NOTICE_CATS = ['전체', '긴급', '공지', '일반', '행사'] as const

export const NOTICES: Notice[] = [
  {
    id: 1,
    cat: '긴급',
    title: '외자 장비 통관 지연 긴급 안내',
    author: '조성범',
    date: '2026-06-03',
    views: 42,
    isNew: true,
    body: (
      <>
        <p>안녕하세요, 장비도입팀 조성범입니다.</p>
        <p>현재 PEALD 및 E-Beam Evaporator 2종의 인천공항 통관이 아래 사유로 지연되고 있어 긴급 안내드립니다.</p>
        <p><strong>지연 사유:</strong> 원산지증명서 서류 보완 요청 (관세청 사전심사 결과)</p>
        <p><strong>예상 해소 시점:</strong> 2026년 6월 10일 (수) 예정</p>
        <img src={noticeCustomsImg} alt="인천공항 통관 현황 캡처" />
        <p className="post-img-caption">▲ 인천공항 통관 현황 캡처 (2026.06.03 기준)</p>
        <p>관련 서류 보완은 통관 대행사를 통해 진행 중이며, 완료 즉시 재공지 드리겠습니다. 문의사항은 조성범(내선 1234)으로 연락 바랍니다.</p>
      </>
    ),
  },
  {
    id: 2,
    cat: '공지',
    title: '2026 하반기 FAB 장비 도입 일정 변경 안내',
    author: '박세리',
    date: '2026-06-01',
    views: 87,
    isNew: true,
    body: (
      <>
        <p>안녕하세요. 하반기 FAB 장비 도입 일정이 아래와 같이 일부 변경되었습니다.</p>
        <p><strong>변경 배경:</strong> 설계 변경에 따른 클린룸 공사 일정 조정으로 인해 장비 설치 시기가 전반적으로 2~4주 지연됩니다.</p>
        <img src={noticeCustomsImg} alt="장비별 변경 일정 요약표" />
        <p className="post-img-caption">▲ 장비별 변경 일정 요약표</p>
        <p>세부 일정은 구글시트 '장비현황' 탭에서 실시간 확인하실 수 있습니다. 일정 변경으로 인한 계약 조건 조정이 필요한 경우 담당자에게 개별 연락 바랍니다.</p>
        <hr className="post-divider" />
        <p>문의: 박세리 (내선 2345)</p>
      </>
    ),
  },
  {
    id: 3,
    cat: '일반',
    title: '기술평가 위원회 일정 및 장소 안내',
    author: '박주봉',
    date: '2026-05-28',
    views: 54,
    isNew: false,
    body: (
      <>
        <p>오는 6월 12일(금) 진행되는 기술평가 위원회 일정 및 장소를 안내드립니다.</p>
        <p><strong>일시:</strong> 2026년 6월 12일(금) 오후 2:00 ~ 5:00</p>
        <p><strong>장소:</strong> 본관 3층 대회의실</p>
        <p><strong>평가 대상 장비:</strong> Spin Coater, Hot Plate ×3</p>
        <p><strong>참석 대상:</strong> 기술평가 위원 5명, 장비도입팀 담당자, 입찰 참여사 담당자</p>
        <img src={noticeCustomsImg} alt="본관 3층 대회의실 위치 안내도" />
        <p className="post-img-caption">▲ 본관 3층 대회의실 위치 안내도</p>
        <p>평가 당일 입찰 참여사는 오후 1시 30분까지 발표 자료 제출 및 장비 세팅을 완료해 주시기 바랍니다.</p>
      </>
    ),
  },
  {
    id: 4,
    cat: '행사',
    title: 'FAB 장비 안전교육 실시 안내 (필수 이수)',
    author: '박세리',
    date: '2026-05-25',
    views: 63,
    isNew: false,
    body: (
      <>
        <p>신규 장비 설치에 앞서 전 직원 대상 안전교육을 아래와 같이 실시합니다. <strong>필수 이수 교육</strong>이오니 반드시 참석 바랍니다.</p>
        <p>
          <strong>교육 일정</strong>
          <br />1차: 2026년 6월 16일(월) 오전 10:00
          <br />2차: 2026년 6월 17일(화) 오후 2:00
        </p>
        <p><strong>교육 내용:</strong> 클린룸 출입 규정, 장비 취급 주의사항, 비상 대피 요령</p>
        <p><strong>이수 미완료 시:</strong> FAB 구역 출입 제한</p>
        <p>참석 희망 일정은 6월 10일까지 박세리에게 회신 바랍니다.</p>
      </>
    ),
  },
  {
    id: 5,
    cat: '일반',
    title: '광주광역시 보조금 신청 결과 안내',
    author: '박세리',
    date: '2026-05-20',
    views: 38,
    isNew: false,
    body: (
      <>
        <p>안녕하세요. 광주광역시 첨단산업 장비 도입 지원 보조금 신청 결과를 안내드립니다.</p>
        <p><strong>신청 금액:</strong> 2,500,000,000원</p>
        <p><strong>승인 금액:</strong> 2,000,000,000원 (신청액의 80%)</p>
        <p>보조금은 7월 중 순차적으로 집행될 예정이며, 장비별 집행 계획은 별도 공지 예정입니다.</p>
        <p>감사합니다.</p>
      </>
    ),
  },
]

// 조회수: 상세 진입 시 세션 내에서만 증가 (원본의 n.views++ 동작 대응)
const extraViews: Record<number, number> = {}
export function addNoticeView(id: number) {
  extraViews[id] = (extraViews[id] || 0) + 1
}
export function noticeViews(n: Notice): number {
  return n.views + (extraViews[n.id] || 0)
}
