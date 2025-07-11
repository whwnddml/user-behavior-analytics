-- 스키마 버전 관리 테이블 생성
CREATE TABLE IF NOT EXISTS schema_versions (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- 초기 버전 등록
INSERT INTO schema_versions (version, description)
VALUES (1, 'Initial schema version')
ON CONFLICT (version) DO NOTHING; 