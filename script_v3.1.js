/**********************************************
 * script_v3.1.js
 * 
 * Adds Yield parameter and colors "bad" dies brown.
 **********************************************/

// Global variable to store the latest wafer parameters for re‑drawing.
let lastWaferParams = null;

// 1) Grab DOM elements
const waferDiameterEl = document.getElementById('waferDiameter');
const edgeExclusionEl = document.getElementById('edgeExclusion');
const dieWidthEl = document.getElementById('dieWidth');
const dieLengthEl = document.getElementById('dieLength');
const xScribeEl = document.getElementById('xScribe');
const yScribeEl = document.getElementById('yScribe');
const calculateBtn = document.getElementById('calculateBtn');
const dieCountEl = document.getElementById('dieCount');
const dieSizeEl = document.getElementById('dieSize');
const dieAreaEl = document.getElementById('dieArea');
const utilRateEl = document.getElementById('utilRate');

// NEW DOM elements for Yield
const yieldEl = document.getElementById('yieldValue');
// NEW DOM element for "Good Dies"
const goodDieCountEl = document.getElementById('goodDieCount');

// Canvas references
const canvas = document.getElementById('waferCanvas');
const ctx = canvas.getContext('2d');

// 2) On "Calculate" click
calculateBtn.addEventListener('click', () => {
  runCalculation();
});

// Run when opening the website for the first time or reloading the page
window.addEventListener('DOMContentLoaded', () => {
  runCalculation();  
});

/* runCalculation - read user inputs, find best layout, and draw wafer. */
function runCalculation() {
  // Retrieve parameter values
  const waferDiameter = parseFloat(waferDiameterEl.value);
  const edgeExclusion = parseFloat(edgeExclusionEl.value);
  const dieWidth = parseFloat(dieWidthEl.value);
  const dieLength = parseFloat(dieLengthEl.value);
  const xScribe = parseFloat(xScribeEl.value);
  const yScribe = parseFloat(yScribeEl.value);

  // NEW: read yield as a fraction (0.0 -> 1.0)
  const yieldFraction = parseFloat(yieldEl.value) / 100;

  // 1) Find best layout (offsets, angle) that maximizes die count
  const bestLayout = findBestDieLayout(
    waferDiameter,
    edgeExclusion,
    dieWidth,
    dieLength,
    xScribe,
    yScribe
  );

  // Save current parameters for later re‑drawing when dark mode is toggled.
  lastWaferParams = {
    waferDiameter,
    edgeExclusion,
    dieWidth,
    dieLength,
    xScribe,
    yScribe,
    offsetX: bestLayout.bestOffsetX,
    offsetY: bestLayout.bestOffsetY,
    angleDeg: bestLayout.bestAngle,
    yieldFraction: yieldFraction
  };

  // 2) Display textual results
  dieCountEl.textContent = bestLayout.bestCount;
  dieSizeEl.textContent = dieLength * dieWidth;
  dieAreaEl.textContent = bestLayout.bestCount * dieLength * dieWidth;
  utilRateEl.textContent =
    Math.round(
      (bestLayout.bestCount * dieLength * dieWidth) /
        (Math.PI * (waferDiameter / 2) ** 2) *
        100
    ) + "%";

  // 3) Draw wafer & dies, passing in yieldFraction to color them
  drawWaferAndDies(
    waferDiameter,
    edgeExclusion,
    dieWidth,
    dieLength,
    xScribe,
    yScribe,
    bestLayout.bestOffsetX,
    bestLayout.bestOffsetY,
    bestLayout.bestAngle,
    yieldFraction
  );
}

/**
 * findBestDieLayout
 * -----------------
 * Systematically tries small offsets (X,Y) and angles (0..90°)
 * to find the arrangement with the max die count.
 */
