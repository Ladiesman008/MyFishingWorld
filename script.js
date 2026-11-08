// ==========================================
// 1. MANAJEMEN STATE & TRANSISI UI
// ==========================================
const screens = {
    loading: document.getElementById('loading-screen'),
    menu: document.getElementById('main-menu-screen'),
    game: document.getElementById('game-screen')
};

let currentMode = 'FISHING'; 

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    setTimeout(() => {
        if (screens[screenName]) screens[screenName].classList.remove('hidden');
    }, 150);
}

// Loading Simulation
const progressFill = document.getElementById('progress-fill');
const btnEnter = document.getElementById('btn-enter');

let loadProgress = 0;
const loadingInterval = setInterval(() => {
    loadProgress += 15;
    progressFill.style.width = loadProgress + '%';
    if (loadProgress >= 100) {
        clearInterval(loadingInterval);
        btnEnter.style.display = 'inline-block';
    }
}, 150);

btnEnter.addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-new-game').addEventListener('click', () => {
    showScreen('game');
    init3DWorld();
});

// ==========================================
// 2. SISTEM AKUARIUM & GENETIK WARNA
// ==========================================
let coins = 100;
let aquariumFishes = [
    { id: 1, species: 'Ikan Mas', color: '#ff3333', price: 25, isHungry: true },
    { id: 2, species: 'Ikan Mas', color: '#3388ff', price: 25, isHungry: true }
];
let selectedFishes = [];

const aquariumPanel = document.getElementById('aquarium-panel');
const fishInventory = document.getElementById('fish-inventory');
const aquariumMessage = document.getElementById('aquarium-message');
const coinDisplay = document.getElementById('coin-display');
const modeTitle = document.getElementById('mode-title');
const fishingHud = document.getElementById('fishing-hud');

function renderAquariumUI() {
    fishInventory.innerHTML = '';
    aquariumFishes.forEach(fish => {
        const card = document.createElement('div');
        card.className = 'fish-card';
        card.innerHTML = `
            <div style="width:40px; height:20px; background-color:${fish.color}; border-radius:10px; margin:0 auto 6px auto; box-shadow: 0 0 8px ${fish.color};"></div>
            <small>${fish.species}</small><br>
            <small style="opacity: 0.7;">${fish.isHungry ? 'Minta Makan' : 'Kenyang'}</small>
        `;
        card.onclick = () => {
            const index = selectedFishes.indexOf(fish);
            if (index > -1) {
                selectedFishes.splice(index, 1);
                card.classList.remove('selected');
            } else if (selectedFishes.length < 2) {
                selectedFishes.push(fish);
                card.classList.add('selected');
            }
        };
        fishInventory.appendChild(card);
    });
}

document.getElementById('btn-feed').addEventListener('click', () => {
    aquariumFishes.forEach(fish => fish.isHungry = false);
    aquariumMessage.innerText = "Semua ikan sudah kenyang!";
    renderAquariumUI();
});

document.getElementById('btn-sell').addEventListener('click', () => {
    if (selectedFishes.length === 0) return aquariumMessage.innerText = "Pilih ikan dulu!";
    let earned = 0;
    selectedFishes.forEach(fish => {
        earned += fish.price;
        aquariumFishes = aquariumFishes.filter(f => f.id !== fish.id);
    });
    coins += earned;
    coinDisplay.innerText = coins;
    aquariumMessage.innerText = `Terjual! Mendapatkan ${earned} koin.`;
    selectedFishes = [];
    renderAquariumUI();
});

