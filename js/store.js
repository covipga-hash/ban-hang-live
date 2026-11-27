import {
  APP_NAME,
  HOST_NAME,
  HOST_CHARACTER_NAME,
  CATEGORIES,
  INITIAL_PRODUCTS,
  formatVnd,
} from './catalog.js';

export const DEFAULT_FLASH_SALE_SEC = 75;
export const MILESTONE_FREESHIP_DIAMONDS = 10;
export const MILESTONE_EXTRA_DISCOUNT_DIAMONDS = 50;
export const EXTRA_DISCOUNT_RATE = 0.05;
export const STANDARD_SHIPPING_FEE = 25000;
export const URGENCY_CART_VIEWERS_THRESHOLD = 4;

const AVATAR_PALETTE = [
  '#e11d48',
  '#ea580c',
  '#d97706',
  '#0d9488',
  '#0284c7',
  '#4f46e5',
  '#db2777',
  '#059669',
];

export function buildAvatarInfo(username, avatarUrl = '') {
  const clean = String(username || 'K').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  let initials = 'K';
  if (parts.length >= 2) {
    initials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0].slice(0, 2).toUpperCase();
  }

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  const color = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return {
    initials,
    color,
    avatarUrl: String(avatarUrl || '').trim(),
  };
}

export class LiveShopStore {
  constructor(options = {}) {
    this.flashSaleDurationSec = options.flashSaleDurationSec ?? DEFAULT_FLASH_SALE_SEC;
    this.products = (options.products ?? INITIAL_PRODUCTS).map((p, idx) => {
      const codeNumber = p.codeNumber ?? idx + 1;
      const code = p.code ?? String(codeNumber).padStart(2, '0');
      return {
        ...p,
        codeNumber,
        code,
        codeLabel: p.codeLabel ?? `Mã ${code}`,
        cartViewers: p.cartViewers ?? 0, // Không seed số giả: 0 cho tới khi có hoạt động thật.
      };
    });

    this.activeProductIndex = 0;
    this.flashSaleRemainingSec = this.flashSaleDurationSec;
    this.selectedCategory = 'Tất cả';
    this.pinnedProduct = null;

    // Cart items (real viewer cart only): [{ productId, qty }]
    this.cart = [];
    this.isCartLocked = false;
    this.checkoutSnapshot = null;

    // Session metrics
    this.ordersCount = 0;
    this.totalRevenue = 0;
    this.orders = [];

    // Viewer & engagement
    this.viewerCount = options.initialViewers ?? 0; // Không seed người xem giả: 0 cho tới khi TikTok báo số thật (roomUser/member).
    this.latestComment = null;
    this.commentHistory = [];
    this.recentViewers = [];
    this.pendingJoins = [];
    this.welcomeCooldownMs = options.welcomeCooldownMs ?? 4500;
    this.lastWelcomeAt = 0;
    this.welcomeCount = 0;
    this.welcomeHistory = [];

    // Shopping activity feed & urgency tracking
    this.shoppingFeed = []; // latest activities [{ id, type, icon, username, text, productId, timestamp }]
    this.activitySeq = 0;
    this.urgencyThreshold = options.urgencyThreshold ?? URGENCY_CART_VIEWERS_THRESHOLD;
    this.lastUrgencyNoticeAt = 0;
    this.urgencyCooldownMs = options.urgencyCooldownMs ?? 8000;

    // Unanswered / out-of-catalog questions queue (no fabrication!)
    this.pendingQuestions = [];

    // Gift & milestones
    this.sessionDiamonds = 0;
    this.gifters = new Map();
    this.lastGift = null;

    // Host speech state
    this.hostSpeech = `Xin chào cả nhà, em là ${HOST_CHARACTER_NAME} ạ! Bấm Bắt đầu để cùng ${HOST_CHARACTER_NAME} săn deal siêu hời trên phiên live ${APP_NAME} hôm nay nha!`;
    this.pitchStep = 0;

    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event = { type: 'update' }) {
    for (const fn of this.listeners) {
      fn(event, this);
    }
  }

  getActiveProduct() {
    return this.products[this.activeProductIndex] || null;
  }

  getProductById(productId) {
    return this.products.find((p) => p.id === productId) || null;
  }

  getProductByCode(codeInput) {
    const num = Number(String(codeInput).replace(/\D/g, ''));
    if (!Number.isFinite(num) || num <= 0) return null;
    return this.products.find((p) => p.codeNumber === num) || null;
  }

  getFilteredProducts(category = this.selectedCategory) {
    if (!category || category === 'Tất cả') return this.products;
    return this.products.filter((p) => p.category === category);
  }

  setCategory(category) {
    if (category === 'Tất cả' || CATEGORIES.includes(category)) {
      this.selectedCategory = category;
      this.notify({ type: 'category', category });
    }
  }

  isFreeshipUnlocked() {
    return this.sessionDiamonds >= MILESTONE_FREESHIP_DIAMONDS;
  }

  isExtraDiscountUnlocked() {
    return this.sessionDiamonds >= MILESTONE_EXTRA_DISCOUNT_DIAMONDS;
  }

  getEffectiveUnitPrice(productId) {
    const product = this.getProductById(productId);
    if (!product) return 0;
    const active = this.getActiveProduct();
    if (active && active.id === product.id && this.isExtraDiscountUnlocked()) {
      return Math.round(product.price * (1 - EXTRA_DISCOUNT_RATE));
    }
    return product.price;
  }

  getCartItemCount() {
    return this.cart.reduce((sum, item) => sum + item.qty, 0);
  }

  getProductCartViewers(productId) {
    const product = this.getProductById(productId);
    return product ? product.cartViewers : 0;
  }

  /**
   * Record real-time shopper activity (view_cart, add_cart, checkout, ask).
   * Updates per-product cartViewers badge and returns urgency speech if crowded.
   */
  recordShoppingActivity(activity = {}, nowMs = Date.now()) {
    const type = activity.type || 'view_cart';
    const username = String(activity.username || 'Khách xem live').trim() || 'Khách xem live';
    const product =
      (activity.productId && this.getProductById(activity.productId)) ||
      this.getActiveProduct();
    const qty = Math.max(1, Math.floor(Number(activity.qty) || 1));

    let icon = '👀';
    let text = activity.text || '';

    if (type === 'view_cart') {
      icon = '👀';
      if (product) {
        product.cartViewers = Math.min(99, (product.cartViewers || 0) + 1);
      }
      text =
        text ||
        (product && activity.mentionProduct
          ? `👀 ${username} đang xem giỏ ${product.codeLabel} ${product.name}`
          : `👀 ${username} đang xem giỏ hàng`);
    } else if (type === 'add_cart') {
      icon = '🛒';
      if (product) {
        product.cartViewers = Math.min(99, (product.cartViewers || 0) + 1);
      }
      text =
        text ||
        (product
          ? `🛒 ${username} vừa thêm ${product.codeLabel} ${product.name} vào giỏ`
          : `🛒 ${username} vừa thêm sản phẩm vào giỏ`);
    } else if (type === 'checkout') {
      icon = '✅';
      if (product && product.cartViewers > 1) {
        product.cartViewers = Math.max(1, product.cartViewers - 1);
      }
      text = text || `✅ ${username} vừa chốt đơn ${qty} món!`;
    } else if (type === 'ask') {
      icon = '💬';
      text =
        text ||
        (product
          ? `💬 ${username} đang hỏi về ${product.codeLabel} ${product.name}`
          : `💬 ${username} đang hỏi về sản phẩm`);
    }

    this.activitySeq += 1;
    const entry = {
      id: `ACT${this.activitySeq}`,
      type,
      icon,
      username,
      text,
      productId: product ? product.id : null,
      productName: product ? product.name : null,
      codeLabel: product ? product.codeLabel : null,
      timestamp: nowMs,
    };

    this.shoppingFeed.unshift(entry);
    if (this.shoppingFeed.length > 20) this.shoppingFeed.pop();

    // Check urgency trigger when many viewers are viewing/adding the same item
    let urgencySpeech = null;
    if (
      product &&
      (type === 'view_cart' || type === 'add_cart') &&
      product.cartViewers >= this.urgencyThreshold &&
      product.stock > 0
    ) {
      const canSpeakUrgency =
        activity.forceUrgency ||
        this.lastUrgencyNoticeAt === 0 ||
        nowMs - this.lastUrgencyNoticeAt >= this.urgencyCooldownMs;

      if (canSpeakUrgency) {
        this.lastUrgencyNoticeAt = nowMs;
        urgencySpeech = `Cả nhà nhanh tay nha! Có ${product.cartViewers} bạn đang xem giỏ ${product.codeLabel} ${product.name}, kho nhà ${HOST_CHARACTER_NAME} chỉ còn ${product.stock} cái thôi ạ! Bình luận chốt mã ${product.code} ngay nhé!`;
        this.hostSpeech = urgencySpeech;
      }
    }

    this.notify({
      type: 'shopping_activity',
      activity: entry,
      product,
      urgencySpeech,
    });

    return { activity: entry, product, urgencySpeech };
  }

