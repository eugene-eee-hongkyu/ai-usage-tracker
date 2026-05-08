<!--
⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
consumer repo로 카피된 후엔 직접 수정하지 마세요.
변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
-->

# QA 자동화 분류표

생성일: 2026-04-28
docs/qa 기준 전체 TC: 805개
총 TC: 805개 (자동화: 796 | 수동: 7 | 스킵: 2)

---

## AUTH — 로그인/회원가입

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| AUTH-1-01 | 앱 최초 진입 — 비로그인 홈 화면 표시 | AUTOMATABLE | |
| AUTH-1-02 | 세무법인 랭킹 영역 확인 | AUTOMATABLE | |
| AUTH-1-03 | '현직 공무원 정보 탐색' 선택 — 구독 유도 안내 표시 | AUTOMATABLE | |
| AUTH-1-05 | '세무사 찾기' 선택 — 비로그인 세무사 검색 화면 이동 | AUTOMATABLE | |
| AUTH-1-06 | GNB '멤버십 안내' 선택 — 멤버십 안내 화면 이동 | AUTOMATABLE | |
| AUTH-1-07 | GNB '로그인' 선택 — 로그인 화면 이동 | AUTOMATABLE | |
| AUTH-1-08 | GNB '회원가입' 선택 — 회원가입 유형 선택 화면 이동 | AUTOMATABLE | |
| AUTH-1-11 | 기능 탐색 영역 각 항목 상태 확인 | AUTOMATABLE | |
| AUTH-1-12 | GNB 영역 확인 | AUTOMATABLE | |
| AUTH-1-21 | 세무법인 랭킹 데이터 없음 — 빈 상태 화면 | AUTOMATABLE | |
| AUTH-2-01 | 멤버십 안내 화면 진입 — 일반 납세자 멤버십 기본 선택 | AUTOMATABLE | |
| AUTH-2-02 | '세무사/세무법인 멤버십' 탭 선택 | AUTOMATABLE | |
| AUTH-2-04 | '무료로 구독하기' 버튼 선택 — 회원가입 유형 화면 이동 | AUTOMATABLE | |
| AUTH-2-11 | 일반 납세자 플랜 정보 확인 | AUTOMATABLE | |
| AUTH-2-12 | 세무사/세무법인 플랜 정보 확인 | AUTOMATABLE | |
| AUTH-2-13 | 하단 안내 사항 확인 | AUTOMATABLE | |
| AUTH-3-01 | 비로그인 세무사 검색 화면 진입 | AUTOMATABLE | |
| AUTH-3-02 | 세무사명으로 검색 | AUTOMATABLE | |
| AUTH-3-03 | 지역 필터 선택 — 목록 갱신 | AUTOMATABLE | |
| AUTH-3-05 | 필터 초기화 — 전체 목록 복귀 | AUTOMATABLE | |
| AUTH-3-07 | 로그인 버튼 선택 — 로그인 화면 이동 | AUTOMATABLE | |
| AUTH-3-08 | 회원가입 버튼 선택 — 회원가입 유형 화면 이동 | AUTOMATABLE | |
| AUTH-3-21 | 존재하지 않는 세무사명 검색 — 오류 창 팝업 | AUTOMATABLE | |
| AUTH-4-01 | 로그인 화면 진입 — UI 요소 표시 | AUTOMATABLE | |
| AUTH-4-02 | 올바른 이메일/비밀번호 로그인 성공 | AUTOMATABLE | |
| AUTH-4-03 | 이메일 기억하기 체크 후 재진입 — 이메일 자동 채워짐 | AUTOMATABLE | |
| AUTH-4-04 | '이메일 찾기' 링크 선택 — 본인 인증 화면 표시 | AUTOMATABLE | |
| AUTH-4-05 | 본인 인증 완료 — 가입된 이메일 표시 | MANUAL | 본인 인증(PASS/KMC 등) 팝업 — 자동화 불가 |
| AUTH-4-06 | '로그인하러가기' 선택 — 로그인 화면 복귀 | AUTOMATABLE | |
| AUTH-4-07 | '홈으로' 선택 — 홈 화면 이동 | AUTOMATABLE | |
| AUTH-4-08 | '비밀번호 찾기' 링크 선택 — 이메일 입력 필드 표시 | AUTOMATABLE | |
| AUTH-4-09 | 이메일 입력 후 본인 인증 완료 — 새 비밀번호 입력 필드 표시 | MANUAL | 본인 인증 팝업 — 자동화 불가 |
| AUTH-4-10 | 유효한 비밀번호 입력 후 변경 | AUTOMATABLE | |
| AUTH-4-11 | '일반 개인 회원가입' 링크 선택 | AUTOMATABLE | |
| AUTH-4-12 | '세무사 및 세무법인 가입 안내' 링크 선택 | AUTOMATABLE | |
| AUTH-4-21 | 올바르지 않은 이메일 형식 입력 — 인라인 에러 | AUTOMATABLE | |
| AUTH-4-22 | 존재하지 않는 계정으로 로그인 시도 — 에러 안내 | AUTOMATABLE | |
| AUTH-4-23 | 올바른 이메일 + 틀린 비밀번호 — 에러 안내 | AUTOMATABLE | |
| AUTH-4-24 | 이메일 찾기 — 가입된 이메일 없음 | AUTOMATABLE | |
| AUTH-4-25 | 비밀번호 찾기 — 규칙 위반 비밀번호 입력 | AUTOMATABLE | |
| AUTH-4-26 | 비밀번호 찾기 — 비밀번호 확인 불일치 | AUTOMATABLE | |
| AUTH-5-01 | 회원가입 유형 선택 화면 진입 — 세 카드 표시 | AUTOMATABLE | |
| AUTH-5-02 | 일반 납세자 '회원가입하기' 선택 | AUTOMATABLE | |
| AUTH-5-03 | 세무사 '회원가입하기' 선택 | AUTOMATABLE | |
| AUTH-5-04 | 세무법인 '회원가입하기' 선택 | AUTOMATABLE | |
| AUTH-5-11 | 각 카드 정보 확인 | AUTOMATABLE | |
| AUTH-6-01 | 일반 개인 회원가입 화면 진입 | AUTOMATABLE | |
| AUTH-6-02 | 약관 전체 동의 체크박스 선택 | AUTOMATABLE | |
| AUTH-6-03 | 전체 동의 해제 | AUTOMATABLE | |
| AUTH-6-04 | '본인 인증하기' 선택 — 본인 인증 진행 | MANUAL | 본인 인증 팝업 — 자동화 불가 |
| AUTH-6-05 | 유효한 이메일 입력 후 '인증번호 전송' | AUTOMATABLE | |
| AUTH-6-06 | 올바른 인증번호 입력 후 이메일 인증 완료 | AUTOMATABLE | |
| AUTH-6-07 | 이메일 주소 수정 — 인증번호 전송 버튼 재활성화 | AUTOMATABLE | |
| AUTH-6-08 | 유효한 비밀번호 입력 — 실시간 규칙 검증 | AUTOMATABLE | |
| AUTH-6-09 | 동일한 비밀번호 확인 입력 | AUTOMATABLE | |
| AUTH-6-10 | 모든 필수 항목 입력 후 회원가입 완료 | AUTOMATABLE | staging 테스트 계정 생성→검증→삭제 |
| AUTH-6-12 | 추가 정보 영역 확인 — 선택 사항 | AUTOMATABLE | |
| AUTH-6-22 | 올바르지 않은 이메일 형식으로 전송 — 인라인 에러 | AUTOMATABLE | |
| AUTH-6-23 | 틀린 인증번호 입력 — 에러 | AUTOMATABLE | |
| AUTH-6-24 | 인증번호 수정 — 확인 버튼 재활성화 | AUTOMATABLE | |
| AUTH-6-25 | 동일 문자 3회 연속 비밀번호 입력 — 인라인 에러 | AUTOMATABLE | |
| AUTH-6-26 | 이메일과 동일한 비밀번호 입력 — 인라인 에러 | AUTOMATABLE | |
| AUTH-6-27 | 8자 미만 비밀번호 입력 — 인라인 에러 | AUTOMATABLE | |
| AUTH-6-28 | 비밀번호 확인에 다른 값 입력 — 불일치 에러 | AUTOMATABLE | |
| AUTH-6-29 | 필수 항목 미입력 시 가입 버튼 비활성화 | AUTOMATABLE | |
| AUTH-7-01 | 세무사 회원가입 화면 진입 | AUTOMATABLE | |
| AUTH-7-02 | 약관 전체 동의 선택 | AUTOMATABLE | |
| AUTH-7-03 | '본인 인증하기' 선택 | MANUAL | 본인 인증 팝업 — 자동화 불가 |
| AUTH-7-04 | 이메일 인증 및 비밀번호 설정 완료 | AUTOMATABLE | |
| AUTH-7-05 | '세무사회 등록 번호 조회' 선택 | AUTOMATABLE | |
| AUTH-7-06 | 유효+미등록 세무사 번호 — 가입 신청 제출 | AUTOMATABLE | |
| AUTH-7-12 | 세무사 정보 안내 문구 확인 | AUTOMATABLE | |
| AUTH-7-21 | 이미 등록된 세무사 정보 선택 — 등록 불가 안내 | AUTOMATABLE | |
| AUTH-7-23 | 필수 항목 일부 미입력 — '가입 신청 제출' 에러 | AUTOMATABLE | |
| AUTH-8-02 | 세무법인 회원가입 — 약관 전체 동의 | AUTOMATABLE | |
| AUTH-8-03 | '본인 인증하기' 선택 | MANUAL | 본인 인증 팝업 — 자동화 불가 |
| AUTH-8-04 | 이메일 인증 및 비밀번호 설정 완료 | AUTOMATABLE | |
| AUTH-8-05 | '다음 (1/2)' 선택 — 법인정보 입력 단계 전환 | AUTOMATABLE | |
| AUTH-8-06 | 세무사 자격 '예' 선택 후 등록 번호 조회 | AUTOMATABLE | |
| AUTH-8-07 | '법인 인증하기' 선택 — 법인 번호 조회 | AUTOMATABLE | |
| AUTH-8-08 | 세무사회 등록 법인 조회 | AUTOMATABLE | |
| AUTH-8-09 | 모든 필수 입력(소유자 세무사) — 가입 신청 제출 | AUTOMATABLE | |
| AUTH-8-10 | 모든 필수 입력(소유자 비세무사) — 가입 완료 | AUTOMATABLE | |
| AUTH-8-11 | 세무법인 회원가입 진입 — 진행 단계 확인 | AUTOMATABLE | |
| AUTH-8-12 | 세무사 자격 여부 안내 문구 확인 | AUTOMATABLE | |
| AUTH-8-21 | 개인정보 단계 필수 미입력 — '다음' 선택 에러 | AUTOMATABLE | |
| AUTH-8-22 | 이미 등록된 세무사회 명단 선택 — 등록 불가 안내 | AUTOMATABLE | |
| AUTH-8-23 | 이미 등록된 세무법인 번호 인증 — 등록 불가 안내 | AUTOMATABLE | |
| AUTH-8-24 | 잘못된 법인 정보로 인증 — 인라인 에러 | AUTOMATABLE | |
| AUTH-8-26 | 필수 항목 일부 미입력 — '가입 신청 제출' 에러 | AUTOMATABLE | |
| AUTH-8-27 | 이미 등록된 세무사회 세무사 정보 선택 — 가입 불가 | AUTOMATABLE | |

---

