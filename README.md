# 메이플스토리 공지사항 모니터링

메이플스토리 API를 통해 공지사항을 주기적으로 확인하고 변경사항을 디스코드로 알림하는 시스템입니다.

## 🚀 기능

- **주기적 확인**: GitHub Actions를 통해 3시간마다 자동 실행
- **변경 감지**: 새로운 공지사항 및 기존 공지사항 업데이트 감지
- **디스코드 알림**: 웹훅을 통한 실시간 알림
- **데이터 저장**: JSON 파일을 통한 이전 상태 저장

## 📋 설정 방법

### 1. GitHub Repository Secrets 설정

다음 secrets을 GitHub 저장소에 추가해야 합니다:

- `NEXON_API_KEY`: 넥슨 OpenAPI 키
  - 값: `live_6e97568399c555c37219677749db361c9eb42b3992c7013d96c6729fc9b7bec5c5f13ef0ee37522ba6d06225f0499c1c`
  
- `DISCORD_WEBHOOK_URL`: 디스코드 웹훅 URL
  - 디스코드 채널 설정 → 연동 → 웹후크 → 새 웹후크 생성

### 2. 디스코드 웹훅 생성 방법

1. 디스코드에서 알림을 받을 채널을 선택
2. 채널 설정 (톱니바퀴 아이콘) 클릭
3. **연동** → **웹후크** → **새 웹후크 생성**
4. 웹후크 이름을 설정 (예: "메이플 공지봇")
5. **웹후크 URL 복사** 클릭하여 URL 복사
6. GitHub Repository Settings → Secrets and variables → Actions → New repository secret
7. Name: `DISCORD_WEBHOOK_URL`, Secret: 복사한 웹훅 URL

## 🔧 로컬 테스트

```bash
# 환경 변수 설정
export NEXON_API_KEY="live_6e97568399c555c37219677749db361c9eb42b3992c7013d96c6729fc9b7bec5c5f13ef0ee37522ba6d06225f0499c1c"
export DISCORD_WEBHOOK_URL="your_discord_webhook_url"

# 스크립트 실행
node check-notice.js
```

## 📁 파일 구조

```
maple_notice/
├── .github/workflows/
│   └── notice-check.yml      # GitHub Actions 워크플로우
├── check-notice.js           # 메인 모니터링 스크립트
├── package.json              # 프로젝트 설정
├── notice-data.json          # 이전 상태 저장 (자동 생성)
└── README.md                 # 이 파일
```

## 📅 실행 일정

GitHub Actions는 매 3시간마다 실행됩니다:
- 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 (UTC 기준)

수동으로도 실행 가능합니다:
- GitHub Repository → Actions → "MapleStory Notice Monitor" → "Run workflow"

## 🎯 알림 유형

### 새로운 공지사항
- 🆕 새로운 공지사항이 등록되었을 때
- 제목, 링크, 등록일 포함

### 업데이트된 공지사항
- 📝 기존 공지사항의 제목이나 내용이 변경되었을 때
- 변경 전후 내용 비교

### 초기 실행
- 🍁 첫 실행시 현재 공지사항 목록 표시

## 🛠️ 문제 해결

### API 오류가 발생하는 경우
- API 키가 올바른지 확인
- API 서버 상태 확인
- 요청 제한(Rate Limit) 확인

### 디스코드 알림이 오지 않는 경우
- 웹훅 URL이 올바른지 확인
- 채널 권한 확인
- 웹훅이 삭제되지 않았는지 확인

## 📊 API 응답 예시

```json
{
  "notice": [
    {
      "notice_id": 12345,
      "notice_title": "공지사항 제목",
      "notice_url": "https://maplestory.nexon.com/...",
      "date_notice_created": "2025-01-01T12:00:00+09:00",
      "date_notice_modified": "2025-01-01T12:30:00+09:00"
    }
  ]
}
```