/* =========================================================
   WRAPPED SHARE CARDS — Spotify Wrapped aesthetic
   Vivid colour backgrounds, geometric shapes, centred text,
   bold type, minimal content. 1200x1200 square.
   ========================================================= */

var SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
var MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace";
var S = 1200;

function makeCanvas() {
  var c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  return c;
}

// Vivid colour palettes per slide (Spotify-esque)
var PALETTES = [
  { bg: "#0D1B2A", accent: "#4CC9F0", shape: "#3A86FF", text: "#FFFFFF" },  // deep blue + cyan
  { bg: "#1A1A2E", accent: "#FF6B6B", shape: "#E63946", text: "#FFFFFF" },  // dark + coral
  { bg: "#0B0B0F", accent: "#FF4D4D", shape: "#DC2626", text: "#FFFFFF" },  // black + red
  { bg: "#1B0A3C", accent: "#A855F7", shape: "#7C3AED", text: "#FFFFFF" },  // purple
  { bg: "#002B1F", accent: "#10B981", shape: "#059669", text: "#FFFFFF" },  // emerald
  { bg: "#2D1810", accent: "#FB7185", shape: "#E11D48", text: "#FFFFFF" },  // rose
  { bg: "#1C1005", accent: "#F59E0B", shape: "#D97706", text: "#FFFFFF" },  // amber
  { bg: "#0A192F", accent: "#3B82F6", shape: "#2563EB", text: "#FFFFFF" },  // blue
  { bg: "#1A0A2E", accent: "#C084FC", shape: "#9333EA", text: "#FFFFFF" },  // violet
  { bg: "#0D2818", accent: "#34D399", shape: "#10B981", text: "#FFFFFF" },  // green
];

