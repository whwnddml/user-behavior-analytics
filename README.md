# User Behavior Analytics

웹 사이트 사용자의 행동을 분석하기 위한 JavaScript 라이브러리입니다. 영역(Area) 기반의 사용자 행동 추적을 통해 상세한 UX 데이터를 수집하고 분석할 수 있습니다.

## 주요 기능

### 1. 영역 기반 분석
- 페이지 내 지정된 영역별 체류 시간 측정
- 영역별 사용자 상호작용 추적
- 뷰포트 가시성 분석

### 2. 스크롤 행동 분석
- 스크롤 깊이 추적
- 스크롤 패턴 분석
- 콘텐츠 소비 패턴 파악

### 3. 사용자 인터랙션 추적
- 클릭/터치 이벤트 추적
- 마우스 이동 패턴 분석
- 히트맵 데이터 수집

### 4. 폼 분석
- 폼 작성 시간 측정
- 필드별 오류 발생 추적
- 완료율 분석

## 시작하기

### 설치
```bash
# npm을 이용한 설치
npm install user-behavior-analytics

# yarn을 이용한 설치
yarn add user-behavior-analytics
```

### 기본 사용법
```html
<!-- 1. 스크립트 추가 -->
<script src="user-behavior-analytics.js"></script>

<!-- 2. 영역 정의 -->
<div class="area" data-area-id="main-content">
    콘텐츠 내용
</div>

<!-- 3. 초기화 -->
<script>
    document.addEventListener('DOMContentLoaded', () => {
        initAreaEngagement();
        initScrollTracking();
        initInteractionTracking();
        initFormAnalytics();
    });
</script>
```

## 데이터 수집 예시
```javascript
// 수집되는 데이터 형식
{
    sessionId: "session_1234567890",
    startTime: "2024-03-15T10:30:00Z",
    areaEngagement: {
        "main-content": {
            timeSpent: 45000,  // 45초
            interactions: 3,
            visibility: {
                visibleTime: 40000,
                viewportPercent: 75
            }
        }
    },
    scrollMetrics: {
        deepestScroll: 85,  // 85% 스크롤
        scrollPattern: [...]
    }
}
```

## 구성 요소

### 1. 클라이언트 스크립트
- `user-behavior-analytics.js`: 메인 분석 스크립트
- `area-tracker.js`: 영역 추적 모듈
- `scroll-tracker.js`: 스크롤 추적 모듈
- `interaction-tracker.js`: 상호작용 추적 모듈

### 2. 서버 컴포넌트
- RESTful API 서버
- PostgreSQL 데이터베이스
- 데이터 집계 및 분석 모듈

## 기술 스택
- Frontend: JavaScript (ES6+)
- Backend: Node.js + Express.js
- Database: PostgreSQL
- Analytics: Elasticsearch + Kibana

## 문서
- [퍼블리셔 가이드라인](퍼블리셔_가이드라인.md)
- [데이터베이스 설계](db.md)
- [API 문서](api.md)

## 기여하기
프로젝트에 기여하고 싶으시다면 다음 절차를 따라주세요:

1. 이 저장소를 포크합니다.
2. 새로운 브랜치를 생성합니다.
3. 변경사항을 커밋합니다.
4. 브랜치에 푸시합니다.
5. Pull Request를 생성합니다.

## 라이선스
이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요. 


참고
https://mermaid.live/