## EI — 전문이력관리

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| EI-0-01 | U2+U5+U9(세무사 Pro) — 세무 이력 관리 진입 | AUTOMATABLE | |
| EI-0-02 | U2+U5(세무사 미구독) — 화면 표시, 기능 제한 | AUTOMATABLE | |
| EI-0-03 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — 법인 정보 자동 기입 | AUTOMATABLE | |
| EI-0-04 | U2+U5+U7+U9(세무법인 구성원 세무사) — 법인 정보 자동 기입 | AUTOMATABLE | |
| EI-0-05 | U2+U5+U7+U8+U9(세무법인 관리자 세무사) — 법인 정보 자동 기입 | AUTOMATABLE | |
| EI-0-06 | U2+U3+U6+U9(세무법인 소유자 비세무사) — 메뉴 미노출 | AUTOMATABLE | |
| EI-0-07 | U2+U7+U9(세무법인 구성원 일반) — 메뉴 미노출 | AUTOMATABLE | |
| EI-0-08 | U2+U7+U8+U9(세무법인 관리자 일반) — 메뉴 미노출 | AUTOMATABLE | |
| EI-0-09 | U2(일반 납세자) — 메뉴 미노출 | AUTOMATABLE | |
| EI-0-10 | U2+U9(일반 납세자 Pro) — 메뉴 미노출 | AUTOMATABLE | |
| EI-1-01 | GNB > 세무 이력 관리 이동 — 기본 정보 탭 활성 | AUTOMATABLE | |
| EI-1-02 | 최초 진입(데이터 없음) — 안내 팝업 | AUTOMATABLE | |
| EI-1-03 | 프로필 노출 토글 ON | AUTOMATABLE | |
| EI-1-04 | 프로필 노출 토글 OFF | AUTOMATABLE | |
| EI-1-05 | 미리보기 버튼 탭 — 프로필 미리보기 팝업 | AUTOMATABLE | |
| EI-1-06 | 전문 영역 선택 영역 탭 — 패널 표시 | AUTOMATABLE | |
| EI-1-07 | 전문 영역 선택 후 완료 — 화면 반영 | AUTOMATABLE | |
| EI-1-10 | 출신 대학교(학사) 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-1-11 | 대학교 업로드 모달 — 파일+정보 입력 후 제출 | AUTOMATABLE | |
| EI-1-12 | 석사/박사 아코디언 펼치고 업로드 | AUTOMATABLE | |
| EI-1-13 | 철회 버튼 탭 — 제출 건 철회 | AUTOMATABLE | |
| EI-1-14 | 반려 항목 — 사유 확인 링크 탭 | AUTOMATABLE | |
| EI-1-15 | 반려 사유 확인 후 재제출 | AUTOMATABLE | |
| EI-1-16 | 보완 요청 항목 — 사유 확인 링크 탭 | AUTOMATABLE | |
| EI-1-18 | 승인 상태 학력 항목 확인 | AUTOMATABLE | |
| EI-1-20 | 변경사항 미저장 — 이탈 확인 팝업 | AUTOMATABLE | |
| EI-1-21 | 이름 항목 — 본인 인증 기반, 수정 불가 | AUTOMATABLE | |
| EI-1-22 | 좌측 사이드 메뉴 확인 | AUTOMATABLE | |
| EI-1-23 | U2+U3+U5+U6+U9 — 현 소속 법인 자동 기입, 수정 불가 | AUTOMATABLE | |
| EI-1-24 | U2+U5+U7+U9 — 현 소속 법인 자동 기입 | AUTOMATABLE | |
| EI-1-25 | 개인 세무사 — 소속 사무소 직접 입력/수정 가능 | AUTOMATABLE | |
| EI-1-28 | 기본 정보 미저장 상태에서 프로필 노출 토글 ON | AUTOMATABLE | |
| EI-1-34 | 10MB 초과 파일 업로드 — 파일 크기 에러 | AUTOMATABLE | |
| EI-1-35 | 허용되지 않는 형식(DOCX) 파일 업로드 — 에러 | AUTOMATABLE | |
| EI-1-36 | 변경사항 미저장 — 브라우저 뒤로가기 이탈 확인 팝업 | AUTOMATABLE | |
| EI-2-01 | 근무 이력 선택 — 일반 근무 탭 기본 활성 | AUTOMATABLE | |
| EI-2-02 | 제출 건 없음 — 빈 상태 화면 | AUTOMATABLE | |
| EI-2-03 | 국세 공무 근무 이력 탭 선택 | AUTOMATABLE | |
| EI-2-04 | 일반 근무 탭 — 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-2-05 | 일반 근무 업로드 모달 — 파일+소속+근무기간 제출 | AUTOMATABLE | |
| EI-2-06 | 일반 근무 업로드 모달 — 재직중 체크 후 제출 | AUTOMATABLE | |
| EI-2-07 | 국세 공무 탭 — 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-2-08 | 국세 공무 업로드 모달 — 전체 입력 후 제출 | AUTOMATABLE | |
| EI-2-09 | 제출 건 존재 — 검증 진행중 탭 선택 | AUTOMATABLE | |
| EI-2-10 | 검증 진행중 항목 — 철회 버튼 탭 | AUTOMATABLE | |
| EI-2-11 | 반려 항목 — 반려 탭 선택 | AUTOMATABLE | |
| EI-2-12 | 반려 항목 — 사유 확인 후 재제출 | AUTOMATABLE | |
| EI-2-13 | 반려 항목 — 이의신청 제출 | AUTOMATABLE | |
| EI-2-14 | 보완 요청 탭 선택 | AUTOMATABLE | |
| EI-2-15 | 보완 요청 항목 — 보완 자료 제출 | AUTOMATABLE | |
| EI-2-16 | 승인 상태 국세 공무 이력 — 삭제 버튼 탭 | AUTOMATABLE | |
| EI-2-21 | 검증 상태 탭별 건수 확인 | AUTOMATABLE | |
| EI-2-22 | 이의신청 검토중 건 — 상태 표시 | AUTOMATABLE | |
| EI-2-23 | 승인된 일반 근무 이력 — 승인 탭 목록 확인 | AUTOMATABLE | |
| EI-2-24 | 승인된 국세 공무 이력 — 승인 탭 목록 확인 | AUTOMATABLE | |
| EI-2-25 | 목록 다수 — 페이지네이션 확인 | AUTOMATABLE | |
| EI-2-31 | 10MB 초과 파일 업로드 — 에러 | AUTOMATABLE | |
| EI-2-32 | 허용되지 않는 형식 파일 업로드 — 에러 | AUTOMATABLE | |
| EI-2-33 | 모두 제출 건 없음 — 각 탭 빈 상태 화면 | AUTOMATABLE | |
| EI-3-01 | 실적 사례 선택 — 세무조사 대응 탭 기본 활성 | AUTOMATABLE | |
| EI-3-02 | 제출 건 없음 — 빈 상태 + 가이드 링크 | AUTOMATABLE | |
| EI-3-03 | 조세불복 탭 선택 | AUTOMATABLE | |
| EI-3-04 | 상속·증여·승계 탭 선택 | AUTOMATABLE | |
| EI-3-05 | 세무조사 대응 탭 — 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-3-06 | 실적 업로드 폼 — 파일+필수 항목 입력 후 제출 | AUTOMATABLE | |
| EI-3-07 | 제출 건 존재 — 검증 진행중 탭 선택 | AUTOMATABLE | |
| EI-3-08 | 검증 진행중 항목 — 철회 버튼 탭 | AUTOMATABLE | |
| EI-3-09 | 반려 항목 — 사유 확인 후 재제출 | AUTOMATABLE | |
| EI-3-10 | 보완 요청 항목 — 보완 자료 제출 | AUTOMATABLE | |
| EI-3-11 | 각 검증 상태 탭 건수 확인 | AUTOMATABLE | |
| EI-3-12 | 승인 실적 — 승인 탭 목록 확인 | AUTOMATABLE | |
| EI-3-13 | 상세·산업 분야 미입력 실적 — 빈 값 표시 | AUTOMATABLE | |
| EI-3-14 | 세무조사 대응 실적 승인 — 전문 영역 인증 표시 | AUTOMATABLE | |
| EI-3-21 | 실적 소개 제목 50자 초과 입력 — 입력 제한 | AUTOMATABLE | |
| EI-3-22 | 필수 항목 미입력 제출 — 미진행 | AUTOMATABLE | |
| EI-3-23 | 세 유형 모두 제출 건 없음 — 빈 상태 화면 | AUTOMATABLE | |
| EI-3-24 | 10MB 초과 파일 선택 — 에러 | AUTOMATABLE | |
| EI-4-01 | 대외 전문 활동 선택 — 조세심판원 탭 기본 활성 | AUTOMATABLE | |
| EI-4-02 | 제출 건 없음 — 빈 상태 화면 | AUTOMATABLE | |
| EI-4-03 | 국가 공인 자격 탭 선택 | AUTOMATABLE | |
| EI-4-04 | 강의 이력 탭 선택 | AUTOMATABLE | |
| EI-4-05 | 전문서적 출간 탭 선택 | AUTOMATABLE | |
| EI-4-06 | 전문지 기고 및 인터뷰 탭 선택 | AUTOMATABLE | |
| EI-4-07 | 조세심판원 탭 — 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-4-08 | 조세심판원 업로드 모달 — 입력 후 제출 | AUTOMATABLE | |
| EI-4-09 | 국가 공인 자격 탭 — 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-4-10 | 자격증 업로드 모달 — 자격 정보 입력 후 제출 | AUTOMATABLE | |
| EI-4-11 | 강의 이력 탭 — 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-4-12 | 강의 이력 업로드 모달 — 입력 후 제출 | AUTOMATABLE | |
| EI-4-13 | 전문서적 출간 탭 — 파일 업로드 버튼 탭 | AUTOMATABLE | |
| EI-4-14 | 전문서적 업로드 — 출판계약서+ISBN 증빙 제출 | AUTOMATABLE | |
| EI-4-15 | 검증 진행중 항목 — 철회 버튼 탭 | AUTOMATABLE | |
| EI-4-16 | 반려 항목 — 사유 확인 후 재제출 | AUTOMATABLE | |
| EI-4-17 | 보완 요청 항목 — 보완 자료 제출 | AUTOMATABLE | |
| EI-4-21 | 조세심판원 제출 건 — 검증 상태 탭별 건수 확인 | AUTOMATABLE | |
| EI-4-22 | 조세심판원 검증 진행중 목록 — 표시 항목 확인 | AUTOMATABLE | |
| EI-4-23 | 강의 이력 검증 진행중 목록 — 표시 항목 확인 | AUTOMATABLE | |
| EI-4-24 | 강의 이력 반려/보완 요청 — 탭 목록 확인 | AUTOMATABLE | |
| EI-4-31 | 다섯 유형 모두 제출 건 없음 — 빈 상태 화면 | AUTOMATABLE | |
| EI-4-32 | 조세심판원 업로드 — 10MB 초과 파일 에러 | AUTOMATABLE | |
| EI-4-33 | 강의 이력 업로드 — 필수 항목 미입력 에러 | AUTOMATABLE | |
| EI-5-01 | 증빙 파일 제출 직후 — 검증 대기 상태 | AUTOMATABLE | |
| EI-5-02 | 검증 진행중 항목 — 철회 버튼 탭 | AUTOMATABLE | |
| EI-5-03 | 반려 항목 — 재업로드/추가증빙으로 재제출 | AUTOMATABLE | |
| EI-5-04 | 반려 항목 — 이의신청 제출 | AUTOMATABLE | |
| EI-5-05 | 보완 요청 항목 — 보완 자료 제출 | AUTOMATABLE | |
| EI-5-11 | 검증 상태 변경 시 알림 발송 확인 | AUTOMATABLE | |
| EI-5-12 | 알림 바로가기 링크 탭 — 해당 화면 직접 이동 | AUTOMATABLE | |
| EI-5-13 | 최초 가입 직후 — 세무 이력 관리 작성 유도 알림 | AUTOMATABLE | |
| EI-5-21 | 이의신청 검토중 항목 — 사용자 액션 없음 상태 확인 | AUTOMATABLE | |

---

