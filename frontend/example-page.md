# User Analytics 사용 가이드

## 1. 스크립트 포함하기

HTML 파일에 `user-analytics.js` 스크립트를 포함시킵니다. 성능 최적화를 위해 `</body>` 태그 바로 앞에 추가하는 것을 권장합니다.

```html
<script src="js/user-analytics.js"></script>
```

## 2. 영역 설정하기

추적하고 싶은 영역에 다음과 같은 클래스와 데이터 속성을 추가합니다.

### 필수 속성
- `class="area"`: 추적 영역 표시
- `data-area-id`: 고유한 영역 식별자
- `data-area-name`: 영역의 표시 이름

### 선택적 속성
- `data-area-type`: 영역의 유형 (예: header, content, footer 등)

### 예시
```html
<div class="area" 
     data-area-id="main-content" 
     data-area-name="메인 콘텐츠" 
     data-area-type="content">
    <!-- 영역 내용 -->
</div>
```

## 3. 초기화 설정 (선택사항)

페이지에서 UserAnalytics의 동작을 커스터마이즈하려면 다음과 같이 초기화 설정을 추가합니다.

```javascript
const analytics = new UserAnalytics({
    debug: true,              // 개발 중 로깅 활성화
    sendInterval: 30000,      // 데이터 전송 간격 (ms)
    enableHeatmap: true,      // 히트맵 추적
    enableScrollTracking: true, // 스크롤 추적
    enableFormTracking: true  // 폼 입력 추적
});
```

## 4. 환경별 설정

UserAnalytics는 자동으로 현재 환경을 감지하여 적절한 API 엔드포인트를 사용합니다.

- **개발 환경**: `http://localhost:3000`
- **프로덕션 환경** (GitHub Pages): `https://user-behavior-analytics.onrender.com`

## 5. 수집되는 데이터

UserAnalytics는 다음과 같은 데이터를 자동으로 수집합니다:

- 페이지 체류 시간
- 영역별 체류 시간
- 클릭 이벤트
- 스크롤 행동
- 폼 입력 패턴 (활성화된 경우)
- 성능 메트릭

## 6. 전체 예시 코드

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Analytics 예시</title>
    <style>
        .area {
            margin: 20px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <!-- 헤더 영역 -->
    <div class="area" 
         data-area-id="header" 
         data-area-name="헤더 영역" 
         data-area-type="header">
        <h1>페이지 제목</h1>
    </div>

    <!-- 메인 콘텐츠 영역 -->
    <div class="area" 
         data-area-id="main-content" 
         data-area-name="메인 콘텐츠" 
         data-area-type="content">
        <h2>메인 콘텐츠</h2>
        <p>콘텐츠 내용...</p>
    </div>

    <!-- User Analytics 스크립트 -->
    <script src="js/user-analytics.js"></script>
    <script>
        const analytics = new UserAnalytics({
            debug: true,
            sendInterval: 30000
        });
    </script>
</body>
</html>
```

## 7. 주의사항

1. 영역 ID는 페이지 내에서 고유해야 합니다.
2. 영역 이름은 분석 대시보드에서 표시되는 이름입니다.
3. 개발 모드에서는 `debug: true` 설정을 통해 콘솔에서 로그를 확인할 수 있습니다.
4. 데이터는 기본적으로 30초마다 서버로 전송되며, `sendInterval` 설정으로 조정할 수 있습니다.
5. 페이지를 떠날 때(beforeunload)에도 마지막 데이터가 전송됩니다. 