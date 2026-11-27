/**
 * HostCanvasRenderer — High-craft animated 2D full-body character ("Host bán hàng")
 * modeled directly after reference photo public/assets/host.png:
 * - Young Asian woman, long straight black hair past shoulders with wispy side bangs
 * - Fair skin, cute round face, soft rosy cheeks, expressive blinking eyes
 * - White short puff-sleeve blouse + braided woven crossbody bag
 * - Blue denim shorts + white sneakers + left hand holding iced milk coffee cup
 * - Event-driven living animations: TTS lip-sync mouth + head nod, idle breathing/blinking,
 *   wave (viewer join), point (product pitch), ok_answer (Q&A), cart_confirm (chốt mã),
 *   celebrate_gift (gift), celebrate_order (order success + confetti).
 */
export class HostCanvasRenderer {
  constructor(stageCanvas, confettiCanvas, gestureBadgeEl) {
    this.canvas = stageCanvas;
    this.ctx = stageCanvas ? stageCanvas.getContext('2d') : null;
    this.confettiCanvas = confettiCanvas;
    this.confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
    this.gestureBadgeEl =
      gestureBadgeEl ||
      (typeof document !== 'undefined' ? document.getElementById('hostGestureBadge') : null);

    this.width = stageCanvas ? stageCanvas.width : 1080;
    this.height = stageCanvas ? stageCanvas.height : 924;

    this.isSpeaking = false;
    this.isPaused = false;
    this.gesture = 'idle';
    this.gestureUntil = 0;

    // Smoothly interpolated animation channels (prevents sudden snapping)
    this.mouthOpen = 0;
    this.headNod = 0;
    this.jumpY = 0;
    this.rightHandCur = { x: 405, y: 470 };
    this.rightElbowCur = { x: 365, y: 485 };

    // Natural eye blink
    this.nextBlinkAt = performance.now() + 2100;
    this.blinkProgress = 0;
    this.blinkCount = 0;

    // Telemetry for playtest verification of event-driven animations
    this.animationHistory = [];
    this.triggeredGestures = new Set();

    // Particles & confetti
    this.particles = [];
    this.confetti = [];

    this.rafId = null;
    this.lastTime = performance.now();
  }

