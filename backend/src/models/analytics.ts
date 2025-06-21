import { pool } from '../config/database';
import {
  SessionData,
  PageviewData,
  AreaEngagementData,
  ScrollMetricsData,
  ScrollPatternData,
  InteractionData,
  FormAnalyticsData,
  FormFieldAnalyticsData
} from '../types';
import logger from '../config/logger';

export class AnalyticsModel {
  // 세션 생성 또는 업데이트
  static async createOrUpdateSession(sessionData: SessionData): Promise<void> {
    const query = `
      INSERT INTO sessions (
        session_id, visitor_id, start_time, end_time, user_agent, ip_address,
        referrer, landing_page, device_type, browser_name, browser_version,
        os_name, os_version, screen_resolution, viewport_size, language,
        country, region, city, timezone
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      ON CONFLICT (session_id) DO UPDATE SET
        end_time = EXCLUDED.end_time
    `;

    const values = [
      sessionData.sessionId,
      sessionData.visitorId,
      sessionData.startTime,
      sessionData.endTime,
      sessionData.userAgent,
      sessionData.ipAddress,
      sessionData.referrer,
      sessionData.landingPage,
      sessionData.deviceType,
      sessionData.browserName,
      sessionData.browserVersion,
      sessionData.osName,
      sessionData.osVersion,
      sessionData.screenResolution,
      sessionData.viewportSize,
      sessionData.language,
      sessionData.country,
      sessionData.region,
      sessionData.city,
      sessionData.timezone
    ];

    await pool.query(query, values);
  }

  // 페이지뷰 생성
  static async createPageview(pageviewData: PageviewData): Promise<number> {
    const query = `
      INSERT INTO pageviews (
        session_id, page_url, page_title, load_time, dom_content_loaded,
        first_paint, first_contentful_paint, start_time, end_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING pageview_id
    `;

    const values = [
      pageviewData.sessionId,
      pageviewData.pageUrl,
      pageviewData.pageTitle,
      pageviewData.loadTime,
      pageviewData.domContentLoaded,
      pageviewData.firstPaint,
      pageviewData.firstContentfulPaint,
      pageviewData.startTime,
      pageviewData.endTime
    ];

    const result = await pool.query(query, values);
    return result.rows[0].pageview_id;
  }

