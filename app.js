const SCENES = {
  seoulForest: {
    id: 'seoulForest',
    name: '서울숲분수',
    subtitle: 'SEOUL FOREST',
    motif: '분수',
    bottomLeft: '水',
    bottomRight: '분수',
    cardLabel: '서울숲분수',
    badge: 'Fountain',
    image: 'assets/images/forest-home.jpg',
    audio: 'assets/audio/seoul_forest.mp3',
    topColor: '#f3f000',
    panelBg: '#07c652',
    rightColor: '#f3f000',
    leftColor: '#ffffff',
    detailColor: '#f3f000',
    mode: 'forest'
  },
  subway: {
    id: 'subway',
    name: '성수역 2호선',
    subtitle: 'SUBWAY LINE 2',
    motif: '계단',
    bottomLeft: '네모',
    bottomRight: '계단',
    cardLabel: '성수역2호선',
    badge: 'Subway',
    image: 'assets/images/subway-home.jpg',
    audio: 'assets/audio/subway.mp3',
    topColor: '#f4f2d1',
    panelBg: '#08c754',
    rightColor: '#f4f2d1',
    leftColor: '#ffffff',
    detailColor: '#f4f2d1',
    mode: 'subway'
  },
  shoemaking: {
    id: 'shoemaking',
    name: '수제화거리',
    subtitle: 'SHOEMAKING STREET',
    motif: '기계음',
    bottomLeft: '별',
    bottomRight: '기계음',
    cardLabel: '수제화거리',
    badge: 'Workshop',
    image: 'assets/images/shoemaking-home.jpg',
    audio: 'assets/audio/shoemaking.mp3',
    topColor: '#ff45d5',
    panelBg: '#d5ee67',
    rightColor: '#f8f3b5',
    leftColor: '#ffffff',
    detailColor: '#ff45d5',
    mode: 'shoemaking'
  },
  yeonmujang: {
    id: 'yeonmujang',
    name: '연무장길',
    subtitle: 'YEONMUJANG STREET',
    motif: '지붕',
    bottomLeft: '세모',
    bottomRight: '지붕',
    cardLabel: '연무장로',
    badge: 'Street',
    image: 'assets/images/yeonmujang-home.jpg',
    audio: 'assets/audio/yeonmujang.mp3',
    topColor: '#ff160c',
    panelBg: '#b9d0e9',
    rightColor: '#ffffff',
    leftColor: '#dce7f7',
    detailColor: '#ff160c',
    mode: 'yeonmujang'
  },
  cafe: {
    id: 'cafe',
    name: '카페거리',
    subtitle: 'CAFE STREET',
    motif: '창문',
    bottomLeft: '네모',
    bottomRight: '창문',
    cardLabel: '카페거리',
    badge: 'Cafe',
    image: 'assets/images/cafe-home.jpg',
    audio: 'assets/audio/cafe.mp3',
    topColor: '#0c66cb',
    panelBg: '#b8cfe7',
    rightColor: '#f1f246',
    leftColor: '#f1f246',
    detailColor: '#0c66cb',
    mode: 'cafe'
  }
};

const homeOrder = ['seoulForest', 'cafe', 'yeonmujang', 'shoemaking', 'subway'];

const homeScreen = document.getElementById('home-screen');
const homeStage = document.getElementById('home-stage');
const sceneScreen = document.getElementById('scene-screen');
const exitButton = document.getElementById('exit-button');
const canvas = document.getElementById('scene-canvas');
const ctx = canvas.getContext('2d');
const audioEl = document.getElementById('scene-audio');

let dpr = Math.min(window.devicePixelRatio || 1, 2);
let width = window.innerWidth;
let height = window.innerHeight;
let activeSceneId = null;
let currentScene = null;
let homeCards = [];
let animationId = null;
let lastFrame = performance.now();
let mouse = { x: 0, y: 0, inside: false };
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let freqData = null;
let timeData = null;
let prevRms = 0;
let prevLevel = 0;
let transient = 0;
let scrollDelta = 0;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', () => {
  resizeCanvas();
  if (homeScreen.classList.contains('active')) {
    layoutHomeCards();
  }
});
resizeCanvas();

function initAudioAnalyser() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.54;
  sourceNode = audioCtx.createMediaElementSource(audioEl);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
  freqData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
}

