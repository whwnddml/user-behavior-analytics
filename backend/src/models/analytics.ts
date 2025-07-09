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
  static async createOrUpdateSession(sessionData: Partial<SessionData>): Promise<void> {
    const { sessionId, ...updateData } = sessionData;

    // 기존 세션 확인
    const checkQuery = `SELECT session_id FROM sessions WHERE session_id = $1`;
    const existingSession = await pool.query(checkQuery, [sessionId]);
    
    if (existingSession.rows.length === 0) {
      // 새 세션 생성
      const insertQuery = `
        INSERT INTO sessions (
          session_id, visitor_id, start_time, end_time, user_agent, ip_address,
          referrer, landing_page, device_type, browser_name, browser_version,
          os_name, os_version, screen_resolution, viewport_size, language,
          country, region, city, timezone
        ) VALUES (
          $1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
      `;

      const insertValues = [
        sessionId,
        updateData.visitorId,
        updateData.endTime,
        updateData.userAgent,
        updateData.ipAddress,
        updateData.referrer,
        updateData.landingPage,
        updateData.deviceType,
        updateData.browserName,
        updateData.browserVersion,
        updateData.osName,
        updateData.osVersion,
        updateData.screenResolution,
        updateData.viewportSize,
        updateData.language,
        updateData.country,
        updateData.region,
        updateData.city,
        updateData.timezone
      ];

      await pool.query(insertQuery, insertValues);
    } else {
      // 기존 세션 업데이트
      const updateQuery = `
        UPDATE sessions 
        SET
          end_time = COALESCE($1, end_time),
          user_agent = COALESCE($2, user_agent),
          ip_address = COALESCE($3, ip_address),
          referrer = COALESCE($4, referrer),
          landing_page = COALESCE($5, landing_page),
          device_type = COALESCE($6, device_type),
          browser_name = COALESCE($7, browser_name),
          browser_version = COALESCE($8, browser_version),
          os_name = COALESCE($9, os_name),
          os_version = COALESCE($10, os_version),
          screen_resolution = COALESCE($11, screen_resolution),
          viewport_size = COALESCE($12, viewport_size),
          language = COALESCE($13, language),
          country = COALESCE($14, country),
          region = COALESCE($15, region),
          city = COALESCE($16, city),
          timezone = COALESCE($17, timezone)
        WHERE session_id = $18
      `;

      const updateValues = [
        updateData.endTime,
        updateData.userAgent,
        updateData.ipAddress,
        updateData.referrer,
        updateData.landingPage,
        updateData.deviceType,
        updateData.browserName,
        updateData.browserVersion,
        updateData.osName,
        updateData.osVersion,
        updateData.screenResolution,
        updateData.viewportSize,
        updateData.language,
        updateData.country,
        updateData.region,
        updateData.city,
        updateData.timezone,
        sessionId
      ];

      await pool.query(updateQuery, updateValues);
    }
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
        logger.info('Inserting interaction:', {
          interaction,
          recordedAt: interaction.recordedAt
        });

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
      logger.error('Error inserting interaction:', error);
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
      dateFilter.push(`s.start_time >= ($${paramIndex}::date + interval '0 hour')`);
      values.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      dateFilter.push(`s.start_time <= ($${paramIndex}::date + interval '23 hours 59 minutes 59 seconds')`);
      values.push(dateTo);
      paramIndex++;
    }

    const pageFilter: string[] = [];
    if (page && typeof page === 'string') {
      const normalizedPage = page.startsWith('/') ? page : `/${page}`;
      pageFilter.push(`pv.page_url = $${paramIndex}`);
      values.push(normalizedPage);
      paramIndex++;
    }

    // 쿼리 실행 전 로깅
    logger.info('Building dashboard stats query', {
      filters: {
        dateFrom: dateFrom || 'not specified',
        dateTo: dateTo || 'not specified',
        page: page || 'all pages'
      },
      conditions: {
        dateFilter: dateFilter.length > 0 ? dateFilter.join(' AND ') : 'none',
        pageFilter: pageFilter.length > 0 ? pageFilter.join(' AND ') : 'none'
      }
    });

    const statsQuery = `
      WITH filtered_pageviews AS (
        SELECT pv.*
        FROM pageviews pv
        WHERE 1=1
        ${pageFilter.length > 0 ? 'AND ' + pageFilter.join(' AND ') : ''}
      ),
      filtered_sessions AS (
        SELECT DISTINCT s.*
        FROM sessions s
        ${page ? 'INNER' : 'LEFT'} JOIN filtered_pageviews pv ON s.session_id = pv.session_id
        WHERE 1=1
        ${dateFilter.length > 0 ? 'AND ' + dateFilter.join(' AND ') : ''}
      ),
      session_stats AS (
        SELECT 
          COUNT(DISTINCT fs.session_id) as total_sessions,
          COUNT(DISTINCT pv.pageview_id) as total_pageviews,
          COUNT(DISTINCT i.interaction_id) as total_interactions,
          ROUND(
            EXTRACT(EPOCH FROM AVG(
              CASE 
                WHEN fs.end_time IS NULL THEN NOW() - fs.start_time
                ELSE fs.end_time - fs.start_time 
              END
            )) / 60
          , 1) as avg_session_time
        FROM filtered_sessions fs
        LEFT JOIN filtered_pageviews pv ON fs.session_id = pv.session_id
        LEFT JOIN interactions i ON pv.pageview_id = i.pageview_id
      ),
      area_stats AS (
        SELECT 
          COALESCE(ae.area_id, 'unknown') as area_id,
          COALESCE(ae.area_name, '알 수 없음') as area_name,
          COALESCE(AVG(ae.time_spent), 0) as avg_time_spent,
          COUNT(DISTINCT pv.session_id) as visitor_count,
          COALESCE(SUM(ae.interaction_count), 0) as total_interactions
        FROM filtered_sessions fs
        JOIN filtered_pageviews pv ON fs.session_id = pv.session_id
        LEFT JOIN area_engagements ae ON pv.pageview_id = ae.pageview_id
        GROUP BY ae.area_id, ae.area_name
      ),
      device_stats AS (
        SELECT 
          COALESCE(s.device_type, 'unknown') as device_type,
          COUNT(DISTINCT s.session_id) as session_count,
          COUNT(DISTINCT pv.pageview_id) as pageview_count
        FROM filtered_sessions s
        LEFT JOIN filtered_pageviews pv ON s.session_id = pv.session_id
        GROUP BY s.device_type
      ),
      browser_stats AS (
        SELECT 
          COALESCE(s.browser_name, 'unknown') as browser,
          COALESCE(s.browser_version, '') as version,
          COUNT(DISTINCT s.session_id) as session_count,
          COUNT(DISTINCT pv.pageview_id) as pageview_count
        FROM filtered_sessions s
        LEFT JOIN filtered_pageviews pv ON s.session_id = pv.session_id
        GROUP BY s.browser_name, s.browser_version
      ),
      os_stats AS (
        SELECT 
          COALESCE(s.os_name, 'unknown') as os,
          COALESCE(s.os_version, '') as version,
          COUNT(DISTINCT s.session_id) as session_count,
          COUNT(DISTINCT pv.pageview_id) as pageview_count
        FROM filtered_sessions s
        LEFT JOIN filtered_pageviews pv ON s.session_id = pv.session_id
        GROUP BY s.os_name, s.os_version
      ),
      location_stats AS (
        SELECT 
          COALESCE(s.country, 'unknown') as country,
          COALESCE(s.region, 'unknown') as region,
          COALESCE(s.city, 'unknown') as city,
          COUNT(DISTINCT s.session_id) as session_count,
          COUNT(DISTINCT pv.pageview_id) as pageview_count
        FROM filtered_sessions s
        LEFT JOIN filtered_pageviews pv ON s.session_id = pv.session_id
        GROUP BY s.country, s.region, s.city
      ),
      hourly_stats AS (
        SELECT 
          EXTRACT(HOUR FROM s.start_time) as hour,
          COUNT(DISTINCT s.session_id) as session_count,
          COUNT(DISTINCT pv.pageview_id) as pageview_count
        FROM filtered_sessions s
        LEFT JOIN filtered_pageviews pv ON s.session_id = pv.session_id
        GROUP BY EXTRACT(HOUR FROM s.start_time)
        ORDER BY hour
      )
      SELECT json_build_object(
        'overview', (
          SELECT json_build_object(
            'total_sessions', total_sessions,
            'total_pageviews', total_pageviews,
            'total_interactions', total_interactions,
            'avg_session_time', avg_session_time
          ) FROM session_stats
        ),
        'areas', (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'area_id', area_id,
                'area_name', area_name,
                'avg_time_spent', avg_time_spent,
                'visitor_count', visitor_count,
                'total_interactions', total_interactions
              )
            ),
            '[]'::json
          ) FROM area_stats
        ),
        'devices', (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'device_type', device_type,
                'session_count', session_count,
                'pageview_count', pageview_count
              )
            ),
            '[]'::json
          ) FROM device_stats
        ),
        'browsers', (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'browser', browser,
                'version', version,
                'session_count', session_count,
                'pageview_count', pageview_count
              )
            ),
            '[]'::json
          ) FROM browser_stats
        ),
        'os', (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'os', os,
                'version', version,
                'session_count', session_count,
                'pageview_count', pageview_count
              )
            ),
            '[]'::json
          ) FROM os_stats
        ),
        'locations', (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'country', country,
                'region', region,
                'city', city,
                'session_count', session_count,
                'pageview_count', pageview_count
              )
            ),
            '[]'::json
          ) FROM location_stats
        ),
        'hourly', (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'hour', hour,
                'session_count', session_count,
                'pageview_count', pageview_count
              ) ORDER BY hour
            ),
            '[]'::json
          ) FROM hourly_stats
        )
      ) as stats
    `;

    try {
      const result = await pool.query(statsQuery, values);
      const stats = result.rows[0]?.stats;

      if (!stats) {
        logger.warn('No stats data found in query result', {
          filters: { dateFrom, dateTo, page }
        });
        return null;
      }

      // 결과 로깅
      logger.info('Query executed successfully', {
        overview: stats.overview,
        counts: {
          areas: stats.areas?.length || 0,
          devices: stats.devices?.length || 0,
          browsers: stats.browsers?.length || 0,
          os: stats.os?.length || 0,
          locations: stats.locations?.length || 0,
          hourly: stats.hourly?.length || 0
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to execute dashboard stats query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters: { dateFrom, dateTo, page }
      });
      throw error;
    }
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
        COUNT(i.interaction_id) as total_interactions
      FROM sessions s
      LEFT JOIN pageviews p ON s.session_id = p.session_id
      LEFT JOIN interactions i ON p.pageview_id = i.pageview_id
      GROUP BY s.session_id, s.start_time, s.end_time, s.device_type, s.browser_name, s.landing_page
      ORDER BY s.start_time DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // 세션 상세 정보 조회
  static async getSessionDetails(sessionId: string): Promise<any> {
    const sessionQuery = `
      SELECT * FROM sessions WHERE session_id = $1
    `;

    const pageviewsQuery = `
      SELECT * FROM pageviews WHERE session_id = $1 ORDER BY created_at
    `;

    const areaEngagementsQuery = `
      SELECT ae.* 
      FROM area_engagements ae
      JOIN pageviews p ON ae.pageview_id = p.pageview_id
      WHERE p.session_id = $1
      ORDER BY ae.created_at
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