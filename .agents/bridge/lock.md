# Work Lock

status: free
current_worker: none
task: (직전: 캘린더 손가락포인터 전구간 / 종류건수=visible range+팀원+검색(종류제외) / 라벨·첫칩 간격 동일 / 팀원칩 26px — 완료·커밋·자동배포)
started_at: -

## Do Not Edit While Locked

- src/store/slices/calSlice.ts (사가·채용 분류)
- src/pages/Calendar/* (hit area·상단 조작부·필터박스)
- src/index.css (fc-event hit area·toolbar)

## Notes

- Set `status: locked` before editing shared source files.
- Clear back to `status: free` when the work is finished, committed, or handed off.