function getAudioMetrics() {
  if (!analyser || audioEl.paused) {
    const idle = 0.065 + 0.014 * Math.sin(performance.now() * 0.0012);
    return { level: idle, bass: idle * 0.9, mid: idle * 1.1,
      high: idle * 0.8, transient: 0, rms: 0 };
  }
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  const rangeAvg = (a, b) => {
    let sum = 0;
    const end = Math.min(b, freqData.length);
    for (let i = a; i < end; i++) sum += freqData[i];
    return sum / Math.max(1, end - a) / 255;
  };
  let power = 0;
  for (let i=0; i<timeData.length; i++) {
    const v = (timeData[i]-128)/128;
    power += v*v;
  }
  const rms = Math.sqrt(power/timeData.length);
  const bass = rangeAvg(1, 12);
  const lowMid = rangeAvg(12, 50);
  const mid = rangeAvg(50, 130);
  const high = rangeAvg(130, 320);
  // Sound dynamics are intentionally preserved; no automatic volume normalization here.
  const instantaneous = clamp(0.75*rms*2.1 + 0.25*(bass + lowMid + mid), 0, 1);
  const peak = Math.max(0, rms-prevRms);
  const onset = Math.max(0, instantaneous-prevLevel);
  const transient = Math.max(peak*2.8, onset*1.5);
  prevRms = prevRms*0.47 + rms*0.53;
  prevLevel = prevLevel*0.61 + instantaneous*0.39;
  return { level:prevLevel, bass, mid:(mid+lowMid)*0.5,
    high, transient, rms };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function rand(min, max) { return min + Math.random() * (max - min); }

function createHomeCards() {
  homeStage.innerHTML = '';
  homeCards = homeOrder.map((id, index) => {
    const scene = SCENES[id];
    const el = document.createElement('button');
    el.className = 'floating-card';
    el.type = 'button';
    el.setAttribute('aria-label', `${scene.name} 상세 보기`);
    el.innerHTML = `<img src="${scene.image}" alt="" draggable="false" />`;
    el.addEventListener('click', () => openScene(id));
    homeStage.appendChild(el);
    return {
      id, scene, el, index,
      x: 0, y: 0,
      anchorX: 0, anchorY: 0,
      w: 260, h: 170,
      phase: 0.55 + index * 1.37,
      phase2: 0.25 + index * 1.83,
      nudgeX: 0, nudgeY: 0,
      angle: 0,
      hover: false,
    };
  });
  layoutHomeCards();
}

function layoutHomeCards() {
  // Coordinates from the provided Home.png (1728 × 1117).
  // Each card keeps its original composition instead of freely roaming the viewport.
  const baseW = 1728, baseH = 1117;
  const scale = Math.min(width / baseW, height / baseH);
  const left = (width - baseW * scale) / 2;
  const top = (height - baseH * scale) / 2;
  const cards = [
    { x: 70, y: 375, w: 500, h: 333 },   // 서울숲
    { x: 273, y: 95, w: 344, h: 251 },   // 카페거리
    { x: 690, y: 143, w: 565, h: 332 },  // 연무장길
    { x: 539, y: 727, w: 360, h: 202 },  // 수제화거리
    { x: 1051, y: 520, w: 409, h: 410 } // 성수역
  ];
  homeCards.forEach((card, i) => {
    const c = cards[i];
    card.w = c.w * scale;
    card.h = c.h * scale;
    card.anchorX = left + c.x * scale;
    card.anchorY = top + c.y * scale;
    card.el.style.width = `${card.w}px`;
    card.el.style.height = `${card.h}px`;
    card.el.style.zIndex = `${10 + i}`;
    card.nudgeX = 0;
    card.nudgeY = 0;
    card.x = card.anchorX;
    card.y = card.anchorY;
    updateHomeCardTransform(card);
  });
}

function updateHomeCardTransform(card) {
  const scale = Math.min(width / 1728, height / 1117);
  const t = performance.now() / 1000;
  const ax = (7 * Math.sin(t * 0.35 + card.phase) + 2 * Math.sin(t * 0.73 + card.phase2)) * scale;
  const ay = (6 * Math.cos(t * 0.29 + card.phase2) + 2.5 * Math.sin(t * 0.51 + card.phase)) * scale;
  const x = card.anchorX + ax + card.nudgeX;
  const y = card.anchorY + ay + card.nudgeY;
  card.x = x;
  card.y = y;
  const rotation = 0.006 * Math.sin(t * 0.28 + card.phase);
  card.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotation.toFixed(4)}rad)`;
}

function updateHome(dt) {
  // Very small collision response, damped and tethered to the reference positions.
  homeCards.forEach(card => {
    card.nudgeX *= 0.93;
    card.nudgeY *= 0.93;
    updateHomeCardTransform(card);
  });
  for (let i = 0; i < homeCards.length; i++) {
    for (let j = i + 1; j < homeCards.length; j++) {
      const a = homeCards[i];
      const b = homeCards[j];
      const xOverlap = Math.min(a.x + a.w - b.x, b.x + b.w - a.x);
      const yOverlap = Math.min(a.y + a.h - b.y, b.y + b.h - a.y);
      if (xOverlap > 0 && yOverlap > 0) {
        if (xOverlap < yOverlap) {
          const sign = a.x < b.x ? -1 : 1;
          a.nudgeX = clamp(a.nudgeX + sign * 0.3, -5, 5);
          b.nudgeX = clamp(b.nudgeX - sign * 0.3, -5, 5);
        } else {
          const sign = a.y < b.y ? -1 : 1;
          a.nudgeY = clamp(a.nudgeY + sign * 0.3, -5, 5);
          b.nudgeY = clamp(b.nudgeY - sign * 0.3, -5, 5);
        }
      }
    }
  }
}

function getPanelRect() {
  const marginX = Math.max(90, width * 0.08);
  const marginY = Math.max(72, height * 0.12);
  const maxW = width - marginX * 2;
  const maxH = height - marginY * 2;
  let panelW = Math.min(maxW, maxH * 4 / 3);
  let panelH = panelW * 3 / 4;
  if (panelH > maxH) {
    panelH = maxH;
    panelW = panelH * 4 / 3;
  }
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  return { x, y, w: panelW, h: panelH };
}

class BaseScene {
  constructor(config) {
    this.config = config;
    this.clickPulse = 0;
  }
  update(dt, metrics) {
    this.clickPulse = Math.max(0, this.clickPulse - dt * 1.8);
  }
  onClick(x, y, panel) {
    this.clickPulse = 1;
  }
  onMouseMove() {}
  onWheel(delta) {
    scrollDelta += delta;
  }
  drawFrame(ctx, metrics, time) {
    const p = getPanelRect();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    this.drawShell(ctx, p);
    this.drawScene(ctx, p, metrics, time);
  }
  drawShell(ctx, p) {
    const c = this.config;
    ctx.fillStyle = c.panelBg;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    const topY = p.y + 44;
    const fontSize = clamp(p.w * 0.020, 14, 22);
    ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
    ctx.fillStyle = c.topColor;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('Sound', p.x + 28, topY);
    ctx.textAlign = 'center';
    ctx.fillText('of', p.x + p.w / 2, topY);
    ctx.textAlign = 'right';
    ctx.fillText('Seongsu', p.x + p.w - 28, topY);

    const sideY = p.y + p.h / 2 + 20;
    const sideFont = clamp(p.w * 0.022, 16, 26);
    ctx.font = `700 ${sideFont}px Inter, Arial, "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = c.leftColor;
    ctx.fillText(c.name, 68, sideY);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.rightColor;
    ctx.fillText(c.motif, width - 68, sideY);

    const bottomFont = clamp(p.w * 0.021, 15, 24);
    ctx.font = `800 ${bottomFont}px Inter, Arial, "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = c.detailColor;
    ctx.fillText(c.bottomLeft, p.x + 28, p.y + p.h - 48);
    ctx.textAlign = 'right';
    ctx.fillText(c.bottomRight, p.x + p.w - 28, p.y + p.h - 48);
  }
}

class ForestScene extends BaseScene {
  constructor(config) {
    super(config);
    this.extraRipples = [];
  }
  update(dt, metrics) {
    super.update(dt, metrics);
    if (Math.random() < metrics.high * 0.18 + metrics.level * 0.03) {
      this.extraRipples.push({ r: 18, a: 0.65, off: rand(-8, 8) });
    }
    this.extraRipples.forEach(r => { r.r += 48 * dt; r.a -= 0.42 * dt; });
    this.extraRipples = this.extraRipples.filter(r => r.a > 0.01);
  }
  onClick(x, y, panel) {
    super.onClick(x, y, panel);
    this.extraRipples.push({ r: 10, a: 0.95, off: (x - (panel.x + panel.w / 2)) * 0.05 });
  }
  drawScene(ctx, p, metrics, time) {
    const pond = {
      x: p.x + p.w * 0.13,
      y: p.y + p.h * 0.56,
      w: p.w * 0.6,
      h: p.h * 0.25
    };
    ctx.fillStyle = '#d6ea5d';
    ctx.fillRect(pond.x, pond.y, pond.w, pond.h);
    ctx.strokeStyle = 'rgba(170,184,40,0.92)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(pond.x + pond.w * 0.68, pond.y + pond.h * 0.31, pond.w * 0.26, pond.h * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();

    const cx = pond.x + pond.w * 0.62;
    const cy = pond.y + pond.h * 0.08;
    ctx.strokeStyle = 'rgba(166, 188, 30, 0.96)';
    ctx.lineWidth = 2.2;
    const baseRipple = 24 + metrics.level * 26;
    for (let i = 0; i < 4; i++) {
      const rr = baseRipple + i * 26 + Math.sin(time * 1.4 + i) * 8;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, rr, rr * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.extraRipples.forEach((r) => {
      ctx.strokeStyle = `rgba(166, 188, 30, ${r.a})`;
      ctx.beginPath();
      ctx.ellipse(cx + r.off, cy + 4, r.r, r.r * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.fillStyle = '#f1ef2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = clamp(p.w * 0.04, 18, 38);
    ctx.font = `${font}px Inter, "Noto Sans KR", sans-serif`;

    // Four staggered arcs originate at the same nozzle. Glyphs move continuously
    // along each parabola; audio affects the maximum rise and dispersal.
    ctx.fillStyle = '#f2ee31';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${clamp(p.w * 0.026, 15, 28)}px "Noto Sans KR", sans-serif`;
    const streams = [
      { dir: -1, reach: 0.40, height: 0.28, shift: 0.00 },
      { dir: -1, reach: 0.25, height: 0.39, shift: 0.12 },
      { dir: 1, reach: 0.25, height: 0.40, shift: 0.22 },
      { dir: 1, reach: 0.43, height: 0.29, shift: 0.30 }
    ];
    streams.forEach((s, idx) => {
      const peak = p.h * (s.height + Math.min(0.12, metrics.level * 0.13));
      const reach = p.w * s.reach * (1 + metrics.mid * 0.2);
      for (let i = 0; i < 17; i++) {
        const u = ((i / 17) + time * (0.055 + metrics.level * 0.12) + s.shift) % 1;
        const yy = cy - 4 * peak * u * (1 - u) + Math.sin(time * 1.4 + i * 1.9 + idx) * 2;
        const xx = cx + s.dir * reach * u + Math.sin(time * 0.9 + i + idx) * 2.5;
        ctx.save();
        ctx.globalAlpha = (Math.sin(Math.PI * u) * 0.45 + 0.38);
        ctx.fillText('水', xx, yy);
        ctx.restore();
      }
    });
    // Short central jet that remains below the page heading.
    for (let i = 0; i < 8; i++) {
      const u = ((i / 8) + time * (0.09 + metrics.level * 0.12)) % 1;
      ctx.globalAlpha = 0.45 + 0.4 * (1 - u);
      ctx.fillText('水', cx + Math.sin(u * 15 + time) * 4, cy - u * p.h * (0.24 + Math.min(0.1, metrics.level * 0.14)));
    }
    ctx.globalAlpha = 1;
  }
}

