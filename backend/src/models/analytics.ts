import { pool, testConnection } from '../config/database';
import { logger } from '../config/logger';

export interface Session {
    session_id: string;
    visitor_id: string;
    start_time: Date;
    end_time?: Date;
    user_agent?: string | null;
    ip_address?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface Pageview {
    sessionId: string;
    pageUrl: string;
    pageTitle: string;
    loadTime: number;
    domContentLoaded: number;
    firstPaint: number;
    firstContentfulPaint: number;
    startTime: Date;
    endTime?: Date | null;
}

export interface AreaEngagement {
    pageviewId: number;
    areaId: string;
    areaName: string;
    areaType: string;
    timeSpent: number;
    interactionCount: number;
    firstEngagement: Date;
    lastEngagement: Date;
    visibleTime: number;
    viewportPercent: number;
}

export interface ScrollMetrics {
    pageviewId: number;
    deepestScroll: number;
    scrollBreakpoints: {
        25: number;
        50: number;
        75: number;
        100: number;
    };
}

export interface Interaction {
    pageviewId: number;
    areaId: string;
    interactionType: string;
    targetElement: string;
    xCoordinate: number;
    yCoordinate: number;
    recordedAt: Date;
}

export interface FormAnalytics {
    pageviewId: number;
    formName: string;
    totalTimeSpent: number;
    completed: boolean;
    submittedAt?: Date | null;
}

export class AnalyticsModel {
    private async withConnection<T>(operation: (client: any) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
            // 연결 테스트
            await client.query('SELECT 1');
            return await operation(client);
        } catch (error) {
            logger.error('Database operation failed:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                operation: operation.name
            });
            
            // 연결 오류인 경우 재연결 시도
            if (error instanceof Error && 
                (error.message.includes('ECONNREFUSED') || 
                 error.message.includes('connection terminated'))) {
                await testConnection(3);
            }
            
