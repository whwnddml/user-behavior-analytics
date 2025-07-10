/**
 * 사용자 행동 분석 시스템
 * 백엔드 API와 연동하여 실시간 사용자 데이터를 수집하고 전송합니다.
 */

// API 엔드포인트 설정
// 주의: 운영 서버 주소는 절대 변경하지 마세요! (Render 배포 주소)
if (!window.API_BASE_URL) {
    window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://user-behavior-analytics.onrender.com';
}

class UserAnalytics {
    constructor(config = {}) {
        // 기본 설정
        this.config = {
            apiEndpoint: config.apiEndpoint || window.API_BASE_URL,
            sendInterval: config.sendInterval || 30000, // 30초마다 전송
            maxRetries: config.maxRetries || 3,
            debug: config.debug || false,
            enableFormTracking: config.enableFormTracking !== false,
            enablePerformanceTracking: config.enablePerformanceTracking !== false,
            sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30분 세션 타임아웃
            ...config
        };

        // 방문자 ID 초기화
        this.visitorId = this.getOrCreateVisitorId();
        this.lastActivity = Date.now();

        // 데이터 저장소
        this.analyticsData = {
            visitorId: this.visitorId,
            sessionId: this.generateSessionId(),
            pageUrl: window.location.pathname,
            pageTitle: document.title,
            userAgent: navigator.userAgent,
            startTime: new Date(),
            areaEngagements: [],
            interactionMap: [],
            formAnalytics: [],
            performance: {},
            scrollMetrics: {
                scrollDepthBreakpoints: { 25: false, 50: false, 75: false, 100: false },
                deepestScroll: 0,
                scrollPattern: []
            }
        };

        // 추적 상태
        this.trackingState = {
            isInitialized: false,
            areaObserver: null,
            sendTimer: null,
            areaTimers: new Map(),
            formStates: new Map(),
            clickCount: 0,
            sessionStarted: false
        };

        // 이벤트 핸들러 바인딩
        this.boundHandlers = {
            click: this.handleClick.bind(this),
            beforeunload: this.handleBeforeUnload.bind(this),
            visibilitychange: this.handleVisibilityChange.bind(this)
        };

        this.init();
    }

    /**
     * 방문자 ID 가져오기 또는 생성
     */
    getOrCreateVisitorId() {
        let visitorId = localStorage.getItem('analytics_visitor_id');
        if (!visitorId) {
            visitorId = this.generateVisitorId();
            localStorage.setItem('analytics_visitor_id', visitorId);
            this.log('New visitor ID created:', visitorId);
        } else {
            this.log('Existing visitor ID found:', visitorId);
        }
        return visitorId;
    }

