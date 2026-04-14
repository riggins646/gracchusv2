/* =========================================================
   WRAPPED SHARE CARDS — Bold gradient square PNGs
   1:1 square format for universal social sharing.
   Large readable type, strong gradient backgrounds.
   ========================================================= */

var SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
var MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace";

var W = 1080;
var H = 1080;

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

  // Black base
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  // Main diagonal gradient — accent colour top-left fading to black
  var grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.5)");
  grad.addColorStop(0.35, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.15)");
  grad.addColorStop(0.7, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Secondary glow — top-right accent orb
  var radial = ctx.createRadialGradient(W * 0.9, H * 0.1, 0, W * 0.9, H * 0.1, W * 0.55);
  radial.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.18)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);
}

function drawBranding(ctx, accent) {
  // Top-left: GRACCHUS wordmark
  ctx.font = "bold 22px " + MONO;
  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS", 64, 72);

  // Top-right: Q1 2026 WRAPPED
  ctx.font = "bold 18px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "right";
  ctx.fillText("Q1 2026 WRAPPED", W - 64, 72);
  ctx.textAlign = "left";

  // Bottom bar
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, H - 70, W, 70);

  ctx.font = "bold 16px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS.AI", 64, H - 28);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText("UK GOV PERFORMANCE TRACKER", W - 64, H - 28);
  ctx.textAlign = "left";
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
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
  var pad = 64;
  var contentW = W - pad * 2;

  drawGradientBg(ctx, accent);
  drawBranding(ctx, accent);

  // Decide layout: cards with big numbers vs list-only cards
  var hasBigNum = !!slide.bigNumber;
  var hasList = !!slide.list;
  var y = 120;

  // ── Eyebrow ──
  if (slide.eyebrow) {
    ctx.font = "bold 18px " + MONO;
    ctx.fillStyle = accent;
    ctx.fillText(slide.eyebrow.toUpperCase(), pad, y);
    y += 48;
  }

  // ── Headline ──
  if (slide.headline) {
    // Shorter headlines get bigger type
    var headSize = slide.headline.length < 40 ? 56 : 44;
    var headLine = slide.headline.length < 40 ? 66 : 54;
    ctx.font = "900 " + headSize + "px " + SANS;
    ctx.fillStyle = "#ffffff";
    y = wrapText(ctx, slide.headline, pad, y, contentW, headLine);
    y += 24;
  }

  // ── Big number ──
  if (hasBigNum) {
    // Scale number size based on length
    var numLen = slide.bigNumber.length;
    var numSize = numLen <= 6 ? 140 : numLen <= 9 ? 110 : 88;
    ctx.font = "900 " + numSize + "px " + SANS;
    ctx.fillStyle = accent;
    ctx.fillText(slide.bigNumber, pad, y + numSize * 0.82);
    y += numSize + 12;

    if (slide.bigNumberSuffix) {
      ctx.font = "600 28px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      y = wrapText(ctx, slide.bigNumberSuffix, pad, y, contentW, 36);
      y += 16;
    }
  }

  // ── Subline (only if no list, or short subline) ──
  if (slide.subline && (!hasList || slide.subline.length < 80)) {
    ctx.font = "500 24px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    // Limit to 3 lines max on share card
    var subWords = slide.subline.split(" ");
    var subLine = "";
    var subLines = [];
    for (var sw = 0; sw < subWords.length; sw++) {
      var subTest = subLine + (subLine ? " " : "") + subWords[sw];
      if (ctx.measureText(subTest).width > contentW) {
        subLines.push(subLine);
        subLine = subWords[sw];
      } else {
        subLine = subTest;
      }
    }
    if (subLine) subLines.push(subLine);
    subLines = subLines.slice(0, 3);
    for (var sl = 0; sl < subLines.length; sl++) {
      ctx.fillText(subLines[sl], pad, y + sl * 32);
    }
    y += subLines.length * 32 + 16;
  }

  // ── List ──
  if (hasList) {
    y += 8;
    if (slide.listTitle) {
      ctx.font = "bold 16px " + MONO;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(slide.listTitle.toUpperCase(), pad, y);
      y += 36;
    }

    // How many items fit? Calculate remaining space
    var bottomReserved = 90; // branding bar
    var remainingH = H - y - bottomReserved;
    var itemH = 52;
    var maxItems = Math.min(slide.list.length, 5, Math.floor(remainingH / itemH));

    for (var li = 0; li < maxItems; li++) {
      var item = slide.list[li];

      // Separator line
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(pad, y, contentW, 1);
      y += 6;

      // Label — left
      ctx.font = "600 26px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "left";
      ctx.fillText(truncText(ctx, item.label, contentW - 220), pad, y + 30);

      // Value — right
      ctx.font = "bold 26px " + SANS;
      ctx.fillStyle = accent;
      ctx.textAlign = "right";
      ctx.fillText(item.value, W - pad, y + 30);
      ctx.textAlign = "left";

      y += itemH;
    }
  }

  // ── Detail (only for slides without lists) ──
  if (slide.detail && !hasList) {
    y += 8;
    var rgb = hexToRgb(accent);
    ctx.fillStyle = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.35)";
    ctx.fillRect(pad, y, 4, 72);
    ctx.font = "500 22px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    wrapText(ctx, slide.detail, pad + 20, y + 22, contentW - 24, 30);
  }

  return canvas.toDataURL("image/png");
}
