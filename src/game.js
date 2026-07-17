// --- ZOMBIE SURVIVOR: MOTOR DE JUEGO PROFESIONAL ---

// 1. SINTETIZADOR DE AUDIO PRODUCIDO POR SOFTWARE (Web Audio API)
const AudioSynth = {
  ctx: null,
  musicInterval: null,
  isEnabled: false,
  volume: 0.3,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API no soportada en este navegador.");
    }
  },

  toggle(state) {
    this.isEnabled = state;
    this.init();
    if (this.isEnabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  },

  setVolume(val) {
    this.volume = val / 100 * 0.5;
  },

  playTone(freq, type, duration, gainStart, gainEnd = 0.001) {
    if (!this.ctx || !this.isEnabled) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(gainStart * this.volume * 2, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(gainEnd, this.ctx.currentTime + duration);
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },

  playNoise(duration, gainStart, filterFreq = 1000, type = "lowpass") {
    if (!this.ctx || !this.isEnabled) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(gainStart * this.volume * 2, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      noiseNode.start();
    } catch (e) {}
  },

  playShoot(weapon) {
    this.init();
    if (!this.isEnabled) return;
    switch (weapon) {
      case 'PISTOL':
        this.playTone(880, 'square', 0.08, 0.5);
        this.playNoise(0.12, 0.4, 2000, 'bandpass');
        break;
      case 'PLASMA':
        this.playTone(1200, 'sawtooth', 0.12, 0.4);
        this.playTone(600, 'sine', 0.15, 0.3);
        break;
      case 'SHOTGUN':
        this.playNoise(0.3, 1.0, 800, 'lowpass');
        this.playTone(220, 'triangle', 0.15, 0.8);
        break;
      case 'ROCKET':
        this.playTone(150, 'sawtooth', 0.4, 0.9);
        this.playNoise(0.4, 0.8, 400, 'lowpass');
        break;
      case 'FLAMETHROWER':
        // Un ruido siseante corto (se llama repetidamente en bucle de disparo)
        this.playNoise(0.15, 0.25, 1200, 'bandpass');
        break;
      case 'KNIFE':
        this.playTone(400, 'triangle', 0.05, 0.3);
        this.playTone(800, 'sine', 0.08, 0.2);
        break;
    }
  },

  playExplosion() {
    this.init();
    if (!this.isEnabled) return;
    this.playNoise(0.8, 1.2, 200, 'lowpass');
    this.playTone(80, 'triangle', 0.6, 1.0);
    this.playTone(40, 'sine', 0.8, 1.2);
  },

  playPickup() {
    this.init();
    if (!this.isEnabled) return;
    this.playTone(523.25, 'sine', 0.08, 0.3); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.12, 0.3), 80); // E5
  },

  playHurt() {
    this.init();
    if (!this.isEnabled) return;
    this.playTone(150, 'sawtooth', 0.2, 0.6);
    this.playTone(90, 'triangle', 0.25, 0.8);
  },

  playZombieDeath() {
    this.init();
    if (!this.isEnabled) return;
    this.playNoise(0.4, 0.5, 300, 'lowpass');
    this.playTone(110, 'sawtooth', 0.3, 0.4);
  },

  playNuke() {
    this.init();
    if (!this.isEnabled) return;
    this.playTone(200, 'sawtooth', 2.0, 1.5);
    this.playNoise(2.5, 2.0, 150, 'lowpass');
    // Alarma nuclear descendente
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playTone(600 - i * 80, 'sawtooth', 0.4, 0.7);
      }, i * 500);
    }
  },

  startMusic() {
    this.stopMusic();
    if (!this.ctx || !this.isEnabled) return;
    let step = 0;
    // Secuenciador de bajo sintético simple (Retro Cyberpunk Beat)
    const bassline = [110, 110, 130, 110, 110, 146, 110, 165]; // Frecuencias la, la, do, la, la, re, la, mi
    this.musicInterval = setInterval(() => {
      if (!this.isEnabled) return;
      const freq = bassline[step % bassline.length];
      // Nota de bajo
      this.playTone(freq / 2, 'sawtooth', 0.18, 0.18, 0.01);
      // Platillo (hi-hat) en los contratiempos
      if (step % 2 === 1) {
        this.playNoise(0.04, 0.08, 6000, 'highpass');
      }
      // Bombo en pasos pares
      if (step % 4 === 0) {
        this.playTone(60, 'sine', 0.15, 0.35, 0.01);
      }
      step++;
    }, 220); // ~136 BPM
  },

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
};

// 2. CONFIGURACIÓN DEL SISTEMA DE ARMAS Y ENEMIGOS
const WEAPONS = {
  KNIFE: { id: 'KNIFE', icon: '🔪', range: 120, damage: 1600, delay: 200, color: '#e2e8f0', ammo: null, type: 'melee' },
  PISTOL: { id: 'PISTOL', icon: '🔫', speed: 30, damage: 900, delay: 150, color: '#fbbf24', ammo: 120, maxAmmo: 250, type: 'range' },
  PLASMA: { id: 'PLASMA', icon: '⚡', speed: 45, damage: 700, delay: 60, color: '#00f2ff', ammo: 300, maxAmmo: 600, type: 'range' },
  SHOTGUN: { id: 'SHOTGUN', icon: '🎯', speed: 25, damage: 850, delay: 350, color: '#f97316', ammo: 60, maxAmmo: 120, type: 'range', spread: true },
  ROCKET: { id: 'ROCKET', icon: '🚀', speed: 20, damage: 15000, delay: 900, color: '#ef4444', ammo: 15, maxAmmo: 30, type: 'projectile', explosive: true },
  FLAMETHROWER: { id: 'FLAMETHROWER', icon: '🔥', speed: 18, damage: 450, delay: 30, color: '#ff7b00', ammo: 500, maxAmmo: 999, type: 'range', isFlame: true }
};

// Dificultad Aumentada
const ZOMBIE_CLASSES = {
  STALKER: { id: 'STALKER', name: 'Acechador', radius: 24, hp: 1800, speed: 3.2, damage: 12, color: '#16a34a', points: 200 },
  RUNNER: { id: 'RUNNER', name: 'Corredor', radius: 18, hp: 900, speed: 5.5, damage: 10, color: '#ea580c', points: 300 },
  TANK: { id: 'TANK', name: 'Tanque', radius: 44, hp: 12000, speed: 2.0, damage: 35, color: '#7c3aed', points: 1500, hasStomp: true },
  SPITTER: { id: 'SPITTER', name: 'Escupidor', radius: 22, hp: 1500, speed: 3.0, damage: 15, color: '#a3e635', points: 500, isRanged: true }
};

// 3. ESTADOS GLOBALES DE JUEGO
let canvas, ctx, miniMapCanvas, mctx, windowMapCanvas, wctx;
let player = null;
let gameSpeedFactor = 1.0;
let isMultiplayer = false;
let currentRoomId = null;
let gameStartTime = null;
let radiationActive = false;
let radiationStartTime = null;
let isGameOver = false;
let isPaused = false;
let score = 0;
let kills = 0;
let targetKills = 80;
let currentLvl = 1;
let activeWKey = 'KNIFE';
let selectedAvatarIdx = 0;
let isFiring = false;
let lastFire = 0;
let lastMinePlacement = 0;
const mineCooldown = 4000;
let currentBunker = null;
let lastBunkerUse = 0;
const bunkerCooldown = 60000;
let camera = { x: 0, y: 0, zoom: 0.85 };
let localCache = null;

// Colecciones de Entidades
let entities = [];
let bullets = [];
let items = [];
let buildings = [];
let portals = [];
window.mines = [];
window.bunkers = [];
window.particles = [];
window.remotePlayers = [];
window.weaponPickups = [];

// Logros
let achievements = {
  zombieSlayer: { unlocked: false, required: 100, label: "Matanzombie" },
  survivor: { unlocked: false, required: 300, label: "Superviviente" }, // 5 min
  weaponMaster: { unlocked: false, required: 5, label: "Maestro de Armas" }
};
let skillCooldowns = { heal: 0, shield: 0, nuke: 0 };
let usedWeapons = new Set(['KNIFE']);

// Controles táctiles
let joystickLeft = null;
let joystickRight = null;
let keys = {};

// Carga e procesamiento de imágenes transparentes de Sprites Reales
function makeImageTransparent(srcPath, callback) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0);
    try {
      const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Quitar fondo negro (croma key de píxeles oscuros)
        if (data[i] < 16 && data[i+1] < 16 && data[i+2] < 16) {
          data[i+3] = 0; // Transparencia total
        }
      }
      tempCtx.putImageData(imgData, 0, 0);
      const transparentImg = new Image();
      transparentImg.src = tempCanvas.toDataURL();
      transparentImg.onload = () => callback(transparentImg);
    } catch(e) {
      console.warn("Fallo aplicando transparencia local:", e);
      callback(img);
    }
  };
  img.onerror = () => {
    console.error("Error cargando sprite local:", srcPath);
  };
  img.src = srcPath;
}

let zombieSpriteImg = null;
let playerSpriteImg = null;

makeImageTransparent('assets/zombies/zombie.png', (img) => {
  zombieSpriteImg = img;
});

makeImageTransparent('assets/avatars/player.png', (img) => {
  playerSpriteImg = img;
});

// 4. CLASE ENTITY PRINCIPAL
class Entity {
  constructor(x, y, config) {
    this.x = x;
    this.y = y;
    this.type = config.type; // 'human', 'bot', 'zombie'
    this.classId = config.classId || null;
    this.isPlayer = config.isPlayer || false;
    this.isRemote = config.isRemote || false;
    this.team = config.team || 'zombie';
    this.radius = config.radius || 25;
    this.maxHp = config.hp || 1000;
    this.hp = this.maxHp;
    this.speed = config.speed || 3.0;
    this.damage = config.damage || 5;
    this.angle = config.angle || 0;
    this.color = config.color || '#fff';
    this.invul = 0;
    this.active = true;
    this.lives = config.lives || 3;
    this.hasHelmet = config.hasHelmet || false;
    this.name = config.name || 'Agente';
    this.weapon = config.weapon || 'KNIFE';
    this.shieldActive = false;
    this.shieldTime = 0;
    this.burnTime = 0; // Efecto de fuego del lanzallamas

    // Estados de animación
    this.walkCycle = 0;
    this.isMoving = false;
    this.lastX = x;
    this.lastY = y;
  }

  // Los zombies crecen físicamente y en radio de colisión con el nivel
  getCollisionRadius() {
    if (this.team === 'zombie') {
      const scaleMultiplier = 1.0 + (currentLvl - 1) * 0.08;
      return this.radius * scaleMultiplier;
    }
    return this.radius;
  }