## EO — 전직공무원찾기

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| EO-0-01 | U2(일반 미구독) — 전직 공무원 찾기 기능 미노출 | AUTOMATABLE | |
| EO-0-02 | U2+U9(일반 Pro) — 기능 미노출 | AUTOMATABLE | |
| EO-0-03 | U2+U3+U9(팀 소유자) — 기능 미노출 | AUTOMATABLE | |
| EO-0-04 | U2+U4+U9(팀 구성원) — 기능 미노출 | AUTOMATABLE | |
| EO-0-05 | U2+U5(세무사 미구독) — 접근 불가 안내 | AUTOMATABLE | |
| EO-0-06 | U2+U5+U9(세무사 Pro) — 목록 화면 정상 표시 | AUTOMATABLE | |
| EO-0-07 | U2+U7+U9(세무법인 구성원 비세무사) — 목록 화면 정상 표시 | AUTOMATABLE | |
| EO-0-08 | U2+U5+U7+U9(세무법인 구성원 세무사) — 목록 화면 정상 표시 | AUTOMATABLE | |
| EO-0-09 | U2+U7+U8+U9(세무법인 관리자 비세무사) — 목록 화면 정상 표시 | AUTOMATABLE | |
| EO-0-10 | U2+U5+U7+U8+U9(세무법인 관리자 세무사) — 목록 화면 정상 표시 | AUTOMATABLE | |
| EO-0-11 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — 목록 화면 정상 표시 | AUTOMATABLE | |
| EO-0-12 | U2+U3+U6+U9(세무법인 소유자 비세무사) — 목록 화면 정상 표시 | AUTOMATABLE | |
| EO-1-01 | 전직 공무원 찾기 목록 화면 진입 — 필터 초기 상태 | AUTOMATABLE | |
| EO-1-02 | 소속(청/서) 필터 선택 메뉴 탭 | AUTOMATABLE | |
| EO-1-03 | 소속(청/서)에서 청 선택 — 소속(국실) 활성화 | AUTOMATABLE | |
| EO-1-04 | 소속(청/서)에서 세무서 선택 — 국실 없음 | AUTOMATABLE | |
| EO-1-05 | 소속(국실) 선택 — 소속(과) 활성화 | AUTOMATABLE | |
| EO-1-06 | 소속(과) 선택 — 소속(팀) 활성화 | AUTOMATABLE | |
| EO-1-07 | 소속(팀) 선택 | AUTOMATABLE | |
| EO-1-08 | 소속 미선택 — 직급 필터 단독 선택 | AUTOMATABLE | |
| EO-1-09 | 소속 미선택 — 직책 필터 단독 선택 | AUTOMATABLE | |
| EO-1-10 | 공무원명 직접 입력 | AUTOMATABLE | |
| EO-1-11 | 검색 버튼 탭 — 결과 목록 표시 | AUTOMATABLE | |
| EO-1-12 | 초기화 버튼 탭 — 필터 초기화 | AUTOMATABLE | |
| EO-1-13 | 검색 결과 행 탭 — 프로필 상세 새 창 | AUTOMATABLE | |
| EO-1-14 | 검색 결과 행 호버 — 화살표 노출 | AUTOMATABLE | |
| EO-1-15 | 탐색 탭 — '현직 공무원 정보 탐색' 선택 | AUTOMATABLE | |
| EO-1-16 | 탐색 탭 — '세무사 찾기' 선택 | AUTOMATABLE | |
| EO-1-21 | 검색 결과 정렬 순서 확인 — 관계 많은 순 | AUTOMATABLE | |
| EO-1-22 | 인맥 관계 수 컬럼 확인 | AUTOMATABLE | |
| EO-1-23 | 단일값 소속 선택 — 결과 테이블 강조 표시 | AUTOMATABLE | |
| EO-1-24 | 생략 텍스트 셀 호버 — 전체 텍스트 노출 | AUTOMATABLE | |
| EO-1-25 | 페이지네이션 — 다음 페이지 이동 | AUTOMATABLE | |
| EO-1-26 | 헤더(GNB) 영역 확인 | AUTOMATABLE | |
| EO-1-27 | 인사말 영역 확인 | AUTOMATABLE | |
| EO-1-28 | GNB 로고 탭 — 홈 이동 | AUTOMATABLE | |
| EO-1-31 | 존재하지 않는 공무원명 검색 — 에러 메시지 팝업 | AUTOMATABLE | |
| EO-1-32 | 필터 미선택/미입력 — 검색 버튼 비활성화 | AUTOMATABLE | |
| EO-2-01 | 프로필 상세 화면 진입 — 연관 관계 찾기 영역 먼저 표시 | AUTOMATABLE | |
| EO-2-02 | 프로필 영역 펼치기 버튼 탭 — 상세 정보 펼쳐짐 | AUTOMATABLE | |
| EO-2-03 | 프로필 영역 닫기 버튼 탭 | AUTOMATABLE | |
| EO-2-05 | 소팅 '직급별' 선택 — 목록 정렬 변경 | AUTOMATABLE | |
| EO-2-06 | 관계 필터 '동기' 선택 — 필터링 | AUTOMATABLE | |
| EO-2-07 | 관계 필터 '전체' 선택 — 전체 표시 | AUTOMATABLE | |
| EO-2-08 | 연관 관계 테이블 현직 공무원 행 탭 — 새 창 | AUTOMATABLE | |
| EO-2-09 | 연관 관계 테이블 행 호버 — 화살표 노출 | AUTOMATABLE | |
| EO-2-10 | "+N" 배지 호버 — 생략된 관계 유형 노출 | AUTOMATABLE | |
| EO-2-12 | 관계망 그래프 전체보기 탭 | AUTOMATABLE | |
| EO-2-13 | 관계 상세보기 탭 | AUTOMATABLE | |
| EO-2-14 | 프로필 상세(새 창) — 상단 검색 영역 확장 | AUTOMATABLE | |
| EO-2-15 | 탐색 탭 '현직 공무원 정보 탐색' 선택 | AUTOMATABLE | |
| EO-2-16 | 탐색 탭 '세무사 찾기' 선택 | AUTOMATABLE | |
| EO-2-17 | 공무원 출신 세무사 Pro — 본인 기본 비교 대상 설정 | AUTOMATABLE | |
| EO-2-18 | 비공무원 출신 세무사 Pro — 대상 추천 인물만 표시 | AUTOMATABLE | |
| EO-2-19 | 세무법인 소유자 세무사 — 비교 대상 선택 | AUTOMATABLE | |
| EO-2-20 | 세무법인 소유자 비세무사 — 법인 전체 기본 설정 | AUTOMATABLE | |
| EO-2-21 | 학력사항 표시 순서 확인 | AUTOMATABLE | |
| EO-2-22 | 과거 이력 정보 표시 순서 확인 | AUTOMATABLE | |
| EO-2-23 | 연관 관계 찾기 영역 기본 정렬 확인 | AUTOMATABLE | |
| EO-2-24 | 연관 관계 테이블 표시 데이터 확인 | AUTOMATABLE | |
| EO-2-25 | 연관 관계 테이블 기본 노출 건수 10개 확인 | AUTOMATABLE | |
| EO-2-27 | 존재하지 않는 값 — 공란 표기 확인 | AUTOMATABLE | |
| EO-2-28 | 이름, 임용 정보, 출생연도/지 표시 확인 | AUTOMATABLE | |
| EO-2-32 | 학력사항 없는 전직 공무원 — 학력 항목 미노출 | AUTOMATABLE | |
| EO-2-33 | 관계 필터 특정 유형 0건 — 빈 상태 안내 | AUTOMATABLE | |

---

## ER — 전문이력리포트

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| ER-0-01 | U2+U5+U9(세무사 Pro) — 개인 리포트 조회/PDF/링크 | AUTOMATABLE | |
| ER-0-03 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — 개인+법인 탭 | AUTOMATABLE | |
| ER-0-04 | U2+U3+U6+U9(세무법인 소유자 비세무사) — 법인 탭만 | AUTOMATABLE | |
| ER-0-05 | U2+U5+U7+U9(세무법인 구성원 세무사) — 개인+법인 탭 | AUTOMATABLE | |
| ER-0-06 | U2+U5+U7+U8+U9(세무법인 관리자 세무사) — 개인+법인 탭 | AUTOMATABLE | |
| ER-0-07 | U2+U7+U9 / U2+U7+U8+U9(납세자 UI) — 법인 탭만 | AUTOMATABLE | |
| ER-0-08 | U2+U4+U5+U9(팀 구성원 세무사) — 개인 리포트만 | AUTOMATABLE | |
| ER-0-09 | 일반 납세자 계열 — 메뉴 미표시 또는 접근 차단 | AUTOMATABLE | |
| ER-1-01 | 세무법인 미소속 세무사 — GNB > 세무 이력 리포트 선택 | AUTOMATABLE | |
| ER-1-02 | 세무법인 소속 세무사 — 개인 프로필 리포트 기본 표시 | AUTOMATABLE | |
| ER-1-03 | 개인 프로필 리포트 탭 선택 | AUTOMATABLE | |
| ER-1-04 | 법인 프로필 리포트 탭 선택 | AUTOMATABLE | |
| ER-1-05 | PDF 저장 버튼 선택 — PDF 파일 저장 | AUTOMATABLE | |
| ER-1-06 | 링크 추출 버튼 선택 — 공유 링크 생성, 클립보드 복사 | AUTOMATABLE | |
| ER-1-11 | 리포트 제목 확인 — "{이름} 프로필 리포트" 형식 | AUTOMATABLE | |
| ER-1-12 | 프로필 업데이트 일시 확인 | AUTOMATABLE | |
| ER-1-13 | 세무법인 미소속 세무사 — 개인 탭만 표시 | AUTOMATABLE | |
| ER-1-15 | 기본 정보 섹션 확인 | AUTOMATABLE | |
| ER-1-16 | 근무 이력 섹션 확인 | AUTOMATABLE | |
| ER-1-17 | 실적 요약 섹션 확인 | AUTOMATABLE | |
| ER-1-18 | 실적 상세 섹션 확인 | AUTOMATABLE | |
| ER-1-19 | 대외 전문 활동 섹션 확인 | AUTOMATABLE | |
| ER-1-21 | 미등록 항목 — 영역 미노출 | AUTOMATABLE | |
| ER-1-22 | 학사 미입력 — 학력 미노출 | AUTOMATABLE | |
| ER-1-23 | 학사만 입력 — 학사만 표시 | AUTOMATABLE | |
| ER-1-24 | 근무 이력 미등록 — 섹션 미노출 | AUTOMATABLE | |
| ER-1-25 | 상세 분야 2개 — TOP3 중 2개만 노출 | AUTOMATABLE | |
| ER-1-26 | PDF 저장 — 업로드 자료보기 버튼 영역 제거 | AUTOMATABLE | |
| ER-1-27 | PDF — 잘리는 그래프 다음 페이지 이동 | AUTOMATABLE | |
| ER-1-28 | PDF — 긴 텍스트 잘리는 그대로 노출 | AUTOMATABLE | |
| ER-2-01 | 법인 프로필 리포트 탭 선택 — 법인 전체 기준 리포트 | AUTOMATABLE | |
| ER-2-02 | 그룹 선택 드롭다운에서 그룹 선택 | AUTOMATABLE | |
| ER-2-03 | 멤버 선택 "멤버 전체" — 전체 멤버 기준 리포트 | AUTOMATABLE | |
| ER-2-04 | 멤버 선택 특정 인물 — 개인 프로필 형식 리포트 | AUTOMATABLE | |
| ER-2-05 | PDF 저장 버튼 선택 | AUTOMATABLE | |
| ER-2-06 | 파일 업로드(링크 추출) 버튼 선택 | AUTOMATABLE | |
| ER-2-07 | 대표 세무사 프로필 보기 버튼 — 새 탭 열림 | AUTOMATABLE | |
| ER-2-11 | 법인 리포트 제목 — "{법인명} 프로필 리포트" 형식 | AUTOMATABLE | |
| ER-2-12 | 비세무사 소유자 — 법인 탭만 표시 | AUTOMATABLE | |
| ER-2-13 | 기본 정보 섹션 확인 | AUTOMATABLE | |
| ER-2-14 | 관계사 정보 등록된 법인 — 관계사 영역 노출 | AUTOMATABLE | |
| ER-2-15 | 소속 세무사 요약 섹션 확인 | AUTOMATABLE | |
| ER-2-16 | 전문 영역별 실적 섹션 확인 | AUTOMATABLE | |
| ER-2-17 | "법인 전체" 선택 — 그룹 선택 드롭다운 확인 | AUTOMATABLE | |
| ER-2-18 | 특정 그룹 선택 — 멤버 드롭다운 노출 순서 확인 | AUTOMATABLE | |
| ER-2-19 | 프로필 업데이트 일시 확인 | AUTOMATABLE | |
| ER-2-20 | 대외 전문 활동 섹션 확인 | AUTOMATABLE | |
| ER-2-31 | 법무사·행정사 자격 보유자 없음 — 해당 행 미노출 | AUTOMATABLE | |
| ER-2-32 | 전문 영역 2개 — 2개 영역만 노출 | AUTOMATABLE | |
| ER-2-33 | 산업 분야 3개 — TOP3으로 3개만 노출 | AUTOMATABLE | |
| ER-2-34 | 석·박사 출신 0명 — 해당 항목 미노출 | AUTOMATABLE | |
| ER-2-35 | PDF 저장 — 업로드/프로필 보기 버튼 영역 제거 | AUTOMATABLE | |
| ER-2-36 | PDF — 잘리는 그래프 다음 페이지 이동 | AUTOMATABLE | |
| ER-2-37 | 관계사 없는 법인 — 관계사 영역 미노출 | AUTOMATABLE | |
| ER-3-01 | 공유 링크 URL로 접근 — 리포트 콘텐츠 표시 | AUTOMATABLE | |
| ER-3-02 | 미리보기 화면 — 인쇄 버튼 선택 | AUTOMATABLE | |
| ER-3-03 | 미리보기 화면 — PDF 저장 버튼 선택 | AUTOMATABLE | |
| ER-3-04 | 접근 불가 안내 화면 — 홈으로 버튼 선택 | AUTOMATABLE | |
| ER-3-11 | 미리보기 — 리포트 링크 생성 정보 확인 | AUTOMATABLE | |
| ER-3-12 | 개인 프로필 공유 링크 — 리포트 형식 확인 | AUTOMATABLE | |
| ER-3-13 | 법인 프로필 공유 링크 — 리포트 형식 확인 | AUTOMATABLE | |
| ER-3-14 | 미리보기 화면 상단 영역 확인 | AUTOMATABLE | |
| ER-3-21 | 유효하지 않은 공유 링크 — 접근 불가 안내 화면 | AUTOMATABLE | |
| ER-3-22 | 비로그인 상태 — 유효한 공유 링크 정상 표시 | AUTOMATABLE | |