  start() {
    if (this.rafId) return;
    this.lastTime = performance.now();
    this._updateGestureBadge();
    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      if (!this.isPaused) {
        this._update(now, dt);
      }
      this._render(now);
      this._renderConfetti(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setSpeaking(speaking) {
    const next = Boolean(speaking);
    if (next !== this.isSpeaking) {
      this.isSpeaking = next;
      this.animationHistory.push({
        type: next ? 'talk_start' : 'talk_end',
        ts: Date.now(),
      });
      if (this.animationHistory.length > 120) this.animationHistory.shift();
    }
  }

  setPaused(paused) {
    this.isPaused = Boolean(paused);
  }

  triggerGesture(gesture = 'wave', durationMs = 2800) {
    this.gesture = gesture;
    this.gestureUntil = durationMs > 0 ? performance.now() + durationMs : 0;
    this.triggeredGestures.add(gesture);
    this.animationHistory.push({ type: 'gesture', gesture, ts: Date.now() });
    if (this.animationHistory.length > 120) this.animationHistory.shift();
    this._updateGestureBadge();
  }

  getAnimationState() {
    return {
      gesture: this.gesture,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      mouthOpen: Number(this.mouthOpen.toFixed(3)),
      headNod: Number(this.headNod.toFixed(3)),
      jumpY: Number(this.jumpY.toFixed(2)),
      blinkProgress: Number(this.blinkProgress.toFixed(3)),
      blinkCount: this.blinkCount,
      triggeredGestures: Array.from(this.triggeredGestures),
      history: this.animationHistory.slice(-120),
    };
  }

  _updateGestureBadge() {
    if (!this.gestureBadgeEl) return;
    const map = {
      idle: { text: '✨ Sẵn sàng tư vấn', cls: 'badge-idle' },
      wave: { text: '👋 Chào bạn mới!', cls: 'badge-wave' },
      point: { text: '👉 Xem deal ngay!', cls: 'badge-point' },
      ok_answer: { text: '👌 Tư vấn chuẩn!', cls: 'badge-ok' },
      cart_confirm: { text: '🛒 Đã chốt vào giỏ!', cls: 'badge-cart' },
      celebrate_gift: { text: '💖 Cảm ơn quà!', cls: 'badge-celebrate' },
      celebrate_order: { text: '🎉 Chốt đơn thành công!', cls: 'badge-celebrate' },
    };
    const info = map[this.gesture] || map.idle;
    this.gestureBadgeEl.textContent = info.text;
    this.gestureBadgeEl.className = `host-gesture-badge ${info.cls}`;
  }

  spawnFloatingHearts(count = 7, color = '#fb7185') {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: 282 + (Math.random() - 0.5) * 190,
        y: 440 + (Math.random() - 0.5) * 90,
        vx: (Math.random() - 0.5) * 44,
        vy: -58 - Math.random() * 68,
        size: 13 + Math.random() * 10,
        alpha: 1,
        color,
        kind: i % 2 === 0 ? 'heart' : 'star',
      });
    }
  }

  burstConfetti(count = 120) {
    if (!this.confettiCanvas) return;
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#facc15', '#fb7185'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 280 + Math.random() * 520;
      this.confetti.push({
        x: this.confettiCanvas.width * (0.25 + Math.random() * 0.5),
        y: this.confettiCanvas.height * 0.36,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        size: 8 + Math.random() * 10,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        life: 1,
      });
    }
  }

  _update(now, dt) {
    const t = now / 1000;

    // Periodic natural eye blink
    if (now >= this.nextBlinkAt) {
      this.blinkProgress += dt * 10.5;
      if (this.blinkProgress >= Math.PI) {
        this.blinkProgress = 0;
        this.blinkCount += 1;
        this.nextBlinkAt = now + 2600 + Math.random() * 2100;
      }
    }

    // Gesture expiration returns smoothly to calm idle
    if (this.gestureUntil > 0 && now > this.gestureUntil) {
      this.gesture = 'idle';
      this.gestureUntil = 0;
      this._updateGestureBadge();
    }

    // Lip-sync mouth open/closed + head nod synced to TTS speaking
    const targetMouth = this.isSpeaking
      ? 0.25 + Math.abs(Math.sin(t * 14.5) * 0.55 + Math.sin(t * 23.0) * 0.28)
      : 0;
    this.mouthOpen += (targetMouth - this.mouthOpen) * Math.min(1, dt * 18);

    let targetNod = 0;
    if (this.gesture === 'ok_answer' || this.gesture === 'cart_confirm') {
      targetNod = Math.sin(t * 8.5) * 0.11;
    } else if (this.isSpeaking) {
      targetNod = Math.sin(t * 5.2) * 0.055;
    } else {
      targetNod = Math.sin(t * 1.5) * 0.015;
    }
    this.headNod += (targetNod - this.headNod) * Math.min(1, dt * 12);

    // Joyful hop during gift / order celebrations
    const isCelebrating =
      this.gesture === 'celebrate_gift' || this.gesture === 'celebrate_order';
    const targetJump = isCelebrating ? -Math.abs(Math.sin(t * 8.0)) * 16 : 0;
    this.jumpY += (targetJump - this.jumpY) * Math.min(1, dt * 14);

    // Update floating particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 0.52;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
  }

  _renderConfetti(dt) {
    if (!this.confettiCtx || !this.confettiCanvas) return;
    const c = this.confettiCtx;
    c.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
    if (this.confetti.length === 0) return;

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const p = this.confetti[i];
      if (!this.isPaused) {
        p.vy += 680 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.life -= dt * 0.34;
      }
      if (p.life <= 0 || p.y > this.confettiCanvas.height + 40) {
        this.confetti.splice(i, 1);
        continue;
      }
      c.save();
      c.globalAlpha = Math.max(0, Math.min(1, p.life));
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      c.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      c.restore();
    }
  }

  _render(now) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    this._drawFabricMarketStudioBg(ctx, w, h, now);
    this._drawDisplayShelfAndCounter(ctx, w, h);
    this._draw2DFullBodyHost(ctx, now);
    this._drawParticles(ctx);
  }

  _drawFabricMarketStudioBg(ctx, w, h, now) {
    // Warm sunlit boutique & fabric-market studio backdrop
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h * 0.82);
    wallGrad.addColorStop(0, '#FFF8F1');
    wallGrad.addColorStop(0.65, '#FDEEE2');
    wallGrad.addColorStop(1, '#F7DCC8');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle festive market bunting pennants high up (warm nod to chợ vải photo!)
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 130, 95, 0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.quadraticCurveTo(280, 74, 560, 22);
    ctx.stroke();

    const flagColors = ['#F87171', '#FBBF24', '#60A5FA', '#34D399', '#F472B6'];
    for (let i = 0; i < 9; i++) {
      const fx = 36 + i * 58;
      const fy = 30 + Math.sin((i / 8) * Math.PI) * 26;
      ctx.fillStyle = flagColors[i % flagColors.length];
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(fx - 12, fy);
      ctx.lineTo(fx + 12, fy);
      ctx.lineTo(fx, fy + 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Soft studio ring-light halo behind host
    const halo = ctx.createRadialGradient(288, 430, 40, 288, 430, 390);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
    halo.addColorStop(0.58, 'rgba(255, 232, 214, 0.3)');
    halo.addColorStop(1, 'rgba(255, 232, 214, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // Soft cream archway behind host
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.beginPath();
    ctx.arc(288, 345, 210, Math.PI, 0);
    ctx.lineTo(498, h * 0.8);
    ctx.lineTo(78, h * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Warm tiled-wood boutique floor
    const floorY = h * 0.8;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
    floorGrad.addColorStop(0, '#E8C6A2');
    floorGrad.addColorStop(1, '#D3A97F');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, w, h - floorY);

    ctx.fillStyle = '#FFF9F3';
    ctx.fillRect(0, floorY - 12, w, 12);
    ctx.fillStyle = 'rgba(146, 98, 57, 0.14)';
    ctx.fillRect(0, floorY, w, 4);

    // Subtle warm market tile grid perspective lines
    ctx.strokeStyle = 'rgba(139, 94, 52, 0.14)';
    ctx.lineWidth = 2;
    for (let y = floorY + 34; y < h; y += 38) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  _drawDisplayShelfAndCounter(ctx, w, h) {
    const floorY = h * 0.8;
    ctx.save();

    // Left fabric & product shelf (inspired by the stacked fabrics in host.png)
    const sx = 28;
    const sw = 152;
    const sy = 285;
    ctx.fillStyle = '#F2D5B6';
    ctx.strokeStyle = '#C79769';
    ctx.lineWidth = 3;
    this._roundRect(ctx, sx, sy, sw, 315, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFF8F0';
    this._roundRect(ctx, sx + 10, sy + 12, sw - 20, 290, 8);
    ctx.fill();

    // Shelf boards
    for (const ty of [sy + 106, sy + 204]) {
      ctx.fillStyle = '#D9AA7C';
      ctx.fillRect(sx + 8, ty, sw - 16, 10);
    }

    // Tier 1: stacked colorful fabric bolts (chợ vải signature!)
    const bolts1 = [
      { y: sy + 82, c: '#F472B6' },
      { y: sy + 64, c: '#60A5FA' },
      { y: sy + 46, c: '#FBBF24' },
    ];
    for (const b of bolts1) {
      ctx.fillStyle = b.c;
      this._roundRect(ctx, sx + 20, b.y, 64, 18, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#14B8A6';
    this._roundRect(ctx, sx + 96, sy + 52, 34, 52, 8);
    ctx.fill();

    // Tier 2: folded floral cloth + cosmetics jars
    ctx.fillStyle = '#FCA5A5';
    this._roundRect(ctx, sx + 22, sy + 178, 54, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#A5B4FC';
    this._roundRect(ctx, sx + 26, sy + 158, 46, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    this._roundRect(ctx, sx + 88, sy + 162, 38, 38, 10);
    ctx.fill();

    // Tier 3: woven straw basket & gift box
    ctx.fillStyle = '#D97706';
    this._roundRect(ctx, sx + 22, sy + 244, 62, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#FB7185';
    this._roundRect(ctx, sx + 92, sy + 252, 36, 38, 7);
    ctx.fill();

    // Right boutique counter under spotlight product card
    const cx = 504;
    const cy = floorY - 188;
    const cw = 548;
    const ch = 192;
    ctx.fillStyle = '#F7DFC6';
    ctx.strokeStyle = '#CCA074';
    ctx.lineWidth = 3;
    this._roundRect(ctx, cx, cy, cw, ch, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E0B284';
    this._roundRect(ctx, cx - 10, cy - 12, cw + 20, 26, 10);
    ctx.fill();
    ctx.strokeStyle = '#B8875B';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(184, 135, 91, 0.26)';
    ctx.lineWidth = 2;
    for (let x = cx + 28; x < cx + cw - 18; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, cy + 28);
      ctx.lineTo(x, cy + ch - 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  _draw2DFullBodyHost(ctx, now) {
    const t = now / 1000;
    const breathe = Math.sin(t * 2.3) * 3.2;
    const sway = Math.sin(t * 1.35) * 2.5;
    const jump = this.jumpY;

    const baseX = 294;
    const footY = this.height * 0.875 + jump;
    const groundY = this.height * 0.875;

    ctx.save();

    // Soft ground shadow (shrinks slightly when she hops in celebration!)
    const shadowScale = Math.max(0.76, 1 + jump / 90);
    ctx.fillStyle = 'rgba(116, 70, 36, 0.22)';
    ctx.beginPath();
    ctx.ellipse(baseX, groundY + 6, 84 * shadowScale, 17 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    const hipY = footY - 208 + breathe * 0.4;
    const waistY = hipY - 46;
    const shoulderY = waistY - 120 + breathe * 0.65;
    const headY = shoulderY - 76 + breathe * 0.75;
    const headX = baseX + sway * 0.55;

    const skin = '#FFE7DC';
    const skinShade = '#F3C7B4';

    // 1) LONG STRAIGHT BLACK HAIR (back layer past shoulders)
    ctx.save();
    const hairGrad = ctx.createLinearGradient(headX, headY - 60, headX, shoulderY + 145);
    hairGrad.addColorStop(0, '#27242C');
    hairGrad.addColorStop(1, '#141318');
    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.moveTo(headX - 66, headY - 8);
    ctx.quadraticCurveTo(headX - 78, shoulderY + 58, headX - 68, shoulderY + 132);
    ctx.quadraticCurveTo(headX - 34, shoulderY + 146, headX, shoulderY + 138);
    ctx.quadraticCurveTo(headX + 36, shoulderY + 146, headX + 70, shoulderY + 130);
    ctx.quadraticCurveTo(headX + 78, shoulderY + 56, headX + 66, headY - 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2) LEGS (fair skin, slim natural standing pose)
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(baseX - 40, hipY + 36);
    ctx.lineTo(baseX - 10, hipY + 36);
    ctx.lineTo(baseX - 16, footY - 26);
    ctx.lineTo(baseX - 38, footY - 26);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(baseX + 10, hipY + 36);
    ctx.lineTo(baseX + 40, hipY + 36);
    ctx.lineTo(baseX + 38, footY - 26);
    ctx.lineTo(baseX + 16, footY - 26);
    ctx.closePath();
    ctx.fill();

    // Subtle knee blush
    ctx.fillStyle = 'rgba(244, 152, 146, 0.22)';
    ctx.beginPath();
    ctx.ellipse(baseX - 26, hipY + 114, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(baseX + 26, hipY + 114, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // White ankle socks
    ctx.fillStyle = '#F8FAFC';
    this._roundRect(ctx, baseX - 40, footY - 44, 26, 20, 6);
    ctx.fill();
    this._roundRect(ctx, baseX + 14, footY - 44, 26, 20, 6);
    ctx.fill();

    // 3) WHITE SNEAKERS (giày sneaker trắng giống ảnh thật)
    this._drawSneaker(ctx, baseX - 28, footY - 9, -1);
    this._drawSneaker(ctx, baseX + 28, footY - 9, 1);

    // 4) BLUE DENIM SHORTS (quần short jeans xanh wash nhẹ giống ảnh thật)
    ctx.save();
    const denimGrad = ctx.createLinearGradient(baseX - 58, waistY, baseX + 58, hipY + 62);
    denimGrad.addColorStop(0, '#5B8EE6');
    denimGrad.addColorStop(0.55, '#4175D3');
    denimGrad.addColorStop(1, '#315FB5');
    ctx.fillStyle = denimGrad;
    ctx.strokeStyle = '#22478E';
    ctx.lineWidth = 2.8;

    ctx.beginPath();
    ctx.moveTo(baseX - 47, waistY + 6);
    ctx.lineTo(baseX + 47, waistY + 6);
    ctx.lineTo(baseX + 58, hipY + 63);
    ctx.lineTo(baseX + 7, hipY + 65);
    ctx.lineTo(baseX, hipY + 38);
    ctx.lineTo(baseX - 7, hipY + 65);
    ctx.lineTo(baseX - 58, hipY + 63);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Light denim wash highlights
    ctx.fillStyle = 'rgba(219, 234, 254, 0.22)';
    ctx.beginPath();
    ctx.ellipse(baseX - 28, hipY + 36, 14, 18, 0.1, 0, Math.PI * 2);
    ctx.ellipse(baseX + 28, hipY + 36, 14, 18, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Waistband, button & contrast stitching
    ctx.fillStyle = '#2F60BA';
    ctx.fillRect(baseX - 47, waistY + 6, 94, 15);
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(baseX, waistY + 13.5, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(219, 234, 254, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(baseX - 44, waistY + 25);
    ctx.quadraticCurveTo(baseX - 36, waistY + 44, baseX - 18, waistY + 40);
    ctx.moveTo(baseX + 44, waistY + 25);
    ctx.quadraticCurveTo(baseX + 36, waistY + 44, baseX + 18, waistY + 40);
    ctx.moveTo(baseX, waistY + 21);
    ctx.lineTo(baseX, hipY + 35);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 5) WHITE SHORT PUFF-SLEEVE TOP (áo trắng tay phồng ngắn giống ảnh thật)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DDD2CA';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(baseX - 42 + sway * 0.3, shoulderY + 6);
    ctx.quadraticCurveTo(baseX + sway * 0.3, shoulderY + 32, baseX + 42 + sway * 0.3, shoulderY + 6);
    ctx.lineTo(baseX + 51, waistY + 15);
    ctx.quadraticCurveTo(baseX, waistY + 23, baseX - 51, waistY + 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft round neckline shadow & gentle vertical fabric folds
    ctx.strokeStyle = '#ECE2DC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(baseX - 24 + sway * 0.25, shoulderY + 12);
    ctx.quadraticCurveTo(baseX + sway * 0.25, shoulderY + 36, baseX + 24 + sway * 0.25, shoulderY + 12);
    ctx.moveTo(baseX - 18, shoulderY + 64);
    ctx.quadraticCurveTo(baseX - 20, waistY - 12, baseX - 15, waistY + 12);
    ctx.moveTo(baseX + 16, shoulderY + 68);
    ctx.quadraticCurveTo(baseX + 18, waistY - 10, baseX + 14, waistY + 12);
    ctx.stroke();
    ctx.restore();

    // 6) WOVEN CROSSBODY BAG (túi đeo chéo đan giống hệt ảnh thật!)
    const bagSway = Math.sin(t * 2.1) * 2.2;
    const bagX = baseX - 55 + bagSway;
    const bagY = hipY + 14;
    ctx.save();
    // Diagonal braided strap from right shoulder to left hip
    ctx.strokeStyle = '#C59657';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX + 34 + sway * 0.3, shoulderY + 12);
    ctx.quadraticCurveTo(baseX - 6, waistY - 18, bagX + 12, bagY - 22);
    ctx.stroke();
    ctx.strokeStyle = '#EBD09F';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(baseX + 34 + sway * 0.3, shoulderY + 12);
    ctx.quadraticCurveTo(baseX - 6, waistY - 18, bagX + 12, bagY - 22);
    ctx.stroke();
    ctx.setLineDash([]);

    // Round woven rattan crossbody bag body
    ctx.fillStyle = '#E8C58E';
    ctx.strokeStyle = '#B07D42';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(bagX, bagY, 24, 27, 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Woven texture arcs
    ctx.strokeStyle = '#C79556';
    ctx.lineWidth = 1.8;
    for (let r = 8; r <= 20; r += 6) {
      ctx.beginPath();
      ctx.ellipse(bagX, bagY, r * 0.85, r, 0.14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 7) LEFT ARM (viewer's left) HOLDING ICED MILK COFFEE CUP (ly cà phê đá giống ảnh thật!)
    const coffeeBob = Math.sin(t * 2.3) * 3.5;
    const leftShoulderX = baseX - 48 + sway * 0.3;
    const leftShoulderY = shoulderY + 20;
    const leftHandX = baseX - 102 + sway * 0.35;
    const leftHandY = shoulderY + 106 + coffeeBob;

    ctx.save();
    // Left puff sleeve
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DDD2CA';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(leftShoulderX - 10, leftShoulderY + 16, 28, 30, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Left forearm
    ctx.strokeStyle = skin;
    ctx.lineWidth = 19;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(leftShoulderX - 18, leftShoulderY + 36);
    ctx.quadraticCurveTo(leftShoulderX - 48, leftShoulderY + 78, leftHandX, leftHandY);
    ctx.stroke();

    // Hand holding iced coffee cup
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(leftHandX, leftHandY, 12.5, 0, Math.PI * 2);
    ctx.fill();
    this._drawIcedCoffeeCup(ctx, leftHandX - 4, leftHandY - 6);
    ctx.restore();

    // 8) RIGHT ARM (viewer's right) — EVENT-DRIVEN SMOOTH LERP ANIMATIONS!
    const rightShoulderX = baseX + 48 + sway * 0.3;
    const rightShoulderY = shoulderY + 20;

    let targetElbow = { x: rightShoulderX + 30, y: rightShoulderY + 66 };
    let targetHand = { x: rightShoulderX + 54, y: rightShoulderY + 114 + Math.sin(t * 2.2) * 4 };

    if (this.gesture === 'wave') {
      const waveSwing = Math.sin(t * 11.5) * 28;
      targetElbow = { x: rightShoulderX + 52, y: rightShoulderY + 14 };
      targetHand = { x: rightShoulderX + 82 + waveSwing, y: rightShoulderY - 62 };
    } else if (this.gesture === 'point') {
      targetElbow = { x: rightShoulderX + 44, y: rightShoulderY + 46 };
      targetHand = { x: rightShoulderX + 116, y: rightShoulderY + 12 + Math.sin(t * 4.0) * 6 };
    } else if (this.gesture === 'ok_answer') {
      targetElbow = { x: rightShoulderX + 44, y: rightShoulderY + 34 };
      targetHand = { x: rightShoulderX + 78, y: rightShoulderY - 22 + Math.sin(t * 5.0) * 5 };
    } else if (this.gesture === 'cart_confirm') {
      targetElbow = { x: rightShoulderX + 48, y: rightShoulderY + 20 };
      targetHand = { x: rightShoulderX + 106, y: rightShoulderY - 46 + Math.sin(t * 6.0) * 6 };
    } else if (this.gesture === 'celebrate_gift' || this.gesture === 'celebrate_order') {
      const cheer = Math.sin(t * 10) * 16;
      targetElbow = { x: rightShoulderX + 48, y: rightShoulderY - 8 };
      targetHand = { x: rightShoulderX + 72, y: rightShoulderY - 84 + cheer };
    } else if (this.isSpeaking) {
      // Expressive subtle hand motion while talking
      targetElbow = { x: rightShoulderX + 36, y: rightShoulderY + 56 };
      targetHand = {
        x: rightShoulderX + 76 + Math.sin(t * 4.2) * 10,
        y: rightShoulderY + 52 + Math.cos(t * 3.8) * 10,
      };
    }

    // Smooth lerp so transitions between gestures never jump
    this.rightElbowCur.x += (targetElbow.x - this.rightElbowCur.x) * 0.22;
    this.rightElbowCur.y += (targetElbow.y - this.rightElbowCur.y) * 0.22;
    this.rightHandCur.x += (targetHand.x - this.rightHandCur.x) * 0.22;
    this.rightHandCur.y += (targetHand.y - this.rightHandCur.y) * 0.22;

    ctx.save();
    // Right puff sleeve
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DDD2CA';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(rightShoulderX + 10, rightShoulderY + 16, 28, 30, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right arm
    ctx.strokeStyle = skin;
    ctx.lineWidth = 19;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(rightShoulderX + 16, rightShoulderY + 34);
    ctx.quadraticCurveTo(
      this.rightElbowCur.x,
      this.rightElbowCur.y,
      this.rightHandCur.x,
      this.rightHandCur.y
    );
    ctx.stroke();

    // Right hand & expressive gesture shapes
    const hx = this.rightHandCur.x;
    const hy = this.rightHandCur.y;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 12.5, 0, Math.PI * 2);
    ctx.fill();

    if (this.gesture === 'point') {
      // Pointing finger toward spotlight product card
      ctx.strokeStyle = skin;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(hx + 5, hy - 2);
      ctx.lineTo(hx + 28, hy - 5);
      ctx.stroke();
      // Subtle directional sparkle
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(hx + 38, hy - 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.gesture === 'wave') {
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(hx + 16, hy - 10, 14, -0.9, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx + 22, hy - 12, 22, -0.8, 0.4);
      ctx.stroke();
    } else if (this.gesture === 'ok_answer') {
      // Cute OK hand gesture ring + 3 fingers up
      ctx.strokeStyle = '#E5B29C';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(hx + 4, hy + 1, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = skin;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 8);
      ctx.lineTo(hx - 7, hy - 22);
      ctx.moveTo(hx + 3, hy - 10);
      ctx.lineTo(hx + 4, hy - 24);
      ctx.moveTo(hx + 9, hy - 8);
      ctx.lineTo(hx + 14, hy - 20);
      ctx.stroke();
    } else if (this.gesture === 'cart_confirm') {
      // Pointing up-right toward cart
      ctx.strokeStyle = skin;
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(hx + 4, hy - 4);
      ctx.lineTo(hx + 22, hy - 18);
      ctx.stroke();
    }
    ctx.restore();

    // 9) NECK & EXPRESSIVE HEAD (rotates smoothly with headNod!)
    ctx.fillStyle = skinShade;
    this._roundRect(ctx, headX - 13, shoulderY - 18, 26, 34, 10);
    ctx.fill();

    ctx.save();
    ctx.translate(headX, headY + 34);
    ctx.rotate(this.headNod);
    ctx.translate(-headX, -(headY + 34));

    // Ears
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(headX - 50, headY + 4, 8.5, 12.5, 0, 0, Math.PI * 2);
    ctx.ellipse(headX + 50, headY + 4, 8.5, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute round face
    ctx.beginPath();
    ctx.ellipse(headX, headY, 52, 51, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft rosy cheeks (má hồng nhẹ giống ảnh mẫu)
    ctx.fillStyle = 'rgba(251, 113, 133, 0.34)';
    ctx.beginPath();
    ctx.ellipse(headX - 27, headY + 14, 13, 7.5, 0, 0, Math.PI * 2);
    ctx.ellipse(headX + 27, headY + 14, 13, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = '#2B262B';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(headX - 31, headY - 17);
    ctx.quadraticCurveTo(headX - 21, headY - 22, headX - 11, headY - 18);
    ctx.moveTo(headX + 11, headY - 18);
    ctx.quadraticCurveTo(headX + 21, headY - 22, headX + 31, headY - 17);
    ctx.stroke();

    // Eyes — happy curved ^ ^ eyes when celebrating, natural blinking eyes otherwise
    const happyEyes =
      this.gesture === 'celebrate_gift' || this.gesture === 'celebrate_order';
    if (happyEyes) {
      ctx.strokeStyle = '#1E1B22';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(headX - 21, headY + 1, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(headX + 21, headY + 1, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      const eyeScaleY = Math.max(0.08, 1 - Math.sin(this.blinkProgress));
      this._drawEye(ctx, headX - 21, headY - 2, eyeScaleY);
      this._drawEye(ctx, headX + 21, headY - 2, eyeScaleY);
    }

    // Subtle nose
    ctx.strokeStyle = '#E5B29C';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(headX - 1, headY + 6);
    ctx.quadraticCurveTo(headX + 1.5, headY + 9.5, headX - 1.5, headY + 11);
    ctx.stroke();

    // MOUTH — Smooth lip-sync animation synced with TTS!
    if (this.mouthOpen > 0.08) {
      const openH = 3.5 + this.mouthOpen * 10.5;
      const openW = 8.5 + this.mouthOpen * 3.5;
      ctx.fillStyle = '#D93B5B';
      ctx.beginPath();
      ctx.ellipse(headX, headY + 24, openW, openH, 0, 0, Math.PI * 2);
      ctx.fill();
      // Upper teeth gleam
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(headX, headY + 24 - openH * 0.55, openW * 0.62, Math.min(3, openH * 0.35), 0, 0, Math.PI * 2);
      ctx.fill();
      // Cute tongue hint
      ctx.fillStyle = '#FDA4AF';
      ctx.beginPath();
      ctx.ellipse(headX, headY + 24 + openH * 0.42, openW * 0.52, Math.max(2, openH * 0.35), 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Warm gentle smile (bigger when waving or celebrating)
      const wide = this.gesture === 'wave' || happyEyes ? 14 : 11.5;
      ctx.strokeStyle = '#D9536F';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(headX, headY + 17, wide, 0.22 * Math.PI, 0.78 * Math.PI);
      ctx.stroke();
    }

    // 10) FRONT LONG STRAIGHT BLACK HAIR + WISPY SIDE BANGS + SIGNATURE SHOULDER LOCK (from host.png)
    ctx.fillStyle = '#18161D';
    // Crown
    ctx.beginPath();
    ctx.arc(headX, headY - 12, 57, Math.PI * 0.96, Math.PI * 0.04, false);
    ctx.closePath();
    ctx.fill();

    // Soft side-parted wispy bangs (like reference photo!)
    ctx.beginPath();
    ctx.moveTo(headX - 54, headY - 22);
    ctx.quadraticCurveTo(headX - 30, headY - 8, headX - 8, headY - 34);
    ctx.quadraticCurveTo(headX + 20, headY - 10, headX + 54, headY - 20);
    ctx.lineTo(headX + 54, headY - 40);
    ctx.lineTo(headX - 54, headY - 40);
    ctx.closePath();
    ctx.fill();

    // Wispy forehead strands
    ctx.strokeStyle = '#18161D';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(headX - 18, headY - 44);
    ctx.quadraticCurveTo(headX - 24, headY - 22, headX - 36, headY - 10);
    ctx.moveTo(headX - 2, headY - 45);
    ctx.quadraticCurveTo(headX - 5, headY - 24, headX - 12, headY - 14);
    ctx.moveTo(headX + 16, headY - 42);
    ctx.quadraticCurveTo(headX + 28, headY - 24, headX + 40, headY - 10);
    ctx.stroke();

    // Left straight framing strand
    ctx.fillStyle = '#18161D';
    ctx.beginPath();
    ctx.moveTo(headX - 55, headY - 12);
    ctx.quadraticCurveTo(headX - 60, shoulderY + 34, headX - 48, shoulderY + 108);
    ctx.lineTo(headX - 38, shoulderY + 102);
    ctx.quadraticCurveTo(headX - 45, shoulderY + 32, headX - 43, headY - 2);
    ctx.closePath();
    ctx.fill();

    // Signature front long straight hair draped over her right shoulder onto chest (matching host.png!)
    ctx.beginPath();
    ctx.moveTo(headX + 55, headY - 12);
    ctx.quadraticCurveTo(headX + 64, shoulderY + 42, headX + 36, shoulderY + 126);
    ctx.lineTo(headX + 16, shoulderY + 114);
    ctx.quadraticCurveTo(headX + 42, shoulderY + 38, headX + 42, headY - 2);
    ctx.closePath();
    ctx.fill();

    // Glossy hair highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.arc(headX, headY - 16, 43, Math.PI * 1.16, Math.PI * 1.54);
    ctx.stroke();

    ctx.restore(); // end headNod transform

    // Crisp Ngọc nameplate at base
    ctx.save();
    const badgeW = 144;
    const badgeH = 38;
    const badgeX = baseX - badgeW / 2;
    const badgeY = groundY + 26;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = '#FDA4AF';
    ctx.lineWidth = 2;
    this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 19);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#BE123C';
    ctx.font = '800 19px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('● Ngọc', baseX, badgeY + badgeH / 2 + 1);
    ctx.restore();

    ctx.restore();
  }

  _drawEye(ctx, x, y, scaleY) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, scaleY);
    // Soft upper lash curve
    ctx.strokeStyle = '#18161D';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.quadraticCurveTo(0, -11, 10, -4);
    ctx.stroke();

    // Dark expressive iris
    ctx.fillStyle = '#1F1B24';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 8.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dual catchlights
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2.5, -2.8, 2.7, 0, Math.PI * 2);
    ctx.arc(2.6, 2.2, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawSneaker(ctx, cx, y) {
    ctx.save();
    ctx.fillStyle = '#E2E8F0';
    this._roundRect(ctx, cx - 23, y - 6, 50, 15, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - 21, y - 2);
    ctx.lineTo(cx - 17, y - 21);
    ctx.quadraticCurveTo(cx + 4, y - 23, cx + 17, y - 11);
    ctx.quadraticCurveTo(cx + 26, y - 7, cx + 25, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Subtle lace lines
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, y - 14);
    ctx.lineTo(cx + 2, y - 12);
    ctx.moveTo(cx - 5, y - 9);
    ctx.lineTo(cx + 6, y - 7);
    ctx.stroke();
    ctx.restore();
  }

  _drawIcedCoffeeCup(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    // Clear plastic cup body (iced milk coffee from host.png)
    ctx.fillStyle = 'rgba(255, 250, 244, 0.94)';
    ctx.strokeStyle = '#8C5226';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-19, -32);
    ctx.lineTo(19, -32);
    ctx.lineTo(13, 25);
    ctx.lineTo(-13, 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Iced milk coffee gradient & swirl
    ctx.fillStyle = '#9A5B2C';
    ctx.beginPath();
    ctx.moveTo(-17, -18);
    ctx.lineTo(17, -18);
    ctx.lineTo(12, 23);
    ctx.lineTo(-12, 23);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#D7A36E';
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.quadraticCurveTo(0, -6, 15, 3);
    ctx.lineTo(12, 23);
    ctx.lineTo(-12, 23);
    ctx.closePath();
    ctx.fill();

    // Visible floating ice cubes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(-11, -23, 9, 9);
    ctx.fillRect(1, -21, 9, 8);
    ctx.fillRect(-4, -14, 8, 7);

    // Clear lid rim
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.strokeStyle = '#9A6338';
    ctx.lineWidth = 2;
    this._roundRect(ctx, -21, -37, 42, 7, 3.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      if (p.kind === 'heart') {
        const s = p.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.6);
        ctx.bezierCurveTo(-s * 1.4, -s * 0.4, -s * 0.7, -s * 1.5, 0, -s * 0.5);
        ctx.bezierCurveTo(s * 0.7, -s * 1.5, s * 1.4, -s * 0.4, 0, s * 0.6);
        ctx.fill();
      } else {
        // 4-point star sparkle
        const r = p.size * 0.45;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.quadraticCurveTo(0, 0, 0, r);
        ctx.quadraticCurveTo(0, 0, -r, 0);
        ctx.quadraticCurveTo(0, 0, 0, -r);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
