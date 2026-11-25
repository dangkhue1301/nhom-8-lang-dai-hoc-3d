import { EVENTS, LOTS, STAGES } from './data.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class CampusGameState {
  constructor() {
    this.stageHistory = {};
    this.initStage(1);
  }

  initStage(stageId) {
    const cfg = STAGES[stageId] || STAGES[1];
    this.stageId = cfg.id;
    this.stageCfg = cfg;
    this.elapsed = 0;

    // Lot visual variant for 3D scene: 'fenced' | 'baocap' | 'private' | 'state' | 'xhcn'
    this.lotVariants = {};
    this.lotChoices = {}; // Chosen variants in Stage 3
    this.eventChoices = {};
    this.resolvedEvents = [];
    this.pendingEvent = null;
    this.unlockedCharacteristics = {};
    this.lastInsight = '';

    // Stage 1: manual queue simulation
    this.queueCount = 3;
    this.servedCount = 0;
    this.stage1SpawnAccum = 0;
    this.stage1Ready = false;

    // Stage 2: 3-wave unmanaged market demonstration
    this.stage2Phase = 0; // 0 (initial surge) -> 1 -> 2 -> 3
    this.stage2BlockedTaps = 0;
    this.stage2Ready = false;

    // Stage 3: interactive budget + balanced outcomes
    this.baseMetrics = { budget: 100, economy: 55, studentLife: 38 };

    if (this.stageId === 1) {
      this.metrics = { budget: 40, economy: 22, studentLife: 44 };
      for (const lot of LOTS) {
        this.lotVariants[lot.id] = lot.baocapState;
      }
    } else if (this.stageId === 2) {
      this.metrics = { budget: 62, economy: 68, studentLife: 52 };
      for (const lot of LOTS) {
        this.lotVariants[lot.id] = lot.marketState;
      }
    } else {
      this.metrics = clone(this.baseMetrics);
      // Stage 3 starts from market infrastructure ready for student-friendly regulation
      for (const lot of LOTS) {
        this.lotVariants[lot.id] = lot.marketState;
      }
    }
  }

  getBuiltCount() {
    return Object.keys(this.lotChoices).length;
  }

  getUnlockedList() {
    return Object.keys(this.unlockedCharacteristics);
  }

  // ---------------- STAGE 1 ----------------
  stepStage1(dt) {
    if (this.stageId !== 1) return;
    const safeDt = Math.min(Math.max(dt, 0), 0.1);
    this.elapsed += safeDt;

    // Student arrival accelerates slightly so queue visibly grows
    const spawnRate = 0.85 + Math.min(1.1, this.elapsed * 0.04);
    this.stage1SpawnAccum += safeDt * spawnRate;
    while (this.stage1SpawnAccum >= 1) {
      this.stage1SpawnAccum -= 1;
      if (this.queueCount < 14) {
        this.queueCount += 1;
      }
    }

    if (this.queueCount >= 8) {
      this.metrics.economy = clamp(this.metrics.economy - 0.55 * safeDt, 14, 48);
      this.metrics.studentLife = clamp(this.metrics.studentLife - 0.8 * safeDt, 16, 60);
    }

    if (this.servedCount >= 10 || this.queueCount >= 9) {
      this.stage1Ready = true;
    }
    this.snapshotStageHistory(1);
  }

  serveCanteen() {
    if (this.stageId !== 1) return { ok: false };
    if (this.queueCount > 0) {
      this.queueCount -= 1;
      this.servedCount += 1;
      this.metrics.economy = clamp(this.metrics.economy + 0.9, 14, 48);
      this.metrics.studentLife = clamp(this.metrics.studentLife + 0.7, 16, 60);
      if (this.servedCount >= 10 || this.queueCount >= 9) {
        this.stage1Ready = true;
      }
      this.snapshotStageHistory(1);
      return { ok: true, queueCount: this.queueCount, servedCount: this.servedCount };
    }
    return { ok: false, reason: 'empty' };
  }

  // ---------------- STAGE 2 ----------------
  stepStage2(dt) {
    if (this.stageId !== 2) return;
    const safeDt = Math.min(Math.max(dt, 0), 0.1);
    this.elapsed += safeDt;

    const targetPhase = this.elapsed >= 18 ? 3 : this.elapsed >= 12 ? 2 : this.elapsed >= 6 ? 1 : 0;
    while (this.stage2Phase < targetPhase) {
      this.applyStage2Wave(this.stage2Phase + 1);
    }
    this.snapshotStageHistory(2);
  }

  advanceStage2Phase() {
    if (this.stageId !== 2) return this.stage2Phase;
    if (this.stage2Phase < 3) {
      this.applyStage2Wave(this.stage2Phase + 1);
      this.elapsed = Math.max(this.elapsed, this.stage2Phase * 6);
    }
    this.snapshotStageHistory(2);
    return this.stage2Phase;
  }

  applyStage2Wave(nextPhase) {
    this.stage2Phase = clamp(nextPhase, 0, 3);
    if (this.stage2Phase === 1) {
      this.metrics = { budget: 78, economy: 79, studentLife: 41 };
    } else if (this.stage2Phase === 2) {
      this.metrics = { budget: 90, economy: 87, studentLife: 31 };
    } else if (this.stage2Phase === 3) {
      this.metrics = { budget: 96, economy: 93, studentLife: 22 };
      this.stage2Ready = true;
    }
  }

  recordStage2BlockedTap() {
    if (this.stageId !== 2) return { blocked: false };
    this.stage2BlockedTaps += 1;
    return {
      blocked: true,
      message: '🚫 Chế độ Thả nổi: Nhà nước đứng ngoài — không thể can thiệp!'
    };
  }

  // ---------------- STAGE 3 ----------------
  previewStage3Budget(candidateLotId, candidateVariant, candidateEventId, candidateEventSide) {
    const nextLots = { ...this.lotChoices };
    if (candidateLotId && candidateVariant) {
      nextLots[candidateLotId] = candidateVariant;
    }
    const nextEvents = { ...this.eventChoices };
    if (candidateEventId && candidateEventSide) {
      nextEvents[candidateEventId] = candidateEventSide;
    }

    let rawBudget = this.baseMetrics.budget;
    let rawEconomy = this.baseMetrics.economy;
    let rawStudentLife = this.baseMetrics.studentLife;

    for (const lot of LOTS) {
      const picked = nextLots[lot.id];
      if (!picked || !lot.choices[picked]) continue;
      const opt = lot.choices[picked];
      rawBudget -= opt.cost;
      rawEconomy += opt.economy;
      rawStudentLife += opt.studentLife;
    }

    for (const ev of EVENTS) {
      const side = nextEvents[ev.id];
      if (!side) continue;
      const opt = side === 'B' ? ev.optionB : ev.optionA;
      rawBudget += opt.budgetDelta;
      rawEconomy += opt.economyDelta;
      rawStudentLife += opt.studentLifeDelta;
    }

    return {
      rawBudget,
      metrics: {
        budget: Math.max(0, rawBudget),
        economy: clamp(rawEconomy, 0, 100),
        studentLife: clamp(rawStudentLife, 0, 100)
      }
    };
  }

  recomputeStage3() {
    const res = this.previewStage3Budget(null, null, null, null);
    this.metrics = res.metrics;

    const unlocked = {};
    for (const lot of LOTS) {
      const picked = this.lotChoices[lot.id];
      if (picked && lot.choices[picked]?.unlocks) {
        for (const ch of lot.choices[picked].unlocks) {
          unlocked[ch] = true;
        }
      }
    }
    this.unlockedCharacteristics = unlocked;
    this.snapshotStageHistory(3);
  }

  canAffordLotChoice(lotId, variant) {
    const lot = LOTS.find((l) => l.id === lotId);
    if (!lot || !lot.choices[variant]) return { ok: false, reason: 'invalid' };
    const preview = this.previewStage3Budget(lotId, variant, null, null);
    if (preview.rawBudget < 0) {
      return {
        ok: false,
        reason: 'budget',
        needed: Math.ceil(-preview.rawBudget)
      };
    }
    return { ok: true, resultingBudget: preview.rawBudget };
  }

  applyLotChoice(lotId, variant) {
    if (this.stageId !== 3) {
      return { ok: false, reason: 'wrong_stage' };
    }
    if (this.pendingEvent) {
      return { ok: false, reason: 'pending_event' };
    }
    const lot = LOTS.find((l) => l.id === lotId);
    if (!lot || !lot.choices[variant]) {
      return { ok: false, reason: 'invalid' };
    }

    const afford = this.canAffordLotChoice(lotId, variant);
    if (!afford.ok) {
      return afford;
    }

    this.lotChoices[lotId] = variant;
    this.lotVariants[lotId] = variant;
    const opt = lot.choices[variant];
    this.lastInsight = opt.insight || opt.desc;

    this.recomputeStage3();
    this.checkEventTriggers();

    return {
      ok: true,
      lotId,
      variant,
      insight: this.lastInsight,
      pendingEvent: this.pendingEvent
    };
  }

  checkEventTriggers() {
    const builtCount = this.getBuiltCount();
    for (const ev of EVENTS) {
      if (builtCount >= ev.triggerAfterLots && !this.eventChoices[ev.id]) {
        this.pendingEvent = ev;
        return ev;
      }
    }
    this.pendingEvent = null;
    return null;
  }

  chooseEvent(eventId, side) {
    if (this.stageId !== 3) return { ok: false, reason: 'wrong_stage' };
    const ev = EVENTS.find((e) => e.id === eventId);
    if (!ev) return { ok: false, reason: 'unknown' };
    if (this.eventChoices[eventId]) return { ok: false, reason: 'already_resolved' };

    const chosenSide = side === 'B' ? 'B' : 'A';
    const opt = chosenSide === 'B' ? ev.optionB : ev.optionA;

    this.eventChoices[eventId] = chosenSide;
    this.resolvedEvents.push({
      id: ev.id,
      title: ev.title,
      side: chosenSide,
      shortTag: opt.shortTag
    });
    this.pendingEvent = null;
    this.recomputeStage3();

    return { ok: true, side: chosenSide, chosen: opt };
  }

  isStage3Complete() {
    return this.stageId === 3 && this.getBuiltCount() === LOTS.length && !this.pendingEvent;
  }

  hasTransitBus() {
    return this.stageId === 3 && this.lotVariants.transit === 'xhcn';
  }

  getTrafficSeverity() {
    if (this.stageId === 1) return 0.1;
    if (this.stageId === 2) return this.stage2Phase >= 2 ? 1.0 : 0.65;
    if (this.lotVariants.transit === 'xhcn') return 0.12;
    if (this.lotVariants.transit === 'private') return 0.9;
    return 0.45;
  }

  snapshotStageHistory(stageId) {
    this.stageHistory[stageId] = {
      stageId,
      budget: Math.round(this.metrics.budget),
      economy: Math.round(this.metrics.economy),
      studentLife: Math.round(this.metrics.studentLife)
    };
  }

  classifyEnding() {
    const e = this.metrics.economy;
    const s = this.metrics.studentLife;
    const unlockedCount = this.getUnlockedList().length;

    if (e >= 80 && s >= 80 && unlockedCount >= 5) {
      return {
        tier: 'KIỂU MẪU · ĐỊNH HƯỚNG XHCN',
        badgeClass: 'tier-s',
        title: 'Làng Đại Học Kiểu Mẫu Hài Hòa',
        summary:
          'Bạn kết hợp hiệu quả động lực thị trường (Khu Việc Làm tạo nguồn thu thuế) với KTX công, chuẩn An toàn Thực phẩm, Xe buýt 3.000đ và Học bổng: Kinh tế bứt phá song hành cùng Đời sống Sinh viên.'
      };
    }

    if (e >= 75 && s <= 40) {
      return {
        tier: 'TĂNG TRƯỞNG LỆCH PHA',
        badgeClass: 'tier-warn',
        title: 'Phố Giàu Nhưng Sinh Viên Kiệt Quệ',
        summary:
          'Ưu tiên thả nổi tư nhân giúp kinh tế tăng nhanh, nhưng giá trọ đắt đỏ, kẹt xe và cắt giảm an sinh khiến sinh viên chịu thiệt — giống bài học ở Chặng 2.'
      };
    }

    if (s >= 72 && e < 68) {
      return {
        tier: 'ƯU TIÊN AN SINH',
        badgeClass: 'tier-info',
        title: 'Đời Sống Ổn Nhưng Chậm Nguồn Thu',
        summary:
          'Sinh viên được chăm lo tốt, song cần đẩy mạnh Khu Việc Làm & Hợp tác FDI để tạo nguồn lực ngân sách bền vững lâu dài.'
      };
    }

    return {
      tier: 'PHÁT TRIỂN CÂN BẰNG',
      badgeClass: 'tier-a',
      title: 'Khu Phố Sinh Viên Đang Chuyển Mình',
      summary:
        'Bạn đã áp dụng nhiều giải pháp điều tiết tích cực (' +
        unlockedCount +
        '/5 đặc trưng). Hoàn thiện các khu đất theo mô hình Định hướng XHCN sẽ giúp đạt chuẩn Kiểu Mẫu.'
    };
  }

  buildDemoCompleteState() {
    // Realistic snapshots of Stage 1 and Stage 2
    this.stageHistory = {
      1: { stageId: 1, budget: 40, economy: 31, studentLife: 41 },
      2: { stageId: 2, budget: 96, economy: 93, studentLife: 22 }
    };
    this.initStage(3);
    // Re-preserve 1 and 2 snapshots while filling Stage 3
    this.stageHistory[1] = { stageId: 1, budget: 40, economy: 31, studentLife: 41 };
    this.stageHistory[2] = { stageId: 2, budget: 96, economy: 93, studentLife: 22 };

    const buildOrder = ['jobs', 'housing', 'food', 'transit', 'study', 'welfare'];
    for (const lid of buildOrder) {
      this.applyLotChoice(lid, 'xhcn');
      if (this.pendingEvent) {
        this.chooseEvent(this.pendingEvent.id, 'B');
      }
    }
    return this;
  }
}