function findBestDieLayout(
  waferDiameter,
  edgeExclusion,
  dieWidth,
  dieLength,
  xScribe,
  yScribe
) {
  const waferRadius = waferDiameter / 2;
  const validRadius = waferRadius - edgeExclusion;

  const pitchX = dieLength + xScribe; // horizontal pitch
  const pitchY = dieWidth + yScribe;  // vertical pitch

  // Tweak these for finer search vs. performance
  const offsetSteps = 5;   // divides [0..pitchX] / [0..pitchY] into steps
  const angleStep = 1;     // degrees per step (0..90 inclusive)

  let bestCount = 0;
  let bestOffsetX = 0;
  let bestOffsetY = 0;
  let bestAngle = 0;

  for (let angle = 0; angle <= 90; angle += angleStep) {
    for (let i = 0; i < offsetSteps; i++) {
      for (let j = 0; j < offsetSteps; j++) {
        const offsetX = (i / offsetSteps) * pitchX;
        const offsetY = (j / offsetSteps) * pitchY;

        const count = calculateDies(
          waferDiameter,
          edgeExclusion,
          dieWidth,
          dieLength,
          xScribe,
          yScribe,
          offsetX,
          offsetY,
          angle
        );

        if (count > bestCount) {
          bestCount = count;
          bestOffsetX = offsetX;
          bestOffsetY = offsetY;
          bestAngle = angle;
        }
      }
    }
  }

  return {
    bestCount,
    bestOffsetX,
    bestOffsetY,
    bestAngle
  };
}

/**
 * calculateDies
 * -------------
 * For given offset & angle, calculates how many dies
 * fit within the valid wafer area.
 */
