-- 테이블 삭제 스크립트
-- 주의: 이 스크립트는 모든 데이터를 삭제합니다!

-- 기존 테이블 삭제
DROP TABLE IF EXISTS form_field_analytics CASCADE;
DROP TABLE IF EXISTS form_analytics CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS area_engagements CASCADE;
DROP TABLE IF EXISTS pageviews CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- 성공 메시지
SELECT 'Database tables dropped successfully!' as message; 