  getShoppingFeed(limit = 4) {
    return this.shoppingFeed.slice(0, limit);
  }

  addToCart(productId, qty = 1, meta = {}) {
    if (this.isCartLocked) {
      return { ok: false, reason: 'CART_LOCKED' };
    }
    const product = this.getProductById(productId);
    if (!product) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    if (product.stock <= 0) {
      return { ok: false, reason: 'OUT_OF_STOCK', product };
    }

    const addQty = Math.max(1, Math.floor(Number(qty) || 1));
    const existing = this.cart.find((item) => item.productId === productId);
    const currentQty = existing ? existing.qty : 0;
    const nextQty = Math.min(product.stock, currentQty + addQty);

    if (nextQty === currentQty) {
      return { ok: false, reason: 'MAX_STOCK_REACHED', product };
    }

    if (existing) {
      existing.qty = nextQty;
    } else {
      this.cart.push({ productId, qty: nextQty });
    }

    if (meta.recordActivity !== false) {
      this.recordShoppingActivity({
        type: 'add_cart',
        username: meta.username || 'Bạn',
        productId: product.id,
        qty: nextQty - currentQty,
      });
    }

    this.notify({ type: 'cart', action: 'add', productId, qty: nextQty });
    return { ok: true, product, qty: nextQty, added: nextQty - currentQty };
  }

  updateCartQty(productId, delta) {
    if (this.isCartLocked) {
      return { ok: false, reason: 'CART_LOCKED' };
    }
    const idx = this.cart.findIndex((item) => item.productId === productId);
    if (idx === -1) return { ok: false, reason: 'NOT_IN_CART' };

    const product = this.getProductById(productId);
    const currentQty = this.cart[idx].qty;
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      this.cart.splice(idx, 1);
      this.notify({ type: 'cart', action: 'remove', productId });
      return { ok: true, removed: true, qty: 0 };
    }

    if (delta > 0 && product && currentQty >= product.stock) {
      return { ok: false, reason: 'MAX_STOCK_REACHED', product, qty: currentQty };
    }

    const clampedQty = product ? Math.min(product.stock, nextQty) : nextQty;
    if (clampedQty <= 0) {
      this.cart.splice(idx, 1);
      this.notify({ type: 'cart', action: 'remove', productId });
      return { ok: true, removed: true, qty: 0 };
    }