---

## GO — 현직공무원탐색

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| GO-0-01 | U2/구독 취소 계열 — 접근 차단, 구독 유도 | AUTOMATABLE | |
| GO-0-02 | U2+U5(세무사 미구독) — 접근 차단, 구독 유도 | AUTOMATABLE | |
| GO-0-03 | U2+U9(일반 Pro) — 공통 관계망 미제공 | AUTOMATABLE | |
| GO-0-04 | U2+U3+U9(팀 소유자) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-05 | U2+U4+U9(팀 구성원) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-06 | U2+U5+U9(세무사 Pro) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-07 | U2+U7+U9(세무법인 구성원) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-08 | U2+U5+U7+U9(세무법인 구성원 세무사) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-09 | U2+U7+U8+U9(세무법인 관리자) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-10 | U2+U5+U7+U8+U9(세무법인 관리자 세무사) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-11 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-0-12 | U2+U3+U6+U9(세무법인 소유자 비세무사) — 공통 관계망 제공 | AUTOMATABLE | |
| GO-1-01 | GNB > 현직 공무원 탐색 이동 — 필터 초기 상태 | AUTOMATABLE | |
| GO-1-02 | 소속(청/서) 선택란 탭 — 메뉴 펼쳐짐 | AUTOMATABLE | |
| GO-1-03 | 소속(청/서) 하나 선택 — 소속(국실) 활성화 | AUTOMATABLE | |
| GO-1-04 | 소속(국실) 선택란 탭 — 국실 목록 표시 | AUTOMATABLE | |
| GO-1-05 | 소속(국실) 하나 선택 — 소속(과) 활성화 | AUTOMATABLE | |
| GO-1-06 | 소속(과) 선택란 탭 — 과 목록 표시 | AUTOMATABLE | |
| GO-1-07 | 소속(과) 하나 선택 — 소속(팀) 활성화 | AUTOMATABLE | |
| GO-1-08 | 소속(과) 선택 — 소속(팀) 선택란 탭 | AUTOMATABLE | |
| GO-1-09 | 소속 미선택 — 직급 선택란 단독 탭 | AUTOMATABLE | |
| GO-1-10 | 소속 미선택 — 직책 선택란 단독 탭 | AUTOMATABLE | |
| GO-1-11 | 공무원명 입력란에 이름 입력 | AUTOMATABLE | |
| GO-1-12 | 검색 버튼 탭 — 조건 맞는 목록 표시 | AUTOMATABLE | |
| GO-1-13 | 초기화 버튼 탭 — 모든 필터 초기화 | AUTOMATABLE | |
| GO-1-14 | 공무원 행 탭 — 프로필 상세 새 창 | AUTOMATABLE | |
| GO-1-15 | 조직도 보기 버튼 탭 — 조직도 팝업 | AUTOMATABLE | |
| GO-1-16 | 관계망 찾기 탭 — 인맥 관계 분석 결과 | AUTOMATABLE | |
| GO-1-17 | U2+U5+U9 — 공무원 출신: 본인 기준 공통 관계 | AUTOMATABLE | |
| GO-1-18 | U2+U5+U7+U9 — 비교 대상 드롭다운 탭 | AUTOMATABLE | |
| GO-1-19 | U2+U5+U7+U9(공무원 출신) — 기본값 "법인전체 - 본인" | AUTOMATABLE | |
| GO-1-20 | U2+U7+U9(비공무원 출신) — 기본값 "법인전체 - 전체" | AUTOMATABLE | |
| GO-1-21 | 관계망 결과 — 한눈에 보기 버튼 탭 | AUTOMATABLE | |
| GO-1-22 | 관계망 조건 추가 후 적용 | AUTOMATABLE | |
| GO-1-24 | 전직 공무원 찾기 탭 선택 — 화면 이동 | AUTOMATABLE | |
| GO-1-25 | 세무사 찾기 탭 선택 — 화면 이동 | AUTOMATABLE | |
| GO-1-31 | 검색 결과 10건 이상 — 기본 10건씩, 페이지네이션 | AUTOMATABLE | |
| GO-1-32 | 다음 페이지 탭 — 다음 10건 표시 | AUTOMATABLE | |
| GO-1-34 | 텍스트 생략 셀 호버 — 전체 텍스트 노출 | AUTOMATABLE | |
| GO-1-35 | 결과 건수 표시 확인 | AUTOMATABLE | |
| GO-1-36 | 공통 소속 없음 — 조직도 보기 버튼 비활성화 | AUTOMATABLE | |
| GO-1-37 | 탐색 탭 영역 확인 — 현직 공무원 정보 탐색 탭 활성 | AUTOMATABLE | |
| GO-1-40 | 검색 결과 행 호버 — 화살표 노출 | AUTOMATABLE | |
| GO-1-42 | GNB 로고 탭 — 홈 이동 | AUTOMATABLE | |
| GO-1-51 | 존재하지 않는 조건으로 검색 — 빈 상태 안내 | AUTOMATABLE | |
| GO-1-52 | 하단 스크롤 — 필터 영역 숨김 | AUTOMATABLE | |
| GO-1-53 | 상단 스크롤 — 필터 영역 다시 표시 | AUTOMATABLE | |
| GO-1-54 | U2+U9(일반 Pro) — 공통 관계망 찾기 기능 미제공 | AUTOMATABLE | |
| GO-2-01 | 공무원 행 탭 — 프로필 상세 새 창 | AUTOMATABLE | |
| GO-2-02 | 조직도 보기 버튼 탭 — 소속 청/서 조직도 팝업 | AUTOMATABLE | |
| GO-2-03 | (납세자)추천 세무사 카드 탭 — 세무사 프로필 이동 | AUTOMATABLE | |
| GO-2-04 | (납세자)관계 자세히 보기 버튼 탭 | AUTOMATABLE | |
| GO-2-05 | (납세자)추천 세무사 10건 이상 — 페이지네이션 | AUTOMATABLE | |
| GO-2-06 | (납세자)프로필 상세(새 창) — 검색 필터 미제공 확인 | AUTOMATABLE | |
| GO-2-07 | (비공무원 세무사)관계망 찾기 버튼 탭 | AUTOMATABLE | |
| GO-2-08 | (공무원 출신 세무사)공통 관계/공무원 내 공통관계 탭 조작 | AUTOMATABLE | |
| GO-2-09 | 관계망 그래프 — 인명카드 클릭 시 포커싱 | AUTOMATABLE | |
| GO-2-10 | 관계 리스트 — 프로필 카드별 프로필 조회 버튼 클릭 | AUTOMATABLE | |
| GO-2-11 | (납세자)추천 세무사 0건 — 미노출 확인 | AUTOMATABLE | |
| GO-2-11 | 프로필 상세 — 현직 공무원 정보 확인 | AUTOMATABLE | |
| GO-2-12 | 복수 학력 — 학력사항 순서 확인 | AUTOMATABLE | |
| GO-2-13 | 근무 이력 — 현재 재직 정보 최상단 강조 | AUTOMATABLE | |
| GO-2-14 | 근무 이력 다수 — 호버 시 스크롤바 노출 | AUTOMATABLE | |
| GO-2-15 | (납세자)추천 세무사 카드 확인 | AUTOMATABLE | |
| GO-2-16 | (납세자)추천 세무사 총 건수 확인 | AUTOMATABLE | |
| GO-2-17 | 프로필 상세(새 창) — GNB 헤더 확인 | AUTOMATABLE | |
| GO-2-21 | 학력사항 없는 공무원 — 항목 미표시 | AUTOMATABLE | |
| GO-2-22 | 추천 세무사 0건 — 빈 상태 안내 | AUTOMATABLE | |
| GO-2-23 | 일부 항목만 데이터 있는 공무원 — 있는 항목만 표시 | AUTOMATABLE | |

---

