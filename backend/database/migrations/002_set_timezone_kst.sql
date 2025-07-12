-- KST 타임존 설정을 위한 마이그레이션

-- 데이터베이스 타임존을 KST로 설정
ALTER DATABASE analytics SET timezone TO 'Asia/Seoul';

-- 현재 세션의 타임존도 KST로 설정
SET timezone = 'Asia/Seoul';

-- 스키마 버전 업데이트
INSERT INTO schema_versions (version, description)
VALUES (2, 'Set database timezone to KST (Asia/Seoul)')
ON CONFLICT (version) DO NOTHING; 