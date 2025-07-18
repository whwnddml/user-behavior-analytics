// 영역 정의
const areaDefinitions = [
    {
        id: 'header',
        selector: '#header-area',
        name: '헤더',
        type: 'header',
        priority: 1,
        trackingRules: {
            timeSpent: true,
            interactions: true,
            scrollDepth: false,
            heatmap: true
        }
    },
    {
        id: 'main-content',
        selector: '#content',
        name: '메인 콘텐츠',
        type: 'content',
        priority: 1,
        trackingRules: {
            timeSpent: true,
            interactions: true,
            scrollDepth: true,
            heatmap: true
        }
    },
    // 다른 영역 정의...
];

// 방문자 ID 생성 및 관리
function getOrCreateVisitorId() {
    let visitorId = localStorage.getItem('analytics_visitor_id');
    if (!visitorId) {
        visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('analytics_visitor_id', visitorId);
        console.log('새로운 방문자 ID 생성:', visitorId);
    } else {
        console.log('기존 방문자 ID 사용:', visitorId);
    }
    return visitorId;
}

// 세션 ID 생성
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 데이터 저장소
const analyticsData = {
    visitorId: getOrCreateVisitorId(),
    sessionId: generateSessionId(),
    startTime: new Date(),
    areaEngagement: {},
    scrollMetrics: {
        deepestScroll: 0,
        scrollDepthBreakpoints: {
            25: null,
            50: null,
            75: null,
            100: null
        },
        scrollPattern: []
    },
    interactionMap: [],
    formAnalytics: []
};

// 영역 체류 시간 추적
function initAreaEngagement() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const areaId = entry.target.dataset.areaId;
            if (!analyticsData.areaEngagement[areaId]) {
                analyticsData.areaEngagement[areaId] = {
                    timeSpent: 0,
                    interactions: 0,
                    firstEngagement: null,
                    lastEngagement: null,
                    visibility: {
                        visibleTime: 0,
                        viewportPercent: 0
                    }
                };
            }

            if (entry.isIntersecting) {
                analyticsData.areaEngagement[areaId].lastEngagement = new Date();
                if (!analyticsData.areaEngagement[areaId].firstEngagement) {
                    analyticsData.areaEngagement[areaId].firstEngagement = new Date();
                }
            }

            analyticsData.areaEngagement[areaId].visibility.viewportPercent = entry.intersectionRatio * 100;
        });
    }, {
        threshold: [0, 0.25, 0.5, 0.75, 1]
    });

    document.querySelectorAll('.area').forEach(area => {
        observer.observe(area);
    });
}

// 스크롤 추적
function initScrollTracking() {
    const scrollProgress = document.getElementById('scroll-progress');
    let ticking = false;
    let lastScrollPosition = 0;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const winScroll = document.documentElement.scrollTop;
                const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrolled = (winScroll / height) * 100;

                // 스크롤 진행률 바 업데이트
                scrollProgress.style.width = scrolled + '%';

                // 최대 스크롤 위치 업데이트
                if (scrolled > analyticsData.scrollMetrics.deepestScroll) {
                    analyticsData.scrollMetrics.deepestScroll = scrolled;
                }

                // 스크롤 패턴 기록
                analyticsData.scrollMetrics.scrollPattern.push({
                    position: scrolled,
                    timestamp: new Date(),
                    direction: winScroll > lastScrollPosition ? 'down' : 'up',
                    speed: Math.abs(winScroll - lastScrollPosition)
                });

                lastScrollPosition = winScroll;
                ticking = false;
            });

            ticking = true;
        }
    });
}

// 마우스/터치 이벤트 추적
function initInteractionTracking() {
    const throttle = (func, limit) => {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    };

    // 클릭 이벤트 추적
    document.addEventListener('click', (event) => {
        const areaId = event.target.closest('.area')?.dataset.areaId;
        if (areaId) {
            analyticsData.interactionMap.push({
                x: event.clientX,
                y: event.clientY,
                type: 'click',
                targetElement: event.target.tagName,
                timestamp: new Date(),
                areaId: areaId
            });

            analyticsData.areaEngagement[areaId].interactions++;
        }
    });

    // 마우스 이동 추적 (스로틀링 적용)
    document.addEventListener('mousemove', throttle((event) => {
        const areaId = event.target.closest('.area')?.dataset.areaId;
        if (areaId) {
            analyticsData.interactionMap.push({
                x: event.clientX,
                y: event.clientY,
                type: 'hover',
                targetElement: event.target.tagName,
                timestamp: new Date(),
                areaId: areaId
            });
        }
    }, 100));
}

