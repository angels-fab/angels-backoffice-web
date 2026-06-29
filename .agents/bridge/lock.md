# Work Lock

status: free
current_worker: none
task: (직전: [사가]→연차 / 채용 필터 제거→기타 / 멀티데이 전 segment hit area(elementsFromPoint 컨테이너 위임) / 캘린더 상단 조작부 재배치 — 완료·커밋·자동배포)
started_at: -

## Do Not Edit While Locked

- src/store/slices/calSlice.ts (사가·채용 분류)
- src/pages/Calendar/* (hit area·상단 조작부·필터박스)
- src/index.css (fc-event hit area·toolbar)

## Notes

- Set `status: locked` before editing shared source files.
- Clear back to `status: free` when the work is finished, committed, or handed off.

