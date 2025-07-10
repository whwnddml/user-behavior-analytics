// API 엔드포인트 설정
// 주의: 운영 서버 주소는 절대 변경하지 마세요! (Render 배포 주소)
if (!window.API_BASE_URL) {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://user-behavior-analytics.onrender.com';
} 