## HOME-TA — 홈/GNB/알림 (세무사)

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| HOME-TA-0-01 | U2+U5(세무사 미구독) — 세무사 찾기 탭만, 구독 유도 | AUTOMATABLE | |
| HOME-TA-0-02 | U2+U5+U9(세무사 Pro) — 모든 탭 이용 가능 | AUTOMATABLE | |
| HOME-TA-0-03 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — 모든 탭 + TOP10 | AUTOMATABLE | |
| HOME-TA-0-04 | U2+U3+U6+U9(세무법인 소유자 비세무사) — 인사말 "세무사" 호칭 생략 | AUTOMATABLE | |
| HOME-TA-0-05 | U2+U5+U7+U9(세무법인 구성원 세무사) — 모든 탭 이용 가능 | AUTOMATABLE | |
| HOME-TA-0-06 | U2+U5+U7+U8+U9(세무법인 관리자 세무사) — 모든 탭 이용 가능 | AUTOMATABLE | |
| HOME-TA-0-07 | U2+U4+U5+U9(팀 구성원 세무사) — 모든 탭 이용 가능 | AUTOMATABLE | |
| HOME-TA-0-08 | U2+U5(미구독) — GNB 세무 이력 관리/리포트 미표시 | AUTOMATABLE | |
| HOME-TA-0-09 | U2+U5+U9(세무사 Pro) — GNB PRO 태그 + 메뉴 표시 | AUTOMATABLE | |
| HOME-TA-0-10 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — GNB TEAM 태그 + 법인 멤버 관리 | AUTOMATABLE | |
| HOME-TA-0-11 | U2+U3+U6+U9(세무법인 소유자 비세무사) — GNB TEAM 태그 + 법인 멤버 관리 | AUTOMATABLE | |
| HOME-TA-0-12 | U2+U5+U7+U9(세무법인 구성원 세무사) — GNB TEAM 태그 + 법인명 | AUTOMATABLE | |
| HOME-TA-0-13 | U2+U5+U7+U8+U9(세무법인 관리자 세무사) — GNB 관리자+TEAM 태그 | AUTOMATABLE | |
| HOME-TA-0-14 | U2+U4+U5+U9(팀 구성원 세무사) — GNB TEAM 태그 | AUTOMATABLE | |
| HOME-TA-1-01 | U2+U5(미구독) — 홈 화면 실행, 세무사 찾기 탭 기본 | AUTOMATABLE | |
| HOME-TA-1-02 | U2+U5+U9 — 현직 공무원 정보 탐색 탭 선택 | AUTOMATABLE | |
| HOME-TA-1-03 | U2+U5(미구독) — 현직 공무원 탭 구독 유도 요소 | AUTOMATABLE | |
| HOME-TA-1-04 | U2+U5+U9 — 전직 공무원 찾기 탭 선택 | AUTOMATABLE | |
| HOME-TA-1-05 | U2+U5(미구독) — 전직 공무원 찾기 탭 구독 유도 | AUTOMATABLE | |
| HOME-TA-1-06 | U2+U5(미구독) — 세무사 찾기 탭 선택 | AUTOMATABLE | |
| HOME-TA-1-07 | 현직 공무원 탐색 탭 — 소속 선택 후 검색 | AUTOMATABLE | |
| HOME-TA-1-08 | 전직 공무원 찾기 탭 — 소속 선택 후 검색 | AUTOMATABLE | |
| HOME-TA-1-09 | 세무사 찾기 탭 — 지역 선택 후 검색 | AUTOMATABLE | |
| HOME-TA-1-10 | 초기화 버튼 탭 — 모든 필터 초기화 | AUTOMATABLE | |
| HOME-TA-1-11 | U5 보유(세무사) — 인사말 "{이름} 세무사님" | AUTOMATABLE | |
| HOME-TA-1-12 | U5 미보유(비세무사) — 인사말 "{이름}님" | AUTOMATABLE | |
| HOME-TA-1-13 | 최근 조회 프로필 9건 초과 — 최대 9개 최근 조회순 | AUTOMATABLE | |
| HOME-TA-1-14 | 새로운 알림 존재 — 레드닷 표시 | AUTOMATABLE | |
| HOME-TA-1-15 | U6 미보유 — TOP10 영역 미표시 | AUTOMATABLE | |
| HOME-TA-1-16 | U9 보유 — 멤버십 배너 미표시 | AUTOMATABLE | |
| HOME-TA-1-17 | U9 미보유 — 멤버십 배너 표시 | AUTOMATABLE | |
| HOME-TA-1-18 | 현직 공무원 탐색 필터 — 상위 미선택 시 하위 비활성 | AUTOMATABLE | |
| HOME-TA-1-19 | 세무사 찾기 탭 — 지역 미선택 시 지역 상세 비활성 | AUTOMATABLE | |
| HOME-TA-1-20 | 각 탭별 안내 문구 표시 | AUTOMATABLE | |
| HOME-TA-1-21 | 최근 조회 프로필 0건 — 빈 상태 안내 | AUTOMATABLE | |
| HOME-TA-1-22 | 현직 공무원 탐색 탭 — 없는 조건 검색 빈 상태 | AUTOMATABLE | |
| HOME-TA-1-23 | 전직 공무원 찾기 탭 — 없는 조건 검색 빈 상태 | AUTOMATABLE | |
| HOME-TA-1-24 | 세무사 찾기 탭 — 없는 조건 검색 빈 상태 | AUTOMATABLE | |
| HOME-TA-1-25 | 세무사 찾기 탭 — DB에 없는 세무법인명 자동완성 미제공 | AUTOMATABLE | |
| HOME-TA-1-26 | 필터 미입력 — 검색 버튼 비활성 | AUTOMATABLE | |
| HOME-TA-1-27 | 필터에 값 하나 입력 — 검색 버튼 활성화 | AUTOMATABLE | |
| HOME-TA-1-31 | 세무사 찾기 탭 — 세무법인명 텍스트 입력 시 자동완성 | AUTOMATABLE | |
| HOME-TA-1-32 | 세무사 찾기 탭 — 지역 필터 선택 | AUTOMATABLE | |
| HOME-TA-1-33 | 최근 조회 프로필 카드 탭 — 프로필 상세 이동 | AUTOMATABLE | |
| HOME-TA-1-34 | 전체보기 탭 — 최근 조회 프로필 전체보기 화면 이동 | AUTOMATABLE | |
| HOME-TA-1-35 | U2+U3+U5+U6+U9 — TOP10 세무법인 영역 확인 | AUTOMATABLE | |
| HOME-TA-1-36 | TOP10 세무법인 항목 탭 — 연결 세무법인 홈페이지 이동 | AUTOMATABLE | |
| HOME-TA-1-37 | U2+U5(미구독) — 멤버십 안내 배너 탭 | AUTOMATABLE | |
| HOME-TA-2-01 | GNB 사용자 아이콘 탭 — GNB 메뉴 오픈 | AUTOMATABLE | |
| HOME-TA-2-02 | GNB — 세무 이력 관리 메뉴 탭 | AUTOMATABLE | |
| HOME-TA-2-03 | GNB — 세무 이력 리포트 메뉴 탭 | AUTOMATABLE | |
| HOME-TA-2-04 | GNB — 내 정보 메뉴 탭 | AUTOMATABLE | |
| HOME-TA-2-05 | GNB — 구독 정보 메뉴 탭 | AUTOMATABLE | |
| HOME-TA-2-06 | GNB — 법인 멤버 관리 메뉴 탭 | AUTOMATABLE | |
| HOME-TA-2-07 | GNB — 문의하기 메뉴 탭 | AUTOMATABLE | |
| HOME-TA-2-08 | GNB — 로그아웃 탭 | AUTOMATABLE | |
| HOME-TA-2-11 | U2+U5+U9 — GNB PRO 태그, 개인사무소명 표시 | AUTOMATABLE | |
| HOME-TA-2-12 | U2+U5(미구독) — GNB 태그 미표시 | AUTOMATABLE | |
| HOME-TA-2-13 | U2+U3+U5+U6+U9 — GNB TEAM 태그, 법인명 | AUTOMATABLE | |
| HOME-TA-2-14 | U2+U5+U7+U9 — GNB TEAM 태그, 법인명 | AUTOMATABLE | |
| HOME-TA-2-15 | U2+U5+U7+U8+U9 — GNB 관리자+TEAM 태그, 법인명 | AUTOMATABLE | |
| HOME-TA-2-16 | U2+U4+U5+U9 — GNB TEAM 태그, 소속 법인명 | AUTOMATABLE | |
| HOME-TA-2-17 | U9 미보유 — GNB 세무 이력 관리/리포트 미표시 | AUTOMATABLE | |
| HOME-TA-2-18 | U9 보유 — GNB 기본 메뉴 + 세무 이력 관리/리포트 | AUTOMATABLE | |
| HOME-TA-2-19 | U6/U8 미보유 — GNB 법인 멤버 관리 미표시 | AUTOMATABLE | |
| HOME-TA-3-01 | 새로운 알림 존재 — 알림 목록 오픈, 레드닷 사라짐 | AUTOMATABLE | |
| HOME-TA-3-02 | 세무 이력 관리 작성 안내 알림 — 바로가기 탭 | AUTOMATABLE | |
| HOME-TA-3-03 | 이력 검토 진행중 알림 — 바로가기 탭 | AUTOMATABLE | |
| HOME-TA-3-04 | 이력 반려 알림 — 바로가기 탭 | AUTOMATABLE | |
| HOME-TA-3-05 | 이력 보완 요청 알림 — 바로가기 탭 | AUTOMATABLE | |
| HOME-TA-3-06 | 법인 소속 초대 알림 — 승인 버튼 탭 | AUTOMATABLE | |
| HOME-TA-3-07 | 법인 소속 초대 알림 — 거부 버튼 탭 | AUTOMATABLE | |
| HOME-TA-3-08 | 법인 관리자 초대 알림 — 승인 버튼 탭 | AUTOMATABLE | |
| HOME-TA-3-09 | 법인 관리자 초대 알림 — 거부 버튼 탭 | AUTOMATABLE | |
| HOME-TA-3-10 | U6(소유자) — 멤버 연동 해제 알림 바로가기 탭 | AUTOMATABLE | |
| HOME-TA-3-11 | 알림 여러 건 — 새로운 알림 상위 정렬 | AUTOMATABLE | |
| HOME-TA-3-12 | 세무사 가입 직후 — 세무 이력 관리 작성 안내 알림 | AUTOMATABLE | |
| HOME-TA-3-13 | 이력 제출 세무사 — 검토 대기 상태 알림 (액션 버튼 없음) | AUTOMATABLE | |
| HOME-TA-3-14 | 이력 제출 세무사 — 승인 상태 알림 (액션 버튼 없음) | AUTOMATABLE | |
| HOME-TA-3-15 | U6(소유자) — 멤버 초대 수락/거부 결과 알림 | AUTOMATABLE | |
| HOME-TA-3-17 | 법인 연결 해제된 구성원 — 법인 연결 해제 알림 | AUTOMATABLE | |
| HOME-TA-3-19 | 세무 공무원 출신 세무사 — 인증 안내 알림 | AUTOMATABLE | |
| HOME-TA-3-21 | 알림 0건 — 빈 상태 안내 | AUTOMATABLE | |
| HOME-TA-3-22 | 새로운 알림 없음 — 레드닷 미표시 | AUTOMATABLE | |
| HOME-TA-3-31 | U6(소유자) — 관계사 태그 부여 알림 바로가기 탭 | AUTOMATABLE | |
| HOME-TA-3-32 | 세무사 인증 안내 알림 — 인증하러가기 탭 | AUTOMATABLE | |
| HOME-TA-4-01 | 전체보기 탭 — 전체 목록 표시 | AUTOMATABLE | |
| HOME-TA-4-02 | 전체보기 — 현직 공무원 프로필 카드 탭 | AUTOMATABLE | |
| HOME-TA-4-03 | 전체보기 — 전직 공무원 프로필 카드 탭 | AUTOMATABLE | |
| HOME-TA-4-04 | 전체보기 — 세무사 프로필 카드 탭 | AUTOMATABLE | |
| HOME-TA-4-05 | 전체보기 — 뒤로가기 탭 | AUTOMATABLE | |
| HOME-TA-4-11 | 최근 조회 순서 정렬 확인 | AUTOMATABLE | |
| HOME-TA-4-12 | 현직 공무원 카드 — 이름, 소속, 직급, 직책 | AUTOMATABLE | |
| HOME-TA-4-13 | 전직 공무원 카드 — 이름, 은퇴 당시 소속, 직급, 직책 | AUTOMATABLE | |
| HOME-TA-4-14 | 세무사 카드 — 이름, 소속 법인, 소개 메시지 | AUTOMATABLE | |

---