  update() {
    const dt = gameSpeedFactor;
    if (this.invul > 0) this.invul -= dt;
    if (this.shieldActive) {
      this.shieldTime -= dt;
      if (this.shieldTime <= 0) this.shieldActive = false;
    }

    // Efecto de daño por quemadura (Lanzallamas)
    if (this.burnTime > 0) {
      this.burnTime -= dt;
      this.takeDamage(1.5 * dt, true); // Daño continuo
      if (Math.random() < 0.25) {
        spawnParticle(this.x + (Math.random()-0.5)*20, this.y + (Math.random()-0.5)*20, {
          vx: (Math.random()-0.5)*2,
          vy: -2 - Math.random()*2,
          color: 'rgba(255, ' + (100 + Math.floor(Math.random()*155)) + ', 0, 0.8)',
          size: 4 + Math.random()*4,
          life: 15 + Math.random()*15
        });
      }
    }

    // Verificar movimiento para animación de piernas
    this.isMoving = Math.hypot(this.x - this.lastX, this.y - this.lastY) > 0.5;
    if (this.isMoving) {
      this.walkCycle += 0.2 * dt;
    }
    this.lastX = this.x;
    this.lastY = this.y;

    if (!this.isRemote) {
      if (this.isPlayer) {
        this.checkCollisions();
      }
      if (this.type === 'bot') {
        this.aiBot();
      }
      if (this.type === 'zombie') {
        this.aiZombie();
      }
    }
  }

  checkCollisions() {
    // Edificios
    buildings.forEach(b => {
      let d = Math.hypot(this.x - b.x, this.y - b.y);
      if (d < b.radius + this.getCollisionRadius() - 20) {
        if (b.type === 'hospital' && this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + 2 * gameSpeedFactor);
          if (Math.random() < 0.05) {
            spawnFloatingText(this.x, this.y - 20, '+VIDA', '#10b981');
          }
        }
        if (b.type === 'refuge') {
          this.invul = Math.max(this.invul, 15);
        }
      }
    });

