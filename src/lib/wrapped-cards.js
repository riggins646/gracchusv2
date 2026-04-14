/* =========================================================
   WRAPPED SHARE CARDS — Spotify Wrapped–style bold gradient PNGs
   Full-bleed gradient backgrounds, massive type, minimal data.
   Designed for viral sharing on X/Twitter and Instagram Stories.
   ========================================================= */

var SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
var MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace";

var W = 1080;
var H = 1350; // 4:5 ratio — optimal for social sharing

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

  // Deep gradient from accent colour at top to black at bottom
  var grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
  grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.45)");
  grad.addColorStop(0.4, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.12)");
  grad.addColorStop(1, "#000000");
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Secondary radial glow in top-right
  var radial = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 0.6);
  radial.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.2)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);
}

function drawBranding(ctx, accent) {
  // Top: GRACCHUS Q1 2026 WRAPPED
  ctx.font = "bold 16px " + MONO;
  ctx.fillStyle = accent;
  ctx.letterSpacing = "4px";
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS", 60, 65);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("Q1 2026 WRAPPED", 210, 65);
  ctx.letterSpacing = "0px";

  // Bottom branding bar
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, H - 80, W, 80);
  ctx.font = "bold 13px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS.AI", 60, H - 35);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText("UK GOVERNMENT PERFORMANCE TRACKER", W - 60, H - 35);
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
  var pad = 60;
  var contentW = W - pad * 2;

  drawGradientBg(ctx, accent);
  drawBranding(ctx, accent);

  var y = 130;

  // Eyebrow label
  if (slide.eyebrow) {
    ctx.font = "bold 14px " + MONO;
    ctx.fillStyle = accent;
    var eyebrow = slide.eyebrow.toUpperCase();
    ctx.fillText(eyebrow, pad, y);
    y += 50;
  }

  // Headline — large, bold, white
  if (slide.headline) {
    ctx.font = "900 52px " + SANS;
    ctx.fillStyle = "#ffffff";
    y = wrapText(ctx, slide.headline, pad, y, contentW, 62);
    y += 20;
  }

  // Big number — MASSIVE, accent colour
  if (slide.bigNumber) {
    ctx.font = "900 120px " + SANS;
    ctx.fillStyle = accent;
    ctx.fillText(slide.bigNumber, pad, y + 100);
    y += 120;

    if (slide.bigNumberSuffix) {
      ctx.font = "600 28px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      y = wrapText(ctx, slide.bigNumberSuffix, pad, y + 20, contentW, 36);
      y += 10;
    }
  }

  // Subline
  if (slide.subline) {
    y += 15;
    ctx.font = "500 24px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    y = wrapText(ctx, slide.subline, pad, y, contentW, 34);
    y += 10;
  }

  // List (compact, up to 5 items)
  if (slide.list) {
    y += 20;
    if (slide.listTitle) {
      ctx.font = "bold 13px " + MONO;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(slide.listTitle.toUpperCase(), pad, y);
      y += 30;
    }
    var maxItems = Math.min(slide.list.length, 5);
    for (var li = 0; li < maxItems; li++) {
      var item = slide.list[li];
      // Separator
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(pad, y + 2, contentW, 1);
      // Label
      ctx.font = "500 22px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.textAlign = "left";
      ctx.fillText(truncText(ctx, item.label, contentW - 200), pad, y + 32);
      // Value
      ctx.font = "bold 22px " + SANS;
      ctx.fillStyle = accent;
      ctx.textAlign = "right";
      ctx.fillText(item.value, W - pad, y + 32);
      ctx.textAlign = "left";
      // Sub text
      if (item.sub) {
        ctx.font = "400 15px " + SANS;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillText(truncText(ctx, item.sub, contentW), pad, y + 52);
        y += 62;
      } else {
        y += 44;
      }
    }
  }

  // Detail (only if no list, to avoid overcrowding)
  if (slide.detail && !slide.list) {
    y += 15;
    // Left accent border
    var rgb = hexToRgb(accent);
    ctx.fillStyle = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.3)";
    ctx.fillRect(pad, y - 5, 3, 80);
    ctx.font = "400 20px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    wrapText(ctx, slide.detail, pad + 16, y + 10, contentW - 20, 28);
  }

  // Footer source line
  if (slide.footer) {
    ctx.font = "bold 12px " + MONO;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText(slide.footer.toUpperCase(), pad, H - 100);
  }

  return canvas.toDataURL("image/png");
}