    this.cart[idx].qty = clampedQty;
    this.notify({ type: 'cart', action: 'update', productId, qty: clampedQty });
    return { ok: true, qty: clampedQty };
  }

  removeFromCart(productId) {
    if (this.isCartLocked) return false;
    const before = this.cart.length;
    this.cart = this.cart.filter((item) => item.productId !== productId);
    if (this.cart.length !== before) {
      this.notify({ type: 'cart', action: 'remove', productId });
      return true;
    }
    return false;
  }

  clearCart() {
    this.cart = [];
    this.isCartLocked = false;
    this.checkoutSnapshot = null;
    this.notify({ type: 'cart', action: 'clear' });
  }

  /**
   * Freeze an immutable checkout snapshot and lock the cart so nothing can alter
   * quantities or totals between opening the checkout form and confirming the order.
   */
  beginCheckoutSnapshot() {
    const totals = this.getCartTotals();
    if (totals.items.length === 0) {
      this.checkoutSnapshot = null;
      this.isCartLocked = false;
      return null;
    }
    this.checkoutSnapshot = {
      items: totals.items.map((i) => ({
        productId: i.productId,
        code: i.code,
        codeLabel: i.codeLabel,
        name: i.product.name,
        category: i.product.category,
        qty: i.qty,
        unitPrice: i.unitPrice,
        basePrice: i.basePrice,
        originalPrice: i.originalPrice,
        extraDiscountPerUnit: i.extraDiscountPerUnit,
        lineSubtotal: i.lineSubtotal,
        lineOriginalTotal: i.lineOriginalTotal,
      })),
      itemCount: totals.itemCount,
      subtotal: totals.subtotal,
      baseSubtotal: totals.baseSubtotal,
      originalTotal: totals.originalTotal,
      catalogDiscount: totals.catalogDiscount,
      giftExtraDiscount: totals.giftExtraDiscount,
      totalDiscount: totals.totalDiscount,
      freeshipApplied: totals.freeshipApplied,
      shippingFee: totals.shippingFee,
      total: totals.total,
    };
    this.isCartLocked = true;
    this.notify({ type: 'checkout_locked', snapshot: this.checkoutSnapshot });
    return this.checkoutSnapshot;
  }

  cancelCheckoutSnapshot() {
    this.checkoutSnapshot = null;
    this.isCartLocked = false;
    this.notify({ type: 'checkout_unlocked' });
  }

  getCartTotals() {
    // Single source of truth for Freeship: sessionDiamonds >= 10 applies everywhere!
    const freeshipUnlocked = this.isFreeshipUnlocked();

    const items = this.cart
      .map((entry) => {
        const product = this.getProductById(entry.productId);
        if (!product) return null;
        const unitPrice = this.getEffectiveUnitPrice(product.id);
        const basePrice = product.price;
        const originalPrice = product.originalPrice;
        const extraDiscountPerUnit = Math.max(0, basePrice - unitPrice);
        return {
          productId: product.id,
          code: product.code,
          codeLabel: product.codeLabel,
          product,
          qty: entry.qty,
          unitPrice,
          basePrice,
          originalPrice,
          extraDiscountPerUnit,
          lineSubtotal: unitPrice * entry.qty,
          lineOriginalTotal: originalPrice * entry.qty,
        };
      })
      .filter(Boolean);

    const subtotal = items.reduce((s, i) => s + i.lineSubtotal, 0);
    const baseSubtotal = items.reduce((s, i) => s + i.basePrice * i.qty, 0);
    const originalTotal = items.reduce((s, i) => s + i.lineOriginalTotal, 0);
    const catalogDiscount = Math.max(0, originalTotal - baseSubtotal);
    const giftExtraDiscount = Math.max(0, baseSubtotal - subtotal);
    const totalDiscount = catalogDiscount + giftExtraDiscount;

    const freeshipApplied = items.length > 0 && freeshipUnlocked;
    const shippingFee = items.length === 0 ? 0 : freeshipApplied ? 0 : STANDARD_SHIPPING_FEE;
    const total = baseSubtotal + shippingFee - giftExtraDiscount;

    return {
      items,
      itemCount: items.reduce((s, i) => s + i.qty, 0),
      subtotal,
      baseSubtotal,
      originalTotal,
      catalogDiscount,
      giftExtraDiscount,
      totalDiscount,
      freeshipApplied,
      shippingFee,
      total,
    };
  }

  checkout(customer = {}) {
    const name = String(customer.name || '').trim();
    const phone = String(customer.phone || '').trim();
    const address = String(customer.address || '').trim();

    if (!name || !phone || !address) {
      return { ok: false, reason: 'INVALID_CUSTOMER' };
    }

    // Use locked checkout snapshot if present so order matches preview 100%
    const source = this.checkoutSnapshot || this.getCartTotals();
    if (!source || source.items.length === 0) {
      this.cancelCheckoutSnapshot();
      return { ok: false, reason: 'EMPTY_CART' };
    }

    const resolvedItems = source.items.map((item) => ({
      ...item,
      product: this.getProductById(item.productId),
    }));

    for (const item of resolvedItems) {
      if (!item.product || item.product.stock < item.qty) {
        return { ok: false, reason: 'INSUFFICIENT_STOCK', product: item.product };
      }
    }

    const soldOutProducts = [];
    for (const item of resolvedItems) {
      item.product.stock = Math.max(0, item.product.stock - item.qty);
      if (item.product.stock === 0) {
        soldOutProducts.push(item.product);
      }
    }

    const totalItemsQty = resolvedItems.reduce((s, i) => s + i.qty, 0);
    const order = {
      id: `DH${String(this.ordersCount + 1).padStart(3, '0')}`,
      customer: { name, phone, address },
      items: resolvedItems.map((i) => ({
        productId: i.productId,
        code: i.code,
        codeLabel: i.codeLabel,
        name: i.product.name,
        category: i.product.category,
        qty: i.qty,
        unitPrice: i.unitPrice,
        lineSubtotal: i.lineSubtotal,
      })),
      totalItemsQty,
      subtotal: source.subtotal,
      baseSubtotal: source.baseSubtotal,
      catalogDiscount: source.catalogDiscount,
      giftExtraDiscount: source.giftExtraDiscount,
      totalDiscount: source.totalDiscount,
      shippingFee: source.shippingFee,
      freeshipApplied: source.freeshipApplied,
      total: source.total,
      createdAt: Date.now(),
    };

    this.ordersCount += 1;
    this.totalRevenue += order.total;
    this.orders.push(order);
    this.cart = [];
    this.checkoutSnapshot = null;
    this.isCartLocked = false;

    this.recordShoppingActivity({
      type: 'checkout',
      username: name,
      productId: order.items[0]?.productId,
      qty: totalItemsQty,
    });

    let autoAdvancedTo = null;
    const active = this.getActiveProduct();
    if (active && active.stock <= 0) {
      const adv = this.advanceProduct('SOLD_OUT');
      if (adv.changed) {
        autoAdvancedTo = adv.product;
      }
    }

    const congratsSpeech = autoAdvancedTo
      ? `Chúc mừng ${name} đã chốt đơn ${order.id} trị giá ${formatVnd(order.total)} cùng ${HOST_CHARACTER_NAME}! Món vừa rồi đã hết hàng, ${HOST_CHARACTER_NAME} chuyển ngay sang ${autoAdvancedTo.codeLabel} ${autoAdvancedTo.name} nha!`
      : `Chúc mừng ${name} đã chốt đơn thành công mã ${order.id} trị giá ${formatVnd(order.total)}! ${HOST_CHARACTER_NAME} cảm ơn bạn rất nhiều ạ!`;

    this.hostSpeech = congratsSpeech;
    this.notify({ type: 'checkout', order, soldOutProducts, autoAdvancedTo, speech: congratsSpeech });

    return {
      ok: true,
      order,
      soldOutProducts,
      autoAdvancedTo,
      speech: congratsSpeech,
    };
  }

  clearPinnedProduct() {
    this.pinnedProduct = null;
  }

  selectProduct(productId) {
    const idx = this.products.findIndex((p) => p.id === productId);
    if (idx === -1) return { ok: false };
    this.pinnedProduct = null;
    this.activeProductIndex = idx;
    this.flashSaleRemainingSec = this.flashSaleDurationSec;
    this.pitchStep = 0;
    const product = this.getActiveProduct();
    const speech = this.generateHostPitch(0);
    this.hostSpeech = speech;
    this.notify({ type: 'product_change', reason: 'MANUAL', product, speech });
    return { ok: true, product, speech };
  }

  advanceProduct(reason = 'NEXT') {
    const total = this.products.length;
    if (total === 0) return { changed: false, product: null };

    this.pinnedProduct = null;
    let nextIdx = -1;
    for (let offset = 1; offset <= total; offset++) {
      const candidate = (this.activeProductIndex + offset) % total;
      if (this.products[candidate].stock > 0) {
        nextIdx = candidate;
        break;
      }
    }

    if (nextIdx === -1) {
      const speech = `Cả nhà ơi, toàn bộ sản phẩm phiên live của ${HOST_CHARACTER_NAME} đã cháy hàng hết rồi, ${HOST_CHARACTER_NAME} cảm ơn mọi người siêu nhiều!`;
      this.hostSpeech = speech;
      this.notify({ type: 'all_sold_out', speech });
      return { changed: false, allSoldOut: true, product: this.getActiveProduct(), speech };
    }

    this.activeProductIndex = nextIdx;
    this.flashSaleRemainingSec = this.flashSaleDurationSec;
    this.pitchStep = 0;
    const product = this.getActiveProduct();
    const speech = this.generateHostPitch(0);
    this.hostSpeech = speech;
    this.notify({ type: 'product_change', reason, product, speech });
    return { changed: true, product, speech };
  }

  tickFlashSale(deltaSec = 1) {
    const active = this.getActiveProduct();
    if (!active) return { advanced: false };

    if (active.stock <= 0) {
      const res = this.advanceProduct('SOLD_OUT');
      return { advanced: res.changed, reason: 'SOLD_OUT', product: res.product, speech: res.speech };
    }

    this.flashSaleRemainingSec = Math.max(0, this.flashSaleRemainingSec - deltaSec);
    if (this.flashSaleRemainingSec <= 0) {
      const res = this.advanceProduct('FLASH_SALE_ENDED');
      return { advanced: res.changed, reason: 'FLASH_SALE_ENDED', product: res.product, speech: res.speech };
    }

    this.notify({ type: 'tick', remainingSec: this.flashSaleRemainingSec });
    return { advanced: false, remainingSec: this.flashSaleRemainingSec };
  }

  generateHostPitch(step = this.pitchStep) {
    if (this.pinnedProduct && !this.pinnedProduct.matched) {
      const p = this.pinnedProduct;
      const speech = `Món đang ghim trên TikTok: ${p.title}, giá TikTok hiển thị ${p.priceText} ạ! Đây là món TikTok đang ghim, chưa có trong catalogue của ${HOST_CHARACTER_NAME} nên cả nhà xem trực tiếp trên giỏ TikTok giúp ${HOST_CHARACTER_NAME} nhé!`;
      this.hostSpeech = speech;
      return speech;
    }

    const product = this.getActiveProduct();
    if (!product) return `Em là ${HOST_CHARACTER_NAME} ạ, ${HOST_CHARACTER_NAME} xin chào cả nhà nha!`;

    const effectivePrice = this.getEffectiveUnitPrice(product.id);
    const extraNote = this.isExtraDiscountUnlocked() ? ' đã giảm thêm 5% mốc quà 50 kim cương' : '';
    const freeshipNote = this.isFreeshipUnlocked() ? ' lại còn được freeship nữa' : '';

    const lines = [
      `Mã số ${product.code} ạ! Em là ${HOST_CHARACTER_NAME} tại phiên live ${APP_NAME}, lên deal ${product.name} nhóm ${product.category}, giá chỉ ${formatVnd(effectivePrice)}${extraNote}, giảm ${product.discountPercent}% từ ${formatVnd(product.originalPrice)}, còn ${product.stock} cái! Bạn nào lấy bình luận chốt mã ${product.code} giúp ${HOST_CHARACTER_NAME} nhé!`,
      `${product.codeLabel} ${product.name} giá chỉ ${formatVnd(effectivePrice)}${extraNote}, dùng siêu thích: ${product.benefit}. Kho nhà ${HOST_CHARACTER_NAME} hiện còn đúng ${product.stock} cái, muốn chốt cứ gõ chốt mã ${product.code} nha!`,
      `Nhanh tay chốt mã ${product.code} — ${product.name} giá flash sale ${formatVnd(effectivePrice)}${freeshipNote} nhé! Còn ${product.stock} sản phẩm thôi cả nhà ơi, chốt ngay cùng ${HOST_CHARACTER_NAME} nha!`,
      `${product.codeLabel} ${product.name}: ${product.variants}. Đang giảm ${product.discountPercent}% còn ${formatVnd(effectivePrice)}, tồn kho còn ${product.stock} cái — bình luận chốt mã ${product.code} hoặc bấm giỏ hàng giúp ${HOST_CHARACTER_NAME} nha!`,
    ];

    const speech = lines[step % lines.length];
    this.pitchStep = (step + 1) % lines.length;
    this.hostSpeech = speech;
    return speech;
  }

  receiveGift(username, giftName = 'Hoa hồng', diamonds = 1) {
    const safeUser = String(username || 'Khách yêu').trim() || 'Khách yêu';
    const amount = Math.max(1, Math.floor(Number(diamonds) || 1));

    const prevFreeship = this.isFreeshipUnlocked();
    const prevExtra = this.isExtraDiscountUnlocked();

    this.sessionDiamonds += amount;
    const prev = this.gifters.get(safeUser) || { username: safeUser, diamonds: 0, count: 0 };
    prev.diamonds += amount;
    prev.count += 1;
    this.gifters.set(safeUser, prev);

    const unlockedMilestones = [];
    if (!prevFreeship && this.isFreeshipUnlocked()) {
      unlockedMilestones.push('FREESHIP_10');
    }
    if (!prevExtra && this.isExtraDiscountUnlocked()) {
      unlockedMilestones.push('EXTRA_5_50');
    }

    let milestoneText = '';
    if (unlockedMilestones.includes('EXTRA_5_50')) {
      milestoneText = ` Tuyệt vời quá, phiên live vừa chạm mốc 50 kim cương, mở khóa giảm thêm 5% cho món đang bán rồi cả nhà ơi!`;
    } else if (unlockedMilestones.includes('FREESHIP_10')) {
      milestoneText = ` Cả nhà ơi, phiên live vừa đạt mốc 10 kim cương, mở khóa freeship cho món đang bán rồi nha!`;
    }

    const speech = `${HOST_CHARACTER_NAME} cảm ơn ${safeUser} đã tặng ${giftName} trị giá ${amount} kim cương cho phiên live ${APP_NAME} nha!${milestoneText}`;
    this.hostSpeech = speech;
    this.lastGift = {
      username: safeUser,
      giftName,
      diamonds: amount,
      timestamp: Date.now(),
      unlockedMilestones,
    };

    this.notify({
      type: 'gift',
      gift: this.lastGift,
      speech,
      topGifters: this.getTopGifters(),
      sessionDiamonds: this.sessionDiamonds,
      unlockedMilestones,
    });

    return {
      gift: this.lastGift,
      speech,
      unlockedMilestones,
      sessionDiamonds: this.sessionDiamonds,
      topGifters: this.getTopGifters(),
    };
  }

  getTopGifters(limit = 3) {
    return Array.from(this.gifters.values())
      .sort((a, b) => b.diamonds - a.diamonds || a.username.localeCompare(b.username))
      .slice(0, limit);
  }

  /**
   * Shared Vietnamese accented & accent-folded fuzzy matcher against catalogue names & aliases.
   * Reused by both comment Q&A (findMentionedProduct) and TikTok OEC pinned product auto-read.
   */
  matchCatalogProductByName(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    const folded = normalizeVi(lower);

    // Skip matching bare "vải" when user asks "chất liệu vải gì" about the active item.
    const isMaterialPhrase = /chất liệu|vải gì|vai gi/i.test(lower);
    let bestMatch = null;
    let bestScore = 0;

    for (const product of this.products) {
      const candidates = [product.name.toLowerCase(), ...(product.aliases || [])];
      for (const alias of candidates) {
        const cleanAlias = alias.trim().toLowerCase();
        if (!cleanAlias) continue;
        if (cleanAlias === 'vải' && isMaterialPhrase) continue;

        const foldedAlias = normalizeVi(cleanAlias);
        const isSingleWord = !cleanAlias.includes(' ');

        const exactHit = isSingleWord
          ? hasWholeWord(lower, cleanAlias)
          : lower.includes(cleanAlias);
        const foldedHit = isSingleWord
          ? hasWholeWord(folded, foldedAlias)
          : folded.includes(foldedAlias);

        if (exactHit) {
          const score = cleanAlias.length * 2 + 1;
          if (score > bestScore) {
            bestMatch = product;
            bestScore = score;
          }
        } else if (foldedHit) {
          const score = foldedAlias.length * 2;
          if (score > bestScore) {
            bestMatch = product;
            bestScore = score;
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Receive a TikTok OEC pinned product event (or Demo pinned simulation).
   * - Never mutates cart, diamonds, orders, or catalogue stock/prices.
   * - If title fuzzy-matches a catalogue item (accented or accent-free), focuses that item with real Mã XX, price, and stock.
   * - Otherwise displays exact TikTok title + price with "món TikTok đang ghim, chưa có trong catalogue" and fabricates nothing.
   */
  receivePinnedProduct(payload = {}) {
    const title = String(payload?.title || '').trim();
    const priceText = String(payload?.price ?? payload?.priceText ?? '').trim();
    if (!title || !priceText) {
      return { ok: false, reason: 'INVALID_PINNED_PAYLOAD' };
    }

    const matchedProduct = this.matchCatalogProductByName(title);
    const source = String(payload?.source || 'tiktok_oec');
    const timestamp = payload?.timestamp || Date.now();

    if (matchedProduct) {
      const idx = this.products.findIndex((p) => p.id === matchedProduct.id);
      if (idx !== -1) {
        this.activeProductIndex = idx;
      }
      this.flashSaleRemainingSec = this.flashSaleDurationSec;
      this.pitchStep = 1;

      this.pinnedProduct = {
        title,
        priceText,
        openUrl: String(payload?.openUrl || '').trim(),
        imageUrl: String(payload?.imageUrl || '').trim(),
        productId: String(payload?.productId || '').trim(),
        liveProductNumber: Number(payload?.liveProductNumber || 0),
        actionType: Number(payload?.actionType || 0),
        source,
        matched: true,
        matchedProductId: matchedProduct.id,
        matchedCodeLabel: matchedProduct.codeLabel,
        timestamp,
      };

      const effectivePrice = this.getEffectiveUnitPrice(matchedProduct.id);
      const extraNote = this.isExtraDiscountUnlocked()
        ? ' (đã giảm thêm 5% mốc quà 50 kim cương)'
        : '';
      const speech = `Món đang ghim trên TikTok: ${title} (${priceText})! ${HOST_CHARACTER_NAME} vừa khớp catalogue là ${matchedProduct.codeLabel} ${matchedProduct.name}, giá ưu đãi ${formatVnd(effectivePrice)}${extraNote}, kho nhà ${HOST_CHARACTER_NAME} còn ${matchedProduct.stock} cái — ai ưng gõ chốt mã ${matchedProduct.code} giúp ${HOST_CHARACTER_NAME} nhé!`;

      this.hostSpeech = speech;
      this.notify({
        type: 'pinned_product',
        pinned: this.pinnedProduct,
        matched: true,
        product: matchedProduct,
        speech,
      });

      return {
        ok: true,
        matched: true,
        pinned: this.pinnedProduct,
        product: matchedProduct,
        speech,
      };
    }

    // Unmatched TikTok pinned product: show exact TikTok title + price, NEVER fabricate code/stock/price!
    this.pinnedProduct = {
      title,
      priceText,
      openUrl: String(payload?.openUrl || '').trim(),
      imageUrl: String(payload?.imageUrl || '').trim(),
      productId: String(payload?.productId || '').trim(),
      liveProductNumber: Number(payload?.liveProductNumber || 0),
      actionType: Number(payload?.actionType || 0),
      source,
      matched: false,
      matchedProductId: null,
      matchedCodeLabel: null,
      timestamp,
    };

    const speech = `Món đang ghim trên TikTok: ${title}, giá TikTok hiển thị ${priceText} ạ! Lưu ý đây là món TikTok đang ghim, chưa có trong catalogue của ${HOST_CHARACTER_NAME} nên cả nhà xem trực tiếp trên giỏ TikTok giúp ${HOST_CHARACTER_NAME} nhé!`;

    this.hostSpeech = speech;
    this.notify({
      type: 'pinned_product',
      pinned: this.pinnedProduct,
      matched: false,
      product: null,
      speech,
    });

    return {
      ok: true,
      matched: false,
      pinned: this.pinnedProduct,
      product: null,
      speech,
    };
  }

  /**
   * Look up a product mentioned by explicit code ("mã 03") OR fuzzy name/alias in catalogue.
   * Also detects when a viewer explicitly names an unlisted product (e.g. "áo khoác giá bao nhiêu?")
   * so the host NEVER mistakenly answers with the active spotlight product's price.
   */
  findMentionedProduct(text) {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();

    // 1. Explicit code mention: "mã 03", "mã số 3", "ms 03"
    const codeMatch = lower.match(/(?:mã\s*số|mã|ms)\s*0?(\d{1,2})\b/i);
    if (codeMatch) {
      const codeNum = Number(codeMatch[1]);
      const found = this.getProductByCode(codeNum);
      return {
        product: found,
        byCode: true,
        requestedCode: String(codeNum).padStart(2, '0'),
        codeNotFound: !found,
        unlistedProductName: null,
      };
    }

    // 2. Match catalog product names or aliases (exact first, then accent-folded fuzzy match)
    const bestMatch = this.matchCatalogProductByName(raw);
    if (bestMatch) {
      return {
        product: bestMatch,
        byCode: false,
        requestedCode: null,
        codeNotFound: false,
        unlistedProductName: null,
      };
    }

    // 3. No catalog product matched — check if the viewer named an unlisted product!
    const unlistedProductName = extractUnlistedProductName(raw);
    return {
      product: null,
      byCode: false,
      requestedCode: null,
      codeNotFound: false,
      unlistedProductName,
    };
  }

  /**
   * Detect if the user is asking for details NOT recorded in the catalogue
   * so Host bán hàng never fabricates an answer.
   */
  detectUnknownCatalogQuery(text, product) {
    const lower = String(text || '').toLowerCase();

    // Check explicit size not in catalogue (e.g. XXL, 2XL, 3XL, XS, size 40, freesize)
    const sizeQuery = lower.match(/size\s*(xxxl|3xl|xxl|2xl|xs|xxs|4xl|\d{2})\b/i);
    if (sizeQuery) {
      const requested = sizeQuery[1].toUpperCase();
      const available = (product.sizes || []).map((s) => s.toUpperCase());
      if (!available.includes(requested)) {
        return `size ${requested}`;
      }
    }

    // Check explicit color asked that isn't in catalogue colors
    const colorQuery = lower.match(/màu\s+(tím|đen|đỏ đô|xám|cam neon|vàng chanh|nâu đất|rêu|bạc|vàng đồng)/i);
    if (colorQuery) {
      const reqColor = colorQuery[1].toLowerCase();
      const colorsJoined = (product.colors || []).join(' ').toLowerCase();
      if (!colorsJoined.includes(reqColor)) {
        return `màu ${reqColor}`;
      }
    }

    // Check unrecorded spec attributes (warranty, origin, expiry date, weight, VAT, waterproof, body measurements, pregnancy)
    const unrecordedPatterns = [
      { re: /(xuất xứ|sản xuất ở đâu|nước nào|made in)/i, label: 'xuất xứ chi tiết' },
      { re: /(bảo hành|đổi trả mấy ngày)/i, label: 'chính sách bảo hành chi tiết' },
      { re: /(hạn sử dụng|hsd|date|ngày sản xuất)/i, label: 'hạn sử dụng cụ thể theo lô' },
      { re: /(hóa đơn vat|xuất hóa đơn)/i, label: 'xuất hóa đơn VAT' },
      { re: /(bà bầu|mẹ bầu|trẻ sơ sinh)/i, label: 'chỉ định cho mẹ bầu/trẻ nhỏ' },
      { re: /(số đo|vòng eo|vòng ngực|nặng bao nhiêu kg|cao bao nhiêu)/i, label: 'bảng số đo chi tiết theo cân nặng' },
      { re: /(chống nước|chống tia uv|chỉ số spf)/i, label: 'thông số kỹ thuật chưa ghi trong catalogue' },
      { re: /(ship quốc tế|ship nước ngoài|gửi đi mỹ|gửi đi nhật)/i, label: 'phí ship quốc tế' },
    ];
    for (const pat of unrecordedPatterns) {
      if (pat.re.test(lower)) {
        return pat.label;
      }
    }

    return null;
  }

  receiveComment(username, text, options = {}) {
    const isBot = Boolean(options && options.isBot);
    const safeUser = String(username || 'Người xem').trim() || 'Người xem';
    const safeText = String(text || '').trim();
    if (!safeText) return null;

    const active = this.getActiveProduct();
    const lower = safeText.toLowerCase();

    const commentRecord = {
      username: safeUser,
      text: safeText,
      isBot,
      timestamp: Date.now(),
    };
    this.latestComment = commentRecord;
    this.commentHistory.push(commentRecord);
    if (this.commentHistory.length > 50) this.commentHistory.shift();

    const lookup = this.findMentionedProduct(safeText);
    const targetProduct = lookup.unlistedProductName ? null : lookup.product || active;
    const isOtherProduct = Boolean(targetProduct && active && targetProduct.id !== active.id);

    const hasQuestionIntent =
      /(giá|bao nhiêu|nhiêu tiền|nhiêu vậy|mấy chục|mấy trăm|màu|size|cỡ|vị|mẫu|loại khác|chất liệu|vải gì|làm bằng|công dụng|dùng sao|ship|giao hàng|bao lâu|vận chuyển|phí|còn hàng|còn không|còn ko|tồn kho|còn mấy|hết chưa|có bán|bán không|xuất xứ|bảo hành|hạn sử dụng|hsd|\?)/i.test(
        lower
      );
    const hasBuyVerb =
      /(chốt|lấy\s*(mã|\d+|1|2|3|4|5|em|cái)?|đặt\s*(mã|\d+|1|2|3|4|5|em|cái)?|mua\s*(ngay|mã|\d+|em|cái)?|cho\s*(em|mình|chị|anh|tôi)\s*(mã|\d+|1|2|3|4|5)?)/i.test(
        lower
      );
    // Standalone code comment like "mã 03" or "mã 3!" counts as chốt mã!
    const isStandaloneCodeOrder = lookup.byCode && !hasQuestionIntent;

    let intent = 'GENERAL';
    let addedToCart = false;
    let addedQty = 0;
    let botSimulatedOrder = false;
    let unknownInfo = null;
    let pendingQuestion = null;
    let checkingText = targetProduct
      ? `🔍 ${HOST_CHARACTER_NAME} đang check thông tin ${targetProduct.codeLabel} ${targetProduct.name}…`
      : null;
    let reply = '';

    // Invalid explicit code (e.g. "mã 99") -> do not fabricate
    if (lookup.codeNotFound) {
      intent = 'UNKNOWN_INFO';
      unknownInfo = `Mã ${lookup.requestedCode}`;
      pendingQuestion = {
        id: `Q${this.pendingQuestions.length + 1}`,
        username: safeUser,
        question: safeText,
        productId: null,
        productName: `Mã ${lookup.requestedCode}`,
        missingDetail: `Không có Mã ${lookup.requestedCode} trong catalogue`,
        timestamp: Date.now(),
      };
      this.pendingQuestions.push(pendingQuestion);
      checkingText = `🔍 ${HOST_CHARACTER_NAME} đang check Mã ${lookup.requestedCode} trong catalogue…`;
      reply = `Dạ ${safeUser} ơi, ${HOST_CHARACTER_NAME} vừa check catalogue hôm nay thì chỉ có từ Mã 01 đến Mã ${String(this.products.length).padStart(2, '0')}, chưa có Mã ${lookup.requestedCode} ạ. Để em kiểm tra lại và ghi nhận câu hỏi của bạn vào danh sách chờ nhé!`;
    } else if (lookup.unlistedProductName) {
      // Bug 1 fix: viewer asked by NAME about a product NOT in catalogue (e.g. "áo khoác giá bao nhiêu?")
      // NEVER answer with active spotlight product's price/stock!
      intent = 'UNLISTED_PRODUCT';
      unknownInfo = lookup.unlistedProductName;
      pendingQuestion = {
        id: `Q${this.pendingQuestions.length + 1}`,
        username: safeUser,
        question: safeText,
        productId: null,
        productName: lookup.unlistedProductName,
        missingDetail: `Không bán "${lookup.unlistedProductName}" trong catalogue`,
        timestamp: Date.now(),
      };
      this.pendingQuestions.push(pendingQuestion);
      checkingText = `🔍 ${HOST_CHARACTER_NAME} đang check "${lookup.unlistedProductName}" trong catalogue…`;
      reply = `Dạ ${safeUser} ơi, ${HOST_CHARACTER_NAME} vừa check catalogue thì hiện shop không bán "${lookup.unlistedProductName}" ạ! Để em kiểm tra lại và ghi nhận câu hỏi của bạn vào danh sách chờ nhé!`;
    } else if (
      this.pinnedProduct &&
      !this.pinnedProduct.matched &&
      !lookup.product &&
      !lookup.byCode &&
      !lookup.unlistedProductName &&
      (hasQuestionIntent || hasBuyVerb)
    ) {
      // Uncataloged TikTok pinned item on spotlight: answer ONLY with TikTok-read title + price, never fabricate code/stock!
      const p = this.pinnedProduct;
      intent = 'PINNED_UNCATALOGED';
      checkingText = null;
      reply = `Dạ ${safeUser} ơi, món đang ghim trên TikTok là "${p.title}" có giá TikTok hiển thị ${p.priceText} ạ! Đây là món TikTok đang ghim, chưa có trong catalogue nên ${HOST_CHARACTER_NAME} không bịa mã số hay tồn kho, bạn xem trực tiếp trên giỏ TikTok giúp ${HOST_CHARACTER_NAME} nhé!`;
    } else if (!targetProduct) {
      reply = `Em là ${HOST_CHARACTER_NAME} ạ, ${HOST_CHARACTER_NAME} chào ${safeUser} nha, cảm ơn bạn đã ghé phiên live ạ!`;
    } else {
      const effectivePrice = this.getEffectiveUnitPrice(targetProduct.id);
      const isTargetActive = active && targetProduct.id === active.id;
      const extraTag =
        isTargetActive && this.isExtraDiscountUnlocked()
          ? ' (đã giảm thêm 5% mốc 50 kim cương)'
          : '';
      const otherHint = isOtherProduct
        ? ` Món này chưa lên sóng chính nhưng nếu ${safeUser} muốn mua cứ gõ chốt mã ${targetProduct.code}, ${HOST_CHARACTER_NAME} chuyển sang hoặc thêm vào giỏ hộ ngay nha!`
        : '';

      // 1) Buying intent ("chốt mã 03", "mã 03", "lấy mã 03", "Chốt!", "Lấy 1 cái!")
      if (hasBuyVerb || isStandaloneCodeOrder) {
        intent = 'BUY';
        const textWithoutCode = lower.replace(/(?:mã\s*số|mã|ms)\s*0?\d{1,2}\b/gi, '');
        const qtyMatch = textWithoutCode.match(/\b([1-5])\b/);
        const reqQty = qtyMatch ? Number(qtyMatch[1]) : 1;

        if (isBot) {
          // Demo bot ONLY displays activity in feed + cartViewers — NEVER mutates the real viewer's cart!
          botSimulatedOrder = true;
          this.recordShoppingActivity({
            type: 'add_cart',
            username: safeUser,
            productId: targetProduct.id,
            qty: reqQty,
          });
          reply = `Cảm ơn ${safeUser} đã quan tâm chốt ${targetProduct.codeLabel} (${targetProduct.name}) giá ${formatVnd(effectivePrice)} nha! Kho nhà ${HOST_CHARACTER_NAME} còn ${targetProduct.stock} cái, cả nhà thích món này bấm Thêm giỏ liền tay ạ!`;
        } else {
          const addResult = this.addToCart(targetProduct.id, reqQty, { username: safeUser });
          if (addResult.ok) {
            addedToCart = true;
            addedQty = addResult.added;
            reply = `Dạ ${safeUser} chốt ${targetProduct.codeLabel} (${targetProduct.name}) số lượng ${addedQty} ạ, ${HOST_CHARACTER_NAME} thêm vào giỏ rồi nhé! Giá ${formatVnd(effectivePrice)}, kho còn ${targetProduct.stock} cái ạ!`;
          } else if (addResult.reason === 'CART_LOCKED') {
            reply = `${safeUser} ơi, giỏ hàng đang khóa để hoàn tất đơn hiện tại, hoàn tất xong bạn chốt thêm ${targetProduct.codeLabel} giúp ${HOST_CHARACTER_NAME} nha!`;
          } else if (addResult.reason === 'OUT_OF_STOCK') {
            reply = `Tiếc quá ${safeUser} ơi, ${targetProduct.codeLabel} ${targetProduct.name} vừa hết hàng mất rồi, để ${HOST_CHARACTER_NAME} giới thiệu món khác siêu xinh cho bạn nha!`;
          } else {
            reply = `${safeUser} ơi, giỏ hàng đã có tối đa số lượng tồn kho của ${targetProduct.codeLabel} ${targetProduct.name} rồi, bạn bấm Mua ngay kẻo lỡ nha!`;
          }
        }
      } else {
        // Record shopper inquiry activity in the shopping feed
        if (hasQuestionIntent) {
          this.recordShoppingActivity({
            type: 'ask',
            username: safeUser,
            productId: targetProduct.id,
          });
        }

        // 2) Check for out-of-catalogue question FIRST — NEVER fabricate!
        const missing = this.detectUnknownCatalogQuery(safeText, targetProduct);
        if (missing) {
          intent = 'UNKNOWN_INFO';
          unknownInfo = missing;
          pendingQuestion = {
            id: `Q${this.pendingQuestions.length + 1}`,
            username: safeUser,
            question: safeText,
            productId: targetProduct.id,
            productName: `${targetProduct.codeLabel} ${targetProduct.name}`,
            missingDetail: missing,
            timestamp: Date.now(),
          };
          this.pendingQuestions.push(pendingQuestion);
          reply = `Dạ ${safeUser} ơi, ${HOST_CHARACTER_NAME} vừa check catalogue thì phần "${missing}" của ${targetProduct.codeLabel} ${targetProduct.name} (giá ${formatVnd(effectivePrice)}, còn ${targetProduct.stock} cái) chưa ghi rõ trong catalogue, để em kiểm tra lại rồi báo bạn sau nhé! ${HOST_CHARACTER_NAME} đã ghi nhận câu hỏi vào danh sách chờ rồi ạ!`;
        }
        // 3) Price inquiry (supports accented & accent-free Vietnamese)
        else if (
          /(giá|bao nhiêu|nhiêu tiền|nhiêu vậy|mấy chục|mấy trăm)/i.test(lower) ||
          /(?:^|\s)(?:gia|bao nhieu|nhieu tien|nhieu vay|may chuc|may tram)(?:\s|$)/i.test(normalizeVi(lower))
        ) {
          intent = 'PRICE';
          reply = `Dạ ${safeUser}! ${HOST_CHARACTER_NAME} vừa check catalogue: ${targetProduct.codeLabel} ${targetProduct.name} đang giảm ${targetProduct.discountPercent}% từ ${formatVnd(targetProduct.originalPrice)} chỉ còn ${formatVnd(effectivePrice)}${extraTag}, hiện còn ${targetProduct.stock} cái nha!${otherHint}`;
        }
        // 4) Material / benefit inquiry
        else if (
          /(chất liệu|vải gì|làm bằng|công dụng|dùng sao|có tốt không|mặc mát)/i.test(lower) ||
          /(chat lieu|vai gi|lam bang|cong dung|dung sao|co tot khong|mac mat)/i.test(normalizeVi(lower))
        ) {
          intent = 'MATERIAL';
          reply = `Dạ ${safeUser} ơi, ${HOST_CHARACTER_NAME} vừa check catalogue ${targetProduct.codeLabel} ${targetProduct.name} (giá ${formatVnd(effectivePrice)}, còn ${targetProduct.stock} cái): ${targetProduct.material}. Công dụng: ${targetProduct.benefit} luôn ạ!${otherHint}`;
        }
        // 5) Color / size / flavor / variant inquiry
        else if (
          /(màu|size|cỡ|vị|mẫu|loại khác)/i.test(lower) ||
          /(?:^|\s)(?:mau|size|co|vi|loai khac)(?:\s|$)/i.test(normalizeVi(lower))
        ) {
          intent = 'VARIANT';
          reply = `Dạ ${safeUser} ơi, ${HOST_CHARACTER_NAME} vừa check catalogue ${targetProduct.codeLabel} ${targetProduct.name} (giá ${formatVnd(effectivePrice)}, còn ${targetProduct.stock} cái): ${targetProduct.variants}. ${targetProduct.benefit}!${otherHint}`;
        }
        // 6) Shipping inquiry
        else if (
          /(ship|giao hàng|bao lâu|vận chuyển|nhận được|phí)/i.test(lower) ||
          /(ship|giao hang|bao lau|van chuyen|nhan duoc|phi ship)/i.test(normalizeVi(lower))
        ) {
          intent = 'SHIPPING';
          const shipInfo = this.isFreeshipUnlocked()
            ? 'Hôm nay đã mở mốc 10 kim cương nên đơn hàng được FREESHIP hoàn toàn luôn nha!'
            : 'Phí ship đồng giá 25.000đ, hoặc cả nhà tặng đủ 10 kim cương là mở ngay freeship đó ạ!';
          reply = `Dạ ${safeUser} ơi, ${targetProduct.codeLabel} ${targetProduct.name} (giá ${formatVnd(effectivePrice)}, còn ${targetProduct.stock} cái) được ${HOST_CHARACTER_NAME} gửi đi trong ngày, ship toàn quốc 2 đến 3 ngày nhận được ạ! ${shipInfo}`;
        }
        // 7) Stock inquiry
        else if (
          /(còn hàng|còn không|còn ko|tồn kho|còn mấy|hết chưa)/i.test(lower) ||
          /(con hang|con khong|con ko|ton kho|con may|het chua)/i.test(normalizeVi(lower))
        ) {
          intent = 'STOCK';
          if (targetProduct.stock > 0) {
            reply = `Dạ còn nha ${safeUser}! ${HOST_CHARACTER_NAME} vừa check kho: ${targetProduct.codeLabel} ${targetProduct.name} còn đúng ${targetProduct.stock} cái, giá ${formatVnd(effectivePrice)}, bình luận chốt mã ${targetProduct.code} kẻo hết ạ!${otherHint}`;
          } else {
            reply = `Ôi ${safeUser} ơi, ${targetProduct.codeLabel} ${targetProduct.name} vừa hết sạch kho rồi ạ, chờ ${HOST_CHARACTER_NAME} lên món tiếp theo nha!`;
          }
        }
        // 8) Host name inquiry ("Host tên gì?", "Em tên gì?")
        else if (
          /(tên gì|tên là gì|gọi là gì|tên sao)/i.test(lower) ||
          /(ten gi|ten la gi|goi la gi|ten sao)/i.test(normalizeVi(lower))
        ) {
          intent = 'GENERAL';
          checkingText = null;
          reply = `Dạ ${safeUser} ơi, em là ${HOST_CHARACTER_NAME} ạ! Cảm ơn bạn đã ghé phiên live ${APP_NAME}, hiện ${HOST_CHARACTER_NAME} đang lên deal ${targetProduct.codeLabel} ${targetProduct.name} giá ${formatVnd(effectivePrice)} nha!`;
        }
        // 9) General comment
        else {
          intent = 'GENERAL';
          checkingText = null;
          reply = `${HOST_CHARACTER_NAME} cảm ơn ${safeUser} nha! ${targetProduct.codeLabel} ${targetProduct.name} đang flash sale còn ${formatVnd(effectivePrice)}, còn ${targetProduct.stock} cái — ưng thì gõ chốt mã ${targetProduct.code} liền tay ạ!`;
        }
      }
    }

    this.hostSpeech = reply;
    const result = {
      comment: commentRecord,
      intent,
      isBot,
      addedToCart,
      addedQty,
      botSimulatedOrder,
      reply,
      checkingText,
      checkedProduct: targetProduct,
      isOtherProduct,
      unknownInfo,
      pendingQuestion,
      activeProduct: active,
    };
    this.notify({ type: 'comment', ...result });
    return result;
  }

  setViewerCount(count) {
    this.viewerCount = Math.max(1, Math.floor(Number(count) || 1));
    this.notify({ type: 'viewers', viewerCount: this.viewerCount });
  }

  getRecentViewers(limit = 10) {
    return this.recentViewers.slice(0, limit);
  }

  enqueueViewerJoin(username, avatarUrl = '', nowMs = Date.now()) {
    const safeUser = String(username || '').trim();
    if (!safeUser) return null;

    const avatar = buildAvatarInfo(safeUser, avatarUrl);
    const entry = {
      username: safeUser,
      avatarUrl: avatar.avatarUrl,
      initials: avatar.initials,
      color: avatar.color,
      joinedAt: nowMs,
    };

    this.viewerCount += 1;
    this.recentViewers.unshift(entry);
    if (this.recentViewers.length > 30) this.recentViewers.pop();

    const alreadyQueued = this.pendingJoins.some(
      (m) => m.username.toLowerCase() === safeUser.toLowerCase()
    );
    if (!alreadyQueued) {
      this.pendingJoins.push(entry);
    }

    this.notify({
      type: 'viewer_join_queued',
      member: entry,
      pendingCount: this.pendingJoins.length,
      viewerCount: this.viewerCount,
    });
    return entry;
  }

  flushViewerWelcomes(nowMs = Date.now(), options = {}) {
    const { force = false } = options;
    if (this.pendingJoins.length === 0) return null;
    if (!force && this.lastWelcomeAt > 0 && nowMs - this.lastWelcomeAt < this.welcomeCooldownMs) {
      return null;
    }

    const members = this.pendingJoins.splice(0, this.pendingJoins.length);
    this.lastWelcomeAt = nowMs;
    this.welcomeCount += 1;

    const total = members.length;
    const popupMembers = members.slice(0, 3);
    const extraCount = Math.max(0, total - popupMembers.length);

    let speech = '';
    let feedText = '';
    let popupText = '';

    if (total === 1) {
      const name = members[0].username;
      const alt = this.welcomeCount % 2 === 0;
      if (alt) {
        speech = `${HOST_CHARACTER_NAME} cảm ơn ${name} đã tham gia, ở lại xem hết live cùng ${HOST_CHARACTER_NAME} nhé!`;
        feedText = `👋 Cảm ơn ${name} đã tham gia, ở lại xem hết live nhé!`;
      } else {
        speech = `${HOST_CHARACTER_NAME} chào mừng ${name} đã vào live nhé! Ở lại săn deal cùng ${HOST_CHARACTER_NAME} nha!`;
        feedText = `👋 Chào mừng ${name} đã vào live!`;
      }
      popupText = `👋 ${name} đã vào live!`;
    } else if (total === 2) {
      const [m1, m2] = members;
      speech = `${HOST_CHARACTER_NAME} chào mừng ${m1.username} và ${m2.username} đã vào live nhé! Cảm ơn 2 bạn đã tham gia, ở lại xem hết live cùng ${HOST_CHARACTER_NAME} nha!`;
      feedText = `👋 Chào mừng ${m1.username} và ${m2.username} đã vào live!`;
      popupText = `👋 ${m1.username} và ${m2.username} đã vào live!`;
    } else if (total === 3) {
      const [m1, m2, m3] = members;
      speech = `${HOST_CHARACTER_NAME} chào mừng ${m1.username}, ${m2.username} và ${m3.username} đã vào live nhé!`;
      feedText = `👋 Chào mừng ${m1.username}, ${m2.username} và ${m3.username} đã vào live!`;
      popupText = `👋 ${m1.username}, ${m2.username} và ${m3.username} đã vào live!`;
    } else {
      const [m1, m2] = members;
      const rest = total - 2;
      speech = `${HOST_CHARACTER_NAME} chào mừng ${m1.username}, ${m2.username} và ${rest} bạn nữa đã vào live nhé!`;
      feedText = `👋 Chào mừng ${m1.username}, ${m2.username} và ${rest} bạn nữa đã vào live!`;
      popupText = `👋 ${m1.username}, ${m2.username} và ${rest} bạn nữa đã vào live!`;
    }

    const record = {
      id: `W${this.welcomeCount}`,
      members,
      popupMembers,
      extraCount,
      total,
      speech,
      feedText,
      popupText,
      timestamp: nowMs,
    };

    this.welcomeHistory.push(record);
    if (this.welcomeHistory.length > 30) this.welcomeHistory.shift();

    this.latestComment = {
      username: total === 1 ? members[0].username : `${members[0].username} +${total - 1}`,
      text: feedText,
      isWelcome: true,
      timestamp: nowMs,
    };
    this.hostSpeech = speech;

    this.notify({ type: 'viewer_welcome', welcome: record });
    return record;
  }
}

export function normalizeVi(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeWord(haystack, word) {
  const re = new RegExp(`(?:^|[\\s,.;:!?()\\[\\]"'“”])${escapeRegExp(word)}(?:$|[\\s,.;:!?()\\[\\]"'“”])`, 'i');
  return re.test(haystack);
}

const GENERIC_NON_PRODUCT_PHRASES = new Set([
  '',
  'mon nay',
  'cai nay',
  'sp nay',
  'san pham nay',
  'em nay',
  'mau nay',
  'hang nay',
  'do nay',
  'loai nay',
  'cay nay',
  'no',
  'nay',
  'do',
  'kia',
  'mon do',
  'cai do',
  'shop',
  'shop oi',
  'em oi',
  'chi oi',
  'anh oi',
  'ban oi',
  'ad',
  'ad oi',
  'host',
  'host oi',
  'host ban hang',
  'host ngoc',
  'ngoc',
  'ngoc oi',
  'em ngoc',
  'chi ngoc',
  'ban ngoc',
  'em',
  'chi',
  'anh',
  'minh',
  'ban',
  'toi',
  'tui',
  'ca nha',
  'cho em',
  'cho minh',
  'cho chi',
  'cho anh',
  'cho hoi',
  'cho em hoi',
  'hoi',
  'hoi ti',
  'hoi xiu',
  'gia',
  'ship',
  'mau',
  'size',
  'co',
  'hang',
  'con',
  'chat lieu',
  'cong dung',
  'phi',
  'phi ship',
  'giao hang',
  'van chuyen',
  'ngay',
  'luon',
  'cai',
  'chiec',
  'mon',
  'bo',
  'set',
  'nha',
  'nhe',
  'a',
  'oi',
  'voi',
  'di',
  'sao',
  'vay',
  'the',
  'ha',
  'khong',
  'ko',
  'k',
  'chua',
  'bao lau',
  'bao nhieu',
]);

function cleanCandidatePhrase(phrase) {
  let s = String(phrase || '')
    .replace(/[?!.,;:()\[\]"'“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip common conversational prefixes
  const leadRe =
    /^(?:dạ|vâng|alo|ơi|shop ơi|shop|em ơi|chị ơi|anh ơi|bạn ơi|host ơi|host bán hàng|host ngọc|ngọc ơi|em ngọc|chị ngọc|bạn ngọc|ngọc|cho em hỏi|cho mình hỏi|cho chị hỏi|cho anh hỏi|cho hỏi|em hỏi|mình hỏi|chị hỏi|anh hỏi|hỏi về|hỏi|em muốn mua|mình muốn mua|muốn mua|có bán|bán|cái|chiếc|món|sản phẩm|sp|em|chị|anh|mình|bạn)\s+/i;
  for (let i = 0; i < 4; i++) {
    const next = s.replace(leadRe, '').trim();
    if (next === s) break;
    s = next;
  }

  // Strip common trailing particles & quantities
  const trailRe =
    /\s+(?:ơi|nha|nhé|ạ|vậy|thế|hả|không|ko|k|chưa|ngay|luôn|với|đi|giúp em|hộ em|shop|này|đó|kia|1|2|3|4|5|cái|chiếc|món)$/i;
  for (let i = 0; i < 4; i++) {
    const next = s.replace(trailRe, '').trim();
    if (next === s) break;
    s = next;
  }

  return s.trim();
}

export function extractUnlistedProductName(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const stopHeadRe = /^(?:gia|bao nhieu|nhieu tien|mau|size|ship|con hang|con khong|chat lieu|cong dung)(?:\s|$)/i;

  // Pattern A: "shop có bán <X> không?", "bán <X> không?", "hỏi về <X>"
  const afterVerbPatterns = [
    /(?:có\s+bán|bán|hỏi\s+về)\s+([^?!.,]{2,40}?)(?:\s+(?:không|ko|k(?=\s|[?!.,]|$)|chưa|giá(?=\s|[?!.,]|$)|bao nhiêu|còn|màu|size|ship|nha|nhé|ạ|vậy|shop)|[?!.,]|$)/i,
    /(?:chốt|mua|lấy|đặt)\s+(?:\d+\s*(?:cái|chiếc|món)?\s+)?([^?!.,]{2,36}?)(?:\s+(?:nha|nhé|ạ|ngay|luôn|đi|với|giúp|hộ|shop)|[?!.,]|$)/i,
  ];
  for (const re of afterVerbPatterns) {
    const m = raw.match(re);
    if (m && m[1]) {
      const cand = cleanCandidatePhrase(m[1]);
      const norm = normalizeVi(cand);
      if (
        cand.length >= 2 &&
        !/^\d+$/.test(norm) &&
        !GENERIC_NON_PRODUCT_PHRASES.has(norm) &&
        !stopHeadRe.test(norm)
      ) {
        return cand;
      }
    }
  }

  // Pattern B: "<X> giá bao nhiêu?", "<X> còn hàng không?", "<X> có màu gì?", "<X> có bán không?"
  const beforeQMatch = raw.match(
    /^([^?!.,]{2,45}?)\s+(?:giá(?=\s|[?!.,]|$)|bao nhiêu|nhiêu tiền|nhiêu vậy|mấy trăm|mấy chục|còn hàng|còn không|còn ko|tồn kho|có màu|màu gì|có size|size gì|chất liệu|vải gì|làm bằng|công dụng|ship(?=\s|[?!.,]|$)|giao hàng|có bán|bán không|hạn sử dụng|hsd|xuất xứ|bảo hành)/i
  );
  if (beforeQMatch && beforeQMatch[1]) {
    const cand = cleanCandidatePhrase(beforeQMatch[1]);
    const norm = normalizeVi(cand);
    if (
      cand.length >= 2 &&
      !/^\d+$/.test(norm) &&
      !GENERIC_NON_PRODUCT_PHRASES.has(norm) &&
      !stopHeadRe.test(norm)
    ) {
      return cand;
    }
  }

  return null;
}

