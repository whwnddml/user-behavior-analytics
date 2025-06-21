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

// API 기본 URL 설정
const API_BASE_URL = window.location.hostname === 'whwnddml.github.io'
    ? 'https://user-behavior-analytics.onrender.com'
    : '';

// 차트 객체 저장소
let charts = {
    areaChart: null,
    deviceChart: null,
    timeChart: null
};

// 에러 표시
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
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

    // 영역별 체류시간 차트
    charts.areaChart = new Chart(document.getElementById('areaChart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '평균 체류시간 (초)',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '영역별 평균 체류시간'
                }
            }
        }
    });

    // 디바이스별 통계 차트
    charts.deviceChart = new Chart(document.getElementById('deviceChart'), {
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
            plugins: {
                title: {
                    display: true,
                    text: '디바이스별 사용자 분포'
                }
            }
        }
    });

    // 시간대별 활동 차트
    charts.timeChart = new Chart(document.getElementById('timeChart'), {
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
            plugins: {
                title: {
                    display: true,
                    text: '시간대별 활동량'
                }
            }
        }
    });
}

// 데이터 로드
async function loadDashboardData() {
    try {
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const page = document.getElementById('page-filter').value;

        // API 호출
        const response = await fetch(`${API_BASE_URL}/api/analytics/dashboard-stats?${new URLSearchParams({
            dateFrom,
            dateTo,
            page
        })}`);

        if (!response.ok) throw new Error('API 요청 실패');
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        updateCharts(result.data);
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        showError(`데이터를 불러오는데 실패했습니다: ${error.message}`);
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
    initializeCharts();
    loadDashboardData();

    // 필터 변경 이벤트
    ['date-from', 'date-to', 'page-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', loadDashboardData);
    });
}); 