# 사용자 행동 분석 데이터베이스 설계 (PostgreSQL)

## 1. 기본 테이블 구조

### 1.1 세션 테이블
```sql
CREATE TABLE sessions (
    session_id VARCHAR(50) PRIMARY KEY,
    visitor_id UUID,                    -- 방문자 식별자 (쿠키 기반)
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,                    -- 브라우저 정보
    ip_address INET,                    -- IP 주소
    referrer TEXT,                      -- 참조 URL
    landing_page TEXT,                  -- 최초 방문 페이지
    device_type VARCHAR(20),            -- mobile, tablet, desktop
    browser_name VARCHAR(50),
    browser_version VARCHAR(20),
    os_name VARCHAR(50),
    os_version VARCHAR(20),
    screen_resolution VARCHAR(20),
    viewport_size VARCHAR(20),
    language VARCHAR(10),
    country VARCHAR(50),
    region VARCHAR(50),
    city VARCHAR(50),
    timezone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 세션 인덱스
CREATE INDEX idx_sessions_visitor_id ON sessions(visitor_id);
CREATE INDEX idx_sessions_start_time ON sessions(start_time);
```

### 1.2 페이지뷰 테이블
```sql
CREATE TABLE pageviews (
    pageview_id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES sessions(session_id),
    page_url TEXT NOT NULL,
    page_title TEXT,
    load_time INTEGER,              -- 페이지 로드 시간 (ms)
    dom_content_loaded INTEGER,     -- DOM 로드 시간 (ms)
    first_paint INTEGER,           -- 첫 페인트 시간 (ms)
    first_contentful_paint INTEGER, -- 첫 콘텐츠 페인트 시간 (ms)
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 페이지뷰 인덱스
CREATE INDEX idx_pageviews_session_id ON pageviews(session_id);
CREATE INDEX idx_pageviews_start_time ON pageviews(start_time);
```

### 1.3 영역 체류 시간 테이블
```sql
CREATE TABLE area_engagements (
    engagement_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id),
    area_id VARCHAR(50) NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    area_type VARCHAR(50),
    time_spent INTEGER,            -- 체류 시간 (ms)
    interaction_count INTEGER,     -- 상호작용 횟수
    first_engagement TIMESTAMP WITH TIME ZONE,
    last_engagement TIMESTAMP WITH TIME ZONE,
    visible_time INTEGER,         -- 화면에 보인 시간 (ms)
    viewport_percent NUMERIC(5,2), -- 뷰포트 내 표시 비율
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 영역 체류 시간 인덱스
CREATE INDEX idx_area_engagements_pageview_id ON area_engagements(pageview_id);
CREATE INDEX idx_area_engagements_area_id ON area_engagements(area_id);
```

### 1.4 스크롤 행동 테이블
```sql
CREATE TABLE scroll_metrics (
    scroll_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id),
    deepest_scroll NUMERIC(5,2),   -- 최대 스크롤 위치 (%)
    scroll_25_time TIMESTAMP WITH TIME ZONE,  -- 25% 도달 시간
    scroll_50_time TIMESTAMP WITH TIME ZONE,  -- 50% 도달 시간
    scroll_75_time TIMESTAMP WITH TIME ZONE,  -- 75% 도달 시간
    scroll_100_time TIMESTAMP WITH TIME ZONE, -- 100% 도달 시간
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 스크롤 패턴 테이블 (시계열 데이터)
CREATE TABLE scroll_patterns (
    pattern_id BIGSERIAL PRIMARY KEY,
    scroll_id BIGINT REFERENCES scroll_metrics(scroll_id),
    position NUMERIC(5,2),        -- 스크롤 위치 (%)
    direction VARCHAR(4),         -- up/down
    speed INTEGER,               -- 스크롤 속도
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 스크롤 메트릭 인덱스
CREATE INDEX idx_scroll_metrics_pageview_id ON scroll_metrics(pageview_id);
CREATE INDEX idx_scroll_patterns_scroll_id ON scroll_patterns(scroll_id);
```

### 1.5 인터랙션 테이블
```sql
CREATE TABLE interactions (
    interaction_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id),
    area_id VARCHAR(50),
    interaction_type VARCHAR(20),  -- click, hover, touch
    target_element VARCHAR(50),    -- HTML 요소
    x_coordinate INTEGER,
    y_coordinate INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인터랙션 인덱스
CREATE INDEX idx_interactions_pageview_id ON interactions(pageview_id);
CREATE INDEX idx_interactions_recorded_at ON interactions(recorded_at);
```

