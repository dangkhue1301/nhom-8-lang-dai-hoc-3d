import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { CHARACTERISTICS, EVENTS, LOTS, STAGES } from './js/data.js';
import { CampusGameState } from './js/gameState.js';

assert.ok(fs.existsSync(path.join(__dirname, 'vendor/three.module.js')), 'Missing vendored Three.js module');
assert.ok(fs.existsSync(path.join(__dirname, 'vendor/three.core.js')), 'Missing vendored Three.js core');
assert.ok(fs.statSync(path.join(__dirname, 'vendor/three.module.js')).size > 100000, 'Vendored Three.js looks empty');
assert.equal(LOTS.length, 6, 'Should have 6 campus lots');
assert.equal(CHARACTERISTICS.length, 5, 'Should have 5 Chapter 5 characteristics');
assert.equal(EVENTS.length, 2, 'Should have 2 student situation events');
assert.ok(STAGES[1] && STAGES[2] && STAGES[3], 'Should define 3 stages');

// 1. Test Stage 1 (Bao cấp): queue growth and serveCanteen milestone
{
  const g = new CampusGameState();
  assert.equal(g.stageId, 1);
  for (let i = 0; i < 60; i += 1) {
    g.stepStage1(0.1);
  }
  assert.ok(g.queueCount >= 6, `Stage 1 queue should grow, got ${g.queueCount}`);
  for (let s = 0; s < 10; s += 1) {
    for (let wait = 0; wait < 25 && g.queueCount === 0; wait += 1) {
      g.stepStage1(0.1);
    }
    const res = g.serveCanteen();
    assert.equal(res.ok, true);
  }
  assert.equal(g.stage1Ready, true, 'Stage 1 should mark stage1Ready after 10 serves or overflow queue');
  console.log('Stage 1 verified:', { served: g.servedCount, queue: g.queueCount, metrics: g.metrics });
}

// 2. Test Stage 2 (Thị trường thả nổi): wave progression & locked interventions
{
  const g = new CampusGameState();
  g.initStage(2);
  for (let i = 0; i < 200; i += 1) {
    g.stepStage2(0.1); // advances through phases over 20s
  }
  assert.equal(g.stage2Phase, 3, 'Stage 2 should reach phase 3');
  assert.ok(g.metrics.economy >= 80, `Stage 2 economy expected >= 80, got ${g.metrics.economy}`);
  assert.ok(g.metrics.studentLife <= 30, `Stage 2 studentLife expected <= 30, got ${g.metrics.studentLife}`);
  const blocked = g.recordStage2BlockedTap();
  assert.equal(blocked.blocked, true);
  assert.equal(g.applyLotChoice('housing', 'xhcn').ok, false, 'Cannot build in Stage 2');
  console.log('Stage 2 verified:', { phase: g.stage2Phase, metrics: g.metrics });
}

// 3. Test Stage 3 Pure Private -> Tier Warn (rich economy, suffering students)
{
  const g = new CampusGameState();
  g.initStage(3);
  for (const lot of LOTS) {
    const res = g.applyLotChoice(lot.id, 'private');
    assert.equal(res.ok, true, `Pure private ${lot.id} should succeed`);
    if (g.pendingEvent) {
      g.chooseEvent(g.pendingEvent.id, 'A');
    }
  }
  const ending = g.classifyEnding();
  assert.ok(g.metrics.economy >= 80, `Private economy >= 80, got ${g.metrics.economy}`);
  assert.ok(g.metrics.studentLife <= 35, `Private studentLife <= 35, got ${g.metrics.studentLife}`);
  assert.equal(ending.badgeClass, 'tier-warn', `Expected tier-warn, got ${ending.badgeClass}`);
  console.log('Stage 3 Pure Private verified:', { metrics: g.metrics, tier: ending.badgeClass });
}

// 4. Test Stage 3 Pure State -> Hits budget constraint without revenue
{
  const g = new CampusGameState();
  g.initStage(3);
  let budgetRejected = false;
  for (const lot of LOTS) {
    const res = g.applyLotChoice(lot.id, 'state');
    if (!res.ok && res.reason === 'budget') {
      budgetRejected = true;
      break;
    }
  }
  assert.equal(budgetRejected, true, 'Pure 100% state subsidy must hit budget guard without jobs revenue');
  console.log('Stage 3 Pure State budget guard verified:', { budget: g.metrics.budget });
}

// 5. Test Stage 3 Balanced XHCN -> Tier S + 5/5 characteristics + Events B
{
  const g = new CampusGameState();
  g.initStage(3);
  const order = ['jobs', 'housing', 'food', 'transit', 'study', 'welfare'];
  for (const lid of order) {
    const res = g.applyLotChoice(lid, 'xhcn');
    assert.equal(res.ok, true, `Balanced XHCN ${lid} failed: ${JSON.stringify(res)}`);
    if (g.pendingEvent) {
      const evRes = g.chooseEvent(g.pendingEvent.id, 'B');
      assert.equal(evRes.ok, true);
    }
  }
  // Test switching a lot back & forth preserves invariants
  const reSwitch = g.applyLotChoice('food', 'private');
  assert.equal(reSwitch.ok, true);
  assert.equal(g.applyLotChoice('food', 'xhcn').ok, true);

  assert.equal(g.isStage3Complete(), true);
  assert.equal(g.hasTransitBus(), true, 'XHCN transit enables 3D green student buses');
  assert.equal(g.getUnlockedList().length, 5, 'Must unlock all 5 Chapter 5 characteristics');
  assert.ok(g.metrics.budget >= 0, `Budget must stay >= 0, got ${g.metrics.budget}`);
  assert.ok(g.metrics.economy >= 80, `Economy >= 80, got ${g.metrics.economy}`);
  assert.ok(g.metrics.studentLife >= 80, `Student life >= 80, got ${g.metrics.studentLife}`);

  const ending = g.classifyEnding();
  assert.equal(ending.badgeClass, 'tier-s', `Expected tier-s, got ${ending.badgeClass}`);
  console.log('Stage 3 Balanced XHCN verified:', {
    metrics: g.metrics,
    unlocked: g.getUnlockedList().length,
    tier: ending.badgeClass
  });
}

// 6. Test buildDemoCompleteState snapshot across 3 stages
{
  const demo = new CampusGameState().buildDemoCompleteState();
  assert.ok(demo.stageHistory[1] && demo.stageHistory[2] && demo.stageHistory[3], 'Must contain all 3 stage snapshots');
  assert.equal(demo.classifyEnding().badgeClass, 'tier-s');
}

console.log('PASS: All Làng Đại Học 3D gameState scenarios verified!');