    // Ítems en el suelo
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (Math.hypot(this.x - it.x, this.y - it.y) < this.getCollisionRadius() + it.radius) {
        AudioSynth.playPickup();
        if (it.type === 'heart') {
          this.hp = Math.min(this.maxHp, this.hp + 400);
          spawnFloatingText(this.x, this.y - 25, '+400 HP', '#ef4444');
        } else if (it.type === 'helmet') {
          this.hasHelmet = true;
          this.maxHp = 1500;
          this.hp = Math.min(this.maxHp, this.hp + 500);
          spawnFloatingText(this.x, this.y - 25, 'CASCO TÁCTICO', '#3b82f6');
        } else if (it.type === 'ammo') {
          Object.keys(WEAPONS).forEach(k => {
            if (WEAPONS[k].ammo !== null) {
              WEAPONS[k].ammo = Math.min(WEAPONS[k].maxAmmo, WEAPONS[k].ammo + 60);
            }
          });
          spawnFloatingText(this.x, this.y - 25, '+MUNICIÓN', '#fbbf24');
        }
        items.splice(i, 1);
        updateHUD();
        break;
      }
    }

    // Cajas de Munición de armas específicas
    for (let i = window.weaponPickups.length - 1; i >= 0; i--) {
      const wp = window.weaponPickups[i];
      if (Math.hypot(this.x - wp.x, this.y - wp.y) < this.getCollisionRadius() + wp.radius) {
        AudioSynth.playPickup();
        if (WEAPONS[this.weapon] && WEAPONS[this.weapon].ammo !== null) {
          WEAPONS[this.weapon].ammo = Math.min(WEAPONS[this.weapon].maxAmmo, WEAPONS[this.weapon].ammo + wp.ammo);
          spawnFloatingText(this.x, this.y - 25, `+${wp.ammo} BALAS`, '#fbbf24');
        }
        window.weaponPickups.splice(i, 1);
        updateHUD();
        break;
      }
    }

    // Minas terrestres detonadas por zombies
    for (let i = window.mines.length - 1; i >= 0; i--) {
      const mine = window.mines[i];
      if (!mine.exploded && mine.countdown === 0) {
        entities.forEach(z => {
          if (z.active && z.team === 'zombie' && Math.hypot(z.x - mine.x, z.y - mine.y) < mine.radius + z.getCollisionRadius()) {
            triggerMineExplosion(mine, i);
          }
        });
      }
    }
  }

  aiBot() {
    // Comportamiento de aliado bot
    if (!player || !player.active) return;

    // Buscar zombie más cercano en rango de combate
    let target = null;
    let minDist = 400;
    entities.forEach(z => {
      if (z.active && z.team === 'zombie') {
        let d = Math.hypot(z.x - this.x, z.y - this.y);
        if (d < minDist) {
          minDist = d;
          target = z;
        }
      }
    });

    // Movimiento: Seguir al jugador o tomar distancia
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    let moveTargetX = player.x;
    let moveTargetY = player.y;

    if (target) {
      this.angle = Math.atan2(target.y - this.y, target.x - this.x);
      // Si el zombie está muy cerca, retroceder
      if (minDist < 150) {
        // Retroceder de espaldas
        moveTargetX = this.x - Math.cos(this.angle) * 100;
        moveTargetY = this.y - Math.sin(this.angle) * 100;
      } else if (distToPlayer > 200) {
        // Acercarse al jugador
        moveTargetX = player.x;
        moveTargetY = player.y;
      } else {
        // Mantener posición y disparar
        moveTargetX = this.x;
        moveTargetY = this.y;
      }

      // Disparar
      if (Math.random() < 0.05) {
        this.shoot();
      }
    } else {
      // Mirar alrededor o en la dirección del movimiento
      if (distToPlayer > 120) {
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
      }
    }

    // Mover hacia el objetivo
    const dx = moveTargetX - this.x;
    const dy = moveTargetY - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      this.x += (dx / d) * this.speed * gameSpeedFactor;
      this.y += (dy / d) * this.speed * gameSpeedFactor;
    }

    // Curarse si está en peligro
    if (this.hp < this.maxHp * 0.4 && Math.random() < 0.005) {
      this.hp = Math.min(this.maxHp, this.hp + 200);
      spawnFloatingText(this.x, this.y - 20, '¡BOT CURADO!', '#10b981');
      showSpeechBubble(this, "¡Cúbreme, me estoy curando!");
    }

    // Comentarios aleatorios de los bots aliados
    if (Math.random() < 0.0005) {
      const phrases = [
        "¡Horda entrante!",
        "¡Recargando fusil!",
        "¡Buen tiro, jefe!",
        "¡No dejes que te rodeen!",
        "¡Para eso me pagan!",
        "¡Muere, engendro!",
        "¿Viste eso?"
      ];
      showSpeechBubble(this, phrases[Math.floor(Math.random() * phrases.length)]);
    }
  }

  aiZombie() {
    if (!player || !player.active) return;

    // Buscar el objetivo humano/bot más cercano
    let targets = [player];
    entities.forEach(e => {
      if (e.active && e.type === 'bot') targets.push(e);
    });

    let closest = null;
    let minDist = Infinity;
    targets.forEach(t => {
      let d = Math.hypot(t.x - this.x, t.y - this.y);
      if (d < minDist) {
        minDist = d;
        closest = t;
      }
    });

    if (!closest) return;

    this.angle = Math.atan2(closest.y - this.y, closest.x - this.x);

    // Zombies escupidores atacan a distancia
    if (this.classId === 'SPITTER' && minDist > 180 && minDist < 450) {
      // Intentar disparar proyectil ácido de vez en cuando
      if (Math.random() < 0.015) {
        spawnAcidSpit(this.x, this.y, this.angle);
      }
    }

    // Desplazamiento del Zombie hacia el objetivo
    let s = this.speed * gameSpeedFactor;
    this.x += Math.cos(this.angle) * s;
    this.y += Math.sin(this.angle) * s;

    // Atacar cuerpo a cuerpo
    if (minDist < this.getCollisionRadius() + closest.radius + 10) {
      closest.takeDamage(this.damage * gameSpeedFactor);
      if (this.classId === 'TANK' && Math.random() < 0.1) {
        screenShake(18); // Sacudir la pantalla si el Tanque golpea
      }
    }
  }

  shoot() {
    const weaponData = WEAPONS[this.weapon];
    // Generar proyectil en la dirección apuntada
    if (weaponData.spread) {
      // Dispersión de escopeta
      for (let i = 0; i < 5; i++) {
        const spreadAngle = this.angle + (Math.random() - 0.5) * 0.4;
        bullets.push({
          x: this.x + Math.cos(this.angle) * this.getCollisionRadius(),
          y: this.y + Math.sin(this.angle) * this.getCollisionRadius(),
          vx: Math.cos(spreadAngle) * weaponData.speed,
          vy: Math.sin(spreadAngle) * weaponData.speed,
          damage: weaponData.damage * 0.3,
          color: weaponData.color,
          owner: this,
          life: 30,
          size: 5
        });
      }
    } else if (weaponData.isFlame) {
      // Flamethrower
      for (let i = 0; i < 2; i++) {
        const flameAngle = this.angle + (Math.random() - 0.5) * 0.2;
        bullets.push({
          x: this.x + Math.cos(this.angle) * this.getCollisionRadius(),
          y: this.y + Math.sin(this.angle) * this.getCollisionRadius(),
          vx: Math.cos(flameAngle) * weaponData.speed * (0.8 + Math.random()*0.4),
          vy: Math.sin(flameAngle) * weaponData.speed * (0.8 + Math.random()*0.4),
          damage: weaponData.damage,
          color: weaponData.color,
          owner: this,
          life: 25,
          size: 8,
          isFlame: true
        });
      }
    } else {
      // Disparo estándar
      bullets.push({
        x: this.x + Math.cos(this.angle) * this.getCollisionRadius(),
        y: this.y + Math.sin(this.angle) * this.getCollisionRadius(),
        vx: Math.cos(this.angle) * weaponData.speed,
        vy: Math.sin(this.angle) * weaponData.speed,
        damage: weaponData.damage,
        color: weaponData.color,
        owner: this,
        life: 80,
        size: 7,
        explosive: weaponData.explosive
      });
    }

    // Efectos de sonido y visuales
    AudioSynth.playShoot(this.weapon);
    
    // Muzzle flash y casquillos ejectados
    if (this.weapon !== 'KNIFE') {
      const flashX = this.x + Math.cos(this.angle) * (this.getCollisionRadius() + 15);
      const flashY = this.y + Math.sin(this.angle) * (this.getCollisionRadius() + 15);
      // Muzzle flash particle
      spawnParticle(flashX, flashY, {
        vx: (Math.random()-0.5)*2,
        vy: (Math.random()-0.5)*2,
        color: 'rgba(255, 230, 100, 0.9)',
        size: 15,
        life: 4
      });

      // Casquillo volador
      const ejectAngle = this.angle - Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      spawnShell(this.x, this.y, ejectAngle);
    }
  }

  takeDamage(amt, isBurn = false) {
    if (this.invul > 0 || this.shieldActive) return;
    this.hp -= amt;

    // Sangrado
    if (Math.random() < 0.3) {
      spawnSplatter(this.x, this.y, this.team === 'zombie' ? '#00ff44' : '#ef4444');
    }

    if (this.isPlayer) {
      spawnFloatingText(this.x, this.y - 20, `-${Math.round(amt)}`, '#ef4444');
      screenShake(7);
      AudioSynth.playHurt();
    }

    if (this.hp <= 0) {
      this.active = false;
      if (this.isPlayer) {
        if (this.lives > 1) {
          this.lives--;
          this.hp = this.maxHp;
          this.invul = 50;
          this.x = 0;
          this.y = 0;
          updateHUD();
          spawnFloatingText(this.x, this.y - 20, '¡RESPAWN!', '#00f2ff');
          showToast("¡Voz de Misión: Has caído, respawneando!", "warning");
        } else {
          endGame();
        }
      } else {
        onEntityDeath(this, isBurn);
      }
    }
    if (this.isPlayer) updateHUD();
  }

  draw() {
    let sx = (this.x - camera.x) * camera.zoom;
    let sy = (this.y - camera.y) * camera.zoom;
    const size = (this.getCollisionRadius() * 2) * camera.zoom;

    // Culling: no dibujar si está totalmente fuera de la pantalla
    if (sx < -size || sx > canvas.width + size || sy < -size || sy > canvas.height + size) return;

    ctx.save();
    ctx.translate(sx, sy);

    // Efecto de parpadeo por invulnerabilidad
    if (this.invul > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }

    // Efecto de escudo activo
    if (this.shieldActive) {
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = varValue('--neon-blue');
      ctx.strokeStyle = varValue('--neon-blue');
      ctx.lineWidth = 3 * camera.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, this.getCollisionRadius() * 1.3 * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Rotar en el sentido de apuntado
    ctx.rotate(this.angle);

    if (this.team === 'zombie') {
      const rad = this.getCollisionRadius() * camera.zoom;

      if (zombieSpriteImg) {
        // --- DIBUJO CON SPRITE DE ZOMBIE REAL ---
        ctx.drawImage(zombieSpriteImg, -rad, -rad, rad * 2, rad * 2);
      } else {
        // --- DIBUJO PROCEDIMENTAL ALTERNATIVO ---
        // Brazos estirados al frente (bobbing con el ciclo de caminar)
        const armBob = this.isMoving ? Math.sin(this.walkCycle) * 6 * camera.zoom : 0;
        ctx.fillStyle = this.color;

        // Brazo izquierdo
        ctx.fillRect(rad * 0.4, -rad * 0.7 + armBob, rad * 0.8, rad * 0.3);
        // Brazo derecho
        ctx.fillRect(rad * 0.4, rad * 0.4 - armBob, rad * 0.8, rad * 0.3);

        // Piernas (en movimiento)
        if (this.isMoving) {
          ctx.fillStyle = '#1e293b';
          const legOffset = Math.sin(this.walkCycle) * rad * 0.4;
          ctx.fillRect(-rad * 0.5, -rad * 0.4 + legOffset, rad * 0.4, rad * 0.25);
          ctx.fillRect(-rad * 0.5, rad * 0.15 - legOffset, rad * 0.4, rad * 0.25);
        }

        // Cabeza y cuerpo (Base redonda/poligonal)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI*2);
        ctx.fill();

        // Hombros/Ropa sucia
        ctx.fillStyle = '#1e3a1e';
        ctx.beginPath();
        ctx.arc(-rad * 0.3, 0, rad * 0.8, 0, Math.PI*2);
        ctx.fill();

        // Cabeza
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(-rad * 0.1, 0, rad * 0.6, 0, Math.PI*2);
        ctx.fill();

        // Ojos brillantes mutados
        ctx.fillStyle = this.classId === 'RUNNER' ? '#ffeb00' : '#ff007f';
        ctx.beginPath();
        ctx.arc(rad * 0.3, -rad * 0.2, rad * 0.12, 0, Math.PI*2);
        ctx.arc(rad * 0.3, rad * 0.2, rad * 0.12, 0, Math.PI*2);
        ctx.fill();
      }
    } else {
      const rad = this.radius * camera.zoom;

      if (playerSpriteImg && this.isPlayer) {
        // --- DIBUJO CON SPRITE DE SUPERVIVIENTE REAL ---
        ctx.drawImage(playerSpriteImg, -rad, -rad, rad * 2, rad * 2);
      } else {
        // --- DIBUJO PROCEDIMENTAL DE AGENTE / BOT ---
        // Piernas caminando
        if (this.isMoving) {
          ctx.fillStyle = '#0f172a';
          const legOffset = Math.sin(this.walkCycle) * rad * 0.4;
          ctx.fillRect(-rad * 0.5, -rad * 0.45 + legOffset, rad * 0.4, rad * 0.3);
          ctx.fillRect(-rad * 0.5, rad * 0.15 - legOffset, rad * 0.4, rad * 0.3);
        }

        // Base del cuerpo / Traje táctico militar
        ctx.fillStyle = this.color; // Color de equipo/randomizado
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI*2);
        ctx.fill();

        // Chaleco táctico
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-rad * 0.5, -rad * 0.6, rad * 0.9, rad * 1.2);

        // Cabeza del agente
        ctx.fillStyle = '#f87171'; // Tono piel base
        ctx.beginPath();
        ctx.arc(-rad * 0.05, 0, rad * 0.52, 0, Math.PI*2);
        ctx.fill();

        // Casco táctico
        if (this.hasHelmet) {
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(-rad * 0.1, 0, rad * 0.58, 0, Math.PI*2);
          ctx.fill();
          // Visor táctico cian
          ctx.fillStyle = varValue('--neon-blue');
          ctx.fillRect(rad * 0.2, -rad * 0.3, rad * 0.15, rad * 0.6);
        } else {
          // Cabello o gorra táctica
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(-rad * 0.2, 0, rad * 0.5, Math.PI/2, Math.PI * 1.5);
          ctx.fill();
        }

        // Dibujar arma activa en las manos apuntando hacia adelante
        ctx.fillStyle = '#475569';
        const activeWeapon = WEAPONS[this.weapon];
        if (activeWeapon && activeWeapon.id !== 'KNIFE') {
          // Dibujo simplificado de cañón de arma
          ctx.fillStyle = activeWeapon.color;
          ctx.fillRect(rad * 0.2, rad * 0.25, rad * 0.9, rad * 0.2); // Cañón principal
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(rad * 0.4, rad * 0.2, rad * 0.3, rad * 0.15); // Mira
        } else if (activeWeapon && activeWeapon.id === 'KNIFE') {
          // Dibujo de cuchillo táctico plateado
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(rad * 0.3, rad * 0.3);
          ctx.lineTo(rad * 0.9, rad * 0.4);
          ctx.lineTo(rad * 0.8, rad * 0.25);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // Dibujar nombre arriba de jugadores remotos o aliados bots
    if (this.isRemote || this.type === 'bot') {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 15, 0.85)';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      const textWidth = ctx.measureText(this.name.toUpperCase()).width + 12;
      ctx.fillRect(sx - textWidth/2, sy - this.getCollisionRadius() - 22, textWidth, 14);
      ctx.strokeRect(sx - textWidth/2, sy - this.getCollisionRadius() - 22, textWidth, 14);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 9px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText(this.name.toUpperCase(), sx, sy - this.getCollisionRadius() - 12);
      ctx.restore();
    }

    // Dibujar bocadillo de diálogo de Bot si tiene texto activo
    if (this.speechText && Date.now() - this.speechTime < 3000) {
      ctx.save();
      ctx.font = 'bold 10px Rajdhani';
      const txt = this.speechText;
      const tw = ctx.measureText(txt).width + 16;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#00f2ff';
      ctx.lineWidth = 1;
      ctx.fillRect(sx - tw/2, sy - this.getCollisionRadius() - 42, tw, 18);
      ctx.strokeRect(sx - tw/2, sy - this.getCollisionRadius() - 42, tw, 18);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(txt, sx, sy - this.getCollisionRadius() - 30);
      ctx.restore();
    }
  }
}

// 5. EFECTOS ESPECIALES Y DE PARTÍCULAS
function spawnParticle(x, y, config) {
  window.particles.push({
    x: x,
    y: y,
    vx: config.vx,
    vy: config.vy,
    color: config.color,
    size: config.size,
    life: config.life,
    maxLife: config.life
  });
}

function spawnShell(x, y, angle) {
  // Casquillos de bala dorados
  window.particles.push({
    x: x,
    y: y,
    vx: Math.cos(angle) * (1.5 + Math.random()*2),
    vy: Math.sin(angle) * (1.5 + Math.random()*2) - 1.0,
    color: '#fbbf24', // Dorado
    size: 2,
    isShell: true,
    angle: Math.random()*Math.PI*2,
    spin: (Math.random()-0.5)*0.3,
    life: 80,
    maxLife: 80
  });
}

function spawnSplatter(x, y, color) {
  // Salpicaduras fijas en el suelo (dibujadas en splatters)
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 45;
    window.particles.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      color: color,
      size: 4 + Math.random() * 12,
      isFloorBlood: true,
      alpha: 0.9,
      life: 600, // Larga duración
      maxLife: 600
    });
  }
}

function spawnAcidSpit(x, y, angle) {
  bullets.push({
    x: x + Math.cos(angle) * 30,
    y: y + Math.sin(angle) * 30,
    vx: Math.cos(angle) * 11,
    vy: Math.sin(angle) * 11,
    damage: 20,
    color: '#a3e635',
    owner: { team: 'zombie' },
    life: 50,
    size: 6,
    isAcid: true
  });
}

function createAcidPuddle(x, y) {
  // Puddles de ácido tóxico temporales
  items.push({
    x: x,
    y: y,
    type: 'acid_puddle',
    radius: 40,
    life: 300 // dura unos segundos
  });
}

