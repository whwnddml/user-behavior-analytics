# 🚀 Render 배포 가이드

## 📋 준비사항

1. **GitHub 저장소에 코드 푸시**
2. **Render 계정 생성** (https://render.com)

## 🔧 배포 단계

### 1. PostgreSQL 데이터베이스 생성

1. Render 대시보드에서 **"New +"** 클릭
2. **"PostgreSQL"** 선택
3. 설정:
   - **Name**: `user-behavior-analytics-db`
   - **Database**: `uba`
   - **User**: `postgres` 
   - **Region**: 가까운 지역 선택
   - **Plan**: **Free** 선택

### 2. 웹 서비스 생성

1. Render 대시보드에서 **"New +"** 클릭
2. **"Web Service"** 선택
3. GitHub 저장소 연결
4. 설정:
   - **Name**: `user-behavior-analytics-api`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm run build:render`
   - **Start Command**: `npm start`

### 3. 환경변수 설정

웹 서비스 설정에서 **Environment Variables** 추가:

```bash
NODE_ENV=production
DATABASE_URL=<PostgreSQL 데이터베이스의 External Database URL>
CORS_ORIGIN=*
JWT_SECRET=your-super-secret-jwt-key-change-this
LOG_LEVEL=info
```

### 4. 헬스체크 설정

- **Health Check Path**: `/api/health`

## 🌐 배포 후 확인

### API 엔드포인트 테스트

```bash
# Health Check
curl https://your-app-name.onrender.com/api/health

# 분석 데이터 수집 테스트
curl -X POST https://your-app-name.onrender.com/api/analytics/collect \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test_session","pageUrl":"https://example.com","userAgent":"Mozilla/5.0...","areaEngagements":[],"scrollMetrics":{"deepestScroll":50,"scrollDepthBreakpoints":{},"scrollPattern":[]},"interactionMap":[],"formAnalytics":[]}'
```

## ⚠️ 주의사항

1. **무료 플랜 제한**:
   - 15분 비활성 시 슬립 모드
   - 월 750시간 제한
   - PostgreSQL 1GB 제한

2. **첫 배포 시**:
   - 데이터베이스 테이블 자동 생성
   - 느린 콜드 스타트 (1-2분)

3. **보안**:
   - JWT_SECRET 반드시 변경
   - CORS_ORIGIN을 실제 프론트엔드 도메인으로 설정

## 🔄 자동 배포

GitHub main 브랜치에 푸시하면 자동으로 재배포됩니다.

## 📊 모니터링

- Render 대시보드에서 로그 확인
- `/api/health` 엔드포인트로 상태 모니터링 