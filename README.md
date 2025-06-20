# 🔍 사용자 행동 분석 시스템 (User Behavior Analytics)

실시간으로 웹사이트 사용자의 행동을 추적하고 분석하는 완전한 시스템입니다.

## 📋 주요 기능

### 🎯 **실시간 사용자 행동 추적**
- **영역별 상호작용**: 각 영역의 체류시간, 가시성, 클릭 수 추적
- **스크롤 분석**: 스크롤 깊이, 패턴, 속도 및 25/50/75/100% 이정표 기록
- **클릭 히트맵**: 모든 클릭과 마우스 이동을 좌표와 함께 기록
- **폼 분석**: 필드별 입력 시간, 오류 수, 완성도 추적
- **성능 메트릭**: 페이지 로딩 시간, First Paint, DOMContentLoaded 등

## 🚀 프로젝트 구조

```
user-behavior-analytics/
├── frontend/                  # 프론트엔드 코드
│   ├── index.html            # 메인 페이지
│   ├── analytics-dashboard.html # 분석 대시보드
│   ├── js/                   # JavaScript 파일
│   │   └── user-analytics.js # 분석 라이브러리
│   ├── css/                  # 스타일시트
│   └── docs/                 # 문서 및 이미지
│       └── images/           # 이미지 리소스
├── backend/                   # 백엔드 코드
│   ├── src/                  # 소스 코드
│   ├── tests/                # 테스트 파일
│   └── docs/                 # 백엔드 문서
├── docs/                     # 프로젝트 문서
└── README.md                 # 프로젝트 설명
```

## 🌐 배포

### 프론트엔드
- **플랫폼**: GitHub Pages
- **URL**: https://whwnddml.github.io/user-behavior-analytics
- **배포 방식**: GitHub Actions를 통한 자동 배포
- **트리거**: `frontend/` 디렉토리 변경 시

### 백엔드
- **플랫폼**: Render
- **URL**: https://user-behavior-analytics.onrender.com
- **배포 방식**: Render 자동 배포
- **트리거**: `backend/` 디렉토리 변경 시

## 🚀 시작하기

### 1. **프로젝트 클론**
```bash
git clone <repository-url>
cd user-behavior-analytics
```

### 2. **백엔드 설정**
```bash
cd backend

# 환경 변수 설정
cp env.example .env

# 종속성 설치
npm install

# 데이터베이스 실행 (Docker 필요)
docker-compose up -d

# 백엔드 서버 실행
npm run dev
```

### 3. **프론트엔드 실행**
```bash
cd frontend
python3 -m http.server 8080
# 또는
npx serve . --port 8080
```

### 4. **페이지 접속**
- **메인 데모**: http://localhost:8080/index.html
- **테스트 페이지**: http://localhost:8080/test-frontend.html

## 📝 문서

- [백엔드 API 문서](backend/README.md)
- [프론트엔드 가이드](frontend/README.md)
- [배포 가이드](docs/배포_전략.md)

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 🎮 사용법

### **자동 추적**
페이지를 로드하면 자동으로 다음을 수행합니다:
- 사용자 행동 추적 시작
- 30초마다 자동으로 백엔드에 데이터 전송
- 페이지 언로드 시 세션 종료

### **수동 제어**
브라우저 개발자 도구에서:
```javascript
// 현재 수집된 데이터 확인
window.analyticsHelpers.getCurrentData()

// 실시간 통계 확인
window.analyticsHelpers.getCurrentStats()

// 즉시 데이터 전송
window.analyticsHelpers.sendDataNow()

// 세션 종료
window.analyticsHelpers.endSession()

// 추적 중지
window.analyticsHelpers.stopTracking()
```

### **실시간 시각화**
- **스크롤 진행바**: 페이지 상단에 실시간 스크롤 진행률 표시
- **클릭 효과**: 클릭 시 파급 효과 애니메이션
- **영역 하이라이트**: 마우스 호버 시 추적 중인 영역 표시
- **분석 상태**: 우상단에 실시간 분석 상태 표시

## 📊 수집되는 데이터

### **세션 데이터**
```typescript
{
  sessionId: string,
  userAgent: string,
  ipAddress: string,
  deviceType: 'mobile' | 'tablet' | 'desktop',
  browserName: string,
  startTime: Date,
  endTime?: Date
}
```

### **페이지뷰 데이터**
```typescript
{
  sessionId: string,
  pageUrl: string,
  pageTitle: string,
  loadTime: number,
  domContentLoaded: number,
  firstPaint: number,
  firstContentfulPaint: number
}
```

### **영역 상호작용**
```typescript
{
  areaId: string,
  areaName: string,
  timeSpent: number,
  interactions: number,
  visibleTime: number,
  viewportPercent: number
}
```

