const { config } = require("./_shared/config");
const { json, options } = require("./_shared/http");
const { getClientIp, checkRateLimit, rateLimitHeaders } = require("./_shared/rate-limit");
const { getOrLoad } = require("./_shared/cache");

function parseCalendar(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (_) { return {}; } }
  return raw && typeof raw === 'object' ? raw : {};
}

function mergeCalendars(...raws) {
  const out = {};
  for (const raw of raws) {
    const obj = parseCalendar(raw);
    for (const [ts, count] of Object.entries(obj)) out[ts] = Number(out[ts] || 0) + (Number(count) || 0);
  }
  return JSON.stringify(out);
}

async function fetchGraphQL(username) {
  const query = `query getUserProfile($username: String!, $year: Int!, $previousYear: Int!) {
    allQuestionsCount { difficulty count }
    matchedUser(username: $username) {
      username
      profile { ranking reputation }
      submitStats: submitStatsGlobal {
        acSubmissionNum { difficulty count submissions }
        totalSubmissionNum { difficulty count submissions }
      }
      currentCalendar: userCalendar(year: $year) {
        activeYears
        streak
        totalActiveDays
        submissionCalendar
      }
      previousCalendar: userCalendar(year: $previousYear) {
        submissionCalendar
      }
    }
    userContestRanking(username: $username) {
      rating
      globalRanking
      topPercentage
    }
  }`;
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'referer': 'https://leetcode.com/'
    },
    body: JSON.stringify({ query, variables: { username, year: new Date().getUTCFullYear(), previousYear: new Date().getUTCFullYear() - 1 } })
  });
  if (!res.ok) throw new Error(`LeetCode GraphQL ${res.status}`);
  const payload = await res.json();
  if (payload.errors || !payload.data?.matchedUser) throw new Error(payload.errors?.[0]?.message || 'LeetCode user not found');
  const u = payload.data.matchedUser;
  const ac = u.submitStats?.acSubmissionNum || [];
  const total = u.submitStats?.totalSubmissionNum || [];
  const byDiff = Object.fromEntries(ac.map(x => [x.difficulty.toLowerCase(), x.count]));
  const totalByDiff = Object.fromEntries(total.map(x => [x.difficulty.toLowerCase(), x.submissions]));
  const totalSubmissions = totalByDiff.all || 0;
  const acceptedSubmissions = (ac.find(x => x.difficulty === 'All') || {}).submissions || 0;
  return {
    username: u.username || username,
    totalSolved: byDiff.all || 0,
    easySolved: byDiff.easy || 0,
    mediumSolved: byDiff.medium || 0,
    hardSolved: byDiff.hard || 0,
    ranking: u.profile?.ranking || null,
    acceptance: totalSubmissions ? (acceptedSubmissions / totalSubmissions) * 100 : null,
    streak: u.currentCalendar?.streak || 0,
    totalActiveDays: u.currentCalendar?.totalActiveDays || 0,
    submissionCalendar: mergeCalendars(u.currentCalendar?.submissionCalendar, u.previousCalendar?.submissionCalendar),
    calendarYear: new Date().getUTCFullYear(),
    totalQuestions: Number((payload.data.allQuestionsCount || []).reduce((n, x) => n + (Number(x.count) || 0), 0)) || null,
    totalEasy: Number((payload.data.allQuestionsCount || []).find(x => x.difficulty === 'Easy')?.count) || null,
    totalMedium: Number((payload.data.allQuestionsCount || []).find(x => x.difficulty === 'Medium')?.count) || null,
    totalHard: Number((payload.data.allQuestionsCount || []).find(x => x.difficulty === 'Hard')?.count) || null,
    skills: null,
    languages: null,
    contestRating: payload.data.userContestRanking?.rating || null
  };
}