// 폼 분석
function initFormAnalytics() {
    const form = document.getElementById('user-form');
    if (!form) return;

    const formData = {
        formId: 'user-form',
        fields: {}
    };

    // 폼 필드 이벤트 추적
    form.querySelectorAll('input, textarea, select').forEach(field => {
        formData.fields[field.name] = {
            focusTime: null,
            timeSpent: 0,
            errorCount: 0,
            completed: false
        };

        field.addEventListener('focus', () => {
            formData.fields[field.name].focusTime = new Date();
        });

        field.addEventListener('blur', () => {
            if (formData.fields[field.name].focusTime) {
                formData.fields[field.name].timeSpent += 
                    new Date() - formData.fields[field.name].focusTime;
                formData.fields[field.name].completed = field.value.length > 0;
            }
        });

        field.addEventListener('invalid', () => {
            formData.fields[field.name].errorCount++;
        });
    });

    // 폼 제출 이벤트
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        analyticsData.formAnalytics.push({
            ...formData,
            submitTime: new Date()
        });

        // 여기에 실제 폼 제출 로직 추가
        console.log('폼 데이터:', formData);
    });
}

// 데이터 전송
async function sendAnalytics() {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.collect}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: analyticsData.sessionId,
                visitorId: analyticsData.visitorId,
                startTime: analyticsData.startTime,
                endTime: new Date(),
                pageUrl: window.location.href,
                pageTitle: document.title,
                userAgent: navigator.userAgent,
                areaEngagements: Object.entries(analyticsData.areaEngagement).map(([areaId, data]) => ({
                    areaId,
                    areaName: document.querySelector(`[data-area-id="${areaId}"]`)?.dataset.areaName || areaId,
                    areaType: document.querySelector(`[data-area-id="${areaId}"]`)?.dataset.areaType || 'unknown',
                    timeSpent: data.timeSpent,
                    interactions: data.interactions,
                    firstEngagement: data.firstEngagement,
                    lastEngagement: data.lastEngagement,
                    visibility: data.visibility
                })),
                scrollMetrics: analyticsData.scrollMetrics,
                interactionMap: analyticsData.interactionMap,
                formAnalytics: analyticsData.formAnalytics
            })
        });

        if (!response.ok) {
            throw new Error(`Analytics data submission failed: ${response.status}`);
        }

        console.log('Analytics data sent successfully');
        
        // 성공적으로 전송된 데이터 초기화
        analyticsData.interactionMap = [];
        analyticsData.formAnalytics = [];
        
    } catch (error) {
        console.error('Failed to send analytics data:', error);
    }
}

// 대시보드 페이지에서는 데이터 수집을 하지 않습니다.
// 데이터 수집은 user-analytics.js가 담당합니다.
// 
// 주의: 아래 코드들은 대시보드가 아닌 실제 사용자 페이지에서만 실행되어야 합니다.
// 현재는 대시보드 전용이므로 비활성화합니다.
//
// window.addEventListener('beforeunload', async () => {
//     await Promise.all([
//         sendAnalytics(),
//         endSession()
//     ]);
// });
//
// setInterval(sendAnalytics, 5 * 60 * 1000);

// API 설정
const hostname = window.location.hostname;
const API_CONFIG = {
    baseUrl: hostname === 'localhost' || hostname === '127.0.0.1'
        ? 'http://localhost:3000/api/analytics'
        : 'https://user-behavior-analytics.onrender.com/api/analytics',
    endpoints: {
        stats: '/dashboard/stats',
        health: '/health',
        healthDb: '/health/db',
        collect: '/collect',
        session: '/session',
        sessionEnd: '/session/end',
        visitorSessions: '/visitor' // :visitorId/sessions will be appended
    }
};

// 에러 메시지 표시 함수
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) {
        const div = document.createElement('div');
        div.id = 'errorMessage';
        div.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: #ff5555; color: white; padding: 15px; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(div);
    }
    const messageDiv = document.getElementById('errorMessage');
    messageDiv.textContent = message;
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// 날짜 포맷팅 함수 (KST 기준)
function formatDate(date) {
    // console.warn('=== formatDate 함수 실행 ===');
    // console.warn('입력된 날짜 객체:', {
    //     date: date,
    //     type: typeof date,
    //     timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    // });

    // KST 기준으로 년,월,일 추출
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const result = `${year}-${month}-${day}`;
    // console.warn('변환 결과:', result);
    return result;
}

