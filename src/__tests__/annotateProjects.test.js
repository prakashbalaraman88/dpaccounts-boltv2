'use strict';

const { describe, it, expect } = require('@jest/globals');
const { annotateProjects } = require('../utils/annotateProjects');
const { PLAN_LIMITS } = require('../constants/planLimits');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal fake project array sorted most-recent-first.
 * Each project gets a stable id equal to its 1-based position.
 */
function makeProjects(count) {
  return Array.from({ length: count }, function (_, i) {
    return {
      id: i + 1,
      project_name: 'Project ' + (i + 1),
      created_at: new Date(Date.now() - i * 1000).toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Client-side fallback (lockMap omitted / empty)
// ---------------------------------------------------------------------------

describe('annotateProjects — client-side fallback (no lockMap)', function () {
  it('Pro→Starter: 5 projects under a limit-10 plan — none should lock', function () {
    var projects = makeProjects(5);
    var result = annotateProjects(projects, PLAN_LIMITS.starter);

    expect(result).toHaveLength(5);
    result.forEach(function (p) { expect(p.locked).toBe(false); });
  });

  it('Starter→Free: 15 projects under a limit-1 plan — 14 lock, most-recent stays open', function () {
    var projects = makeProjects(15);
    var result = annotateProjects(projects, PLAN_LIMITS.free);

    expect(result).toHaveLength(15);
    expect(result[0].locked).toBe(false);
    result.slice(1).forEach(function (p) { expect(p.locked).toBe(true); });
    expect(result.filter(function (p) { return p.locked; }).length).toBe(14);
  });

  it('Free→Starter purchase: 1 project on a limit-10 plan — no projects locked', function () {
    var projects = makeProjects(1);
    var result = annotateProjects(projects, PLAN_LIMITS.starter);

    expect(result).toHaveLength(1);
    expect(result[0].locked).toBe(false);
  });

  it('Infinity limit (Unlimited plan) — all projects unlocked regardless of count', function () {
    var projects = makeProjects(200);
    var result = annotateProjects(projects, PLAN_LIMITS.unlimited);

    expect(result).toHaveLength(200);
    result.forEach(function (p) { expect(p.locked).toBe(false); });
  });

  it('Starter plan with exactly 10 projects — all 10 unlocked (boundary)', function () {
    var projects = makeProjects(10);
    var result = annotateProjects(projects, PLAN_LIMITS.starter);

    result.forEach(function (p) { expect(p.locked).toBe(false); });
  });

  it('Starter plan with 11 projects — only the 11th (oldest) locks', function () {
    var projects = makeProjects(11);
    var result = annotateProjects(projects, PLAN_LIMITS.starter);

    result.slice(0, 10).forEach(function (p) { expect(p.locked).toBe(false); });
    expect(result[10].locked).toBe(true);
  });

  it('Pro plan with 50 projects — none locked (boundary)', function () {
    var projects = makeProjects(50);
    var result = annotateProjects(projects, PLAN_LIMITS.pro);

    result.forEach(function (p) { expect(p.locked).toBe(false); });
  });

  it('Pro→Starter downgrade: 15 projects on a limit-10 plan — 5 oldest lock', function () {
    var projects = makeProjects(15);
    var result = annotateProjects(projects, PLAN_LIMITS.starter);

    result.slice(0, 10).forEach(function (p) { expect(p.locked).toBe(false); });
    result.slice(10).forEach(function (p) { expect(p.locked).toBe(true); });
    expect(result.filter(function (p) { return p.locked; }).length).toBe(5);
  });

  it('original project fields are preserved on the returned objects', function () {
    var projects = [{ id: 42, project_name: 'Test', extra: 'preserved' }];
    var result = annotateProjects(projects, PLAN_LIMITS.starter);

    expect(result[0].id).toBe(42);
    expect(result[0].project_name).toBe('Test');
    expect(result[0].extra).toBe('preserved');
  });
});

// ---------------------------------------------------------------------------
// Server-authoritative lockMap (RPC result available)
// ---------------------------------------------------------------------------

describe('annotateProjects — server lockMap takes precedence', function () {
  it('server marks project 3 locked; client limit would not lock it — server wins', function () {
    var projects = makeProjects(5);
    var lockMap = { 1: false, 2: false, 3: true, 4: false, 5: false };
    var result = annotateProjects(projects, PLAN_LIMITS.starter, lockMap);

    expect(result[0].locked).toBe(false);
    expect(result[1].locked).toBe(false);
    expect(result[2].locked).toBe(true);
    expect(result[3].locked).toBe(false);
    expect(result[4].locked).toBe(false);
  });

  it('server says all unlocked — ignores client-side index limit', function () {
    var projects = makeProjects(15);
    var lockMap = {};
    projects.forEach(function (p) { lockMap[p.id] = false; });
    var result = annotateProjects(projects, PLAN_LIMITS.free, lockMap);

    result.forEach(function (p) { expect(p.locked).toBe(false); });
  });

  it('project id missing from lockMap defaults to false (unlocked)', function () {
    var projects = makeProjects(3);
    var lockMap = { 1: true };
    var result = annotateProjects(projects, PLAN_LIMITS.starter, lockMap);

    expect(result[0].locked).toBe(true);
    expect(result[1].locked).toBe(false);
    expect(result[2].locked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('annotateProjects — edge cases', function () {
  it('empty project list returns empty array', function () {
    expect(annotateProjects([], PLAN_LIMITS.free)).toEqual([]);
    expect(annotateProjects([], PLAN_LIMITS.unlimited)).toEqual([]);
  });

  it('limit of 0 locks every project', function () {
    var projects = makeProjects(3);
    var result = annotateProjects(projects, 0);

    result.forEach(function (p) { expect(p.locked).toBe(true); });
  });
});