function triggerMineExplosion(mine, index) {
  mine.exploded = true;
  mine.explosionTime = Date.now();
  AudioSynth.playExplosion();

  // Partículas de humo e incendio
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 8;
    spawnParticle(mine.x, mine.y, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: i % 2 === 0 ? '#ff7b00' : 'rgba(100, 100, 100, 0.6)',
      size: 6 + Math.random() * 14,
      life: 20 + Math.random() * 30
    });
  }

  // Daño colateral radial
  const explosionRadius = 180;
  entities.forEach(e => {
    if (e.active) {
      const d = Math.hypot(e.x - mine.x, e.y - mine.y);
      if (d < explosionRadius) {
        // Mayor daño entre más cerca
        const damageRatio = 1 - (d / explosionRadius);
        e.takeDamage(6000 * damageRatio);
      }
    }
  });

  if (player && Math.hypot(player.x - mine.x, player.y - mine.y) < explosionRadius) {
    player.takeDamage(1000 * (1 - Math.hypot(player.x - mine.x, player.y - mine.y) / explosionRadius));
  }

  window.mines.splice(index, 1);
  screenShake(12);
}

function spawnFloatingText(x, y, text, color) {
  const container = document.getElementById('damage-layer');
  if (!container) return;
  
  // Transformar coordenadas de mundo a pantalla
  const sx = (x - camera.x) * camera.zoom;
  const sy = (y - camera.y) * camera.zoom;

  // Evitar desbordamiento de pantalla
  if (sx < 0 || sx > window.innerWidth || sy < 0 || sy > window.innerHeight) return;

  const div = document.createElement('div');
  div.className = 'damage-number';
  div.style.left = `${sx}px`;
  div.style.top = `${sy}px`;
  div.style.color = color;
  div.innerText = text;
  container.appendChild(div);

  setTimeout(() => div.remove(), 800);
}

function showSpeechBubble(entity, text) {
  entity.speechText = text;
  entity.speechTime = Date.now();
  // Mostrar mensaje en la caja de chat HUD también
  const chat = document.getElementById('chat-box');
  if (chat) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg';
    bubble.innerHTML = `<span class="chat-name" style="color: ${entity.color}">${entity.name}:</span><span style="color: #94a3b8">${text}</span>`;
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }
}

// 6. CONTROLADORES DE INPUT
function setupInput() {
  // Teclado
  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    keys[key] = true;

    // Cambiar arma (teclas 1-6)
    if (key >= '1' && key <= '6') {
      const keysList = Object.keys(WEAPONS);
      const idx = parseInt(key) - 1;
      if (idx < keysList.length) {
        activeWKey = keysList[idx];
        usedWeapons.add(activeWKey);
        if (player) {
          player.weapon = activeWKey;
          updateHUD();
          showToast(`Arma: ${WEAPONS[activeWKey].icon} ${WEAPONS[activeWKey].id}`, 'info');
        }
      }
    }

    // Tecla Escape para pausar
    if (key === 'escape') {
      togglePause();
    }

    // Teclas rápidas para habilidades (Q, E, R)
    if (key === 'q') triggerHealSkill();
    if (key === 'e') triggerShieldSkill();
    if (key === 'r') triggerNukeSkill();
  });

  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
  });

  // Ratón: Apuntado y disparo
  window.addEventListener('mousemove', e => {
    if (!player || isPaused || isGameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calcular coordenadas mundiales del puntero
    const worldMouseX = mouseX / camera.zoom + camera.x;
    const worldMouseY = mouseY / camera.zoom + camera.y;

    player.angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
  });

  window.addEventListener('mousedown', e => {
    if (e.target === canvas) {
      isFiring = true;
    }
  });

  window.addEventListener('mouseup', () => {
    isFiring = false;
  });

  // Prevenir menú contextual en el Canvas
  window.addEventListener('contextmenu', e => {
    if (e.target === canvas) e.preventDefault();
  });

  // Detectar soporte táctil y configurar Virtual Joysticks
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    setupVirtualJoysticks();
  }
}

function setupVirtualJoysticks() {
  // Crear HTML de Joysticks si no existen
  if (document.getElementById('joystick-left')) return;

  const leftDiv = document.createElement('div');
  leftDiv.id = 'joystick-left';
  leftDiv.className = 'virtual-joystick clickable';
  leftDiv.innerHTML = '<div class="joystick-knob"></div>';

  const rightDiv = document.createElement('div');
  rightDiv.id = 'joystick-right';
  rightDiv.className = 'virtual-joystick clickable';
  rightDiv.innerHTML = '<div class="joystick-knob"></div>';

  document.body.appendChild(leftDiv);
  document.body.appendChild(rightDiv);

  // Lógica táctil Joystick Izquierdo (Movimiento)
  const leftKnob = leftDiv.querySelector('.joystick-knob');
  let leftTouchId = null;
  let leftStart = { x: 0, y: 0 };
  let moveVector = { x: 0, y: 0 };

  leftDiv.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    leftTouchId = touch.identifier;
    leftStart = { x: touch.clientX, y: touch.clientY };
  });

  leftDiv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (let t of e.touches) {
      if (t.identifier === leftTouchId) {
        const dx = t.clientX - leftStart.x;
        const dy = t.clientY - leftStart.y;
        const dist = Math.min(45, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        
        moveVector = {
          x: Math.cos(angle) * (dist / 45),
          y: Math.sin(angle) * (dist / 45)
        };

        leftKnob.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
        
        // Asignar teclas simuladas para movimiento
        keys['w'] = moveVector.y < -0.3;
        keys['s'] = moveVector.y > 0.3;
        keys['a'] = moveVector.x < -0.3;
        keys['d'] = moveVector.x > 0.3;
      }
    }
  });

  const stopLeft = () => {
    leftTouchId = null;
    leftKnob.style.transform = 'translate(0px, 0px)';
    keys['w'] = false;
    keys['s'] = false;
    keys['a'] = false;
    keys['d'] = false;
  };
  leftDiv.addEventListener('touchend', stopLeft);
  leftDiv.addEventListener('touchcancel', stopLeft);

  // Lógica táctil Joystick Derecho (Apuntado y Disparo automático)
  const rightKnob = rightDiv.querySelector('.joystick-knob');
  let rightTouchId = null;
  let rightStart = { x: 0, y: 0 };

  rightDiv.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    rightTouchId = touch.identifier;
    rightStart = { x: touch.clientX, y: touch.clientY };
    isFiring = true;
  });

  rightDiv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (let t of e.touches) {
      if (t.identifier === rightTouchId) {
        const dx = t.clientX - rightStart.x;
        const dy = t.clientY - rightStart.y;
        const dist = Math.min(45, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);

        if (player) {
          player.angle = angle;
        }

        rightKnob.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
      }
    }
  });

  const stopRight = () => {
    rightTouchId = null;
    rightKnob.style.transform = 'translate(0px, 0px)';
    isFiring = false;
  };
  rightDiv.addEventListener('touchend', stopRight);
  rightDiv.addEventListener('touchcancel', stopRight);
}

