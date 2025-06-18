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

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initAreaEngagement();
    initScrollTracking();
    initInteractionTracking();
    initFormAnalytics();
}); 