function calculateDies(
  waferDiameter,
  edgeExclusion,
  dieWidth,
  dieLength,
  xScribe,
  yScribe,
  offsetX = 0,
  offsetY = 0,
  angleDeg = 0
) {
  const waferRadius = waferDiameter / 2;
  const validRadius = waferRadius - edgeExclusion;

  const pitchX = dieLength + xScribe;
  const pitchY = dieWidth + yScribe;
  const angleRad = (angleDeg * Math.PI) / 180;

  let count = 0;

  const minVal = -validRadius;
  const maxVal = validRadius;

  for (let x = minVal; x <= maxVal; x += pitchX) {
    for (let y = minVal; y <= maxVal; y += pitchY) {
      // offset
      const shiftedX = x + offsetX;
      const shiftedY = y + offsetY;

      // rotate
      const rx = shiftedX * Math.cos(angleRad) - shiftedY * Math.sin(angleRad);
      const ry = shiftedX * Math.sin(angleRad) + shiftedY * Math.cos(angleRad);

      // check if fully in wafer
      if (dieFitsInCircle(rx, ry, dieLength, dieWidth, validRadius, angleRad)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * dieFitsInCircle
 * ---------------
 * Checks if a (dieLength x dieWidth) rectangle centered at (cx,cy),
 * rotated by angleRad, is inside a circle of radius validRadius.
 */
function dieFitsInCircle(cx, cy, dieLength, dieWidth, validRadius, angleRad) {
  const halfL = dieLength / 2;
  const halfW = dieWidth / 2;

  const corners = [
    { x: -halfL, y: -halfW },
    { x: +halfL, y: -halfW },
    { x: +halfL, y: +halfW },
    { x: -halfL, y: +halfW }
  ];

  for (const corner of corners) {
    // rotate corner around (0,0)
    const rx = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
    const ry = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);

    const absX = cx + rx;
    const absY = cy + ry;

    if (Math.sqrt(absX * absX + absY * absY) > validRadius) {
      return false;
    }
  }
  return true;
}

/**
 * drawWaferAndDies
 * ----------------
 * Draw wafer boundaries & place each die.
 * Now also assigns "good" or "bad" (brown) using yieldFraction.
 * Modifications for dark mode:
 *   - The canvas background is filled with a dark color if dark mode is active.
 *   - The wafer boundary is drawn white in dark mode.
 */
function drawWaferAndDies(
  waferDiameter,
  edgeExclusion,
  dieWidth,
  dieLength,
  xScribe,
  yScribe,
  offsetX,
  offsetY,
  angleDeg,
  yieldFraction
) {
  // Determine if dark mode is active.
  const isDarkMode = document.body.classList.contains('dark');

  // Clear canvas and fill background according to mode.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isDarkMode ? "#1e1e1e" : "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const waferRadius = waferDiameter / 2;
  const validRadius = waferRadius - edgeExclusion;

  // Scale to fit wafer in canvas.
  const scale = Math.min(centerX, centerY) / (waferRadius * 1.1);

  // Draw wafer boundary.
  ctx.beginPath();
  ctx.arc(centerX, centerY, waferRadius * scale, 0, 2 * Math.PI);
  ctx.strokeStyle = isDarkMode ? 'white' : 'black';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw edge exclusion.
  ctx.beginPath();
  ctx.arc(centerX, centerY, validRadius * scale, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgb(249, 56, 39)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const angleRad = (angleDeg * Math.PI) / 180;
  const pitchX = dieLength + xScribe;
  const pitchY = dieWidth + yScribe;
  const halfL = dieLength / 2;
  const halfW = dieWidth / 2;

  let goodCount = 0; // track how many are "good"
  const minVal = -validRadius;
  const maxVal = validRadius;

  for (let x = minVal; x <= maxVal; x += pitchX) {
    for (let y = minVal; y <= maxVal; y += pitchY) {
      const shiftedX = x + offsetX;
      const shiftedY = y + offsetY;

      const rx = shiftedX * Math.cos(angleRad) - shiftedY * Math.sin(angleRad);
      const ry = shiftedX * Math.sin(angleRad) + shiftedY * Math.cos(angleRad);

      if (dieFitsInCircle(rx, ry, dieLength, dieWidth, validRadius, angleRad)) {
        // Each die is "good" with probability yieldFraction.
        const isGoodDie = (Math.random() < yieldFraction);
        if (isGoodDie) {
          goodCount++;
        }

        // Determine the rotated corners of the die.
        const corners = [
          { x: -halfL, y: -halfW },
          { x: +halfL, y: -halfW },
          { x: +halfL, y: +halfW },
          { x: -halfL, y: +halfW }
        ];
        const rotatedCorners = corners.map(corner => {
          const cornerRx = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
          const cornerRy = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);
          return { x: rx + cornerRx, y: ry + cornerRy };
        });

        ctx.beginPath();
        ctx.moveTo(
          centerX + rotatedCorners[0].x * scale,
          centerY + rotatedCorners[0].y * scale
        );
        for (let i = 1; i < rotatedCorners.length; i++) {
          ctx.lineTo(
            centerX + rotatedCorners[i].x * scale,
            centerY + rotatedCorners[i].y * scale
          );
        }
        ctx.closePath();

        // Good die = green, bad die = orange.
        ctx.fillStyle = isGoodDie ? 'rgba(22, 196, 127, 1)' : 'orange';
        ctx.fill();

        // No visible stroke.
        ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
        ctx.stroke();
      }
    }
  }

  // Update "Good Dies" count in the result box.
  goodDieCountEl.textContent = goodCount;
}

/* -------------------------------
   Dark Mode Toggle Event Listener
   -------------------------------
   Instead of recalculating everything, this listener simply
   re-draws the wafer using the last saved parameters (if available).
*/
const darkModeToggle = document.getElementById('darkModeToggle');
darkModeToggle.addEventListener('change', () => {
  // Toggle dark mode classes on <body> and <html>
  document.body.classList.toggle('dark', darkModeToggle.checked);
  document.documentElement.classList.toggle('dark', darkModeToggle.checked);
  
  // If we have saved parameters, re-draw only the wafer canvas with updated colors.
  if (lastWaferParams) {
    drawWaferAndDies(
      lastWaferParams.waferDiameter,
      lastWaferParams.edgeExclusion,
      lastWaferParams.dieWidth,
      lastWaferParams.dieLength,
      lastWaferParams.xScribe,
      lastWaferParams.yScribe,
      lastWaferParams.offsetX,
      lastWaferParams.offsetY,
      lastWaferParams.angleDeg,
      lastWaferParams.yieldFraction
    );
  }
});