document.getElementById('btn-breed').addEventListener('click', () => {
    if (selectedFishes.length !== 2) return aquariumMessage.innerText = "Pilih tepat 2 ikan!";
    const [pA, pB] = selectedFishes;
    if (pA.isHungry || pB.isHungry) return aquariumMessage.innerText = "Ikan lapar, beri makan dulu!";

    const cA = new THREE.Color(pA.color);
    const cB = new THREE.Color(pB.color);
    const babyColor = cA.lerp(cB, 0.5);
    
    babyColor.r = Math.max(0, Math.min(1, babyColor.r + (Math.random() * 0.2 - 0.1)));
    babyColor.g = Math.max(0, Math.min(1, babyColor.g + (Math.random() * 0.2 - 0.1)));
    babyColor.b = Math.max(0, Math.min(1, babyColor.b + (Math.random() * 0.2 - 0.1)));

    const babyFish = {
        id: Date.now(),
        species: pA.species,
        color: '#' + babyColor.getHexString(),
        price: pA.price + Math.floor(Math.random() * 15),
        isHungry: true
    };
    
    aquariumFishes.push(babyFish);
    aquariumMessage.innerText = "Berhasil! Anakan ikan dengan mutasi warna lahir!";
    selectedFishes = [];
    renderAquariumUI();
});

document.getElementById('nav-fishing').addEventListener('click', () => {
    currentMode = 'FISHING';
    modeTitle.innerText = "Mode Memancing Danau 🎣";
    aquariumPanel.style.display = 'none';
    fishingHud.style.display = 'block';
    targetCameraPos.copy(defaultCameraPos);
    targetCameraLookAt.copy(defaultCameraLookAt);
});

document.getElementById('nav-aquarium').addEventListener('click', () => {
    currentMode = 'AQUARIUM';
    modeTitle.innerText = "Akuarium Pembiakan 🐟";
    aquariumPanel.style.display = 'block';
    fishingHud.style.display = 'none';
    renderAquariumUI();
});

document.getElementById('nav-exit').addEventListener('click', () => {
    if(confirm("Kembali ke Menu Utama?")) showScreen('menu');
});

// ==========================================
// 3. REALISTIC THREE.JS WORLD & PHYSICS
// ==========================================
let scene, camera, renderer, water;
let floatMesh;
let waterRipples = [];

const defaultCameraPos = new THREE.Vector3(0, 5, 12);
const defaultCameraLookAt = new THREE.Vector3(0, 1, 0);
let targetCameraPos = defaultCameraPos.clone();
let targetCameraLookAt = defaultCameraLookAt.clone();
let currentCameraLookAt = defaultCameraLookAt.clone();

let fishingState = 'IDLE'; 
let powerValue = 0;
let powerDirection = 1;
let velocityY = 0, velocityZ = 0;
const gravity = -0.012;

const powerFill = document.getElementById('power-fill');
const fishingStatus = document.getElementById('fishing-status');
const statusText = document.getElementById('status-text');

function init3DWorld() {
    if (renderer) return;

    const container = document.getElementById('3d-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(defaultCameraPos);
    camera.lookAt(defaultCameraLookAt);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    sunLight.position.set(50, 40, 20);
    scene.add(sunLight);

    const textureLoader = new THREE.TextureLoader();
    const waterNormals = textureLoader.load('assets/textures/waternormals.jpg', function(texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    });

    const waterGeometry = new THREE.PlaneGeometry(300, 300);
    water = new THREE.Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: waterNormals,
        sunDirection: sunLight.position.clone().normalize(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    const floatGroup = new THREE.Group();
    const topGeo = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xff2222, roughness: 0.3 });
    const botGeo = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const botMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    floatGroup.add(new THREE.Mesh(topGeo, topMat));
    floatGroup.add(new THREE.Mesh(botGeo, botMat));
    floatGroup.visible = false;
    scene.add(floatGroup);
    floatMesh = floatGroup;

    window.addEventListener('mousedown', (e) => {
        if (currentMode === 'FISHING' && fishingState === 'IDLE' && e.target.closest('#3d-container')) {
            fishingState = 'CHARGING';
            powerValue = 0;
        }
    });

    window.addEventListener('mouseup', () => {
        if (fishingState === 'CHARGING') {
            fishingState = 'CASTING';
            castLure(powerValue);
        }
    });

    window.addEventListener('resize', onWindowResize);

    animate();
}

function castLure(power) {
    floatMesh.visible = true;
    floatMesh.position.set(0, 1.5, 3);
    velocityZ = (power / 100) * -1.1;
    velocityY = (power / 100) * 0.35 + 0.18;

    fishingStatus.style.display = 'inline-block';
    statusText.innerText = `Melempar! Power: ${Math.round(power)}%`;
}

