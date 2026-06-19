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
    // 센터 업무 현황 읽기 — 헤더명 기준으로 행을 객체로 변환
    if (String(p.action || '') === 'getWorks') return getWorks_();
    // STEP22 — 장비 운영이력 조회(관리번호 필터, 최신 먼저). 시트 없으면 빈 목록.
    if (String(p.action || '') === 'getEqHistory') return getEqHistory_(p);
    // 개선제안 읽기 — '개선사항' 시트(헤더 자동 탐지) → 객체 배열
    if (String(p.action || '') === 'getImprovements') return getImprovements_();
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
    // 공지 쓰기(추가/수정/삭제) — 동시 쓰기 잠금으로 연번 충돌·행 삭제 경합 방지
    if (req.action === 'addNotice' || req.action === 'updateNotice' || req.action === 'deleteNotice') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        return json_({ status: 'error', message: '저장 요청이 몰려 있습니다. 잠시 후 다시 시도해주세요' });
      }
      try {
        if (req.action === 'addNotice') return addNotice_(req);
        if (req.action === 'updateNotice') return updateNotice_(req);
        return deleteNotice_(req);
      } finally {
        lock.releaseLock();
      }
    }
    // 센터 업무 현황 쓰기(추가/수정/삭제) — 잠금 하에 처리(번호 충돌·행삭제 경합 방지)
    if (req.action === 'createWork' || req.action === 'updateWork' || req.action === 'deleteWork') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        return json_({ status: 'error', message: '요청이 몰려 있습니다. 잠시 후 다시 시도해주세요' });
      }
      try {
        if (req.action === 'createWork') return createWork_(req);
        if (req.action === 'updateWork') return updateWork_(req);
        return deleteWork_(req);
      } finally {
        lock.releaseLock();
      }
    }
    // 장비도입관리 쓰기(추가/수정/삭제) — 잠금 하에 처리
    if (req.action === 'createSchedule' || req.action === 'updateSchedule' || req.action === 'deleteSchedule') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        return json_({ status: 'error', message: '요청이 몰려 있습니다. 잠시 후 다시 시도해주세요' });
      }
      try {
        if (req.action === 'createSchedule') return createSchedule_(req);
        if (req.action === 'updateSchedule') return updateSchedule_(req);
        return deleteSchedule_(req);
      } finally {
        lock.releaseLock();
      }
    }
    // 장비운영관리 수정(Update만 — 추가/삭제 없음) — 잠금 하에 처리
    if (req.action === 'updateEquipment') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        return json_({ status: 'error', message: '요청이 몰려 있습니다. 잠시 후 다시 시도해주세요' });
      }
      try {
        return updateEquipment_(req);
      } finally {
        lock.releaseLock();
      }
    }
    // 개선제안 쓰기(등록/상태변경·수정/삭제) — 잠금 하에 처리
    if (req.action === 'createImprovement' || req.action === 'updateImprovement' || req.action === 'deleteImprovement') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        return json_({ status: 'error', message: '요청이 몰려 있습니다. 잠시 후 다시 시도해주세요' });
      }
      try {
        if (req.action === 'createImprovement') return createImprovement_(req);
        if (req.action === 'updateImprovement') return updateImprovement_(req);
        return deleteImprovement_(req);
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
  // J·K열: 게시일(폼에서 지정 가능, 비우면 오늘) + 작성시간(자동, KST)
  set(['작성일자', '게시일', '등록일'], String(req.date || '').trim() || today);
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

// '공지사항' 시트 + 헤더 위치 컨텍스트 (수정/삭제 공용). 실패 시 { error }.
function noticeCtx_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('공지사항');
  if (!sh) return { error: "'공지사항' 시트가 없습니다" };
  const values = sh.getDataRange().getValues();
  let hIdx = -1;
  for (let i = 0; i < Math.min(values.length, 8); i++) {
    const r = values[i].map(function (c) { return String(c || '').trim(); });
    if (r.indexOf('제목') >= 0 && r.indexOf('내용') >= 0) { hIdx = i; break; }
  }
  if (hIdx < 0) return { error: '헤더(제목/내용)를 찾지 못함' };
  const head = values[hIdx].map(function (c) { return String(c || '').trim(); });
  const col = function (names) {
    for (let k = 0; k < names.length; k++) {
      const i = head.indexOf(names[k]);
      if (i >= 0) return i;
    }
    return -1;
  };
  return { sh: sh, values: values, hIdx: hIdx, head: head, col: col };
}

// 연번(num)으로 데이터 행 인덱스(values 기준 0-base) 찾기. 없으면 -1.
function findNoticeRow_(ctx, num) {
  const numCol = ctx.col(['연번', '번호', 'No', 'no']);
  if (numCol < 0) return -2; // 연번 열 자체가 없음
  const target = String(num).trim();
  for (let i = ctx.hIdx + 1; i < ctx.values.length; i++) {
    if (String(ctx.values[i][numCol] || '').trim() === target) return i;
  }
  return -1;
}