            throw error;
        } finally {
            client.release();
        }
    }

    async createSession(visitorId: string, userAgent?: string | null): Promise<Session> {
        const query = `
            INSERT INTO sessions (visitor_id, user_agent)
            VALUES ($1, $2)
            RETURNING *
        `;
        
        try {
            const result = await this.withConnection(async (client) => {
                const result = await client.query(query, [visitorId, userAgent || null]);
                return result.rows[0];
            });
            return result;
        } catch (error) {
            logger.error('Error creating session:', error);
            throw error;
        }
    }

    async updateSession(sessionId: string, endTime: Date): Promise<void> {
        const query = `
            UPDATE sessions
            SET end_time = $1
            WHERE session_id = $2
        `;

        try {
            await this.withConnection(async (client) => {
                await client.query(query, [endTime, sessionId]);
            });
        } catch (error) {
            logger.error('Error updating session:', error);
            throw error;
        }
    }

    async createOrUpdateSession(
        sessionId: string,
        visitorId: string,
        startTime: Date,
        endTime: Date | null,
        userAgent: string | null
    ): Promise<void> {
        const query = `
            INSERT INTO sessions (session_id, visitor_id, start_time, end_time, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (session_id)
            DO UPDATE SET
                end_time = EXCLUDED.end_time,
                updated_at = CURRENT_TIMESTAMP
        `;

        try {
            await this.withConnection(async (client) => {
                await client.query(query, [sessionId, visitorId, startTime, endTime, userAgent]);
            });
        } catch (error) {
            logger.error('Error creating/updating session:', error);
            throw error;
        }
    }

    async createPageview(pageview: Pageview): Promise<number> {
        const query = `
            INSERT INTO pageviews (
                session_id, page_url, page_title, load_time,
                dom_content_loaded, first_paint, first_contentful_paint,
                start_time, end_time
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING pageview_id
        `;

        try {
            const result = await this.withConnection(async (client) => {
                const result = await client.query(query, [
                    pageview.sessionId,
                    pageview.pageUrl,
                    pageview.pageTitle,
                    pageview.loadTime,
                    pageview.domContentLoaded,
                    pageview.firstPaint,
                    pageview.firstContentfulPaint,
                    pageview.startTime,
                    pageview.endTime
                ]);
                return result.rows[0].pageview_id;
            });
            return result;
        } catch (error) {
            logger.error('Error creating pageview:', error);
            throw error;
        }
    }

    async createAreaEngagement(engagement: AreaEngagement): Promise<void> {
        const query = `
            INSERT INTO area_engagements (
                pageview_id, area_id, area_name, area_type,
                time_spent, interaction_count, first_engagement,
                last_engagement, visible_time, viewport_percent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        try {
            await this.withConnection(async (client) => {
                await client.query(query, [
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
                ]);
            });
        } catch (error) {
            logger.error('Error creating area engagement:', error);
            throw error;
        }
    }

    async createScrollMetrics(metrics: ScrollMetrics): Promise<void> {
        const query = `
            INSERT INTO scroll_metrics (
                pageview_id, deepest_scroll,
                scroll_25_time, scroll_50_time,
                scroll_75_time, scroll_100_time
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `;

        try {
            await this.withConnection(async (client) => {
                await client.query(query, [
                    metrics.pageviewId,
                    metrics.deepestScroll,
                    metrics.scrollBreakpoints[25] ? new Date(metrics.scrollBreakpoints[25]) : null,
                    metrics.scrollBreakpoints[50] ? new Date(metrics.scrollBreakpoints[50]) : null,
                    metrics.scrollBreakpoints[75] ? new Date(metrics.scrollBreakpoints[75]) : null,
                    metrics.scrollBreakpoints[100] ? new Date(metrics.scrollBreakpoints[100]) : null
                ]);
            });
        } catch (error) {
            logger.error('Error creating scroll metrics:', error);
            throw error;
        }
    }

    async createInteraction(interaction: Interaction): Promise<void> {
        const query = `
            INSERT INTO interactions (
                pageview_id, area_id, interaction_type,
                target_element, x_coordinate, y_coordinate,
                recorded_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        try {
            await this.withConnection(async (client) => {
                await client.query(query, [
                    interaction.pageviewId,
                    interaction.areaId,
                    interaction.interactionType,
                    interaction.targetElement,
                    interaction.xCoordinate,
                    interaction.yCoordinate,
                    interaction.recordedAt
                ]);
            });
        } catch (error) {
            logger.error('Error creating interaction:', error);
            throw error;
        }
    }

    async createFormAnalytics(form: FormAnalytics): Promise<void> {
        const query = `
            INSERT INTO form_analytics (
                pageview_id, form_name, total_time_spent,
                completed, submitted_at
            )
            VALUES ($1, $2, $3, $4, $5)
        `;

        try {
            await this.withConnection(async (client) => {
                await client.query(query, [
                    form.pageviewId,
                    form.formName,
                    form.totalTimeSpent,
                    form.completed,
                    form.submittedAt
                ]);
            });
        } catch (error) {
            logger.error('Error creating form analytics:', error);
            throw error;
        }
    }

    async getSessionStats(
        startDate?: string | Date | undefined,
        endDate?: string | Date | undefined,
        pageFilter?: string
    ): Promise<any> {
        const params: any[] = [];
        let paramIndex = 1;
        
        // 날짜 필터 조건 설정
        if (startDate) {
            params.push(new Date(startDate));
        }
        if (endDate) {
            params.push(new Date(endDate));
        }
        
        // 페이지 필터 조건 설정
        let pageFilterCondition = '';
        if (pageFilter) {
            // URL 경로 끝부분 매칭: 필터 경로로 끝나는 페이지 URL 찾기
            pageFilterCondition = `AND p.page_url LIKE '%' || $${params.length + 1}`;
            params.push(pageFilter);
            
            // 로깅 추가
            logger.info('Page filter condition:', {
                condition: pageFilterCondition,
                pageFilter,
                explanation: `Looking for page URLs ending with: ${pageFilter}`
            });
        }

        try {
            const [overview, areas, devices, browsers, hourly, recentSessions] = await Promise.all([
                // Overview statistics
                this.withConnection(async (client) => {
                    const result = await client.query(`
                        SELECT 
                            COUNT(DISTINCT s.session_id) as total_sessions,
                            COUNT(DISTINCT p.pageview_id) as total_pageviews,
                            COUNT(DISTINCT i.interaction_id) as total_interactions,
                            AVG(EXTRACT(EPOCH FROM (s.end_time - s.start_time))) as avg_session_time
                        FROM sessions s
                        LEFT JOIN pageviews p ON s.session_id = p.session_id
                        LEFT JOIN interactions i ON p.pageview_id = i.pageview_id
                        WHERE ($1::timestamp IS NULL OR s.start_time >= $1)
                        AND ($2::timestamp IS NULL OR s.start_time <= $2)
                        ${pageFilterCondition}
                    `, params);
                    return result.rows[0];
                }),

                // Area statistics
                this.withConnection(async (client) => {
                    const areaQuery = `
                        SELECT 
                            ae.area_name,
                            COUNT(DISTINCT s.visitor_id) as visitor_count,
                            AVG(ae.time_spent) as avg_time_spent,
                            SUM(ae.time_spent) as total_time_spent,
                            AVG(ae.viewport_percent) as avg_viewport_percent,
                            COUNT(DISTINCT ae.pageview_id) as view_count,
                            MIN(s.start_time) as first_view,
                            MAX(s.start_time) as last_view
                        FROM area_engagements ae
                        JOIN pageviews p ON ae.pageview_id = p.pageview_id
                        JOIN sessions s ON p.session_id = s.session_id
                        WHERE ($1::timestamp IS NULL OR s.start_time >= $1)
                        AND ($2::timestamp IS NULL OR s.start_time <= $2)
                        ${pageFilterCondition}
                        GROUP BY ae.area_name
                        ORDER BY total_time_spent DESC
                    `;

                    // 쿼리 실행 전 로깅
                    logger.info('Executing area statistics query:', {
                        query: areaQuery,
                        params,
                        pageFilterCondition
                    });

                    const result = await client.query(areaQuery, params);

                    // 결과 로깅
                    logger.info('Area statistics query result:', {
                        rowCount: result.rowCount,
                        firstRow: result.rows[0],
                        params
                    });

                    return result.rows;
                }),

                // Device statistics
                this.withConnection(async (client) => {
                    const result = await client.query(`
                        SELECT 
                            COALESCE(
                                CASE 
                                    WHEN s.user_agent LIKE '%Mobile%' THEN 'mobile'
                                    WHEN s.user_agent LIKE '%Tablet%' THEN 'tablet'
                                    ELSE 'desktop'
                                END,
                                'unknown'
                            ) as device_type,
                            COUNT(DISTINCT s.session_id) as session_count
                        FROM sessions s
                        LEFT JOIN pageviews p ON s.session_id = p.session_id
                        WHERE ($1::timestamp IS NULL OR s.start_time >= $1)
                        AND ($2::timestamp IS NULL OR s.start_time <= $2)
                        ${pageFilterCondition}
                        GROUP BY 
                            CASE 
                                WHEN s.user_agent LIKE '%Mobile%' THEN 'mobile'
                                WHEN s.user_agent LIKE '%Tablet%' THEN 'tablet'
                                ELSE 'desktop'
                            END
                        ORDER BY session_count DESC
                    `, params);
                    return result.rows;
                }),

                // Browser statistics
                this.withConnection(async (client) => {
                    const result = await client.query(`
                        WITH browser_info AS (
                            SELECT 
                                CASE 
                                    WHEN s.user_agent LIKE '%Chrome%' THEN 'Chrome'
                                    WHEN s.user_agent LIKE '%Firefox%' THEN 'Firefox'
                                    WHEN s.user_agent LIKE '%Safari%' THEN 'Safari'
                                    WHEN s.user_agent LIKE '%Edge%' THEN 'Edge'
                                    ELSE 'Other'
                                END as browser,
                                COALESCE(
                                    REGEXP_REPLACE(
                                        CASE 
                                            WHEN s.user_agent LIKE '%Chrome/%' THEN SUBSTRING(s.user_agent FROM 'Chrome/([0-9]+)')
                                            WHEN s.user_agent LIKE '%Firefox/%' THEN SUBSTRING(s.user_agent FROM 'Firefox/([0-9]+)')
                                            WHEN s.user_agent LIKE '%Safari/%' THEN SUBSTRING(s.user_agent FROM 'Safari/([0-9]+)')
                                            WHEN s.user_agent LIKE '%Edge/%' THEN SUBSTRING(s.user_agent FROM 'Edge/([0-9]+)')
                                        END,
                                        '[^0-9]', '', 'g'
                                    ),
                                    'unknown'
                                ) as version,
                                s.session_id
                            FROM sessions s
                            LEFT JOIN pageviews p ON s.session_id = p.session_id
                            WHERE ($1::timestamp IS NULL OR s.start_time >= $1)
                            AND ($2::timestamp IS NULL OR s.start_time <= $2)
                            ${pageFilterCondition}
                        )
                        SELECT 
                            browser,
                            version,
                            COUNT(DISTINCT session_id) as session_count
                        FROM browser_info
                        GROUP BY browser, version
                        ORDER BY session_count DESC
                    `, params);
                    return result.rows;
                }),

                // Hourly statistics
                this.withConnection(async (client) => {
                    const result = await client.query(`
                        SELECT 
                            EXTRACT(HOUR FROM s.start_time) as hour,
                            COUNT(DISTINCT s.session_id) as session_count,
                            COUNT(DISTINCT p.pageview_id) as pageview_count
                        FROM sessions s
                        LEFT JOIN pageviews p ON s.session_id = p.session_id
                        WHERE ($1::timestamp IS NULL OR s.start_time >= $1)
                        AND ($2::timestamp IS NULL OR s.start_time <= $2)
                        ${pageFilterCondition}
                        GROUP BY EXTRACT(HOUR FROM s.start_time)
                        ORDER BY hour
                    `, params);
                    return result.rows;
                }),

                // Recent sessions
                this.withConnection(async (client) => {
                    const result = await client.query(`
                        WITH session_info AS (
                            SELECT 
                                s.session_id,
                                s.start_time,
                                s.user_agent,
                                COUNT(DISTINCT p.pageview_id) as pageviews,
                                COUNT(DISTINCT i.interaction_id) as total_interactions
                            FROM sessions s
                            LEFT JOIN pageviews p ON s.session_id = p.session_id
                            LEFT JOIN interactions i ON p.pageview_id = i.pageview_id
                            WHERE ($1::timestamp IS NULL OR s.start_time >= $1)
                            AND ($2::timestamp IS NULL OR s.start_time <= $2)
                            ${pageFilterCondition}
                            GROUP BY s.session_id, s.start_time, s.user_agent
                        )
                        SELECT 
                            session_id,
                            start_time,
                            CASE 
                                WHEN user_agent LIKE '%Mobile%' THEN 'mobile'
                                WHEN user_agent LIKE '%Tablet%' THEN 'tablet'
                                ELSE 'desktop'
                            END as device_type,
                            CASE 
                                WHEN user_agent LIKE '%Chrome%' THEN 'Chrome'
                                WHEN user_agent LIKE '%Firefox%' THEN 'Firefox'
                                WHEN user_agent LIKE '%Safari%' THEN 'Safari'
                                WHEN user_agent LIKE '%Edge%' THEN 'Edge'
                                ELSE 'Other'
                            END as browser_name,
                            COALESCE(
                                REGEXP_REPLACE(
                                    CASE 
                                        WHEN user_agent LIKE '%Chrome/%' THEN SUBSTRING(user_agent FROM 'Chrome/([0-9]+)')
                                        WHEN user_agent LIKE '%Firefox/%' THEN SUBSTRING(user_agent FROM 'Firefox/([0-9]+)')
                                        WHEN user_agent LIKE '%Safari/%' THEN SUBSTRING(user_agent FROM 'Safari/([0-9]+)')
                                        WHEN user_agent LIKE '%Edge/%' THEN SUBSTRING(user_agent FROM 'Edge/([0-9]+)')
                                    END,
                                    '[^0-9]', '', 'g'
                                ),
                                'unknown'
                            ) as browser_version,
                            pageviews,
                            total_interactions
                        FROM session_info
                        ORDER BY start_time DESC
                        LIMIT 10
                    `, params);
                    return result.rows;
                })
            ]);

            return {
                overview: {
                    total_sessions: parseInt(overview.total_sessions) || 0,
                    total_pageviews: parseInt(overview.total_pageviews) || 0,
                    total_interactions: parseInt(overview.total_interactions) || 0,
                    avg_session_time: parseFloat(overview.avg_session_time) || 0
                },
                areas: areas.map(row => ({
                    area_name: row.area_name,
                    visitor_count: parseInt(row.visitor_count),
                    avg_time_spent: parseFloat(row.avg_time_spent),
                    total_time_spent: parseFloat(row.total_time_spent),
                    avg_viewport_percent: parseFloat(row.avg_viewport_percent),
                    view_count: parseInt(row.view_count)
                })),
                devices: devices.map(row => ({
                    device_type: row.device_type,
                    session_count: parseInt(row.session_count)
                })),
                browsers: browsers.map(row => ({
                    browser: row.browser,
                    version: row.version,
                    session_count: parseInt(row.session_count)
                })),
                hourly: hourly.map(row => ({
                    hour: parseInt(row.hour),
                    session_count: parseInt(row.session_count),
                    pageview_count: parseInt(row.pageview_count)
                })),
                recent_sessions: recentSessions.map(row => ({
                    session_id: row.session_id,
                    start_time: row.start_time,
                    device_type: row.device_type,
                    browser_name: row.browser_name,
                    browser_version: row.browser_version,
                    pageviews: parseInt(row.pageviews),
                    total_interactions: parseInt(row.total_interactions)
                }))
            };
        } catch (error) {
            logger.error('Error getting session stats:', error);
            throw error;
        }
    }

    // 방문자별 세션 조회
    async getVisitorSessions(visitorId: string): Promise<Session[]> {
        const query = `
            SELECT 
                s.*,
                COUNT(DISTINCT p.pageview_id) as pageview_count,
                COUNT(DISTINCT i.interaction_id) as interaction_count
            FROM sessions s
            LEFT JOIN pageviews p ON s.session_id = p.session_id
            LEFT JOIN interactions i ON p.pageview_id = i.pageview_id
            WHERE s.visitor_id = $1
            GROUP BY s.session_id
            ORDER BY s.start_time DESC
        `;

        try {
            const result = await this.withConnection(async (client) => {
                const result = await client.query(query, [visitorId]);
                return result.rows;
            });
            return result;
        } catch (error) {
            logger.error('Error getting visitor sessions:', error);
            throw error;
        }
    }
}