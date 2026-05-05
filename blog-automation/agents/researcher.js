const { loadSerpCache, buildSerpSummary } = require('../lib/schemas');

async function runResearcher({ keyword, plan }) {
  const serpData = loadSerpCache(keyword);
  const summary = buildSerpSummary(serpData);

  return {
    keyword,
    topH2s: summary ? summary.topH2s : [],
    avgCharCount: summary ? summary.avgCharCount : 2000,
    paaQuestions: summary ? summary.paaQuestions : [],
    competitorCount: summary ? summary.competitorCount : 0,
    angle: plan.angle,
    uniqueValue: plan.uniqueValue,
    competitorGaps: plan.competitorGaps || [],
    persona: plan.persona || null,
    readerProblem: plan.readerProblem || '',
    problemSolution: plan.problemSolution || '',
  };
}

module.exports = { runResearcher };
