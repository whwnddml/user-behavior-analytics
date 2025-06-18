/**
 * 사용자 행동 분석 시스템
 * 백엔드 API와 연동하여 실시간 사용자 데이터를 수집하고 전송합니다.
 */

class UserAnalytics {
    constructor(config = {}) {
        // 기본 설정
        const hostname = window.location.hostname;
        const isProd = hostname.includes('github.io') || (hostname !== 'localhost' && hostname !== '127.0.0.1');
        
        // API 엔드포인트 설정
        const defaultApiEndpoint = isProd 
            ? 'https://user-behavior-analytics.onrender.com/api/analytics'
            : 'http://localhost:3000/api/analytics';

        this.config = {
            apiEndpoint: config.apiEndpoint || defaultApiEndpoint,
            sendInterval: config.sendInterval || 30000, // 30초마다 전송
            maxRetries: config.maxRetries || 3,
            debug: config.debug || false,
            enableHeatmap: config.enableHeatmap !== false,
            enableScrollTracking: config.enableScrollTracking !== false,
            enableFormTracking: config.enableFormTracking !== false,
            enablePerformanceTracking: config.enablePerformanceTracking !== false,
            ...config
        };

        // 데이터 저장소
        this.analyticsData = {
            sessionId: this.generateSessionId(),
            pageUrl: window.location.href,
            pageTitle: document.title,
            userAgent: navigator.userAgent,
            startTime: new Date(),
            areaEngagements: [],
            scrollMetrics: {
                deepestScroll: 0,
                scrollDepthBreakpoints: {},
                scrollPattern: []
            },
            interactionMap: [],
            formAnalytics: [],
            performance: {}
        };

        // 추적 상태
        this.trackingState = {
            isInitialized: false,
            areaObserver: null,
            scrollTimeout: null,
            sendTimer: null,
            lastScrollPosition: 0,
            areaTimers: new Map(),
            formStates: new Map(),
            clickCount: 0,
            sessionStarted: false
        };

        // 이벤트 핸들러 바인딩
        this.boundHandlers = {
            scroll: this.throttle(this.handleScroll.bind(this), 100),
            click: this.handleClick.bind(this),
            mousemove: this.throttle(this.handleMouseMove.bind(this), 200),
            beforeunload: this.handleBeforeUnload.bind(this),
            visibilitychange: this.handleVisibilityChange.bind(this)
        };

        this.init();
    }

