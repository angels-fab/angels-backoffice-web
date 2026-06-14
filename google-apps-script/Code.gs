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
      const m = findManagerCols_(); // 헤더 자동 인식 — 이름 열만 사용(비밀번호는 절대 내보내지 않음)
      if (!m) return json_({ status: 'error', message: "'담당자' 시트가 없습니다" });
      const authors = [];
      for (let i = m.hIdx + 1; i < m.values.length; i++) {
        const nm = m.cName >= 0 ? String(m.values[i][m.cName] || '').trim() : '';
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
    // 관리자 모드(내부 UI 게이트) — '담당자' 시트 사번+비밀번호 검증. 비밀번호는 노출하지 않음.
    // 성공 시 담당자 이름을 함께 반환(공지 작성 게시자명 자동 사용).
    if (req.action === 'verifyAdmin') {
      const name = loginByEmp_(String(req.empNo || '').trim(), String(req.key || '').trim());
      return json_({ status: 'ok', valid: !!name, name: name || '' });
    }
    if (req.action === 'addCalEvent') return addCalEvent_(req);
    if (req.action === 'updateCalEvent') return updateCalEvent_(req);
    if (req.action === 'deleteCalEvent') return deleteCalEvent_(req);
    return json_({ status: 'error', message: '알 수 없는 action: ' + req.action });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

// '담당자' 시트의 열 위치를 헤더명으로 자동 인식 (열을 옮겨도 동작).
// 반환: { values, hIdx, cName, cEmp, cPw } 또는 null
function findManagerCols_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('담당자');
  if (!sh) return null;
  const values = sh.getDataRange().getValues();
  const NAME = ['이름', '성명', '담당자', '담당자명'];
  const EMP = ['사번', '사원번호', '직원번호'];
  const PW = ['비밀번호', '패스워드', 'password', 'pw'];
  for (let i = 0; i < Math.min(values.length, 8); i++) {
    let cName = -1, cEmp = -1, cPw = -1;
    for (let j = 0; j < values[i].length; j++) {
      const v = String(values[i][j] || '').trim();
      const lv = v.toLowerCase();
      if (cName < 0 && NAME.indexOf(v) >= 0) cName = j;
      if (cEmp < 0 && EMP.indexOf(v) >= 0) cEmp = j;
      if (cPw < 0 && (PW.indexOf(v) >= 0 || PW.indexOf(lv) >= 0)) cPw = j;
    }
    if (cEmp >= 0 && cPw >= 0) return { values: values, hIdx: i, cName: cName, cEmp: cEmp, cPw: cPw };
  }
  return null;
}

// 사번+비밀번호 → 담당자 이름 (일치 없으면 null). 관리자 로그인용.
function loginByEmp_(empNo, pw) {
  if (!empNo || !pw) return null;
  const m = findManagerCols_();
  if (!m) return null;
  for (let i = m.hIdx + 1; i < m.values.length; i++) {
    const e = String(m.values[i][m.cEmp] || '').trim();
    const p = String(m.values[i][m.cPw] || '').trim();
    if (e && p && e === String(empNo).trim() && p === String(pw).trim()) {
      return m.cName >= 0 ? String(m.values[i][m.cName] || '').trim() : e;
    }
  }
  return null;
}

// 게시자 인증 — '담당자' 시트 이름+비밀번호(헤더 자동 인식)와 대조.
// 통과 시 null, 실패 시 에러 메시지 반환.
function authError_(author, key) {
  if (!author) return '게시자(이름)를 입력해주세요';
  if (!key) return '비밀번호를 입력해주세요';
  const m = findManagerCols_();
  if (!m) return "'담당자' 시트를 읽을 수 없습니다";
  if (m.cName < 0) return "'담당자' 시트에 이름 열이 없습니다";
  for (let i = m.hIdx + 1; i < m.values.length; i++) {
    const name = String(m.values[i][m.cName] || '').trim();
    const pw = String(m.values[i][m.cPw] || '').trim();
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
      id: ev.getId(),
      title: ev.getTitle(),
      start: Utilities.formatDate(ev.getStartTime(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm"),
      end: Utilities.formatDate(ev.getEndTime(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm"),
      allDay: ev.isAllDayEvent(),
      loc: ev.getLocation() || '',
      recurring: ev.isRecurringEvent(),
    };
  });
  return json_({ status: 'ok', data: data });
}

// ── 캘린더 쓰기 공통 ──
const CAL_DAY_MS = 24 * 3600 * 1000;

// 'yyyy-MM-ddTHH:mm' → KST Date (appsscript.json timeZone=Asia/Seoul 기준)
function parseDateTime_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0);
}
// 'yyyy-MM-dd' → 자정 Date
function parseDate_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// 인증 통과 후 캘린더 핸들을 콜백에 넘김 (실패 시 에러 JSON 반환)
function withCalAuth_(req, fn) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) return json_({ status: 'error', message: '캘린더를 찾을 수 없습니다 (공유 여부 확인): ' + CALENDAR_ID });
  return fn(cal);
}

