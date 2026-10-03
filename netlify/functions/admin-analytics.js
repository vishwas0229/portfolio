const { json, options } = require("./_shared/http");
const { requireAdmin } = require("./_shared/auth");
const { list } = require("./_shared/db");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "GET") return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET, OPTIONS" });

  try {
    requireAdmin(event);

    const daysRaw = Number(event.queryStringParameters?.days || 30);
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 30, 1), 90);
    const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

    const rows = await list(
      "analytics_events",
      `?select=event_date,event_name,section,project_slug&event_date=gte.${since}&order=event_date.asc`
    );

    const byDay = {};
    const byEvent = {};
    const bySection = {};
    const byProject = {};

    for (const row of Array.isArray(rows) ? rows : []) {
      byDay[row.event_date] = (byDay[row.event_date] || 0) + 1;
      byEvent[row.event_name] = (byEvent[row.event_name] || 0) + 1;
      if (row.section) bySection[row.section] = (bySection[row.section] || 0) + 1;
      if (row.project_slug) byProject[row.project_slug] = (byProject[row.project_slug] || 0) + 1;
    }

    return json(200, {
      ok: true,
      range: { days, since, until: new Date().toISOString().slice(0, 10) },
      totals: {
        events: Array.isArray(rows) ? rows.length : 0,
        visits: byEvent.visit || 0,
        contactStarts: byEvent.contact_start || 0,
        contactSubmits: byEvent.contact_submit || 0,
        gameStarts: byEvent.game_start || 0,
        gameCompletes: byEvent.game_complete || 0
      },
      byDay,
      byEvent,
      bySection,
      byProject
    }, event, { "cache-control": "no-store" });
  } catch (error) {
    const status = error?.statusCode || (error?.code === "DB_NOT_CONFIGURED" ? 503 : 500);
    return json(status, {
      ok: false,
      error: status === 401 ? "Authentication required." : "Analytics request failed."
    }, event);
  }
};
