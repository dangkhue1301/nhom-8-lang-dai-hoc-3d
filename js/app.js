import { audio } from './audio.js';
import { CHARACTERISTICS, LESSON_NOTES, LOTS, STAGE2_WAVES, STAGES } from './data.js';
import { CampusGameState } from './gameState.js';
import { CampusScene3D } from './scene3d.js';

const gameState = new CampusGameState();
let mode = 'intro'; // 'intro' | 'play' | 'summary'
let stageModalKind = null; // null | 'stage-intro' | 'stage-takeaway'
let selectedLotId = null;
let selectedCharId = CHARACTERISTICS[0].id;
let toastTimer = null;
let admireTimer = null;
let lastHudMetrics = null;

const el = {
  sceneCanvas: document.getElementById('scene-canvas'),
  worldLabels: document.getElementById('world-labels'),
  fxLayer: document.getElementById('fx-layer'),
  hudTop: document.getElementById('hud-top'),
  hudBottom: document.getElementById('hud-bottom'),
  stageDot: document.getElementById('stage-dot'),
  stagePillText: document.getElementById('stage-pill-text'),
  cardBudget: document.getElementById('card-budget'),
  cardEconomy: document.getElementById('card-economy'),
  cardLife: document.getElementById('card-life'),
  valBudget: document.getElementById('val-budget'),
  valEconomy: document.getElementById('val-economy'),
  valLife: document.getElementById('val-life'),
  deltaBudget: document.getElementById('delta-budget'),
  deltaEconomy: document.getElementById('delta-economy'),
  deltaLife: document.getElementById('delta-life'),

  btnTimeToggle: document.getElementById('btn-time-toggle'),
  btnCamReset: document.getElementById('btn-cam-reset'),
  btnMute: document.getElementById('btn-mute'),
  btnHome: document.getElementById('btn-home'),
  insightToast: document.getElementById('insight-toast'),

  barS1: document.getElementById('bar-stage-1'),
  barS2: document.getElementById('bar-stage-2'),
  barS3: document.getElementById('bar-stage-3'),
  s1QueueCount: document.getElementById('s1-queue-count'),
  s1ServedCount: document.getElementById('s1-served-count'),
  btnServe: document.getElementById('btn-serve'),
  btnNextS2: document.getElementById('btn-next-s2'),

  s2WaveTitle: document.getElementById('s2-wave-title'),
  s2WaveDetail: document.getElementById('s2-wave-detail'),
  btnS2Next: document.getElementById('btn-s2-next'),
  btnNextS3: document.getElementById('btn-next-s3'),

  s3ProgressText: document.getElementById('s3-progress-text'),
  s3CharsCount: document.getElementById('s3-chars-count'),
  s3LotChips: document.getElementById('s3-lot-chips'),
  btnFinishS3: document.getElementById('btn-finish-s3'),

  lotDrawer: document.getElementById('lot-drawer'),
  drawerIcon: document.getElementById('drawer-icon'),
  drawerTitle: document.getElementById('drawer-title'),
  drawerCurrent: document.getElementById('drawer-current'),
  drawerOptions: document.getElementById('drawer-options'),
  btnCloseDrawer: document.getElementById('btn-close-drawer'),

  introOverlay: document.getElementById('intro-overlay'),
  btnStart: document.getElementById('btn-start'),
  btnDemoSummary: document.getElementById('btn-demo-summary'),
  jumpBtns: document.querySelectorAll('[data-jump-stage]'),

  stageModal: document.getElementById('stage-modal'),
  stageModalBadge: document.getElementById('stage-modal-badge'),
  stageModalTitle: document.getElementById('stage-modal-title'),
  stageModalBody: document.getElementById('stage-modal-body'),
  stageModalObj: document.getElementById('stage-modal-obj'),
  btnStageModalOk: document.getElementById('btn-stage-modal-ok'),

  eventModal: document.getElementById('event-modal'),
  eventBadge: document.getElementById('event-badge'),
  eventModalTitle: document.getElementById('event-modal-title'),
  eventModalPrompt: document.getElementById('event-modal-prompt'),
  eventChoices: document.getElementById('event-choices'),

  summaryOverlay: document.getElementById('summary-overlay'),
  peekControls: document.getElementById('peek-controls'),
  btnPeekSunset: document.getElementById('btn-peek-sunset'),
  btnReopenSummary: document.getElementById('btn-reopen-summary'),
  btnPeek3d: document.getElementById('btn-peek-3d'),
  btnSummaryHome: document.getElementById('btn-summary-home'),
  summaryTierBadge: document.getElementById('summary-tier-badge'),
  summaryTitle: document.getElementById('summary-title'),
  summaryDesc: document.getElementById('summary-desc'),
  sumBudget: document.getElementById('sum-budget'),
  sumEconomy: document.getElementById('sum-economy'),
  sumLife: document.getElementById('sum-life'),
  compareBars: document.getElementById('compare-bars'),
  sumCharsCount: document.getElementById('sum-chars-count'),
  sumCharsGrid: document.getElementById('sum-chars-grid'),
  sumCharDetail: document.getElementById('sum-char-detail'),
  btnOpenReview: document.getElementById('btn-open-review'),
  btnReplayS3: document.getElementById('btn-replay-s3'),
  btnReplayAll: document.getElementById('btn-replay-all'),

  reviewModal: document.getElementById('review-modal'),
  reviewBody: document.getElementById('review-body'),
  btnCloseReview: document.getElementById('btn-close-review'),
  btnCloseReviewBottom: document.getElementById('btn-close-review-bottom')
};

const scene3d = new CampusScene3D(el.sceneCanvas, handleLotClick);

