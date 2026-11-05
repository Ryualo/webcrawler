import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSalientKeywords,
  generateDownwardTrajectory,
  computeSpiderLegJoints,
  evaluateDownwardCrawlProgress,
  analyzeContextualLines
} from './spiderCrawlEngine';

test('extractSalientKeywords extracts meaningful non-stopword keywords', () => {
  const sample = `The cybernetic arachnid crawls down the webpage, grasping key metrics and neural concepts. The arachnid analyzes machine learning patterns and neural weights.`;
  const keywords = extractSalientKeywords(sample, 5);
  assert.ok(keywords.length > 0);
  assert.ok(keywords.some((k) => k.word === 'arachnid' || k.word === 'neural' || k.word === 'crawls'));
  assert.ok(!keywords.some((k) => k.word === 'the' || k.word === 'and'));
});

test('analyzeContextualLines detects high-context lines and extracts triplets', () => {
  const paragraphs = [
    `SPIDAR v2.5 introduces a biomimetic web-crawler architecture that centralizes scroll around active lines. Benchmark telemetry across 14,000 workloads achieves 94% parity with cloud models.`
  ];
  const lines = analyzeContextualLines(paragraphs);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].hasHighContext);
  assert.ok(lines[0].triplet !== undefined);
  assert.equal(lines[1].contextType, 'metric_evidence');
});

test('generateDownwardTrajectory creates strictly downward progressing waypoints', () => {
  const sampleKeywords = [
    { word: 'cybernetic', score: 5 },
    { word: 'neural', score: 4 },
    { word: 'crawling', score: 3 }
  ];

  const waypoints = generateDownwardTrajectory({
    startY: 50,
    endY: 850,
    centerX: 300,
    width: 600,
    keywords: sampleKeywords,
    stepsPerKeyword: 4
  });

  assert.ok(waypoints.length > 10);
  assert.equal(waypoints[0].y, 50);
  assert.equal(waypoints[waypoints.length - 1].y, 850);

  let maxReachedY = waypoints[0].y;
  waypoints.forEach((wp) => {
    assert.ok(wp.y >= maxReachedY - 2, `Waypoint went backwards: wp.y=${wp.y}, maxReachedY=${maxReachedY}`);
    if (wp.y > maxReachedY) {
      maxReachedY = wp.y;
    }
  });

  const touchPoints = waypoints.filter((wp) => wp.milestoneType === 'touch_keyword');
  assert.ok(touchPoints.length >= sampleKeywords.length);
  assert.ok(touchPoints[0].targetLegs !== undefined);
});

test('computeSpiderLegJoints returns 8 joints and extends front legs onto word during touch', () => {
  const normalJoints = computeSpiderLegJoints({
    phase: 0.5,
    isCrawling: true,
    isTouchingKeyword: false
  });
  assert.equal(normalJoints.length, 8);

  const touchJoints = computeSpiderLegJoints({
    phase: 0.5,
    isCrawling: true,
    isTouchingKeyword: true,
    touchProgress: 0.5,
    legReachVectors: {
      leftFrontDx: -28,
      leftFrontDy: 24,
      rightFrontDx: 28,
      rightFrontDy: 24
    }
  });
  assert.equal(touchJoints.length, 8);
  assert.equal(touchJoints[0].isTouchingWord, true);

  const normalL1FootY = parseFloat(normalJoints[0].fy);
  const touchL1FootY = parseFloat(touchJoints[0].fy);
  assert.ok(touchL1FootY > normalL1FootY);
});

test('evaluateDownwardCrawlProgress properly interpolates between waypoints', () => {
  const waypoints = [
    { x: 100, y: 100, progress: 0, milestoneType: 'crawl' as const },
    { x: 100, y: 500, progress: 1, milestoneType: 'crawl' as const }
  ];

  const midState = evaluateDownwardCrawlProgress(waypoints, 500, 1000);
  assert.ok(Math.abs(midState.y - 300) < 5);
  assert.equal(midState.isComplete, false);

  const endState = evaluateDownwardCrawlProgress(waypoints, 1000, 1000);
  assert.equal(endState.isComplete, false === false);
  assert.equal(endState.y, 500);
});

test('computeSpiderLegJoints animates tetrapod walking stride when crawling even with multiLegTargets present', () => {
  const multiLegTargets = Array.from({ length: 8 }, (_, idx) => ({
    dx: idx < 4 ? -70 : 70,
    dy: (idx % 4) * 20 - 30,
    phrase: `phrase-${idx}`,
    style: 'cyan_box' as const
  }));

  const stepA = computeSpiderLegJoints({
    phase: 0.2,
    isCrawling: true,
    isTouchingKeyword: false,
    legReachVectors: {
      leftFrontDx: -40,
      leftFrontDy: 20,
      rightFrontDx: 40,
      rightFrontDy: 20,
      multiLegTargets
    }
  });

  const stepB = computeSpiderLegJoints({
    phase: 1.6,
    isCrawling: true,
    isTouchingKeyword: false,
    legReachVectors: {
      leftFrontDx: -40,
      leftFrontDy: 20,
      rightFrontDx: 40,
      rightFrontDy: 20,
      multiLegTargets
    }
  });

  // Ensure all 8 legs move dynamically between phase 0.2 and phase 1.6 rather than freezing on static targets
  let movedLegs = 0;
  for (let i = 0; i < 8; i++) {
    const dy = Math.abs(parseFloat(stepA[i].fy) - parseFloat(stepB[i].fy));
    const dx = Math.abs(parseFloat(stepA[i].fx) - parseFloat(stepB[i].fx));
    if (dy > 2 || dx > 2) movedLegs++;
  }
  assert.equal(movedLegs, 8);
});