// 공지 수정 — 연번으로 행을 찾아 분류·제목·내용·게시일 등 갱신 (게시자는 원본 유지)
function updateNotice_(req) {
  const author = String(req.author || '').trim();
  const authErr = authError_(author, String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });

  const num = String(req.num || '').trim();
  if (!num) return json_({ status: 'error', message: '대상 공지 연번이 없습니다' });
  if (!String(req.title || '').trim()) return json_({ status: 'error', message: '제목이 비었습니다' });
  if (!String(req.body || '').trim()) return json_({ status: 'error', message: '내용이 비었습니다' });

  const ctx = noticeCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const rowIdx = findNoticeRow_(ctx, num);
  if (rowIdx === -2) return json_({ status: 'error', message: '연번 열을 찾지 못함' });
  if (rowIdx < 0) return json_({ status: 'error', message: '대상 공지를 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });

  const sh = ctx.sh;
  const sheetRow = rowIdx + 1; // 1-base 시트 행번호
  const setCell = function (names, val) {
    const c = ctx.col(names);
    if (c >= 0) sh.getRange(sheetRow, c + 1).setValue(val);
  };
  setCell(['업무', '구분', '분류'], String(req.cat || '공지'));
  setCell(['제목'], String(req.title).trim());
  setCell(['내용', '본문'], String(req.body));
  if (req.dept !== undefined) setCell(['부서', '관련부서'], String(req.dept || ''));
  if (req.deptMgr !== undefined) setCell(['부서담당자', '담당자'], String(req.deptMgr || ''));
  if (req.target !== undefined) setCell(['해당자', '대상'], String(req.target || ''));
  if (req.end !== undefined) setCell(['종료일자'], String(req.end || ''));
  if (req.ref !== undefined) setCell(['관련자료', '첨부', '링크'], String(req.ref || ''));
  // 게시일(작성일자) — 값이 있을 때만 갱신
  if (String(req.date || '').trim()) setCell(['작성일자', '게시일', '등록일'], String(req.date).trim());
  // 상단고정(중요) — 체크박스 유지
  const pinCol = ctx.col(['상단체크', '상단고정', '고정']);
  if (pinCol >= 0 && req.pinned !== undefined) {
    sh.getRange(sheetRow, pinCol + 1).insertCheckboxes().setValue(req.pinned === true);
  }
  return json_({ status: 'ok', num: Number(num) || num });
}

// 공지 삭제 — 연번으로 행을 찾아 시트에서 행 자체를 삭제
function deleteNotice_(req) {
  const author = String(req.author || '').trim();
  const authErr = authError_(author, String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });

  const num = String(req.num || '').trim();
  if (!num) return json_({ status: 'error', message: '대상 공지 연번이 없습니다' });

  const ctx = noticeCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const rowIdx = findNoticeRow_(ctx, num);
  if (rowIdx === -2) return json_({ status: 'error', message: '연번 열을 찾지 못함' });
  if (rowIdx < 0) return json_({ status: 'error', message: '대상 공지를 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });

  ctx.sh.deleteRow(rowIdx + 1);
  return json_({ status: 'ok' });
}

// ── 센터 업무 현황 CRUD (헤더명 기준, 열 위치 비의존) ──
const WORK_SHEET_NAME = '센터 업무 현황';

// 시트 + 헤더 위치 컨텍스트. 모든 열을 헤더명(동의어)으로 인식. 실패 시 { error }.
function workCtx_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(WORK_SHEET_NAME);
  if (!sh) return { error: "'센터 업무 현황' 시트가 없습니다" };
  const values = sh.getDataRange().getValues();
  let hIdx = -1;
  for (let i = 0; i < Math.min(values.length, 8); i++) {
    const r = values[i].map(function (c) { return String(c || '').trim(); });
    if (r.indexOf('구분') >= 0 && r.indexOf('업무') >= 0) { hIdx = i; break; }
  }
  if (hIdx < 0) return { error: '헤더(구분/업무)를 찾지 못함' };
  const head = values[hIdx].map(function (c) { return String(c || '').trim(); });
  const col = function (names) {
    for (let k = 0; k < names.length; k++) { const i = head.indexOf(names[k]); if (i >= 0) return i; }
    return -1;
  };
  const C = {
    num: col(['번호', '연번', 'No']),
    cat: col(['구분', '분류']),
    task: col(['업무', '업무명', '제목']),
    dept: col(['관련부서', '부서']),
    mat: col(['관련자료', '자료']),
    start: col(['발의일자', '시작일자', '발의', '등록일자']),
    plan: col(['예정일', '예정일자', '일정']),
    time: col(['시간']),
    loc: col(['장소']),
    mgr: col(['담당자']),
    status: col(['상태', '진행상태', '업무상태']),
    end: col(['완료일자', '완료일']),
    remind: col(['Remind', 'remind', '리마인드']),
    chief: col(['검토 필요', '검토필요', '센터장 검토', '센터장검토', '센터장 Check', '센터장', 'Check', 'check']),
    link: col(['링크', '관련링크', 'link']),
  };
  return { sh: sh, values: values, hIdx: hIdx, head: head, col: col, C: C };
}

function wIsChk_(v) {
  if (v === true) return true;
  const s = String(v == null ? '' : v).trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'Y' || s === '예' || s === 'O' || s === '✓';
}
function wDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  return v == null ? '' : String(v).trim();
}
function wTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'HH:mm');
  return v == null ? '' : String(v).trim();
}

// 읽기: 헤더명 기준으로 각 행을 객체로 변환
function getWorks_() {
  const ctx = workCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const values = ctx.values, C = ctx.C, hIdx = ctx.hIdx;
  const t = function (r, i) { return i < 0 ? '' : (r[i] == null ? '' : String(r[i]).trim()); };
  const items = [];
  for (let i = hIdx + 1; i < values.length; i++) {
    const r = values[i];
    if (t(r, C.task) === '') continue;
    items.push({
      num: t(r, C.num), cat: t(r, C.cat), task: t(r, C.task), dept: t(r, C.dept), mat: t(r, C.mat),
      start: wDate_(r[C.start]), plan: wDate_(r[C.plan]), time: wTime_(r[C.time]),
      loc: t(r, C.loc), mgr: t(r, C.mgr), status: t(r, C.status), end: wDate_(r[C.end]),
      link: t(r, C.link), remind: wIsChk_(r[C.remind]), chief: wIsChk_(r[C.chief]),
    });
  }
  return json_({ status: 'ok', items: items });
}

