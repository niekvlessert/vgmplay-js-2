const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loadingText = document.getElementById('loading');

let gameActive = false;
let gameOver = false;
let gameFinished = false; // Victory state
let gameState = 'NORMAL'; // NORMAL, BOSS_APPROACHING, BOSS_FIGHT
let score = 0;
let lastTime = 0;

let boss = null;
const BOSS_SCORE_THRESHOLD = 2000; // Lowered to reach boss faster

// Audio context for sound effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = false;

function playShootSound() {
    if (!soundEnabled || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

const player = {
    x: 50,
    y: 200,
    width: 30,
    height: 20,
    speed: 300,
    dy: 0,
    dx: 0
};

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

const bullets = [];
const bulletSpeed = 500;
let lastShotTime = 0;
const fireRate = 0.2; // seconds

const enemies = [];
const energyCapsules = []; // Dropped energy
const enemySpeed = 150;
let enemySpawnTimer = 0;
const enemySpawnRate = 1.0; // seconds

let powerMeter = 0; // 0=None, 1=Speed, 2=Missile, 3=Laser
let currentWeapon = 0; // 0=Normal, 1=Missile, 2=Laser

function initAudioContext() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    soundEnabled = true;
}

// User interaction unlocks audio
document.body.addEventListener('click', initAudioContext, { once: true });
document.body.addEventListener('keydown', initAudioContext, { once: true });

document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp') keys.ArrowUp = true;
    if (e.code === 'ArrowDown') keys.ArrowDown = true;
    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;
    if (e.code === 'Space') {
        if (!gameActive && !gameFinished && window.vgmPlayInstance) {
            if (gameOver) resetGame();
            else startGame();
        } else if (gameFinished && window.vgmPlayInstance) {
            resetGame();
        } else {
            keys.Space = true;
        }
    }
    if (e.code === 'KeyM') {
        if (gameActive && powerMeter > 0) {
            applyUpgrade();
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp') keys.ArrowUp = false;
    if (e.code === 'ArrowDown') keys.ArrowDown = false;
    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;
    if (e.code === 'Space') keys.Space = false;
});

canvas.addEventListener('click', () => {
    if (!gameActive && window.vgmPlayInstance) {
        if (gameOver || gameFinished) resetGame();
        else startGame();
    }
});

function applyUpgrade() {
    if (powerMeter === 1) {
        player.speed += 100;
        loadingText.innerText = "SPEED UP!";
    } else if (powerMeter === 2) {
        currentWeapon = 1;
        loadingText.innerText = "MISSILES EQUIPPED!";
    } else if (powerMeter === 3) {
        currentWeapon = 2;
        loadingText.innerText = "LASER EQUIPPED!";
    }
    powerMeter = 0;
}

function startGame() {
    gameActive = true;
    gameOver = false;
    gameFinished = false;
    gameState = 'NORMAL';
    boss = null;
    score = 0;
    powerMeter = 0;
    currentWeapon = 0;
    player.x = 50;
    player.y = 200;
    player.speed = 300;
    bullets.length = 0;
    enemies.length = 0;
    energyCapsules.length = 0;
    loadingText.innerText = "Playing SD Snatcher - Resistance...";

    if (window.vgmPlayInstance) {
        window.vgmPlayInstance.playZipTrack('dist/02.zip', 9, 0).catch(console.error);
    }
}

function resetGame() {
    startGame();
}

function triggerGameOver() {
    gameActive = false;
    gameOver = true;
    loadingText.innerText = "GAME OVER. Press Space to restart.";

    if (window.vgmPlayInstance) {
        window.vgmPlayInstance.playZipTrack('dist/02.zip', 41, 0).catch(console.error);
    }
}

function triggerVictory() {
    gameActive = false;
    gameFinished = true;
    loadingText.innerText = "MISSION ACCOMPLISHED! Press Space to restart.";
}

function update(dt) {
    if (!gameActive) return;

    // Check for Boss Spawn
    if (gameState === 'NORMAL' && score >= BOSS_SCORE_THRESHOLD) {
        gameState = 'BOSS_APPROACHING';
        loadingText.innerText = "WARNING! Boss Approaching!";
        enemies.length = 0;
        if (window.vgmPlayInstance) {
            window.vgmPlayInstance.playZipTrack('dist/02.zip', 11, 0).catch(console.error);
        }

        setTimeout(() => {
            if (gameState === 'BOSS_APPROACHING') {
                gameState = 'BOSS_FIGHT';
                boss = {
                    x: canvas.width + 100,
                    y: canvas.height / 2 - 50,
                    width: 80,
                    height: 100,
                    hp: 150,
                    maxHp: 150,
                    dy: 100,
                    lastShotTimer: 0
                };
            }
        }, 3000);
    }

    // Movement
    player.dy = 0;
    player.dx = 0;
    if (keys.ArrowUp) player.dy = -player.speed;
    if (keys.ArrowDown) player.dy = player.speed;
    if (keys.ArrowLeft) player.dx = -player.speed;
    if (keys.ArrowRight) player.dx = player.speed;

    player.x += player.dx * dt;
    player.y += player.dy * dt;

    // Constraints
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height - 40) player.y = canvas.height - 40 - player.height;
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Shooting
    if (keys.Space) {
        const now = performance.now() / 1000;
        if (now - lastShotTime > fireRate) {
            if (currentWeapon === 0) {
                bullets.push({ x: player.x + player.width, y: player.y + player.height / 2 - 2, width: 10, height: 4, type: 'normal', dx: bulletSpeed });
            } else if (currentWeapon === 1) {
                bullets.push({ x: player.x + player.width, y: player.y + player.height / 2 - 2, width: 10, height: 4, type: 'normal', dx: bulletSpeed });
                bullets.push({ x: player.x + player.width, y: player.y + player.height, width: 8, height: 8, type: 'missile', dx: bulletSpeed * 0.5, dy: 150 });
            } else if (currentWeapon === 2) {
                bullets.push({ x: player.x + player.width, y: player.y + player.height / 2 - 4, width: 40, height: 8, type: 'laser', dx: bulletSpeed * 1.5 });
            }
            playShootSound();
            lastShotTime = now;
        }
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.dx * dt;
        if (b.dy) b.y += b.dy * dt;

        if (b.x > canvas.width || b.x < -b.width || b.y > canvas.height || b.y < -b.height) {
            bullets.splice(i, 1);
        }
    }

    // Update Boss
    if (gameState === 'BOSS_FIGHT' && boss) {
        if (boss.x > canvas.width - boss.width - 20) {
            boss.x -= 50 * dt;
        } else {
            boss.y += boss.dy * dt;
            if (boss.y < 20 || boss.y + boss.height > canvas.height - 60) {
                boss.dy = -boss.dy;
            }

            boss.lastShotTimer += dt;
            if (boss.lastShotTimer > 0.8) {
                bullets.push({ x: boss.x, y: boss.y + 20, width: 20, height: 6, type: 'boss_laser', dx: -400 });
                bullets.push({ x: boss.x, y: boss.y + boss.height - 26, width: 20, height: 6, type: 'boss_laser', dx: -400 });
                boss.lastShotTimer = 0;
            }
        }

        // Collision players bullets -> boss
        for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            if (b.type !== 'boss_laser' && b.x < boss.x + boss.width && b.x + b.width > boss.x && b.y < boss.y + boss.height && b.y + b.height > boss.y) {
                if (b.type !== 'laser') bullets.splice(j, 1);
                boss.hp -= (b.type === 'laser' ? 0.3 : (b.type === 'missile' ? 5 : 2));
            }
        }

        if (boss.hp <= 0) {
            score += 5000;
            triggerVictory();
            return;
        }
    }

    // Update Capsules
    for (let i = energyCapsules.length - 1; i >= 0; i--) {
        let cap = energyCapsules[i];
        cap.x -= (enemySpeed * 0.5) * dt;

        if (player.x < cap.x + cap.width &&
            player.x + player.width > cap.x &&
            player.y < cap.y + cap.height &&
            player.y + player.height > cap.y) {
            energyCapsules.splice(i, 1);
            if (powerMeter < 3) powerMeter++;
            score += 50;
            continue;
        }
        if (cap.x + cap.width < 0) energyCapsules.splice(i, 1);
    }

    // Spawn enemies
    if (gameState === 'NORMAL') {
        enemySpawnTimer += dt;
        if (enemySpawnTimer > enemySpawnRate) {
            enemySpawnTimer = 0;
            enemies.push({ x: canvas.width, y: Math.random() * (canvas.height - 70), width: 30, height: 30 });
        }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        enemy.x -= enemySpeed * dt;

        // Player collision
        if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x && player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) {
            triggerGameOver();
            return;
        }

        // Bullet collision
        let destroyed = false;
        for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            if (b.type !== 'boss_laser' && b.x < enemy.x + enemy.width && b.x + b.width > enemy.x && b.y < enemy.y + enemy.height && b.y + b.height > enemy.y) {
                if (b.type !== 'laser') bullets.splice(j, 1);
                destroyed = true;
                score += 100;
                break;
            }
        }

        if (destroyed) {
            if (Math.random() < 0.2) energyCapsules.push({ x: enemy.x, y: enemy.y, width: 20, height: 15 });
            enemies.splice(i, 1);
        } else if (enemy.x + enemy.width < 0) {
            enemies.splice(i, 1);
        }
    }

    // Bullet collision with player
    for (let b of bullets) {
        if (b.type === 'boss_laser' && b.x < player.x + player.width && b.x + b.width > player.x && b.y < player.y + player.height && b.y + b.height > player.y) {
            triggerGameOver();
            return;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameActive && !gameOver && !gameFinished) {
        ctx.fillStyle = "white";
        ctx.font = "24px 'Courier New', Courier, monospace";
        ctx.textAlign = "center";
        ctx.fillText("Gradius FTW", canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = "16px Arial";
        ctx.fillText("PRESS SPACE TO START", canvas.width / 2, canvas.height / 2 + 10);
    } else if (gameOver) {
        ctx.fillStyle = "red";
        ctx.font = "40px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.fillText("PRESS SPACE TO RESTART", canvas.width / 2, canvas.height / 2 + 20);
    } else if (gameFinished) {
        ctx.fillStyle = "gold";
        ctx.font = "40px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText("VICTORY!", canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.fillText("PRESS SPACE TO PLAY AGAIN", canvas.width / 2, canvas.height / 2 + 20);
    } else {
        // Draw Player (Space Manbow)
        const px = player.x, py = player.y;
        ctx.fillStyle = "red";
        ctx.fillRect(px, py, 10, 4); ctx.fillRect(px, py + 16, 10, 4); // Wings
        ctx.fillStyle = "white";
        ctx.fillRect(px + 4, py + 4, 12, 12); // Fuselage
        ctx.fillStyle = "black";
        ctx.fillRect(px + 8, py + 6, 6, 8); // Window
        ctx.fillStyle = "red";
        ctx.fillRect(px + 16, py + 6, 10, 8); // Nose
        ctx.fillStyle = "white";
        ctx.fillRect(px + 26, py + 8, 4, 4); // Tip

        if (keys.ArrowRight) {
            ctx.fillStyle = "#0ff";
            ctx.fillRect(px - 8, py + 8, 8, 4); // Engine
        }

        // Bullets
        for (let b of bullets) {
            if (b.type === 'normal') ctx.fillStyle = "yellow";
            else if (b.type === 'missile') ctx.fillStyle = "orange";
            else if (b.type === 'laser') ctx.fillStyle = "#0ff";
            else if (b.type === 'boss_laser') ctx.fillStyle = "#f0f";
            ctx.fillRect(b.x, b.y, b.width, b.height);
        }

        // Enemies
        for (let e of enemies) {
            ctx.fillStyle = "#555";
            ctx.fillRect(e.x, e.y, e.width, e.height);
            ctx.fillStyle = "red";
            ctx.fillRect(e.x + 5, e.y + 5, e.width - 10, e.height - 10);
        }

        // Capsules
        for (let c of energyCapsules) {
            ctx.fillStyle = "red";
            ctx.fillRect(c.x, c.y, c.width, c.height);
            ctx.fillStyle = "yellow";
            ctx.fillRect(c.x + 4, c.y + 4, c.width - 8, c.height - 8);
        }

        // Boss (Flying Penguin from Parodius)
        if (gameState === 'BOSS_FIGHT' && boss) {
            ctx.fillStyle = "red";
            ctx.fillRect(boss.x - 10, boss.y - 15, boss.width + 20, 5);
            ctx.fillStyle = "lime";
            ctx.fillRect(boss.x - 10, boss.y - 15, (boss.hp / boss.maxHp) * (boss.width + 20), 5);

            const bx = boss.x, by = boss.y;
            const bw = boss.width, bh = boss.height;

            // Body (Black)
            ctx.fillStyle = "black";
            ctx.beginPath();
            ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Belly (White)
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.ellipse(bx + bw / 2, by + bh / 2 + 5, bw / 3, bh / 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = "white";
            ctx.fillRect(bx + 15, by + 20, 10, 10);
            ctx.fillRect(bx + bw - 25, by + 20, 10, 10);
            ctx.fillStyle = "black";
            ctx.fillRect(bx + 17, by + 22, 4, 4);
            ctx.fillRect(bx + bw - 23, by + 22, 4, 4);

            // Beak (Orange)
            ctx.fillStyle = "#ffa500";
            ctx.beginPath();
            ctx.moveTo(bx + bw / 2 - 10, by + bh / 2 - 5);
            ctx.lineTo(bx + bw / 2 + 10, by + bh / 2 - 5);
            ctx.lineTo(bx + bw / 2, by + bh / 2 + 15);
            ctx.closePath();
            ctx.fill();

            // Bowtie (Red - very Parodius)
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.moveTo(bx + bw / 2 - 15, by + bh / 2 + 25);
            ctx.lineTo(bx + bw / 2 + 15, by + bh / 2 + 25);
            ctx.lineTo(bx + bw / 2, by + bh / 2 + 35);
            ctx.closePath();
            ctx.fill();

            // Wings
            ctx.fillStyle = "black";
            ctx.fillRect(bx - 20, by + bh / 2 - 5, 25, 10);
            ctx.fillRect(bx + bw - 5, by + bh / 2 - 5, 25, 10);
        }

        // Power Meter UI
        const my = canvas.height - 35;
        ctx.fillStyle = "black";
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.font = "bold 14px Courier";
        ctx.textAlign = "center";

        ctx.fillStyle = powerMeter === 1 ? "yellow" : (powerMeter > 1 ? "white" : "#444");
        ctx.fillText("[ SPEED ]", canvas.width / 4, my);
        ctx.fillStyle = powerMeter === 2 ? "yellow" : (powerMeter > 2 ? "white" : "#444");
        ctx.fillText("[ MISSILE ]", canvas.width / 2, my);
        ctx.fillStyle = powerMeter === 3 ? "yellow" : "#444";
        ctx.fillText("[ LASER ]", canvas.width * 0.75, my);

        // Score
        ctx.fillStyle = "white";
        ctx.font = "16px Courier";
        ctx.textAlign = "left";
        ctx.fillText("SCORE: " + score, 10, 25);
    }
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(dt);
    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