class SubwayScene extends BaseScene {
  constructor(config) {
    super(config);
    this.offset = 0;
  }
  update(dt, metrics) {
    super.update(dt, metrics);
    // Old speed: 100 + level * 90. Exactly 50% of that speed.
    this.offset -= (50 + metrics.level * 45) * dt;
    this.offset -= scrollDelta * 0.52;
    scrollDelta *= 0.78;
  }
  drawScene(ctx, p, metrics, time) {
    // Exact step-band silhouette traced from the user's subway reference.
    // Six rows per repeating cycle: left → right → rightmost → left.
    const stepX = p.w*0.185;
    const blockW = stepX*2;
    const stepH = p.h*0.069;
    const baseX = p.x + p.w*0.03;
    const cycleH = stepH*6;
    const pattern = [0,1,2,3,2,1];
    const phase = ((this.offset % cycleH)+cycleH)%cycleH;
    ctx.fillStyle = '#ffffb6';
    const startRow = Math.floor((-cycleH*2-phase)/stepH);
    const endRow = Math.ceil((height+cycleH*2-phase)/stepH);
    for (let row=startRow;row<=endRow;row++) {
      const idx=((row%6)+6)%6;
      const y=row*stepH+phase;
      const x=baseX+pattern[idx]*stepX;
      ctx.fillRect(x, y, blockW+0.35, stepH+0.35);
    }
  }
}