const BAOCAP_PIN_NAMES = {
  housing: 'KTX Cũ',
  food: 'Căng Tin Tem Phiếu',
  transit: 'Đất Giao Thông',
  jobs: 'Đất Sản Xuất',
  study: 'Đất Văn Hóa',
  welfare: 'Đất Y Tế'
};

const THANOI_PIN_NAMES = {
  housing: 'Trọ Tự Phát',
  food: 'Quán Vỉa Hè',
  transit: 'Bãi Xe 50k',
  jobs: 'Cao Ốc Tư Nhân',
  study: 'Cafe VIP 90k',
  welfare: 'Viện Phí Tư'
};

// Build reusable 3D pin elements inside #world-labels
const pinRefs = {};
for (const lot of LOTS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lot-pin';
  btn.setAttribute('data-lot-pin', lot.id);
  btn.innerHTML = `<span class="lot-pin-dot"></span><span class="lot-pin-ico">${lot.icon}</span><span class="lot-pin-lbl">${lot.shortName}</span><span class="lot-pin-tag"></span>`;
  btn.addEventListener('click', () => handleLotClick(lot.id));
  el.worldLabels.appendChild(btn);
  pinRefs[lot.id] = {
    btn,
    lbl: btn.querySelector('.lot-pin-lbl'),
    tag: btn.querySelector('.lot-pin-tag')
  };
}

function renderHighlighted(container, rawText) {
  container.textContent = '';
  const parts = String(rawText || '').split('**');
  for (let i = 0; i < parts.length; i += 1) {
    if (!parts[i]) continue;
    if (i % 2 === 1) {
      const mark = document.createElement('mark');
      mark.className = 'hl';
      mark.textContent = parts[i];
      container.appendChild(mark);
    } else {
      container.appendChild(document.createTextNode(parts[i]));
    }
  }
}

// Build Stage 3 quick lot chips
const chipRefs = {};
for (const lot of LOTS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lot-chip-btn';
  btn.textContent = `${lot.icon} ${lot.shortName}`;
  btn.addEventListener('click', () => handleLotClick(lot.id));
  el.s3LotChips.appendChild(btn);
  chipRefs[lot.id] = btn;
}

function triggerCssAnim(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  // Trigger reflow only on this tiny badge/card when a discrete player action occurs
  void node.offsetWidth;
  node.classList.add(cls);
}

function spawnWorldFloater(worldX, worldY, worldZ, items) {
  if (!el.fxLayer || !items || !items.length) return;
  const proj = scene3d.projectWorldPoint(worldX, worldY, worldZ);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const baseX = proj.visible ? Math.max(96, Math.min(w - 96, proj.x)) : w * 0.5;
  const baseY = proj.visible ? Math.max(235, Math.min(h - 185, proj.y)) : h * 0.52;

  items.forEach((item, idx) => {
    const cfg = typeof item === 'string' ? { text: item, tone: 'gain' } : item;
    const badge = document.createElement('div');
    badge.className = `fx-floater fx-${cfg.tone || 'gain'}`;
    badge.textContent = cfg.text;
    badge.style.left = `${baseX.toFixed(1)}px`;
    badge.style.top = `${(baseY - idx * 30).toFixed(1)}px`;
    badge.style.animationDelay = `${idx * 95}ms`;
    el.fxLayer.appendChild(badge);
    const cleanup = () => {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    };
    badge.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 1900 + idx * 100);
  });
}

function clearFxFloaters() {
  if (el.fxLayer) el.fxLayer.textContent = '';
  clearTimeout(admireTimer);
  admireTimer = null;
}

function flashMetricDelta(cardEl, deltaEl, diff, suffix = '') {
  if (!cardEl || !deltaEl || diff === 0) return;
  const sign = diff > 0 ? '+' : '';
  deltaEl.textContent = `${sign}${diff}${suffix}`;
  deltaEl.className = `m-delta ${diff > 0 ? 'is-up' : 'is-down'}`;
  triggerCssAnim(deltaEl, 'delta-pop');
  cardEl.classList.remove('metric-bump-up', 'metric-bump-down');
  void cardEl.offsetWidth;
  cardEl.classList.add(diff > 0 ? 'metric-bump-up' : 'metric-bump-down');
}

function showToast(text, durationMs = 4200) {
  if (!text) return;
  renderHighlighted(el.insightToast, text);
  el.insightToast.classList.remove('hidden');
  triggerCssAnim(el.insightToast, 'toast-pop');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.insightToast.classList.add('hidden');
  }, durationMs);
}

function closeDrawer({ holdCameraMs = 0 } = {}) {
  clearTimeout(admireTimer);
  admireTimer = null;
  selectedLotId = null;
  el.lotDrawer.classList.add('hidden');
  if (holdCameraMs > 0) {
    admireTimer = setTimeout(() => {
      admireTimer = null;
      if (!selectedLotId && mode === 'play') {
        scene3d.setSelectedLot(null);
        scene3d.resetCamera();
      }
    }, holdCameraMs);
  } else {
    scene3d.setSelectedLot(null);
    scene3d.resetCamera();
  }
}

function performCanteenServe() {
  const r = gameState.serveCanteen();
  if (r.ok) {
    audio.playServe();
    scene3d.triggerCanteenServeFx();
    spawnWorldFloater(13.0, 2.8, -6.2, [
      { text: '🎟️ +1 Suất cơm tem phiếu', tone: 'gain' },
      { text: '😊 Đời sống SV nhích nhẹ', tone: 'life' }
    ]);
    updateHud({ animateDelta: true });
  } else {
    audio.playPop();
    updateHud();
  }
}