// 완료일자 자동 규칙: 상태 '완료'면 채우고(미지정 시 오늘), 그 외 상태면 비움
function workEndAuto_(status, endGiven, today) {
  if (status === '완료') return endGiven ? endGiven : today;
  return '';
}

function createWork_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  if (!String(req.task || '').trim()) return json_({ status: 'error', message: '업무 내용이 비었습니다' });

  const ctx = workCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, hIdx = ctx.hIdx, head = ctx.head, C = ctx.C;

  let maxNum = 0;
  if (C.num >= 0) for (let i = hIdx + 1; i < values.length; i++) {
    const v = Number(values[i][C.num]); if (!isNaN(v) && v > maxNum) maxNum = v;
  }
  const newNum = maxNum + 1;
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const status = String(req.status || '진행중').trim();
  const endVal = workEndAuto_(status, String(req.end || '').trim(), today);
  // 완료되면 '검토 필요'는 자동 해제
  const chiefVal = status === '완료' ? false : (req.chief === true);

  const row = new Array(head.length).fill('');
  const set = function (i, v) { if (i >= 0) row[i] = v; };
  set(C.num, newNum);
  set(C.cat, String(req.cat || ''));
  set(C.task, String(req.task).trim());
  set(C.dept, String(req.dept || ''));
  set(C.mat, String(req.mat || ''));
  set(C.start, String(req.start || ''));
  set(C.plan, String(req.plan || ''));
  set(C.time, String(req.time || ''));
  set(C.loc, String(req.loc || ''));
  set(C.mgr, String(req.mgr || ''));
  set(C.status, status);
  set(C.end, endVal);
  set(C.link, String(req.link || ''));
  set(C.remind, req.remind === true);
  set(C.chief, chiefVal);
  sh.appendRow(row);
  const last = sh.getLastRow();
  if (C.remind >= 0) sh.getRange(last, C.remind + 1).insertCheckboxes().setValue(req.remind === true);
  if (C.chief >= 0) sh.getRange(last, C.chief + 1).insertCheckboxes().setValue(chiefVal);
  return json_({ status: 'ok', num: newNum });
}

function updateWork_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  const num = String(req.num || '').trim();
  if (!num) return json_({ status: 'error', message: '대상 업무 번호가 없습니다' });
  if (!String(req.task || '').trim()) return json_({ status: 'error', message: '업무 내용이 비었습니다' });

  const ctx = workCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, hIdx = ctx.hIdx, C = ctx.C;
  if (C.num < 0) return json_({ status: 'error', message: '번호 열을 찾지 못함' });
  let rowIdx = -1;
  for (let i = hIdx + 1; i < values.length; i++) {
    if (String(values[i][C.num] || '').trim() === num) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return json_({ status: 'error', message: '대상 업무를 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });

  const sheetRow = rowIdx + 1;
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const status = String(req.status || '진행중').trim();
  const endGiven = req.end !== undefined ? String(req.end || '').trim() : wDate_(values[rowIdx][C.end]);
  const endVal = workEndAuto_(status, endGiven, today);
  // 완료되면 '검토 필요'는 자동 해제
  const chiefVal = status === '완료' ? false : (req.chief === true);

  const set = function (i, v) { if (i >= 0) sh.getRange(sheetRow, i + 1).setValue(v); };
  set(C.cat, String(req.cat || ''));
  set(C.task, String(req.task).trim());
  set(C.dept, String(req.dept || ''));
  set(C.mat, String(req.mat || ''));
  set(C.start, String(req.start || ''));
  set(C.plan, String(req.plan || ''));
  set(C.time, String(req.time || ''));
  set(C.loc, String(req.loc || ''));
  set(C.mgr, String(req.mgr || ''));
  set(C.status, status);
  set(C.end, endVal);
  set(C.link, String(req.link || ''));
  if (C.remind >= 0) sh.getRange(sheetRow, C.remind + 1).insertCheckboxes().setValue(req.remind === true);
  if (C.chief >= 0) sh.getRange(sheetRow, C.chief + 1).insertCheckboxes().setValue(chiefVal);
  return json_({ status: 'ok', num: Number(num) || num });
}

function deleteWork_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  const num = String(req.num || '').trim();
  if (!num) return json_({ status: 'error', message: '대상 업무 번호가 없습니다' });
  const ctx = workCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const values = ctx.values, hIdx = ctx.hIdx, C = ctx.C;
  if (C.num < 0) return json_({ status: 'error', message: '번호 열을 찾지 못함' });
  let rowIdx = -1;
  for (let i = hIdx + 1; i < values.length; i++) {
    if (String(values[i][C.num] || '').trim() === num) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return json_({ status: 'error', message: '대상 업무를 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });
  ctx.sh.deleteRow(rowIdx + 1);
  return json_({ status: 'ok' });
}

// 시트에서 '상태'를 바꾸면 웹과 동일 규칙을 적용 (설치형 onEdit 핸들러):
//  - 완료  → 같은 행 '검토 필요' 해제 + '완료일자'에 오늘 날짜(비어있을 때만)
//  - 완료 아님 → '완료일자' 비움 (완료일자는 완료일 때만 유효)
// 독립형 스크립트라 단순 onEdit는 동작하지 않으므로 setupWorkEditTrigger()를 1회 실행해 설치한다.
function onWorkStatusEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== WORK_SHEET_NAME) return;
    const ctx = workCtx_();
    if (ctx.error) return;
    const C = ctx.C, hIdx = ctx.hIdx;
    if (C.status < 0) return;
    const col0 = e.range.getColumn() - 1;
    const row0 = e.range.getRow() - 1;
    if (col0 !== C.status || row0 <= hIdx) return; // 상태 열의 데이터 행만
    const sheetRow = e.range.getRow();
    const v = String(e.value != null ? e.value : e.range.getValue()).trim();
    if (v === '완료') {
      if (C.chief >= 0) sh.getRange(sheetRow, C.chief + 1).setValue(false); // 검토 필요 해제
      if (C.end >= 0) {
        const endCell = sh.getRange(sheetRow, C.end + 1);
        const cur = endCell.getValue();
        if (cur === '' || cur == null) {
          endCell.setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd')); // 완료일자 = 오늘
        }
      }
    } else if (C.end >= 0) {
      sh.getRange(sheetRow, C.end + 1).setValue(''); // 완료 아님 → 완료일자 비움
    }
  } catch (err) {
    // 편집 흐름을 방해하지 않도록 조용히 무시
  }
}

// ⚙️ 1회 실행(편집기에서 직접 Run): 위 onWorkStatusEdit를 '센터 업무 현황' 시트의 편집 트리거로 설치.
// 실행 시 권한 동의 화면이 뜨며, 승인 후부터 시트에서 상태를 완료로 바꾸면 검토 필요가 자동 해제됨.
function setupWorkEditTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onWorkStatusEdit') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('onWorkStatusEdit').forSpreadsheet(SHEET_ID).onEdit().create();
  Logger.log('설치 완료 — 시트에서 상태=완료 시 검토 필요 자동 해제 (센터 업무 현황)');
}