function spawnWaterRipple(x, z) {
    const ringGeo = new THREE.RingGeometry(0.1, 0.25, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const ripple = new THREE.Mesh(ringGeo, ringMat);
    ripple.rotation.x = Math.PI / 2;
    ripple.position.set(x, 0.02, z);
    ripple.userData = { scale: 1, opacity: 0.8 };
    scene.add(ripple);
    waterRipples.push(ripple);
}

function updatePhysics() {
    if (fishingState === 'CHARGING') {
        powerValue += 2 * powerDirection;
        if (powerValue >= 100) { powerValue = 100; powerDirection = -1; }
        if (powerValue <= 0) { powerValue = 0; powerDirection = 1; }
        powerFill.style.width = powerValue + '%';
    }

    if (fishingState === 'CASTING') {
        floatMesh.position.z += velocityZ;
        floatMesh.position.y += velocityY;
        velocityY += gravity;

        targetCameraPos.set(floatMesh.position.x, floatMesh.position.y + 2, floatMesh.position.z + 4);
        targetCameraLookAt.copy(floatMesh.position);

        if (floatMesh.position.y <= 0) {
            floatMesh.position.y = 0;
            fishingState = 'WAITING';
            spawnWaterRipple(floatMesh.position.x, floatMesh.position.z);
            
            const depth = Math.abs(floatMesh.position.z);
            statusText.innerText = `Kail Mendarat di Kedalaman ${Math.round(depth)}m. Menunggu Ikan...`;
            
            targetCameraPos.copy(defaultCameraPos);
            targetCameraLookAt.copy(defaultCameraLookAt);

            setTimeout(() => {
                if (fishingState === 'WAITING') triggerStrike(depth);
            }, 3000);
        }
    }

    if (fishingState === 'WAITING') {
        floatMesh.position.y = Math.sin(Date.now() * 0.005) * 0.05;
        if (Math.random() < 0.03) spawnWaterRipple(floatMesh.position.x, floatMesh.position.z);
    }

    for (let i = waterRipples.length - 1; i >= 0; i--) {
        const r = waterRipples[i];
        r.userData.scale += 0.04;
        r.scale.set(r.userData.scale, r.userData.scale, 1);
        r.userData.opacity -= 0.015;
        r.material.opacity = Math.max(0, r.userData.opacity);
        if (r.userData.opacity <= 0) {
            scene.remove(r);
            r.geometry.dispose();
            r.material.dispose();
            waterRipples.splice(i, 1);
        }
    }
}

function triggerStrike(depth) {
    statusText.innerText = "💥 IKAN MEMAKAN UMPAN! KLIK CEPAT!";
    floatMesh.position.y = -0.2;

    const timeout = setTimeout(() => {
        if (fishingState === 'WAITING') {
            statusText.innerText = "❌ Ikan Lepas!";
            resetFishing();
        }
    }, 2000);

    const onStrikeClick = () => {
        clearTimeout(timeout);
        window.removeEventListener('click', onStrikeClick);
        if (fishingState === 'WAITING') {
            const reward = Math.floor(depth * 2) + 15;
            coins += reward;
            coinDisplay.innerText = coins;
            alert(`🎉 IKAN TERTANGKAP!\nKedalaman: ${Math.round(depth)}m\nHadiah: 🪙 ${reward} Koin!`);
            resetFishing();
        }
    };
    window.addEventListener('click', onStrikeClick);
}

function resetFishing() {
    setTimeout(() => {
        fishingState = 'IDLE';
        powerValue = 0;
        powerFill.style.width = '0%';
        floatMesh.visible = false;
        fishingStatus.style.display = 'none';
    }, 1200);
}

function animate() {
    requestAnimationFrame(animate);

    if (water) water.material.uniforms['time'].value += 1.0 / 60.0;

    if (currentMode === 'FISHING') {
        updatePhysics();

        camera.position.lerp(targetCameraPos, 0.05);
        currentCameraLookAt.lerp(targetCameraLookAt, 0.05);
        camera.lookAt(currentCameraLookAt);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}