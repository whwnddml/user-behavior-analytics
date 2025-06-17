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
} 