async function fetchThirdParty(username) {
  const bases = [
    'https://alfa-leetcode-api.onrender.com',
    'https://leetcode-api-pied.vercel.app'
  ];
  for (const base of bases) {
    try {
      const [profile, solved, calendarCurrent, calendarPrevious, contest, skill, language] = await Promise.all([
        fetchJson(`${base}/${encodeURIComponent(username)}/profile`, 10000).catch(() => null),
        fetchJson(`${base}/${encodeURIComponent(username)}/solved`, 10000).catch(() => null),
        fetchJson(`${base}/${encodeURIComponent(username)}/calendar?year=${new Date().getUTCFullYear()}`, 10000).catch(() => null),
        fetchJson(`${base}/${encodeURIComponent(username)}/calendar?year=${new Date().getUTCFullYear()-1}`, 10000).catch(() => null),
        fetchJson(`${base}/${encodeURIComponent(username)}/contest`, 10000).catch(() => null),
        fetchJson(`${base}/${encodeURIComponent(username)}/skill`, 10000).catch(() => null),
        fetchJson(`${base}/${encodeURIComponent(username)}/language`, 10000).catch(() => null)
      ]);
      const calendar = calendarCurrent || calendarPrevious;
      const src = profile || solved || calendar;
      if (!src) continue;
      const solvedObj = solved || src;
      const p = profile || src;
      const cal = calendar || {};
      const contestObj = contest || {};
      const pick = (obj, keys) => { for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k]; return null; };
      const totalSolved = pick(solvedObj, ['totalSolved', 'total_solved', 'solvedProblem']);
      const easySolved = pick(solvedObj, ['easySolved', 'easy_solved']);
      const mediumSolved = pick(solvedObj, ['mediumSolved', 'medium_solved']);
      const hardSolved = pick(solvedObj, ['hardSolved', 'hard_solved']);
      const submissionCalendar = pick(cal, ['submissionCalendar', 'submission_calendar', 'calendar']);
      if (totalSolved == null && !submissionCalendar) continue;
      return {
        username: pick(p, ['username']) || username,
        totalSolved: totalSolved ?? 0,
        easySolved: easySolved ?? 0,
        mediumSolved: mediumSolved ?? 0,
        hardSolved: hardSolved ?? 0,
        ranking: pick(p, ['ranking', 'rank']),
        acceptance: pick(p, ['acceptanceRate', 'acceptance', 'acceptance_rate']),
        streak: pick(cal, ['streak', 'currentStreak']) ?? 0,
        totalActiveDays: pick(cal, ['totalActiveDays', 'total_active_days']) ?? 0,
        submissionCalendar: mergeCalendars(
          pick(calendarCurrent, ['submissionCalendar', 'submission_calendar', 'calendar']),
          pick(calendarPrevious, ['submissionCalendar', 'submission_calendar', 'calendar'])
        ),
        calendarYear: new Date().getUTCFullYear(),
        totalQuestions: pick(solvedObj, ['totalQuestions', 'total_questions', 'totalProblem']),
        totalEasy: pick(solvedObj, ['totalEasy', 'total_easy']),
        totalMedium: pick(solvedObj, ['totalMedium', 'total_medium']),
        totalHard: pick(solvedObj, ['totalHard', 'total_hard']),
        contestRating: pick(contestObj, ['rating', 'contestRating']),
        skills: skill,
        languages: language
      };
    } catch (_) {}
  }
  return null;
}


async function loadLeetCodeData(username) {
  const thirdParty = await fetchThirdParty(username);
  let data = thirdParty;
  let source = thirdParty ? "public-leetcode-rest-api" : "leetcode-graphql";

  if (!data || data.acceptance == null) {
    try {
      const graph = await fetchGraphQL(username);
      data = data
        ? { ...data, acceptance: graph.acceptance, ranking: data.ranking ?? graph.ranking, contestRating: data.contestRating ?? graph.contestRating }
        : graph;
      source = data && thirdParty ? "public-api+leetcode-graphql" : "leetcode-graphql";
    } catch (_) {
      // Keep working public API data if GraphQL is unavailable.
    }
  }

  if (!data) throw new Error("No live LeetCode data");
  return { source, data };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET, OPTIONS" });
  }

  const username = (event.queryStringParameters?.username || config.leetcodeUsername).trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(username)) {
    return json(400, { ok: false, error: "Invalid username" }, event);
  }

  const limited = checkRateLimit(`leetcode:${getClientIp(event)}`);
  if (!limited.allowed) {
    return json(429, { ok: false, error: "Too many requests. Please retry later." }, event, rateLimitHeaders(limited));
  }

  try {
    const cached = await getOrLoad(
      `leetcode:${username}`,
      () => loadLeetCodeData(username),
      config.leetcodeCacheTtlMs,
      config.cacheStaleMs
    );

    return json(200, {
      ok: true,
      source: cached.value.source,
      data: cached.value.data
    }, event, {
      ...rateLimitHeaders(limited),
      "x-api-cache": cached.fallback ? "stale" : cached.cache.state
    });
  } catch (_) {
    return json(502, { ok: false, error: "Live LeetCode data could not be fetched right now." }, event, rateLimitHeaders(limited));
  }
};
