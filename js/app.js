import {
  APP_NAME,
  CATEGORIES,
  formatVnd,
  formatCountdown,
  renderProductSvg,
} from './catalog.js';
import {
  LiveShopStore,
  MILESTONE_FREESHIP_DIAMONDS,
  MILESTONE_EXTRA_DISCOUNT_DIAMONDS,
  buildAvatarInfo,
} from './store.js';
import { AudioManager } from './audio.js';
import { HostCanvasRenderer } from './host-canvas.js';

const params = new URLSearchParams(window.location.search || '');
const isCleanMode =
  params.get('clean') === '1' ||
  params.get('clean') === 'true' ||
  /[?&#]clean=(1|true)(?:[&#]|$)/i.test(window.location.href || '');
const liveUsername = (params.get('live') || '').trim().replace(/^@/, '');
const wsPortParam =
  params.get('wsPort') ||
  (typeof window !== 'undefined' && window.__HOST_WS_PORT__) ||
  '8080';

// Bản Pages dùng Ably thay WebSocket nội bộ: Ably mang trạng thái ghim,
// localStorage restore giữ nguyên; fetch('/api/pinned') bị vô hiệu hóa.
const USE_ABLY = true;

// DOM References
const el = {
  stage: document.getElementById('stage'),
  stageCanvas: document.getElementById('stageCanvas'),
  confettiCanvas: document.getElementById('confettiCanvas'),
  hostGestureBadge: document.getElementById('hostGestureBadge'),
  hostControls: document.getElementById('hostControls'),
  modeBadge: document.getElementById('modeBadge'),
  viewerCountValue: document.getElementById('viewerCountValue'),
  ordersCountValue: document.getElementById('ordersCountValue'),
  revenueValue: document.getElementById('revenueValue'),
  cartOpenBtn: document.getElementById('cartOpenBtn'),
  cartBadge: document.getElementById('cartBadge'),

  latestCommentContent: document.getElementById('latestCommentContent'),
  topGiftersList: document.getElementById('topGiftersList'),
  diamondsTotalBadge: document.getElementById('diamondsTotalBadge'),
  milestoneFill: document.getElementById('milestoneFill'),
  milestone10Label: document.getElementById('milestone10Label'),
  milestone50Label: document.getElementById('milestone50Label'),

  shoppingFeedList: document.getElementById('shoppingFeedList'),
  pendingQuestionsBadge: document.getElementById('pendingQuestionsBadge'),
  pendingQuestionsCount: document.getElementById('pendingQuestionsCount'),

  welcomePopupSlot: document.getElementById('welcomePopupSlot'),
  giftToast: document.getElementById('giftToast'),
  hostSpeechText: document.getElementById('hostSpeechText'),
  speechCheckingTag: document.getElementById('speechCheckingTag'),

  spotlightCard: document.getElementById('spotlightCard'),
  spotlightPinnedBanner: document.getElementById('spotlightPinnedBanner'),
  spotlightCodeBadge: document.getElementById('spotlightCodeBadge'),
  spotlightCategory: document.getElementById('spotlightCategory'),
  flashSaleTimer: document.getElementById('flashSaleTimer'),
  spotlightCartViewers: document.getElementById('spotlightCartViewers'),
  perkFreeshipBadge: document.getElementById('perkFreeshipBadge'),
  perkExtraBadge: document.getElementById('perkExtraBadge'),
  spotlightVisual: document.getElementById('spotlightVisual'),
  spotlightName: document.getElementById('spotlightName'),
  spotlightBenefit: document.getElementById('spotlightBenefit'),
  spotlightPrice: document.getElementById('spotlightPrice'),
  spotlightOrigPrice: document.getElementById('spotlightOrigPrice'),
  spotlightDiscount: document.getElementById('spotlightDiscount'),
  spotlightStockBadge: document.getElementById('spotlightStockBadge'),
  spotlightCodeHint: document.getElementById('spotlightCodeHint'),
  spotlightAddBtn: document.getElementById('spotlightAddBtn'),
  spotlightBuyNowBtn: document.getElementById('spotlightBuyNowBtn'),

  pausedBanner: document.getElementById('pausedBanner'),
  categoryTabs: document.getElementById('categoryTabs'),
  catalogGrid: document.getElementById('catalogGrid'),


  repeatSpeechBtn: document.getElementById('repeatSpeechBtn'),
  toggleTtsBtn: document.getElementById('toggleTtsBtn'),
  toggleBgmBtn: document.getElementById('toggleBgmBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  nextProductBtn: document.getElementById('nextProductBtn'),

  startOverlay: document.getElementById('startOverlay'),
  startBtn: document.getElementById('startBtn'),

  stockAlertToast: document.getElementById('stockAlertToast'),

  cartModal: document.getElementById('cartModal'),
  closeCartBtn: document.getElementById('closeCartBtn'),
  cartModalStockAlert: document.getElementById('cartModalStockAlert'),
  cartItemsList: document.getElementById('cartItemsList'),
  cartCatalogSavingsBanner: document.getElementById('cartCatalogSavingsBanner'),
  cartGiftRuleNote: document.getElementById('cartGiftRuleNote'),
  cartGiftDiscountRow: document.getElementById('cartGiftDiscountRow'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartDiscount: document.getElementById('cartDiscount'),
  cartShipping: document.getElementById('cartShipping'),
  cartTotal: document.getElementById('cartTotal'),
  cartFormulaHint: document.getElementById('cartFormulaHint'),
  proceedCheckoutBtn: document.getElementById('proceedCheckoutBtn'),

  checkoutModal: document.getElementById('checkoutModal'),
  closeCheckoutBtn: document.getElementById('closeCheckoutBtn'),
  checkoutOrderPreview: document.getElementById('checkoutOrderPreview'),
  checkoutForm: document.getElementById('checkoutForm'),
  customerName: document.getElementById('customerName'),
  customerPhone: document.getElementById('customerPhone'),
  customerAddress: document.getElementById('customerAddress'),
  checkoutError: document.getElementById('checkoutError'),

  orderSuccessModal: document.getElementById('orderSuccessModal'),
  orderSuccessDetails: document.getElementById('orderSuccessDetails'),
  closeSuccessBtn: document.getElementById('closeSuccessBtn'),
};

// Layer 4 (?clean=1): Enforce hiding #hostControls at runtime before & after start
function enforceCleanMode() {
  if (!isCleanMode) return;
  document.documentElement.classList.add('clean-mode');
  document.body.classList.add('clean-mode');
  if (el.hostControls) {
    el.hostControls.hidden = true;
    el.hostControls.setAttribute('aria-hidden', 'true');
    el.hostControls.style.setProperty('display', 'none', 'important');
    el.hostControls.style.setProperty('visibility', 'hidden', 'important');
    el.hostControls.style.setProperty('height', '0', 'important');
  }
}
enforceCleanMode();

// ─── Mở khóa âm thanh iOS (Cơ 27/11: iPhone live không nghe tiếng) ───
// iOS: giọng MC (speechSynthesis) đi qua kênh chuông nên công tắc im lặng
// bật là mất tiếng ngay tại nguồn; iOS còn đòi chạm vào trang 1 lần mới cho
// phát tiếng. audioSession 'playback' (iOS 17+) cho phát cả khi im lặng;
// lần chạm đầu tiên "mồi" TTS + mở AudioContext (xem audio.unlockIosAudio).
function setupIosAudioUnlock() {
  try {
    if (typeof audio !== 'undefined' && audio && typeof audio.unlockIosAudio === 'function') {
      audio.unlockIosAudio();
    }
  } catch (_) { /* audio chưa khởi tạo ở thời điểm này: lần chạm đầu sẽ mở */ }
  try {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    let unlocked = false;
    const onFirstGesture = () => {
      if (unlocked) return;
      unlocked = true;
      try {
        if (typeof audio !== 'undefined' && audio && typeof audio.unlockIosAudio === 'function') {
          audio.unlockIosAudio();
        }
      } catch (_) { /* bỏ qua */ }
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
    window.addEventListener('touchstart', onFirstGesture, { once: true, capture: true });
    window.addEventListener('click', onFirstGesture, { once: true, capture: true });
  } catch (_) { /* bỏ qua */ }
}

// Core engines
const store = new LiveShopStore();
const renderer = new HostCanvasRenderer(el.stageCanvas, el.confettiCanvas, el.hostGestureBadge);
const audio = new AudioManager({
  onSpeakStateChange: (speaking) => {
    renderer.setSpeaking(speaking);
  },
  onSpeechComplete: () => {
    // Once current product pitch finishes, flush any waiting grouped viewers cleanly
    if (started && !paused && store.pendingJoins.length > 0 && !joinBatchTimer) {
      tryFlushViewerWelcomes();
    }
  },
});

setupIosAudioUnlock(); // Mở khóa âm thanh iOS (Cơ 27/11).

let started = false;
let paused = false;
let mainTickTimer = null;
let pitchTickCounter = 0;
let giftToastTimer = null;
let checkRevealTimer = null;
let wsClient = null;

// Burst viewer join batching & synchronized popup queue (Bug 4 fix!)
const JOIN_BATCH_WINDOW_MS = 1600;
const WELCOME_POPUP_DURATION_MS = 4200;
let joinBatchTimer = null;
const welcomePopupQueue = [];
let activeWelcomePopup = null;
let welcomeDismissTimer = null;

function scaleStageToViewport() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / 1080, vh / 1920, 1);
  el.stage.style.transform = scale < 0.999 ? `scale(${scale})` : 'none';
}

window.addEventListener('resize', scaleStageToViewport);
scaleStageToViewport();

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setHostBubble(text, { checking = false } = {}) {
  el.hostSpeechText.textContent = text;
  if (checking) {
    el.speechCheckingTag.classList.remove('hidden');
  } else {
    el.speechCheckingTag.classList.add('hidden');
  }
}

function bumpCartBadge() {
  el.cartOpenBtn.classList.remove('bump');
  void el.cartOpenBtn.offsetWidth;
  el.cartOpenBtn.classList.add('bump');
}

function showGiftToast(text) {
  el.giftToast.textContent = text;
  el.giftToast.classList.remove('hidden');
  clearTimeout(giftToastTimer);
  giftToastTimer = setTimeout(() => {
    el.giftToast.classList.add('hidden');
  }, 3600);
}

let stockAlertTimer = null;
function showStockAlert(reason, product) {
  if (reason !== 'MAX_STOCK_REACHED' && reason !== 'OUT_OF_STOCK') return;
  const label = product ? `${product.codeLabel} ${product.name}` : 'Sản phẩm này';
  const msg =
    reason === 'MAX_STOCK_REACHED' && product
      ? `🚫 Hết hàng! Giỏ đã đạt tối đa ${product.stock}/${product.stock} ${label} trong kho.`
      : `🚫 Hết hàng! ${label} đã hết hàng trong kho.`;

  if (el.stockAlertToast) {
    el.stockAlertToast.textContent = msg;
    el.stockAlertToast.classList.remove('hidden');
  }
  if (el.cartModalStockAlert && !el.cartModal.classList.contains('hidden')) {
    el.cartModalStockAlert.textContent = msg;
    el.cartModalStockAlert.classList.remove('hidden');
  }
  clearTimeout(stockAlertTimer);
  stockAlertTimer = setTimeout(() => {
    el.stockAlertToast?.classList.add('hidden');
    el.cartModalStockAlert?.classList.add('hidden');
  }, 3400);
}

// =========================================================================
// WELCOME POPUP QUEUE + BURST BATCHING (100% SYNCED POPUP <-> SPEECH <-> WAVE)
// =========================================================================
function enqueueWelcomePopup(welcomeRecord) {
  welcomePopupQueue.push(welcomeRecord);
  if (!activeWelcomePopup) {
    showNextWelcomePopup();
  }
}

function buildAvatarHtml(member) {
  const safeName = escapeHtml(member.username);
  if (member.avatarUrl) {
    return `<span class="welcome-avatar" style="background:${member.color}" title="${safeName}">
      <img src="${escapeHtml(member.avatarUrl)}" alt="${safeName}" onerror="this.remove();this.parentNode.textContent='${escapeHtml(member.initials)}'" />
    </span>`;
  }
  return `<span class="welcome-avatar" style="background:${member.color}" title="${safeName}">${escapeHtml(member.initials)}</span>`;
}

/**
 * SINGLE synchronization point for viewer welcomes:
 * Shows popup, updates host speech bubble, triggers 2D 'wave' animation, and speaks TTS
 * for the EXACT same member(s) at the EXACT same moment (eliminates 1-beat lag!).
 */
function showNextWelcomePopup() {
  if (welcomePopupQueue.length === 0) {
    activeWelcomePopup = null;
    el.welcomePopupSlot.innerHTML = '';
    return;
  }

  const record = welcomePopupQueue.shift();
  activeWelcomePopup = record;

  const avatarsHtml = record.popupMembers.map(buildAvatarHtml).join('');
  const extraHtml =
    record.extraCount > 0
      ? `<span class="welcome-avatar welcome-avatar-extra">+${record.extraCount}</span>`
      : '';

  el.welcomePopupSlot.innerHTML = `
    <div class="welcome-popup" data-welcome-id="${escapeHtml(record.id)}">
      <div class="welcome-avatar-stack">${avatarsHtml}${extraHtml}</div>
      <span class="welcome-popup-text">${escapeHtml(record.popupText)}</span>
    </div>
  `;

  // Sync latest comment banner, host speech bubble, wave animation & TTS to THIS exact popup!
  store.latestComment = {
    username:
      record.total === 1
        ? record.members[0].username
        : `${record.members[0].username} +${record.total - 1}`,
    text: record.feedText,
    isWelcome: true,
    timestamp: Date.now(),
  };
  store.hostSpeech = record.speech;
  renderLatestComment();
  setHostBubble(record.speech);
  pitchTickCounter = 0;
  renderer.triggerGesture('wave', 3000);
  audio.playSfx('join');
  if (started && !paused) {
    audio.speak(record.speech, { interrupt: false, isWelcome: true });
  }

  clearTimeout(welcomeDismissTimer);
  welcomeDismissTimer = setTimeout(() => {
    const popupEl = el.welcomePopupSlot.querySelector('.welcome-popup');
    if (popupEl) {
      popupEl.classList.add('exiting');
    }
    setTimeout(() => {
      activeWelcomePopup = null;
      showNextWelcomePopup();
    }, 340);
  }, WELCOME_POPUP_DURATION_MS);
}

function tryFlushViewerWelcomes({ force = false } = {}) {
  if (joinBatchTimer) {
    clearTimeout(joinBatchTimer);
    joinBatchTimer = null;
  }
  if (!force && audio.isSpeaking) return null;
  const welcome = store.flushViewerWelcomes(Date.now(), { force });
  if (!welcome) return null;

  renderHeader();
  // Popup queue handles speech bubble + wave + TTS in strict sync when this popup is displayed!
  enqueueWelcomePopup(welcome);
  return welcome;
}

function scheduleJoinBatchFlush() {
  if (joinBatchTimer) clearTimeout(joinBatchTimer);
  // If 3+ viewers have already burst in, flush promptly after a brief 220ms settle;
  // otherwise wait JOIN_BATCH_WINDOW_MS (1.6s) to aggregate burst arrivals into 1 grouped popup!
  const delay = store.pendingJoins.length >= 3 ? 220 : JOIN_BATCH_WINDOW_MS;
  joinBatchTimer = setTimeout(() => {
    joinBatchTimer = null;
    if (!started || paused) return;
    if (!audio.isSpeaking) {
      tryFlushViewerWelcomes({ force: store.pendingJoins.length >= 2 });
    }
  }, delay);
}

function handleViewerJoin(username, avatarUrl = '') {
  const entry = store.enqueueViewerJoin(username, avatarUrl, Date.now());
  if (!entry) return null;
  renderHeader();
  if (started && !paused) {
    scheduleJoinBatchFlush();
  }
  return entry;
}

// =========================================================================
// COMMENT, GIFT & SHOPPING ACTIVITY HANDLERS
// =========================================================================
function handleComment(username, text, options = {}) {
  const result = store.receiveComment(username, text, options);
  if (!result) return null;
  pitchTickCounter = 0;

  renderLatestComment();
  renderShoppingFeed();
  renderSpotlight();
  updateCatalogBadgesInPlace();
  renderHeader();

  if (result.intent === 'BUY') {
    if (result.addedToCart) {
      bumpCartBadge();
      audio.playSfx('cart');
      renderer.spawnFloatingHearts(5, '#f43f5e');
    }
    // Event-driven 2D animation: viewer "chốt mã XX" -> cart_confirm gesture + approving nod!
    renderer.triggerGesture('cart_confirm', 2800);
  } else if (
    result.intent === 'PRICE' ||
    result.intent === 'VARIANT' ||
    result.intent === 'MATERIAL' ||
    result.intent === 'SHIPPING' ||
    result.intent === 'STOCK' ||
    result.intent === 'UNKNOWN_INFO' ||
    result.intent === 'UNLISTED_PRODUCT'
  ) {
    // Event-driven 2D animation: answering product inquiry -> ok_answer nod + OK hand!
    renderer.triggerGesture('ok_answer', 3000);
  } else {
    renderer.triggerGesture('point', 2400);
  }

  clearTimeout(checkRevealTimer);
  if (result.checkingText && result.intent !== 'BUY') {
    setHostBubble(result.checkingText, { checking: true });
    checkRevealTimer = setTimeout(() => {
      setHostBubble(result.reply, { checking: false });
      if (started && !paused) {
        audio.speak(result.reply, { interrupt: true });
      }
    }, 480);
  } else {
    setHostBubble(result.reply, { checking: false });
    if (started && !paused) {
      audio.speak(result.reply, { interrupt: true });
    }
  }

  return result;
}

function handleGift(username, giftName = 'Hoa hồng', diamonds = 10) {
  pitchTickCounter = 0;
  const res = store.receiveGift(username, giftName, diamonds);
  renderTopGifters();
  renderSpotlight();
  renderCatalog();
  renderCartModal();

  setHostBubble(res.speech);
  showGiftToast(`🎁 ${res.gift.username} tặng ${res.gift.giftName} (+${res.gift.diamonds}💎)`);
  // Event-driven 2D animation: gift received -> joyful hop, happy ^ ^ eyes, golden hearts/stars!
  renderer.triggerGesture('celebrate_gift', 3200);
  renderer.spawnFloatingHearts(10, '#f59e0b');
  audio.playSfx('gift');
  if (started && !paused) {
    audio.speak(res.speech, { interrupt: true });
  }
  return res;
}

function handleShoppingActivity(activity) {
  const res = store.recordShoppingActivity(activity, Date.now());
  renderShoppingFeed();
  renderSpotlight();
  updateCatalogBadgesInPlace();

  if (res.urgencySpeech && started && !paused && !audio.isSpeaking) {
    setHostBubble(res.urgencySpeech);
    renderer.triggerGesture('point', 2600);
    audio.speak(res.urgencySpeech, { interrupt: false });
  }
  return res;
}

function renderPinnedFallbackSvg(size = 185) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="80" cy="82" r="64" fill="#FEF3C7"/>
    <path d="M56 62 C56 40, 104 40, 104 62" stroke="#B45309" stroke-width="6" stroke-linecap="round"/>
    <rect x="42" y="60" width="76" height="68" rx="14" fill="#FFFBEB" stroke="#D97706" stroke-width="3.5"/>
    <circle cx="80" cy="92" r="18" fill="#FDE68A" stroke="#D97706" stroke-width="2.5"/>
    <path d="M80 81 L86 90 L80 105 L74 90 Z" fill="#E11D48"/>
    <circle cx="80" cy="84" r="4" fill="#FFF1F2"/>
  </svg>`;
}

const PINNED_STORAGE_KEY = 'host_ban_hang_last_pinned_v1';

function serializePinnedPayload(pinned) {
  if (!pinned) return null;
  return {
    title: pinned.title,
    price: pinned.priceText || pinned.price,
    openUrl: pinned.openUrl || '',
    imageUrl: pinned.imageUrl || '',
    productId: pinned.productId || '',
    liveProductNumber: Number(pinned.liveProductNumber || 0),
    actionType: Number(pinned.actionType || 0),
    source: pinned.source || 'tiktok_oec',
    timestamp: Number(pinned.timestamp) || Date.now(),
  };
}

function savePinnedToStorage(pinned) {
  try {
    const data = serializePinnedPayload(pinned);
    if (!data) return;
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function loadPinnedFromStorage() {
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.title || !(parsed.price || parsed.priceText)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPinnedFromStorage() {
  try {
    window.localStorage.removeItem(PINNED_STORAGE_KEY);
  } catch {}
}

function isSamePinnedPayload(a, b) {
  if (!a || !b) return false;
  const priceA = String(a.priceText ?? a.price ?? '').trim();
  const priceB = String(b.priceText ?? b.price ?? '').trim();
  return String(a.title || '').trim() === String(b.title || '').trim() && priceA === priceB;
}

function syncPinnedToServer(pinned) {
  const payload = serializePinnedPayload(pinned);
  if (!payload) return;
  try {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify({ type: 'pin_product', ...payload }));
    }
  } catch {}
  if (!USE_ABLY) {
    try {
      fetch('/api/pinned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
}

function syncClearPinnedToServer() {
  try {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify({ type: 'clear_pinned_product' }));
    }
  } catch {}
  if (!USE_ABLY) {
    try {
      fetch('/api/pinned', { method: 'DELETE', keepalive: true }).catch(() => {});
    } catch {}
  }
}

function clearPinnedState({ syncServer = true } = {}) {
  store.clearPinnedProduct();
  clearPinnedFromStorage();
  if (syncServer) {
    syncClearPinnedToServer();
  }
  renderSpotlight();
  renderCatalog();
}

function handlePinnedProduct(payload, options = {}) {
  const { syncServer = true, saveStorage = true, speak = true } = options;
  const res = store.receivePinnedProduct(payload);
  if (!res.ok) return res;

  if (saveStorage) {
    savePinnedToStorage(res.pinned);
  }
  if (syncServer) {
    syncPinnedToServer(res.pinned);
  }

  renderSpotlight();
  renderCatalog();
  renderCartModal();
  setHostBubble(res.speech);
  if (speak) {
    renderer.triggerGesture('point', 3400);
    if (started && !paused) {
      audio.speak(res.speech, { interrupt: true });
    }
  }
  return res;
}

function restorePinnedFromStorage() {
  const saved = loadPinnedFromStorage();
  if (!saved) return false;
  const res = handlePinnedProduct(saved, { syncServer: false, saveStorage: false, speak: false });
  return Boolean(res && res.ok);
}

// =========================================================================
// RENDERERS
// =========================================================================
function renderHeader() {
  el.viewerCountValue.textContent = store.viewerCount.toLocaleString('vi-VN');
  el.ordersCountValue.textContent = String(store.ordersCount);
  el.revenueValue.textContent = formatVnd(store.totalRevenue);
  el.cartBadge.textContent = String(store.getCartItemCount());
}

function renderLatestComment() {
  const c = store.latestComment;
  if (!c) return;
  const av = buildAvatarInfo(c.username);
  el.latestCommentContent.innerHTML = `
    <span class="comment-avatar" style="background:${av.color}">${escapeHtml(av.initials)}</span>
    <div class="comment-text-wrap">
      <strong class="comment-user">${escapeHtml(c.username)}</strong>
      <span class="comment-text">${escapeHtml(c.text)}</span>
    </div>
  `;
}

function renderTopGifters() {
  el.diamondsTotalBadge.textContent = `${store.sessionDiamonds}💎`;
  const pct = Math.min(100, Math.round((store.sessionDiamonds / MILESTONE_EXTRA_DISCOUNT_DIAMONDS) * 100));
  el.milestoneFill.style.width = `${pct}%`;

  // Single source of truth for freeship & extra -5% active-product discount labels!
  const freeOk = store.isFreeshipUnlocked();
  const extraOk = store.isExtraDiscountUnlocked();
  el.milestone10Label.classList.toggle('unlocked', freeOk);
  el.milestone10Label.textContent = freeOk ? '✓ 10💎 Freeship' : `${MILESTONE_FREESHIP_DIAMONDS}💎 Freeship`;
  el.milestone50Label.classList.toggle('unlocked', extraOk);
  el.milestone50Label.textContent = extraOk
    ? '✓ 50💎 −5% món đang giới thiệu'
    : `${MILESTONE_EXTRA_DISCOUNT_DIAMONDS}💎 −5% món đang giới thiệu`;

  const top = store.getTopGifters(3);
  if (top.length === 0) {
    el.topGiftersList.innerHTML = `<span class="gifter-empty">Chưa có quà — Tặng 10💎 mở Freeship!</span>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  el.topGiftersList.innerHTML = top
    .map(
      (g, i) =>
        `<span class="gifter-chip">${medals[i] || '💎'} ${escapeHtml(g.username)} <strong>${g.diamonds}💎</strong></span>`
    )
    .join('');
}

function renderShoppingFeed() {
  const items = store.getShoppingFeed(2);
  if (items.length === 0) {
    el.shoppingFeedList.innerHTML = `<span class="activity-item">Chưa có hoạt động mua sắm</span>`;
  } else {
    el.shoppingFeedList.innerHTML = items
      .map((a) => `<span class="activity-item" data-activity-type="${escapeHtml(a.type)}">${escapeHtml(a.text)}</span>`)
      .join('');
  }

  const pqCount = store.pendingQuestions.length;
  el.pendingQuestionsCount.textContent = String(pqCount);
  el.pendingQuestionsBadge.classList.toggle('hidden', pqCount === 0);
}

function renderSpotlight() {
  const pinned = store.pinnedProduct;
  const product = store.getActiveProduct();

  // Case 1: TikTok pinned product that is NOT in catalogue -> show exact TikTok title + price, NEVER fabricate code/stock/discount!
  if (pinned && !pinned.matched) {
    el.spotlightCard.classList.add('is-pinned', 'is-pinned-uncataloged');
    if (el.spotlightPinnedBanner) {
      el.spotlightPinnedBanner.className = 'spotlight-pinned-banner pinned-uncataloged';
      el.spotlightPinnedBanner.textContent = '📌 Món TikTok đang ghim, chưa có trong catalogue';
    }
    el.spotlightCodeBadge.textContent = '📌 TikTok';
    el.spotlightCategory.textContent = 'Ngoài catalogue';
    el.flashSaleTimer.textContent = formatCountdown(store.flashSaleRemainingSec);

    el.spotlightCartViewers.classList.add('hidden');
    el.perkFreeshipBadge.classList.add('hidden');
    el.perkExtraBadge.classList.add('hidden');

    el.spotlightVisual.style.background = '#fffbeb';
    el.spotlightVisual.innerHTML = renderPinnedFallbackSvg(185);

    el.spotlightName.textContent = pinned.title;
    el.spotlightBenefit.textContent =
      'Món TikTok đang ghim, chưa có trong catalogue — chỉ hiển thị đúng tên và giá đọc từ TikTok.';
    el.spotlightPrice.textContent = pinned.priceText;
    el.spotlightOrigPrice.classList.add('hidden');
    el.spotlightDiscount.classList.add('hidden');

    el.spotlightStockBadge.className = 'stock-badge';
    el.spotlightStockBadge.textContent = 'Chưa có trong catalogue';
    el.spotlightCodeHint.textContent = 'Xem trên giỏ TikTok';

    el.spotlightAddBtn.disabled = true;
    el.spotlightAddBtn.textContent = 'Chưa có trong catalogue';
    el.spotlightBuyNowBtn.disabled = true;
    el.spotlightBuyNowBtn.textContent = '📌 Ngoài catalogue';

    // Hide and disable quick buy chip so it NEVER keeps a stale "Chốt mã XX!" or adds another item
    return;
  }

  if (!product) return;

  // Restore standard catalogue controls & visibility
  el.spotlightCartViewers.classList.remove('hidden');
  el.spotlightOrigPrice.classList.remove('hidden');
  el.spotlightDiscount.classList.remove('hidden');
  el.spotlightAddBtn.textContent = '➕ Thêm vào giỏ';
  el.spotlightBuyNowBtn.textContent = '⚡ Mua ngay';

  // Case 2: TikTok pinned product fuzzy-matched a catalogue product -> show pinned banner + real Mã XX / price / stock!
  const isMatchedPinned = Boolean(pinned && pinned.matched && pinned.matchedProductId === product.id);
  el.spotlightCard.classList.toggle('is-pinned', isMatchedPinned);
  el.spotlightCard.classList.remove('is-pinned-uncataloged');
  if (el.spotlightPinnedBanner) {
    if (isMatchedPinned) {
      el.spotlightPinnedBanner.className = 'spotlight-pinned-banner pinned-matched';
      el.spotlightPinnedBanner.textContent = `📌 Đang ghim trên TikTok · Khớp ${product.codeLabel} · Giá TikTok: ${pinned.priceText}`;
    } else {
      el.spotlightPinnedBanner.className = 'spotlight-pinned-banner hidden';
      el.spotlightPinnedBanner.textContent = '';
    }
  }

  const effectivePrice = store.getEffectiveUnitPrice(product.id);
  const soldOut = product.stock <= 0;
  const freeUnlocked = store.isFreeshipUnlocked();
  const extraUnlocked = store.isExtraDiscountUnlocked();

  el.spotlightCodeBadge.textContent = product.codeLabel;
  el.spotlightCategory.textContent = product.category;
  el.flashSaleTimer.textContent = formatCountdown(store.flashSaleRemainingSec);

  el.spotlightCartViewers.textContent = `👀 ${product.cartViewers} người đang xem giỏ`;
  el.spotlightCartViewers.classList.toggle('hot', product.cartViewers >= store.urgencyThreshold);

  el.perkFreeshipBadge.classList.toggle('hidden', !freeUnlocked);
  el.perkExtraBadge.classList.toggle('hidden', !extraUnlocked);

  el.spotlightVisual.style.background = product.bgTint;
  el.spotlightVisual.innerHTML = renderProductSvg(product.id, 200);

  el.spotlightName.textContent = product.name;
  el.spotlightBenefit.textContent = product.benefit;
  el.spotlightPrice.textContent = formatVnd(effectivePrice);
  el.spotlightOrigPrice.textContent = formatVnd(product.originalPrice);
  el.spotlightDiscount.textContent = extraUnlocked
    ? `-${product.discountPercent}% +5%`
    : `-${product.discountPercent}%`;

  el.spotlightStockBadge.className = 'stock-badge';
  if (soldOut) {
    el.spotlightStockBadge.classList.add('out');
    el.spotlightStockBadge.textContent = 'Hết hàng';
  } else if (product.stock <= 5) {
    el.spotlightStockBadge.classList.add('low');
    el.spotlightStockBadge.textContent = `Chỉ còn ${product.stock} sản phẩm`;
  } else {
    el.spotlightStockBadge.textContent = `Còn ${product.stock} sản phẩm`;
  }

  el.spotlightCodeHint.textContent = `Gõ "chốt mã ${product.code}"`;
  el.spotlightAddBtn.disabled = soldOut;
  el.spotlightBuyNowBtn.disabled = soldOut;

}

function renderCategoryTabs() {
  const allTabs = ['Tất cả', ...CATEGORIES];
  el.categoryTabs.innerHTML = allTabs
    .map((cat) => {
      const count = cat === 'Tất cả' ? store.products.length : store.products.filter((p) => p.category === cat).length;
      const active = store.selectedCategory === cat ? 'active' : '';
      return `<button type="button" class="cat-tab ${active}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)} (${count})</button>`;
    })
    .join('');
}

function renderCatalog() {
  const active = store.getActiveProduct();
  const list = store.getFilteredProducts();
  el.catalogGrid.innerHTML = list
    .map((p) => {
      const isCurrent = active && active.id === p.id;
      const soldOut = p.stock <= 0;
      const price = store.getEffectiveUnitPrice(p.id);
      return `
        <div class="catalog-card ${isCurrent ? 'active-item' : ''} ${soldOut ? 'sold-out' : ''}" data-product-id="${p.id}" data-product-code="${p.code}">
          <div class="catalog-card-top">
            <span class="code-badge catalog-code-badge">${escapeHtml(p.codeLabel)}</span>
            <span class="catalog-viewers-mini" data-viewers-for="${p.id}">👀 ${p.cartViewers} xem giỏ</span>
          </div>
          <div class="catalog-card-body">
            <div class="catalog-thumb" style="background:${p.bgTint}">
              ${renderProductSvg(p.id, 66)}
            </div>
            <div class="catalog-meta">
              <div class="catalog-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
              <div class="catalog-price-line">
                <span class="catalog-price">${formatVnd(price)}</span>
                <span class="catalog-disc">-${p.discountPercent}%</span>
              </div>
              <div class="catalog-stock-line ${soldOut ? 'sold-out-text' : ''}">
                ${soldOut ? 'Hết hàng' : `Còn ${p.stock} · ${escapeHtml(p.category)}`}
              </div>
            </div>
          </div>
          <div class="catalog-card-actions">
            <button type="button" class="card-add-btn" data-add-id="${p.id}" ${soldOut ? 'disabled' : ''}>
              ${soldOut ? 'Hết hàng' : '➕ Thêm giỏ'}
            </button>
            <button type="button" class="card-focus-btn" data-focus-id="${p.id}" title="Giới thiệu món này">🎤</button>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Update cart-viewer counts on catalog cards IN PLACE (without replacing innerHTML)
 * so rapid clicking "➕ Thêm giỏ" 10 times in a row never misses a click!
 */
function updateCatalogBadgesInPlace() {
  for (const p of store.products) {
    const badge = el.catalogGrid.querySelector(`[data-viewers-for="${p.id}"]`);
    if (badge) {
      badge.textContent = `👀 ${p.cartViewers} xem giỏ`;
    }
  }
}

function renderCartModal() {
  const totals = store.getCartTotals();
  const active = store.getActiveProduct();
  const extraUnlocked = store.isExtraDiscountUnlocked();

  if (totals.items.length === 0) {
    el.cartItemsList.innerHTML = `<div class="cart-empty">Giỏ hàng đang trống — bấm vào sản phẩm hoặc gõ "chốt mã 01" để thêm nhé!</div>`;
  } else {
    el.cartItemsList.innerHTML = totals.items
      .map(
        (item) => `
      <div class="cart-row" data-cart-id="${item.productId}">
        <div class="cart-row-left">
          <div class="catalog-thumb" style="background:${item.product.bgTint}">
            ${renderProductSvg(item.productId, 60)}
          </div>
          <div class="cart-row-info">
            <h3>
              <span class="code-badge cart-code-pill">${escapeHtml(item.codeLabel)}</span>
              <span>${escapeHtml(item.product.name)}</span>
            </h3>
            <div class="cart-row-price">
              ${formatVnd(item.basePrice)} × ${item.qty} = <strong>${formatVnd(item.basePrice * item.qty)}</strong>
              ${item.extraDiscountPerUnit > 0 ? '<span class="perk-badge perk-extra">💎 −5% món đang giới thiệu</span>' : ''}
            </div>
          </div>
        </div>
        <div class="cart-qty-ctrl">
          <button type="button" class="qty-btn" data-qty-id="${item.productId}" data-delta="-1" aria-label="Giảm số lượng">−</button>
          <span class="qty-val">${item.qty}</span>
          <button type="button" class="qty-btn" data-qty-id="${item.productId}" data-delta="1" aria-label="Tăng số lượng">+</button>
          <button type="button" class="remove-btn" data-remove-id="${item.productId}" aria-label="Xóa sản phẩm">🗑️</button>
        </div>
      </div>
    `
      )
      .join('');
  }

  // "Đã giảm ... so với giá gốc" shown OUTSIDE the payment calculation table
  if (totals.catalogDiscount > 0) {
    el.cartCatalogSavingsBanner.textContent = `✨ Đã giảm ${formatVnd(totals.catalogDiscount)} so với giá gốc (${formatVnd(totals.originalTotal)})`;
    el.cartCatalogSavingsBanner.classList.remove('hidden');
  } else {
    el.cartCatalogSavingsBanner.classList.add('hidden');
  }

  // Bug 3 fix: Show 50💎 −5% row ONLY when active spotlight item is in cart (never misleading 0đ!).
  // When 50💎 is unlocked but cart does NOT contain the active spotlight item, show clear rule note.
  if (totals.giftExtraDiscount > 0) {
    el.cartGiftDiscountRow.classList.remove('hidden');
    el.cartDiscount.textContent = `-${formatVnd(totals.giftExtraDiscount)}`;
    el.cartGiftRuleNote.classList.add('hidden');
  } else {
    el.cartGiftDiscountRow.classList.add('hidden');
    el.cartDiscount.textContent = '-0đ';
    if (extraUnlocked && totals.items.length > 0 && active) {
      el.cartGiftRuleNote.textContent = `ℹ️ Ưu đãi 50💎 (−5% món đang giới thiệu) áp dụng riêng cho ${active.codeLabel} ${active.name} đang lên sóng — giỏ hiện chưa có món này.`;
      el.cartGiftRuleNote.classList.remove('hidden');
    } else {
      el.cartGiftRuleNote.classList.add('hidden');
    }
  }

  // Exact arithmetic inside payment table
  el.cartSubtotal.textContent = formatVnd(totals.baseSubtotal);
  el.cartShipping.textContent =
    totals.items.length === 0
      ? '0đ'
      : totals.freeshipApplied
        ? '0đ (Freeship 10💎)'
        : formatVnd(totals.shippingFee);
  el.cartTotal.textContent = formatVnd(totals.total);
  if (totals.items.length === 0) {
    el.cartFormulaHint.textContent = 'Tổng = Tiền hàng + Phí vận chuyển';
  } else if (totals.giftExtraDiscount > 0) {
    el.cartFormulaHint.textContent = `= ${formatVnd(totals.baseSubtotal)} + ${formatVnd(totals.shippingFee)} − ${formatVnd(totals.giftExtraDiscount)}`;
  } else {
    el.cartFormulaHint.textContent = `= ${formatVnd(totals.baseSubtotal)} + ${formatVnd(totals.shippingFee)}`;
  }
  el.proceedCheckoutBtn.disabled = totals.items.length === 0;
}

function renderCheckoutPreview(snapshot) {
  const source = snapshot || store.checkoutSnapshot || store.getCartTotals();
  const active = store.getActiveProduct();
  const lines = source.items
    .map(
      (i) =>
        `<div><strong>${escapeHtml(i.codeLabel)} ${escapeHtml(i.name || i.product?.name)}</strong> × ${i.qty} — ${formatVnd(i.basePrice * i.qty)}</div>`
    )
    .join('');
  const shipLabel = source.freeshipApplied ? '0đ (Freeship 10💎)' : formatVnd(source.shippingFee);
  const giftLine =
    source.giftExtraDiscount > 0
      ? `<div class="checkout-gift-discount">Giảm thêm mốc quà 50💎 (−5% món đang giới thiệu): <strong style="color:#059669">-${formatVnd(source.giftExtraDiscount)}</strong></div>`
      : store.isExtraDiscountUnlocked() && active
        ? `<div class="checkout-gift-rule" style="color:#92400e;font-size:15px">ℹ️ Mốc 50💎 (−5% món đang giới thiệu) áp dụng riêng cho ${escapeHtml(active.codeLabel)} ${escapeHtml(active.name)}.</div>`
        : '';
  const catalogSavingsNote =
    source.catalogDiscount > 0
      ? `<div style="color:#065f46;font-size:15px;margin-top:4px">✨ Đã giảm ${formatVnd(source.catalogDiscount)} so với giá gốc</div>`
      : '';
  el.checkoutOrderPreview.innerHTML = `
    ${lines}
    <div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(0,0,0,0.12)">
      <div>Tiền hàng: <strong>${formatVnd(source.baseSubtotal)}</strong> · Phí ship: <strong>${shipLabel}</strong></div>
      ${giftLine}
      <div>Tổng thanh toán: <strong style="color:#e11d48">${formatVnd(source.total)}</strong></div>
      ${catalogSavingsNote}
    </div>
  `;
}

function openCheckoutModal() {
  const snapshot = store.beginCheckoutSnapshot();
  if (!snapshot) return false;
  renderCheckoutPreview(snapshot);
  el.checkoutError.classList.add('hidden');
  el.checkoutModal.classList.remove('hidden');
  return true;
}

function closeCheckoutModal() {
  store.cancelCheckoutSnapshot();
  el.checkoutModal.classList.add('hidden');
}

function renderAll() {
  renderHeader();
  renderLatestComment();
  renderTopGifters();
  renderShoppingFeed();
  renderSpotlight();
  renderCategoryTabs();
  renderCatalog();
  renderCartModal();
}

// =========================================================================
// LIVE SESSION LOOP + DEMO BOT + WEBSOCKET TIKTOK LIVE CONNECTOR
// =========================================================================
function startLiveSession() {
  if (started) return;
  started = true;
  el.startOverlay.classList.add('hidden');
  enforceCleanMode();
  audio.ensureContext();
  audio.startBgm();

  const openingSpeech = store.pinnedProduct
    ? store.hostSpeech || store.generateHostPitch(0)
    : store.generateHostPitch(0);
  renderSpotlight();
  renderCatalog();
  setHostBubble(openingSpeech);
  // Event-driven 2D animation: introducing active/pinned item -> point to spotlight product!
  renderer.triggerGesture('point', 3200);
  audio.speak(openingSpeech, { interrupt: true });

  mainTickTimer = setInterval(() => {
    if (paused) return;

    const hadPinned = Boolean(store.pinnedProduct);
    const tick = store.tickFlashSale(1);
    renderSpotlight();
    if (tick.advanced) {
      if (hadPinned && !store.pinnedProduct) {
        clearPinnedFromStorage();
        syncClearPinnedToServer();
      }
      renderCatalog();
      setHostBubble(tick.speech);
      renderer.triggerGesture('point', 3200);
      audio.speak(tick.speech, { interrupt: true });
      pitchTickCounter = 0;
      return;
    }

    // Flush pending viewer joins once batch timer elapsed and host finished speaking
    if (!audio.isSpeaking && store.pendingJoins.length > 0 && !joinBatchTimer) {
      tryFlushViewerWelcomes();
    }

    // Continuous product presentation every ~14s
    pitchTickCounter += 1;
    if (pitchTickCounter >= 14 && !audio.isSpeaking) {
      pitchTickCounter = 0;
      const pitch = store.generateHostPitch();
      setHostBubble(pitch);
      renderer.triggerGesture('point', 3000);
      audio.speak(pitch, { interrupt: false });
    }
  }, 1000);

  // Ably đã nối từ lúc tải trang (xem connectAbly ở cuối file); event tới
  // trước khi bấm Bắt đầu được đệm lại và phát ngay khi bắt đầu.
  flushPendingAblyEvents();
  // Không có ?live= thì không chạy bot thay thế — chỉ hiện trạng thái chờ live.
}

function togglePause() {
  if (!started) return;
  paused = !paused;
  audio.setPaused(paused);
  renderer.setPaused(paused);
  el.pausedBanner.classList.toggle('hidden', !paused);
  el.pauseBtn.textContent = paused ? '▶ Tiếp tục (Space)' : '⏸ Tạm dừng (Space)';
}


function applyIncomingPinned(pinnedPayload, { fromHello = false } = {}) {
  if (!pinnedPayload || !pinnedPayload.title || !(pinnedPayload.price || pinnedPayload.priceText)) {
    return;
  }
  // Avoid redundant re-speaking if localStorage already restored the exact same pinned item
  if (fromHello && isSamePinnedPayload(store.pinnedProduct, pinnedPayload)) {
    return;
  }
  handlePinnedProduct(pinnedPayload, {
    syncServer: false,
    saveStorage: true,
    speak: started && !fromHello,
  });
}


// =========================================================================
// ABLY TRANSPORT (bản Pages — thay WebSocket nội bộ)
// Trang GitHub Pages không gọi được server VM trực tiếp nên nhận tin live
// qua Ably kênh ban-hang-live (server publish, trang subscribe-only).
// Lọc tin cũ hơn lúc tải trang − 10s, dedupe theo msg.id (500 cuối),
// event tới trước khi bấm Bắt đầu được đệm lại (tối đa 20) và phát sau start.
// =========================================================================
const ABLY_PAGE_LOAD_TS = Date.now();
const ablySeenIds = new Set();
const pendingAblyEvents = [];

function getAblyConfig() {
  const fileCfg = (typeof window !== 'undefined' && window.ABLY_CONFIG) || {};
  const key = params.get('ablyKey') || fileCfg.key || '';
  const channel = params.get('ablyChannel') || fileCfg.channel || 'ban-hang-live';
  return { key, channel };
}

function parseAblyData(msg) {
  const raw = msg && msg.data;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function dispatchAblyEvent(name, data) {
  if (name === 'comment') {
    handleComment(data.user || data.username || 'Người xem', data.text || '', { isBot: false });
  } else if (name === 'member') {
    handleViewerJoin(data.user || data.username || 'Người xem', data.avatar || data.avatarUrl || '');
  } else if (name === 'gift') {
    handleGift(
      data.user || data.username || 'Người tặng',
      data.giftName || 'Quà TikTok',
      Number(data.diamonds ?? data.coins ?? 1)
    );
  } else if (name === 'pinned_product') {
    applyIncomingPinned(data, { fromHello: false });
  }
}

function flushPendingAblyEvents() {
  const queued = pendingAblyEvents.splice(0, pendingAblyEvents.length);
  for (const e of queued) {
    dispatchAblyEvent(e.name, e.data);
  }
}

function handleAblyMessage(msg) {
  const data = parseAblyData(msg);
  if (!data) return;
  // Lọc tin cũ (Ably phát lại / reconnect): bỏ tin cũ hơn lúc tải trang − 10s.
  const ts = Number(msg.timestamp || data.timestamp || 0);
  if (ts && ts < ABLY_PAGE_LOAD_TS - 10000) return;
  // Dedupe theo msg.id (Ably gán id duy nhất cho mỗi message).
  if (msg.id) {
    if (ablySeenIds.has(msg.id)) return;
    ablySeenIds.add(msg.id);
    if (ablySeenIds.size > 500) {
      const it = ablySeenIds.values();
      ablySeenIds.delete(it.next().value);
    }
  }
  const name = msg.name;

  if (name === 'status') {
    const connected = Boolean(data.connected);
    const user = data.username || liveUsername || '';
    el.modeBadge.classList.toggle('live-connected', connected);
    el.modeBadge.textContent = connected && user
      ? `● @${user}`
      : user
        ? `CHỜ LIVE @${user}`
        : 'CHỜ LIVE';
    if (typeof data.viewerCount === 'number') {
      store.setViewerCount(data.viewerCount);
      renderHeader();
    }
    // Heartbeat status mang theo món ghim hiện tại: trang mở lại sau cũng
    // khôi phục được món ghim (không đọc lại thành tiếng).
    if (data.pinned) {
      applyIncomingPinned(data.pinned, { fromHello: true });
    }
    return;
  }
  if (name === 'room_user' && typeof data.viewerCount === 'number') {
    store.setViewerCount(data.viewerCount);
    renderHeader();
    return;
  }
  if (name === 'pinned_product_cleared') {
    clearPinnedState({ syncServer: false });
    return;
  }
  if (name === 'shopping') {
    handleShoppingActivity({
      type: data.action || 'view_cart',
      username: data.username || data.user || 'Khách xem live',
      productId: store.getActiveProduct()?.id,
    });
    return;
  }

  // comment / member / gift / pinned_product: đệm lại nếu chưa bắt đầu
  // (tránh host đọc/chốt trước khi bấm Bắt đầu), phát sau startLiveSession.
  if (!started) {
    if (pendingAblyEvents.length < 20) {
      pendingAblyEvents.push({ name, data });
    }
    return;
  }
  dispatchAblyEvent(name, data);
}

function connectAbly() {
  if (typeof window === 'undefined' || !window.AblyPubSub) {
    // SDK chưa tải xong (mạng chậm): thử lại sau 1s.
    setTimeout(connectAbly, 1000);
    return;
  }
  const cfg = getAblyConfig();
  if (!cfg.key || cfg.key.indexOf('REPLACE_WITH') === 0) {
    el.modeBadge.textContent = liveUsername ? `CHỜ LIVE @${liveUsername}` : 'CHỜ LIVE';
    return;
  }
  try {
    const client = window.AblyPubSub.createClient({
      key: cfg.key,
      clientId: 'obs-ban-hang',
    });
    const channel = client.channels.get(cfg.channel);
    const EVENTS = ['comment', 'member', 'gift', 'pinned_product', 'pinned_product_cleared', 'room_user', 'status', 'shopping'];
    for (const ev of EVENTS) {
      channel.subscribe(ev, handleAblyMessage);
    }
  } catch (err) {
    setTimeout(connectAbly, 5000);
  }
}


// =========================================================================
// UI EVENT BINDINGS
// =========================================================================
el.startBtn.addEventListener('click', startLiveSession);

el.spotlightAddBtn.addEventListener('click', () => {
  if (store.pinnedProduct && !store.pinnedProduct.matched) return;
  const active = store.getActiveProduct();
  if (!active) return;
  const res = store.addToCart(active.id, 1, { username: 'Bạn' });
  if (res.ok) {
    bumpCartBadge();
    audio.playSfx('cart');
    renderHeader();
    renderShoppingFeed();
    renderSpotlight();
    updateCatalogBadgesInPlace();
    renderCartModal();
  } else {
    showStockAlert(res.reason, res.product || active);
  }
});

el.spotlightBuyNowBtn.addEventListener('click', () => {
  if (store.pinnedProduct && !store.pinnedProduct.matched) return;
  const active = store.getActiveProduct();
  if (!active || active.stock <= 0) {
    showStockAlert('OUT_OF_STOCK', active);
    return;
  }
  if (!store.isCartLocked && !store.cart.some((c) => c.productId === active.id)) {
    store.addToCart(active.id, 1, { username: 'Bạn' });
  }
  renderHeader();
  renderShoppingFeed();
  renderSpotlight();
  updateCatalogBadgesInPlace();
  renderCartModal();
  openCheckoutModal();
});

el.categoryTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-tab');
  if (!btn) return;
  store.setCategory(btn.dataset.category);
  renderCategoryTabs();
  renderCatalog();
});

el.catalogGrid.addEventListener('click', (e) => {
  const focusBtn = e.target.closest('[data-focus-id]');
  if (focusBtn) {
    const hadPinned = Boolean(store.pinnedProduct);
    const res = store.selectProduct(focusBtn.dataset.focusId);
    if (res.ok) {
      if (hadPinned) {
        clearPinnedFromStorage();
        syncClearPinnedToServer();
      }
      renderSpotlight();
      renderCatalog();
      renderCartModal();
      setHostBubble(res.speech);
      renderer.triggerGesture('point', 3000);
      if (started && !paused) audio.speak(res.speech, { interrupt: true });
    }
    return;
  }

  const addBtn = e.target.closest('[data-add-id]');
  const card = e.target.closest('.catalog-card');
  const productId = addBtn?.dataset.addId || card?.dataset.productId;
  if (!productId) return;

  const res = store.addToCart(productId, 1, { username: 'Bạn' });
  if (res.ok) {
    bumpCartBadge();
    audio.playSfx('cart');
    renderHeader();
    renderShoppingFeed();
    renderSpotlight();
    // Update badges in place so 10 rapid clicks on the same button NEVER lose a click!
    updateCatalogBadgesInPlace();
    renderCartModal();
  } else {
    showStockAlert(res.reason, res.product || store.getProductById(productId));
  }
});

// Cart Modal
el.cartOpenBtn.addEventListener('click', () => {
  handleShoppingActivity({
    type: 'view_cart',
    username: 'Bạn',
    productId: store.getActiveProduct()?.id,
  });
  el.cartModalStockAlert?.classList.add('hidden');
  renderCartModal();
  el.cartModal.classList.remove('hidden');
});

el.closeCartBtn.addEventListener('click', () => el.cartModal.classList.add('hidden'));

el.cartItemsList.addEventListener('click', (e) => {
  const qtyBtn = e.target.closest('[data-qty-id]');
  if (qtyBtn) {
    const res = store.updateCartQty(qtyBtn.dataset.qtyId, Number(qtyBtn.dataset.delta));
    if (!res.ok) {
      showStockAlert(res.reason, res.product || store.getProductById(qtyBtn.dataset.qtyId));
    }
    renderHeader();
    renderCartModal();
    return;
  }
  const remBtn = e.target.closest('[data-remove-id]');
  if (remBtn) {
    store.removeFromCart(remBtn.dataset.removeId);
    renderHeader();
    renderCartModal();
  }
});

el.proceedCheckoutBtn.addEventListener('click', () => {
  if (store.getCartItemCount() === 0) return;
  el.cartModal.classList.add('hidden');
  openCheckoutModal();
});

el.closeCheckoutBtn.addEventListener('click', closeCheckoutModal);

el.checkoutForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const res = store.checkout({
    name: el.customerName.value,
    phone: el.customerPhone.value,
    address: el.customerAddress.value,
  });

  if (!res.ok) {
    el.checkoutError.textContent =
      res.reason === 'INVALID_CUSTOMER'
        ? 'Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng.'
        : 'Không thể chốt đơn do sản phẩm không đủ tồn kho.';
    el.checkoutError.classList.remove('hidden');
    return;
  }

  el.checkoutModal.classList.add('hidden');
  el.checkoutForm.reset();

  const itemLines = res.order.items
    .map((i) => `<li><strong>${escapeHtml(i.codeLabel)} ${escapeHtml(i.name)}</strong> × ${i.qty} — ${formatVnd(i.lineSubtotal)}</li>`)
    .join('');

  const giftExtraLine =
    res.order.giftExtraDiscount > 0
      ? `<div><strong>Giảm thêm mốc quà 50💎 (−5% món đang giới thiệu):</strong> <span style="color:#059669;font-weight:800">-${formatVnd(res.order.giftExtraDiscount)}</span></div>`
      : '';

  el.orderSuccessDetails.innerHTML = `
    <div><strong>Mã đơn:</strong> ${escapeHtml(res.order.id)}</div>
    <div><strong>Khách hàng:</strong> ${escapeHtml(res.order.customer.name)} · ${escapeHtml(res.order.customer.phone)}</div>
    <div><strong>Địa chỉ:</strong> ${escapeHtml(res.order.customer.address)}</div>
    <ul style="margin:8px 0 8px 20px">${itemLines}</ul>
    <div><strong>Phí vận chuyển:</strong> ${res.order.freeshipApplied ? '0đ (Freeship 10💎)' : formatVnd(res.order.shippingFee)}</div>
    ${giftExtraLine}
    <div><strong>Tổng thanh toán:</strong> <span style="color:#e11d48;font-weight:800">${formatVnd(res.order.total)}</span></div>
  `;

  el.orderSuccessModal.classList.remove('hidden');

  renderAll();
  setHostBubble(res.speech);
  // Event-driven 2D animation: order confirmed -> celebrate_order jump + confetti + hearts!
  renderer.burstConfetti(125);
  renderer.triggerGesture('celebrate_order', 3800);
  renderer.spawnFloatingHearts(12, '#10b981');
  audio.playSfx('checkout');
  if (started && !paused) {
    audio.speak(res.speech, { interrupt: true });
  }
});

el.closeSuccessBtn.addEventListener('click', () => el.orderSuccessModal.classList.add('hidden'));

// Host Controls
el.repeatSpeechBtn.addEventListener('click', () => {
  audio.repeatLast();
});

el.toggleTtsBtn.addEventListener('click', () => {
  audio.setTtsEnabled(!audio.ttsEnabled);
  el.toggleTtsBtn.classList.toggle('active', audio.ttsEnabled);
  el.toggleTtsBtn.textContent = audio.ttsEnabled ? '🔊 TTS: BẬT' : '🔇 TTS: TẮT';
});

el.toggleBgmBtn.addEventListener('click', () => {
  audio.setBgmEnabled(!audio.bgmEnabled);
  el.toggleBgmBtn.classList.toggle('active', audio.bgmEnabled);
  el.toggleBgmBtn.textContent = audio.bgmEnabled ? '🎵 Nhạc: BẬT' : '🎵 Nhạc: TẮT';
});

el.pauseBtn.addEventListener('click', togglePause);

el.nextProductBtn.addEventListener('click', () => {
  const hadPinned = Boolean(store.pinnedProduct);
  const res = store.advanceProduct('MANUAL_NEXT');
  if (hadPinned) {
    clearPinnedFromStorage();
    syncClearPinnedToServer();
  }
  renderSpotlight();
  renderCatalog();
  if (res.speech) {
    setHostBubble(res.speech);
    renderer.triggerGesture('point', 3000);
    if (started && !paused) audio.speak(res.speech, { interrupt: true });
  }
});

// Keyboard shortcuts: Space (pause/resume), S (repeat TTS)
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    togglePause();
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    audio.repeatLast();
  }
});

// Expose transparent test/inspection handle
window.__HOST_SHOP__ = {
  APP_NAME,
  store,
  audio,
  renderer,
  startLiveSession,
  handleComment,
  handleGift,
  handleViewerJoin,
  handleShoppingActivity,
  handlePinnedProduct,
  clearPinnedState,
  tryFlushViewerWelcomes,
  openCheckoutModal,
  closeCheckoutModal,
  renderAll,
};

// Chờ live: chưa nối TikTok thì badge đứng ở trạng thái chờ, không chạy demo.
el.modeBadge.textContent = liveUsername ? `CHỜ LIVE @${liveUsername}` : 'CHỜ LIVE';

// Restore last pinned product synchronously from localStorage before first render
restorePinnedFromStorage();

// Initial render + Canvas start
renderAll();
renderer.start();

// Ably: nối kênh ban-hang-live ngay từ lúc tải trang (nhận tin live thật);
// event tới trước khi bấm Bắt đầu được đệm lại và phát sau khi start.
connectAbly();

// ?obs=1: tự bắt đầu (link OBS) — overlay Bắt đầu tự ẩn.
if (params.get('obs') === '1') {
  startLiveSession();
  // Tham số kiểm chứng trực quan: ?welcome=Tên hiện 1 popup chào 1 lần.
  // Mặc định bản live KHÔNG tự hiện popup giả.
  const welcomeName = (params.get('welcome') || '').trim();
  if (welcomeName) {
    setTimeout(() => { if (started) handleViewerJoin(welcomeName); }, 1500);
  }
}
