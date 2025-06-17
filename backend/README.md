# User Behavior Analytics - Backend API

사용자 행동 분석 시스템의 백엔드 API 서버입니다.

## 🚀 시작하기

### 사전 요구사항
- Node.js 18.0.0 이상
- Docker Desktop
- Docker Compose

### Docker Compose로 데이터베이스 설정

1. Docker 컨테이너 실행
```bash
cd backend
docker-compose up -d
```

이 명령어로 다음 서비스들이 실행됩니다:
- **PostgreSQL**: `localhost:5432`
- **pgAdmin**: `localhost:5050` (선택사항)

2. 서비스 상태 확인
```bash
docker-compose ps
```

3. 데이터베이스 초기화 확인
```bash
docker-compose logs postgres
```

### 백엔드 서버 설정

1. 의존성 설치
```bash
npm install
```

2. 환경변수 설정
```bash
cp env.example .env
# .env 파일에서 필요한 설정 수정
```

3. 개발 서버 실행
```bash
npm run dev
```

## 🐳 Docker 서비스 정보

### PostgreSQL
- **포트**: 5432
- **데이터베이스**: uba
- **사용자**: postgres
- **비밀번호**: postgres123
- **데이터 볼륨**: postgres_data

### pgAdmin (관리도구)
- **URL**: http://localhost:5050
- **이메일**: admin@example.com
- **비밀번호**: admin123

## 📁 프로젝트 구조

```
backend/
├── src/
│   ├── server/           # 서버 설정 및 진입점
│   ├── routes/           # API 라우트
│   ├── models/           # 데이터 모델
│   ├── middlewares/      # 미들웨어
│   ├── utils/            # 유틸리티 함수
│   ├── config/           # 설정 파일
│   └── types/            # TypeScript 타입 정의
├── database/
│   └── init/             # 데이터베이스 초기화 스크립트
├── dist/                 # 컴파일된 JavaScript 파일
├── logs/                 # 로그 파일
├── docker-compose.yml    # Docker Compose 설정
├── package.json
├── tsconfig.json
└── env.example
```

## 🔧 주요 스크립트

- `npm run dev`: 개발 서버 실행 (nodemon + ts-node)
- `npm run build`: TypeScript 컴파일
- `npm start`: 프로덕션 서버 실행
- `npm test`: 테스트 실행
- `npm run lint`: ESLint 실행
- `npm run format`: Prettier 포맷팅

## 🐳 Docker 명령어

### 기본 명령어
```bash
# 서비스 시작
docker-compose up -d

# 서비스 중지
docker-compose down

# 서비스 재시작
docker-compose restart

# 로그 확인
docker-compose logs -f [service_name]

# 데이터 볼륨까지 삭제
docker-compose down -v
```

### 데이터베이스 접속
```bash
# PostgreSQL 컨테이너 접속
docker-compose exec postgres psql -U postgres -d uba
```

## 📊 API 엔드포인트

### 분석 데이터 수집
- `POST /api/analytics/collect` - 클라이언트 데이터 수집
- `POST /api/analytics/session` - 세션 데이터 저장
- `POST /api/analytics/pageview` - 페이지뷰 데이터 저장

### 통계 조회
- `GET /api/analytics/stats/realtime` - 실시간 통계
- `GET /api/analytics/stats/period` - 기간별 통계
- `GET /api/analytics/heatmap/:pageId` - 히트맵 데이터

### 관리
- `GET /api/health` - 서버 상태 확인
- `GET /api/metrics` - 서버 메트릭

## 🗄️ 데이터베이스

PostgreSQL을 사용하며, 다음과 같은 주요 테이블로 구성됩니다:

- `sessions` - 사용자 세션 정보
- `pageviews` - 페이지뷰 데이터
- `area_engagements` - 영역별 상호작용 데이터
- `scroll_metrics` - 스크롤 패턴 데이터
- `interactions` - 클릭/마우스 이벤트 데이터
- `form_analytics` - 폼 분석 데이터

## 🔒 보안

- Helmet을 사용한 기본 보안 헤더 설정
- Rate Limiting으로 API 남용 방지
- CORS 설정으로 허용된 도메인만 접근 가능
- 입력 데이터 검증 (Joi)

## 📝 로깅

Winston을 사용하여 구조화된 로깅을 제공합니다:
- 콘솔 및 파일 로깅
- 로그 레벨별 분류
- 요청/응답 로깅
- 에러 추적

## 🚀 배포

### Docker 사용
```bash
# 이미지 빌드
docker build -t user-behavior-analytics-backend .

# 컨테이너 실행
docker run -p 3000:3000 --env-file .env user-behavior-analytics-backend
```

### PM2 사용
```bash
# 프로덕션 빌드
npm run build

# PM2로 실행
pm2 start ecosystem.config.js
``` 