  // 영역 상호작용 데이터 저장
  static async createAreaEngagements(engagements: AreaEngagementData[]): Promise<void> {
    if (engagements.length === 0) return;

    const query = `
      INSERT INTO area_engagements (
        pageview_id, area_id, area_name, area_type, time_spent, interaction_count,
        first_engagement, last_engagement, visible_time, viewport_percent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const engagement of engagements) {
        const values = [
          engagement.pageviewId,
          engagement.areaId,
          engagement.areaName,
          engagement.areaType,
          engagement.timeSpent,
          engagement.interactionCount,
          engagement.firstEngagement,
          engagement.lastEngagement,
          engagement.visibleTime,
          engagement.viewportPercent
        ];
        await client.query(query, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 스크롤 메트릭 저장
  static async createScrollMetrics(scrollData: ScrollMetricsData): Promise<number> {
    const query = `
      INSERT INTO scroll_metrics (
        pageview_id, deepest_scroll, scroll_25_time, scroll_50_time,
        scroll_75_time, scroll_100_time
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING scroll_id
    `;

    const values = [
      scrollData.pageviewId,
      scrollData.deepestScroll,
      scrollData.scroll25Time,
      scrollData.scroll50Time,
      scrollData.scroll75Time,
      scrollData.scroll100Time
    ];

    const result = await pool.query(query, values);
    return result.rows[0].scroll_id;
  }

  // 스크롤 패턴 저장
  static async createScrollPatterns(patterns: ScrollPatternData[]): Promise<void> {
    if (patterns.length === 0) return;

    const query = `
      INSERT INTO scroll_patterns (scroll_id, position, direction, speed, recorded_at)
      VALUES ($1, $2, $3, $4, $5)
    `;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const pattern of patterns) {
        const values = [
          pattern.scrollId,
          pattern.position,
          pattern.direction,
          pattern.speed,
          pattern.recordedAt
        ];
        await client.query(query, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 인터랙션 데이터 저장
  static async createInteractions(interactions: InteractionData[]): Promise<void> {
    if (interactions.length === 0) return;

    const query = `
      INSERT INTO interactions (
        pageview_id, area_id, interaction_type, target_element,
        x_coordinate, y_coordinate, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const interaction of interactions) {
        const values = [
          interaction.pageviewId,
          interaction.areaId,
          interaction.interactionType,
          interaction.targetElement,
          interaction.xCoordinate,
          interaction.yCoordinate,
          interaction.recordedAt
        ];
        await client.query(query, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 폼 분석 데이터 저장
  static async createFormAnalytics(formData: FormAnalyticsData): Promise<number> {
    const query = `
      INSERT INTO form_analytics (
        pageview_id, form_name, total_time_spent, completed, submitted_at
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING form_id
    `;

    const values = [
      formData.pageviewId,
      formData.formName,
      formData.totalTimeSpent,
      formData.completed,
      formData.submittedAt
    ];

    const result = await pool.query(query, values);
    return result.rows[0].form_id;
  }

  // 폼 필드 분석 데이터 저장
  static async createFormFieldAnalytics(fieldData: FormFieldAnalyticsData[]): Promise<void> {
    if (fieldData.length === 0) return;

    const query = `
      INSERT INTO form_field_analytics (
        form_id, field_name, time_spent, error_count, completed
      ) VALUES ($1, $2, $3, $4, $5)
    `;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const field of fieldData) {
        const values = [
          field.formId,
          field.fieldName,
          field.timeSpent,
          field.errorCount,
          field.completed
        ];
        await client.query(query, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // === 데이터 조회 메서드들 ===

  // 대시보드 전체 통계
  static async getDashboardStats(dateFrom?: string | undefined, dateTo?: string | undefined, page?: string | undefined): Promise<any> {
    const values: any[] = [];
    let paramIndex = 1;

    const dateFilter: string[] = [];
    if (dateFrom) {
      dateFilter.push(`pv.start_time >= $${paramIndex}`);
      values.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      dateFilter.push(`pv.start_time <= $${paramIndex}`);
      values.push(dateTo);
      paramIndex++;
    }

    const pageFilter = page ? [`pv.page_url LIKE '%' || $${paramIndex} || '%'`] : [];
    if (page) {
      values.push(page);
      paramIndex++;
    }

    const whereClause = [...dateFilter, ...pageFilter].length > 0
      ? 'WHERE ' + [...dateFilter, ...pageFilter].join(' AND ')
      : '';

    // 영역별 체류시간 통계
    const areaStatsQuery = `
      SELECT 
        ae.area_id,
        ae.area_name,
        AVG(ae.time_spent) as avg_time_spent,
        COUNT(DISTINCT pv.session_id) as visitor_count
      FROM area_engagements ae
      JOIN pageviews pv ON ae.pageview_id = pv.pageview_id
      ${whereClause}
      GROUP BY ae.area_id, ae.area_name
      ORDER BY avg_time_spent DESC
    `;

    const result = await pool.query(areaStatsQuery, values);
    return result.rows;
  }

  // 세션 목록 조회
  static async getSessions(limit: number = 50, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT 
        s.session_id,
        s.start_time,
        s.end_time,
        s.device_type,
        s.browser_name,
        s.landing_page,
        COUNT(p.pageview_id) as pageviews,
        COALESCE(AVG(p.load_time), 0) as avg_load_time,
        COALESCE(MAX(sm.deepest_scroll), 0) as max_scroll_depth,
        COUNT(i.interaction_id) as total_interactions
      FROM sessions s
      LEFT JOIN pageviews p ON s.session_id = p.session_id
      LEFT JOIN scroll_metrics sm ON p.pageview_id = sm.pageview_id
      LEFT JOIN interactions i ON p.pageview_id = i.pageview_id
      GROUP BY s.session_id, s.start_time, s.end_time, s.device_type, s.browser_name, s.landing_page
      ORDER BY s.start_time DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // 특정 세션 상세 정보
  static async getSessionDetail(sessionId: string | undefined): Promise<any | null> {
    if (!sessionId) return null;

    const sessionQuery = `
      SELECT * FROM sessions WHERE session_id = $1
    `;
    
    const pageviewsQuery = `
      SELECT p.*, sm.deepest_scroll, sm.scroll_25_time, sm.scroll_50_time, sm.scroll_75_time, sm.scroll_100_time
      FROM pageviews p
      LEFT JOIN scroll_metrics sm ON p.pageview_id = sm.pageview_id
      WHERE p.session_id = $1
      ORDER BY p.start_time
    `;

    const areaEngagementsQuery = `
      SELECT ae.*
      FROM area_engagements ae
      JOIN pageviews p ON ae.pageview_id = p.pageview_id
      WHERE p.session_id = $1
      ORDER BY ae.time_spent DESC
    `;

    const interactionsQuery = `
      SELECT i.*
      FROM interactions i
      JOIN pageviews p ON i.pageview_id = p.pageview_id
      WHERE p.session_id = $1
      ORDER BY i.recorded_at
      LIMIT 100
    `;

    try {
      const [sessionResult, pageviewsResult, areaResult, interactionsResult] = await Promise.all([
        pool.query(sessionQuery, [sessionId]),
        pool.query(pageviewsQuery, [sessionId]),
        pool.query(areaEngagementsQuery, [sessionId]),
        pool.query(interactionsQuery, [sessionId])
      ]);

      if (sessionResult.rows.length === 0) {
        return null;
      }

      return {
        session: sessionResult.rows[0],
        pageviews: pageviewsResult.rows,
        areaEngagements: areaResult.rows,
        interactions: interactionsResult.rows
      };
    } catch (error) {
      logger.error('Error fetching session details:', error);
      throw error;
    }
  }

  // 영역별 통계
  static async getAreaStats(dateFrom?: string, dateTo?: string): Promise<any[]> {
    const dateCondition = dateFrom && dateTo 
      ? `WHERE s.start_time >= $1 AND s.start_time <= $2`
      : '';
    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];

    const query = `
      SELECT 
        ae.area_id,
        ae.area_name,
        COUNT(*) as total_engagements,
        AVG(ae.time_spent) as avg_time_spent,
        SUM(ae.interaction_count) as total_interactions,
        AVG(ae.viewport_percent) as avg_viewport_percent,
        COUNT(DISTINCT s.session_id) as unique_sessions
      FROM area_engagements ae
      JOIN pageviews p ON ae.pageview_id = p.pageview_id
      JOIN sessions s ON p.session_id = s.session_id
      ${dateCondition}
      GROUP BY ae.area_id, ae.area_name
      ORDER BY avg_time_spent DESC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // 시간대별 활동 통계
  static async getHourlyStats(dateFrom?: string, dateTo?: string): Promise<any[]> {
    const dateCondition = dateFrom && dateTo 
      ? `WHERE start_time >= $1 AND start_time <= $2`
      : '';
    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];

    const query = `
      SELECT 
        EXTRACT(HOUR FROM start_time) as hour,
        COUNT(*) as session_count,
        COUNT(DISTINCT device_type) as device_variety
      FROM sessions
      ${dateCondition}
      GROUP BY EXTRACT(HOUR FROM start_time)
      ORDER BY hour
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // 디바이스별 통계
  static async getDeviceStats(dateFrom?: string, dateTo?: string): Promise<any[]> {
    const dateCondition = dateFrom && dateTo 
      ? `WHERE start_time >= $1 AND start_time <= $2`
      : '';
    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];

    const query = `
      SELECT 
        device_type,
        browser_name,
        COUNT(*) as session_count,
        COALESCE(AVG(EXTRACT(EPOCH FROM (end_time - start_time))), 0) as avg_duration
      FROM sessions
      ${dateCondition}
      GROUP BY device_type, browser_name
      ORDER BY session_count DESC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // 페이지 성능 통계
  static async getPerformanceStats(dateFrom?: string, dateTo?: string): Promise<any[]> {
    const dateCondition = dateFrom && dateTo 
      ? `WHERE s.start_time >= $1 AND s.start_time <= $2`
      : '';
    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];

    const query = `
      SELECT 
        p.page_url,
        COUNT(*) as view_count,
        COALESCE(AVG(p.load_time), 0) as avg_load_time,
        COALESCE(AVG(p.dom_content_loaded), 0) as avg_dom_loaded,
        COALESCE(AVG(p.first_paint), 0) as avg_first_paint,
        COALESCE(AVG(p.first_contentful_paint), 0) as avg_fcp
      FROM pageviews p
      JOIN sessions s ON p.session_id = s.session_id
      ${dateCondition}
      GROUP BY p.page_url
      ORDER BY view_count DESC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }
} 