function formatNumber(number, decimals = 0) {
    return Number(number).toFixed(decimals);
}

// 체류시간 포맷팅 함수
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds.toFixed(1)}초`;
    } else if (seconds < 3600) {
        return `${(seconds / 60).toFixed(1)}분`;
    } else {
        return `${(seconds / 3600).toFixed(1)}시간`;
    }
}

// 날짜 및 시간 포맷팅 함수
function formatDateTime(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// API 호출 함수
async function fetchAPI(endpoint, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = `${window.API_CONFIG.baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;
        
        console.log('API 요청:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API 요청 실패 (${response.status}): ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || '데이터를 불러오는데 실패했습니다.');
        }
        
        return data.data;
    } catch (error) {
        console.error('API 호출 오류:', error);
        showError(`API 호출 실패: ${error.message}`);
        throw error;
    }
}

// 헬스체크 수행
async function performHealthCheck() {
    try {
        // 서비스 전체 상태 체크 (데이터베이스 포함)
        const healthResponse = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.health}`);
        if (!healthResponse.ok) {
            throw new Error(`Health check failed: ${healthResponse.status}`);
        }
        const healthStatus = await healthResponse.json();
        
        // 서비스가 정상이 아닌 경우
        if (healthStatus.status !== 'ok') {
            console.warn('Service health degraded:', healthStatus);
            showError('서비스 상태가 불안정합니다. 잠시 후 다시 시도해주세요.');
            return false;
        }

        // 데이터베이스 연결 상태가 불안정한 경우
        if (!healthStatus.database.connected) {
            console.warn('Database connection unhealthy:', healthStatus);
            showError('데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.');
            return false;
        }

        console.log('Health check successful:', healthStatus);
        return true;
    } catch (error) {
        console.error('Health check error:', error);
        showError('서비스 상태 확인에 실패했습니다.');
        return false;
    }
}

// 차트 데이터 없음 표시
function showNoData(chartId) {
    const container = document.getElementById(chartId).parentElement;
    const noDataDiv = document.createElement('div');
    noDataDiv.className = 'no-data';
    noDataDiv.textContent = '데이터가 없습니다';
    container.appendChild(noDataDiv);
}

/**
 * ⚠️ 차트 초기화 관련 주의사항
 * 1. 모든 차트 초기화는 반드시 DOMContentLoaded 이벤트 이후에 실행되어야 합니다.
 * 2. 차트 초기화 전에 캔버스 요소가 DOM에 존재하는지 확인이 필요합니다.
 * 3. 'Cannot read properties of null (reading 'getContext')' 에러가 발생하면
 *    차트 초기화 시점과 스크립트 로드 순서를 확인하세요.
 * 4. 차트 관련 스크립트는 HTML body 최하단에 배치해야 합니다.
 */

// 차트 객체 저장소 초기화
window.charts = {
    areaChart: null,
    deviceChart: null,
    timeChart: null,
    browserChart: null
};

// 차트 초기화
function initializeCharts() {
    // 기존 차트 정리
    Object.values(window.charts).forEach(chart => {
        if (chart) chart.destroy();
    });

    // 영역별 체류시간 차트
    const areaChartElement = document.getElementById('areaChart');
    if (!areaChartElement) {
        console.warn('차트 초기화 실패: areaChart 엘리먼트를 찾을 수 없습니다.');
        return;
    }

    try {
        window.charts.areaChart = new Chart(areaChartElement, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '평균 체류시간',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '영역별 평균 체류시간'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `체류시간: ${formatDuration(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return formatDuration(value);
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('차트 초기화 중 오류 발생:', error);
        showError('차트를 초기화하는 중 오류가 발생했습니다.');
    }

    // 디바이스별 사용자 분포
    const deviceChartElement = document.getElementById('deviceChart');
    if (deviceChartElement) {
        window.charts.deviceChart = new Chart(deviceChartElement, {
            type: 'pie',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '디바이스별 사용자 분포'
                    }
                }
            }
        });
    }

    // 브라우저별 사용자 분포
    const browserChartElement = document.getElementById('browserChart');
    if (browserChartElement) {
        try {
            console.log('브라우저 차트 초기화 시작');
            window.charts.browserChart = new Chart(browserChartElement, {
                type: 'pie',
                data: {
                    labels: [],
                    datasets: [{
                        label: '브라우저별 사용자 수',
                        data: [],
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 206, 86, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: '브라우저별 사용자 분포'
                        },
                        legend: {
                            display: true,
                            position: 'right'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '알 수 없음';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value}명 (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            console.log('브라우저 차트 초기화 완료');
        } catch (error) {
            console.error('브라우저 차트 초기화 실패:', error);
        }
    } else {
        console.error('브라우저 차트 엘리먼트를 찾을 수 없습니다.');
    }

    // 시간대별 활동량 차트
    const timeChartElement = document.getElementById('timeChart');
    if (timeChartElement) {
        window.charts.timeChart = new Chart(timeChartElement, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`),
                datasets: [{
                    label: '세션 수',
                    data: Array(24).fill(0),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '시간대별 활동량 (24시간)'
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return `${context[0].label} - ${String((parseInt(context[0].label) + 1) % 24).padStart(2, '0')}:00`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '시간 (24시간)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '세션 수'
                        }
                    }
                }
            }
        });
    }
}

// 차트 데이터 초기화
function resetChartData() {
    // 로딩 상태 표시
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chart-loading';
        loadingDiv.textContent = '데이터를 불러오는 중...';
        container.appendChild(loadingDiv);
    });

    // Overview 통계 초기화 및 로딩 상태 표시 (방문자 기준)
    ['total-visitors', 'total-sessions', 'total-pageviews', 'sessions-per-visitor', 'pageviews-per-visitor', 'avg-session-time'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '로딩중...';
            element.classList.add('loading');
        }
    });

    // 이전 에러/데이터 없음 메시지 제거
    document.querySelectorAll('.no-data, .chart-error').forEach(el => el.remove());

    // 차트 데이터 초기화
    Object.entries(window.charts).forEach(([chartId, chart]) => {
        if (!chart) return;

        // 모든 차트 데이터 초기화
        chart.data.labels = [];
        chart.data.datasets[0].data = [];

        // 시간 차트는 특별 처리
        if (chartId === 'timeChart') {
            chart.data.labels = Array.from({length: 24}, (_, i) => `${i}시`);
            chart.data.datasets[0].data = Array(24).fill(0);
        }

        chart.update('none'); // 애니메이션 없이 업데이트
    });

    // 세션 테이블 초기화
    const tbody = document.getElementById('sessions-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">데이터를 불러오는 중...</td></tr>';
    }
}

// 차트 에러 표시
function showChartError(chartId, error) {
    const container = document.getElementById(chartId).parentElement;
    // 기존 에러 메시지 제거
    container.querySelectorAll('.chart-error').forEach(el => el.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chart-error';
    errorDiv.textContent = `데이터 로드 실패: ${error.message}`;
    container.appendChild(errorDiv);
}

// 로딩 상태 제거
function removeChartLoading() {
    document.querySelectorAll('.chart-loading').forEach(el => el.remove());
    document.querySelectorAll('.loading').forEach(el => el.classList.remove('loading'));
}

// 대시보드 데이터 로드
async function loadDashboardData() {
    try {
        // 데이터 로딩 전 차트 초기화
        resetChartData();

        // 서비스 상태 체크
        const isHealthy = await performHealthCheck();
        if (!isHealthy) {
            return;
        }

        // 날짜 필터 입력값 가져오기
        const dateFromInput = document.getElementById('date-from');
        const dateToInput = document.getElementById('date-to');
        
        // 현재 시간 (KST)
        const now = new Date();
        const offset = now.getTimezoneOffset() + 540; // UTC+9
        const kstNow = new Date(now.getTime() + offset * 60000);

        let startDate, endDate;

        // 사용자가 선택한 날짜가 있는지 확인
        if (dateFromInput?.value && dateToInput?.value) {
            // 사용자가 선택한 날짜를 KST로 변환
            const selectedStart = new Date(dateFromInput.value + 'T00:00:00+09:00');
            const selectedEnd = new Date(dateToInput.value + 'T23:59:59.999+09:00');
            
            // 현재 날짜도 자정까지로 설정
            const todayEnd = new Date(kstNow);
            todayEnd.setHours(23, 59, 59, 999);
            
            // 미래 날짜 체크 (현재 날짜의 자정까지는 허용)
            if (selectedEnd > todayEnd) {
                showError('종료일은 현재 날짜보다 클 수 없습니다.');
                return;
            }
            
            // 시작일이 종료일보다 늦은지 체크
            if (selectedStart > selectedEnd) {
                showError('시작일은 종료일보다 클 수 없습니다.');
                return;
            }

            startDate = formatDate(selectedStart);
            endDate = formatDate(selectedEnd);
        } else {
            // 기본값: 오늘부터 7일 전
            const today = new Date(kstNow);
            today.setHours(23, 59, 59, 999);

            const lastWeek = new Date(kstNow);
            lastWeek.setDate(kstNow.getDate() - 6);
            lastWeek.setHours(0, 0, 0, 0);

            startDate = formatDate(lastWeek);
            endDate = formatDate(today);

            // 입력 필드 기본값 설정
            if (dateFromInput) dateFromInput.value = startDate;
            if (dateToInput) dateToInput.value = endDate;
        }

        // API 호출을 위한 날짜 파라미터 설정
        const params = {
            startDate,
            endDate
        };
        
        // 페이지 필터 적용
        const pageFilter = document.getElementById('page-filter');
        if (pageFilter?.value) {
            params.page = pageFilter.value;
        }
        
        // 대시보드 통계 데이터 로드
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.stats}?${new URLSearchParams(params)}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || '데이터를 불러오는데 실패했습니다.');
        }

        // 차트 업데이트
        updateCharts({
            stats: result.data
        });
    } catch (error) {
        console.error('대시보드 데이터 로드 실패:', error);
        showError('대시보드 데이터를 불러오는데 실패했습니다.');
        resetChartData();
    }
}

// 차트 업데이트
function updateCharts(data) {
    try {
        const stats = data.stats;

        // Overview 통계 업데이트 (방문자 기준)
        ['total-visitors', 'total-sessions', 'total-pageviews'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = formatNumber(stats.overview[id.replace('-', '_')]);
                element.classList.remove('loading');
            }
        });
        
        // 비율 데이터는 소수점 처리
        const ratioMappings = {
            'sessions-per-visitor': 'sessions_per_visitor',
            'pageviews-per-visitor': 'pageviews_per_visitor'
        };
        
        ['sessions-per-visitor', 'pageviews-per-visitor'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const key = ratioMappings[id];
                const value = stats.overview[key];
                
                const numValue = Number(value);
                if (isFinite(numValue)) {
                    element.textContent = numValue.toFixed(1);
                } else {
                    element.textContent = '0.0';
                }
                element.classList.remove('loading');
            }
        });
        
        const avgSessionElement = document.getElementById('avg-session-time');
        if (avgSessionElement) {
            avgSessionElement.textContent = formatDuration(stats.overview.avg_session_time);
            avgSessionElement.classList.remove('loading');
        }

        // 차트 데이터 업데이트 전에 로딩 상태 제거
        removeChartLoading();

        // 영역별 체류시간
        if (stats.areas && stats.areas.length > 0) {
            window.charts.areaChart.data.labels = stats.areas.map(area => area.area_name || '알 수 없는 영역');
            // 데이터 수집 시점에서 이미 초 단위로 변환되어 저장됨
            window.charts.areaChart.data.datasets[0].data = stats.areas.map(area => area.avg_time_spent);
            window.charts.areaChart.update();
        } else {
            showNoData('areaChart');
        }

        // 디바이스별 통계
        if (stats.devices && stats.devices.length > 0) {
            window.charts.deviceChart.data.labels = stats.devices.map(device => device.device_type || '알 수 없음');
            window.charts.deviceChart.data.datasets[0].data = stats.devices.map(device => device.session_count);
            window.charts.deviceChart.update();
        } else {
            showNoData('deviceChart');
        }

        // 브라우저별 통계
        if (stats.browsers && stats.browsers.length > 0) {
            // 디버깅을 위한 로그
            console.log('브라우저 데이터:', stats.browsers);
            
            // 브라우저 데이터 정렬 (세션 수 기준 내림차순)
            const sortedBrowsers = [...stats.browsers].sort((a, b) => b.session_count - a.session_count);
            
            const labels = sortedBrowsers.map(browser => {
                const name = browser.browser || '알 수 없음';
                const version = browser.version && browser.version !== 'unknown' ? ` ${browser.version}` : '';
                const label = `${name}${version}`;
                console.log('브라우저 레이블 생성:', { browser, name, version, label });
                return label;
            });
            
            console.log('최종 브라우저 레이블:', labels);
            
            window.charts.browserChart.data.labels = labels;
            window.charts.browserChart.data.datasets[0].data = sortedBrowsers.map(browser => browser.session_count);
            window.charts.browserChart.update();
        } else {
            console.log('브라우저 데이터가 없습니다:', stats.browsers);
            showNoData('browserChart');
        }

        // 시간대별 활동량
        if (stats.hourly && stats.hourly.length > 0) {
            const hourlyData = Array(24).fill(0);
            stats.hourly.forEach(hour => {
                hourlyData[hour.hour] = hour.session_count;
            });
            window.charts.timeChart.data.datasets[0].data = hourlyData;
            window.charts.timeChart.update();
        } else {
            showNoData('timeChart');
        }

        // 세션 테이블 업데이트
        updateSessionsTable(stats.recent_sessions);

    } catch (error) {
        console.error('차트 업데이트 중 오류 발생:', error);
        Object.keys(window.charts).forEach(chartId => showChartError(chartId, error));
    }
}

// 세션 테이블 업데이트 함수 분리
function updateSessionsTable(sessions) {
    const tbody = document.getElementById('sessions-table-body');
    if (!tbody) return;

    if (sessions && sessions.length > 0) {
        tbody.innerHTML = sessions.map(session => `
            <tr>
                <td class="session-id">${session.session_id.substring(0, 8)}...</td>
                <td class="date-col">${formatDateTime(session.start_time)}</td>
                <td class="device-col">${session.device_type}</td>
                <td class="browser-info">${session.browser_name} ${session.browser_version}</td>
                <td class="number-col">${session.pageviews}</td>
                <td class="number-col">${session.total_interactions}</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">데이터가 없습니다</td></tr>';
    }
}

// 페이지 목록 로드
async function loadPageList() {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/pages`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '페이지 목록을 불러오는데 실패했습니다.');
        }

        console.log('받아온 페이지 목록:', data.data);

        const pageFilter = document.getElementById('page-filter');
        if (pageFilter) {
            // 기존 옵션 제거
            pageFilter.innerHTML = '<option value="">모든 페이지</option>';
            
            // 페이지별로 옵션 추가
            data.data.forEach(pageUrl => {
                console.log('처리 중인 페이지 URL:', pageUrl);
                const option = document.createElement('option');
                option.value = pageUrl;
                
                // URL을 보기 좋게 표시
                let displayText;
                try {
                    // URL이 프로토콜로 시작하지 않으면 추가
                    const fullUrl = pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`;
                    const url = new URL(fullUrl);
                    displayText = `${url.hostname}${url.pathname}${url.hash || ''}`;
                } catch (error) {
                    console.warn('URL 파싱 실패:', pageUrl, error);
                    displayText = pageUrl; // 파싱 실패 시 원본 URL 사용
                }
                
                option.textContent = displayText;
                pageFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('페이지 목록 로드 실패:', error);
        showError('페이지 목록을 불러오는데 실패했습니다.');
    }
}

// 이벤트 리스너 등록 - DOMContentLoaded 이벤트가 발생한 후에만 차트 초기화
document.addEventListener('DOMContentLoaded', function() {
    try {
        // 차트 초기화
        initializeCharts();
        
        // 페이지 목록 로드
        loadPageList();
        
        // 데이터 로드
        loadDashboardData();
        
        // 주기적 헬스체크 시작
        setInterval(performHealthCheck, 300000); // 5분마다
        
        // 초기 헬스체크 실행
        performHealthCheck();

        // 필터 변경 이벤트
        ['date-from', 'date-to', 'page-filter'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', loadDashboardData);
            }
        });
    } catch (error) {
        console.error('초기화 중 오류 발생:', error);
        showError('대시보드를 초기화하는 중 오류가 발생했습니다.');
    }
});

// 세션 관리
async function startSession(visitorId) {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.session}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ visitor_id: visitorId })
        });

        if (!response.ok) {
            throw new Error(`Failed to start session: ${response.status}`);
        }

        const result = await response.json();
        analyticsData.sessionId = result.sessionId;
        analyticsData.visitorId = visitorId;
        
        return result;
    } catch (error) {
        console.error('Failed to start session:', error);
        throw error;
    }
}

async function endSession() {
    if (!analyticsData.sessionId) return;
    
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.sessionEnd}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId: analyticsData.sessionId })
        });

        if (!response.ok) {
            throw new Error(`Failed to end session: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to end session:', error);
    }
}

// 10분마다 헬스체크 실행 (15분 서스펜드 타임아웃 이전에 요청)
setInterval(performHealthCheck, 10 * 60 * 1000);

// 페이지 로드 시 즉시 한 번 실행
performHealthCheck();