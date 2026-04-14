/* =========================================================
   WRAPPED SHARE CARDS — 1200x1200 square, bold gradients
   ========================================================= */

var SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
var MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace";

var S = 1200; // square

function makeCanvas() {
  var c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  return c;
}

function hexToRgb(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return { r: r, g: g, b: b };
}

function drawBg(ctx, accent) {
  var rgb = hexToRgb(accent);
  ctx.fillStyle = "#060606";
  ctx.fillRect(0, 0, S, S);
  var grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.55)");
  grad.addColorStop(0.4, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.12)");
  grad.addColorStop(0.75, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  var rad = ctx.createRadialGradient(S * 0.88, S * 0.12, 0, S * 0.88, S * 0.12, S * 0.5);
  rad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.22)");
  rad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, S, S);
}

function wrap(ctx, text, x, y, maxW, lh, maxL) {
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
  for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lh);
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
  var a = theme.accent;
  var P = 90; // padding
  var cw = S - P * 2; // content width

  drawBg(ctx, a);

  // ── Top bar ──
  ctx.font = "bold 26px " + MONO;
  ctx.fillStyle = a;
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS", P, 88);
  ctx.font = "bold 22px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "right";
  ctx.fillText("Q1 2026 WRAPPED", S - P, 88);
  ctx.textAlign = "left";

  // ── Bottom bar ──
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, S - 88, S, 88);
  ctx.font = "bold 20px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("GRACCHUS.AI", P, S - 36);
  ctx.textAlign = "right";
  ctx.fillStyle = a;
  ctx.fillText("UK GOV TRACKER", S - P, S - 36);
  ctx.textAlign = "left";

  // ── Content zone: between y=130 and y=S-110 ──
  var topY = 140;
  var botY = S - 110;
  var y = topY;

  // Eyebrow
  if (slide.eyebrow) {
    ctx.font = "bold 24px " + MONO;
    ctx.fillStyle = a;
    ctx.fillText(slide.eyebrow.toUpperCase(), P, y);
    y += 60;
  }

  // Headline
  if (slide.headline) {
    var hl = slide.headline.length;
    var hs = hl < 30 ? 72 : hl < 50 ? 58 : 48;
    ctx.font = "900 " + hs + "px " + SANS;
    ctx.fillStyle = "#fff";
    y = wrap(ctx, slide.headline, P, y, cw, Math.round(hs * 1.2), 3);
    y += 32;
  }

  // Big number
  if (slide.bigNumber) {
    var nl = slide.bigNumber.length;
    var ns = nl <= 5 ? 180 : nl <= 8 ? 140 : nl <= 11 ? 110 : 90;
    ctx.font = "900 " + ns + "px " + SANS;
    ctx.fillStyle = a;
    ctx.fillText(slide.bigNumber, P, y + ns * 0.78);
    y += ns + 20;
    if (slide.bigNumberSuffix) {
      ctx.font = "600 36px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      y = wrap(ctx, slide.bigNumberSuffix, P, y, cw, 46, 2);
      y += 28;
    }
  }

  // Subline
  if (slide.subline && y < botY - 120) {
    var showSub = !slide.list || slide.subline.length < 90;
    if (showSub) {
      ctx.font = "500 30px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      var maxSubLines = slide.list ? 2 : 3;
      y = wrap(ctx, slide.subline, P, y, cw, 42, maxSubLines);
      y += 24;
    }
  }

  // List
  if (slide.list && y < botY - 60) {
    y += 8;
    if (slide.listTitle) {
      ctx.font = "bold 22px " + MONO;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText(slide.listTitle.toUpperCase(), P, y);
      y += 44;
    }
    var space = botY - y;
    var rowH = 60;
    var maxI = Math.min(slide.list.length, 5, Math.floor(space / rowH));
    for (var i = 0; i < maxI; i++) {
      var it = slide.list[i];
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(P, y, cw, 1);
      y += 10;
      ctx.font = "600 30px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "left";
      ctx.fillText(trunc(ctx, it.label, cw - 260), P, y + 32);
      ctx.font = "bold 30px " + SANS;
      ctx.fillStyle = a;
      ctx.textAlign = "right";
      ctx.fillText(it.value, S - P, y + 32);
      ctx.textAlign = "left";
      y += rowH;
    }
  }

  // Detail (no-list slides only)
  if (slide.detail && !slide.list && y < botY - 60) {
    y += 16;
    var rgb = hexToRgb(a);
    ctx.fillStyle = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.4)";
    ctx.fillRect(P, y, 5, 90);
    ctx.font = "500 28px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    wrap(ctx, slide.detail, P + 28, y + 30, cw - 32, 40, 3);
  }

  return canvas.toDataURL("image/png");
}