// 추가: {title, loc, allDay, start, end} 또는 종일이면 {startDate, endDate?}
function addCalEvent_(req) {
  return withCalAuth_(req, function (cal) {
    const title = String(req.title || '').trim();
    if (!title) return json_({ status: 'error', message: '제목을 입력해주세요' });
    const loc = String(req.loc || '').trim();
    const opts = loc ? { location: loc } : {};
    if (req.allDay === true) {
      const sd = parseDate_(req.startDate);
      if (!sd) return json_({ status: 'error', message: '시작 날짜가 올바르지 않습니다' });
      const ed = parseDate_(req.endDate);
      if (ed && ed.getTime() >= sd.getTime()) {
        // createAllDayEvent의 종료일은 '미포함'이라 +1일
        cal.createAllDayEvent(title, sd, new Date(ed.getTime() + CAL_DAY_MS), opts);
      } else {
        cal.createAllDayEvent(title, sd, opts);
      }
    } else {
      const s = parseDateTime_(req.start);
      const e = parseDateTime_(req.end);
      if (!s || !e) return json_({ status: 'error', message: '시작/종료 시각이 올바르지 않습니다' });
      if (e.getTime() <= s.getTime()) return json_({ status: 'error', message: '종료가 시작보다 빨라요' });
      cal.createEvent(title, s, e, opts);
    }
    return json_({ status: 'ok' });
  });
}

// 수정: {id, scope:'single'|'series', title, loc, allDay, start, end / startDate, endDate}
// 반복 일정의 'series'는 제목·장소만 수정 (시간 변경은 '이 일정만' 또는 캘린더 앱에서)
function updateCalEvent_(req) {
  return withCalAuth_(req, function (cal) {
    const id = String(req.id || '');
    if (!id) return json_({ status: 'error', message: '대상 일정 ID가 없습니다' });
    const title = String(req.title || '').trim();
    if (!title) return json_({ status: 'error', message: '제목을 입력해주세요' });
    const loc = String(req.loc || '').trim();

    if (String(req.scope || 'single') === 'series') {
      const series = cal.getEventSeriesById(id);
      if (!series) return json_({ status: 'error', message: '반복 일정을 찾을 수 없습니다 (이미 변경/삭제됐을 수 있어요)' });
      series.setTitle(title);
      series.setLocation(loc);
      return json_({ status: 'ok', note: '전체 시리즈의 제목·장소를 수정했어요 (시간 변경은 적용 안 됨)' });
    }

    const ev = cal.getEventById(id);
    if (!ev) return json_({ status: 'error', message: '일정을 찾을 수 없습니다 (이미 변경/삭제됐을 수 있어요)' });
    ev.setTitle(title);
    ev.setLocation(loc);
    if (req.allDay === true) {
      const sd = parseDate_(req.startDate);
      if (!sd) return json_({ status: 'error', message: '시작 날짜가 올바르지 않습니다' });
      const ed = parseDate_(req.endDate);
      if (ed && ed.getTime() >= sd.getTime()) {
        ev.setAllDayDates(sd, new Date(ed.getTime() + CAL_DAY_MS));
      } else {
        ev.setAllDayDate(sd);
      }
    } else {
      const s = parseDateTime_(req.start);
      const e = parseDateTime_(req.end);
      if (!s || !e) return json_({ status: 'error', message: '시작/종료 시각이 올바르지 않습니다' });
      if (e.getTime() <= s.getTime()) return json_({ status: 'error', message: '종료가 시작보다 빨라요' });
      ev.setTime(s, e);
    }
    return json_({ status: 'ok' });
  });
}

// 삭제: {id, scope:'single'|'series'}
function deleteCalEvent_(req) {
  return withCalAuth_(req, function (cal) {
    const id = String(req.id || '');
    if (!id) return json_({ status: 'error', message: '대상 일정 ID가 없습니다' });
    if (String(req.scope || 'single') === 'series') {
      const series = cal.getEventSeriesById(id);
      if (!series) return json_({ status: 'error', message: '반복 일정을 찾을 수 없습니다 (이미 삭제됐을 수 있어요)' });
      series.deleteEventSeries();
      return json_({ status: 'ok', note: '전체 시리즈를 삭제했어요' });
    }
    const ev = cal.getEventById(id);
    if (!ev) return json_({ status: 'error', message: '일정을 찾을 수 없습니다 (이미 삭제됐을 수 있어요)' });
    ev.deleteEvent();
    return json_({ status: 'ok' });
  });
}

// 캘린더 쓰기 권한 승인·진단용 — 편집기에서 이 함수를 한 번 실행해 권한을 허용한다.
// 실행 시 새 권한(캘린더 일정 관리) 동의 화면이 뜨고, 승인 후 쓰기 가능 여부를 로그로 확인할 수 있다.
function authorizeCalendar() {
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) {
    Logger.log('캘린더를 찾을 수 없음 — 공유 여부 확인: ' + CALENDAR_ID);
    return;
  }
  Logger.log('읽기 연결 성공: ' + cal.getName());
  try {
    const now = new Date();
    const ev = cal.createEvent('[권한테스트] 자동삭제됨', new Date(now.getTime() + 3600000), new Date(now.getTime() + 7200000));
    ev.deleteEvent();
    Logger.log('쓰기 권한 OK — 테스트 일정 생성 후 삭제 완료. 이제 웹에서 추가/수정/삭제가 동작합니다.');
  } catch (e) {
    Logger.log('쓰기 실패: ' + e);
    Logger.log('→ 이 계정이 캘린더 "' + CALENDAR_ID + '"에 변경 권한이 없을 수 있습니다. ' +
      '구글 캘린더에서 이 캘린더 공유 설정을 "일정 변경 권한"으로 올려주세요.');
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
