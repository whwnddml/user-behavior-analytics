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

// 데이터 저장소
const analyticsData = {
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

// 세션 ID 생성
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

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
function sendAnalytics() {
    // 실제 구현에서는 배치로 데이터를 서버에 전송
    console.log('분석 데이터:', analyticsData);
}

// 페이지 언로드 시 데이터 전송
window.addEventListener('beforeunload', () => {
    sendAnalytics();
});

// 주기적으로 데이터 전송 (5분마다)
setInterval(sendAnalytics, 5 * 60 * 1000);

// API 설정
const hostname = window.location.hostname;
const API_CONFIG = {
    baseUrl: hostname === 'localhost' || hostname === '127.0.0.1'
        ? 'http://localhost:3000/api/analytics'
        : 'https://user-behavior-analytics.onrender.com/api/analytics',
    endpoints: {
        stats: '/dashboard/stats',
        sessions: '/dashboard/sessions',
        areaStats: '/area-stats',
        hourlyStats: '/hourly-stats',
        deviceStats: '/device-stats',
        performanceStats: '/performance-stats'
    }
};

// 유틸리티 함수
function formatDate(date) {
    return date.toISOString().split('T')[0];
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

// API 호출 함수
async function fetchAPI(endpoint, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_CONFIG.baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '데이터를 불러오는데 실패했습니다.');
        }
        
        return data.data;
    } catch (error) {
        showError(`API 호출 실패: ${error.message}`);
        throw error;
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

// 차트 초기화
function initializeCharts() {
    // 기존 차트 정리
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });

    // "데이터가 없습니다" 메시지 제거
    const noDataElements = document.querySelectorAll('.no-data');
    noDataElements.forEach(element => element.remove());

    // 현재 페이지에 있는 차트만 초기화
    const areaChartElement = document.getElementById('areaChart');
    if (areaChartElement) {
        charts.areaChart = new Chart(areaChartElement, {
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
    }

    const deviceChartElement = document.getElementById('deviceChart');
    if (deviceChartElement) {
        charts.deviceChart = new Chart(deviceChartElement, {
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

    const timeChartElement = document.getElementById('timeChart');
    if (timeChartElement) {
        charts.timeChart = new Chart(timeChartElement, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}시`),
                datasets: [{
                    label: '활동량',
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '시간대별 활동량'
                    }
                }
            }
        });
    }
}

// 대시보드 데이터 로드
async function loadDashboardData() {
    try {
        const today = new Date();
        const lastMonth = new Date(today.setMonth(today.getMonth() - 1));
        
        const params = {
            dateFrom: formatDate(lastMonth),
            dateTo: formatDate(new Date())
        };
        
        const [
            stats,
            areaStats,
            hourlyStats,
            deviceStats
        ] = await Promise.all([
            fetchAPI(API_CONFIG.endpoints.stats, params),
            fetchAPI(API_CONFIG.endpoints.areaStats, params),
            fetchAPI(API_CONFIG.endpoints.hourlyStats, params),
            fetchAPI(API_CONFIG.endpoints.deviceStats, params)
        ]);
        
        updateCharts({
            stats,
            areaStats,
            hourlyStats,
            deviceStats
        });
    } catch (error) {
        console.error('대시보드 데이터 로드 실패:', error);
        showError('대시보드 데이터를 불러오는데 실패했습니다.');
    }
}

// 차트 업데이트
function updateCharts(data) {
    // 데이터가 없는 경우 처리
    if (!data || Object.keys(data).length === 0) {
        showNoData('areaChart');
        showNoData('deviceChart');
        showNoData('timeChart');
        return;
    }

    // 영역별 체류시간
    if (data.areaStats) {
        charts.areaChart.data.labels = data.areaStats.map(stat => stat.areaName);
        charts.areaChart.data.datasets[0].data = data.areaStats.map(stat => stat.avgTimeSpent);
        charts.areaChart.update();
    }

    // 디바이스별 통계
    if (data.deviceStats) {
        charts.deviceChart.data.labels = data.deviceStats.map(stat => stat.deviceType);
        charts.deviceChart.data.datasets[0].data = data.deviceStats.map(stat => stat.sessionCount);
        charts.deviceChart.update();
    }

    // 시간대별 활동
    if (data.hourlyStats) {
        charts.timeChart.data.datasets[0].data = data.hourlyStats.map(stat => stat.sessionCount);
        charts.timeChart.update();
    }
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    // 현재 페이지가 analytics-dashboard.html인 경우에만 차트 초기화
    if (window.location.pathname.includes('analytics-dashboard.html')) {
        initializeCharts();
        loadDashboardData();
    }

    // 필터 변경 이벤트
    ['date-from', 'date-to', 'page-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', loadDashboardData);
    });
}); 

// 세션 목록 조회
async function loadSessionsTable() {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.sessions}?limit=10`);
        if (!response.ok) throw new Error('API 요청 실패');
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        const tbody = document.getElementById('sessions-table-body');
        tbody.innerHTML = result.data.map(session => `
            <tr>
                <td>${session.sessionId.substring(0, 8)}...</td>
                <td>${new Date(session.startTime).toLocaleString()}</td>
                <td>${session.deviceType || '-'}</td>
                <td>${session.browserName || '-'}</td>
                <td>${session.pageviews || 0}</td>
                <td>${session.totalInteractions || 0}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('세션 데이터 로드 실패:', error);
        document.getElementById('sessions-table-body').innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    데이터를 불러오는데 실패했습니다: ${error.message}
                </td>
            </tr>
        `;
    }
} 

// 백엔드 서버 Health Check 함수
function performHealthCheck() {
    fetch('https://user-behavior-analytics-api.onrender.com/healthz')
        .then(response => {
            if (!response.ok) {
                console.warn('Health check failed:', response.status);
            }
        })
        .catch(error => {
            console.warn('Health check error:', error);
        });
}

// 10분마다 헬스체크 실행 (15분 서스펜드 타임아웃 이전에 요청)
setInterval(performHealthCheck, 10 * 60 * 1000);

// 페이지 로드 시 즉시 한 번 실행
performHealthCheck(); 