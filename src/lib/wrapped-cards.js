/* =========================================================
   WRAPPED SHARE CARDS — Canvas renderers
   Generates shareable PNG cards for each Wrapped slide.
   Matches the Gracchus design system (true black bg,
   bold typography, accent colour per slide).
   ========================================================= */

var SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
var MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace";

var W = 1200;
var H = 630;

function makeCanvas() {
  var c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

function drawBg(ctx) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // Subtle noise-like texture
  for (var i = 0; i < 800; i++) {
    ctx.fillStyle = "rgba(255,255,255," + (Math.random() * 0.012) + ")";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
}

function drawTopStripe(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 4);
}

function drawFooter(ctx) {
  var y = H - 44;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, y - 1, W, 1);
  ctx.font = "bold 11px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS", 48, y + 22);
  ctx.textAlign = "right";
  ctx.fillText("UK GOVERNMENT PERFORMANCE TRACKER", W - 48, y + 22);
  ctx.textAlign = "left";
}

function drawWrappedBadge(ctx, label, accent) {
  ctx.font = "bold 12px " + MONO;
  ctx.fillStyle = accent;
  ctx.fillText(label, 48, 50);
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

  drawBg(ctx);
  drawTopStripe(ctx, accent);
  drawWrappedBadge(ctx, (slide.eyebrow || "").toUpperCase(), accent);

  var y = 90;

  // Headline
  if (slide.headline) {
    ctx.font = "900 44px " + SANS;
    ctx.fillStyle = "#fff";
    // Word wrap headline
    var words = slide.headline.split(" ");
    var line = "";
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line + (line ? " " : "") + words[i];
      if (ctx.measureText(test).width > W - 120 && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length; j++) {
      ctx.fillText(lines[j], 48, y + j * 52);
    }
    y += lines.length * 52 + 10;
  }

  // Big number
  if (slide.bigNumber) {
    ctx.font = "900 80px " + SANS;
    ctx.fillStyle = accent;
    ctx.fillText(slide.bigNumber, 48, y + 70);
    y += 85;

    if (slide.bigNumberSuffix) {
      ctx.font = "600 22px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(slide.bigNumberSuffix, 48, y + 10);
      y += 30;
    }
  }

  // Subline
  if (slide.subline) {
    ctx.font = "500 20px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    var subText = truncText(ctx, slide.subline, W - 120);
    ctx.fillText(subText, 48, y + 16);
    y += 36;
  }

  // Detail
  if (slide.detail && !slide.list) {
    ctx.font = "400 16px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    // Simple word wrap
    var dWords = slide.detail.split(" ");
    var dLine = "";
    var dY = y + 20;
    for (var d = 0; d < dWords.length; d++) {
      var dTest = dLine + (dLine ? " " : "") + dWords[d];
      if (ctx.measureText(dTest).width > W - 150) {
        ctx.fillText(dLine, 48, dY);
        dLine = dWords[d];
        dY += 22;
      } else {
        dLine = dTest;
      }
    }
    if (dLine) ctx.fillText(dLine, 48, dY);
  }

  // List
  if (slide.list) {
    y += 10;
    if (slide.listTitle) {
      ctx.font = "bold 11px " + MONO;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(slide.listTitle.toUpperCase(), 48, y + 10);
      y += 28;
    }
    var listY = y;
    var maxItems = Math.min(slide.list.length, 5);
    for (var li = 0; li < maxItems; li++) {
      var item = slide.list[li];
      // Dotted line
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(48, listY + 28, W - 96, 1);
      // Label
      ctx.font = "500 17px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.textAlign = "left";
      var labelText = truncText(ctx, item.label, W - 300);
      ctx.fillText(labelText, 48, listY + 22);
      // Value
      ctx.font = "bold 17px " + SANS;
      ctx.fillStyle = accent;
      ctx.textAlign = "right";
      ctx.fillText(item.value, W - 48, listY + 22);
      ctx.textAlign = "left";
      listY += 38;
    }
  }

  // Footer
  if (slide.footer && !slide.list) {
    ctx.font = "bold 11px " + MONO;
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillText(slide.footer.toUpperCase(), 48, H - 70);
  }

  drawFooter(ctx);

  return canvas.toDataURL("image/png");
}