function announceStage2Wave(phase) {
  scene3d.triggerStage2WaveFx(phase);
  const waveCard = el.barS2?.querySelector('.wave-box');
  triggerCssAnim(waveCard, 'wave-flash');
  if (phase === 1) {
    spawnWorldFloater(-13.0, 3.6, -8.0, [{ text: '⚠️ Cò trọ thổi giá x3!', tone: 'warn' }]);
  } else if (phase === 2) {
    spawnWorldFloater(0.0, 3.2, 9.2, [{ text: '⚠️ Bãi xe 50k · Kẹt cứng!', tone: 'warn' }]);
    spawnWorldFloater(13.0, 3.2, -8.0, [{ text: '⚠️ Quán vỉa hè mất ATTP!', tone: 'warn' }]);
  } else if (phase === 3) {
    spawnWorldFloater(0.0, 3.6, -10.0, [{ text: '⚠️ Dịch vụ VIP 90k/ly!', tone: 'warn' }]);
  }
}

function handleLotClick(lotId) {
  if (mode !== 'play' || stageModalKind !== null || gameState.pendingEvent) return;
  audio.ensureContext();
  clearTimeout(admireTimer);
  admireTimer = null;

  if (gameState.stageId === 1) {
    const lot = LOTS.find((l) => l.id === lotId);
    if (gameState.lotVariants[lotId] === 'fenced') {
      audio.playLocked();
      showToast('🚧 Khu đất này đang bị **rào kín thời Bao cấp** (cấm tư nhân mở dịch vụ).');
    } else if (lotId === 'food') {
      performCanteenServe();
    } else if (lot) {
      audio.playPop();
      showToast(`🏠 **${lot.name}**: Đang phân phối theo **chỉ tiêu Nhà nước** thời Bao cấp.`);
    }
    return;
  }

  if (gameState.stageId === 2) {
    audio.playLocked();
    const lot = LOTS.find((l) => l.id === lotId);
    if (lot) {
      spawnWorldFloater(lot.pos.x, 3.2, lot.pos.z, [{ text: '🚫 Thiếu công cụ điều tiết!', tone: 'warn' }]);
    }
    const res = gameState.recordStage2BlockedTap();
    showToast(res.message);
    return;
  }

  // Stage 3: Open 3D Lot Choice Drawer & focus camera
  audio.playPop();
  selectedLotId = lotId;
  scene3d.setSelectedLot(lotId);
  scene3d.focusLot(lotId);
  renderLotDrawer();
}

function renderLotDrawer() {
  const lot = LOTS.find((l) => l.id === selectedLotId);
  if (!lot) return;

  el.drawerIcon.textContent = lot.icon;
  el.drawerTitle.textContent = lot.name;

  const pickedVariant = gameState.lotChoices[lot.id];
  if (pickedVariant) {
    el.drawerCurrent.textContent = `Đã chọn: ${lot.choices[pickedVariant].badge}`;
  } else {
    el.drawerCurrent.textContent = 'Hiện trạng Chặng 2: Tư nhân thả nổi (chạm chọn bên dưới)';
  }

  el.drawerOptions.innerHTML = '';
  for (const key of ['xhcn', 'state', 'private']) {
    const opt = lot.choices[key];
    const afford = gameState.canAffordLotChoice(lot.id, key);
    const isPicked = pickedVariant === key;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `opt-card opt-${key}${isPicked ? ' is-picked' : ''}`;
    btn.disabled = !afford.ok;
    btn.setAttribute('data-choice-variant', key);

    const costText =
      opt.cost < 0 ? `Thu +${Math.abs(opt.cost)}tr` : opt.cost === 0 ? '0tr' : `Chi -${opt.cost}tr`;
    const costCls = opt.cost <= 0 ? 'cost-gain' : 'cost-spend';

    btn.innerHTML = `
      <div class="opt-top">
        <span class="opt-badge">${opt.badge}${isPicked ? ' · ĐANG CHỌN' : ''}</span>
        <span class="opt-cost ${costCls}">${costText}</span>
      </div>
      <div class="opt-label">${opt.label}</div>
      <div class="opt-desc">${
        afford.ok ? opt.desc : `⚠️ Thiếu ${afford.needed}tr Quỹ — Hãy mở [💼 Việc Làm] để có nguồn thuế!`
      }</div>
    `;

    btn.addEventListener('click', () => {
      audio.ensureContext();
      const prevMetrics = {
        budget: Math.round(gameState.metrics.budget),
        economy: Math.round(gameState.metrics.economy),
        studentLife: Math.round(gameState.metrics.studentLife)
      };
      const prevUnlocked = new Set(gameState.getUnlockedList());
      const wasComplete = gameState.isStage3Complete();

      const res = gameState.applyLotChoice(lot.id, key);
      if (!res.ok) {
        audio.playLocked();
        return;
      }

      const nextUnlocked = gameState.getUnlockedList();
      const newlyUnlockedId = nextUnlocked.find((id) => !prevUnlocked.has(id));
      audio.playBuild(key);
      if (newlyUnlockedId) {
        audio.playUnlockCharacteristic();
      }

      scene3d.syncWithGameState(gameState, lot.id);
      const hasEvent = Boolean(gameState.pendingEvent);
      closeDrawer({ holdCameraMs: hasEvent ? 0 : 1150 });
      updateHud({ animateDelta: true });

      // Pulse upgraded pin & quick-lot chip
      if (pinRefs[lot.id]) {
        pinRefs[lot.id].justBuiltUntil = performance.now() + 760;
      }
      triggerCssAnim(chipRefs[lot.id], 'chip-just-built');
      if (newlyUnlockedId) {
        triggerCssAnim(el.s3CharsCount, 'pill-pop');
      }

      // Build floating 3D stat popups directly above the newly constructed lot!
      const floatItems = [];
      const dB = Math.round(gameState.metrics.budget) - prevMetrics.budget;
      const dE = Math.round(gameState.metrics.economy) - prevMetrics.economy;
      const dL = Math.round(gameState.metrics.studentLife) - prevMetrics.studentLife;
      if (dB !== 0) {
        floatItems.push({ text: `💰 ${dB > 0 ? '+' : ''}${dB}tr Quỹ`, tone: dB > 0 ? 'gain' : 'spend' });
      }
      if (dE !== 0) {
        floatItems.push({ text: `📈 Kinh tế ${dE > 0 ? '+' : ''}${dE}`, tone: dE > 0 ? 'econ' : 'warn' });
      }
      if (dL !== 0) {
        floatItems.push({ text: `😊 Đời sống ${dL > 0 ? '+' : ''}${dL}`, tone: dL > 0 ? 'life' : 'warn' });
      }
      if (newlyUnlockedId) {
        const chMeta = CHARACTERISTICS.find((c) => c.id === newlyUnlockedId);
        if (chMeta) {
          floatItems.push({
            text: `✨ Mở khóa Đặc trưng ${chMeta.shortName}!`,
            tone: 'unlock'
          });
        }
      }
      spawnWorldFloater(lot.pos.x, 2.4, lot.pos.z, floatItems);

      if (!wasComplete && gameState.isStage3Complete()) {
        scene3d.triggerCampusCelebration();
      }

      showToast(res.insight, 4800);
      if (hasEvent) {
        openEventModal(gameState.pendingEvent);
      }
    });

    el.drawerOptions.appendChild(btn);
  }

  el.lotDrawer.classList.remove('hidden');
  triggerCssAnim(el.lotDrawer, 'drawer-open');
}