## HOME-TP — 홈/GNB/알림 (납세자)

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| HOME-TP-0-01 | U2(미구독) — 홈 화면 진입 | AUTOMATABLE | |
| HOME-TP-0-02 | U2+U9(Pro) — 모든 탭 이용 가능 | AUTOMATABLE | |
| HOME-TP-0-03 | U2+U3+U9(팀 소유자) — 모든 탭 이용 가능 | AUTOMATABLE | |
| HOME-TP-0-04 | U2+U4+U9(팀 구성원) — 모든 탭 이용 가능 | AUTOMATABLE | |
| HOME-TP-0-05 | U2+U7+U8+U9(세무법인 관리자) — 전체 탭 이용 가능 | AUTOMATABLE | |
| HOME-TP-0-06 | U2+U7+U9(세무법인 구성원) — 전체 탭 이용 가능 | AUTOMATABLE | |
| HOME-TP-0-07 | U2+U7+U8+U9(세무법인 소유자 비세무사) — 전체 탭 이용 가능 | AUTOMATABLE | |
| HOME-TP-0-08 | U2(미구독) — GNB PRO 태그 미표시 | AUTOMATABLE | |
| HOME-TP-0-09 | U2+U9(Pro) — GNB PRO 태그 표시 | AUTOMATABLE | |
| HOME-TP-0-10 | U2+U3+U9(팀 소유자) — GNB 소유자+Team 태그 | AUTOMATABLE | |
| HOME-TP-0-11 | U2+U4+U9(팀 구성원) — GNB Team 태그 | AUTOMATABLE | |
| HOME-TP-0-12 | U2+U7+U8+U9(세무법인 관리자) — GNB 관리자+Team 태그 | AUTOMATABLE | |
| HOME-TP-0-13 | U2+U7+U9(세무법인 구성원) — GNB Team 태그 | AUTOMATABLE | |
| HOME-TP-0-14 | U2+U7+U8+U9(세무법인 소유자 비세무사) — GNB 소유자+Team 태그 | AUTOMATABLE | |
| HOME-TP-1-01 | 앱 실행 — 홈 화면 로딩, 세무사 찾기 탭 기본 | AUTOMATABLE | |
| HOME-TP-1-02 | 세무사 찾기 탭 선택 | AUTOMATABLE | |
| HOME-TP-1-03 | 현직 공무원 정보 탐색 탭 선택 | AUTOMATABLE | |
| HOME-TP-1-04 | U2(미구독) — 현직 공무원 탐색 탭 구독 유도 | AUTOMATABLE | |
| HOME-TP-1-06 | 세무사 찾기 탭 — 사무소명 자동완성 목록 | AUTOMATABLE | |
| HOME-TP-1-07 | DB에 없는 값 입력 — 자동완성 미제공 | AUTOMATABLE | |
| HOME-TP-1-08 | 세무사 찾기 탭 — 소속 사무소 지역 선택란 포커스 | AUTOMATABLE | |
| HOME-TP-1-09 | 지역 선택 — 지역 상세 활성화 | AUTOMATABLE | |
| HOME-TP-1-10 | 세무사 찾기 필터 값 입력 — 검색 버튼 탭 | AUTOMATABLE | |
| HOME-TP-1-11 | 현직 공무원 탐색 탭 — 소속(청) 선택 | AUTOMATABLE | |
| HOME-TP-1-12 | 소속(서/국) 선택 — 소속(과) 활성화 | AUTOMATABLE | |
| HOME-TP-1-12-01 | 소속(서/국) 전체 선택 — 소속(과) 비활성화 | AUTOMATABLE | |
| HOME-TP-1-13 | 소속(과) 선택 — 소속(팀) 활성화 | AUTOMATABLE | |
| HOME-TP-1-13-01 | 소속(과) 전체 선택 — 소속(팀) 비활성화 | AUTOMATABLE | |
| HOME-TP-1-14 | 현직 필터 값 입력 — 검색 버튼 탭 | AUTOMATABLE | |
| HOME-TP-1-15 | 초기화 버튼 탭 — 모든 필터 초기화 | AUTOMATABLE | |
| HOME-TP-1-16 | 최근 조회 프로필 카드 탭 — 프로필 상세 이동 | AUTOMATABLE | |
| HOME-TP-1-16-01 | 최근 조회 프로필 9개 이상 — 화살표 생성 및 전체보기 | AUTOMATABLE | |
| HOME-TP-1-17 | 전체보기 탭 — 전체보기 화면 이동 | AUTOMATABLE | |
| HOME-TP-1-18 | TOP10 세무법인 항목 탭 — 웹사이트 이동 | AUTOMATABLE | |
| HOME-TP-1-19 | 영역별 TOP10 항목 탭 — 웹사이트 이동 | AUTOMATABLE | |
| HOME-TP-1-20 | 미구독/구독 취소 — 멤버십 안내 배너 탭 | AUTOMATABLE | |
| HOME-TP-1-21 | 최근 조회 프로필 10건 이상 — 최대 9개, 최근 조회순 | AUTOMATABLE | |
| HOME-TP-1-22 | 새로운 알림 존재 — GNB 알림 아이콘 레드닷 | AUTOMATABLE | |
| HOME-TP-1-24 | 모든 계정 — TOP10 영역 표시 | AUTOMATABLE | |
| HOME-TP-1-25 | U9 포함 — 현직 공무원 탐색 탭 필터 구조 확인 | AUTOMATABLE | |
| HOME-TP-1-26 | 인사말 영역 — 사용자 이름과 안내 문구 | AUTOMATABLE | |
| HOME-TP-1-31 | 최근 조회 프로필 0건 — 빈 상태 안내 | AUTOMATABLE | |
| HOME-TP-1-32 | 세무사 찾기 필터 미입력 — 검색 버튼 비활성 | AUTOMATABLE | |
| HOME-TP-1-33 | 현직 공무원 필터 미입력 — 검색 버튼 비활성 | AUTOMATABLE | |
| HOME-TP-1-34 | 결과 0건 조건 세무사 검색 — 결과 없음 팝업 | AUTOMATABLE | |
| HOME-TP-1-35 | 결과 0건 조건 현직 공무원 검색 — 결과 없음 팝업 | AUTOMATABLE | |
| HOME-TP-1-36 | 검색 중 일시적 오류 — 에러 안내 표시 | AUTOMATABLE | |
| HOME-TP-1-37 | 검색 중 타임아웃 — 타임아웃 안내 표시 | AUTOMATABLE | |
| HOME-TP-1-38 | 지역 미선택 — 지역 상세 선택 시도 비활성 | AUTOMATABLE | |
| HOME-TP-1-39 | 소속(청) 미선택 — 소속(서/국) 선택 시도 비활성 | AUTOMATABLE | |
| HOME-TP-1-40 | 세무법인명 미입력 상태 — 자동완성 미제공 | AUTOMATABLE | |
| HOME-TP-1-41 | 전직 공무원 필터 미입력 — 검색 버튼 비활성 | AUTOMATABLE | |
| HOME-TP-1-42 | 결과 0건 조건 전직 공무원 검색 — 결과 없음 팝업 | AUTOMATABLE | |
| HOME-TP-2-01 | GNB 사용자 아이콘 탭 — GNB 메뉴 오픈 | AUTOMATABLE | |
| HOME-TP-2-02 | GNB — 내 정보 메뉴 탭 | AUTOMATABLE | |
| HOME-TP-2-03 | GNB — 구독 관리 메뉴 탭 | AUTOMATABLE | |
| HOME-TP-2-04 | GNB — 구독 멤버십 안내 메뉴 탭 | AUTOMATABLE | |
| HOME-TP-2-05 | GNB — 문의하기 메뉴 탭 | AUTOMATABLE | |
| HOME-TP-2-06 | U2+U3+U9(팀 소유자) — GNB 팀 멤버 관리 탭 | AUTOMATABLE | |
| HOME-TP-2-07 | U2+U7+U8+U9(관리자) — GNB 법인 멤버 관리 탭 | AUTOMATABLE | |
| HOME-TP-2-08 | U2+U7+U8+U9(관리자) — GNB 세무 이력 리포트 탭 | AUTOMATABLE | |
| HOME-TP-2-09 | U2+U7+U9(구성원) — GNB 세무 이력 리포트 탭 | AUTOMATABLE | |
| HOME-TP-2-10 | GNB — 로그아웃 탭 | AUTOMATABLE | |
| HOME-TP-2-11 | U2+U9(Pro) — GNB PRO 태그 표시 | AUTOMATABLE | |
| HOME-TP-2-12 | U2+U3+U9(팀 소유자) — GNB 소유자+Team 태그, 팀명 | AUTOMATABLE | |
| HOME-TP-2-13 | U2+U4+U9(팀 구성원) — GNB Team 태그 | AUTOMATABLE | |
| HOME-TP-2-14 | U2+U7+U8+U9(관리자) — GNB 관리자+Team 태그, 세무법인명 | AUTOMATABLE | |
| HOME-TP-2-15 | U2+U7+U9(구성원) — GNB Team 태그, 세무법인명 | AUTOMATABLE | |
| HOME-TP-2-16 | U2(미구독) — GNB 태그 미표시 | AUTOMATABLE | |
| HOME-TP-2-21 | U2+U4+U9(팀 구성원) — 팀 멤버 관리 메뉴 미표시 | AUTOMATABLE | |
| HOME-TP-2-22 | U2+U7+U9(구성원) — 법인 멤버 관리 메뉴 미표시 | AUTOMATABLE | |
| HOME-TP-3-01 | 새로운 알림 존재 — 알림 목록 오픈, 레드닷 사라짐 | AUTOMATABLE | |
| HOME-TP-3-02 | 법인 소속 초대 알림 — 승인 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-03 | 법인 소속 초대 알림 — 거부 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-04 | 법인 관리자 초대 알림 — 승인 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-05 | 법인 관리자 초대 알림 — 거부 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-06 | 일반 팀 소속 초대 알림 — 승인 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-07 | 일반 팀 소속 초대 알림 — 거부 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-08 | 법인 소유자→관리자 변경 알림 — 승인 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-09 | 법인 소유자→관리자 변경 알림 — 거부 버튼 탭 | AUTOMATABLE | |
| HOME-TP-3-10 | U8(관리자) — 멤버관리 바로가기 알림 탭 | AUTOMATABLE | |
| HOME-TP-3-11 | 알림 복수 건 — 새로운 알림 상위 정렬 | AUTOMATABLE | |
| HOME-TP-3-12 | U8(관리자) — 멤버 초대 수락/거부 결과 알림 | AUTOMATABLE | |
| HOME-TP-3-13 | 알림 읽은 지 1주(2주) 경과 — 자동 삭제 | AUTOMATABLE | |
| HOME-TP-3-21 | 알림 0건 — 빈 상태 안내 | AUTOMATABLE | |
| HOME-TP-4-01 | 전체보기 탭 — 전체 목록 표시 | AUTOMATABLE | |
| HOME-TP-4-02 | 전체보기 — 현직 공무원 프로필 카드 탭 | AUTOMATABLE | |
| HOME-TP-4-03 | 전체보기 — 전직 공무원 프로필 카드 탭 | AUTOMATABLE | |
| HOME-TP-4-04 | 전체보기 — 세무사 프로필 카드 탭 | AUTOMATABLE | |
| HOME-TP-4-05 | 전체보기 — 뒤로가기 탭 | AUTOMATABLE | |
| HOME-TP-4-11 | 최근 조회 순서 정렬 확인 | AUTOMATABLE | |
| HOME-TP-4-12 | 현직 공무원 카드 표시 확인 | AUTOMATABLE | |
| HOME-TP-4-13 | 전직 공무원 카드 표시 확인 | AUTOMATABLE | |
| HOME-TP-4-14 | 세무사 카드 — 이름, 공무원 출신 여부, 소속 법인, 지역, 전문 영역 | AUTOMATABLE | |

---

