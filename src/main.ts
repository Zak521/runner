import './style.css'
import * as THREE from 'three'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">R</span><span>RIFT RUNNER</span></div>
      <div class="status"><span class="live-dot"></span> LIVE RUN</div>
      <button class="icon-button" id="pause" type="button" aria-label="Pause game" title="Pause game">Ⅱ</button>
    </header>
    <section class="stage" aria-label="3D endless runner game">
      <div id="scene"></div>
      <div class="hud">
        <div><span class="hud-label">DISTANCE</span><strong id="distance">0000</strong></div>
        <div><span class="hud-label">SHARDS</span><strong id="shards">00</strong></div>
        <div class="speed-meter"><span class="hud-label">VELOCITY</span><strong><span id="velocity">1.0</span>x</strong><i><b id="speed-fill"></b></i></div>
      </div>
      <div class="crosshair" aria-hidden="true"></div>
      <div class="message" id="message">
        <p class="eyebrow">SECTOR 07 / NIGHT SHIFT</p>
        <h1>RUN THE RIFT</h1>
        <p class="lede">Thread the neon lanes. Outrun the collapse.</p>
        <button class="primary-button" id="start" type="button">START RUN <span>→</span></button>
        <p class="controls">ARROW KEYS / A D <span>MOVE</span> · SPACE <span>JUMP</span></p>
      </div>
      <div class="game-over" id="game-over" hidden>
        <p class="eyebrow">SIGNAL LOST</p><h2>THE RIFT CAUGHT YOU</h2>
        <p>Distance <strong id="final-distance">0000</strong> · Shards <strong id="final-shards">00</strong></p>
        <button class="primary-button" id="restart" type="button">RUN IT BACK <span>↻</span></button>
      </div>
      <div class="touch-controls" aria-label="Touch controls"><button data-lane="left" aria-label="Move left">←</button><button data-jump="true" aria-label="Jump">↑</button><button data-lane="right" aria-label="Move right">→</button></div>
    </section>
    <footer><span>RIFT // 03</span><span>ESC TO PAUSE</span></footer>
  </main>`

const sceneHost = document.querySelector<HTMLDivElement>('#scene')!
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x07131f)
scene.fog = new THREE.Fog(0x07131f, 18, 74)
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120)
camera.position.set(0, 4.4, 8.5)
camera.lookAt(0, 1, -12)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true
sceneHost.appendChild(renderer.domElement)
scene.add(new THREE.HemisphereLight(0xa7dfff, 0x08111c, 2.2))
const sun = new THREE.DirectionalLight(0x9ee9ff, 3.5); sun.position.set(-6, 12, 8); sun.castShadow = true; scene.add(sun)

const laneX = [-2.2, 0, 2.2], player = new THREE.Group(), obstacles: THREE.Mesh[] = [], shards: THREE.Mesh[] = [], stripes: THREE.Mesh[] = []
const runnerMat = new THREE.MeshStandardMaterial({ color: 0xff5d67, emissive: 0x7d172d, emissiveIntensity: 1.8, roughness: 0.3 })
const roadMat = new THREE.MeshStandardMaterial({ color: 0x172838, roughness: 0.85, metalness: 0.2 })
const cyanMat = new THREE.MeshBasicMaterial({ color: 0x50f5e6 })
const pinkMat = new THREE.MeshBasicMaterial({ color: 0xff526d })

const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 150), roadMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -35); floor.receiveShadow = true; scene.add(floor)
for (const x of [-3.3, 3.3]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 150), cyanMat); rail.position.set(x, 0.08, -35); scene.add(rail) }
for (let i = 0; i < 24; i++) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 2), cyanMat); stripe.position.set(0, 0.03, -i * 6); stripes.push(stripe); scene.add(stripe) }
for (let i = 0; i < 15; i++) { const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5 + (i % 3), 0.35), new THREE.MeshStandardMaterial({ color: 0x13364a, emissive: 0x062d42, emissiveIntensity: 2 })); pillar.position.set(i % 2 ? 7 : -7, 2.5, -i * 9 - 8); scene.add(pillar) }

const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.15, 0.55), runnerMat); torso.position.y = 1.25; torso.castShadow = true; player.add(torso)
const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe0cf, emissive: 0x8c2538, emissiveIntensity: 0.45 })); helmet.position.y = 2.1; helmet.castShadow = true; player.add(helmet)
for (const x of [-0.22, 0.22]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.2), runnerMat); leg.position.set(x, 0.45, 0); player.add(leg) }
player.position.set(0, 0, 3); scene.add(player)

let lane = 1, targetX = 0, jumping = false, verticalSpeed = 0, running = false, paused = false, distance = 0, shardCount = 0, speed = 0.28, spawnTimer = 0, shardTimer = 0, lastTime = 0
const distanceEl = document.querySelector('#distance')!, shardsEl = document.querySelector('#shards')!, velocityEl = document.querySelector('#velocity')!, fillEl = document.querySelector<HTMLElement>('#speed-fill')!
const message = document.querySelector<HTMLElement>('#message')!, gameOver = document.querySelector<HTMLElement>('#game-over')!
function resize() { const { clientWidth: width, clientHeight: height } = sceneHost; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false) }
function reset() { for (const object of [...obstacles, ...shards]) { scene.remove(object) }; obstacles.length = 0; shards.length = 0; lane = 1; targetX = 0; player.position.set(0, 0, 3); distance = 0; shardCount = 0; speed = 0.28; spawnTimer = 0; shardTimer = 0; jumping = false; gameOver.hidden = true; message.classList.remove('hidden'); running = false; updateHud() }
function updateHud() { distanceEl.textContent = Math.floor(distance).toString().padStart(4, '0'); shardsEl.textContent = shardCount.toString().padStart(2, '0'); velocityEl.textContent = (speed / 0.28).toFixed(1); fillEl.style.width = `${Math.min(100, speed / 0.55 * 100)}%` }
function spawnObstacle() { const obstacle = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.5, 1.1), pinkMat); obstacle.position.set(laneX[Math.floor(Math.random() * 3)], 0.75, -52); obstacle.castShadow = true; obstacles.push(obstacle); scene.add(obstacle) }
function spawnShard() { const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), cyanMat); shard.position.set(laneX[Math.floor(Math.random() * 3)], 1.25 + Math.random() * 0.5, -52); shards.push(shard); scene.add(shard) }
function endRun() { running = false; gameOver.hidden = false; message.classList.add('hidden'); document.querySelector('#final-distance')!.textContent = Math.floor(distance).toString().padStart(4, '0'); document.querySelector('#final-shards')!.textContent = shardCount.toString().padStart(2, '0') }
function move(direction: number) { if (!running) return; lane = Math.max(0, Math.min(2, lane + direction)); targetX = laneX[lane] }
function jump() { if (running && !jumping) { jumping = true; verticalSpeed = 0.22 } }
function startRun() { reset(); running = true; paused = false; message.classList.add('hidden') }
function animate(time: number) { requestAnimationFrame(animate); const delta = Math.min((time - lastTime) / 16.67 || 1, 2); lastTime = time; if (running && !paused) { distance += speed * delta; speed = Math.min(0.55, speed + 0.00008 * delta); spawnTimer -= delta; shardTimer -= delta; if (spawnTimer <= 0) { spawnObstacle(); spawnTimer = 42 - Math.random() * 12 } if (shardTimer <= 0) { spawnShard(); shardTimer = 24 + Math.random() * 15 }
    player.position.x += (targetX - player.position.x) * 0.16 * delta; if (jumping) { player.position.y += verticalSpeed * delta; verticalSpeed -= 0.015 * delta; if (player.position.y <= 0) { player.position.y = 0; jumping = false } } player.rotation.z = (targetX - player.position.x) * -0.08
    for (const stripe of stripes) { stripe.position.z += speed * 2.1 * delta; if (stripe.position.z > 6) stripe.position.z -= 144 }
    for (let i = obstacles.length - 1; i >= 0; i--) { const obstacle = obstacles[i]; obstacle.position.z += speed * 2.1 * delta; obstacle.rotation.y += 0.02 * delta; if (obstacle.position.z > 8) { scene.remove(obstacle); obstacles.splice(i, 1) } else if (Math.abs(obstacle.position.x - player.position.x) < 0.78 && Math.abs(obstacle.position.z - 3) < 0.85 && player.position.y < 0.65) endRun() }
    for (let i = shards.length - 1; i >= 0; i--) { const shard = shards[i]; shard.position.z += speed * 2.1 * delta; shard.rotation.y += 0.08 * delta; if (shard.position.z > 8) { scene.remove(shard); shards.splice(i, 1) } else if (Math.abs(shard.position.x - player.position.x) < 0.75 && Math.abs(shard.position.z - 3) < 0.75 && Math.abs(shard.position.y - (player.position.y + 1.2)) < 1) { shardCount++; scene.remove(shard); shards.splice(i, 1) } } updateHud() } renderer.render(scene, camera) }
window.addEventListener('resize', resize); window.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') move(-1); if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') move(1); if (event.key === 'ArrowUp' || event.key === ' ') { event.preventDefault(); jump() }; if (event.key === 'Escape') { paused = !paused } });
document.querySelector('#start')!.addEventListener('click', startRun); document.querySelector('#restart')!.addEventListener('click', startRun); document.querySelector('#pause')!.addEventListener('click', () => { if (running) paused = !paused }); document.querySelectorAll<HTMLButtonElement>('.touch-controls button').forEach((button) => button.addEventListener('click', () => button.dataset.jump ? jump() : move(button.dataset.lane === 'left' ? -1 : 1)))
resize(); updateHud(); requestAnimationFrame(animate)