function openEventModal(ev) {
  audio.playAlert();
  closeDrawer();
  el.eventBadge.textContent = ev.badge;
  el.eventModalTitle.textContent = ev.title;
  el.eventModalPrompt.textContent = ev.prompt;
  el.eventChoices.innerHTML = '';

  for (const side of ['A', 'B']) {
    const opt = side === 'B' ? ev.optionB : ev.optionA;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `opt-card ${side === 'B' ? 'opt-xhcn' : 'opt-private'}`;
    btn.setAttribute('data-event-side', side);
    btn.innerHTML = `
      <div class="opt-top">
        <span class="opt-badge">Phương án ${side}</span>
        <span class="opt-cost ${opt.budgetDelta >= 0 ? 'cost-gain' : 'cost-spend'}">${
          opt.budgetDelta >= 0 ? `+${opt.budgetDelta}tr` : `${opt.budgetDelta}tr`
        }</span>
      </div>
      <div class="opt-label">${opt.label}</div>
      <div class="opt-desc">${opt.summary}</div>
    `;
    btn.addEventListener('click', () => {
      audio.ensureContext();
      const wasComplete = gameState.isStage3Complete();
      gameState.chooseEvent(ev.id, side);
      audio.playBuild(side === 'B' ? 'xhcn' : 'private');
      el.eventModal.classList.add('hidden');
      updateHud({ animateDelta: true });
      scene3d.triggerUpgradeFx(0, 0, side === 'B' ? 'xhcn' : 'private', {
        maxRadius: 5.8,
        beamHeight: 5.5,
        duration: 0.85
      });
      if (!wasComplete && gameState.isStage3Complete()) {
        scene3d.triggerCampusCelebration();
      }
      showToast(`✅ Đã chốt: **${opt.shortTag}**`, 4000);
    });
    el.eventChoices.appendChild(btn);
  }

  el.eventModal.classList.remove('hidden');
}

function openStageModal(kind) {
  stageModalKind = kind;
  const cfg = gameState.stageCfg;
  if (kind === 'stage-intro') {
    el.stageModalBadge.textContent = cfg.badge;
    el.stageModalTitle.textContent = cfg.title;
    renderHighlighted(el.stageModalBody, cfg.subtitle);
    renderHighlighted(el.stageModalObj, cfg.objective);
    el.btnStageModalOk.textContent = `▶ Bắt đầu Chặng ${cfg.id}`;
  } else {
    el.stageModalBadge.textContent = cfg.takeawayBadge;
    el.stageModalTitle.textContent = cfg.takeawayTitle;
    renderHighlighted(el.stageModalBody, cfg.takeawayBody);
    renderHighlighted(
      el.stageModalObj,
      `📊 Kết quả Chặng ${cfg.id}: **Kinh tế ${Math.round(gameState.metrics.economy)}** · **Đời sống SV ${Math.round(
        gameState.metrics.studentLife
      )}** · **Quỹ ${Math.round(gameState.metrics.budget)}tr**`
    );
    el.btnStageModalOk.textContent = cfg.nextButton;
  }
  el.stageModal.classList.remove('hidden');
  el.btnStageModalOk.focus();
}

function enterStage(stageId, showIntro = true) {
  mode = 'play';
  clearFxFloaters();
  closeDrawer();
  el.introOverlay.classList.add('hidden');
  el.summaryOverlay.classList.add('hidden');
  el.peekControls.classList.add('hidden');
  el.eventModal.classList.add('hidden');
  el.hudTop.classList.remove('hidden');
  el.hudBottom.classList.remove('hidden');

  gameState.initStage(stageId);
  lastHudMetrics = null;
  scene3d.setShowcaseOrbit(false);
  scene3d.resetCamera();
  scene3d.syncWithGameState(gameState);

  updateHud();
  if (showIntro) {
    openStageModal('stage-intro');
  } else {
    stageModalKind = null;
    el.stageModal.classList.add('hidden');
  }
}

