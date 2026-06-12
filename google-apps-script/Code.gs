/**
 * ANGELS FAB 통합 업무관리 — 구글시트 API (읽기 + 공지 새 글쓰기)
 *
 * - 읽기(doGet): 허용된 시트만 JSON으로 반환 ('담당자' 등 민감 시트는 차단)
 * - 쓰기(doPost): 공지 새 글 추가 — 게시자별 비밀번호 인증
 *   ('담당자' 시트 B열=이름, C열=비밀번호, 4행부터 대조)
 *
 * 배포 방법은 같은 폴더의 README.md 참고.
 */

// ── 설정 ──
// 팹센터 구축총괄시트 ID (시트 URL의 /d/ 와 /edit 사이 문자열)
const SHEET_ID = '1lnS34m1cQ2mY6W6cBi7kOjDNtNaXtDSg3VRqgFWmUjU';
// 읽기 허용 시트 — 이 목록 밖의 시트('담당자' 등)는 절대 노출하지 않음
const READABLE_SHEETS = ['공지사항', '센터 업무 현황', '장비운영관리', '장비도입관리'];
// 업무일정에 보여줄 구글캘린더 (이 스크립트 소유 계정과 공유돼 있어야 함)
const CALENDAR_ID = 'gist.angels@gmail.com';

// ── 읽기: ?sheet=시트이름 → 해당 시트 전체를 JSON으로 ──
//        ?authors=1 → 담당자 이름 목록만 (비밀번호 제외, 글쓰기 폼 버튼용)
//        ?calendar=1 → 구글캘린더 일정 (3개월 전 ~ 6개월 후)
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (String(p.calendar || '') === '1') return calendarEvents_();
    if (String(p.authors || '') === '1') {
      const dsh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('담당자');
      if (!dsh) return json_({ status: 'error', message: "'담당자' 시트가 없습니다" });
      const dv = dsh.getDataRange().getValues();
      const authors = [];
      for (let i = 3; i < dv.length; i++) { // 4행(B4)부터
        const nm = String(dv[i][1] || '').trim(); // B열만 — 비밀번호(C열)는 절대 내보내지 않음
        if (nm) authors.push(nm);
      }
      return json_({ status: 'ok', authors: authors });
    }
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
  const name = String(p.sheet || '').trim();
  try {
    if (READABLE_SHEETS.indexOf(name) < 0) {
      return json_({ status: 'error', message: '읽기가 허용되지 않은 시트: ' + name });
    }
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
    if (!sh) return json_({ status: 'error', message: '시트 없음: ' + name });
    // 일부 시트(장비타임라인)에서 getValues가 "Unexpected error ... on object Range"로
    // 실패하는 경우가 있어 표시값 읽기로 폴백 (프런트는 어차피 문자열로만 사용)
    let data;
    try {
      data = sh.getDataRange().getValues();
    } catch (e) {
      data = sh.getDataRange().getDisplayValues();
    }
    return json_({ status: 'ok', sheet: name, data: data });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

// ── 쓰기: POST {action:'addNotice', author:'게시자', key:'비밀번호', ...} ──
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'addNotice') {
      // 동시 쓰기 잠금 — 두 명이 동시에 등록해도 연번이 겹치지 않게 한 번에 한 명씩 처리
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        return json_({ status: 'error', message: '저장 요청이 몰려 있습니다. 잠시 후 다시 시도해주세요' });
      }
      try {
        return addNotice_(req);
      } finally {
        lock.releaseLock();
      }
    }
    return json_({ status: 'error', message: '알 수 없는 action: ' + req.action });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

// 게시자 인증 — '담당자' 시트(B열 이름, C열 비밀번호, 4행부터)와 대조.
// 통과 시 null, 실패 시 에러 메시지 반환.
function authError_(author, key) {
  if (!author) return '게시자(이름)를 입력해주세요';
  if (!key) return '비밀번호를 입력해주세요';
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('담당자');
  if (!sh) return "'담당자' 시트가 없습니다";
  const values = sh.getDataRange().getValues();
  for (let i = 3; i < values.length; i++) { // 4행(B4)부터
    const name = String(values[i][1] || '').trim(); // B열: 담당자 이름
    const pw = String(values[i][2] || '').trim();   // C열: 비밀번호
    if (name && pw && name === author && pw === key) return null;
  }
  return '등록된 게시자가 아니거나 비밀번호가 일치하지 않습니다';
}