// 7. ILUMINACIÓN DINÁMICA DE LINTERNA Y DIBUJO EN CANVAS
function drawGameScene() {
  // Ajustar cámara para seguir al jugador
  if (player) {
    camera.x = player.x - (canvas.width / 2) / camera.zoom;
    camera.y = player.y - (canvas.height / 2) / camera.zoom;
  }

  // Limpiar Canvas principal
  ctx.fillStyle = '#020306';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dibujar Cuadrícula de suelo de Cyber-Grid
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 242, 255, 0.025)';
  ctx.lineWidth = 1;
  const gridSize = 140 * camera.zoom;
  const startX = (-camera.x * camera.zoom) % gridSize;
  const startY = (-camera.y * camera.zoom) % gridSize;

  for (let x = startX; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = startY; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();

  // 1. Dibujar manchas de sangre fijas en el suelo (primer capa)
  window.particles.forEach(p => {
    if (p.isFloorBlood) {
      let sx = (p.x - camera.x) * camera.zoom;
      let sy = (p.y - camera.y) * camera.zoom;
      let sz = p.size * camera.zoom;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI*2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1.0;

  // 2. Dibujar Charcos de ácido, edificios, minas y bunkers
  items.forEach(it => {
    let sx = (it.x - camera.x) * camera.zoom;
    let sy = (it.y - camera.y) * camera.zoom;
    let sz = it.radius * 2 * camera.zoom;

    if (it.type === 'acid_puddle') {
      ctx.fillStyle = 'rgba(163, 230, 21, 0.4)';
      ctx.beginPath();
      ctx.arc(sx, sy, sz / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(163, 230, 21, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Dibujar caja de ítems procedimental
      ctx.save();
      ctx.translate(sx, sy);
      ctx.shadowBlur = 8;
      ctx.shadowColor = it.type === 'heart' ? '#ef4444' : it.type === 'helmet' ? '#3b82f6' : '#fbbf24';
      ctx.fillStyle = it.type === 'heart' ? '#b91c1c' : it.type === 'helmet' ? '#1d4ed8' : '#d97706';
      ctx.fillRect(-sz/2, -sz/2, sz, sz);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-sz/2, -sz/2, sz, sz);

      // Símbolo en caja
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(sz*0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.type === 'heart' ? 'H' : it.type === 'helmet' ? 'A' : 'M', 0, 0);
      ctx.restore();
    }
  });

  // Cajas de balas de armas en el suelo
  window.weaponPickups.forEach(wp => {
    let sx = (wp.x - camera.x) * camera.zoom;
    let sy = (wp.y - camera.y) * camera.zoom;
    let sz = wp.radius * 2 * camera.zoom;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-sz/2, -sz/2, sz, sz);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sz/2, -sz/2, sz, sz);
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(sz*0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AM', 0, 0);
    ctx.restore();
  });

  // Búnkeres y edificios grandes
  window.bunkers.forEach(b => {
    let sx = (b.x - camera.x) * camera.zoom;
    let sy = (b.y - camera.y) * camera.zoom;
    let sz = b.radius * 2 * camera.zoom;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.beginPath();
    ctx.arc(sx, sy, sz / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4 * camera.zoom;
    ctx.stroke();

    // Dibujar leyenda
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(20 * camera.zoom)}px Orbitron`;
    ctx.textAlign = 'center';
    ctx.fillText("REFUGIO BÚNKER", sx, sy + 6 * camera.zoom);
  });

  buildings.forEach(b => {
    let sx = (b.x - camera.x) * camera.zoom;
    let sy = (b.y - camera.y) * camera.zoom;
    let sz = b.radius * 2 * camera.zoom;

    ctx.fillStyle = b.type === 'hospital' ? 'rgba(6, 78, 59, 0.85)' : 'rgba(30, 58, 138, 0.85)';
    ctx.fillRect(sx - sz/2, sy - sz/2, sz, sz);
    ctx.strokeStyle = b.type === 'hospital' ? '#10b981' : '#3b82f6';
    ctx.lineWidth = 3 * camera.zoom;
    ctx.strokeRect(sx - sz/2, sy - sz/2, sz, sz);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(14 * camera.zoom)}px Orbitron`;
    ctx.textAlign = 'center';
    ctx.fillText(b.type === 'hospital' ? "HOSPITAL AC" : "SALA INMUNE", sx, sy + 5 * camera.zoom);
  });

  // Minas terrestres
  window.mines.forEach(mine => {
    let sx = (mine.x - camera.x) * camera.zoom;
    let sy = (mine.y - camera.y) * camera.zoom;
    let sz = mine.radius * 2 * camera.zoom;

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(sx, sy, sz / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Anillo exterior de mina
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(sx, sy, sz * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 3. Dibujar balas normales y fuegos
  bullets.forEach(b => {
    let sx = (b.x - camera.x) * camera.zoom;
    let sy = (b.y - camera.y) * camera.zoom;
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.shadowBlur = b.isFlame ? 10 : 6;
    ctx.shadowColor = b.color;
    ctx.beginPath();
    ctx.arc(sx, sy, b.size * camera.zoom, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // 4. Dibujar entidades y jugadores
  entities.forEach(e => e.draw());
  if (player && player.active) player.draw();

  // 5. Dibujar partículas (sangre volando, casquillos, chispas)
  window.particles.forEach(p => {
    if (!p.isFloorBlood) {
      let sx = (p.x - camera.x) * camera.zoom;
      let sy = (p.y - camera.y) * camera.zoom;
      let sz = p.size * camera.zoom;

      ctx.save();
      ctx.translate(sx, sy);
      if (p.isShell) {
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-sz, -sz*2, sz*2, sz*4);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
  });

  // 6. CAPA DE ILUMINACIÓN DINÁMICA (EFECTO DE OSCURIDAD Y LINTERNA)
  if (player && player.active) {
    ctx.save();
    // Crear canvas virtual de sombra
    const lightCanvas = document.createElement('canvas');
    lightCanvas.width = canvas.width;
    lightCanvas.height = canvas.height;
    const lctx = lightCanvas.getContext('2d');

    // Cubrir todo de oscuridad total
    lctx.fillStyle = 'rgba(2, 4, 8, 0.94)';
    lctx.fillRect(0, 0, canvas.width, canvas.height);

    // Configurar composite para "borrar" la oscuridad y dejar pasar la luz
    lctx.globalCompositeOperation = 'destination-out';

    // Luz ambiental circular alrededor del jugador
    const playerSx = (player.x - camera.x) * camera.zoom;
    const playerSy = (player.y - camera.y) * camera.zoom;
    let radGrd = lctx.createRadialGradient(
      playerSx, playerSy, 10,
      playerSx, playerSy, 160 * camera.zoom
    );
    radGrd.addColorStop(0, 'rgba(0,0,0,1.0)');
    radGrd.addColorStop(0.3, 'rgba(0,0,0,0.8)');
    radGrd.addColorStop(1, 'rgba(0,0,0,0.0)');
    lctx.fillStyle = radGrd;
    lctx.beginPath();
    lctx.arc(playerSx, playerSy, 160 * camera.zoom, 0, Math.PI * 2);
    lctx.fill();

    // Cono de la Linterna táctica en la dirección apuntada
    const coneAngle = 0.58; // Ángulo de apertura de linterna (~33 grados)
    const flashlightRange = 550 * camera.zoom;
    const startAng = player.angle - coneAngle;
    const endAng = player.angle + coneAngle;

    lctx.save();
    let coneGrd = lctx.createRadialGradient(
      playerSx, playerSy, 30,
      playerSx, playerSy, flashlightRange
    );
    coneGrd.addColorStop(0, 'rgba(0,0,0,1.0)');
    coneGrd.addColorStop(0.5, 'rgba(0,0,0,0.7)');
    coneGrd.addColorStop(1, 'rgba(0,0,0,0.0)');

    lctx.fillStyle = coneGrd;
    lctx.beginPath();
    lctx.moveTo(playerSx, playerSy);
    lctx.arc(playerSx, playerSy, flashlightRange, startAng, endAng);
    lctx.closePath();
    lctx.fill();
    lctx.restore();

    // Luces ambientales de Bots Aliados
    entities.forEach(bot => {
      if (bot.active && bot.type === 'bot') {
        const botSx = (bot.x - camera.x) * camera.zoom;
        const botSy = (bot.y - camera.y) * camera.zoom;
        let bGrd = lctx.createRadialGradient(
          botSx, botSy, 10,
          botSx, botSy, 110 * camera.zoom
        );
        bGrd.addColorStop(0, 'rgba(0,0,0,0.85)');
        bGrd.addColorStop(1, 'rgba(0,0,0,0.0)');
        lctx.fillStyle = bGrd;
        lctx.beginPath();
        lctx.arc(botSx, botSy, 110 * camera.zoom, 0, Math.PI * 2);
        lctx.fill();
      }
    });

    // Dibujar la máscara de sombra en la pantalla
    ctx.drawImage(lightCanvas, 0, 0);
    ctx.restore();
  }

  // Dibujar minimapa
  drawMiniMap();
  if (document.getElementById('minimap-window').style.display === 'block') {
    drawWindowMap();
  }
}

// Helper para leer variables CSS
function varValue(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// 8. LÓGICA DE ACTUALIZACIÓN DEL JUEGO
function updateLogic() {
  const dt = gameSpeedFactor;

  // Movimiento del jugador
  let vx = 0, vy = 0;
  if (keys['w'] || keys['arrowup']) vy = -1;
  if (keys['s'] || keys['arrowdown']) vy = 1;
  if (keys['a'] || keys['arrowleft']) vx = -1;
  if (keys['d'] || keys['arrowright']) vx = 1;

  if (vx !== 0 || vy !== 0) {
    let mag = Math.hypot(vx, vy);
    player.x += (vx / mag) * player.speed * dt;
    player.y += (vy / mag) * player.speed * dt;
  }

  // Lógica de disparo continuo
  if (isFiring && player && player.active && !isPaused) {
    const weaponData = WEAPONS[activeWKey];
    if (Date.now() - lastFire > weaponData.delay / dt) {
      if (activeWKey === 'KNIFE') {
        // Cuchillo
        player.shoot();
        // Buscar zombies en rango
        entities.forEach(z => {
          if (z.active && z.team === 'zombie' && Math.hypot(z.x - player.x, z.y - player.y) < weaponData.range) {
            z.takeDamage(weaponData.damage * dt);
            // Empujar zombie
            z.x += Math.cos(player.angle) * 35;
            z.y += Math.sin(player.angle) * 35;
          }
        });
        lastFire = Date.now();
      } else if (weaponData.ammo > 0) {
        player.shoot();
        weaponData.ammo--;
        lastFire = Date.now();
        updateHUD();
      } else {
        showToast("¡SIN MUNICIÓN!", "error");
        lastFire = Date.now() + 400; // Demora de click vacío
      }
    }
  }

  // Actualizar proyectiles de bala
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    let hit = false;

    if (b.owner.team === 'human') {
      // Balas del jugador/bots golpean a zombies (usando getCollisionRadius)
      for (let j = entities.length - 1; j >= 0; j--) {
        const z = entities[j];
        if (z.active && z.team === 'zombie' && Math.hypot(b.x - z.x, b.y - z.y) < z.getCollisionRadius()) {
          hit = true;
          if (b.isFlame) {
            z.burnTime = 120; // Quemar por 2 segundos
          } else {
            z.takeDamage(b.damage);
          }
          break;
        }
      }
    } else {
      // Balas de zombies / ácido golpean a humanos/bots
      let targets = [player];
      entities.forEach(bot => {
        if (bot.active && bot.type === 'bot') targets.push(bot);
      });

      for (let t of targets) {
        if (t && t.active && Math.hypot(b.x - t.x, b.y - t.y) < t.radius) {
          hit = true;
          if (b.isAcid) {
            createAcidPuddle(b.x, b.y);
          }
          t.takeDamage(b.damage);
          break;
        }
      }
    }

    // Explosión de cohetes
    if (hit && b.explosive) {
      AudioSynth.playExplosion();
      // Generar partículas radiales
      for (let k = 0; k < 25; k++) {
        const a = Math.random()*Math.PI*2;
        const s = 1 + Math.random()*6;
        spawnParticle(b.x, b.y, {
          vx: Math.cos(a)*s,
          vy: Math.sin(a)*s,
          color: '#f97316',
          size: 4 + Math.random()*8,
          life: 15 + Math.random()*15
        });
      }

      // Daño radial
      entities.forEach(z => {
        if (z.active && z.team === 'zombie') {
          const d = Math.hypot(z.x - b.x, z.y - b.y);
          if (d < 120) z.takeDamage(b.damage * (1 - d/120));
        }
      });
    }

    if (b.life <= 0 || hit) {
      bullets.splice(i, 1);
    }
  }

  // Charcos de ácido dañan a humanos parados encima
  items.forEach(it => {
    if (it.type === 'acid_puddle') {
      it.life -= dt;
      if (player && player.active && Math.hypot(player.x - it.x, player.y - it.y) < it.radius) {
        player.takeDamage(1 * dt); // Daño corrosivo leve continuo
      }
      entities.forEach(bot => {
        if (bot.active && bot.type === 'bot' && Math.hypot(bot.x - it.x, bot.y - it.y) < it.radius) {
          bot.takeDamage(1 * dt);
        }
      });
    }
  });
  items = items.filter(it => it.type !== 'acid_puddle' || it.life > 0);

  // Spawneo progresivo de Zombies (Aumentado)
  const maxZombies = 50 + currentLvl * 15;
  const activeZombies = entities.filter(e => e.team === 'zombie').length;

  if (activeZombies < maxZombies && Math.random() < 0.08 * dt) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 700 + Math.random() * 800;
    const spawnX = player.x + Math.cos(angle) * dist;
    const spawnY = player.y + Math.sin(angle) * dist;

    // Determinar clase de zombie según nivel
    let classes = ['STALKER'];
    if (currentLvl >= 2) classes.push('RUNNER');
    if (currentLvl >= 3) classes.push('SPITTER');
    if (currentLvl >= 4) classes.push('TANK');

    const randClassId = classes[Math.floor(Math.random() * classes.length)];
    const zConfig = ZOMBIE_CLASSES[randClassId];

    // Escalar dificultad más agresivamente
    const levelMult = 1.0 + (currentLvl - 1) * 0.35;

    entities.push(new Entity(spawnX, spawnY, {
      type: 'zombie',
      classId: randClassId,
      radius: zConfig.radius,
      hp: zConfig.hp * levelMult,
      speed: zConfig.speed * (0.95 + Math.random()*0.1),
      damage: zConfig.damage * levelMult,
      color: zConfig.color,
      name: zConfig.name
    }));
  }

  // Actualizar partículas
  for (let i = window.particles.length - 1; i >= 0; i--) {
    const p = window.particles[i];
    p.life -= dt;
    if (p.isShell) {
      // Simular fricción e inercia para los casquillos en el suelo
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.angle += p.spin * dt;
    } else if (!p.isFloorBlood) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (p.life <= 0) {
      window.particles.splice(i, 1);
    }
  }

  // Actualizar Entidades (zombies y bots aliados)
  entities.forEach(e => e.update());
  if (player) player.update();

  // Remover entidades muertas
  entities = entities.filter(e => e.active);

  // Daño por Radiación periódica
  if (radiationActive && player && player.active) {
    const now = Date.now();
    if (now - (radiationStartTime || now) > 4000) {
      player.takeDamage(player.maxHp * 0.08); // 8% HP cada 4s
      radiationStartTime = now;
      spawnFloatingText(player.x, player.y - 30, '☣️ DAÑO RADIACTIVO', '#a3e635');
    }
  }

  // Sincronizar multijugador online por WebSockets
  if (isMultiplayer && currentRoomId) {
    syncMultiplayerState();
  }

  // Actualizar HUD
  updateSkillTimers();
  updateTelemetryPanel();
  checkAchievements();
}

// 9. EVENTOS DE ENTIDADES (MUERTE)
function onEntityDeath(entity, isBurned) {
  if (entity.team === 'zombie') {
    const zConfig = ZOMBIE_CLASSES[entity.classId];
    const points = zConfig ? zConfig.points : 100;
    score += points;
    kills++;

    // Texto flotante de puntos
    spawnFloatingText(entity.x, entity.y, `+${points}`, '#00f2ff');
    AudioSynth.playZombieDeath();

    // Dropeo aleatorio de ítems en el suelo (Salud, Balas, Casco)
    if (Math.random() < 0.22) {
      const lootTypes = ['heart', 'ammo'];
      if (!player.hasHelmet && Math.random() < 0.15) {
        lootTypes.push('helmet');
      }
      const choice = lootTypes[Math.floor(Math.random() * lootTypes.length)];
      items.push({
        x: entity.x,
        y: entity.y,
        type: choice,
        radius: 15
      });
    }

    // Dropeo específico de cargadores de armas
    if (Math.random() < 0.15) {
      window.weaponPickups.push({
        x: entity.x + (Math.random()-0.5)*30,
        y: entity.y + (Math.random()-0.5)*30,
        ammo: 25 + Math.floor(Math.random()*40),
        radius: 12
      });
    }

    // Comprobar avance de nivel
    if (kills >= targetKills) {
      nextLevel();
    }
  } else if (entity.type === 'bot') {
    // Recluta muerto
    showSpeechBubble(entity, "¡Aghh! ¡Hasta aquí llegué...");
    showToast(`Un aliado bot ha caído en combate.`, 'error');
  }
}

function nextLevel() {
  currentLvl++;
  kills = 0;
  targetKills = 80 + currentLvl * 25;
  
  // Efectos visuales de subida
  const textEl = document.getElementById('level-up-text');
  if (textEl) {
    textEl.style.opacity = '1';
    setTimeout(() => textEl.style.opacity = '0', 2500);
  }

  showToast(`¡COMPLETADO! Nivel ${currentLvl} desbloqueado.`, 'success');
  
  // Guardar partida
  const name = document.getElementById('player-name-input').value || "Agente";
  saveGameProgress(currentLvl, score, name, selectedAvatarIdx);

  // Curar levemente de recompensa
  if (player) {
    player.hp = Math.min(player.maxHp, player.hp + 300);
  }
  updateHUD();
}

// 10. BOTONES DE HABILIDADES Y LOGROS
function triggerHealSkill() {
  if (skillCooldowns.heal > 0) return;
  if (player && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
    skillCooldowns.heal = 25; // Cooldown 25s
    AudioSynth.playPickup();
    spawnFloatingText(player.x, player.y, '+VIDA TÁCTICA', '#10b981');
    updateHUD();
  }
}

function triggerShieldSkill() {
  if (skillCooldowns.shield > 0) return;
  if (player) {
    player.shieldActive = true;
    player.shieldTime = 400; // 8 segundos de escudo (400 ticks)
    skillCooldowns.shield = 40; // Cooldown 40s
    AudioSynth.playPickup();
    spawnFloatingText(player.x, player.y, 'ESCUDO ACTIVADO', '#3b82f6');
  }
}

function triggerNukeSkill() {
  if (skillCooldowns.nuke > 0) return;
  if (player) {
    AudioSynth.playNuke();
    screenShake(35);

    // Flash amarillo
    const flash = document.getElementById('flash-fx');
    flash.style.opacity = '0.95';
    flash.style.backgroundColor = 'rgba(255, 230, 0, 0.9)';
    setTimeout(() => {
      flash.style.opacity = '0';
    }, 600);

    // Destruir zombies visibles
    let killedCount = 0;
    entities.forEach(z => {
      if (z.team === 'zombie' && z.active) {
        z.takeDamage(99999);
        killedCount++;
      }
    });

    score += killedCount * 100;
    kills += killedCount;
    skillCooldowns.nuke = 90; // Cooldown 90s

    // Generar anillo gigante de partículas
    for (let k = 0; k < 120; k++) {
      const a = Math.random()*Math.PI*2;
      const s = 2 + Math.random()*16;
      spawnParticle(player.x, player.y, {
        vx: Math.cos(a)*s,
        vy: Math.sin(a)*s,
        color: '#ffea00',
        size: 5 + Math.random()*12,
        life: 40 + Math.random()*35
      });
    }

    showToast("¡EXPLOSIÓN NUCLEAR TOTAL!", "success");
    if (kills >= targetKills) {
      nextLevel();
    }
  }
}

function updateSkillTimers() {
  const dt = gameSpeedFactor / 60;
  
  if (skillCooldowns.heal > 0) {
    skillCooldowns.heal = Math.max(0, skillCooldowns.heal - dt);
    document.getElementById('heal-timer').textContent = Math.ceil(skillCooldowns.heal) + 's';
    document.getElementById('heal-skill').classList.add('cooldown');
  } else {
    document.getElementById('heal-timer').textContent = 'LISTO';
    document.getElementById('heal-skill').classList.remove('cooldown');
  }

  if (skillCooldowns.shield > 0) {
    skillCooldowns.shield = Math.max(0, skillCooldowns.shield - dt);
    document.getElementById('shield-timer').textContent = Math.ceil(skillCooldowns.shield) + 's';
    document.getElementById('shield-skill').classList.add('cooldown');
  } else {
    document.getElementById('shield-timer').textContent = 'LISTO';
    document.getElementById('shield-skill').classList.remove('cooldown');
  }

  if (skillCooldowns.nuke > 0) {
    skillCooldowns.nuke = Math.max(0, skillCooldowns.nuke - dt);
    document.getElementById('nuke-timer').textContent = Math.ceil(skillCooldowns.nuke) + 's';
    document.getElementById('nuke-skill').classList.add('cooldown');
  } else {
    document.getElementById('nuke-timer').textContent = 'LISTO';
    document.getElementById('nuke-skill').classList.remove('cooldown');
  }
}

function checkAchievements() {
  if (!gameStartTime) return;
  const playTime = Math.floor((Date.now() - gameStartTime) / 1000);

  // Logro 1: 100 muertes
  if (!achievements.zombieSlayer.unlocked && score >= 15000) {
    achievements.zombieSlayer.unlocked = true;
    showToast("¡Logro desbloqueado: Cazador de Zombies!", "success");
    updateAchievementsUI();
  }
  // Logro 2: sobrevivir 5 minutos (300 segundos)
  if (!achievements.survivor.unlocked && playTime >= achievements.survivor.required) {
    achievements.survivor.unlocked = true;
    showToast("¡Logro desbloqueado: Superviviente de Élite!", "success");
    updateAchievementsUI();
  }
  // Logro 3: Utilizar 5 armas diferentes
  if (!achievements.weaponMaster.unlocked && usedWeapons.size >= achievements.weaponMaster.required) {
    achievements.weaponMaster.unlocked = true;
    showToast("¡Logro desbloqueado: Maestro Armero!", "success");
    updateAchievementsUI();
  }
}

function updateAchievementsUI() {
  const container = document.getElementById('achievements-list');
  if (!container) return;
  container.innerHTML = Object.keys(achievements).map(k => {
    const ach = achievements[k];
    return `
      <div class="achievement-item">
        <div class="achievement-icon ${ach.unlocked ? 'achievement-unlocked' : 'achievement-locked'}">
          ${ach.unlocked ? '✓' : '?'}
        </div>
        <span class="${ach.unlocked ? 'text-white' : 'text-slate-500'} font-bold">${ach.label}</span>
      </div>
    `;
  }).join('');
}

// 11. MAPAS Y MINIMAPAS
function drawMiniMap() {
  if (!player || !mctx) return;
  mctx.fillStyle = 'rgba(2, 6, 15, 0.9)';
  mctx.fillRect(0, 0, 150, 150);

  const scale = 0.015; // Escala
  const cx = 75;
  const cy = 75;

  // Edificios
  buildings.forEach(b => {
    mctx.fillStyle = b.type === 'hospital' ? '#10b981' : '#3b82f6';
    mctx.beginPath();
    mctx.arc(cx + (b.x - player.x) * scale, cy + (b.y - player.y) * scale, 3.5, 0, Math.PI * 2);
    mctx.fill();
  });

  // Búnkeres
  window.bunkers.forEach(b => {
    mctx.fillStyle = '#fbbf24';
    mctx.beginPath();
    mctx.arc(cx + (b.x - player.x) * scale, cy + (b.y - player.y) * scale, 4.5, 0, Math.PI * 2);
    mctx.fill();
  });

  // Zombies
  entities.forEach(e => {
    if (e.team === 'zombie') {
      mctx.fillStyle = '#ef4444';
      mctx.beginPath();
      mctx.arc(cx + (e.x - player.x) * scale, cy + (e.y - player.y) * scale, 2, 0, Math.PI * 2);
      mctx.fill();
    }
  });

  // Bots aliados
  entities.forEach(bot => {
    if (bot.type === 'bot') {
      mctx.fillStyle = '#a78bfa';
      mctx.beginPath();
      mctx.arc(cx + (bot.x - player.x) * scale, cy + (bot.y - player.y) * scale, 3, 0, Math.PI * 2);
      mctx.fill();
    }
  });

  // Jugador local
  mctx.fillStyle = '#00f2ff';
  mctx.beginPath();
  mctx.arc(cx, cy, 4, 0, Math.PI * 2);
  mctx.fill();

  // Borde
  mctx.strokeStyle = 'rgba(0, 242, 255, 0.4)';
  mctx.lineWidth = 1.5;
  mctx.strokeRect(0, 0, 150, 150);
}

function drawWindowMap() {
  if (!player || !wctx) return;
  wctx.fillStyle = 'rgba(2, 6, 15, 0.95)';
  wctx.fillRect(0, 0, 300, 300);

  const scale = 0.04; // Escala mayor
  const cx = 150;
  const cy = 150;

  // Grilla
  wctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  for(let i=0; i<300; i+=30) {
    wctx.beginPath();
    wctx.moveTo(i, 0); wctx.lineTo(i, 300);
    wctx.moveTo(0, i); wctx.lineTo(300, i);
    wctx.stroke();
  }

  // Dibujar objetos
  buildings.forEach(b => {
    wctx.fillStyle = b.type === 'hospital' ? '#10b981' : '#3b82f6';
    wctx.beginPath();
    wctx.arc(cx + (b.x - player.x) * scale, cy + (b.y - player.y) * scale, 6, 0, Math.PI * 2);
    wctx.fill();
  });

  window.bunkers.forEach(b => {
    wctx.fillStyle = '#fbbf24';
    wctx.beginPath();
    wctx.arc(cx + (b.x - player.x) * scale, cy + (b.y - player.y) * scale, 8, 0, Math.PI * 2);
    wctx.fill();
  });

  entities.forEach(e => {
    if (e.team === 'zombie') {
      wctx.fillStyle = '#ef4444';
      wctx.beginPath();
      wctx.arc(cx + (e.x - player.x) * scale, cy + (e.y - player.y) * scale, 3, 0, Math.PI * 2);
      wctx.fill();
    } else if (e.type === 'bot') {
      wctx.fillStyle = '#a78bfa';
      wctx.beginPath();
      wctx.arc(cx + (e.x - player.x) * scale, cy + (e.y - player.y) * scale, 4.5, 0, Math.PI * 2);
      wctx.fill();
    }
  });

  // Jugador
  wctx.fillStyle = '#00f2ff';
  wctx.beginPath();
  wctx.arc(cx, cy, 6, 0, Math.PI * 2);
  wctx.fill();
}

// 12. MENÚS, GUARDADO Y SISTEMA MULTIJUGADOR (WebSockets)
let socket = null;

function connectWebSocket(roomId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  const url = `${protocol}//${host}:8765`;

  try {
    socket = new WebSocket(url);
    socket.onopen = () => {
      showToast("Conectado al servidor multijugador.", "success");
      // Enviar unión a sala
      socket.send(jsonMsg("JOIN_ROOM", {
        roomId: roomId,
        playerData: {
          uid: 'uid_' + Date.now(),
          name: document.getElementById('player-name-input').value || "Agente",
          avatarIdx: selectedAvatarIdx
        }
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };

    socket.onerror = () => {
      showToast("No se pudo conectar al servidor de WebSockets. Modo cooperativo desactivado.", "error");
      isMultiplayer = false;
    };

    socket.onclose = () => {
      showToast("Conexión con el servidor multijugador finalizada.", "warning");
      isMultiplayer = false;
    };
  } catch (err) {
    console.error("Error WebSocket:", err);
  }
}

function jsonMsg(type, payload) {
  return JSON.stringify({ type, ...payload });
}

function handleServerMessage(data) {
  if (data.type === 'WELCOME') {
    showToast("¡Sincronizado en la sala cooperativa!", "success");
  } else if (data.type === 'ROOM_UPDATE') {
    // Sincronizar jugadores remotos
    const serverPlayers = data.roomState.players || [];
    const others = [];
    serverPlayers.forEach(p => {
      if (player && p.uid !== player.uid) {
        others.push(p);
      }
    });
    window.remotePlayers = others;
  } else if (data.type === 'CHAT_MESSAGE') {
    const chat = document.getElementById('chat-box');
    if (chat) {
      const msg = document.createElement('div');
      msg.className = 'chat-msg';
      msg.innerHTML = `<span class="chat-name">${data.sender}:</span><span>${data.message}</span>`;
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
    }
  }
}

function syncMultiplayerState() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(jsonMsg("PLAYER_UPDATE", {
    player: {
      x: player.x,
      y: player.y,
      angle: player.angle,
      hp: player.hp,
      score: score,
      weapon: activeWKey,
      hasHelmet: player.hasHelmet
    }
  }));
}

// 13. MOTOR DE JUEGO PRINCIPAL (Bucle)
function gameLoop() {
  if (!isGameOver && !isPaused) {
    updateLogic();
  }
  drawGameScene();
  requestAnimationFrame(gameLoop);
}

// Funciones globales vinculadas al HTML
window.startGame = function(resume) {
  const nameInput = document.getElementById('player-name-input').value.trim();
  if (!nameInput) {
    showToast("¡Ingresa tu nombre clave de agente!", "error");
    return;
  }

  // Ocultar ventanas flotantes y modales
  document.getElementById('startup-screen').style.display = 'none';
  document.getElementById('cover-screen').style.opacity = '0';
  setTimeout(() => document.getElementById('cover-screen').style.display = 'none', 500);

  // Inicializar jugador local
  player = new Entity(0, 0, {
    type: 'human',
    isPlayer: true,
    hp: 1000,
    speed: 4.8,
    team: 'human',
    color: '#00f2ff',
    name: nameInput,
    weapon: activeWKey
  });

  // Limpiar estados
  entities = [];
  bullets = [];
  items = [];
  buildings = [];
  portals = [];
  window.mines = [];
  window.bunkers = [];
  window.particles = [];
  window.remotePlayers = [];
  window.weaponPickups = [];
  isGameOver = false;
  score = 0;
  kills = 0;
  currentLvl = resume && window.savedData ? window.savedData.level : 1;
  targetKills = 80 + (currentLvl - 1) * 25;
  gameStartTime = Date.now();

  // Restaurar munición
  Object.keys(WEAPONS).forEach(k => {
    if (WEAPONS[k].ammo !== null) WEAPONS[k].ammo = WEAPONS[k].maxAmmo;
  });

  // Generar edificaciones fijas alrededor
  for (let i = 0; i < 4; i++) {
    let a = (Math.PI / 2) * i + (Math.random()-0.5)*0.3;
    buildings.push({
      x: Math.cos(a) * 1200,
      y: Math.sin(a) * 1200,
      type: i % 2 === 0 ? 'hospital' : 'refuge',
      radius: 130
    });
  }

  // Generar bunkers
  window.bunkers.push({
    x: 0,
    y: 900,
    radius: 90,
    lastUsed: 0
  });

  // Generar aliados bots en modo un solo jugador
  if (!isMultiplayer) {
    entities.push(new Entity(-100, 100, {
      type: 'bot',
      hp: 1000,
      speed: 4.0,
      team: 'human',
      color: '#c084fc',
      name: 'Recluta Miller',
      weapon: 'PLASMA'
    }));

    entities.push(new Entity(100, 100, {
      type: 'bot',
      hp: 1000,
      speed: 4.0,
      team: 'human',
      color: '#f472b6',
      name: 'Recluta Lopez',
      weapon: 'SHOTGUN'
    }));

    setTimeout(() => {
      entities.forEach(bot => {
        if (bot.type === 'bot') {
          showSpeechBubble(bot, "¡Listo para la acción, jefe!");
        }
      });
    }, 2000);
  }

  // Iniciar audio si el usuario lo activó
  AudioSynth.toggle(AudioSynth.isEnabled);

  // Iniciar radiación tras 2.5 minutos
  setTimeout(() => {
    if (!isGameOver && !isPaused) {
      radiationActive = true;
      radiationStartTime = Date.now();
      showToast("¡ADVERTENCIA: ALTA RADIACIÓN EN LA ZONA!", "error");
    }
  }, 150000);

  updateHUD();
  updateAchievementsUI();
  requestAnimationFrame(gameLoop);
};

window.showMultiplayerMenu = function() {
  document.getElementById('multi-modal').style.display = 'flex';
  document.getElementById('room-selection-ui').classList.remove('hidden');
  document.getElementById('lobby-ui').classList.add('hidden');
};

window.joinLobby = function() {
  const roomCode = document.getElementById('room-id-input').value.trim().toLowerCase();
  if (roomCode.length < 3) {
    showToast("Ingresa un código de sala de al menos 3 caracteres.", "error");
    return;
  }

  currentRoomId = roomCode;
  isMultiplayer = true;
  document.getElementById('room-selection-ui').classList.add('hidden');
  document.getElementById('lobby-ui').classList.remove('hidden');
  document.getElementById('lobby-room-code').innerText = roomCode.toUpperCase();
  document.getElementById('current-room-id').innerText = roomCode.toUpperCase();
  document.getElementById('room-badge').classList.remove('hidden');

  // Conectar con el servidor WebSocket
  connectWebSocket(roomCode);
};

window.sendChatMessageLobby = function() {
  const inp = document.getElementById('lobby-chat-input');
  const txt = inp.value.trim();
  if (txt && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(jsonMsg("CHAT_MESSAGE", { message: txt }));
    inp.value = '';
  }
};

window.exitLobby = function() {
  if (socket) {
    socket.close();
    socket = null;
  }
  isMultiplayer = false;
  currentRoomId = null;
  document.getElementById('multi-modal').style.display = 'none';
  document.getElementById('room-badge').classList.add('hidden');
};

window.startMultiplayerGame = function() {
  document.getElementById('multi-modal').style.display = 'none';
  window.startGame(false);
};

window.showRanking = function() {
  document.getElementById('ranking-modal').style.display = 'flex';
  // Cargar puntuaciones del cache local
  const list = document.getElementById('leaderboard-list');
  if (localCache && localCache.highScores) {
    list.innerHTML = localCache.highScores.slice(0, 10).map((s, i) => `
      <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl">
        <div class="flex items-center gap-3">
          <span class="text-amber-400 font-bold">#${i+1}</span>
          <span class="text-white font-bold">${s.name.toUpperCase()}</span>
        </div>
        <div class="text-right">
          <span class="text-blue-400 font-bold">${s.score} pts</span>
          <div class="text-xs text-slate-500">Nivel ${s.level}</div>
        </div>
      </div>
    `).join('');
  } else {
    list.innerHTML = '<div class="text-center text-slate-500 py-6">No hay registros de clasificación local aún.</div>';
  }
};

window.showSettings = function() {
  document.getElementById('settings-modal').style.display = 'flex';
};

window.hideModals = function() {
  document.querySelectorAll('.modal-screen').forEach(m => {
    if (m.id !== 'startup-screen') m.style.display = 'none';
  });
};

window.togglePause = function() {
  if (isGameOver) return;
  isPaused = !isPaused;
  const btn = document.getElementById('pause-btn');
  if (btn) btn.textContent = isPaused ? '▶️' : '⏸️';
  showToast(isPaused ? "Simulación Pausada" : "Simulación Reanudada", "info");
};

window.exitToMenu = function() {
  location.reload();
};

window.toggleMinimapWindow = function() {
  const win = document.getElementById('minimap-window');
  win.style.display = win.style.display === 'block' ? 'none' : 'block';
};

window.minimizeWindow = function(id) {
  document.getElementById(id).style.display = 'none';
};

window.closeWindow = function(id) {
  document.getElementById(id).style.display = 'none';
};

window.selectAvatar = function(idx) {
  selectedAvatarIdx = idx;
  document.querySelectorAll('.avatar-card').forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
  });
};

window.toggleAchievements = function() {
  const panel = document.getElementById('achievements-panel');
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
};

// UI y HUD Helpers
function updateHUD() {
  if (!player) return;
  // Vida
  const fill = document.getElementById('hp-bar');
  if (fill) {
    const pct = Math.max(0, (player.hp / player.maxHp) * 100);
    fill.style.width = pct + '%';
    if (pct > 50) fill.style.backgroundColor = '#10b981';
    else if (pct > 25) fill.style.backgroundColor = '#d97706';
    else fill.style.backgroundColor = '#ef4444';
  }
  // Vidas
  const livesDisp = document.getElementById('lives-display');
  if (livesDisp) livesDisp.innerText = "❤️".repeat(player.lives);

  // Nivel
  const lvlDisp = document.getElementById('level-display');
  if (lvlDisp) lvlDisp.innerText = currentLvl.toString().padStart(2, '0');

  // Arma
  const wp = WEAPONS[activeWKey];
  document.getElementById('weapon-icon-btn').innerText = wp.icon;
  document.getElementById('ammo-count').innerText = wp.ammo === null ? '∞' : wp.ammo;

  // Horda
  document.getElementById('z-remain').innerText = `${kills}/${targetKills}`;
  const progressPct = Math.min(100, (kills / targetKills) * 100);
  document.getElementById('objective-progress').style.width = progressPct + '%';
}

function updateTelemetryPanel() {
  if (!player) return;
  const playTime = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
  const m = Math.floor(playTime / 60).toString().padStart(2, '0');
  const s = (playTime % 60).toString().padStart(2, '0');

  document.getElementById('tel-time').innerText = `${m}:${s}`;
  document.getElementById('tel-zombies').innerText = entities.filter(e => e.team === 'zombie').length;

  const deaths = 3 - player.lives;
  const ratio = deaths > 0 ? (score / (deaths * 1000)).toFixed(1) : (score / 1000).toFixed(1);
  document.getElementById('tel-kd').innerText = ratio;
}

function screenShake(amt) {
  canvas.style.transform = `translate(${(Math.random()-0.5)*amt}px, ${(Math.random()-0.5)*amt}px)`;
  setTimeout(() => canvas.style.transform = '', 80);

  const flash = document.getElementById('flash-fx');
  if (flash) {
    flash.style.opacity = '0.35';
    setTimeout(() => flash.style.opacity = '0', 60);
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const colors = {
    info: 'bg-sky-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    error: 'bg-rose-600'
  };

  toast.className = `${colors[type]} toast-msg text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl mb-2`;
  toast.innerText = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 2600);
}

function endGame() {
  isGameOver = true;
  document.getElementById('game-over').style.display = 'flex';

  const playTime = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
  const m = Math.floor(playTime / 60);
  const s = playTime % 60;

  document.getElementById('final-stats').innerHTML = `
    <div class="text-white text-lg font-bold mb-1">NIVEL ALCANZADO: ${currentLvl}</div>
    <div class="text-sky-400 font-bold mb-1">PUNTUACIÓN TOTAL: ${score} PTS</div>
    <div class="text-slate-400 text-sm">TIEMPO SOBREVIVIDO: ${m}:${s.toString().padStart(2, '0')}</div>
  `;

  // Guardar en highscores local
  const name = document.getElementById('player-name-input').value || "Agente";
  submitHighScore(name, score, currentLvl);
}

// 14. COMPLEMENTO DE GUARDADO LOCAL (CACHE FALLBACK)
function loadSavedData() {
  try {
    const raw = localStorage.getItem('zombieSurvivorCache');
    if (raw) {
      localCache = JSON.parse(raw);
      if (localCache.saveData) {
        window.savedData = localCache.saveData;
        document.getElementById('resume-btn')?.classList.remove('hidden');
        document.getElementById('saved-level').innerText = window.savedData.level;
        document.getElementById('player-name-input').value = window.savedData.name;
        showToast("Datos de supervivencia recuperados del sector local.", "success");
      }
    }
  } catch(e) {
    console.warn("No se pudo cargar datos locales.");
  }
}

function saveGameProgress(lvl, scr, name, avIdx) {
  localCache = localCache || {};
  localCache.saveData = { level: lvl, score: scr, name, avatarIdx: avIdx, timestamp: Date.now() };
  try {
    localStorage.setItem('zombieSurvivorCache', JSON.stringify(localCache));
  } catch(e) {}
}

function submitHighScore(name, score, level) {
  localCache = localCache || {};
  localCache.highScores = localCache.highScores || [];
  localCache.highScores.push({ name, score, level, date: Date.now() });
  localCache.highScores.sort((a, b) => b.score - a.score);
  try {
    localStorage.setItem('zombieSurvivorCache', JSON.stringify(localCache));
  } catch(e) {}
}

// Inicialización de Canvas al cargar
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  miniMapCanvas = document.getElementById('mini-map-canvas');
  mctx = miniMapCanvas.getContext('2d');
  windowMapCanvas = document.getElementById('window-map-canvas');
  wctx = windowMapCanvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Controles
  setupInput();

  // Cargar datos guardados locales
  loadSavedData();

  // Mapear listeners de botones de habilidades en HUD
  document.getElementById('heal-skill').addEventListener('click', triggerHealSkill);
  document.getElementById('shield-skill').addEventListener('click', triggerShieldSkill);
  document.getElementById('nuke-skill').addEventListener('click', triggerNukeSkill);

  // Mapear botón de arma en HUD
  document.getElementById('swap-weapon-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const keysList = Object.keys(WEAPONS);
    let idx = keysList.indexOf(activeWKey);
    activeWKey = keysList[(idx + 1) % keysList.length];
    usedWeapons.add(activeWKey);
    if (player) {
      player.weapon = activeWKey;
      updateHUD();
      showToast(`Arma: ${WEAPONS[activeWKey].icon} ${WEAPONS[activeWKey].id}`, 'info');
    }
  });

  // Colocar mina táctica en HUD
  document.getElementById('mine-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (Date.now() - lastMinePlacement < mineCooldown) {
      const rem = Math.ceil((mineCooldown - (Date.now() - lastMinePlacement)) / 1000);
      showToast(`Mina cargando. Espera ${rem}s`, 'warning');
      return;
    }
    if (player && player.active) {
      window.mines.push({
        x: player.x,
        y: player.y,
        radius: 20,
        countdown: 3, // Explota automáticamente tras 3s si no la pisan
        plantTime: Date.now(),
        exploded: false
      });
      // Contador visual decrementando cada segundo
      const mIdx = window.mines.length - 1;
      const interval = setInterval(() => {
        if (window.mines[mIdx]) {
          if (window.mines[mIdx].countdown > 0) {
            window.mines[mIdx].countdown--;
          } else {
            clearInterval(interval);
            if (!window.mines[mIdx].exploded) {
              triggerMineExplosion(window.mines[mIdx], mIdx);
            }
          }
        } else {
          clearInterval(interval);
        }
      }, 1000);

      lastMinePlacement = Date.now();
      showToast("Mina táctica desplegada (Detonación 3s)", "success");
      spawnFloatingText(player.x, player.y, 'MINA 💣', '#fbbf24');
    }
  });

  // Activar o desactivar sonido sintetizado
  const micBtn = document.getElementById('mic-btn');
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      AudioSynth.isEnabled = !AudioSynth.isEnabled;
      AudioSynth.toggle(AudioSynth.isEnabled);
      micBtn.classList.toggle('mic-active', AudioSynth.isEnabled);
      showToast(AudioSynth.isEnabled ? "Sintetizador de Audio: ACTIVADO" : "Sintetizador de Audio: SILENCIADO", "info");
    });
  }

  // Ajustes de volumen
  const volSlider = document.getElementById('volume-slider');
  if (volSlider) {
    volSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      document.getElementById('volume-val').innerText = val + '%';
      AudioSynth.setVolume(val);
    });
  }

  // Simular carga de motor de supervivencia
  let progress = 0;
  const loadInterval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(loadInterval);
      document.getElementById('loading-text').textContent = '¡SISTEMA LISTO PARA COMBATE!';
      setTimeout(() => {
        document.getElementById('auth-options').style.display = 'flex';
        document.getElementById('loading-text').style.display = 'none';
        document.getElementById('loading-bar-container').style.display = 'none';
      }, 700);
    }
    document.getElementById('loading-bar').style.width = progress + '%';
  }, 100);

  // Acceder como Invitado o Local
  const triggerStartup = () => {
    document.getElementById('cover-screen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('cover-screen').style.display = 'none';
      document.getElementById('startup-screen').style.display = 'flex';
    }, 500);
  };

  document.getElementById('anonymous-auth-btn').onclick = triggerStartup;
  document.getElementById('local-cache-btn').onclick = triggerStartup;
  document.getElementById('google-auth-btn').onclick = triggerStartup;
});