function updateHud({ animateDelta = false } = {}) {
  const cfg = gameState.stageCfg;
  el.stagePillText.textContent = `CHẶNG ${cfg.id}/3 · ${
    cfg.id === 1 ? 'BAO CẤP' : cfg.id === 2 ? 'THẢ NỔI' : 'XHCN'
  }`;
  el.stageDot.style.backgroundColor = cfg.id === 1 ? '#d97706' : cfg.id === 2 ? '#e11d48' : '#059669';

  const curB = Math.round(gameState.metrics.budget);
  const curE = Math.round(gameState.metrics.economy);
  const curL = Math.round(gameState.metrics.studentLife);

  if (animateDelta && lastHudMetrics) {
    flashMetricDelta(el.cardBudget, el.deltaBudget, curB - lastHudMetrics.budget, 'tr');
    flashMetricDelta(el.cardEconomy, el.deltaEconomy, curE - lastHudMetrics.economy, '');
    flashMetricDelta(el.cardLife, el.deltaLife, curL - lastHudMetrics.life, '');
  }
  lastHudMetrics = { budget: curB, economy: curE, life: curL };

  el.valBudget.textContent = `${curB}tr`;
  el.valEconomy.textContent = String(curE);
  el.valLife.textContent = String(curL);

  el.barS1.classList.toggle('hidden', gameState.stageId !== 1);
  el.barS2.classList.toggle('hidden', gameState.stageId !== 2);
  el.barS3.classList.toggle('hidden', gameState.stageId !== 3);

  if (gameState.stageId === 1) {
    el.s1QueueCount.textContent = String(gameState.queueCount);
    el.s1ServedCount.textContent = String(gameState.servedCount);
    el.btnNextS2.classList.toggle('hidden', !gameState.stage1Ready);
  } else if (gameState.stageId === 2) {
    if (gameState.stage2Phase === 0) {
      el.s2WaveTitle.textContent = 'Thị trường vừa mở cửa — quán xá & nhà trọ mọc rất nhanh!';
      el.s2WaveDetail.textContent = 'Thử chạm vào 1 tòa nhà trên bản đồ, hoặc bấm Xem diễn biến tiếp.';
    } else {
      const wave = STAGE2_WAVES[gameState.stage2Phase - 1];
      el.s2WaveTitle.textContent = wave.title;
      el.s2WaveDetail.textContent = wave.detail;
    }
    el.btnS2Next.classList.toggle('hidden', gameState.stage2Phase >= 3);
    el.btnNextS3.classList.toggle('hidden', !gameState.stage2Ready);
  } else if (gameState.stageId === 3) {
    const built = gameState.getBuiltCount();
    const unlocked = gameState.getUnlockedList().length;
    el.s3ProgressText.textContent =
      built === LOTS.length
        ? '✅ Đã quy hoạch xong 6/6 khu! Bấm nút bên dưới để xem tổng kết:'
        : `👆 Chạm khu đất 3D hoặc nút nhanh để quy hoạch (${built}/6)`;
    el.s3CharsCount.textContent = `${unlocked}/5 đặc trưng`;
    el.btnFinishS3.classList.toggle('hidden', !gameState.isStage3Complete());

    for (const lot of LOTS) {
      const ch = gameState.lotChoices[lot.id];
      const chip = chipRefs[lot.id];
      chip.className = `lot-chip-btn${ch ? ` done-${ch}` : ''}`;
      chip.textContent = `${lot.icon} ${lot.shortName}${ch === 'xhcn' ? ' ✓' : ch ? ' •' : ''}`;
    }
  }
}

let worldLabelsHidden = false;

function updateProjectedPins() {
  if (mode === 'intro') {
    if (!worldLabelsHidden) {
      el.worldLabels.classList.add('hidden');
      worldLabelsHidden = true;
    }
    return;
  }
  if (worldLabelsHidden) {
    el.worldLabels.classList.remove('hidden');
    worldLabelsHidden = false;
  }
  const pins = scene3d.getProjectedLotPins();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isDrawerOpen = !el.lotDrawer.classList.contains('hidden');

  // Pass 1: Update text/classes only when changed (zero redundant DOM mutations)
  let needsWidthMeasure = false;
  for (const p of pins) {
    const ref = pinRefs[p.lot.id];
    const nextLbl =
      gameState.stageId === 1
        ? BAOCAP_PIN_NAMES[p.lot.id] || p.lot.shortName
        : gameState.stageId === 2
        ? THANOI_PIN_NAMES[p.lot.id] || p.lot.shortName
        : p.lot.shortName;
    if (ref.lastLbl !== nextLbl) {
      ref.lbl.textContent = nextLbl;
      ref.lastLbl = nextLbl;
      ref.dirtyW = true;
    }

    let nextTag = '';
    if (gameState.stageId === 1) {
      nextTag = p.variant === 'fenced' ? '🔒' : '';
    } else if (gameState.stageId === 3 && gameState.lotChoices[p.lot.id]) {
      nextTag = gameState.lotChoices[p.lot.id] === 'xhcn' ? '✓' : '•';
    }
    if (ref.lastTag !== nextTag) {
      ref.tag.textContent = nextTag;
      ref.lastTag = nextTag;
      ref.dirtyW = true;
    }

    const hiddenByDrawer = isDrawerOpen && selectedLotId && selectedLotId !== p.lot.id;
    const inBounds = !hiddenByDrawer && p.visible && p.x > -40 && p.x < w + 40 && p.y > 70 && p.y < h - 75;
    const nextHidden = !inBounds;
    const st3Pick = gameState.stageId === 3 ? gameState.lotChoices[p.lot.id] : p.variant;
    const isJustBuilt = Boolean(ref.justBuiltUntil && performance.now() < ref.justBuiltUntil);
    const nextClass = `lot-pin${st3Pick ? ` state-${st3Pick}` : ''}${
      selectedLotId === p.lot.id ? ' is-selected' : ''
    }${isJustBuilt ? ' pin-just-built' : ''}${nextHidden ? ' hidden' : ''}`;
    if (ref.lastClass !== nextClass) {
      ref.btn.className = nextClass;
      ref.lastClass = nextClass;
    }
    ref.inBounds = inBounds;
    if (inBounds && (ref.dirtyW || !ref.halfW)) {
      needsWidthMeasure = true;
    }
  }

  // Pass 2: Batch-read widths ONLY when text changed (eliminates 6x/frame synchronous layout thrashing!)
  if (needsWidthMeasure) {
    for (const lot of LOTS) {
      const ref = pinRefs[lot.id];
      if (ref.inBounds && (ref.dirtyW || !ref.halfW)) {
        const measured = ref.btn.offsetWidth;
        if (measured > 0) {
          ref.halfW = measured * 0.5 + 6;
          ref.dirtyW = false;
        }
      }
    }
  }

  // Pass 3: GPU-composited translate3d writes only (zero layout/reflow!)
  for (const p of pins) {
    const ref = pinRefs[p.lot.id];
    if (!ref.inBounds) continue;
    const halfW = ref.halfW || 58;
    const clampedX = Math.max(halfW, Math.min(w - halfW, p.x));
    const clampedY = Math.max(112, Math.min(h - 146, p.y));
    ref.btn.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }
}

