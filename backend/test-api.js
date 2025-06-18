// 간단한 API 테스트 스크립트
const testData = {
  sessionId: 'test_session_' + Date.now(),
  pageUrl: 'http://localhost:3000/test',
  pageTitle: 'Test Page',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  performance: {
    loadTime: 1200,
    domContentLoaded: 800,
    firstPaint: 600,
    firstContentfulPaint: 700
  },

  areaEngagements: [
    {
      areaId: 'header',
      areaName: '헤더',
      areaType: 'header',
      timeSpent: 5000,
      interactions: 3,
      firstEngagement: new Date(Date.now() - 10000).toISOString(),
      lastEngagement: new Date().toISOString(),
      visibility: {
        visibleTime: 4500,
        viewportPercent: 100
      }
    },
    {
      areaId: 'main-content',
      areaName: '메인 콘텐츠',
      areaType: 'content',
      timeSpent: 15000,
      interactions: 8,
      firstEngagement: new Date(Date.now() - 8000).toISOString(),
      lastEngagement: new Date().toISOString(),
      visibility: {
        visibleTime: 14000,
        viewportPercent: 75
      }
    }
  ],

  scrollMetrics: {
    deepestScroll: 85.5,
    scrollDepthBreakpoints: {
      25: Date.now() - 8000,
      50: Date.now() - 6000,
      75: Date.now() - 3000
    },
    scrollPattern: [
      {
        position: 10,
        timestamp: new Date(Date.now() - 9000).toISOString(),
        direction: 'down',
        speed: 5
      },
      {
        position: 25,
        timestamp: new Date(Date.now() - 8000).toISOString(),
        direction: 'down',
        speed: 3
      }
    ]
  },

  interactionMap: [
    {
      x: 150,
      y: 200,
      type: 'click',
      targetElement: 'BUTTON',
      timestamp: new Date(Date.now() - 5000).toISOString(),
      areaId: 'header'
    },
    {
      x: 300,
      y: 400,
      type: 'click',
      targetElement: 'A',
      timestamp: new Date(Date.now() - 3000).toISOString(),
      areaId: 'main-content'
    }
  ],

  formAnalytics: [
    {
      formId: 'contact-form',
      fieldName: 'name',
      interactionType: 'input',
      timeSpent: 2000,
      errorCount: 0,
      completed: true
    },
    {
      formId: 'contact-form',
      fieldName: 'email',
      interactionType: 'input',
      timeSpent: 3000,
      errorCount: 1,
      completed: true
    }
  ]
};

console.log('🧪 API 테스트 데이터:');
console.log(JSON.stringify(testData, null, 2));

console.log('\n📡 테스트 명령어:');
console.log(`curl -X POST http://localhost:3000/api/analytics/collect \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testData)}'`);

console.log('\n🔍 Health Check:');
console.log('curl http://localhost:3000/api/health');

console.log('\n💡 실제 테스트 방법:');
console.log('1. 백엔드 서버가 실행 중인지 확인하세요: npm run dev');
console.log('2. 새 터미널에서 위의 curl 명령어를 실행하세요');
console.log('3. 또는 Postman/Insomnia 같은 API 테스트 도구를 사용하세요'); 