// ── 개선제안 CRUD ('개선사항' 시트, 헤더 자동 탐지·열 위치 비의존) ──
const IMPROVE_SHEET_NAME = '개선사항';
const IMPROVE_STATUS_DEFAULT = '접수';

// 시트 + 헤더 위치 컨텍스트. 헤더는 보통 3행이지만 첫 10행에서 '제목'을 기준으로 자동 탐지.
function improveCtx_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(IMPROVE_SHEET_NAME);
  if (!sh) return { error: "'개선사항' 시트가 없습니다" };
  const values = sh.getDataRange().getValues();
  let hIdx = -1;
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const r = values[i].map(function (c) { return String(c == null ? '' : c).trim(); });
    if (r.indexOf('제목') >= 0 && (r.indexOf('개선내용') >= 0 || r.indexOf('유형') >= 0 || r.indexOf('상태') >= 0)) { hIdx = i; break; }
  }
  if (hIdx < 0) return { error: "'개선사항' 시트 헤더(제목 등)를 찾지 못함" };
  const head = values[hIdx].map(function (c) { return String(c == null ? '' : c).trim(); });
  const col = function (names) {
    for (let k = 0; k < names.length; k++) { const i = head.indexOf(names[k]); if (i >= 0) return i; }
    return -1;
  };
  // '사유'는 시트에서 '사유 (보류/불가)'처럼 부가설명이 붙는 경우가 많아, 정확매칭 실패 시
  // 헤더에 '사유'가 포함된 첫 열로 폴백(완료일자 등 무관 열과 충돌 안 하도록 '사유' 포함만).
  const reasonCol = function () {
    const exact = col(['사유', '불가사유', '보류사유', '반려사유', '반영불가사유', '사유 (보류/불가)']);
    if (exact >= 0) return exact;
    for (let j = 0; j < head.length; j++) { if (head[j].indexOf('사유') >= 0) return j; }
    return -1;
  };
  const C = {
    num: col(['번호', '연번', 'No', 'no']),
    urgent: col(['긴급', '긴급여부']),
    type: col(['유형', '분류', '구분']),
    loc: col(['개선위치', '위치', '장소']),
    title: col(['제목']),
    content: col(['개선내용', '내용', '상세']),
    author: col(['작성자', '제안자', '등록자']),
    mgr: col(['담당자', '담당']),
    date: col(['제안일자', '작성일자', '등록일자', '작성일']),
    link: col(['관련자료', '자료', '링크', 'link']),
    status: col(['상태', '진행상태']),
    end: col(['완료일자', '완료일']),
    reason: reasonCol(),
  };
  return { sh: sh, values: values, hIdx: hIdx, head: head, col: col, C: C };
}

// 읽기: 헤더명 기준으로 각 행을 객체로 변환 (최신순 정렬은 프런트에서)
function getImprovements_() {
  const ctx = improveCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const values = ctx.values, C = ctx.C, hIdx = ctx.hIdx;
  const t = function (r, i) { return i < 0 ? '' : (r[i] == null ? '' : String(r[i]).trim()); };
  const items = [];
  for (let i = hIdx + 1; i < values.length; i++) {
    const r = values[i];
    if (t(r, C.title) === '' && t(r, C.content) === '') continue;
    items.push({
      num: t(r, C.num),
      urgent: wIsChk_(r[C.urgent]),
      type: t(r, C.type),
      loc: t(r, C.loc),
      title: t(r, C.title),
      content: t(r, C.content),
      author: t(r, C.author),
      mgr: t(r, C.mgr),
      date: wDate_(r[C.date]),
      link: t(r, C.link),
      status: t(r, C.status),
      end: wDate_(r[C.end]),
      reason: t(r, C.reason),
    });
  }
  // 개선위치/유형 열의 데이터 확인(드롭다운) 목록 — 새 제안 작성 드롭다운 보기로 사용
  const locOptions = dvOptions_(ctx.sh, hIdx, C.loc);
  const typeOptions = dvOptions_(ctx.sh, hIdx, C.type);
  return json_({ status: 'ok', items: items, headers: ctx.head, locOptions: locOptions, typeOptions: typeOptions });
}