function renderSummaryCharacteristics() {
  const unlockedMap = gameState.unlockedCharacteristics || {};
  const unlockedCount = Object.keys(unlockedMap).length;
  el.sumCharsCount.textContent = `${unlockedCount}/5`;
  el.sumCharsGrid.innerHTML = '';

  for (let i = 0; i < CHARACTERISTICS.length; i += 1) {
    const ch = CHARACTERISTICS[i];
    const isSel = ch.id === selectedCharId;
    const isUnl = Boolean(unlockedMap[ch.id]);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `char-tab-${ch.id}`;
    btn.className = `char-tab-btn${isSel ? ' is-active' : ''}${isUnl ? ' is-unlocked' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isSel ? 'true' : 'false');
    btn.setAttribute('aria-controls', 'sum-char-detail');
    btn.setAttribute('tabindex', isSel ? '0' : '-1');
    btn.innerHTML = `<span>${ch.icon}</span><span>${ch.shortName}</span>`;

    btn.addEventListener('click', () => {
      selectedCharId = ch.id;
      scene3d.setShowcaseOrbit(false);
      scene3d.setSelectedLot(ch.focusLotId);
      scene3d.focusLot(ch.focusLotId);
      renderSummaryCharacteristics();
    });

    btn.addEventListener('keydown', (ev) => {
      const len = CHARACTERISTICS.length;
      let next = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (i + 1) % len;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (i - 1 + len) % len;
      if (next !== null) {
        ev.preventDefault();
        const target = CHARACTERISTICS[next];
        selectedCharId = target.id;
        scene3d.setSelectedLot(target.focusLotId);
        scene3d.focusLot(target.focusLotId);
        renderSummaryCharacteristics();
        document.getElementById(`char-tab-${target.id}`)?.focus();
      }
    });

    el.sumCharsGrid.appendChild(btn);
  }

  const active = CHARACTERISTICS.find((c) => c.id === selectedCharId) || CHARACTERISTICS[0];
  el.sumCharDetail.textContent = '';
  const h3 = document.createElement('h3');
  h3.textContent = `${active.icon} ${active.order}. ${active.name}`;
  el.sumCharDetail.appendChild(h3);

  if (active.keywords && active.keywords.length) {
    const kwRow = document.createElement('div');
    kwRow.className = 'kw-pills';
    for (const kw of active.keywords) {
      const sp = document.createElement('span');
      sp.className = 'kw-pill';
      sp.textContent = kw;
      kwRow.appendChild(sp);
    }
    el.sumCharDetail.appendChild(kwRow);
  }

  const pBook = document.createElement('p');
  pBook.className = 'char-detail-book';
  renderHighlighted(pBook, active.textbook);
  el.sumCharDetail.appendChild(pBook);

  const pCamp = document.createElement('p');
  pCamp.className = 'char-detail-campus';
  renderHighlighted(pCamp, active.campusExample);
  el.sumCharDetail.appendChild(pCamp);
}

function showSummaryScreen(isDemo = false) {
  mode = 'summary';
  clearFxFloaters();
  closeDrawer();
  el.introOverlay.classList.add('hidden');
  el.stageModal.classList.add('hidden');
  el.eventModal.classList.add('hidden');
  el.hudTop.classList.add('hidden');
  el.hudBottom.classList.add('hidden');

  if (isDemo) {
    gameState.buildDemoCompleteState();
  }
  scene3d.syncWithGameState(gameState);
  scene3d.setShowcaseOrbit(true);

  const ending = gameState.classifyEnding();
  el.summaryTierBadge.textContent = ending.tier;
  el.summaryTierBadge.className = `badge-pill ${ending.badgeClass}`;
  el.summaryTitle.textContent = ending.title;
  el.summaryDesc.textContent = ending.summary;

  el.sumBudget.textContent = `${Math.round(gameState.metrics.budget)}tr`;
  el.sumEconomy.textContent = String(Math.round(gameState.metrics.economy));
  el.sumLife.textContent = String(Math.round(gameState.metrics.studentLife));

  // Build 3-Stage Bar Comparison
  el.compareBars.innerHTML = '';
  const rows = [
    { name: 'Chặng 1 · Bao cấp (Tem phiếu)', snap: gameState.stageHistory[1] || { economy: 31, studentLife: 41 } },
    { name: 'Chặng 2 · Thị trường Thả nổi', snap: gameState.stageHistory[2] || { economy: 93, studentLife: 22 } },
    {
      name: 'Chặng 3 · Phố của bạn',
      snap: {
        economy: Math.round(gameState.metrics.economy),
        studentLife: Math.round(gameState.metrics.studentLife)
      }
    }
  ];
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'cmp-row';
    div.innerHTML = `
      <div class="cmp-label">
        <span>${r.name}</span>
        <span>📈 ${r.snap.economy} · 😊 ${r.snap.studentLife}</span>
      </div>
      <div class="cmp-tracks">
        <div class="bar-bg"><div class="bar-fill-econ" style="width:${r.snap.economy}%"></div></div>
        <div class="bar-bg"><div class="bar-fill-life" style="width:${r.snap.studentLife}%"></div></div>
      </div>
    `;
    el.compareBars.appendChild(div);
  }

  selectedCharId = CHARACTERISTICS[0].id;
  renderSummaryCharacteristics();

  el.peekControls.classList.add('hidden');
  el.summaryOverlay.classList.remove('hidden');
  audio.playSuccess();
}

function openReviewModal() {
  el.reviewBody.textContent = '';

  const s1 = document.createElement('div');
  s1.className = 'rev-sec';
  const h1 = document.createElement('h3');
  h1.textContent = '1. Khái niệm (3 ý cốt lõi)';
  s1.appendChild(h1);
  if (LESSON_NOTES.conceptHighlights) {
    const kwRow = document.createElement('div');
    kwRow.className = 'kw-pills';
    for (const kw of LESSON_NOTES.conceptHighlights) {
      const sp = document.createElement('span');
      sp.className = 'kw-pill';
      sp.textContent = kw;
      kwRow.appendChild(sp);
    }
    s1.appendChild(kwRow);
  }
  const p1 = document.createElement('p');
  renderHighlighted(p1, LESSON_NOTES.fullConcept);
  s1.appendChild(p1);
  el.reviewBody.appendChild(s1);

  const s2 = document.createElement('div');
  s2.className = 'rev-sec';
  const h2 = document.createElement('h3');
  h2.textContent = '2. Tính tất yếu khách quan';
  const ul2 = document.createElement('ul');
  for (const pt of LESSON_NOTES.inevitabilityPoints) {
    const li = document.createElement('li');
    const st = document.createElement('strong');
    st.textContent = `${pt.title}: `;
    li.appendChild(st);
    const sp = document.createElement('span');
    renderHighlighted(sp, pt.detail);
    li.appendChild(sp);
    ul2.appendChild(li);
  }
  s2.appendChild(h2);
  s2.appendChild(ul2);
  el.reviewBody.appendChild(s2);

  const s3 = document.createElement('div');
  s3.className = 'rev-sec';
  const h3 = document.createElement('h3');
  h3.textContent = '3. Năm đặc trưng qua Làng ĐH 3D';
  const ul3 = document.createElement('ul');
  for (const c of CHARACTERISTICS) {
    const li = document.createElement('li');
    const st = document.createElement('strong');
    st.textContent = `${c.order}. ${c.name}: `;
    li.appendChild(st);
    const sp = document.createElement('span');
    renderHighlighted(sp, c.campusExample.replace('**Làng ĐH 3D:** ', ''));
    li.appendChild(sp);
    ul3.appendChild(li);
  }
  s3.appendChild(h3);
  s3.appendChild(ul3);
  el.reviewBody.appendChild(s3);

  const s4 = document.createElement('div');
  s4.className = 'rev-sec';
  s4.style.background = '#fffbeb';
  s4.style.borderColor = '#fde68a';
  const h4 = document.createElement('h3');
  h4.textContent = '4. Chốt ý Phản biện Chương 5';
  const p4 = document.createElement('p');
  renderHighlighted(p4, LESSON_NOTES.discussionQuestion);
  s4.appendChild(h4);
  s4.appendChild(p4);
  el.reviewBody.appendChild(s4);

  el.reviewModal.classList.remove('hidden');
}

// Event bindings
el.btnStart.addEventListener('click', () => {
  audio.ensureContext();
  enterStage(1, true);
});

el.btnDemoSummary.addEventListener('click', () => {
  audio.ensureContext();
  showSummaryScreen(true);
});

for (const btn of el.jumpBtns) {
  btn.addEventListener('click', () => {
    audio.ensureContext();
    enterStage(parseInt(btn.getAttribute('data-jump-stage'), 10), true);
  });
}

el.btnStageModalOk.addEventListener('click', () => {
  audio.ensureContext();
  const prevKind = stageModalKind;
  stageModalKind = null;
  el.stageModal.classList.add('hidden');
  if (prevKind === 'stage-takeaway') {
    if (gameState.stageId < 3) {
      enterStage(gameState.stageId + 1, true);
    } else {
      showSummaryScreen(false);
    }
  }
});

el.btnServe.addEventListener('click', () => {
  audio.ensureContext();
  performCanteenServe();
});

el.btnNextS2.addEventListener('click', () => {
  audio.ensureContext();
  openStageModal('stage-takeaway');
});

el.btnS2Next.addEventListener('click', () => {
  audio.ensureContext();
  const prevPhase = gameState.stage2Phase;
  gameState.advanceStage2Phase();
  audio.playAlert();
  if (gameState.stage2Phase !== prevPhase) {
    announceStage2Wave(gameState.stage2Phase);
  }
  updateHud({ animateDelta: true });
});

el.btnNextS3.addEventListener('click', () => {
  audio.ensureContext();
  openStageModal('stage-takeaway');
});

el.btnFinishS3.addEventListener('click', () => {
  audio.ensureContext();
  showSummaryScreen(false);
});

el.btnCloseDrawer.addEventListener('click', () => closeDrawer());

function toggleTimeOfDay() {
  const next = scene3d.timeOfDay === 'sunset' ? 'day' : 'sunset';
  scene3d.setTimeOfDay(next);
  el.btnTimeToggle.textContent = next === 'sunset' ? '☀️' : '🌅';
  if (el.btnPeekSunset) {
    el.btnPeekSunset.textContent = next === 'sunset' ? '☀️ Ban ngày' : '🌅 Hoàng hôn';
  }
}

el.btnTimeToggle.addEventListener('click', toggleTimeOfDay);
el.btnPeekSunset.addEventListener('click', toggleTimeOfDay);

el.btnCamReset.addEventListener('click', () => {
  scene3d.setSelectedLot(null);
  scene3d.resetCamera();
});

el.btnMute.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  el.btnMute.textContent = audio.muted ? '🔇' : '🔊';
});

el.btnHome.addEventListener('click', () => {
  mode = 'intro';
  clearFxFloaters();
  closeDrawer();
  el.hudTop.classList.add('hidden');
  el.hudBottom.classList.add('hidden');
  el.stageModal.classList.add('hidden');
  el.eventModal.classList.add('hidden');
  el.summaryOverlay.classList.add('hidden');
  el.peekControls.classList.add('hidden');
  el.introOverlay.classList.remove('hidden');
  gameState.buildDemoCompleteState();
  scene3d.syncWithGameState(gameState);
  scene3d.setShowcaseOrbit(true);
});

el.btnPeek3d.addEventListener('click', () => {
  el.summaryOverlay.classList.add('hidden');
  el.peekControls.classList.remove('hidden');
  scene3d.setSelectedLot(null);
  scene3d.resetCamera();
  scene3d.setShowcaseOrbit(true);
});

el.btnReopenSummary.addEventListener('click', () => {
  el.peekControls.classList.add('hidden');
  el.summaryOverlay.classList.remove('hidden');
});

el.btnSummaryHome.addEventListener('click', () => el.btnHome.click());
el.btnOpenReview.addEventListener('click', openReviewModal);
el.btnCloseReview.addEventListener('click', () => el.reviewModal.classList.add('hidden'));
el.btnCloseReviewBottom.addEventListener('click', () => el.reviewModal.classList.add('hidden'));
el.btnReplayS3.addEventListener('click', () => enterStage(3, true));
el.btnReplayAll.addEventListener('click', () => enterStage(1, true));

const heldNavKeys = new Set();
const NAV_KEY_NAMES = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

window.addEventListener('blur', () => heldNavKeys.clear());

document.addEventListener('keyup', (ev) => {
  heldNavKeys.delete(ev.key.toLowerCase());
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    heldNavKeys.clear();
    if (!el.reviewModal.classList.contains('hidden')) {
      el.reviewModal.classList.add('hidden');
      return;
    }
    if (!el.lotDrawer.classList.contains('hidden')) {
      closeDrawer();
      return;
    }
    if (!el.stageModal.classList.contains('hidden')) {
      el.btnStageModalOk.click();
      return;
    }
    if (!el.peekControls.classList.contains('hidden')) {
      el.btnReopenSummary.click();
      return;
    }
    if (selectedLotId) {
      selectedLotId = null;
      scene3d.setSelectedLot(null);
      scene3d.resetCamera();
    }
    return;
  }

  if (ev.key === 'm' || ev.key === 'M') {
    el.btnMute.click();
    return;
  }
  if ((ev.key === 'r' || ev.key === 'R') && mode !== 'intro') {
    scene3d.setSelectedLot(null);
    scene3d.resetCamera();
    return;
  }
  if (mode === 'play' && gameState.stageId === 1 && ev.key === ' ' && stageModalKind === null) {
    ev.preventDefault();
    el.btnServe.click();
    return;
  }

  // Smooth WASD / Arrow / Q-E 3D camera exploration when no modal or tab-strip owns focus
  const activeTag = document.activeElement?.tagName;
  const inTabRole = document.activeElement?.getAttribute?.('role') === 'tab';
  const modalOpen =
    mode === 'intro' ||
    !el.stageModal.classList.contains('hidden') ||
    !el.eventModal.classList.contains('hidden') ||
    !el.reviewModal.classList.contains('hidden') ||
    !el.summaryOverlay.classList.contains('hidden');
  const k = ev.key.toLowerCase();
  if (!modalOpen && !inTabRole && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && NAV_KEY_NAMES.has(k)) {
    if (k.startsWith('arrow')) ev.preventDefault();
    heldNavKeys.add(k);
  }
});

// Animation Loop
let lastTs = null;
function tick(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
  lastTs = ts;

  if (mode === 'play' && stageModalKind === null && !gameState.pendingEvent) {
    if (gameState.stageId === 1) {
      gameState.stepStage1(dt);
      updateHud();
    } else if (gameState.stageId === 2) {
      const prevPhase = gameState.stage2Phase;
      gameState.stepStage2(dt);
      if (gameState.stage2Phase !== prevPhase) {
        announceStage2Wave(gameState.stage2Phase);
        updateHud({ animateDelta: true });
      }
    }
  }

  if (heldNavKeys.size > 0) {
    scene3d.setShowcaseOrbit(false);
    scene3d.applyKeyboardNav(heldNavKeys, dt);
  }
  scene3d.update(gameState, dt);
  updateProjectedPins();
  requestAnimationFrame(tick);
}

// Initial boot & URL presentation shortcuts
const params = new URLSearchParams(window.location.search);
const stageParam = params.get('stage');
const demoParam = params.get('demo');

if (demoParam === 'summary') {
  showSummaryScreen(true);
} else if (stageParam === '1' || stageParam === '2' || stageParam === '3') {
  enterStage(parseInt(stageParam, 10), true);
} else {
  // Show colorful completed 3D campus gently rotating behind Intro card
  gameState.buildDemoCompleteState();
  scene3d.syncWithGameState(gameState);
  scene3d.setShowcaseOrbit(true);
}

window.__campusApp = { gameState, scene3d, enterStage, showSummaryScreen, toggleTimeOfDay, updateHud };

requestAnimationFrame(tick);