## MY — 내정보

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| MY-0-01 | U2 / U2+U9(납세자) — 내 정보 화면 접근 및 기본 구성 | AUTOMATABLE | |
| MY-0-02 | U2+U7+U9 / U2+U7+U8+U9(세무법인 구성원/관리자 납세자) — 소속 법인 정보 영역 | AUTOMATABLE | |
| MY-0-03 | U2+U5 / U2+U5+U9(세무사 개인) — 내 정보 화면 접근 | AUTOMATABLE | |
| MY-0-04 | U2+U5+U7+U9 / U2+U5+U7+U8+U9(세무법인 소속 세무사) — 내 정보 화면 | AUTOMATABLE | |
| MY-0-05 | U2+U3+U9(팀 소유자) — 소속 팀 정보 영역 | AUTOMATABLE | |
| MY-0_05-01 | U2+U3(팀 소유자 구독취소) — 내 정보 화면 | AUTOMATABLE | |
| MY-0-06 | U2+U4+U9 / U2+U4(팀 구성원) — 내 정보 화면 | AUTOMATABLE | |
| MY-0-07 | U2+U3+U6+U9(세무법인 비세무사 소유자) — 법인 정보 화면 | AUTOMATABLE | |
| MY-0-07-01 | U2+U6 / U2+U3+U6(세무법인 비세무사 소유자 미구독/구독취소) — 법인 정보 화면 | AUTOMATABLE | |
| MY-0-08 | U2+U3+U5+U6+U9(세무법인 세무사 소유자) — 법인 정보 화면 | AUTOMATABLE | |
| MY-0-08-01 | U2+U5+U6 / U2+U3+U5+U6(세무법인 세무사 소유자 미구독/구독취소) — 법인 정보 화면 | AUTOMATABLE | |
| MY-0-09 | U2+U4+U5+U9 / U2+U4+U5(팀 구성원 세무사) — 내 정보 화면 | AUTOMATABLE | |
| MY-1-01 | 납세자 UI — 계정 정보 조회 표시 | AUTOMATABLE | |
| MY-1-02 | 이메일 항목 "변경" 버튼 선택 — 모달 표시 | AUTOMATABLE | |
| MY-1-03 | 이메일 변경 모달 — 새 이메일 입력 후 인증 완료 | AUTOMATABLE | |
| MY-1-04 | 이메일 변경 모달 — "취소" 버튼 선택 | AUTOMATABLE | |
| MY-1-05 | 비밀번호 항목 "변경" 버튼 선택 — 모달 표시 | AUTOMATABLE | |
| MY-1-06 | 비밀번호 변경 모달 — 올바르게 입력 후 변경 | AUTOMATABLE | |
| MY-1-07 | 비밀번호 변경 모달 — "취소" 버튼 선택 | AUTOMATABLE | |
| MY-1-08 | 휴대폰 번호 항목 "변경" 버튼 선택 — 모달 표시 | AUTOMATABLE | |
| MY-1-09 | 휴대폰 번호 변경 모달 — 본인인증 재진행 완료 | MANUAL | 본인 인증 팝업 — 자동화 불가 |
| MY-1-10 | 휴대폰 번호 변경 모달 — "취소" 버튼 선택 | AUTOMATABLE | |
| MY-1-11 | 주소 항목 "변경" 버튼 선택 — 모달 표시 | AUTOMATABLE | |
| MY-1-12 | 주소 변경 모달 — 도로명주소 선택 후 변경 | AUTOMATABLE | |
| MY-1-13 | 주소 변경 모달 — "취소" 버튼 선택 | AUTOMATABLE | |
| MY-1-14 | 전화번호 항목 "변경" 버튼 선택 — 모달 표시 | AUTOMATABLE | |
| MY-1-14-01 | 전화번호 미입력 가입 계정 — 전화번호 없음 확인 | AUTOMATABLE | |
| MY-1-15 | 전화번호 변경 모달 — 입력 후 변경 | AUTOMATABLE | |
| MY-1-16 | 전화번호 변경 모달 — "취소" 버튼 선택 | AUTOMATABLE | |
| MY-1-17 | 회원탈퇴 링크 선택 — 확인 팝업 표시 | AUTOMATABLE | |
| MY-1-18 | 회원탈퇴 확인 팝업 — "탈퇴" 버튼 선택 | SKIP | 계정 완전 탈퇴, 복구 불가 |
| MY-1-19 | 회원탈퇴 확인 팝업 — "취소" 버튼 선택 | AUTOMATABLE | |
| MY-1-20 | 연동 해제 링크 선택 — 팝업 표시 | AUTOMATABLE | |
| MY-1-21 | 법인 연동 해제 확인 팝업 — "해제" 버튼 선택 | AUTOMATABLE | |
| MY-1-22 | 법인 연동 해제 확인 팝업 — "취소" 버튼 선택 | AUTOMATABLE | |
| MY-1-23 | 세무사 정보 영역 — 세무사 번호 읽기 전용 | AUTOMATABLE | |
| MY-1-24 | 이름 항목 — 읽기 전용 | AUTOMATABLE | |
| MY-1-25 | 휴대폰 번호 항목 — 본인 인증 완료 상태 표시 | AUTOMATABLE | |
| MY-1-26 | U2+U7+U9(세무법인 소속 납세자) — 소속 법인 정보 영역 | AUTOMATABLE | |
| MY-1-28 | U2+U9(납세자) — 주소, 전화번호 항목 표시 | AUTOMATABLE | |
| MY-1-29 | 세무 공무원 출신 세무사 — 세무사 번호 + 출신 여부 | AUTOMATABLE | |
| MY-1-33 | 이메일 변경 — 잘못된 인증번호 입력 에러 | AUTOMATABLE | |
| MY-1-34 | 비밀번호 변경 모달 — 유효성 규칙 미충족 에러 | AUTOMATABLE | |
| MY-1-35 | U2+U9(납세자) — 주소 미입력 상태 주소 항목 확인 | AUTOMATABLE | |
| MY-1-36 | 주소 변경 모달 — 주소 삭제하여 공란으로 변경 | AUTOMATABLE | |
| MY-1-37 | U2+U9(납세자) — 전화번호 미입력 상태 항목 확인 | AUTOMATABLE | |
| MY-1-38 | 이메일 유효성/중복 확인 | AUTOMATABLE | |
| MY-1-39 | 현재 비밀번호 불일치 — 인라인 에러 | AUTOMATABLE | |

---