// 한 열의 데이터 확인 목록(드롭다운) 추출 — 헤더 다음 데이터 행들에서 첫 검증을 찾음.
// VALUE_IN_LIST(직접 목록)·VALUE_IN_RANGE(범위 참조) 모두 지원.
function dvOptions_(sh, hIdx, col) {
  if (col < 0) return [];
  try {
    const last = sh.getLastRow();
    const end = Math.min(hIdx + 12, last);
    for (let r = hIdx + 2; r <= end; r++) {
      const dv = sh.getRange(r, col + 1).getDataValidation();
      if (!dv) continue;
      const type = dv.getCriteriaType();
      const vals = dv.getCriteriaValues();
      if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
        return (vals[0] || []).map(function (v) { return String(v).trim(); }).filter(function (v) { return v; });
      }
      if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && vals[0] && vals[0].getValues) {
        return vals[0].getValues().map(function (row) { return String(row[0] == null ? '' : row[0]).trim(); }).filter(function (v) { return v; });
      }
    }
  } catch (e) { /* 검증 없음/접근 불가 → 빈 목록 */ }
  return [];
}

// 기존 데이터 행(드롭다운/체크박스가 설정된 행)의 데이터 확인을 대상 행에 복사
// → 웹에서 추가/수정한 행도 시트에서 드롭다운(칩)으로 보이게 함.
// probeCol: 검증이 살아있는 템플릿 행을 찾을 때 확인할 열(상태 권장). 첫 데이터행이
// 검증 없는(웹 작성) 행일 수 있어, 실제 검증이 있는 행을 우선 템플릿으로 쓴다.
function copyRowValidation_(sh, hIdx, targetRow, probeCol) {
  try {
    const maxScan = Math.min(targetRow - 1, hIdx + 12);
    let templateRow = -1;
    if (probeCol >= 0) {
      for (let r = hIdx + 2; r <= maxScan; r++) {
        if (r === targetRow) continue;
        if (sh.getRange(r, probeCol + 1).getDataValidation()) { templateRow = r; break; }
      }
    }
    if (templateRow < 0) templateRow = hIdx + 2; // 폴백: 첫 데이터 행
    if (templateRow < hIdx + 2 || templateRow >= targetRow) return;
    const lastCol = sh.getLastColumn();
    sh.getRange(templateRow, 1, 1, lastCol).copyTo(
      sh.getRange(targetRow, 1, 1, lastCol),
      SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,
      false
    );
  } catch (e) { /* 검증 복사 실패는 무시(값은 이미 저장됨) */ }
}

// 등록: 로그인 사용자(담당자 시트 인증)만. 상태=접수, 제안일자=오늘(미지정 시), 작성자=로그인 이름.
function createImprovement_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  if (!String(req.title || '').trim()) return json_({ status: 'error', message: '제목이 비었습니다' });

  const ctx = improveCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, hIdx = ctx.hIdx, head = ctx.head, C = ctx.C;

  let maxNum = 0;
  if (C.num >= 0) for (let i = hIdx + 1; i < values.length; i++) {
    const v = Number(values[i][C.num]); if (!isNaN(v) && v > maxNum) maxNum = v;
  }
  const newNum = maxNum + 1;
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

  const row = new Array(head.length).fill('');
  const set = function (i, v) { if (i >= 0) row[i] = v; };
  set(C.num, newNum);
  set(C.urgent, req.urgent === true);
  set(C.type, String(req.type || ''));
  set(C.loc, String(req.loc || ''));
  set(C.title, String(req.title).trim());
  set(C.content, String(req.content || ''));
  set(C.author, String(req.author || ''));
  set(C.mgr, String(req.mgr || ''));
  set(C.date, req.date ? String(req.date) : today);
  set(C.link, String(req.link || ''));
  set(C.status, IMPROVE_STATUS_DEFAULT);
  set(C.end, '');
  set(C.reason, '');
  sh.appendRow(row);
  const last = sh.getLastRow();
  copyRowValidation_(sh, hIdx, last, C.status); // 상태·담당자·유형·개선위치 등 드롭다운(칩) 복사
  if (C.urgent >= 0) sh.getRange(last, C.urgent + 1).insertCheckboxes().setValue(req.urgent === true);
  return json_({ status: 'ok', num: newNum });
}

