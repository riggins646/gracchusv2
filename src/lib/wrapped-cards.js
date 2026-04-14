/* =========================================================
   WRAPPED SHARE CARDS — Bold gradient square PNGs
   1200x1200 square. Large readable type throughout.
   ========================================================= */

var SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
var MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace";

var W = 1200;
var H = 1200;

function makeCanvas() {
  var c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

function hexToRgb(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return { r: r, g: g, b: b };
}

function drawGradientBg(ctx, accent) {
  var rgb = hexToRgb(accent);

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  var grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.5)");
  grad.addColorStop(0.35, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.15)");
  grad.addColorStop(0.7, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var radial = ctx.createRadialGradient(W * 0.9, H * 0.1, 0, W * 0.9, H * 0.1, W * 0.55);
  radial.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.18)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  var words = text.split(" ");
  var line = "";
  var lines = [];
  for (var i = 0; i < words.length; i++) {
    var test = line + (line ? " " : "") + words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (maxLines) lines = lines.slice(0, maxLines);
  for (var j = 0; j < lines.length; j++) {
    ctx.fillText(lines[j], x, y + j * lineHeight);
  }
  return y + lines.length * lineHeight;
}

function truncText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (ctx.measureText(text + "\u2026").width > maxW && text.length > 0) {
    text = text.slice(0, -1);
  }
  return text + "\u2026";
}

// ── Main renderer ──────────────────────────────────────
export function renderWrappedCard(slide, theme) {
  var canvas = makeCanvas();
  var ctx = canvas.getContext("2d");
  var accent = theme.accent;
  var pad = 80;
  var contentW = W - pad * 2;

  drawGradientBg(ctx, accent);

  // ── Top branding ──
  ctx.font = "bold 24px " + MONO;
  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS", pad, 80);
  ctx.font = "bold 20px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "right";
  ctx.fillText("Q1 2026 WRAPPED", W - pad, 80);
  ctx.textAlign = "left";

  // ── Bottom branding ──
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, H - 80, W, 80);
  ctx.font = "bold 18px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("GRACCHUS.AI", pad, H - 32);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText("UK GOV PERFORMANCE TRACKER", W - pad, H - 32);
  ctx.textAlign = "left";

  var hasBigNum = !!slide.bigNumber;
  var hasList = !!slide.list;
  var y = 140;

  // ── Eyebrow ──
  if (slide.eyebrow) {
    ctx.font = "bold 22px " + MONO;
    ctx.fillStyle = accent;
    ctx.fillText(slide.eyebrow.toUpperCase(), pad, y);
    y += 56;
  }

  // ── Headline ──
  if (slide.headline) {
    var hLen = slide.headline.length;
    var hSize = hLen < 35 ? 64 : hLen < 55 ? 52 : 44;
    var hLead = hLen < 35 ? 76 : hLen < 55 ? 64 : 54;
    ctx.font = "900 " + hSize + "px " + SANS;
    ctx.fillStyle = "#ffffff";
    y = wrapText(ctx, slide.headline, pad, y, contentW, hLead, 3);
    y += 28;
  }

  // ── Big number ──
  if (hasBigNum) {
    var nLen = slide.bigNumber.length;
    var nSize = nLen <= 6 ? 160 : nLen <= 9 ? 120 : 96;
    ctx.font = "900 " + nSize + "px " + SANS;
    ctx.fillStyle = accent;
    ctx.fillText(slide.bigNumber, pad, y + nSize * 0.8);
    y += nSize + 16;

    if (slide.bigNumberSuffix) {
      ctx.font = "600 32px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      y = wrapText(ctx, slide.bigNumberSuffix, pad, y, contentW, 42, 2);
      y += 24;
    }
  }

  // ── Subline ──
  if (slide.subline && (!hasList || slide.subline.length < 100)) {
    ctx.font = "500 28px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    y = wrapText(ctx, slide.subline, pad, y, contentW, 38, 3);
    y += 20;
  }

  // ── List ──
  if (hasList) {
    y += 12;
    if (slide.listTitle) {
      ctx.font = "bold 20px " + MONO;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(slide.listTitle.toUpperCase(), pad, y);
      y += 40;
    }

    var bottomReserved = 100;
    var remainingH = H - y - bottomReserved;
    var itemH = 56;
    var maxItems = Math.min(slide.list.length, 5, Math.floor(remainingH / itemH));

    for (var li = 0; li < maxItems; li++) {
      var item = slide.list[li];

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(pad, y, contentW, 1);
      y += 8;

      ctx.font = "600 28px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "left";
      ctx.fillText(truncText(ctx, item.label, contentW - 240), pad, y + 32);

      ctx.font = "bold 28px " + SANS;
      ctx.fillStyle = accent;
      ctx.textAlign = "right";
      ctx.fillText(item.value, W - pad, y + 32);
      ctx.textAlign = "left";

      y += itemH;
    }
  }

  // ── Detail (no-list slides only) ──
  if (slide.detail && !hasList) {
    y += 12;
    var rgb = hexToRgb(accent);
    ctx.fillStyle = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.35)";
    ctx.fillRect(pad, y, 4, 80);
    ctx.font = "500 26px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    wrapText(ctx, slide.detail, pad + 24, y + 28, contentW - 28, 36, 3);
  }

  return canvas.toDataURL("image/png");
}
