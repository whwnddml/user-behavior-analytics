-- 사용자 행동 분석 데이터베이스 초기화 스크립트

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    user_id VARCHAR(255),
    browser VARCHAR(100),
    browser_version VARCHAR(50),
    device_type VARCHAR(50),
    os VARCHAR(100),
    os_version VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 페이지뷰 테이블
CREATE TABLE IF NOT EXISTS pageviews (
    pageview_id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES sessions(session_id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    page_title TEXT,
    load_time INTEGER,
    dom_content_loaded INTEGER,
    first_paint INTEGER,
    first_contentful_paint INTEGER,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 영역 체류 시간 테이블
CREATE TABLE IF NOT EXISTS area_engagements (
    engagement_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id) ON DELETE CASCADE,
    area_id VARCHAR(50) NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    area_type VARCHAR(50),
    time_spent INTEGER,
    interaction_count INTEGER DEFAULT 0,
    first_engagement TIMESTAMP WITH TIME ZONE,
    last_engagement TIMESTAMP WITH TIME ZONE,
    visible_time INTEGER,
    viewport_percent NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 스크롤 행동 테이블
CREATE TABLE IF NOT EXISTS scroll_metrics (
    scroll_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id) ON DELETE CASCADE,
    deepest_scroll NUMERIC(5,2),
    scroll_25_time TIMESTAMP WITH TIME ZONE,
    scroll_50_time TIMESTAMP WITH TIME ZONE,
    scroll_75_time TIMESTAMP WITH TIME ZONE,
    scroll_100_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 스크롤 패턴 테이블
CREATE TABLE IF NOT EXISTS scroll_patterns (
    pattern_id BIGSERIAL PRIMARY KEY,
    scroll_id BIGINT REFERENCES scroll_metrics(scroll_id) ON DELETE CASCADE,
    position NUMERIC(5,2),
    direction VARCHAR(4) CHECK (direction IN ('up', 'down')),
    speed INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 인터랙션 테이블
CREATE TABLE IF NOT EXISTS interactions (
    interaction_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id) ON DELETE CASCADE,
    area_id VARCHAR(50),
    interaction_type VARCHAR(20) CHECK (interaction_type IN ('click', 'hover', 'touch')),
    target_element VARCHAR(50),
    x_coordinate INTEGER,
    y_coordinate INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 폼 분석 테이블
CREATE TABLE IF NOT EXISTS form_analytics (
    form_id BIGSERIAL PRIMARY KEY,
    pageview_id BIGINT REFERENCES pageviews(pageview_id) ON DELETE CASCADE,
    form_name VARCHAR(100),
    total_time_spent INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 폼 필드 분석 테이블
CREATE TABLE IF NOT EXISTS form_field_analytics (
    field_id BIGSERIAL PRIMARY KEY,
    form_id BIGINT REFERENCES form_analytics(form_id) ON DELETE CASCADE,
    field_name VARCHAR(100),
    time_spent INTEGER,
    error_count INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);

CREATE INDEX IF NOT EXISTS idx_pageviews_session_id ON pageviews(session_id);
CREATE INDEX IF NOT EXISTS idx_pageviews_start_time ON pageviews(start_time);

CREATE INDEX IF NOT EXISTS idx_area_engagements_pageview_id ON area_engagements(pageview_id);
CREATE INDEX IF NOT EXISTS idx_area_engagements_area_id ON area_engagements(area_id);

CREATE INDEX IF NOT EXISTS idx_scroll_metrics_pageview_id ON scroll_metrics(pageview_id);
CREATE INDEX IF NOT EXISTS idx_scroll_patterns_scroll_id ON scroll_patterns(scroll_id);

CREATE INDEX IF NOT EXISTS idx_interactions_pageview_id ON interactions(pageview_id);
CREATE INDEX IF NOT EXISTS idx_interactions_recorded_at ON interactions(recorded_at);

CREATE INDEX IF NOT EXISTS idx_form_analytics_pageview_id ON form_analytics(pageview_id);
CREATE INDEX IF NOT EXISTS idx_form_field_analytics_form_id ON form_field_analytics(form_id);

-- 성공 메시지
SELECT 'Database tables created successfully!' as message; 