### 1.6 폼 분석 테이블
```sql
CREATE TABLE form_analytics (
    form_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id),
    form_name VARCHAR(100),
    total_time_spent INTEGER,     -- 총 입력 시간 (ms)
    completed BOOLEAN,            -- 완료 여부
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE form_field_analytics (
    field_id BIGSERIAL PRIMARY KEY,
    form_id BIGINT REFERENCES form_analytics(form_id),
    field_name VARCHAR(100),
    time_spent INTEGER,          -- 필드 입력 시간 (ms)
    error_count INTEGER,         -- 에러 발생 횟수
    completed BOOLEAN,           -- 필드 완료 여부
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 폼 분석 인덱스
CREATE INDEX idx_form_analytics_pageview_id ON form_analytics(pageview_id);
CREATE INDEX idx_form_field_analytics_form_id ON form_field_analytics(form_id);
```

## 2. 파티셔닝 전략

### 2.1 시간 기반 파티셔닝
```sql
-- 페이지뷰 테이블 파티셔닝 예시
CREATE TABLE pageviews (
    -- 기존 컬럼들...
) PARTITION BY RANGE (start_time);

-- 월별 파티션 생성
CREATE TABLE pageviews_y2024m01 PARTITION OF pageviews
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- 이후 월별 파티션들...
```

### 2.2 세션 데이터 파티셔닝
```sql
-- 세션 테이블 파티셔닝 예시
CREATE TABLE sessions (
    -- 기존 컬럼들...
) PARTITION BY RANGE (created_at);
```

## 3. 집계 테이블

### 3.1 일별 페이지 통계
```sql
CREATE TABLE daily_page_stats (
    stat_id BIGSERIAL PRIMARY KEY,
    page_url TEXT NOT NULL,
    date DATE NOT NULL,
    total_views INTEGER,
    unique_visitors INTEGER,
    avg_time_spent NUMERIC(10,2),
    bounce_rate NUMERIC(5,2),
    exit_rate NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (page_url, date)
);
```

### 3.2 영역별 통계
```sql
CREATE TABLE daily_area_stats (
    stat_id BIGSERIAL PRIMARY KEY,
    area_id VARCHAR(50),
    date DATE NOT NULL,
    total_engagements INTEGER,
    avg_time_spent NUMERIC(10,2),
    avg_interaction_count NUMERIC(10,2),
    avg_viewport_percent NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (area_id, date)
);
```

## 4. 성능 최적화

### 4.1 인덱스 전략
- 자주 조회되는 컬럼에 대한 인덱스 생성
- 복합 인덱스 활용
- 정기적인 인덱스 관리

### 4.2 파티셔닝 관리
- 오래된 데이터 아카이빙
- 파티션 자동 생성 스크립트
- 파티션별 인덱스 관리

### 4.3 데이터 보관 정책
- 상세 데이터: 3개월
- 집계 데이터: 1년
- 아카이브 데이터: 영구 보관

## 5. 쿼리 최적화

### 5.1 자주 사용되는 뷰 생성
```sql
-- 세션별 주요 메트릭 뷰
CREATE VIEW session_metrics AS
SELECT 
    s.session_id,
    s.visitor_id,
    COUNT(DISTINCT p.pageview_id) as pageview_count,
    AVG(p.load_time) as avg_load_time,
    MAX(sm.deepest_scroll) as max_scroll_depth,
    COUNT(DISTINCT i.interaction_id) as interaction_count
FROM sessions s
LEFT JOIN pageviews p ON s.session_id = p.session_id
LEFT JOIN scroll_metrics sm ON p.pageview_id = sm.pageview_id
LEFT JOIN interactions i ON p.pageview_id = i.pageview_id
GROUP BY s.session_id, s.visitor_id;
```

### 5.2 집계 함수
```sql
-- 영역별 체류 시간 집계 함수
CREATE OR REPLACE FUNCTION get_area_engagement_stats(
    start_date DATE,
    end_date DATE,
    p_area_id VARCHAR(50)
) RETURNS TABLE (
    date DATE,
    total_time_spent BIGINT,
    avg_time_spent NUMERIC,
    interaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(ae.created_at) as date,
        SUM(ae.time_spent) as total_time_spent,
        AVG(ae.time_spent) as avg_time_spent,
        SUM(ae.interaction_count) as interaction_count
    FROM area_engagements ae
    WHERE ae.area_id = p_area_id
    AND DATE(ae.created_at) BETWEEN start_date AND end_date
    GROUP BY DATE(ae.created_at)
    ORDER BY DATE(ae.created_at);
END;
$$ LANGUAGE plpgsql;
``` 