// 상태변경/내용수정: 담당자만 가능.
//  - status가 전달되면: 완료→완료일자 자동(그 외 상태면 비움), 불가/보류→사유 저장(그 외 비움)
//  - title/content/type/loc/link/urgent가 전달되면(수정): 해당 필드만 갱신 (상태 미전달 시 완료일자·사유 보존)
function updateImprovement_(req) {
  const author = String(req.author || '').trim();
  const authErr = authError_(author, String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  const num = String(req.num || '').trim();
  if (!num) return json_({ status: 'error', message: '대상 번호가 없습니다' });

  const ctx = improveCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, hIdx = ctx.hIdx, C = ctx.C;
  if (C.num < 0) return json_({ status: 'error', message: '번호 열을 찾지 못함' });
  let rowIdx = -1;
  for (let i = hIdx + 1; i < values.length; i++) {
    if (String(values[i][C.num] || '').trim() === num) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return json_({ status: 'error', message: '대상을 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });

  // 담당자만 변경 (담당자가 지정돼 있을 때)
  const rowMgr = C.mgr >= 0 ? String(values[rowIdx][C.mgr] || '').trim() : '';
  if (rowMgr && rowMgr !== author) return json_({ status: 'error', message: '담당자(' + rowMgr + ')만 변경할 수 있습니다' });

  const sheetRow = rowIdx + 1;
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const set = function (i, v) { if (i >= 0) sh.getRange(sheetRow, i + 1).setValue(v); };

  // 상태 변경(상태가 전달된 경우에만) — 완료일자/사유 규칙 적용
  if (req.status !== undefined) {
    const status = String(req.status || '').trim();
    if (status) set(C.status, status);
    if (C.end >= 0) {
      if (status === '완료') {
        const cur = wDate_(values[rowIdx][C.end]);
        set(C.end, req.end ? String(req.end) : (cur || today));
      } else {
        set(C.end, '');
      }
    }
    if (C.reason >= 0) {
      if (status === '불가' || status === '보류') set(C.reason, String(req.reason || ''));
      else set(C.reason, '');
    }
  }

  // 내용 수정(전달된 필드만 갱신)
  if (req.title !== undefined) set(C.title, String(req.title).trim());
  if (req.content !== undefined) set(C.content, String(req.content));
  if (req.type !== undefined) set(C.type, String(req.type));
  if (req.loc !== undefined) set(C.loc, String(req.loc));
  if (req.link !== undefined) set(C.link, String(req.link));

  copyRowValidation_(sh, hIdx, sheetRow, C.status); // 드롭다운 없던 웹 작성 행도 변경 시 드롭다운(칩) 적용
  // 긴급 체크박스는 검증 복사 후 마지막에 적용(값 보존)
  if (req.urgent !== undefined && C.urgent >= 0) {
    sh.getRange(sheetRow, C.urgent + 1).insertCheckboxes().setValue(req.urgent === true);
  }
  return json_({ status: 'ok', num: Number(num) || num });
}

// 삭제: 담당자만 가능. 번호로 행을 찾아 시트에서 행 자체 삭제.
function deleteImprovement_(req) {
  const author = String(req.author || '').trim();
  const authErr = authError_(author, String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  const num = String(req.num || '').trim();
  if (!num) return json_({ status: 'error', message: '대상 번호가 없습니다' });

  const ctx = improveCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, hIdx = ctx.hIdx, C = ctx.C;
  if (C.num < 0) return json_({ status: 'error', message: '번호 열을 찾지 못함' });
  let rowIdx = -1;
  for (let i = hIdx + 1; i < values.length; i++) {
    if (String(values[i][C.num] || '').trim() === num) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return json_({ status: 'error', message: '대상을 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });
  const rowMgr = C.mgr >= 0 ? String(values[rowIdx][C.mgr] || '').trim() : '';
  if (rowMgr && rowMgr !== author) return json_({ status: 'error', message: '담당자(' + rowMgr + ')만 삭제할 수 있습니다' });
  sh.deleteRow(rowIdx + 1);
  return json_({ status: 'ok', num: Number(num) || num });
}

// ── 장비도입관리 CRUD (헤더명 기반, 열 위치 비의존) ──
const SCHEDULE_SHEET_NAME = '장비도입관리';
const SCHEDULE_STAGES = ['사전규격', '구매공고', '기술평가', '기술협상', '장비제작', '장비설치'];

// 헤더 정규화: 공백·'(자동)' 제거 후 비교 ('장비명 (자동)' → '장비명')
function normSched_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, '').replace(/\(자동\)/g, '');
}

// 시트 + 헤더 위치 컨텍스트. 모든 열을 헤더명(정규화)으로 인식. 실패 시 { error }.
function scheduleCtx_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sh) return { error: "'장비도입관리' 시트가 없습니다" };
  const values = sh.getDataRange().getValues();
  let hIdx = -1;
  for (let i = 0; i < Math.min(values.length, 8); i++) {
    if (normSched_(values[i][0]) === '연번') { hIdx = i; break; }
  }
  if (hIdx < 0) {
    for (let i = 0; i < Math.min(values.length, 8); i++) {
      const hs = values[i].map(normSched_);
      if (hs.indexOf('장비명') >= 0 && hs.indexOf('시작년월') >= 0) { hIdx = i; break; }
    }
  }
  if (hIdx < 0) return { error: '헤더(연번/장비명)를 찾지 못함' };
  const head = values[hIdx].map(normSched_);
  const col = function (name) { return head.indexOf(name); };
  const C = {
    seq: col('연번'), code: col('관리번호'), name: col('장비명'), mgr: col('담당자'),
    status: col('진행상태'), start: col('시작년월'),
    duration: col('총소요기간'), cat: col('구분'), method: col('도입방법'), price: col('도입금액'),
    stage: SCHEDULE_STAGES.map(function (s) { return col(s); }),
  };
  return { sh: sh, values: values, hIdx: hIdx, head: head, col: col, C: C };
}

// 숫자형 셀: 빈값은 '', 그 외 숫자로 (콤마 제거). 파싱 불가면 원문 유지.
function numCell_(v) {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(/,/g, ''));
  return isNaN(n) ? v : n;
}

// 편집 가능한 도입관리 필드를 setter(i,v)로 기록. (연번·총소요기간은 시트 자동값이라 건드리지 않음)
function applyScheduleFields_(set, C, req) {
  set(C.code, String(req.code || ''));
  set(C.name, String(req.name || ''));
  set(C.mgr, String(req.mgr || ''));
  set(C.status, String(req.status || ''));
  set(C.start, String(req.start || ''));
  const stages = req.stages || {};
  for (var i = 0; i < SCHEDULE_STAGES.length; i++) {
    var sn = SCHEDULE_STAGES[i];
    set(C.stage[i], stages[sn] === undefined || stages[sn] === '' ? '' : numCell_(stages[sn]));
  }
  set(C.cat, String(req.cat || ''));
  set(C.method, String(req.method || ''));
  set(C.price, req.price === undefined || req.price === '' ? '' : numCell_(req.price));
}

function createSchedule_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  if (!String(req.code || '').trim() && !String(req.name || '').trim()) {
    return json_({ status: 'error', message: '관리번호 또는 장비명을 입력해주세요' });
  }
  const ctx = scheduleCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, hIdx = ctx.hIdx, head = ctx.head, C = ctx.C;

  let maxSeq = 0;
  if (C.seq >= 0) for (let i = hIdx + 1; i < values.length; i++) {
    const v = Number(values[i][C.seq]); if (!isNaN(v) && v > maxSeq) maxSeq = v;
  }
  const row = new Array(head.length).fill('');
  const set = function (i, v) { if (i >= 0) row[i] = v; };
  if (C.seq >= 0) set(C.seq, maxSeq + 1);
  applyScheduleFields_(set, C, req);
  sh.appendRow(row);
  return json_({ status: 'ok', code: String(req.code || '').trim(), seq: maxSeq + 1 });
}

function updateSchedule_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  // 행 식별: 원본 관리번호(origCode) 우선, 없으면 code
  const target = String(req.origCode || req.code || '').trim();
  if (!target) return json_({ status: 'error', message: '대상 관리번호가 없습니다' });

  const ctx = scheduleCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, hIdx = ctx.hIdx, C = ctx.C;
  if (C.code < 0) return json_({ status: 'error', message: '관리번호 열을 찾지 못함' });
  let rowIdx = -1;
  for (let i = hIdx + 1; i < values.length; i++) {
    if (String(values[i][C.code] || '').trim() === target) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return json_({ status: 'error', message: '대상 장비를 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });

  const sheetRow = rowIdx + 1;
  const set = function (i, v) { if (i >= 0) sh.getRange(sheetRow, i + 1).setValue(v); };
  applyScheduleFields_(set, C, req);
  return json_({ status: 'ok', code: String(req.code || target).trim() });
}

function deleteSchedule_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  const target = String(req.code || '').trim();
  if (!target) return json_({ status: 'error', message: '대상 관리번호가 없습니다' });
  const ctx = scheduleCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const values = ctx.values, hIdx = ctx.hIdx, C = ctx.C;
  if (C.code < 0) return json_({ status: 'error', message: '관리번호 열을 찾지 못함' });
  let rowIdx = -1;
  for (let i = hIdx + 1; i < values.length; i++) {
    if (String(values[i][C.code] || '').trim() === target) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return json_({ status: 'error', message: '대상 장비를 찾지 못했습니다 (이미 삭제됐을 수 있어요)' });
  ctx.sh.deleteRow(rowIdx + 1);
  return json_({ status: 'ok' });
}

// ── 장비운영관리 수정(Update) ── 2단 헤더(그룹행+세부행) 대응, 헤더명 기반. 관리번호로 행 식별.
// 수정 가능: 담당자/제조사/모델명/자산번호/NFEC번호/설치장소/설치일자/업체명/엔지니어/연락처/비고
const EQ_EDIT_FIELDS = [
  ['mgr', '담당자'], ['maker', '제조사'], ['model', '모델명'], ['assetNo', '자산번호'], ['nfec', 'NFEC번호'],
  ['installLoc', '설치장소'], ['installDate', '설치일자'], ['vendor', '업체명'], ['mgr2', '엔지니어'],
  ['contact', '연락처'], ['note', '비고'], ['state', '상태'],
];

function equipmentCtx_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('장비운영관리');
  if (!sh) return { error: "'장비운영관리' 시트가 없습니다" };
  const values = sh.getDataRange().getValues();
  let hIdx = -1;
  for (let i = 0; i < Math.min(values.length, 6); i++) {
    if (normSched_(values[i][0]) === '연번') { hIdx = i; break; }
  }
  if (hIdx < 0) return { error: '헤더(연번)를 찾지 못함' };
  const topH = values[hIdx].map(normSched_);
  const hasSub = values[hIdx + 1] != null && normSched_(values[hIdx + 1][0]) === '';
  const subH = hasSub ? values[hIdx + 1].map(normSched_) : [];
  const head = [];
  for (let c = 0; c < Math.max(topH.length, subH.length); c++) head.push(subH[c] || topH[c]);
  const col = function (name) { return head.indexOf(name); };
  const dataStart = hIdx + (hasSub ? 2 : 1);
  return { sh: sh, values: values, dataStart: dataStart, col: col };
}

function updateEquipment_(req) {
  const authErr = authError_(String(req.author || '').trim(), String(req.key || '').trim());
  if (authErr) return json_({ status: 'error', message: authErr });
  const target = String(req.code || '').trim();
  if (!target) return json_({ status: 'error', message: '대상 관리번호가 없습니다' });

  const ctx = equipmentCtx_();
  if (ctx.error) return json_({ status: 'error', message: ctx.error });
  const sh = ctx.sh, values = ctx.values, dataStart = ctx.dataStart, col = ctx.col;
  const cCode = col('관리번호');
  if (cCode < 0) return json_({ status: 'error', message: '관리번호 열을 찾지 못함' });

  let rowIdx = -1;
  for (let i = dataStart; i < values.length; i++) {
    if (String(values[i][cCode] || '').trim() === target) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return json_({ status: 'error', message: '대상 장비를 찾지 못했습니다' });

  const sheetRow = rowIdx + 1;
  // STEP22 — 상태 변경 이력용: 쓰기 전에 이전 상태/장비명 캡처
  const cState = col('상태'), cName = col('장비명');
  const prevState = cState >= 0 ? String(values[rowIdx][cState] || '').trim() : '';
  const eqName = cName >= 0 ? String(values[rowIdx][cName] || '').trim() : '';
  for (let f = 0; f < EQ_EDIT_FIELDS.length; f++) {
    const key = EQ_EDIT_FIELDS[f][0], hdr = EQ_EDIT_FIELDS[f][1];
    if (req[key] === undefined) continue; // 전달되지 않은 필드는 건드리지 않음
    const ci = col(hdr);
    if (ci >= 0) sh.getRange(sheetRow, ci + 1).setValue(String(req[key] == null ? '' : req[key]));
  }
  // STEP21 상태 변경 사유(선택) — '변경사유/상태사유/사유' 열이 있으면 저장, 없으면 무시. 이력은 STEP22.
  if (req.reason !== undefined) {
    const REASON_HDRS = ['변경사유', '상태사유', '사유'];
    let rc = -1;
    for (let r = 0; r < REASON_HDRS.length; r++) { const ri = col(REASON_HDRS[r]); if (ri >= 0) { rc = ri; break; } }
    if (rc >= 0) sh.getRange(sheetRow, rc + 1).setValue(String(req.reason || ''));
  }
  // STEP22 — 상태가 실제로 바뀐 경우에만 운영이력 1건 append(호출부 lock 보유).
  // 이력 기록 실패는 상태 변경 자체를 실패시키지 않음(이력은 보조).
  if (req.state !== undefined) {
    const newState = String(req.state == null ? '' : req.state).trim();
    if (newState && newState !== prevState) {
      try {
        appendEqHistory_({
          when: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
          code: target, name: eqName, prev: prevState, next: newState,
          reason: String(req.reason || ''), author: String(req.author || '').trim(),
          type: '상태변경', note: '',
        });
      } catch (e) { /* 이력은 보조 — 무시 */ }
    }
  }
  return json_({ status: 'ok', code: target });
}

// ── STEP22 장비 운영이력(append-only) ── 별도 '장비운영이력' 시트. 없으면 생성. 조회는 인증 불필요.
const EQ_HISTORY_SHEET = '장비운영이력';
const EQ_HISTORY_HEADERS = ['일시', '관리번호', '장비명', '이전상태', '변경상태', '사유', '작성자', '작업유형', '비고'];

// 이력 1건 append. rec 키: when/code/name/prev/next/reason/author/type/note. (호출부에서 lock 보유 가정)
function appendEqHistory_(rec) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(EQ_HISTORY_SHEET);
  if (!sh) sh = ss.insertSheet(EQ_HISTORY_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(EQ_HISTORY_HEADERS); // 헤더 없으면 먼저 기록
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
  const map = {
    '일시': rec.when, '관리번호': rec.code, '장비명': rec.name, '이전상태': rec.prev, '변경상태': rec.next,
    '사유': rec.reason, '작성자': rec.author, '작업유형': rec.type, '비고': rec.note,
  };
  const row = [];
  for (let i = 0; i < headers.length; i++) row.push(map[headers[i]] !== undefined ? map[headers[i]] : '');
  sh.appendRow(row);
}

// 운영이력 조회 — ?action=getEqHistory&code=<관리번호>. code 있으면 필터, 최신 먼저(최대 100건).
function getEqHistory_(p) {
  const code = String((p && p.code) || '').trim();
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(EQ_HISTORY_SHEET);
  if (!sh) return json_({ status: 'ok', items: [] });
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return json_({ status: 'ok', items: [] });
  const headers = values[0].map(function (h) { return String(h || '').trim(); });
  const idx = function (name) { return headers.indexOf(name); };
  const ci = {
    when: idx('일시'), code: idx('관리번호'), name: idx('장비명'), prev: idx('이전상태'), next: idx('변경상태'),
    reason: idx('사유'), author: idx('작성자'), type: idx('작업유형'), note: idx('비고'),
  };
  const get = function (row, i) {
    if (i < 0) return '';
    const v = row[i];
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    return String(v == null ? '' : v).trim();
  };
  const items = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const rowCode = get(row, ci.code);
    if (code && rowCode !== code) continue;
    items.push({
      when: get(row, ci.when), code: rowCode, name: get(row, ci.name), prev: get(row, ci.prev),
      next: get(row, ci.next), reason: get(row, ci.reason), author: get(row, ci.author),
      type: get(row, ci.type), note: get(row, ci.note),
    });
  }
  items.reverse(); // append 순서(시간순)의 역순 = 최신 먼저
  return json_({ status: 'ok', items: items.slice(0, 100) });
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