function makeStarVertices(spikes) {
  const verts = [];
  for (let i = 0; i < spikes*2; i++) {
    const r = i%2===0 ? 1 : rand(0.23,0.54);
    const a = -Math.PI/2 + i*Math.PI/spikes + rand(-0.10,0.10);
    verts.push([Math.cos(a)*r*rand(0.83,1.23), Math.sin(a)*r*rand(0.83,1.23)]);
  }
  return verts;
}

function drawStarShape(ctx, star) {
  ctx.beginPath();
  star.verts.forEach(([vx,vy],i)=>{
    if(i===0) ctx.moveTo(vx*star.radius,vy*star.radius);
    else ctx.lineTo(vx*star.radius,vy*star.radius);
  });
  ctx.closePath();
}

class ShoemakingScene extends BaseScene {
  constructor(config) {
    super(config);
    this.stars = [];
    this.cooldown = 0;
    this.elapsed = 0;
  }
  update(dt, metrics) {
    super.update(dt, metrics);
    this.elapsed += dt;
    this.cooldown -= dt;
    // The new hammer samples have high attack/RMS changes.
    const impact = metrics.transient*3.8 + metrics.rms*1.35;
    if ((metrics.transient > 0.032 || metrics.rms > 0.19) && this.cooldown <= 0) {
      this.spawnStar(undefined, undefined, clamp(impact,0.05,1));
      this.cooldown = metrics.transient>0.075 ? 0.17 : 0.30;
    }
    this.stars.forEach(s => {
      s.age += dt;
      s.opacity = s.age < 0.16 ? s.age/0.16 : Math.max(0, 1 - (s.age-0.16)/(s.duration-0.16));
    });
    this.stars = this.stars.filter(s => s.age < s.duration);
  }
  spawnStar(forceX,forceY,energy=0.5) {
    const p=getPanelRect();
    const canGiant = energy > 0.4 && Math.random() < 0.70;
    // Some stars are as wide as half the viewport, and are not clipped to panel.
    const radius = canGiant
      ? rand(Math.min(width,height)*0.25, Math.min(width,height)*0.46)
      : rand(22, 100)*(0.7+energy*1.2);
    const s={
      x: forceX ?? rand(p.x-0.22*p.w, p.x+1.18*p.w),
      y: forceY ?? rand(p.y-0.24*p.h, p.y+1.2*p.h),
      radius, verts:makeStarVertices(Math.round(rand(6,13))),
      rotation:rand(-1,1), age:0, duration:rand(1.15,2.7),
      opacity:0, energy,
    };
    this.stars.push(s);
    if(this.stars.length>28) this.stars.shift();
  }
  onClick(x,y){this.spawnStar(x,y,1)}
  drawScene(ctx,p,metrics,time){
    ctx.fillStyle='#ff43ce';
    // A few subtle base stars hold the original composition; main event stars bloom over it.
    const accents=[
      {x:p.x+p.w*0.30,y:p.y+p.h*0.28,r:0.075},
      {x:p.x+p.w*0.73,y:p.y+p.h*0.36,r:0.125},
      {x:p.x+p.w*0.20,y:p.y+p.h*0.43,r:0.035}
    ];
    accents.forEach((v,i)=>{
      const radius=p.w*v.r*(1+0.03*Math.sin(time*0.9+i));
      ctx.save(); ctx.translate(v.x,v.y); ctx.rotate(time*0.04*(i%2?1:-1));
      ctx.beginPath();
      const count=i===0?26:i===1?12:5;
      for(let n=0;n<count*2;n++){
        const a=-Math.PI/2+n*Math.PI/count;
        const r=n%2===0?radius:radius*0.52;
        if(n===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
        else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      ctx.closePath(); ctx.globalAlpha=0.7;ctx.fill();ctx.restore();
    });
    this.stars.forEach(s=>{
      ctx.save();ctx.translate(s.x,s.y);
      const pop=Math.min(1,s.age/0.20);
      ctx.scale(pop*(1+0.035*Math.sin(s.age*6)), pop*(1+0.035*Math.sin(s.age*6)));
      ctx.rotate(s.rotation + s.age*0.08);
      ctx.globalAlpha=s.opacity;
      drawStarShape(ctx,s);
      ctx.fill();ctx.restore();
    });
  }
}

class YeonmujangScene extends BaseScene {
  constructor(config) {
    super(config);
    this.triangles = [];
    this.cooldown = 0;
    this.grid = [];
    this.gridIndex = 0;
    this.demoTick = 0.4;
  }
  buildGrid(panel) {
    this.grid = [];
    const rows = 9;
    const cols = 4;
    const cellW = panel.w * 0.18;
    const cellH = panel.h * 0.095;
    const originX = panel.x + panel.w * 0.15;
    const originY = panel.y + panel.h * 0.16;
    for (let r = -1; r < rows + 1; r++) {
      for (let c = 0; c < cols; c++) {
        this.grid.push({
          x: originX + c * cellW + ((r % 2 === 0) ? 0 : cellW * 0.5),
          y: originY + r * cellH,
          up: (c + r) % 2 === 0
        });
      }
    }
  }
  update(dt, metrics) {
    super.update(dt, metrics);
    const p = getPanelRect();
    if (this.grid.length === 0) this.buildGrid(p);
    this.cooldown -= dt;
    this.demoTick -= dt;
    if ((metrics.transient > 0.015 || metrics.mid > 0.14 || this.demoTick <= 0) && this.cooldown <= 0) {
      this.addTriangle();
      this.cooldown = 0.2 + Math.random() * 0.2;
      this.demoTick = rand(0.65, 1.3) * (1.1 - Math.min(metrics.level, 0.5));
    }
    this.triangles.forEach(tr => {
      tr.life += dt;
      tr.scale = Math.min(1, tr.scale + dt * 4.2);
    });
  }
  addTriangle(forceX, forceY) {
    const p = getPanelRect();
    let base;
    if (forceX != null && forceY != null) {
      base = { x: forceX, y: forceY, up: Math.random() > 0.5 };
    } else {
      base = this.grid[this.gridIndex % this.grid.length];
      this.gridIndex += 1;
    }
    this.triangles.push({ ...base, size: p.w * 0.09, life: 0, scale: 0.01 });
    if (this.triangles.length > 42) this.triangles.shift();
  }
  onClick(x, y) {
    super.onClick(x, y);
    this.addTriangle(x, y);
  }
  drawScene(ctx, p, metrics, time) {
    ctx.fillStyle = '#ff150d';
    this.triangles.forEach(tr => {
      ctx.save();
      ctx.translate(tr.x, tr.y);
      ctx.scale(Math.max(0.001, tr.scale), Math.max(0.001, tr.scale));
      ctx.beginPath();
      if (tr.up) {
        ctx.moveTo(-tr.size * 0.5, tr.size * 0.38);
        ctx.lineTo(0, -tr.size * 0.38);
        ctx.lineTo(tr.size * 0.5, tr.size * 0.38);
      } else {
        ctx.moveTo(-tr.size * 0.5, -tr.size * 0.38);
        ctx.lineTo(tr.size * 0.5, -tr.size * 0.38);
        ctx.lineTo(0, tr.size * 0.38);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }
}

class CafeScene extends BaseScene {
  constructor(config) {
    super(config);
    this.tiles = [];
    this.hoverIndex = -1;
  }
  ensureTiles(p) {
    if (this.tiles.length) return;
    // Symmetric 9-column arrangement centered on the panel, as in cafe-detail.png.
    const cols = 9;
    const rows = 10;
    const tileW = p.w*0.106;
    const tileH = p.h*0.154;
    const fullW = cols*tileW;
    const startX = p.x+(p.w-fullW)/2;
    const startY = p.y - tileH*1.28;
    for (let r=0;r<rows;r++) {
      for(let c=0;c<cols;c++) {
        const parity = (r+c)%2;
        this.tiles.push({
          c,r,
          x:startX+c*tileW,
          y:startY+r*tileH,
          w:tileW,
          h:tileH,
          parity,
          phase:0.7*c+1.22*r,
          open:0,target:0
        });
      }
    }
  }
  update(dt,metrics){
    super.update(dt,metrics);
    this.ensureTiles(getPanelRect());
    this.tiles.forEach((tile,i)=>{
      const gently = 0.06 + Math.sin(performance.now()*0.001+tile.phase)*0.025 + metrics.level*0.23;
      tile.target=clamp(gently,0.01,0.34);
      if(i===this.hoverIndex)tile.target=0.97;
      tile.open += (tile.target-tile.open)*Math.min(1,dt*7.5);
    });
  }
  onMouseMove(x,y){
    this.ensureTiles(getPanelRect());
    this.hoverIndex=-1;
    this.tiles.forEach((tile,i)=>{
      // Only lit panels are openable, not the gaps.
      if(tile.parity===0 && x>=tile.x && x<=tile.x+tile.w && y>=tile.y && y<=tile.y+tile.h)
        this.hoverIndex=i;
    });
  }
  drawScene(ctx,p,metrics,time){
    ctx.fillStyle='#edff00';
    this.tiles.forEach(tile=>{
      if(tile.parity!==0)return;
      const shrink=tile.w*0.72*tile.open;
      const skew=tile.h*0.11*tile.open;
      // A hinged rectangular flap seen in perspective, rotating around its left y-axis.
      ctx.beginPath();
      ctx.moveTo(tile.x,tile.y);
      ctx.lineTo(tile.x+tile.w-shrink,tile.y-skew);
      ctx.lineTo(tile.x+tile.w-shrink,tile.y+tile.h+skew);
      ctx.lineTo(tile.x,tile.y+tile.h);
      ctx.closePath();
      ctx.fill();
      if(tile.open>0.18){
        ctx.strokeStyle='rgba(13,102,203,0.32)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(tile.x,tile.y);ctx.lineTo(tile.x,tile.y+tile.h);ctx.stroke();
      }
    });
  }
}

function buildSceneInstance(id) {
  const cfg = SCENES[id];
  switch (cfg.mode) {
    case 'forest': return new ForestScene(cfg);
    case 'subway': return new SubwayScene(cfg);
    case 'shoemaking': return new ShoemakingScene(cfg);
    case 'yeonmujang': return new YeonmujangScene(cfg);
    case 'cafe': return new CafeScene(cfg);
    default: return new BaseScene(cfg);
  }
}

async function openScene(id) {
  activeSceneId = id;
  currentScene = buildSceneInstance(id);
  const exitMark=document.querySelector('.exit-outline');
  if(exitMark) exitMark.setAttribute('fill',{
    seoulForest:'#e9fa5b',subway:'#00ba67',shoemaking:'#eeff6d',
    yeonmujang:'#c3e3ff',cafe:'#f0ff35'
  }[id] || '#baff3c');
  homeScreen.classList.remove('active');
  sceneScreen.classList.add('active');
  initAudioAnalyser();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  audioEl.src = SCENES[id].audio;
  prevLevel = 0;
  prevRms = 0;
  scrollDelta = 0;
  audioEl.currentTime = 0;
  try { await audioEl.play(); } catch (e) { console.warn(e); }
}

function closeScene() {
  activeSceneId = null;
  currentScene = null;
  audioEl.pause();
  sceneScreen.classList.remove('active');
  homeScreen.classList.add('active');
}
exitButton.addEventListener('click', closeScene);

canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.inside = true;
  if (currentScene?.onMouseMove) currentScene.onMouseMove(mouse.x, mouse.y);
});
canvas.addEventListener('mouseleave', () => {
  mouse.inside = false;
  if (currentScene?.hoverIndex != null) currentScene.hoverIndex = -1;
});
canvas.addEventListener('click', (e) => {
  if (!currentScene) return;
  const p = getPanelRect();
  currentScene.onClick(e.clientX, e.clientY, p);
});
canvas.addEventListener('wheel', (e) => {
  if (!currentScene) return;
  if (currentScene.onWheel) currentScene.onWheel(e.deltaY);
}, { passive: true });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeSceneId) closeScene();
});

function animate(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;

  if (homeScreen.classList.contains('active')) {
    updateHome(dt);
  } else if (currentScene) {
    const metrics = getAudioMetrics();
    currentScene.update(dt, metrics);
    currentScene.drawFrame(ctx, metrics, now * 0.001);
  }
  animationId = requestAnimationFrame(animate);
}

createHomeCards();
requestAnimationFrame(animate);