// '공지사항' 시트에 새 행 추가 — 열 이름으로 매핑(열 순서가 바뀌어도 동작)
function addNotice_(req) {
  const author = String(req.author || '').trim();
  const authErr = authError_(author, String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });

  if (!String(req.title || '').trim()) return json_({ status: 'error', message: '제목이 비었습니다' });
  if (!String(req.body || '').trim()) return json_({ status: 'error', message: '내용이 비었습니다' });

  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('공지사항');
  if (!sh) return json_({ status: 'error', message: "'공지사항' 시트가 없습니다" });

  const values = sh.getDataRange().getValues();

  // 헤더 행 찾기 ('제목' + '내용' 포함된 행)
  let hIdx = -1;
  for (let i = 0; i < Math.min(values.length, 8); i++) {
    const r = values[i].map(function (c) { return String(c || '').trim(); });
    if (r.indexOf('제목') >= 0 && r.indexOf('내용') >= 0) { hIdx = i; break; }
  }
  if (hIdx < 0) return json_({ status: 'error', message: '헤더(제목/내용)를 찾지 못함' });

  const head = values[hIdx].map(function (c) { return String(c || '').trim(); });
  const col = function (names) {
    for (let k = 0; k < names.length; k++) {
      const i = head.indexOf(names[k]);
      if (i >= 0) return i;
    }
    return -1;
  };

  // 다음 연번 = 기존 최댓값 + 1 (읽기 쪽 noticeSlice와 같은 후보 이름 사용)
  const numCol = col(['연번', '번호', 'No', 'no']);
  let maxNum = 0;
  for (let i = hIdx + 1; i < values.length; i++) {
    const v = Number(numCol >= 0 ? values[i][numCol] : NaN);
    if (!isNaN(v) && v > maxNum) maxNum = v;
  }
  const newNum = maxNum + 1;

  const now = new Date();
  const today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  const nowTime = Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm');
  const row = new Array(head.length).fill('');
  const set = function (names, val) {
    const i = col(names);
    if (i >= 0) row[i] = val;
  };
  set(['연번', '번호'], newNum);
  // B열 상단체크: 폼의 '상단고정' 체크 여부 그대로 (체크박스 true/false)
  set(['상단체크', '상단고정', '고정'], req.pinned === true);
  set(['업무', '구분', '분류'], String(req.cat || '공지'));
  set(['부서', '관련부서'], String(req.dept || ''));
  set(['부서담당자', '담당자'], String(req.deptMgr || ''));
  set(['제목'], String(req.title).trim());
  set(['내용', '본문'], String(req.body));
  set(['관련자료', '첨부', '링크'], String(req.ref || ''));
  // J·K열: 게시 시점의 날짜·시간 자동 기록 (KST)
  set(['작성일자', '게시일', '등록일'], today);
  set(['작성시간', '등록시간'], nowTime);
  set(['종료일자'], String(req.end || ''));
  set(['게시자', '작성자'], author);
  set(['해당자', '대상'], String(req.target || ''));

  sh.appendRow(row);
  // B열 상단체크: 새 행에 체크박스 서식 적용 → 체크(TRUE)/해제(FALSE)가 박스로 표시됨
  const pinCol = col(['상단체크', '상단고정', '고정']);
  if (pinCol >= 0) {
    sh.getRange(sh.getLastRow(), pinCol + 1).insertCheckboxes().setValue(req.pinned === true);
  }
  return json_({ status: 'ok', num: newNum });
}

// ── 캘린더: 공유 캘린더의 일정을 JSON으로 (제목/시작/끝/종일/장소만 — 설명은 내보내지 않음) ──
function calendarEvents_() {
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) {
    return json_({ status: 'error', message: '캘린더를 찾을 수 없습니다 (공유 여부 확인): ' + CALENDAR_ID });
  }
  const now = new Date();
  const from = new Date(now.getTime() - 92 * 24 * 3600 * 1000); // 3개월 전
  const to = new Date(now.getTime() + 187 * 24 * 3600 * 1000);  // 6개월 후
  const data = cal.getEvents(from, to).map(function (ev) {
    return {
      title: ev.getTitle(),
      start: Utilities.formatDate(ev.getStartTime(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm"),
      end: Utilities.formatDate(ev.getEndTime(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm"),
      allDay: ev.isAllDayEvent(),
      loc: ev.getLocation() || '',
    };
  });
  return json_({ status: 'ok', data: data });
}

// 캘린더 권한 승인용 — 편집기에서 이 함수를 한 번 실행해 권한을 허용하면 됨
function authorizeCalendar() {
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  Logger.log(cal ? '연결 성공: ' + cal.getName() : '캘린더를 찾을 수 없음 — 공유 여부를 확인하세요');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