function drawBackground(ctx, pal, slideIdx) {
  // Solid vivid background
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, S, S);

  // Large geometric decorative elements (vary by slide)
  var pattern = slideIdx % 5;

  if (pattern === 0) {
    // Giant circle top-right
    ctx.beginPath();
    ctx.arc(S * 0.85, S * 0.15, S * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = pal.shape + "25";
    ctx.fill();
    // Smaller circle overlapping
    ctx.beginPath();
    ctx.arc(S * 0.7, S * 0.05, S * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent + "18";
    ctx.fill();
  } else if (pattern === 1) {
    // Bold diagonal stripe
    ctx.save();
    ctx.translate(S * 0.6, 0);
    ctx.rotate(Math.PI * 0.12);
    ctx.fillStyle = pal.shape + "20";
    ctx.fillRect(-50, -100, 200, S * 1.5);
    ctx.fillStyle = pal.accent + "12";
    ctx.fillRect(180, -100, 120, S * 1.5);
    ctx.restore();
  } else if (pattern === 2) {
    // Concentric arcs bottom-left
    for (var r = 3; r > 0; r--) {
      ctx.beginPath();
      ctx.arc(0, S, S * 0.2 * r, -Math.PI * 0.5, 0);
      ctx.strokeStyle = pal.accent + (r === 3 ? "15" : r === 2 ? "20" : "30");
      ctx.lineWidth = 40;
      ctx.stroke();
    }
  } else if (pattern === 3) {
    // Floating rectangles
    ctx.save();
    ctx.translate(S * 0.75, S * 0.12);
    ctx.rotate(0.3);
    ctx.fillStyle = pal.shape + "22";
    ctx.fillRect(0, 0, 280, 280);
    ctx.fillStyle = pal.accent + "15";
    ctx.fillRect(100, 100, 200, 200);
    ctx.restore();
  } else {
    // Wavy accent blob
    ctx.beginPath();
    ctx.moveTo(S * 0.6, 0);
    ctx.bezierCurveTo(S * 1.1, S * 0.1, S * 0.9, S * 0.4, S, S * 0.25);
    ctx.lineTo(S, 0);
    ctx.closePath();
    ctx.fillStyle = pal.shape + "20";
    ctx.fill();
  }

  // Subtle noise overlay
  for (var i = 0; i < 400; i++) {
    ctx.fillStyle = "rgba(255,255,255," + (Math.random() * 0.015) + ")";
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
}

function wrap(ctx, text, x, y, maxW, lh, maxL, align) {
  var words = text.split(" ");
  var cur = "";
  var lines = [];
  for (var i = 0; i < words.length; i++) {
    var t = cur + (cur ? " " : "") + words[i];
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = words[i];
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  if (maxL) lines = lines.slice(0, maxL);
  var prevAlign = ctx.textAlign;
  if (align) ctx.textAlign = align;
  for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lh);
  ctx.textAlign = prevAlign;
  return y + lines.length * lh;
}

function trunc(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (ctx.measureText(text + "\u2026").width > maxW && text.length > 0) text = text.slice(0, -1);
  return text + "\u2026";
}

export function renderWrappedCard(slide, theme) {
  var canvas = makeCanvas();
  var ctx = canvas.getContext("2d");
  var idx = PALETTES.findIndex(function (p) { return p.accent === theme.accent; });
  if (idx < 0) idx = 0;
  var pal = PALETTES[idx];
  var P = 90;
  var cw = S - P * 2;
  var cx = S / 2; // centre x

  drawBackground(ctx, pal, idx);

  // ── Top branding ──
  ctx.font = "bold 24px " + MONO;
  ctx.fillStyle = pal.accent;
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS", P, 80);
  ctx.textAlign = "right";
  ctx.font = "bold 20px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("Q1 2026", S - P, 80);

  // ── Bottom branding ──
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, S - 90, S, 90);
  ctx.font = "bold 22px " + MONO;
  ctx.textAlign = "center";
  ctx.fillStyle = pal.accent;
  ctx.fillText("GRACCHUS.AI", cx, S - 38);

  // ── Content — centred layout ──
  var hasBigNum = !!slide.bigNumber;
  var hasList = !!slide.list;

  // Figure out content height to vertically centre it
  var contentTop = 130;
  var contentBot = S - 110;
  var zone = contentBot - contentTop;
  var y = contentTop;

  // Eyebrow — centred
  if (slide.eyebrow) {
    ctx.font = "bold 22px " + MONO;
    ctx.fillStyle = pal.accent;
    ctx.textAlign = "center";
    ctx.fillText(slide.eyebrow.toUpperCase(), cx, y);
    y += 56;
  }

  // Headline — centred, big, bold
  if (slide.headline) {
    var hl = slide.headline.length;
    var hs = hl < 30 ? 72 : hl < 50 ? 56 : 46;
    ctx.font = "900 " + hs + "px " + SANS;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    y = wrap(ctx, slide.headline, cx, y, cw, Math.round(hs * 1.18), 3, "center");
    y += 36;
  }

  // Big number — MASSIVE, centred, accent
  if (hasBigNum) {
    var nl = slide.bigNumber.length;
    var ns = nl <= 5 ? 190 : nl <= 8 ? 150 : nl <= 11 ? 115 : 95;
    ctx.font = "900 " + ns + "px " + SANS;
    ctx.fillStyle = pal.accent;
    ctx.textAlign = "center";
    ctx.fillText(slide.bigNumber, cx, y + ns * 0.78);
    y += ns + 24;

    if (slide.bigNumberSuffix) {
      ctx.font = "600 34px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.textAlign = "center";
      y = wrap(ctx, slide.bigNumberSuffix, cx, y, cw, 44, 2, "center");
      y += 28;
    }
  }

  // Subline — centred
  if (slide.subline && y < contentBot - 100) {
    var showSub = !hasList || slide.subline.length < 80;
    if (showSub) {
      ctx.font = "500 28px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textAlign = "center";
      y = wrap(ctx, slide.subline, cx, y, cw, 40, 3, "center");
      y += 20;
    }
  }

  // List — left-aligned within centred block
  if (hasList && y < contentBot - 60) {
    y += 8;
    if (slide.listTitle) {
      ctx.font = "bold 20px " + MONO;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.textAlign = "left";
      ctx.fillText(slide.listTitle.toUpperCase(), P, y);
      y += 42;
    }
    var space = contentBot - y;
    var rowH = 58;
    var maxI = Math.min(slide.list.length, 5, Math.floor(space / rowH));
    for (var i = 0; i < maxI; i++) {
      var it = slide.list[i];
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(P, y, cw, 1);
      y += 10;
      ctx.font = "600 30px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.textAlign = "left";
      ctx.fillText(trunc(ctx, it.label, cw - 260), P, y + 30);
      ctx.font = "bold 30px " + SANS;
      ctx.fillStyle = pal.accent;
      ctx.textAlign = "right";
      ctx.fillText(it.value, S - P, y + 30);
      ctx.textAlign = "left";
      y += rowH;
    }
  }

  // Detail — centred
  if (slide.detail && !hasList && y < contentBot - 50) {
    y += 20;
    ctx.font = "500 26px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    wrap(ctx, slide.detail, cx, y, cw - 40, 38, 3, "center");
  }

  return canvas.toDataURL("image/png");
}