    /**
     * 초기화
     */
    init() {
        if (this.trackingState.isInitialized) return;

        this.log('Initializing User Analytics...');

        // DOM이 로드되면 추적 시작
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.startTracking());
        } else {
            this.startTracking();
        }

        this.trackingState.isInitialized = true;
    }

    /**
     * 추적 시작
     */
    startTracking() {
        this.log('Starting user behavior tracking...');

        // 성능 메트릭 수집
        if (this.config.enablePerformanceTracking) {
            this.collectPerformanceMetrics();
        }

        // 영역 추적 초기화
        this.initAreaTracking();

        // 스크롤 추적 초기화
        if (this.config.enableScrollTracking) {
            this.initScrollTracking();
        }

        // 인터랙션 추적 초기화
        this.initInteractionTracking();

        // 폼 추적 초기화
        if (this.config.enableFormTracking) {
            this.initFormTracking();
        }

        // 페이지 가시성 변경 추적
        this.initVisibilityTracking();

        // 주기적 데이터 전송 시작
        this.startPeriodicSending();

        // 세션 시작 로그
        this.trackingState.sessionStarted = true;
        this.log('Session started:', this.analyticsData.sessionId);
    }

    /**
     * 세션 ID 생성
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `session_${timestamp}_${random}`;
    }

    /**
     * 성능 메트릭 수집
     */
    collectPerformanceMetrics() {
        if (!window.performance || !window.performance.timing) return;

        const timing = window.performance.timing;
        const navigation = window.performance.navigation;

        // 페이지 로드 완료 후 메트릭 수집
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.analyticsData.performance = {
                    loadTime: timing.loadEventEnd - timing.navigationStart,
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    firstPaint: this.getFirstPaint(),
                    firstContentfulPaint: this.getFirstContentfulPaint(),
                    navigationtype: navigation.type
                };
                this.log('Performance metrics collected:', this.analyticsData.performance);
            }, 100);
        });
    }

    /**
     * First Paint 시간 가져오기
     */
    getFirstPaint() {
        if (window.performance && window.performance.getEntriesByType) {
            const paintEntries = window.performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
            return firstPaint ? Math.round(firstPaint.startTime) : null;
        }
        return null;
    }

    /**
     * First Contentful Paint 시간 가져오기
     */
    getFirstContentfulPaint() {
        if (window.performance && window.performance.getEntriesByType) {
            const paintEntries = window.performance.getEntriesByType('paint');
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            return fcp ? Math.round(fcp.startTime) : null;
        }
        return null;
    }

    /**
     * 영역 추적 초기화
     */
    initAreaTracking() {
        const areas = document.querySelectorAll('.area[data-area-id]');
        if (areas.length === 0) return;

        // Intersection Observer 설정
        this.trackingState.areaObserver = new IntersectionObserver(
            (entries) => this.handleAreaIntersection(entries),
            {
                root: null,
                rootMargin: '0px',
                threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0]
            }
        );

        // 모든 영역 관찰 시작
        areas.forEach(area => {
            this.trackingState.areaObserver.observe(area);
            
            // 영역 데이터 초기화
            const areaId = area.dataset.areaId;
            const areaName = area.dataset.areaName || areaId;
            const areaType = area.dataset.areaType || 'content';

            const existingArea = this.analyticsData.areaEngagements.find(a => a.areaId === areaId);
            if (!existingArea) {
                this.analyticsData.areaEngagements.push({
                    areaId,
                    areaName,
                    areaType,
                    timeSpent: 0,
                    interactions: 0,
                    firstEngagement: null,
                    lastEngagement: null,
                    visibility: {
                        visibleTime: 0,
                        viewportPercent: 0
                    }
                });
            }
        });

        this.log(`Area tracking initialized for ${areas.length} areas`);
    }

    /**
     * 영역 교차 처리
     */
    handleAreaIntersection(entries) {
        entries.forEach(entry => {
            const areaId = entry.target.dataset.areaId;
            const areaData = this.analyticsData.areaEngagements.find(a => a.areaId === areaId);
            
            if (!areaData) return;

            const currentTime = new Date();
            const isVisible = entry.isIntersecting && entry.intersectionRatio > 0.1;

            if (isVisible) {
                // 영역이 보이기 시작
                if (!this.trackingState.areaTimers.has(areaId)) {
                    this.trackingState.areaTimers.set(areaId, currentTime);
                    
                    if (!areaData.firstEngagement) {
                        areaData.firstEngagement = currentTime;
                    }
                    areaData.lastEngagement = currentTime;
                }
            } else {
                // 영역이 보이지 않음
                if (this.trackingState.areaTimers.has(areaId)) {
                    const startTime = this.trackingState.areaTimers.get(areaId);
                    const timeSpent = currentTime - startTime;
                    areaData.timeSpent += timeSpent;
                    areaData.visibility.visibleTime += timeSpent;
                    
                    this.trackingState.areaTimers.delete(areaId);
                }
            }

            // 뷰포트 비율 업데이트
            areaData.visibility.viewportPercent = Math.max(
                areaData.visibility.viewportPercent,
                entry.intersectionRatio * 100
            );
        });
    }

    /**
     * 스크롤 추적 초기화
     */
    initScrollTracking() {
        window.addEventListener('scroll', this.boundHandlers.scroll, { passive: true });
        this.log('Scroll tracking initialized');
    }

    /**
     * 스크롤 이벤트 처리
     */
    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollPercent = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);

        // 최대 스크롤 깊이 업데이트
        if (scrollPercent > this.analyticsData.scrollMetrics.deepestScroll) {
            this.analyticsData.scrollMetrics.deepestScroll = scrollPercent;
        }

        // 스크롤 깊이 이정표 기록
        [25, 50, 75, 100].forEach(depth => {
            if (scrollPercent >= depth && !this.analyticsData.scrollMetrics.scrollDepthBreakpoints[depth]) {
                this.analyticsData.scrollMetrics.scrollDepthBreakpoints[depth] = new Date().getTime();
            }
        });

        // 스크롤 패턴 기록 (샘플링)
        if (this.analyticsData.scrollMetrics.scrollPattern.length < 1000) {
            const direction = scrollTop > this.trackingState.lastScrollPosition ? 'down' : 'up';
            const speed = Math.abs(scrollTop - this.trackingState.lastScrollPosition);

            this.analyticsData.scrollMetrics.scrollPattern.push({
                position: scrollPercent,
                direction,
                speed,
                timestamp: Date.now()
            });
        }

        this.trackingState.lastScrollPosition = scrollTop;

        // 스크롤 진행바 업데이트
        this.updateScrollProgress(scrollPercent);
    }

    /**
     * 스크롤 진행바 업데이트
     */
    updateScrollProgress(percent) {
        const progressBar = document.getElementById('scroll-progress');
        if (progressBar) {
            progressBar.style.width = `${Math.min(percent, 100)}%`;
        }
    }

    /**
     * 인터랙션 추적 초기화
     */
    initInteractionTracking() {
        document.addEventListener('click', this.boundHandlers.click, true);
        if (this.config.enableHeatmap) {
            document.addEventListener('mousemove', this.boundHandlers.mousemove, { passive: true });
        }
        this.log('Interaction tracking initialized');
    }

    /**
     * 클릭 이벤트 처리
     */
    handleClick(event) {
        const areaElement = event.target.closest('.area[data-area-id]');
        const areaId = areaElement ? areaElement.dataset.areaId : null;

        // 클릭 데이터 기록
        this.analyticsData.interactionMap.push({
            type: 'click',
            targetElement: event.target.tagName.toLowerCase(),
            x: event.clientX,
            y: event.clientY,
            timestamp: Date.now(),
            areaId
        });

        // 영역 인터랙션 카운트 증가
        if (areaId) {
            const areaData = this.analyticsData.areaEngagements.find(a => a.areaId === areaId);
            if (areaData) {
                areaData.interactions++;
            }
        }

        this.trackingState.clickCount++;

        // 클릭 효과 생성
        this.createClickEffect(event.clientX, event.clientY);

        this.log('Click recorded:', { x: event.clientX, y: event.clientY, area: areaId });
    }

    /**
     * 마우스 이동 이벤트 처리
     */
    handleMouseMove(event) {
        const areaElement = event.target.closest('.area[data-area-id]');
        const areaId = areaElement ? areaElement.dataset.areaId : null;

        // 히트맵 데이터로 마우스 이동 기록 (샘플링)
        if (this.analyticsData.interactionMap.length < 5000) {
            this.analyticsData.interactionMap.push({
                type: 'hover',
                targetElement: event.target.tagName.toLowerCase(),
                x: event.clientX,
                y: event.clientY,
                timestamp: Date.now(),
                areaId
            });
        }
    }

    /**
     * 클릭 효과 생성
     */
    createClickEffect(x, y) {
        const effect = document.createElement('div');
        effect.className = 'click-effect';
        effect.style.position = 'fixed';
        effect.style.left = (x - 10) + 'px';
        effect.style.top = (y - 10) + 'px';
        effect.style.width = '20px';
        effect.style.height = '20px';
        effect.style.border = '2px solid #007bff';
        effect.style.borderRadius = '50%';
        effect.style.pointerEvents = 'none';
        effect.style.zIndex = '9999';
        effect.style.animation = 'clickRipple 0.6s ease-out';
        
        document.body.appendChild(effect);
        
        setTimeout(() => {
            if (document.body.contains(effect)) {
                document.body.removeChild(effect);
            }
        }, 600);
    }

    /**
     * 폼 추적 초기화
     */
    initFormTracking() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => this.trackForm(form));
        this.log(`Form tracking initialized for ${forms.length} forms`);
    }

    /**
     * 개별 폼 추적
     */
    trackForm(form) {
        const formId = form.id || `form_${Date.now()}`;
        const fields = form.querySelectorAll('input, textarea, select');

        // 폼 상태 초기화
        const formState = {
            formId,
            fields: new Map(),
            startTime: null,
            submitted: false
        };

        // 각 필드 추적
        fields.forEach(field => {
            const fieldName = field.name || field.id || `field_${Date.now()}`;
            
            formState.fields.set(fieldName, {
                fieldName,
                focusTime: null,
                timeSpent: 0,
                errorCount: 0,
                completed: false,
                valueChanges: 0
            });

            // 필드 이벤트 리스너
            field.addEventListener('focus', () => {
                const fieldData = formState.fields.get(fieldName);
                fieldData.focusTime = Date.now();
                
                if (!formState.startTime) {
                    formState.startTime = Date.now();
                }
            });

            field.addEventListener('blur', () => {
                const fieldData = formState.fields.get(fieldName);
                if (fieldData.focusTime) {
                    fieldData.timeSpent += Date.now() - fieldData.focusTime;
                    fieldData.completed = field.value.trim().length > 0;
                    fieldData.focusTime = null;
                }
            });

            field.addEventListener('input', () => {
                const fieldData = formState.fields.get(fieldName);
                fieldData.valueChanges++;
            });

            field.addEventListener('invalid', () => {
                const fieldData = formState.fields.get(fieldName);
                fieldData.errorCount++;
            });
        });

        // 폼 제출 이벤트
        form.addEventListener('submit', (event) => {
            formState.submitted = true;
            this.recordFormAnalytics(formState);
            
            // 실제 폼 제출 방지 (데모용)
            event.preventDefault();
            alert('폼 제출이 분석 시스템에 기록되었습니다!');
        });

        // 폼 리셋 이벤트
        form.addEventListener('reset', () => {
            formState.fields.forEach(fieldData => {
                fieldData.timeSpent = 0;
                fieldData.errorCount = 0;
                fieldData.completed = false;
                fieldData.valueChanges = 0;
            });
        });

        this.trackingState.formStates.set(formId, formState);
    }

    /**
     * 폼 분석 데이터 기록
     */
    recordFormAnalytics(formState) {
        const formAnalytics = Array.from(formState.fields.values()).map(fieldData => ({
            formId: formState.formId,
            fieldName: fieldData.fieldName,
            timeSpent: fieldData.timeSpent,
            errorCount: fieldData.errorCount,
            completed: fieldData.completed
        }));

        this.analyticsData.formAnalytics.push(...formAnalytics);
        this.log('Form analytics recorded:', formAnalytics);
    }

    /**
     * 페이지 가시성 추적 초기화
     */
    initVisibilityTracking() {
        document.addEventListener('visibilitychange', this.boundHandlers.visibilitychange);
        window.addEventListener('beforeunload', this.boundHandlers.beforeunload);
    }

    /**
     * 페이지 가시성 변경 처리
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // 페이지가 숨겨짐 - 현재 영역 타이머 일시정지
            this.pauseAreaTimers();
            this.log('Page hidden - timers paused');
        } else {
            // 페이지가 다시 보임 - 타이머 재시작
            this.resumeAreaTimers();
            this.log('Page visible - timers resumed');
        }
    }

    /**
     * 영역 타이머 일시정지
     */
    pauseAreaTimers() {
        const currentTime = new Date();
        this.trackingState.areaTimers.forEach((startTime, areaId) => {
            const areaData = this.analyticsData.areaEngagements.find(a => a.areaId === areaId);
            if (areaData) {
                const timeSpent = currentTime - startTime;
                areaData.timeSpent += timeSpent;
                areaData.visibility.visibleTime += timeSpent;
            }
        });
        this.trackingState.areaTimers.clear();
    }

    /**
     * 영역 타이머 재시작
     */
    resumeAreaTimers() {
        // 현재 보이는 영역들의 타이머 재시작
        if (this.trackingState.areaObserver) {
            this.trackingState.areaObserver.takeRecords().forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                    this.trackingState.areaTimers.set(entry.target.dataset.areaId, new Date());
                }
            });
        }
    }

    /**
     * 페이지 언로드 처리
     */
    handleBeforeUnload() {
        this.pauseAreaTimers();
        this.sendAnalyticsData(true); // 즉시 전송
        this.endSession();
    }

    /**
     * 주기적 데이터 전송 시작
     */
    startPeriodicSending() {
        this.trackingState.sendTimer = setInterval(() => {
            this.sendAnalyticsData();
        }, this.config.sendInterval);

        this.log(`Periodic sending started (interval: ${this.config.sendInterval}ms)`);
    }

    /**
     * 분석 데이터 전송
     */
    async sendAnalyticsData(isBeforeUnload = false) {
        let payload;
        try {
            // 현재 진행 중인 영역 타이머 업데이트
            this.updateActiveAreaTimers();

            // 날짜/시간 데이터를 ISO 문자열로 변환하는 헬퍼 함수
            const toISOString = (value) => {
                if (!value) return new Date().toISOString();  // 빈 값은 현재 시간으로
                if (value instanceof Date) return value.toISOString();
                if (typeof value === 'number') return new Date(value).toISOString();
                return value;
            };

            // 숫자 필드 검증 및 기본값 설정
            const ensureNumber = (value, defaultValue = 0) => {
                const num = Number(value);
                return isNaN(num) ? defaultValue : num;
            };

            // 스크롤 브레이크포인트 값 변환
            const toScrollBreakpoint = (value) => {
                if (!value) return 0;  // null이나 undefined는 0으로
                if (typeof value === 'number') return value;
                if (typeof value === 'string') {
                    const num = Number(value);
                    return isNaN(num) ? 0 : num;
                }
                return 0;
            };

            // 데이터 구조 검증
            const validateData = (data, path = '') => {
                if (data === undefined || data === null) {
                    this.log(`Warning: Missing data at ${path}`);
                    return false;
                }
                if (typeof data === 'object') {
                    Object.entries(data).forEach(([key, value]) => {
                        validateData(value, path ? `${path}.${key}` : key);
                    });
                }
                return true;
            };

            // 원본 데이터 로깅
            this.log('Raw analytics data:', {
                sessionId: this.analyticsData.sessionId,
                pageUrl: this.analyticsData.pageUrl,
                pageTitle: this.analyticsData.pageTitle,
                startTime: this.analyticsData.startTime,
                scrollMetrics: this.analyticsData.scrollMetrics,
                areaEngagements: this.analyticsData.areaEngagements,
                interactionMap: this.analyticsData.interactionMap,
                formAnalytics: this.analyticsData.formAnalytics,
                performance: this.analyticsData.performance
            });

            const now = new Date().toISOString();

            payload = {
                sessionId: this.analyticsData.sessionId,
                pageUrl: this.analyticsData.pageUrl,
                pageTitle: this.analyticsData.pageTitle || '',
                userAgent: this.analyticsData.userAgent,
                startTime: toISOString(this.analyticsData.startTime),
                areaEngagements: (this.analyticsData.areaEngagements || []).map(area => {
                    const engagement = {
                        areaId: area.areaId,
                        areaName: area.areaName,
                        areaType: area.areaType || 'default',
                        timeSpent: ensureNumber(area.timeSpent),
                        interactions: ensureNumber(area.interactions),
                        firstEngagement: toISOString(area.firstEngagement),
                        lastEngagement: toISOString(area.lastEngagement),
                        visibility: {
                            visibleTime: ensureNumber(area.visibility?.visibleTime),
                            viewportPercent: Math.min(100, Math.max(0, ensureNumber(area.visibility?.viewportPercent)))
                        }
                    };
                    validateData(engagement, `areaEngagements[${area.areaId}]`);
                    return engagement;
                }),
                scrollMetrics: {
                    deepestScroll: Math.min(100, Math.max(0, ensureNumber(this.analyticsData.scrollMetrics?.deepestScroll))),
                    scrollDepthBreakpoints: {
                        25: toScrollBreakpoint(this.analyticsData.scrollMetrics?.scrollDepthBreakpoints?.[25]),
                        50: toScrollBreakpoint(this.analyticsData.scrollMetrics?.scrollDepthBreakpoints?.[50]),
                        75: toScrollBreakpoint(this.analyticsData.scrollMetrics?.scrollDepthBreakpoints?.[75]),
                        100: toScrollBreakpoint(this.analyticsData.scrollMetrics?.scrollDepthBreakpoints?.[100])
                    },
                    scrollPattern: (this.analyticsData.scrollMetrics?.scrollPattern || []).map(pattern => {
                        const p = {
                            position: Math.min(100, Math.max(0, ensureNumber(pattern.position))),
                            timestamp: toISOString(pattern.timestamp),
                            direction: pattern.direction || 'down',
                            speed: ensureNumber(pattern.speed)
                        };
                        validateData(p, 'scrollPattern');
                        return p;
                    })
                },
                interactionMap: (this.analyticsData.interactionMap || []).map(interaction => {
                    const i = {
                        x: ensureNumber(interaction.x),
                        y: ensureNumber(interaction.y),
                        type: interaction.type || 'click',
                        targetElement: interaction.targetElement || 'unknown',
                        timestamp: toISOString(interaction.timestamp),
                        areaId: interaction.areaId || null
                    };
                    validateData(i, 'interactionMap');
                    return i;
                }),
                formAnalytics: (this.analyticsData.formAnalytics || []).map(form => {
                    const f = {
                        formId: form.formId,
                        fieldName: form.fieldName,
                        interactionType: form.interactionType,
                        timeSpent: ensureNumber(form.timeSpent),
                        errorCount: ensureNumber(form.errorCount),
                        completed: Boolean(form.completed)
                    };
                    validateData(f, 'formAnalytics');
                    return f;
                }),
                performance: {
                    loadTime: ensureNumber(this.analyticsData.performance?.loadTime),
                    domContentLoaded: ensureNumber(this.analyticsData.performance?.domContentLoaded),
                    firstPaint: ensureNumber(this.analyticsData.performance?.firstPaint),
                    firstContentfulPaint: ensureNumber(this.analyticsData.performance?.firstContentfulPaint),
                    navigationtype: ensureNumber(this.analyticsData.performance?.navigationtype)
                }
            };

            validateData(payload, 'root');
            this.log('Processed payload:', payload);

            const response = await fetch(`${this.config.apiEndpoint}/collect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                keepalive: isBeforeUnload
            });

            if (response.ok) {
                const result = await response.json();
                this.log('Analytics data sent successfully:', result);
                this.resetTransientData();
            } else {
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorData.message || response.statusText;
                    this.log('Server validation error:', errorData);
                } catch {
                    errorMessage = errorText || response.statusText;
                }
                this.log('Server response:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorMessage
                });
                throw new Error(`HTTP ${response.status}: ${errorMessage}`);
            }

        } catch (error) {
            this.log('Error sending analytics data:', error);
            if (error.message.includes('400') && payload) {
                this.log('Last sent payload:', payload);
            }
        }
    }

    /**
     * 활성 영역 타이머 업데이트
     */
    updateActiveAreaTimers() {
        const currentTime = new Date();
        this.trackingState.areaTimers.forEach((startTime, areaId) => {
            const areaData = this.analyticsData.areaEngagements.find(a => a.areaId === areaId);
            if (areaData) {
                const additionalTime = currentTime - startTime;
                areaData.timeSpent += additionalTime;
                areaData.visibility.visibleTime += additionalTime;
            }
        });

        // 타이머 리셋
        this.trackingState.areaTimers.forEach((startTime, areaId) => {
            this.trackingState.areaTimers.set(areaId, currentTime);
        });
    }

    /**
     * 일시적 데이터 초기화 (인터랙션, 스크롤 패턴 등)
     */
    resetTransientData() {
        // 스크롤 패턴은 너무 많이 쌓이지 않도록 제한
        if (this.analyticsData.scrollMetrics.scrollPattern.length > 500) {
            this.analyticsData.scrollMetrics.scrollPattern = 
                this.analyticsData.scrollMetrics.scrollPattern.slice(-250);
        }

        // 인터랙션 맵도 제한
        if (this.analyticsData.interactionMap.length > 1000) {
            this.analyticsData.interactionMap = 
                this.analyticsData.interactionMap.slice(-500);
        }
    }

    /**
     * 세션 종료
     */
    async endSession() {
        try {
            const response = await fetch(`${this.config.apiEndpoint}/session/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.analyticsData.sessionId
                }),
                keepalive: true
            });

            if (response.ok) {
                this.log('Session ended successfully');
            }
        } catch (error) {
            this.log('Error ending session:', error);
        }
    }

    /**
     * 현재 통계 가져오기
     */
    getCurrentStats() {
        const activeAreas = this.trackingState.areaTimers.size;
        
        return {
            sessionId: this.analyticsData.sessionId,
            loadTime: this.analyticsData.performance.loadTime,
            scrollDepth: this.analyticsData.scrollMetrics.deepestScroll,
            clickCount: this.trackingState.clickCount,
            activeAreas,
            formInteractions: this.analyticsData.formAnalytics.length,
            totalInteractions: this.analyticsData.interactionMap.length
        };
    }

    /**
     * 스로틀링 유틸리티
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 로깅 유틸리티
     */
    log(...args) {
        if (this.config.debug) {
            console.log('[UserAnalytics]', ...args);
        }
    }

    /**
     * 추적 중지
     */
    stop() {
        // 이벤트 리스너 제거
        window.removeEventListener('scroll', this.boundHandlers.scroll);
        document.removeEventListener('click', this.boundHandlers.click);
        document.removeEventListener('mousemove', this.boundHandlers.mousemove);
        document.removeEventListener('visibilitychange', this.boundHandlers.visibilitychange);
        window.removeEventListener('beforeunload', this.boundHandlers.beforeunload);

        // 타이머 중지
        if (this.trackingState.sendTimer) {
            clearInterval(this.trackingState.sendTimer);
        }

        // Observer 중지
        if (this.trackingState.areaObserver) {
            this.trackingState.areaObserver.disconnect();
        }

        // 마지막 데이터 전송
        this.sendAnalyticsData();
        this.endSession();

        this.log('User analytics tracking stopped');
    }
}

// 전역 인스턴스 생성
window.UserAnalytics = new UserAnalytics({
    debug: true, // 개발 중에는 디버그 모드 활성화
    sendInterval: 30000 // 30초마다 전송
});

// CSS 애니메이션 동적 추가
if (!document.getElementById('analytics-styles')) {
    const style = document.createElement('style');
    style.id = 'analytics-styles';
    style.textContent = `
        @keyframes clickRipple {
            to {
                transform: scale(3);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 개발자 도구에서 사용할 수 있는 헬퍼 함수들
window.analyticsHelpers = {
    getCurrentData: () => window.UserAnalytics.analyticsData,
    getCurrentStats: () => window.UserAnalytics.getCurrentStats(),
    sendDataNow: () => window.UserAnalytics.sendAnalyticsData(),
    endSession: () => window.UserAnalytics.endSession(),
    stopTracking: () => window.UserAnalytics.stop()
};

console.log('🚀 User Analytics System Loaded!');
console.log('Use window.analyticsHelpers for debugging'); 