## SP — 구독관리

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| SP-0-01 | U2(일반 개인 미구독) — 구독 관리 화면 접근 | AUTOMATABLE | |
| SP-0-02 | U2+U9(일반 개인 Pro) — 유료 구독 플랜 정보 표시 | AUTOMATABLE | |
| SP-0-03 | U2+U7+U9(세무법인 구성원 Team) — 구독 종료 안내 | AUTOMATABLE | |
| SP-0-04 | U2+U7(세무법인 구성원 Team 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-0-05 | U2+U7+U8+U9(세무법인 관리자 Team) — 화면 접근 | AUTOMATABLE | |
| SP-0-06 | U2+U7+U8(세무법인 관리자 Team 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-0-07 | U2+U4+U9(팀 구성원 Team) — 멤버십 변경·해지 불가 안내 | AUTOMATABLE | |
| SP-0-08 | U2+U4(팀 구성원 구독취소) — 구독 종료 안내 | AUTOMATABLE | |
| SP-0-09 | U2+U3+U9(팀 소유자 Team) — Team 멤버십 정보 표시 | AUTOMATABLE | |
| SP-0-10 | U2+U3(팀 소유자 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-0-11 | U2+U5(세무사 미구독) — 빈 상태 안내 | AUTOMATABLE | |
| SP-0-12 | U2+U5+U9(세무사 Pro) — 세무사 Pro 멤버십 정보 | AUTOMATABLE | |
| SP-0-13 | U2+U5+U7+U9(세무법인 구성원 세무사) — 변경·해지 불가 안내 | AUTOMATABLE | |
| SP-0-14 | U2+U5+U7(세무법인 구성원 세무사 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-0-15 | U2+U5+U7+U8+U9(세무법인 관리자 세무사) — 화면 접근 | AUTOMATABLE | |
| SP-0-16 | U2+U5+U7+U8(세무법인 관리자 세무사 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-0-17 | U2+U4+U5+U9(팀 구성원 세무사) — 화면 접근 | AUTOMATABLE | |
| SP-0-18 | U2+U4+U5(팀 구성원 세무사 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-0-19 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — Team 멤버십 정보 | AUTOMATABLE | |
| SP-0-20 | U2+U5+U6(세무법인 소유자 세무사 미구독) — 빈 상태 안내 | AUTOMATABLE | |
| SP-0-21 | U2+U3+U5+U6(세무법인 소유자 세무사 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-0-22 | U2+U3+U6+U9(세무법인 소유자 비세무사 Team) — 화면 접근 | AUTOMATABLE | |
| SP-0-23 | U2+U6(세무법인 소유자 비세무사 미구독) — 빈 상태 안내 | AUTOMATABLE | |
| SP-0-24 | U2+U3+U6(세무법인 소유자 비세무사 구독취소) — 화면 접근 | AUTOMATABLE | |
| SP-1-01 | 구독 이용자 — 구독 관리 화면 진입 | AUTOMATABLE | |
| SP-1-02 | 미구독 이용자 — 빈 상태 안내 | AUTOMATABLE | |
| SP-1-08 | 구독 이용자 — 구독 해지 버튼 선택 | AUTOMATABLE | |
| SP-1-09 | 해지 확인 다이얼로그 — "구독 해지" 선택 | AUTOMATABLE | |
| SP-1-10 | 해지 확인 다이얼로그 — "취소" 선택 | AUTOMATABLE | |
| SP-1-11 | 구독 해지 예약 상태 — 해지 철회 버튼 선택 | AUTOMATABLE | |
| SP-1-12 | 해지 철회 확인 다이얼로그 — "구독 해지 철회" 선택 | AUTOMATABLE | |
| SP-1-13 | 해지 철회 확인 다이얼로그 — "취소" 선택 | AUTOMATABLE | |
| SP-1-14 | 미구독 — 멤버십 안내 링크 선택 | AUTOMATABLE | |
| SP-1-16 | 팀 구성원 구독 이용자 — 변경 불가 안내 | AUTOMATABLE | |
| SP-1-17 | 세무법인 구성원 구독 이용자 — 법인 소속 안내 | AUTOMATABLE | |
| SP-1-18 | 세무법인 구성원 — "결제 내역" 탭 법인 안내 | AUTOMATABLE | |
| SP-1-19 | 팀 구성원 구독 취소 이용자 — 구독 종료일 안내 | AUTOMATABLE | |
| SP-1-20 | 구독 이용자 구독 취소 후 만료 전 — 청구 종료일 표시 | AUTOMATABLE | |
| SP-1-26 | 구독 관리 화면 — 하단 안내사항 확인 | AUTOMATABLE | |
| SP-1-31 | 미구독 이용자 — 나의 구독 영역 미구독 메시지 | AUTOMATABLE | |
| SP-1-32 | U2+U9 결제 내역 0건 — 빈 상태 안내 | AUTOMATABLE | |
| SP-2-01 | U2(납세자 미구독) — 멤버십 안내 화면 진입 | AUTOMATABLE | |
| SP-2-02 | U2+U9(납세자 Pro) — 멤버십 안내 화면 "구독 중" 표시 | AUTOMATABLE | |
| SP-2-03 | U2(납세자 미구독) — Pro 플랜 구독 버튼 선택 | AUTOMATABLE | |
| SP-2-06 | 구독 확인 다이얼로그 — "취소" 버튼 선택 | AUTOMATABLE | |
| SP-2-07 | U2+U4+U9(팀 구성원) — 구독 버튼 비활성, 안내 표시 | AUTOMATABLE | |
| SP-2-08 | U2+U5(개인 세무사 미구독) — Basic, Pro 플랜만 표시 | AUTOMATABLE | |
| SP-2-09 | U2+U3+U5+U6(세무법인 소유자 세무사 미구독) — Basic, Team 플랜만 | AUTOMATABLE | |
| SP-2-10 | U2+U3+U6(세무법인 소유자 비세무사 미구독) — Basic, Team 플랜만 | AUTOMATABLE | |
| SP-2-11 | 이벤트 적용 플랜 카드 — 정상가 취소선 + 이벤트 가격·기간 | AUTOMATABLE | |
| SP-2-13 | U2(납세자) — 납세자용 기능 설명 표시 | AUTOMATABLE | |
| SP-2-14 | U2+U5(세무사) — 세무사용 기능 설명 표시 | AUTOMATABLE | |
| SP-2-15 | 멤버십 안내 화면 — 상단 캐치 프레이즈 확인 | AUTOMATABLE | |
| SP-2-21 | U2+U7+U9(세무법인 구성원) — 구독 버튼 비활성/미표시 | AUTOMATABLE | |

---

## TA — 세무대리인찾기

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| TA-0-01 | U2(일반 미구독) — 세무사 찾기 목록 화면 표시 | AUTOMATABLE | |
| TA-0-02 | U2+U9(일반 Pro) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-0-03 | U2+U3+U9(팀 소유자) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-0-04 | U2+U4+U9(팀 구성원) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-0-07 | U2+U7+U9(세무법인 구성원) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-0-08 | U2+U5+U7+U9(세무법인 구성원 세무사) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-0-09 | U2+U7+U8+U9(세무법인 관리자) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-0-10 | U2+U3+U5+U6+U9(세무법인 소유자 세무사) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-0-11 | U2+U3+U6+U9(세무법인 소유자 비세무사) — 프로필 상세 이동 | AUTOMATABLE | |
| TA-1-01 | 세무사 찾기 이동 — 세무사 탭 기본 활성, 필터 초기 상태 | AUTOMATABLE | |
| TA-1-02 | 소속 사무소 지역 드롭다운 탭 — 시/도 드롭다운 펼쳐짐 | AUTOMATABLE | |
| TA-1-03 | 시/도 하나 선택 — 구/군 드롭다운 활성화 | AUTOMATABLE | |
| TA-1-04 | 시/도 선택 후 구/군 드롭다운 탭 — 구/군 목록 표시 | AUTOMATABLE | |
| TA-1-05 | 세무법인명 입력란 텍스트 입력 — 자동완성 목록 | AUTOMATABLE | |
| TA-1-06 | 세무사명 입력란 이름 입력 | AUTOMATABLE | |
| TA-1-07 | 검색 버튼 탭 — 검색 결과 표시 | AUTOMATABLE | |
| TA-1-08 | 초기화 버튼 탭 — 모든 필터 초기화 | AUTOMATABLE | |
| TA-1-09 | 세무사 탭 활성 — 세무법인 탭 선택 | AUTOMATABLE | |
| TA-1-10 | 세무법인 탭 활성 — 세무사 탭 선택 | AUTOMATABLE | |
| TA-1-11 | 세무사 카드 탭 — 프로필 상세 화면 이동 | AUTOMATABLE | |
| TA-1-13 | 웹사이트 등록 세무법인 카드 호버 — 웹사이트 링크 표시 | AUTOMATABLE | |
| TA-1-14 | 상세 필터 카테고리 조건 선택 — 목록 즉시 갱신 | AUTOMATABLE | |
| TA-1-15 | 현직 공무원 정보 탐색 탭 선택 | AUTOMATABLE | |
| TA-1-16 | 전직 공무원 찾기 탭 선택 | AUTOMATABLE | |
| TA-1-17 | 세무사 10건 이상 — 결과 목록 10건씩 표시 | AUTOMATABLE | |
| TA-1-18 | 세무법인 10건 이상 — 결과 목록 10건씩 표시 | AUTOMATABLE | |
| TA-1-19 | 세무사 10건 초과 — 페이지네이션 확인 | AUTOMATABLE | |
| TA-1-20 | 세무 공무원 출신 세무사 카드 — 출신 배지 표시 | AUTOMATABLE | |
| TA-1-21 | 세무사 검색 결과 — 전문분야 배지 표시 | AUTOMATABLE | |
| TA-1-23 | 세무법인 검색 결과 — TOP10 배지 표시 | AUTOMATABLE | |
| TA-1-24 | 세무법인 검색 결과 — 관계사 배지 표시 | AUTOMATABLE | |
| TA-1-25 | U2(납세자 미구독) — 전직 공무원 찾기 탭 미표시 | AUTOMATABLE | |
| TA-1-26 | 목록 화면 — 인사말 영역 확인 | AUTOMATABLE | |
| TA-1-27 | 필터 미입력 상태 — 필터 영역 비활성 | AUTOMATABLE | |
| TA-1-28 | 존재하지 않는 세무사명 검색 — 빈 상태 팝업 | AUTOMATABLE | |
| TA-1-29 | 존재하지 않는 세무법인명 검색 — 빈 상태 팝업 | AUTOMATABLE | |
| TA-2-01 | 세무사 카드 탭 후 프로필 상세 화면 로딩 | AUTOMATABLE | |
| TA-2-04 | 링크 복사 버튼 탭 — URL 클립보드 복사 | AUTOMATABLE | |
| TA-2-11 | 프로필 상세 — 프로필 사진 표시 | AUTOMATABLE | |
| TA-2-12 | 법인 소속 세무사 — 소속 정보(법인명+주소) 표시 | AUTOMATABLE | |
| TA-2-13 | 개인 사무소 세무사 — 소속 정보(사무소명+주소) 표시 | AUTOMATABLE | |
| TA-2-14 | 프로필 상세 — 경력(총 경력 연수) 표시 | AUTOMATABLE | |
| TA-2-15 | 조세심판원 출신 세무사 — 직책 정보 표시 | AUTOMATABLE | |
| TA-2-16 | 국가 공인 자격 보유 세무사 — 자격 정보 표시 | AUTOMATABLE | |
| TA-2-17 | 교수/강사/강의 경력 세무사 — 교육 경력 표시 | AUTOMATABLE | |
| TA-2-18 | 프로필 상세 — 전화번호 표시 | AUTOMATABLE | |
| TA-2-19 | 박사/석사/학사 학력 모두 있는 세무사 — 순서 확인 | AUTOMATABLE | |
| TA-2-20 | 프로필 상세 — 자기소개 표시 | AUTOMATABLE | |
| TA-2-21 | 프로필 상세 — 전문 영역 배지 표시 | AUTOMATABLE | |
| TA-2-22 | 승인된 실적 사례 — 인증 뱃지 표시 | AUTOMATABLE | |
| TA-2-23 | 프로필 상세 — 근무 이력 표시 | AUTOMATABLE | |
| TA-2-24 | 국세 공무 이력 세무사 — 공무원 태그 표시 | AUTOMATABLE | |
| TA-2-25 | 프로필 상세 — 실적 사례 표시 | AUTOMATABLE | |
| TA-2-26 | 프로필 상세 — 대외 전문 활동 표시 | AUTOMATABLE | |
| TA-2-27 | 모든 상세 데이터 없는 세무사 — 없음 표시 | AUTOMATABLE | |
| TA-2-28 | 근무 이력 5건 미만 — 전체 표시, 더보기 버튼 미표시 | AUTOMATABLE | |

---

## TF — 법인&팀연동관리

| TC-ID | 테스트명 | 분류 | 사유 |
|---|---|---|---|
| TF-0-01 | 세무법인 소유자 세무사 — 연동 관리 탭, 나의 연동+멤버 연동 | AUTOMATABLE | |
| TF-0-02 | 세무법인 소유자 비세무사 — 법인 멤버 관리 표시 | AUTOMATABLE | |
| TF-0-03 | 세무법인 관리자 세무사 — 연동 관리+그룹 관리, 법인 정보 관리 미표시 | AUTOMATABLE | |
| TF-0-04 | 세무법인 관리자 일반 — 세무사 관리자와 동일 | AUTOMATABLE | |
| TF-0-05 | 세무법인 구성원 세무사 — 나의 연동 상태만 표시 | AUTOMATABLE | |
| TF-0-06 | 세무법인 구성원 일반 — 나의 연동 상태만 표시 | AUTOMATABLE | |
| TF-0-07 | 세무법인 소유자 미구독 — 진입 가능, Team 플랜 구독 유도 | AUTOMATABLE | |
| TF-0-08 | 세무법인 소유자 구독취소 — 연동 관리만, 그룹 관리 비활성, 재구독 안내 | AUTOMATABLE | |
| TF-0-09 | 일반 이용자/세무법인 미소속 — 법인 멤버 관리 메뉴 미노출 | AUTOMATABLE | |
| TF-1-01 | 소유자/관리자 — 연동 관리 탭 활성, 나의 연동+멤버 연동 표시 | AUTOMATABLE | |
| TF-1-03 | 소유자/관리자 — 이름+이메일 입력하여 초대 | AUTOMATABLE | |
| TF-1-04 | 소유자/관리자 — 배정 그룹 드롭다운 선택 | AUTOMATABLE | |
| TF-1-05 | 소유자/관리자 — 권한 선택(일반/관리자) | AUTOMATABLE | |
| TF-1-06 | 소유자/관리자 — 모든 입력 완료 후 초대 버튼 탭 | AUTOMATABLE | |
| TF-1-07 | 소유자/관리자 — 이름/이메일 검색 및 초기화 | AUTOMATABLE | |
| TF-1-08 | 소유자/관리자 — 연동 해제 버튼 탭 | AUTOMATABLE | |
| TF-1-09 | 관리자 — 본인 관리자 권한 회수 버튼 탭 | AUTOMATABLE | |
| TF-1-10 | 구독 취소 소유자 — 전체 연동 해제 버튼 탭 | AUTOMATABLE | |
| TF-1-11 | 소유자/관리자 — 나의 연동 영역 확인 | AUTOMATABLE | |
| TF-1-12 | 멤버 10명 이상 — 페이지네이션 확인 | AUTOMATABLE | |
| TF-1-13 | 초대 직후 — 수락 대기중 상태 표시 | AUTOMATABLE | |
| TF-1-14 | 미구독 소유자 — Team 플랜 구독 유도 안내 + 링크 | AUTOMATABLE | |
| TF-1-15 | 소유자/관리자 구독 취소 — 그룹 관리 비활성, 초대 영역 제거 | AUTOMATABLE | |
| TF-1-21 | 소유자/관리자 — 미가입 이메일로 초대 시도 불가 | AUTOMATABLE | |
| TF-1-22 | 관리자 — 소유자 계정 연동 해제 시도 불가 | AUTOMATABLE | |
| TF-1-23 | 미구독 소유자 — 구독하러 가기 탭 | AUTOMATABLE | |
| TF-1-24 | 관리자 — 기구독 이메일로 초대 후 Team Plan 적용 | AUTOMATABLE | |
| TF-2-01 | 소유자/관리자 — 그룹 관리 탭 선택 | AUTOMATABLE | |
| TF-2-02 | 소유자/관리자 — 그룹 추가 버튼 선택 | AUTOMATABLE | |
| TF-2-03 | 그룹 존재 — 하위 그룹 추가 버튼 선택 | AUTOMATABLE | |
| TF-2-04 | 그룹 존재 — 그룹명 변경 실행 | AUTOMATABLE | |
| TF-2-05 | 그룹 존재(하위+멤버 포함) — 그룹 삭제 버튼 선택 | AUTOMATABLE | |
| TF-2-06 | 그룹에 멤버 존재 — 특정 그룹 선택 | AUTOMATABLE | |
| TF-2-07 | 멤버 분산 배치 — 멤버 선택 후 그룹 이동 | AUTOMATABLE | |
| TF-2-08 | 멤버 존재 — 이름/이메일로 검색 | AUTOMATABLE | |
| TF-2-09 | 법인 전체 선택 — 개별 멤버 소속 그룹 직접 변경 | AUTOMATABLE | |
| TF-2-11 | 그룹 여러 개 — 생성 시간순 정렬 | AUTOMATABLE | |
| TF-2-12 | 멤버 분산 — 법인 전체 선택 시 멤버 정렬 확인 | AUTOMATABLE | |
| TF-2-13 | 세무사+비세무사 혼재 — 태그/역할 구분 표시 | AUTOMATABLE | |
| TF-2-14 | 그룹 1개 이상 — 법인 전체 vs 그룹 선택 시 하단 버튼 | AUTOMATABLE | |
| TF-2-21 | 그룹 0개 — 빈 상태 안내 | AUTOMATABLE | |
| TF-2-22 | 멤버 없는 그룹 — 빈 상태 안내 | AUTOMATABLE | |
| TF-2-23 | 동일 위계 내 같은 이름 그룹 추가 시도 — 중복 불가 에러 | AUTOMATABLE | |
| TF-2-24 | 3단계(2차 하위) — 하위 추가 시도 불가 | AUTOMATABLE | |
| TF-3-01 | 소유자 — GNB > 법인 정보 선택 | AUTOMATABLE | |
| TF-3-02 | 소유자 — 검색 노출 토글 ON/OFF | AUTOMATABLE | |
| TF-3-03 | 소유자 — 대표 번호/주소 변경 | AUTOMATABLE | |
| TF-3-04 | 소유자 — 대표 이미지 변경/삭제 | AUTOMATABLE | |
| TF-3-05 | 소유자(세무사) — 대표 세무사 설정 선택 | AUTOMATABLE | |
| TF-3-06 | 소유자 — 이메일 변경 → 인증번호 입력 | AUTOMATABLE | |
| TF-3-07 | 소유자 — 비밀번호 변경 | AUTOMATABLE | |
| TF-3-08 | 소유자 — 휴대폰 번호 변경(재인증) | MANUAL | 본인 인증 팝업 — 자동화 불가 |
| TF-3-10 | 소유자 — 법인 계정 삭제(회원 탈퇴) | SKIP | 법인 계정 완전 삭제, 복구 불가 |
| TF-3-11 | 소유자 — 수정 불가 필드 확인(법인명, 등록 번호, 개업 일자) | AUTOMATABLE | |
| TF-3-13 | 비세무사 소유자 — 대표 세무사 설정에 본인 미포함 | AUTOMATABLE | |
| TF-3-21 | 소유자 — 잘못된 인증번호 입력 에러 | AUTOMATABLE | |
| TF-3-22 | 소유자 — 유효하지 않은 비밀번호 입력 에러 | AUTOMATABLE | |
| TF-3-23 | 법인 세무사 0명 — 대표 세무사 설정 빈 상태 | AUTOMATABLE | |
| TF-3-24 | 대표 이미지 미등록 — 빈 상태 안내 | AUTOMATABLE | |

