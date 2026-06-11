/**
 * ANGELS FAB 통합 업무관리 — 구글시트 API (읽기 + 공지 새 글쓰기)
 *
 * 기존 기능(doGet, 시트 읽기)은 그대로 유지하고,
 * doPost(공지사항 새 글 추가)가 새로 추가된 버전.
 *
 * 배포 방법은 같은 폴더의 README.md 참고.
 */

// ── 설정 ──
// 새 글쓰기 비밀번호 — 반드시 팀만 아는 값으로 바꿀 것!
const WRITE_KEY = '여기에-팀-비밀번호-입력';
// 팹센터 구축총괄시트 ID (시트 URL의 /d/ 와 /edit 사이 문자열)
const SHEET_ID = '1lnS34m1cQ2mY6W6cBi7kOjDNtNaXtDSg3VRqgFWmUjU';

// ── 읽기: ?sheet=시트이름 → 해당 시트 전체를 JSON으로 ──
function doGet(e) {
  const name = String((e && e.parameter && e.parameter.sheet) || '').trim();
  try {
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
    if (!sh) return json_({ status: 'error', message: '시트 없음: ' + name });
    return json_({ status: 'ok', sheet: name, data: sh.getDataRange().getValues() });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

// ── 쓰기: POST {action:'addNotice', key:'비밀번호', ...} ──
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (String(req.key || '') !== WRITE_KEY) {
      return json_({ status: 'error', message: '작성 비밀번호가 올바르지 않습니다' });
    }
    if (req.action === 'addNotice') return addNotice_(req);
    return json_({ status: 'error', message: '알 수 없는 action: ' + req.action });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

// '공지사항' 시트에 새 행 추가 — 열 이름으로 매핑(열 순서가 바뀌어도 동작)
function addNotice_(req) {
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

  // 다음 연번 = 기존 최댓값 + 1
  const numCol = col(['연번', '번호']);
  let maxNum = 0;
  for (let i = hIdx + 1; i < values.length; i++) {
    const v = Number(numCol >= 0 ? values[i][numCol] : NaN);
    if (!isNaN(v) && v > maxNum) maxNum = v;
  }
  const newNum = maxNum + 1;

  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const row = new Array(head.length).fill('');
  const set = function (names, val) {
    const i = col(names);
    if (i >= 0) row[i] = val;
  };
  set(['연번', '번호'], newNum);
  set(['업무', '구분', '분류'], String(req.cat || '공지'));
  set(['부서', '관련부서'], String(req.dept || ''));
  set(['부서담당자', '담당자'], String(req.deptMgr || ''));
  set(['제목'], String(req.title).trim());
  set(['내용', '본문'], String(req.body));
  set(['관련자료', '첨부', '링크'], String(req.ref || ''));
  set(['시작일자'], today); // 작성일 = 오늘(KST)
  set(['종료일자'], String(req.end || ''));
  set(['게시자', '작성자'], String(req.author || ''));
  set(['해당자', '대상'], String(req.target || ''));
  set(['조회수', '조회'], 0);

  sh.appendRow(row);
  return json_({ status: 'ok', num: newNum });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
