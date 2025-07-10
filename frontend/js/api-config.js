// API 엔드포인트 설정
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://user-behavior-analytics-api.onrender.com'; 