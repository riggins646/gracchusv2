/* =========================================================
   WRAPPED SHARE CARDS — Spotify Wrapped aesthetic
   Vivid colours, geometric shapes, centred text.
   Content is vertically centred in the card.
   1200x1200 square.
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

function hexToRgb(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return { r: r, g: g, b: b };
}

var PALETTES = [
  { bg: "#0D1B2A", accent: "#4CC9F0", shape: "#3A86FF" },
  { bg: "#1A1A2E", accent: "#FF6B6B", shape: "#E63946" },
  { bg: "#0B0B0F", accent: "#FF4D4D", shape: "#DC2626" },
  { bg: "#1B0A3C", accent: "#A855F7", shape: "#7C3AED" },
  { bg: "#002B1F", accent: "#10B981", shape: "#059669" },
  { bg: "#2D1810", accent: "#FB7185", shape: "#E11D48" },
  { bg: "#1C1005", accent: "#F59E0B", shape: "#D97706" },
  { bg: "#0A192F", accent: "#3B82F6", shape: "#2563EB" },
  { bg: "#1A0A2E", accent: "#C084FC", shape: "#9333EA" },
  { bg: "#0D2818", accent: "#34D399", shape: "#10B981" },
];

function drawBackground(ctx, pal, slideIdx) {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, S, S);
  var pattern = slideIdx % 5;
  if (pattern === 0) {
    ctx.beginPath();
    ctx.arc(S * 0.85, S * 0.15, S * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = pal.shape + "25";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(S * 0.7, S * 0.05, S * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent + "18";
    ctx.fill();
  } else if (pattern === 1) {
    ctx.save();
    ctx.translate(S * 0.6, 0);
    ctx.rotate(Math.PI * 0.12);
    ctx.fillStyle = pal.shape + "20";
    ctx.fillRect(-50, -100, 200, S * 1.5);
    ctx.fillStyle = pal.accent + "12";
    ctx.fillRect(180, -100, 120, S * 1.5);
    ctx.restore();
  } else if (pattern === 2) {
    for (var r = 3; r > 0; r--) {
      ctx.beginPath();
      ctx.arc(0, S, S * 0.2 * r, -Math.PI * 0.5, 0);
      ctx.strokeStyle = pal.accent + (r === 3 ? "15" : r === 2 ? "20" : "30");
      ctx.lineWidth = 40;
      ctx.stroke();
    }
  } else if (pattern === 3) {
    ctx.save();
    ctx.translate(S * 0.75, S * 0.12);
    ctx.rotate(0.3);
    ctx.fillStyle = pal.shape + "22";
    ctx.fillRect(0, 0, 280, 280);
    ctx.fillStyle = pal.accent + "15";
    ctx.fillRect(100, 100, 200, 200);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.moveTo(S * 0.6, 0);
    ctx.bezierCurveTo(S * 1.1, S * 0.1, S * 0.9, S * 0.4, S, S * 0.25);
    ctx.lineTo(S, 0);
    ctx.closePath();
    ctx.fillStyle = pal.shape + "20";
    ctx.fill();
  }
  for (var i = 0; i < 400; i++) {
    ctx.fillStyle = "rgba(255,255,255," + (Math.random() * 0.015) + ")";
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
}

function countLines(ctx, text, maxW) {
  var words = text.split(" ");
  var cur = "";
  var n = 0;
  for (var i = 0; i < words.length; i++) {
    var t = cur + (cur ? " " : "") + words[i];
    if (ctx.measureText(t).width > maxW && cur) { n++; cur = words[i]; }
    else cur = t;
  }
  if (cur) n++;
  return n;
}

function wrap(ctx, text, x, y, maxW, lh, maxL, align) {
  var words = text.split(" ");
  var cur = "";
  var lines = [];
  for (var i = 0; i < words.length; i++) {
    var t = cur + (cur ? " " : "") + words[i];
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  if (maxL) lines = lines.slice(0, maxL);
  var prev = ctx.textAlign;
  if (align) ctx.textAlign = align;
  for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lh);
  ctx.textAlign = prev;
  return y + lines.length * lh;
}

function trunc(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (ctx.measureText(text + "\u2026").width > maxW && text.length > 0) text = text.slice(0, -1);
  return text + "\u2026";
}

// Measure total content height without drawing
function measureContent(ctx, slide, cw) {
  var h = 0;
  var hasBigNum = !!slide.bigNumber;
  var hasList = !!slide.list;

  // Eyebrow
  if (slide.eyebrow) { h += 22 + 64; }

  // Headline
  if (slide.headline) {
    var hl = slide.headline.length;
    var hs = hl < 30 ? 80 : hl < 50 ? 62 : 50;
    var hlh = Math.round(hs * 1.18);
    ctx.font = "900 " + hs + "px " + SANS;
    var nlines = countLines(ctx, slide.headline, cw);
    nlines = Math.min(nlines, 3);
    h += nlines * hlh + 32;
  }

  // Big number
  if (hasBigNum) {
    var nl = slide.bigNumber.length;
    var ns = nl <= 5 ? 210 : nl <= 8 ? 165 : nl <= 11 ? 125 : 100;
    h += ns + 20;
    if (slide.bigNumberSuffix) {
      ctx.font = "600 38px " + SANS;
      var sLines = countLines(ctx, slide.bigNumberSuffix, cw);
      h += Math.min(sLines, 2) * 48 + 28;
    }
  }

  // Subline
  if (slide.subline && (!hasList || slide.subline.length < 80)) {
    ctx.font = "500 32px " + SANS;
    var subL = countLines(ctx, slide.subline, cw);
    h += Math.min(subL, 3) * 44 + 24;
  }

  // Detail (no-list)
  if (slide.detail && !hasList) {
    ctx.font = "500 26px " + SANS;
    var dL = countLines(ctx, slide.detail, cw - 32);
    h += Math.min(dL, 3) * 38 + 24;
  }

  // List
  if (hasList) {
    h += 8;
    if (slide.listTitle) h += 42;
    var maxI = Math.min(slide.list.length, 5);
    h += maxI * 58;
  }

  return h;
}

export function renderWrappedCard(slide, theme) {
  var canvas = makeCanvas();
  var ctx = canvas.getContext("2d");
  var idx = PALETTES.findIndex(function (p) { return p.accent === theme.accent; });
  if (idx < 0) idx = 0;
  var pal = PALETTES[idx];
  var P = 90;
  var cw = S - P * 2;
  var cx = S / 2;

  drawBackground(ctx, pal, idx);

  // ── Top branding (compact) ──
  ctx.font = "bold 22px " + MONO;
  ctx.fillStyle = pal.accent;
  ctx.textAlign = "left";
  ctx.fillText("GRACCHUS", P, 56);
  ctx.textAlign = "right";
  ctx.font = "bold 18px " + MONO;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("Q1 2026", S - P, 56);

  // ── Bottom branding (compact) ──
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, S - 60, S, 60);
  ctx.font = "bold 20px " + MONO;
  ctx.textAlign = "center";
  ctx.fillStyle = pal.accent;
  ctx.fillText("GRACCHUS.AI", cx, S - 22);

  // ── Vertically centre content ──
  var zoneTop = 80;
  var zoneBot = S - 70;
  var zoneH = zoneBot - zoneTop;
  var contentH = measureContent(ctx, slide, cw);
  var y = zoneTop + Math.max(0, (zoneH - contentH) / 2);

  var hasBigNum = !!slide.bigNumber;
  var hasList = !!slide.list;

  // Eyebrow
  if (slide.eyebrow) {
    ctx.font = "bold 22px " + MONO;
    ctx.fillStyle = pal.accent;
    ctx.textAlign = "center";
    ctx.fillText(slide.eyebrow.toUpperCase(), cx, y + 22);
    y += 22 + 64;
  }

  // Headline (with optional accent phrase)
  if (slide.headline) {
    var hl = slide.headline.length;
    var hs = hl < 30 ? 80 : hl < 50 ? 62 : 50;
    var hlh = Math.round(hs * 1.18);
    var accentPhrase = slide.accentPhrase || null;

    if (accentPhrase && slide.headline.includes(accentPhrase)) {
      // Render with accent-coloured phrase
      var words = slide.headline.split(" ");
      var cur = "";
      var lines = [];
      ctx.font = "900 " + hs + "px " + SANS;
      for (var wi = 0; wi < words.length; wi++) {
        var test = cur + (cur ? " " : "") + words[wi];
        if (ctx.measureText(test).width > cw && cur) {
          lines.push(cur);
          cur = words[wi];
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
      lines = lines.slice(0, 3);
      ctx.textAlign = "center";
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        var lineY = y + li * hlh;
        if (line.includes(accentPhrase)) {
          // Split line around the accent phrase and draw segments
          var before = line.substring(0, line.indexOf(accentPhrase));
          var after = line.substring(line.indexOf(accentPhrase) + accentPhrase.length);
          var totalW = ctx.measureText(line).width;
          var startX = cx - totalW / 2;
          ctx.textAlign = "left";
          if (before) {
            ctx.fillStyle = "#fff";
            ctx.fillText(before, startX, lineY);
            startX += ctx.measureText(before).width;
          }
          ctx.fillStyle = pal.accent;
          ctx.fillText(accentPhrase, startX, lineY);
          startX += ctx.measureText(accentPhrase).width;
          if (after) {
            ctx.fillStyle = "#fff";
            ctx.fillText(after, startX, lineY);
          }
          ctx.textAlign = "center";
        } else {
          ctx.fillStyle = "#fff";
          ctx.fillText(line, cx, lineY);
        }
      }
      y += lines.length * hlh + 32;
    } else {
      ctx.font = "900 " + hs + "px " + SANS;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      y = wrap(ctx, slide.headline, cx, y, cw, hlh, 3, "center");
      y += 32;
    }
  }

  // Big number
  if (hasBigNum) {
    var nl = slide.bigNumber.length;
    var ns = nl <= 5 ? 210 : nl <= 8 ? 165 : nl <= 11 ? 125 : 100;
    ctx.font = "900 " + ns + "px " + SANS;
    ctx.fillStyle = pal.accent;
    ctx.textAlign = "center";
    ctx.fillText(slide.bigNumber, cx, y + ns * 0.78);
    y += ns + 20;

    if (slide.bigNumberSuffix) {
      ctx.font = "600 38px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.textAlign = "center";
      y = wrap(ctx, slide.bigNumberSuffix, cx, y, cw, 48, 2, "center");
      y += 28;
    }
  }

  // Subline
  if (slide.subline) {
    var showSub = !hasList || slide.subline.length < 80;
    if (showSub) {
      ctx.font = "500 32px " + SANS;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textAlign = "center";
      y = wrap(ctx, slide.subline, cx, y, cw, 44, 3, "center");
      y += 24;
    }
  }

  // Detail (no-list)
  if (slide.detail && !hasList) {
    y += 4;
    ctx.font = "500 26px " + SANS;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "center";
    wrap(ctx, slide.detail, cx, y, cw - 40, 38, 3, "center");
  }

  // List
  if (hasList) {
    y += 8;
    if (slide.listTitle) {
      ctx.font = "bold 20px " + MONO;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.textAlign = "left";
      ctx.fillText(slide.listTitle.toUpperCase(), P, y);
      y += 42;
    }
    var maxI = Math.min(slide.list.length, 5);
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
      y += 58;
    }
  }

  return canvas.toDataURL("image/png");
}