    /**
     * 새로운 방문자 ID 생성
     */
    generateVisitorId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `v_${timestamp}_${random}`;
    }

    /**
     * 세션 ID 생성
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `s_${this.visitorId}_${timestamp}_${random}`;
    }

    /**
     * 세션 상태 확인 및 갱신
     */
    checkSession() {
        const now = Date.now();
        if (now - this.lastActivity > this.config.sessionTimeout) {
            // 세션 타임아웃 - 새 세션 시작
            this.endSession();
            this.analyticsData.sessionId = this.generateSessionId();
            this.analyticsData.startTime = new Date();
            this.trackingState.sessionStarted = true;
            this.log('Session timeout - new session started:', this.analyticsData.sessionId);
        }
        this.lastActivity = now;
    }

    /**
     * 사용자 ID 설정 (로그인 시 호출)
     */
    setUserId(userId) {
        if (!userId) return;
        
        this.analyticsData.userId = userId;
        localStorage.setItem('analytics_user_id', userId);
        this.log('User ID set:', userId);
    }

    /**
     * 팝업 관련 이벤트 초기화
     */
    initPopupTracking() {
        const popupElements = document.querySelectorAll('.popup-coupon');
        
        popupElements.forEach(popup => {
            // 팝업 표시 상태 변경 감지
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'style') {
                        const isVisible = popup.style.display !== 'none';
                        if (isVisible) {
                            // 팝업이 열릴 때 하단 영역의 타이머 일시 중지
                            this.pauseBackgroundAreas();
                        } else {
                            // 팝업이 닫힐 때 하단 영역의 타이머 재개
                            this.resumeBackgroundAreas();
                        }
                    }
                });
            });
            
            observer.observe(popup, { attributes: true });
        });
    }

    /**
     * 하단 영역 타이머 일시 중지
     */
    pauseBackgroundAreas() {
        const popupArea = document.querySelector('.popup-coupon');
        if (!popupArea) return;

        // 모든 영역의 타이머를 일시 중지
        this.analyticsData.areaEngagements.forEach(area => {
            if (area.areaId !== 'popup-coupon') {
                const areaTimer = this.trackingState.areaTimers.get(area.areaId);
                if (areaTimer) {
                    clearInterval(areaTimer);
                    this.trackingState.areaTimers.delete(area.areaId);
                }
            }
        });

        this.log('Background area timers paused due to popup');
    }

    /**
     * 하단 영역 타이머 재개
     */
    resumeBackgroundAreas() {
        // 모든 영역에 대해 타이머 재시작
        const areas = document.querySelectorAll('.area[data-area-id]');
        areas.forEach(area => {
            const areaId = area.dataset.areaId;
            if (areaId !== 'popup-coupon') {
                // 이미 실행 중인 타이머가 있다면 제거
                const existingTimer = this.trackingState.areaTimers.get(areaId);
                if (existingTimer) {
                    clearInterval(existingTimer);
                }

                // 새로운 타이머 시작
                const timer = setInterval(() => this.updateActiveAreaTimers(), 1000);
                this.trackingState.areaTimers.set(areaId, timer);
            }
        });

        this.log('Background area timers resumed');
    }

    /**
     * 초기화
     */
    init() {
        if (this.trackingState.isInitialized) return;

        this.log('Initializing User Analytics...');

        // 바로 추적 시작
        this.startTracking();

        // 팝업 추적 초기화 추가
        this.initPopupTracking();

        this.trackingState.isInitialized = true;
    }

    /**
     * 추적 시작
     */
    startTracking() {
        // 성능 메트릭 수집
        this.collectPerformanceMetrics();

        // 영역 추적 초기화
        this.initAreaTracking();

        // 클릭 이벤트 추적
        this.initInteractionTracking();

        // 폼 추적 초기화 (설정된 경우)
        if (this.config.enableFormTracking) {
            this.initFormTracking();
        }

        // 가시성 변경 추적
        this.initVisibilityTracking();

        // 주기적 데이터 전송 시작
        this.startPeriodicSending();

        this.log('Tracking started');
    }

    /**
     * 성능 메트릭 수집
     */
    collectPerformanceMetrics() {
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        const timing = navigationEntry || performance.timing;

        this.analyticsData.performance = {
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint(),
            navigationtype: navigationEntry ? navigationEntry.type : 0
        };

        this.log('Performance metrics collected:', this.analyticsData.performance);
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
                }
                
                // 가시성 정보 업데이트
                areaData.visibility.viewportPercent = Math.round(entry.intersectionRatio * 100);
            } else {
                // 영역이 보이지 않게 됨
                const startTime = this.trackingState.areaTimers.get(areaId);
                if (startTime) {
                    const timeSpent = currentTime - startTime;
                    areaData.timeSpent = Math.round(areaData.timeSpent + timeSpent); // 소수점을 정수로 변환
                    areaData.visibility.visibleTime = Math.round(areaData.visibility.visibleTime + timeSpent); // 소수점을 정수로 변환
                    areaData.lastEngagement = currentTime;
                    this.trackingState.areaTimers.delete(areaId);
                }
            }
        });
    }

    /**
     * 인터랙션 추적 초기화
     */
    initInteractionTracking() {
        // 클릭 이벤트만 추적
        window.addEventListener('click', this.boundHandlers.click);
        window.addEventListener('beforeunload', this.boundHandlers.beforeunload);
    }

    /**
     * 클릭 이벤트 처리
     */
    handleClick(event) {
        const target = event.target;
        const areaElement = target.closest('[data-area-id]');
        const areaId = areaElement ? areaElement.dataset.areaId : null;

        // 클릭 위치 정규화 (뷰포트 기준 0-100%)
        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;

        // 클릭 데이터 기록
        this.analyticsData.interactionMap.push({
            x,
            y,
            type: 'click',
            targetElement: target.tagName.toLowerCase(),
            timestamp: new Date(),
            areaId
        });

        // 영역 클릭 카운트 증가
        if (areaId) {
            const areaData = this.analyticsData.areaEngagements.find(a => a.areaId === areaId);
            if (areaData) {
                areaData.interactions = (areaData.interactions || 0) + 1;
                areaData.lastEngagement = new Date();
            }
        }

        this.trackingState.clickCount++;

        // 디버그 모드에서 클릭 효과 표시
        if (this.config.debug) {
            this.createClickEffect(event.clientX, event.clientY);
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
     * 숫자 값을 정수로 변환
     */
    ensureInteger(value) {
        if (typeof value === 'number') {
            return Math.round(value);
        }
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : Math.round(parsed);
        }
        return 0;
    }

    /**
     * 분석 데이터 전송
     */
    async sendAnalyticsData(isBeforeUnload = false) {
        try {
            // 시간 값을 ISO 문자열로 변환하는 헬퍼 함수
            const toISOString = (value) => {
                if (!value) return new Date().toISOString();
                if (value instanceof Date) return value.toISOString();
                if (typeof value === 'number') return new Date(value).toISOString();
                return value;
            };

            // 숫자 값을 정수로 변환하는 헬퍼 함수
            const ensureNumber = (value, defaultValue = 0) => {
                if (value === null || value === undefined) return defaultValue;
                const num = Number(value);
                return isNaN(num) ? defaultValue : Math.round(num);
            };

            // 현재 상태 업데이트
            this.updateActiveAreaTimers();

            // 기본 배열 데이터 초기화
            if (!this.analyticsData.interactionMap) this.analyticsData.interactionMap = [];
            if (!this.analyticsData.formAnalytics) this.analyticsData.formAnalytics = [];

            // 전송할 데이터 준비
            const payload = {
                visitorId: this.analyticsData.visitorId,
                sessionId: this.analyticsData.sessionId,
                pageUrl: new URL(this.analyticsData.pageUrl, window.location.origin).pathname,  // URL을 pathname으로 변환
                pageTitle: this.analyticsData.pageTitle,
                userAgent: this.analyticsData.userAgent,
                startTime: toISOString(this.analyticsData.startTime),
                endTime: isBeforeUnload ? toISOString(new Date()) : null,
                performance: {
                    loadTime: ensureNumber(this.analyticsData.performance.loadTime),
                    domContentLoaded: ensureNumber(this.analyticsData.performance.domContentLoaded),
                    firstPaint: ensureNumber(this.analyticsData.performance.firstPaint),
                    firstContentfulPaint: ensureNumber(this.analyticsData.performance.firstContentfulPaint),
                    navigationtype: ensureNumber(this.analyticsData.performance.navigationtype, 0)
                },
                areaEngagements: (this.analyticsData.areaEngagements || []).map(area => ({
                    areaId: area.areaId,
                    areaName: area.areaName,
                    areaType: area.areaType || 'default',
                    timeSpent: ensureNumber(area.timeSpent),
                    interactions: ensureNumber(area.interactions),
                    firstEngagement: toISOString(area.firstEngagement || this.analyticsData.startTime),
                    lastEngagement: toISOString(area.lastEngagement || new Date()),
                    visibility: {
                        visibleTime: ensureNumber(area.visibility.visibleTime),
                        viewportPercent: ensureNumber(area.visibility.viewportPercent)
                    }
                })),
                interactionMap: (this.analyticsData.interactionMap || []).map(interaction => ({
                    x: ensureNumber(interaction.x),
                    y: ensureNumber(interaction.y),
                    type: interaction.type,
                    targetElement: interaction.targetElement,
                    timestamp: toISOString(interaction.timestamp),
                    recordedAt: toISOString(interaction.timestamp),
                    areaId: interaction.areaId || null
                })),
                formAnalytics: (this.analyticsData.formAnalytics || []).map(form => ({
                    formId: form.formId || 'unknown',
                    fieldName: form.fieldName || 'unknown',
                    interactionType: form.interactionType || 'input',
                    timeSpent: ensureNumber(form.timeSpent),
                    errorCount: ensureNumber(form.errorCount),
                    completed: Boolean(form.completed)
                }))
            };

            // 마지막 전송된 payload 저장
            this.lastPayload = payload;

            this.log('Sending payload:', {
                interactionMap: payload.interactionMap,
                timestamp: payload.interactionMap[0]?.timestamp,
                recordedAt: payload.interactionMap[0]?.recordedAt
            });

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
            if (error.message.includes('400')) {
                this.log('Last sent payload:', this.lastPayload);
            }
            throw error;
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
        window.removeEventListener('click', this.boundHandlers.click);
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