### **스크롤 메트릭**
```typescript
{
  deepestScroll: number,
  scrollDepthBreakpoints: {
    25: timestamp,
    50: timestamp,
    75: timestamp,
    100: timestamp
  },
  scrollPattern: Array<{
    position: number,
    direction: 'up' | 'down',
    speed: number,
    timestamp: number
  }>
}
```

## 🔧 설정 및 커스터마이징

### **클라이언트 설정**
```javascript
// 커스텀 설정으로 분석 시스템 초기화
window.UserAnalytics = new UserAnalytics({
  apiEndpoint: 'http://localhost:3000/api/analytics',
  sendInterval: 30000,        // 30초마다 전송
  debug: true,                // 디버그 모드
  enableHeatmap: true,        // 히트맵 추적
  enableScrollTracking: true, // 스크롤 추적
  enableFormTracking: true,   // 폼 추적
  enablePerformanceTracking: true // 성능 추적
});
```

### **HTML 마크업**
추적할 영역에 `data-area-id` 속성 추가:
```html
<div class="area" data-area-id="header" data-area-name="헤더">
  <!-- 콘텐츠 -->
</div>
```

### **백엔드 설정**
`.env` 파일에서 데이터베이스 및 서버 설정:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uba
DB_USER=postgres
DB_PASSWORD=password
PORT=3000
NODE_ENV=development
```

## 🎯 API 엔드포인트

### **POST** `/api/analytics/collect`
사용자 행동 데이터 수집
```json
{
  "sessionId": "session_1234567890_abcdef",
  "pageUrl": "http://localhost:8080/index.html",
  "areaEngagements": [...],
  "scrollMetrics": {...},
  "interactionMap": [...],
  "formAnalytics": [...]
}
```

### **POST** `/api/analytics/session/end`
세션 종료
```json
{
  "sessionId": "session_1234567890_abcdef"
}
```

### **GET** `/api/analytics/health`
서버 상태 확인
```json
{
  "success": true,
  "message": "Analytics API is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🗄️ 데이터베이스 구조

### **주요 테이블**
- `sessions`: 사용자 세션 정보
- `pageviews`: 페이지뷰 및 성능 데이터
- `area_engagements`: 영역별 상호작용 데이터
- `scroll_metrics`: 스크롤 메트릭
- `scroll_patterns`: 상세 스크롤 패턴
- `interactions`: 클릭/마우스 이벤트
- `form_analytics`: 폼 분석 데이터
- `form_field_analytics`: 필드별 상세 데이터

## 🧪 테스트

### **연결 테스트**
1. `http://localhost:8080/test-frontend.html` 접속
2. "연결 재시도" 버튼으로 백엔드 연결 확인
3. "분석 시작" 버튼으로 추적 시스템 확인

### **기능 테스트**
1. 페이지 스크롤하여 스크롤 추적 확인
2. 다양한 영역 클릭하여 클릭 추적 확인
3. 폼 필드 입력하여 폼 분석 확인
4. "데이터 즉시 전송" 버튼으로 API 연동 확인

### **디버그 모드**
브라우저 콘솔에서 `[UserAnalytics]` 로그 확인

## 📈 활용 사례

### **사용자 경험 최적화**
- 사용자가 가장 많이 상호작용하는 영역 식별
- 스크롤 패턴 분석으로 콘텐츠 배치 최적화
- 폼 완성률 개선을 위한 문제 필드 식별

### **전환율 개선**
- 이탈 지점 분석
- A/B 테스트 결과 측정
- 사용자 여정 최적화

### **성능 모니터링**
- 페이지 로딩 성능 추적
- 사용자 기기별 성능 차이 분석

## 🔒 보안 및 개인정보

- IP 주소는 해시화하여 저장
- 민감한 폼 데이터는 수집하지 않음
- GDPR 준수를 위한 옵트아웃 기능 제공 가능

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 지원

문제가 발생하면 GitHub Issues에 등록하거나 개발자에게 문의하세요.

---

**🎉 이제 완전한 사용자 행동 분석 시스템을 사용할 준비가 되었습니다!**

## 로컬에서 html 실행
python3 -m http.server 8080
http://localhost:8080/frontend


postgres://brandiup:[PASSWORD]@[HOST]:[PORT]/uba
postgres://brandiup:6eYI50xOFMq98B1jOHMTrbCFxYaT1SKi@dpg-d18v2effte5s73bqn5dg-a:5432/uba_zfqs

external-db-url : 
postgresql://brandiup:6eYI50xOFMq98B1jOHMTrbCFxYaT1SKi@dpg-d18v2effte5s73bqn5dg-a.oregon-postgres.render.com/uba_zfqs
internal-db-url : postgresql://brandiup:6eYI50xOFMq98B1jOHMTrbCFxYaT1SKi@dpg-d18v2effte5s73bqn5dg-a/uba_zfqs



https://whwnddml.github.io/user-behavior-analytics/analytics-dashboard.html