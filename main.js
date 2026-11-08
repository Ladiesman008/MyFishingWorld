import * as THREE from 'three';
import { ERAS } from './data/eras.js';
import { BUILDINGS, getAvailableBuildings } from './data/buildings.js';
import { createJapaneseTerrain, terrainHeight, MAP_SIZE, GRID_COUNT } from './world/terrain.js';
import { RESOURCE_EXTRACTORS, RESOURCE_SITE_TYPES, RESOURCE_SITES } from './data/resourceSites.js';
import { createResourceSiteOverlay } from './world/resourceSiteOverlay.js';
import { createCityCamera, createMainCamera, resizeMainCamera, resetMainCamera } from './world/camera.js';
import { getBuildingFocusZoom } from './world/cameraProfile.js';
import { getRendererProfile } from './world/visualProfile.js';
import { CityManager } from './systems/cityManager.js';
import { TOWN_HALL_POPULATION_REQUIREMENT, TOWN_HALL_FOOTPRINT_SIZE } from './systems/townHallRules.js';
import { getResidentialEraName, getResidentialEraBaseCapacity, RESIDENTIAL_BUILDING_ID } from './systems/housing.js';
import { getPassengerBuildingThroughput, getCargoBuildingBonus } from './systems/transport.js';
import { createPerformanceMonitor } from './systems/performanceMonitor.js';
import { getWorldClock, getDaylightFactor } from './systems/worldClock.js';
import { estimateEraUpgrade } from './systems/eraProgression.js';
import { createCityHistory, getCityHistorySeries, recordCityHistory } from './ui/cityHistory.js';
import { BUILDING_ICON_BY_ID, createUiIcon } from './ui/uiIcons.js';

const BUILDING_CARD_THUMBNAILS = Object.freeze({
  townhall: 0,
  'jomon-hut': 1,
  school: 3,
  hospital: 4,
  market: 5,
});
import { LOADING_DURATION_MS, getLoadingProgress, getLoadingMessage } from './ui/loadingTimeline.js';
import { getWelcomeSequenceTiming } from './ui/welcomeSequence.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const isMobile = window.matchMedia('(max-width: 760px)').matches;
const performanceDiagnosticsEnabled = new URLSearchParams(window.location.search).get('perf') === '1';

const gameRoot = $('#game-root');
const welcomeSplash = $('#welcome-splash');
const loadingScreen = $('#loading-screen');
const loadingStatus = $('#loading-status');
const startupErrorScreen = $('#startup-error-screen');
const loadingProgress = $('#loading-progress');
const loadingPercent = $('#loading-percent');
const mainMenuScreen = $('#main-menu-screen');
const mainMenuOptions = $('#main-menu-options');
const mainMenuSettings = $('#main-menu-settings');
const mainMenuMessage = $('#main-menu-message');
const exitLetterScreen = $('#exit-letter-screen');
const farewellScreen = $('#farewell-screen');
const gameUI = $('#game-ui');
const buildingList = $('#building-list');
const buildCategoryRail = $('#build-category-rail');
const buildSelectionHint = $('#build-selection-hint');
const tutorialCompanion = $('#tutorial-companion');
const tutorialMessageElement = $('#tutorial-message');
const tutorialStageElement = $('#tutorial-stage');
const tutorialProgressElement = $('#tutorial-progress');
const tutorialExtraTipElement = $('#tutorial-extra-tip');
const budgetElement = $('#money');
const populationElement = $('#population');
const cityHistory = createCityHistory(60);
const RESOURCE_TREND_META = Object.freeze({
  food: { label: 'Beras / pangan', color: '#e5ca91' },
  wood: { label: 'Kayu', color: '#a9d6b8' },
  stone: { label: 'Batu', color: '#b7c4d8' },
  iron: { label: 'Besi', color: '#c9cdd4' },
  eggs: { label: 'Telur', color: '#e5d5ad' },
  meat: { label: 'Daging', color: '#cf9b9b' }
});
const economyIncomeElement = $('#economy-income');
const economyProgressElement = $('#economy-progress');
const economyCountdownElement = $('#economy-countdown');
const economySourceCountElement = $('#economy-source-count');
const economyBreakdownElement = $('#economy-breakdown');
const roadNetworkStatusElement = $('#road-network-status');
const roadNetworkDetailElement = $('#road-network-detail');
const networkWarning = $('#network-warning');
const networkWarningDetail = $('#network-warning-detail');
const worldTimeBanner = $('#world-time-banner');
const worldClockValue = $('#world-clock-value');
const worldPhaseLabel = $('#world-phase-label');
const worldSeasonValue = $('#world-season-value');
const worldWeatherValue = $('#world-weather-value');
const worldWeatherForecast = $('#world-weather-forecast');
const hoverObjectLabel = $('#hover-object-label');
const hoverObjectName = $('#hover-object-name');
const hoverObjectType = $('#hover-object-type');
const transportNetworkStatusElement = $('#transport-network-status');
const passengerThroughputElement = $('#passenger-throughput');
const cargoThroughputElement = $('#cargo-throughput');
const transportNetworkDetailElement = $('#transport-network-detail');
const eraNameElement = $('#world-era');
const dockEraElement = $('#dock-era');
const townHallEraElement = $('#townhall-era');
const townHallLevelElement = $('#townhall-level');
const townHallEyebrowElement = $('#townhall-card-eyebrow');
const townHallEmblemElement = $('#townhall-emblem');
const eraDescriptionElement = $('#era-description');
const upgradeRequirementsElement = $('#upgrade-requirements');
const upgradeButton = $('#upgrade-button');
const upgradeMessage = $('#upgrade-message');
const upgradeForecastElement = $('#upgrade-forecast');
const eraRewardPreviewElement = $('#era-reward-preview');
const upgradeProgressLabel = $('#upgrade-progress-label');
const upgradeProgressBar = $('#upgrade-progress-bar');
const nextEraLabel = $('#next-era-label');
const selectedToolLabel = $('#selected-tool-label');
const pointerStatus = $('#pointer-status');
const pointerStatusText = $('#pointer-status-text');
const toastElement = $('#toast');
const statsView = $('#stats-view');
const buildView = $('#build-view');
const settingsView = $('#settings-view');
const dockPopover = $('#dock-popover');
const dockPanelTitle = $('#dock-panel-title');
const closeDockButton = $('#close-dock-button');
const cancelBuildButton = $('#cancel-build-button');
const buildingInspector = $('#building-inspector');
const inspectorName = $('#inspector-name');
const inspectorSubtitle = $('#inspector-subtitle');
const inspectorType = $('#inspector-type');
const inspectorLevel = $('#inspector-level');
const inspectorResidents = $('#inspector-residents');
const inspectorResidentLabel = $('#inspector-resident-label');
const inspectorResidentNote = $('#inspector-resident-note');
const inspectorDescription = $('#inspector-description');
const inspectorUpgradeLabel = $('#inspector-upgrade-label');
const inspectorUpgradeCost = $('#inspector-upgrade-cost');
const inspectorUpgradeNote = $('#inspector-upgrade-note');
const buildingUpgradeButton = $('#building-upgrade-button');
const buildingDemolishButton = $('#building-demolish-button');
const inspectorCloseButton = $('#inspector-close');
const warehouseInventory = $('#warehouse-inventory');
let sunLight = null;
let hemiLight = null;
let fillLight = null;
let graphicsQuality = 'balanced';
let lastEconomyUiUpdate = 0;
let lastEconomyAutosave = 0;
let lastWorldUiUpdate = 0;
const DAY_SKY_COLOR = new THREE.Color(0x9bd7ed);
const NIGHT_SKY_COLOR = new THREE.Color(0x25366d);
const DAY_SUN_COLOR = new THREE.Color(0xfff2d6);
const NIGHT_SUN_COLOR = new THREE.Color(0x9db4ed);
const DAY_HEMI_COLOR = new THREE.Color(0xe9f8ff);
const NIGHT_HEMI_COLOR = new THREE.Color(0x7288bd);
const DAY_GROUND_COLOR = new THREE.Color(0x77985c);
const NIGHT_GROUND_COLOR = new THREE.Color(0x344365);

let scene;
let camera;
let renderer;
let performanceMonitor = null;
let controls;
let city;
let worldEnvironment;
let buildSurface;
let resourceSiteOverlay;
let selectedBuildingId = null;
let buildMode = false;
let activeTab = null;
let selectedBuildCategory = null;
let tutorialTipIndex = -1;
let tutorialWasCollapsed = true;
let preview;
let toastTimeout;
let dockCloseTimer = null;
let dockTransitionHandler = null;
let inspectorCloseTimer = null;
let inspectorTransitionHandler = null;
let pointerStart = null;
let pointerDragging = false;
let inspectedBuilding = null;
let hoveredBuilding = null;
let hoverHelper = null;
let cameraFocusAnimation = null;
let gameStarted = false;
let animationStarted = false;
let isGamePaused = false;
let pauseStartedAt = 0;
let lastMinimapRenderAt = 0;
let menuTransitionTimer = null;
let exitLetterTimer = null;
let newGameLoadingFrame = 0;
let welcomeSequenceTimers = [];

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const CATEGORY_NAMES = {
  residential: 'Hunian', infrastructure: 'Infrastruktur', industry: 'Industri & Pertanian',
  commercial: 'Perdagangan', service: 'Fasilitas', landmark: 'Landmark'
};
const CATEGORY_GROUPS = [
  ['residential', 'HUNIAN'],
  ['infrastructure', 'INFRASTRUKTUR'],
  ['industry', 'PERTANIAN & INDUSTRI'],
  ['commercial', 'PERDAGANGAN'],
  ['service', 'FASILITAS KOTA'],
  ['landmark', 'LANDMARK']
];
const BUILD_CATEGORY_KEYS = Object.freeze(['townhall', ...CATEGORY_GROUPS.map(([key]) => key)]);
const PLANNED_BUILD_CATEGORY_KEYS = Object.freeze(['commercial', 'service', 'landmark']);
const STARTER_TUTORIAL_GOALS = Object.freeze([
  { type: 'road', target: 1, stage: 'AKSES KOTA', title: 'Buka jalan untuk permukiman', message: 'Yuk mulai dari satu jalan akses. Pilih Build → Infrastruktur → Jalan. Jalur ini menjadi awal pergerakan warga dan distribusi resource.' },
  { type: 'jomon-hut', target: 2, stage: 'HUNIAN AWAL', title: 'Sediakan tempat tinggal', message: 'Permukiman membutuhkan rumah. Pilih Build → Hunian, lalu tempatkan dua Gubuk Jōmon pada lahan yang terhubung dengan jalan.' },
  { type: 'rice-field', target: 1, stage: 'PANGAN', title: 'Siapkan sawah di tepi sungai', message: 'Pangan menjaga kota tetap tumbuh. Pilih Build → Pertanian & Industri, lalu tempatkan sawah pada zona tepi sungai yang ditandai.' },
  { type: 'forestry-camp', target: 1, stage: 'BAHAN BANGUNAN', title: 'Mulai produksi kayu', message: 'Kayu dibutuhkan untuk perkembangan awal. Bangun Pos Penebang Kayu di area hutan yang disorot, lalu pastikan akses jalannya terhubung.' }
]);
const TUTORIAL_EXTRA_TIPS = Object.freeze([
  'Tahan klik kiri lalu geser untuk menggerakkan kamera. Roda mouse atau pinch digunakan untuk mengatur zoom.',
  'Klik bangunan yang sudah berdiri untuk melihat penghuni, level, produksi, dan pilihan upgrade.',
  'Tekan Stats untuk melihat kas, stok resource, jaringan logistik, grafik pertumbuhan, serta syarat era berikutnya.',
  'Klik kanan atau tombol ESC untuk membatalkan mode penempatan tanpa membangun objek.'
]);

function showToast(message, kind = 'info') {
  toastElement.textContent = message;
  toastElement.dataset.kind = kind;
  toastElement.classList.add('is-visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toastElement.classList.remove('is-visible'), 2700);
}

function formatYen(value) {
  return `¥ ${Math.floor(value).toLocaleString('id-ID')}`;
}

function formatResourceCost(resources) {
  const labels = { food: 'P', wood: 'K', stone: 'B', iron: 'Fe', eggs: 'T', meat: 'D' };
  return Object.entries(resources ?? {})
    .filter(([, amount]) => Number(amount) > 0)
    .map(([key, amount]) => `${labels[key] ?? key} ${Math.ceil(amount)}`)
    .join(' · ') || 'Tanpa material';
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderWorldBanner(now = Date.now()) {
  if (!city || !worldTimeBanner) return;
  const world = getWorldClock(now, city.worldStartedAt);
  worldClockValue.textContent = world.time;
  worldPhaseLabel.textContent = world.phaseLabel;
  worldSeasonValue.innerHTML = `<span>${world.season.icon}</span> ${world.season.jp} · ${world.season.short}`;
  worldWeatherValue.textContent = `${world.weather.icon} ${world.weather.label}`;
  worldWeatherForecast.textContent = `Berikutnya ${world.nextWeather.icon} ${world.nextWeather.label} · ${formatCountdown(world.nextWeatherInMs)}`;
  worldTimeBanner.dataset.phase = world.isDay ? 'day' : 'night';
  worldTimeBanner.dataset.season = world.season.id;

  const daylight = getDaylightFactor(now, city.worldStartedAt);
  if (scene?.background?.isColor) scene.background.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, daylight);
  if (scene?.fog?.color) scene.fog.color.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, daylight);
  if (sunLight) {
    sunLight.color.copy(NIGHT_SUN_COLOR).lerp(DAY_SUN_COLOR, daylight);
    sunLight.intensity = 0.16 + 2.18 * daylight;
  }
  if (hemiLight) {
    hemiLight.color.copy(NIGHT_HEMI_COLOR).lerp(DAY_HEMI_COLOR, daylight);
    hemiLight.groundColor.copy(NIGHT_GROUND_COLOR).lerp(DAY_GROUND_COLOR, daylight);
    hemiLight.intensity = 0.34 + 1.28 * daylight;
  }
  if (fillLight) fillLight.intensity = 0.1 + 0.38 * daylight;
  if (renderer) renderer.toneMappingExposure = 0.88 + 0.2 * daylight;
}

function hideHoverObjectLabel() {
  if (!hoverObjectLabel) return;
  hoverObjectLabel.hidden = true;
  hoverObjectLabel.setAttribute('aria-hidden', 'true');
}

function updateHoverObjectLabel(target, clientX, clientY) {
  if (!target || buildMode || !hoverObjectLabel) {
    hideHoverObjectLabel();
    return;
  }

  let name = 'Objek kota';
  let type = 'Objek';
  if (target.isWorldObject) {
    name = target.name;
    type = target.objectType;
  } else if (target.isTownHall) {
    name = ERAS[city.eraIndex]?.townHall ?? 'Town Hall';
    type = 'Pusat pemerintahan';
  } else {
    const definition = BUILDINGS.find((item) => item.id === target.type);
    name = target.type === RESIDENTIAL_BUILDING_ID
      ? getResidentialEraName(target.visualEraIndex ?? city.eraIndex)
      : (definition?.name ?? target.type ?? name);
    type = target.type === 'road'
      ? 'Infrastruktur · Jalan'
      : (CATEGORY_NAMES[definition?.category] ?? 'Bangunan kota');
  }

  hoverObjectName.textContent = name;
  hoverObjectType.textContent = type;
  hoverObjectLabel.hidden = false;
  hoverObjectLabel.setAttribute('aria-hidden', 'false');
  const labelRect = hoverObjectLabel.getBoundingClientRect();
  const left = Math.max(8, Math.min(clientX + 16, window.innerWidth - labelRect.width - 8));
  const top = Math.max(8, Math.min(clientY + 16, window.innerHeight - labelRect.height - 8));
  hoverObjectLabel.style.left = `${left}px`;
  hoverObjectLabel.style.top = `${top}px`;
}

function renderEconomyPanel(now = Date.now()) {
  if (!city) return;
  const forecast = city.getIncomeForecast();
  const clock = city.getEconomyClock(now);
  economyIncomeElement.textContent = `+${formatYen(forecast.total)}`;
  economyProgressElement.style.width = `${Math.round(clock.progress * 100)}%`;
  economyCountdownElement.textContent = `Pemasukan berikutnya ${formatCountdown(clock.remainingMs)}`;
  economySourceCountElement.textContent = `${forecast.sourceCount} sumber pemasukan`;
  const incomeText = Object.entries(forecast.breakdown)
    .map(([label, amount]) => `${label} ${formatYen(amount)}`)
    .join(' · ');
  const production = city.getResourceProductionForecast();
  const productionText = Object.entries(production)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `${({ food: 'Beras/pangan', wood: 'Kayu', stone: 'Batu', iron: 'Besi', eggs: 'Telur', meat: 'Daging' })[key] ?? key} +${amount}`)
    .join(' · ');
  economyBreakdownElement.textContent = [incomeText, productionText ? `Produksi: ${productionText}` : '']
    .filter(Boolean)
    .join('  |  ');
}

function getUpgradeStatus() {
  const nextEra = ERAS[city.eraIndex + 1] ?? null;
  if (!nextEra) return { nextEra: null, checks: [], progress: 1, forecast: null, requirements: null };

  if (!city.townHall) {
    const population = city.getPopulation();
    const checks = [{
      key: 'populationForTownHall',
      label: 'Penduduk untuk membangun Town Hall',
      current: population,
      required: TOWN_HALL_POPULATION_REQUIREMENT,
      ok: population >= TOWN_HALL_POPULATION_REQUIREMENT
    }];
    return {
      nextEra,
      checks,
      progress: Math.min(1, population / TOWN_HALL_POPULATION_REQUIREMENT),
      forecast: null,
      requirements: null,
      ready: false,
      requiresTownHall: true
    };
  }

  const status = city.getEraUpgradeStatus();
  const checks = status.checks;
  const progress = checks.length
    ? checks.reduce((sum, item) => sum + Math.min(1, item.current / Math.max(1, item.required)), 0) / checks.length
    : 1;
  const forecast = estimateEraUpgrade({
    nextEra,
    requirements: status.requirements,
    population: city.getPopulation(),
    money: city.money,
    incomePerCycle: city.getIncomeForecast().total,
    populationPerCycle: city.getExpectedPopulationGrowthPerCycle(),
    resourceStock: city.resources,
    resourceProduction: city.getResourceProductionForecast()
  });
  return { nextEra, checks, progress, forecast, requirements: status.requirements, ready: status.ready };
}

function renderUpgradePanel() {
  const currentEra = ERAS[city.eraIndex];
  const { nextEra, checks, progress, forecast, requirements, ready } = getUpgradeStatus();
  document.documentElement.dataset.eraTheme = currentEra.uiTheme ?? 'wood';
  document.documentElement.dataset.eraIndex = String(city.eraIndex);
  document.documentElement.dataset.eraMaterial = currentEra.uiMaterial ?? 'Kayu';
  dockEraElement.title = `Tema antarmuka: ${currentEra.uiMaterial ?? 'Kayu'}`;
  townHallEraElement.textContent = city.townHall ? currentEra.townHall : 'Pemerintahan belum dibangun';
  if (townHallEyebrowElement) townHallEyebrowElement.textContent = city.townHall ? 'PERSYARATAN ERA BERIKUTNYA' : 'AKSES PEMBANGUNAN TOWN HALL';
  if (townHallEmblemElement) townHallEmblemElement.replaceChildren(createUiIcon(city.townHall ? 'castle' : 'house', { size: 26 }));
  const townHallBuiltBadge = document.querySelector('.townhall-progress-card .built-tag');
  if (townHallBuiltBadge) {
    townHallBuiltBadge.textContent = city.townHall ? 'BUILT' : 'BELUM ADA';
    townHallBuiltBadge.classList.toggle('is-pending', !city.townHall);
  }
  townHallLevelElement.textContent = city.townHall
    ? `LEVEL ${String(city.eraIndex + 1).padStart(2, '0')} · ${currentEra.name.toUpperCase()}`
    : `JŌMON · MENUNGGU ${TOWN_HALL_POPULATION_REQUIREMENT} PENDUDUK`;
  eraDescriptionElement.textContent = city.townHall
    ? currentEra.description
    : 'Permukiman Jōmon berkembang tanpa balai pemerintahan. Kumpulkan penduduk dan bangun Town Hall setelah mencapai 50 warga.';
  upgradeRequirementsElement.innerHTML = '';
  upgradeProgressBar.style.width = `${Math.round(progress * 100)}%`;
  upgradeProgressLabel.textContent = `${Math.round(progress * 100)}%`;

  if (!city.townHall) {
    nextEraLabel.textContent = 'PERSIAPAN PUSAT PEMERINTAHAN';
    const check = checks[0];
    const row = document.createElement('div');
    row.className = `requirement ${check.ok ? 'complete' : ''}`;
    const label = document.createElement('span');
    label.textContent = check.label;
    const value = document.createElement('b');
    value.textContent = `${Math.floor(check.current).toLocaleString('id-ID')} / ${check.required.toLocaleString('id-ID')}`;
    row.append(label, value);
    upgradeRequirementsElement.append(row);
    upgradeButton.disabled = true;
    upgradeButton.textContent = 'Bangun Town Hall melalui Build';
    upgradeMessage.textContent = check.ok
      ? 'Populasi sudah cukup. Buka Build → Pusat Pemerintahan untuk memilih lokasi Town Hall.'
      : `Town Hall belum tersedia. Tambah ${Math.max(0, check.required - Math.floor(check.current))} penduduk lagi.`;
    upgradeForecastElement.textContent = 'Town Hall berukuran 2 × 2 petak dan harus menyentuh jaringan jalan permukiman. Jalan pertama menjadi akses sementara sebelum Town Hall dibangun.';
    eraRewardPreviewElement.textContent = 'Setelah Town Hall berdiri, persyaratan peningkatan era akan aktif.';
    return;
  }

  if (!nextEra) {
    nextEraLabel.textContent = 'ERA REIWA TERCAPAI';
    const row = document.createElement('div');
    row.className = 'requirement complete';
    row.innerHTML = '<span>Semua era telah terbuka</span><b>✓</b>';
    upgradeRequirementsElement.append(row);
    upgradeButton.disabled = true;
    upgradeButton.textContent = 'Era terakhir tercapai';
    upgradeMessage.textContent = 'Kota modernmu sudah mencapai era Reiwa.';
    upgradeForecastElement.textContent = 'Semua era telah terbuka. Nikmati pembangunan dan pengelolaan kota modernmu.';
    eraRewardPreviewElement.textContent = 'Tidak ada bonus era berikutnya.';
    return;
  }

  nextEraLabel.textContent = `MENUJU ${nextEra.name.toUpperCase()} · ${String(nextEra.uiMaterial ?? 'MATERIAL').toUpperCase()}`;
  const nextReward = nextEra.eraReward ?? {};
  const rewardPreview = [
    nextReward.money > 0 ? `+${formatYen(nextReward.money)}` : '',
    nextReward.food > 0 ? `+${nextReward.food} pangan` : '',
    nextReward.wood > 0 ? `+${nextReward.wood} kayu` : '',
    nextReward.stone > 0 ? `+${nextReward.stone} batu` : '',
    nextReward.iron > 0 ? `+${nextReward.iron} besi` : ''
  ].filter(Boolean).join(' · ');
  eraRewardPreviewElement.textContent = rewardPreview ? `Bonus saat tiba di era baru: ${rewardPreview}` : 'Tidak ada bonus tambahan untuk era ini.';
  for (const check of checks) {
    const row = document.createElement('div');
    row.className = `requirement ${check.ok ? 'complete' : ''}`;
    const label = document.createElement('span');
    label.textContent = check.label;
    const value = document.createElement('b');
    value.textContent = check.ok
      ? '✓'
      : `${Math.floor(check.current).toLocaleString('id-ID')} / ${check.required.toLocaleString('id-ID')}`;
    row.append(label, value);
    upgradeRequirementsElement.append(row);
  }

  upgradeButton.disabled = !ready;
  upgradeButton.textContent = `Upgrade Town Hall · ${nextEra.name}`;
  upgradeMessage.textContent = ready
    ? `Persyaratan terpenuhi. Kota siap memasuki era ${nextEra.name}.`
    : `Penuhi kebutuhan kota untuk membuka era ${nextEra.name}.`;

  if (ready) {
    upgradeForecastElement.textContent = 'Siap naik zaman! Semua target sudah tercapai.';
  } else {
    const moneyEta = forecast.moneyCycles === null ? 'kas perlu pemasukan' : `${forecast.moneyCycles} siklus kas`;
    const populationEta = forecast.populationCycles === null ? 'pertumbuhan warga tertahan' : `${forecast.populationCycles} siklus warga`;
    const blockedResources = Object.entries(forecast.resourceCycles ?? {})
      .filter(([, cycles]) => cycles === null)
      .map(([key]) => ({ food: 'pangan', wood: 'kayu', stone: 'batu', iron: 'besi', eggs: 'telur', meat: 'daging' })[key] ?? key);
    const resourceEta = blockedResources.length
      ? `produksi belum aktif: ${blockedResources.join(', ')}`
      : 'stok resource sedang dikumpulkan';
    const range = forecast.minCycles === null
      ? 'belum bisa diperkirakan'
      : `sekitar ${forecast.minCycles} siklus`;
    upgradeForecastElement.textContent = `Perkiraan ${range} (1 siklus = 5 menit): ${moneyEta}, ${populationEta}, ${resourceEta}. Resource yang belum terbuka di era ini belum diwajibkan.`;
  }
}

function canAffordBuilding(item) {
  if (city.money < item.cost) return false;
  const resourceCost = city.getResourceCost(item);
  return Object.entries(resourceCost).every(([key, amount]) => (city.resources[key] ?? 0) >= amount);
}

function getBuildingStatus(item) {
  const unlocked = item.unlockEra <= city.eraIndex;
  const residentialLimitReached = item.category === 'residential' && city.getResidentialCount() >= city.getResidentialLimit();
  const resourceSiteSlots = city.getAvailableResourceSiteCount(item.id);
  const resourceSitesUnavailable = resourceSiteSlots !== null && resourceSiteSlots <= 0;
  const affordable = canAffordBuilding(item);
  return {
    unlocked,
    residentialLimitReached,
    resourceSiteSlots,
    resourceSitesUnavailable,
    affordable,
    canSelect: unlocked && !residentialLimitReached && !resourceSitesUnavailable
  };
}

function updateResourceSiteOverlay() {
  if (!resourceSiteOverlay) return;
  if (buildMode && selectedBuildingId && RESOURCE_EXTRACTORS[selectedBuildingId]) {
    resourceSiteOverlay.showForBuilding(selectedBuildingId, city);
  } else {
    resourceSiteOverlay.hide();
  }
}

function updateBuildCategoryRail(visibleBuildings) {
  const townHallStatus = city.getTownHallBuildStatus();
  for (const key of BUILD_CATEGORY_KEYS) {
    const button = buildCategoryRail?.querySelector(`[data-build-category="${key}"]`);
    if (!button) continue;
    const countElement = button.querySelector('small');
    const isPlanned = PLANNED_BUILD_CATEGORY_KEYS.includes(key);
    let countLabel = '0';
    let unlockedCount = 0;
    button.disabled = isPlanned;
    button.setAttribute('aria-disabled', String(isPlanned));
    button.classList.toggle('is-planned', isPlanned);
    if (isPlanned) {
      countLabel = 'NANTI';
      if (countElement) countElement.textContent = countLabel;
      button.classList.remove('is-selected', 'is-locked');
      button.setAttribute('aria-pressed', 'false');
      continue;
    }
    if (key === 'townhall') {
      countLabel = townHallStatus.exists ? '✓' : (townHallStatus.canSelect ? 'SIAP' : 'KUNCI');
      unlockedCount = townHallStatus.canSelect ? 1 : 0;
    } else {
      const items = visibleBuildings.filter((item) => item.category === key);
      unlockedCount = items.filter((item) => getBuildingStatus(item).unlocked).length;
      countLabel = `${unlockedCount}/${items.length}`;
    }
    if (countElement) countElement.textContent = countLabel;
    button.classList.toggle('is-selected', selectedBuildCategory === key);
    button.classList.toggle('is-locked', unlockedCount === 0 && key !== 'townhall');
    button.setAttribute('aria-pressed', String(selectedBuildCategory === key));
  }
}

function renderBuildingMenu() {
  buildingList.innerHTML = '';
  const visibleEra = Math.min(city.eraIndex + 1, ERAS.length - 1);
  const visibleBuildings = getAvailableBuildings(visibleEra);
  const availableTypes = visibleBuildings.filter((item) => item.unlockEra <= city.eraIndex).length;
  $('#build-tab-count').textContent = String(availableTypes);
  $('#build-available-label').textContent = `${availableTypes} JENIS TERBUKA`;
  updateBuildCategoryRail(visibleBuildings);

  if (!selectedBuildCategory || !BUILD_CATEGORY_KEYS.includes(selectedBuildCategory)) {
    buildSelectionHint.textContent = 'Pilih salah satu kategori di atas. Daftar bangunan akan muncul di sini; belum ada objek yang dipilih sampai kamu menekan kartunya.';
    const empty = document.createElement('div');
    empty.className = 'build-empty-state';
    const emptyIcon = document.createElement('span');
    emptyIcon.className = 'build-empty-icon';
    emptyIcon.append(createUiIcon('house', { size: 28 }));
    const emptyTitle = document.createElement('strong');
    emptyTitle.textContent = 'Pilih kategori pembangunan';
    const emptyDescription = document.createElement('small');
    emptyDescription.textContent = 'Pilih Town Hall, Hunian, Infrastruktur, atau kategori lain untuk melihat bangunan.';
    empty.append(emptyIcon, emptyTitle, emptyDescription);
    buildingList.append(empty);
    return;
  }

  if (selectedBuildCategory === 'townhall') {
    buildSelectionHint.textContent = 'Pusat pemerintahan tersedia setelah permukiman mencapai 50 penduduk. Pilih kartu Town Hall untuk memulai penempatan.';
    const section = document.createElement('section');
    section.className = 'build-category build-category-results';
    const heading = document.createElement('div');
    heading.className = 'category-label';
    heading.textContent = 'PUSAT PEMERINTAHAN';
    const status = city.getTownHallBuildStatus();
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `townhall-build-card${status.canSelect ? ' is-unlocked' : ' is-locked'}`;
    card.dataset.building = 'townhall';
    card.disabled = !status.canSelect || status.exists;
    card.setAttribute('aria-label', status.exists ? 'Town Hall sudah dibangun' : `Bangun Town Hall setelah ${TOWN_HALL_POPULATION_REQUIREMENT} penduduk`);
    const icon = document.createElement('span');
    icon.className = 'build-icon';
    icon.dataset.thumbnail = String(BUILDING_CARD_THUMBNAILS.townhall);
    icon.style.backgroundImage = 'url(/images/building-thumbnails.webp)';
    icon.style.backgroundSize = '600% 100%';
    icon.style.backgroundPosition = '0% 50%';
    icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'townhall-build-copy';
    const name = document.createElement('strong');
    name.textContent = status.exists ? ERAS[city.eraIndex].townHall : 'Town Hall';
    const meta = document.createElement('small');
    meta.textContent = status.exists
      ? `${ERAS[city.eraIndex].name} · pusat perkembangan era`
      : `Dibuka setelah ${TOWN_HALL_POPULATION_REQUIREMENT} penduduk · ${status.population}/${TOWN_HALL_POPULATION_REQUIREMENT}`;
    copy.append(name, meta);
    const badge = document.createElement('span');
    badge.className = 'townhall-build-status';
    badge.textContent = status.exists ? 'SUDAH DIBANGUN' : (status.canSelect ? 'SIAP DIBANGUN' : 'TERKUNCI');
    card.append(icon, copy, badge);
    section.append(heading, card);
    buildingList.append(section);
    return;
  }

  const category = CATEGORY_GROUPS.find(([key]) => key === selectedBuildCategory);
  const items = visibleBuildings.filter((item) => item.category === selectedBuildCategory);
  buildSelectionHint.textContent = items.length
    ? `${category?.[1] ?? 'BANGUNAN'} · Pilih satu kartu untuk melihat preview penempatan di peta. Bangunan yang belum terbuka atau kekurangan resource akan ditandai.`
    : 'Belum ada bangunan dalam kategori ini pada era sekarang. Kategori akan terisi saat perkembangan zaman membuka jenis bangunan baru.';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'build-empty-state is-locked';
    empty.innerHTML = '<span aria-hidden="true">🔒</span><strong>Belum tersedia di era ini</strong><small>Lanjutkan perkembangan kota untuk membuka kategori ini.</small>';
    buildingList.append(empty);
    return;
  }

  const section = document.createElement('section');
  section.className = 'build-category build-category-results';
  const heading = document.createElement('div');
  heading.className = 'category-label';
  heading.textContent = category?.[1] ?? selectedBuildCategory.toUpperCase();
  if (selectedBuildCategory === 'residential') {
    const capacity = document.createElement('span');
    capacity.textContent = `${city.getResidentialCount()} / ${city.getResidentialLimit()} HUNIAN · ${city.getPopulation()} WARGA`;
    heading.append(capacity);
  }
  section.append(heading);
  const grid = document.createElement('div');
  grid.className = 'build-grid';
  for (const item of items) {
    const status = getBuildingStatus(item);
    const count = city.getCountByType(item.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `build-option${selectedBuildingId === item.id ? ' is-selected' : ''}${status.unlocked ? '' : ' is-locked'}`;
    button.dataset.building = item.id;
    button.disabled = !status.canSelect;
    const icon = document.createElement('span');
    icon.className = 'build-icon';
    const thumbnailIndex = BUILDING_CARD_THUMBNAILS[item.id];
    if (Number.isInteger(thumbnailIndex)) {
      icon.dataset.thumbnail = String(thumbnailIndex);
      icon.style.backgroundImage = 'url(/images/building-thumbnails.webp)';
      icon.style.backgroundSize = '600% 100%';
      icon.style.backgroundPosition = `${thumbnailIndex * 20}% 50%`;
      icon.setAttribute('aria-hidden', 'true');
    } else {
      icon.append(createUiIcon(BUILDING_ICON_BY_ID[item.id] ?? 'building', { size: 23 }));
    }
    const copy = document.createElement('span');
    copy.className = 'build-copy';
    const name = document.createElement('b');
    name.textContent = item.id === RESIDENTIAL_BUILDING_ID ? 'Rumah' : item.short;
    const detail = document.createElement('small');
    if (!status.unlocked) detail.textContent = `Terbuka: ${ERAS[item.unlockEra].name}`;
    else if (status.residentialLimitReached) detail.textContent = 'Batas hunian tercapai';
    else if (status.resourceSitesUnavailable) detail.textContent = 'Semua lokasi sumber daya telah terpakai';
    else if (item.id === RESIDENTIAL_BUILDING_ID) {
      detail.textContent = `${formatYen(item.cost)} · ${getResidentialEraName(city.eraIndex)} · kapasitas ${getResidentialEraBaseCapacity(city.eraIndex)} jiwa`;
    } else {
      const extractor = RESOURCE_EXTRACTORS[item.id];
      const locationText = extractor
        ? `${RESOURCE_SITE_TYPES[extractor.siteType].label} · ${status.resourceSiteSlots} titik`
        : (status.affordable ? 'Siap dibangun' : 'Resource kurang');
      detail.textContent = `${formatYen(item.cost)} · ${locationText}`;
    }
    const meta = document.createElement('span');
    meta.className = 'build-meta';
    const amount = document.createElement('span');
    amount.textContent = `${count} dibangun`;
    const resourceCost = city.getResourceCost(item);
    const resources = document.createElement('span');
    resources.textContent = status.unlocked ? formatResourceCost(resourceCost) : 'LOCKED';
    copy.append(name, detail, meta);
    meta.append(amount, resources);
    button.append(icon, copy);
    grid.append(button);
  }
  section.append(grid);
  buildingList.append(section);
}

function updateTutorialCompanion() {
  if (!city || !tutorialCompanion || !tutorialMessageElement) return;
  let stepIndex = 0;
  let stage = 'AKSES KOTA';
  let title = 'Buka jalan untuk permukiman';
  let message = STARTER_TUTORIAL_GOALS[0].message;
  const nextGoalIndex = STARTER_TUTORIAL_GOALS.findIndex((goal) => city.getCountByType(goal.type) < goal.target);

  if (nextGoalIndex >= 0) {
    const goal = STARTER_TUTORIAL_GOALS[nextGoalIndex];
    stepIndex = nextGoalIndex;
    stage = goal.stage;
    title = goal.title;
    message = goal.message;
    const count = Math.min(goal.target, city.getCountByType(goal.type));
    if (count > 0) message = `${message} Progres: ${count}/${goal.target}.`;
  } else if (!city.townHall) {
    stepIndex = 4;
    stage = city.getPopulation() >= TOWN_HALL_POPULATION_REQUIREMENT ? 'PUSAT PEMERINTAHAN' : 'PERTUMBUHAN WARGA';
    title = city.getPopulation() >= TOWN_HALL_POPULATION_REQUIREMENT ? 'Town Hall siap dibangun' : 'Kembangkan permukiman';
    message = city.getPopulation() >= TOWN_HALL_POPULATION_REQUIREMENT
      ? 'Populasi sudah cukup. Buka Build → Town Hall, lalu tempatkan balai pada lahan kosong yang menyentuh jaringan jalan.'
      : `Permukiman awal selesai. Kembangkan hunian dan produksi sampai mencapai ${TOWN_HALL_POPULATION_REQUIREMENT} penduduk. Sekarang ada ${city.getPopulation()} warga.`;
  } else {
    stepIndex = 5;
    stage = 'PERKEMBANGAN ERA';
    title = 'Bawa kota menuju zaman berikutnya';
    const status = city.getEraUpgradeStatus();
    const missing = (status.checks ?? []).filter((check) => !check.ok);
    message = missing.length
      ? `Untuk membuka era ${ERAS[Math.min(city.eraIndex + 1, ERAS.length - 1)].name}, penuhi ${missing[0].label.toLowerCase()}. Lihat panel Stats untuk seluruh kebutuhan dan progresnya.`
      : 'Semua syarat era berikutnya terpenuhi. Buka Stats dan lakukan upgrade Town Hall untuk melanjutkan sejarah kota.';
  }

  const missionMode = Boolean(city.townHall);
  tutorialCompanion.classList.toggle('is-mission-mode', missionMode);
  const emblemButton = $('#tutorial-mask-toggle');
  if (emblemButton) {
    emblemButton.setAttribute('aria-label', missionMode ? 'Buka misi: syarat era berikutnya' : 'Buka tutorial awal');
    emblemButton.setAttribute('title', missionMode ? 'Misi Era Berikutnya' : 'Tutorial Daimyo');
  }
  if (missionMode && tutorialWasCollapsed === false) {
    tutorialWasCollapsed = true;
    tutorialCompanion.classList.add('is-collapsed');
    emblemButton?.setAttribute('aria-expanded', 'false');
    $('#tutorial-collapse-button')?.setAttribute('aria-label', 'Buka misi');
  }

  const stageText = missionMode ? 'MISI ERA BERIKUTNYA' : `LANGKAH ${String(stepIndex + 1).padStart(2, '0')} · ${stage}`;
  const previousMessage = tutorialMessageElement.textContent;
  if (previousMessage !== message) {
    tutorialMessageElement.classList.remove('is-entering');
    tutorialMessageElement.textContent = message;
    void tutorialMessageElement.offsetWidth;
    tutorialMessageElement.classList.add('is-entering');
  }
  tutorialStageElement.textContent = stageText;
  tutorialProgressElement.textContent = missionMode ? 'ERA' : `${String(stepIndex + 1).padStart(2, '0')} / 06`;
  const titleElement = $('#tutorial-guide-title');
  if (titleElement) titleElement.textContent = missionMode ? 'Misi perkembangan era' : title;
}

function resetTutorialCompanion() {
  tutorialWasCollapsed = true;
  tutorialTipIndex = -1;
  tutorialCompanion?.classList.add('is-collapsed');
  tutorialCompanion?.classList.remove('is-mission-mode');
  $('#tutorial-mask-toggle')?.setAttribute('aria-expanded', 'false');
  $('#tutorial-mask-toggle')?.setAttribute('aria-label', 'Buka tutorial awal');
  $('#tutorial-mask-toggle')?.setAttribute('title', 'Tutorial Daimyo');
  $('#tutorial-collapse-button')?.setAttribute('aria-label', 'Buka panduan');
  if (tutorialExtraTipElement) {
    tutorialExtraTipElement.hidden = true;
    tutorialExtraTipElement.textContent = '';
    tutorialExtraTipElement.classList.remove('is-entering');
  }
}

function toggleTutorialCompanion() {
  if (!tutorialCompanion) return;
  tutorialWasCollapsed = !tutorialWasCollapsed;
  tutorialCompanion.classList.toggle('is-collapsed', tutorialWasCollapsed);
  $('#tutorial-mask-toggle')?.setAttribute('aria-expanded', String(!tutorialWasCollapsed));
  $('#tutorial-collapse-button')?.setAttribute('aria-label', tutorialWasCollapsed ? 'Buka panduan' : 'Ringkas panduan');
}

function handleTutorialEmblemClick() {
  if (!city) return;
  if (city.townHall) {
    setActiveTab('stats', false);
    requestAnimationFrame(() => {
      upgradeRequirementsElement?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      upgradeRequirementsElement?.classList.add('is-mission-focus');
      window.setTimeout(() => upgradeRequirementsElement?.classList.remove('is-mission-focus'), 1500);
    });
    showToast('Misi era berikutnya: periksa semua persyaratan dan progres di panel Stats.', 'info');
    return;
  }
  toggleTutorialCompanion();
}

function showNextTutorialTip() {
  tutorialTipIndex = (tutorialTipIndex + 1) % TUTORIAL_EXTRA_TIPS.length;
  tutorialExtraTipElement.textContent = TUTORIAL_EXTRA_TIPS[tutorialTipIndex];
  tutorialExtraTipElement.hidden = false;
  tutorialExtraTipElement.classList.remove('is-entering');
  void tutorialExtraTipElement.offsetWidth;
  tutorialExtraTipElement.classList.add('is-entering');
}

function formatCompactNumber(value) {
  return Math.floor(Number(value) || 0).toLocaleString('id-ID');
}

function updateResourceQuickHUD() {
  if (!city) return;
  $('#hud-money').textContent = formatYen(city.money).replace(/^¥\s*/, '');
  for (const key of Object.keys(RESOURCE_TREND_META)) {
    const value = formatCompactNumber(city.resources[key] ?? 0);
    const element = $(`#hud-resource-${key}`);
    if (element) element.textContent = value;
  }
}

function updateCitySummaryPanel() {
  if (!city) return;
  const population = $('[data-city-mirror="population"]');
  const roads = $('[data-city-mirror="roads"]');
  const money = $('[data-city-mirror="money"]');
  const progress = $('[data-city-mirror="era-progress"]');
  const progressBar = $('#city-summary-progress-bar');
  const nextEraLabel = $('#city-summary-next-era');
  if (population) population.textContent = city.getPopulation().toLocaleString('id-ID');
  if (money) money.textContent = formatYen(city.money);
  const roadNetwork = city.getRoadNetworkSummary();
  if (roads) roads.textContent = roadNetwork.connectedRoads > 0
    ? `${roadNetwork.connectedRoads}/${roadNetwork.totalRoads} terhubung`
    : 'Belum terhubung';
  const upgrade = getUpgradeStatus();
  const percent = Math.round((upgrade.progress ?? 0) * 100);
  if (progress) progress.textContent = `${percent}%`;
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (nextEraLabel) nextEraLabel.textContent = upgrade.nextEra ? `Menuju ${upgrade.nextEra.name}` : 'Era terakhir tercapai';
  const notificationCount = roadNetwork.disconnectedRoads + roadNetwork.disconnectedExtractors + roadNetwork.disconnectedTransportBuildings;
  const notification = $('#quick-notification-count');
  if (notification) {
    notification.hidden = notificationCount <= 0;
    notification.textContent = notificationCount > 9 ? '9+' : String(notificationCount);
  }
}

function renderCityMinimap() {
  const canvas = $('#city-minimap');
  if (!canvas || !city) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  const pad = 8;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#174a66';
  context.fillRect(0, 0, width, height);

  // Decorative island silhouette; all road/building markers are live city data.
  context.beginPath();
  context.moveTo(23, 22); context.quadraticCurveTo(44, 8, 73, 13);
  context.lineTo(105, 8); context.quadraticCurveTo(133, 12, 148, 27);
  context.lineTo(190, 30); context.quadraticCurveTo(221, 45, 216, 74);
  context.lineTo(225, 110); context.quadraticCurveTo(210, 143, 177, 145);
  context.lineTo(141, 154); context.quadraticCurveTo(102, 148, 83, 155);
  context.lineTo(44, 140); context.quadraticCurveTo(15, 120, 19, 91);
  context.lineTo(8, 58); context.quadraticCurveTo(8, 34, 23, 22);
  context.closePath();
  context.fillStyle = '#668c54'; context.fill();
  context.strokeStyle = 'rgba(220,220,157,.75)'; context.lineWidth = 2; context.stroke();
  context.save();
  context.clip();
  context.strokeStyle = 'rgba(177,203,124,.26)'; context.lineWidth = 1;
  for (let index = 0; index < 5; index++) {
    context.beginPath(); context.ellipse(117, 82, 34 + index * 15, 17 + index * 10, -0.25, 0, Math.PI * 2); context.stroke();
  }
  context.beginPath(); context.moveTo(4, 126); context.bezierCurveTo(65, 114, 95, 85, 130, 91); context.bezierCurveTo(160, 99, 186, 67, 238, 60);
  context.strokeStyle = '#57b7d6'; context.lineWidth = 9; context.lineCap = 'round'; context.stroke();
  context.strokeStyle = 'rgba(204,245,249,.72)'; context.lineWidth = 1.5; context.stroke();

  const toMap = (gx, gz) => ({
    x: pad + (gx / Math.max(1, GRID_COUNT - 1)) * (width - pad * 2),
    y: pad + (gz / Math.max(1, GRID_COUNT - 1)) * (height - pad * 2)
  });
  context.lineCap = 'round';
  for (const building of city.buildings) {
    if (building.type !== 'road') continue;
    const point = toMap(building.gx, building.gz);
    context.beginPath(); context.arc(point.x, point.y, 2.2, 0, Math.PI * 2); context.fillStyle = '#e2d0a5'; context.fill();
  }
  const categoryColors = { residential: '#f0dfb3', infrastructure: '#d6c9a0', industry: '#e5bd55', commercial: '#d88a58', service: '#a6c5de', landmark: '#e7b2bb' };
  for (const building of city.buildings) {
    if (building.type === 'road') continue;
    const point = toMap(building.gx, building.gz);
    const definition = BUILDINGS.find((item) => item.id === building.type);
    context.beginPath(); context.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
    context.fillStyle = categoryColors[definition?.category] ?? '#f0e7c6'; context.fill();
    context.strokeStyle = 'rgba(25,37,30,.8)'; context.lineWidth = .8; context.stroke();
  }
  if (city.townHallGrid) {
    const point = toMap(city.townHallGrid.gx, city.townHallGrid.gz);
    context.beginPath(); context.arc(point.x, point.y, 4.1, 0, Math.PI * 2);
    context.fillStyle = '#f5d36c'; context.fill(); context.strokeStyle = '#5d3a25'; context.lineWidth = 1.3; context.stroke();
  }
  context.restore();

  if (camera?.isOrthographicCamera && controls?.target) {
    const viewWidth = (camera.right - camera.left) / Math.max(camera.zoom, 0.001);
    const viewHeight = (camera.top - camera.bottom) / Math.max(camera.zoom, 0.001);
    const center = toMap((controls.target.x + MAP_SIZE / 2) / MAP_SIZE * (GRID_COUNT - 1), (controls.target.z + MAP_SIZE / 2) / MAP_SIZE * (GRID_COUNT - 1));
    const rectWidth = Math.min(width - 18, viewWidth / MAP_SIZE * (width - pad * 2));
    const rectHeight = Math.min(height - 18, viewHeight / MAP_SIZE * (height - pad * 2));
    context.strokeStyle = 'rgba(255,255,255,.95)'; context.lineWidth = 2;
    context.strokeRect(center.x - rectWidth / 2, center.y - rectHeight / 2, rectWidth, rectHeight);
  }
}

function drawTrendChart(svg, values, color, compact = false) {
  if (!svg) return;
  const namespace = 'http://www.w3.org/2000/svg';
  const width = compact ? 160 : 320;
  const height = compact ? 38 : 86;
  const paddingX = compact ? 3 : 7;
  const paddingY = compact ? 4 : 8;
  svg.replaceChildren();

  const numbers = values.length ? values.map((value) => Number(value) || 0) : [0];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min;
  const effectiveSpan = span || Math.max(Math.abs(max) * 0.08, 1);
  const plotHeight = height - paddingY * 2;
  const plotWidth = width - paddingX * 2;
  const points = numbers.map((value, index) => ({
    x: paddingX + (numbers.length < 2 ? plotWidth / 2 : (index / (numbers.length - 1)) * plotWidth),
    y: paddingY + (span ? (1 - (value - min) / effectiveSpan) * plotHeight : plotHeight / 2)
  }));

  if (!compact) {
    for (const fraction of [0.25, 0.5, 0.75]) {
      const line = document.createElementNS(namespace, 'line');
      const y = paddingY + plotHeight * fraction;
      line.setAttribute('x1', String(paddingX));
      line.setAttribute('x2', String(width - paddingX));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.setAttribute('class', 'growth-chart-gridline');
      svg.append(line);
    }
  }

  const linePath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const area = document.createElementNS(namespace, 'path');
  area.setAttribute('d', `${linePath} L${points.at(-1).x.toFixed(2)},${(height - paddingY).toFixed(2)} L${points[0].x.toFixed(2)},${(height - paddingY).toFixed(2)} Z`);
  area.setAttribute('fill', color);
  area.setAttribute('fill-opacity', compact ? '0.11' : '0.13');
  svg.append(area);

  const line = document.createElementNS(namespace, 'path');
  line.setAttribute('d', linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', compact ? '1.8' : '2.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.append(line);

  const latest = document.createElementNS(namespace, 'circle');
  latest.setAttribute('cx', String(points.at(-1).x));
  latest.setAttribute('cy', String(points.at(-1).y));
  latest.setAttribute('r', compact ? '2.2' : '3.4');
  latest.setAttribute('fill', color);
  latest.setAttribute('stroke', 'rgba(10,14,18,.9)');
  latest.setAttribute('stroke-width', '1.5');
  svg.append(latest);
}

function renderCityGrowthDashboard() {
  if (!city) return;
  const population = getCityHistorySeries(cityHistory, 'population');
  const money = getCityHistorySeries(cityHistory, 'money');
  const snapshots = cityHistory.snapshots;
  const latestPopulation = population.at(-1) ?? city.getPopulation();
  const latestMoney = money.at(-1) ?? city.money;
  const startPopulation = population[0] ?? latestPopulation;
  const startMoney = money[0] ?? latestMoney;

  $('#growth-history-count').textContent = `SESI INI · ${snapshots.length} TITIK`;
  $('#population-trend-change').textContent = `${formatCompactNumber(latestPopulation)} jiwa (${latestPopulation - startPopulation >= 0 ? '+' : ''}${formatCompactNumber(latestPopulation - startPopulation)})`;
  $('#money-trend-change').textContent = formatYen(latestMoney);
  $('#population-trend-start').textContent = `${formatCompactNumber(startPopulation)} jiwa`;
  $('#money-trend-start').textContent = formatYen(startMoney);
  drawTrendChart($('#population-trend-chart'), population, '#a9d6b8');
  drawTrendChart($('#money-trend-chart'), money, '#e2c58b');

  for (const [key, meta] of Object.entries(RESOURCE_TREND_META)) {
    const series = getCityHistorySeries(cityHistory, `resource.${key}`);
    const current = Math.floor(city.resources[key] ?? 0);
    $(`#trend-${key}-value`).textContent = formatCompactNumber(current);
    drawTrendChart($(`#trend-${key}-chart`), series, meta.color, true);
  }
}

function sampleCityGrowth(now = Date.now(), force = false) {
  if (!city) return;
  const recorded = recordCityHistory(cityHistory, city, { timestamp: now, minIntervalMs: 15_000, force });
  if (recorded) renderCityGrowthDashboard();
}

function renderHUD() {
  const era = ERAS[city.eraIndex];
  updateResourceQuickHUD();
  sampleCityGrowth(Date.now());
  eraNameElement.textContent = `${era.name.toUpperCase()} PERIOD`;
  const eraNumberElement = $('#world-era-number');
  if (eraNumberElement) eraNumberElement.textContent = `ERA ${city.eraIndex + 1}`;
  dockEraElement.textContent = `${era.name.toUpperCase()} · LV. ${String(city.eraIndex + 1).padStart(2, '0')}`;
  populationElement.textContent = city.getPopulation().toLocaleString('id-ID');
  budgetElement.textContent = formatYen(city.money);
  $('#resource-food').textContent = Math.floor(city.resources.food).toLocaleString('id-ID');
  $('#resource-wood').textContent = Math.floor(city.resources.wood).toLocaleString('id-ID');
  $('#resource-stone').textContent = Math.floor(city.resources.stone).toLocaleString('id-ID');
  $('#resource-iron').textContent = Math.floor(city.resources.iron).toLocaleString('id-ID');
  $('#resource-eggs').textContent = Math.floor(city.resources.eggs ?? 0).toLocaleString('id-ID');
  $('#resource-meat').textContent = Math.floor(city.resources.meat ?? 0).toLocaleString('id-ID');
  const roadNetwork = city.getRoadNetworkSummary();
  roadNetworkStatusElement.textContent = roadNetwork.connectedRoads > 0
    ? `${roadNetwork.connectedRoads} / ${roadNetwork.totalRoads} ruas jalan terhubung`
    : (city.townHall ? 'Belum ada jalan terhubung ke Town Hall' : 'Belum ada jalan akses permukiman');
  roadNetworkDetailElement.textContent = `${roadNetwork.connectedExtractors} fasilitas mengirim resource · ${roadNetwork.disconnectedExtractors} menunggu akses jalan`;
  const activeTransportNodes = roadNetwork.connectedTransportBuildings;
  const totalTransportNodes = roadNetwork.totalTransportBuildings;
  transportNetworkStatusElement.textContent = totalTransportNodes
    ? `${activeTransportNodes} / ${totalTransportNodes} terminal aktif`
    : 'Belum ada terminal';
  passengerThroughputElement.textContent = `${roadNetwork.passengerThroughput} warga / 5 menit`;
  cargoThroughputElement.textContent = `+${roadNetwork.cargoEfficiencyPercent}%`;
  transportNetworkDetailElement.textContent = `${roadNetwork.connectedPassengerTerminals} terminal penumpang aktif · ${roadNetwork.connectedCargoTerminals} terminal kargo aktif`;
  const warningCount = roadNetwork.disconnectedRoads + roadNetwork.disconnectedExtractors + roadNetwork.disconnectedTransportBuildings;
  networkWarning.hidden = warningCount <= 0;
  if (warningCount > 0) {
    const warningParts = [];
    if (roadNetwork.disconnectedRoads > 0) warningParts.push(`${roadNetwork.disconnectedRoads} ruas jalan`);
    if (roadNetwork.disconnectedExtractors > 0) warningParts.push(`${roadNetwork.disconnectedExtractors} fasilitas`);
    if (roadNetwork.disconnectedTransportBuildings > 0) warningParts.push(`${roadNetwork.disconnectedTransportBuildings} terminal`);
    networkWarningDetail.textContent = warningParts.join(' · ') + ' perlu akses jalan';
  }
  renderUpgradePanel();
  renderEconomyPanel();
  updateCitySummaryPanel();
  // Minimap is intentionally hidden in the current HUD; avoid repainting its canvas every HUD update.
  if (activeTab === 'build') renderBuildingMenu();
  updateTutorialCompanion();
  updateToolUI();
  updateBuildActionButton();
}

function syncOverlayLayoutState() {
  const dockVisible = !dockPopover.hidden;
  const inspectorVisible = !buildingInspector.hidden;
  gameUI.classList.toggle('has-open-dock', dockVisible);
  gameUI.classList.toggle('has-open-inspector', inspectorVisible);
  gameUI.classList.toggle('is-build-panel-open', dockVisible && activeTab === 'build');
}

function finishDockClose() {
  if (dockCloseTimer) {
    window.clearTimeout(dockCloseTimer);
    dockCloseTimer = null;
  }
  if (dockTransitionHandler) {
    dockPopover.removeEventListener('transitionend', dockTransitionHandler);
    dockTransitionHandler = null;
  }
  dockPopover.hidden = true;
  dockPopover.classList.remove('is-open', 'is-closing');
  dockPopover.setAttribute('aria-hidden', 'true');
  syncOverlayLayoutState();
}

function closeControlPanel() {
  activeTab = null;
  document.querySelectorAll('[data-panel]').forEach((button) => {
    button.classList.remove('is-active');
    button.setAttribute('aria-expanded', 'false');
  });

  if (dockPopover.hidden || dockPopover.classList.contains('is-closing')) return;

  dockPopover.classList.remove('is-open');
  dockPopover.classList.add('is-closing');
  dockPopover.setAttribute('aria-hidden', 'true');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishDockClose();
    return;
  }

  if (dockTransitionHandler) dockPopover.removeEventListener('transitionend', dockTransitionHandler);
  dockTransitionHandler = (event) => {
    if (event.target !== dockPopover || event.propertyName !== 'transform') return;
    if (dockPopover.classList.contains('is-closing')) finishDockClose();
  };
  dockPopover.addEventListener('transitionend', dockTransitionHandler);
  dockCloseTimer = window.setTimeout(() => {
    if (dockPopover.classList.contains('is-closing')) finishDockClose();
  }, 400);
}

function setActiveTab(tab, toggle = false) {
  const isSameOpenPanel = activeTab === tab && !dockPopover.hidden && !dockPopover.classList.contains('is-closing');
  if (toggle && isSameOpenPanel) {
    closeControlPanel();
    return;
  }

  if (dockCloseTimer) {
    window.clearTimeout(dockCloseTimer);
    dockCloseTimer = null;
  }
  if (dockTransitionHandler) {
    dockPopover.removeEventListener('transitionend', dockTransitionHandler);
    dockTransitionHandler = null;
  }
  const shouldAnimateOpen = dockPopover.hidden || dockPopover.classList.contains('is-closing');
  activeTab = tab;
  dockPopover.hidden = false;
  dockPopover.classList.remove('is-closing');
  dockPopover.setAttribute('aria-hidden', 'false');
  syncOverlayLayoutState();
  if (shouldAnimateOpen) {
    dockPopover.classList.remove('is-open');
    // Read layout once so the next frame can interpolate from the closed state.
    void dockPopover.offsetWidth;
    requestAnimationFrame(() => {
      if (!dockPopover.hidden && !dockPopover.classList.contains('is-closing')) {
        dockPopover.classList.add('is-open');
      }
    });
  } else {
    dockPopover.classList.add('is-open');
  }

  const titles = { stats: 'Stats', build: 'Build', settings: 'Pengaturan' };
  dockPanelTitle.textContent = titles[tab] ?? 'Menu';

  for (const button of document.querySelectorAll('[data-panel]')) {
    const active = button.dataset.panel === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-expanded', String(active));
  }

  statsView.classList.toggle('is-active', tab === 'stats');
  statsView.hidden = tab !== 'stats';
  buildView.classList.toggle('is-active', tab === 'build');
  buildView.hidden = tab !== 'build';
  settingsView.classList.toggle('is-active', tab === 'settings');
  settingsView.hidden = tab !== 'settings';

  // Floating surfaces are mutually exclusive. On narrow screens the dock and
  // inspector share the same safe area, so finish the outgoing close before the
  // incoming panel starts its own entrance animation.
  if (!buildingInspector.hidden || buildingInspector.classList.contains('is-closing')) {
    inspectedBuilding = null;
    finishInspectorClose();
    updateBuildingHighlight(hoveredBuilding);
  }

  if (tab === 'build') {
    if (!selectedBuildCategory) selectedBuildCategory = 'townhall';
    cancelCameraFocus();
    hoveredBuilding = null;
    updateBuildingHighlight(null);
    buildMode = Boolean(selectedBuildingId && buildMode);
    renderBuildingMenu();
  } else {
    buildMode = false;
    if (preview) preview.visible = false;
  }
  updateResourceSiteOverlay();
  updateToolUI();
}

function updateToolUI() {
  const item = BUILDINGS.find((building) => building.id === selectedBuildingId);
  const itemDisplayName = item?.id === RESIDENTIAL_BUILDING_ID ? getResidentialEraName(city.eraIndex) : item?.name;
  if (buildMode && selectedBuildingId === 'townhall') {
    selectedToolLabel.textContent = 'Town Hall · tapak 2 × 2';
    pointerStatus.classList.add('is-building');
    pointerStatusText.textContent = `MODE BANGUN · Town Hall · harus memiliki ${TOWN_HALL_POPULATION_REQUIREMENT} penduduk dan menyentuh jalan terhubung · klik kiri tempatkan · klik kanan batal`;
    if (renderer) renderer.domElement.style.cursor = 'crosshair';
  } else if (buildMode && item) {
    const extractor = RESOURCE_EXTRACTORS[item.id];
    selectedToolLabel.textContent = extractor
      ? `${itemDisplayName} · ${extractor.locationHint.toLowerCase()}`
      : `${itemDisplayName} · klik tanah untuk membangun`;
    pointerStatus.classList.add('is-building');
    pointerStatusText.textContent = extractor
      ? `MODE BANGUN · ${itemDisplayName} · zona ${RESOURCE_SITE_TYPES[extractor.siteType].label.toLowerCase()} disorot · tahan klik kiri + geser untuk menggeser peta · klik kiri tempatkan · klik kanan batal`
      : `MODE BANGUN · ${itemDisplayName} · Tahan klik kiri + geser untuk menggeser peta · klik kiri tempatkan · klik kanan batal`;
    if (renderer) renderer.domElement.style.cursor = 'crosshair';
  } else {
    selectedToolLabel.textContent = 'Select / Inspect';
    pointerStatus.classList.remove('is-building');
    pointerStatusText.textContent = 'MODE INSPEKSI · Tahan klik kiri + geser untuk menggeser peta · klik kiri pilih bangunan · klik kanan tutup / batal';
    if (renderer) renderer.domElement.style.cursor = hoveredBuilding ? 'pointer' : 'grab';
  }
}

function selectBuilding(id) {
  if (id === 'townhall') {
    const status = city.getTownHallBuildStatus();
    if (!status.canSelect || status.exists) {
      showToast(status.reason || 'Town Hall belum dapat dipilih.', 'warning');
      return;
    }
    selectedBuildingId = 'townhall';
    selectedBuildCategory = 'townhall';
  } else {
    const item = BUILDINGS.find((building) => building.id === id);
    if (!item) return;
    const status = getBuildingStatus(item);
    if (!status.canSelect) {
      const message = status.residentialLimitReached
        ? `Kapasitas hunian ${city.getResidentialLimit()} sudah penuh.`
        : (!status.unlocked
          ? `Bangunan terbuka pada era ${ERAS[item.unlockEra].name}.`
          : (status.resourceSitesUnavailable
            ? 'Semua lokasi sumber daya untuk bangunan ini sudah digunakan.'
            : 'Resource belum mencukupi untuk bangunan ini.'));
      showToast(message, 'warning');
      return;
    }
    selectedBuildingId = id;
    selectedBuildCategory = item.category;
  }

  // Select first; the large Bangun button confirms placement mode.
  buildMode = false;
  if (preview) preview.visible = false;
  updateResourceSiteOverlay();
  if (activeTab !== 'build') setActiveTab('build', false);
  renderBuildingMenu();
  updateToolUI();
  updateBuildActionButton();
  const item = BUILDINGS.find((building) => building.id === id);
  const name = id === 'townhall' ? 'Town Hall' : (item?.id === RESIDENTIAL_BUILDING_ID ? getResidentialEraName(city.eraIndex) : item?.name);
  showToast(`${name} dipilih. Tekan tombol Bangun untuk mulai menempatkan di kota.`, 'success');
}

function activateSelectedBuilding() {
  if (!selectedBuildingId) {
    setActiveTab('build', false);
    showToast('Pilih kartu bangunan terlebih dahulu.', 'info');
    return;
  }

  if (selectedBuildingId === 'townhall') {
    const status = city.getTownHallBuildStatus();
    if (!status.canSelect || status.exists) {
      showToast(status.reason || 'Town Hall belum dapat dibangun.', 'warning');
      return;
    }
    buildMode = true;
    if (preview) {
      preview.scale.set(TOWN_HALL_FOOTPRINT_SIZE, 1, TOWN_HALL_FOOTPRINT_SIZE);
      preview.visible = false;
      preview.material.color.setHex(0x89d7a1);
    }
    updateResourceSiteOverlay();
    updateToolUI();
    updateBuildActionButton();
    showToast('Mode penempatan Town Hall aktif. Pilih lahan kosong 2 × 2 yang menyentuh jalan.');
    return;
  }

  const item = BUILDINGS.find((building) => building.id === selectedBuildingId);
  if (!item) return;
  const status = getBuildingStatus(item);
  if (!status.canSelect) {
    showToast('Bangunan ini tidak lagi memenuhi syarat. Pilih bangunan lain.', 'warning');
    selectedBuildingId = null;
    buildMode = false;
    renderBuildingMenu();
    updateBuildActionButton();
    return;
  }
  buildMode = true;
  if (preview) {
    preview.material.color.setHex(item.id === 'road' ? 0xd7dfe0 : 0x89d7a1);
    preview.visible = false;
  }
  updateResourceSiteOverlay();
  updateToolUI();
  updateBuildActionButton();
  const name = item.id === RESIDENTIAL_BUILDING_ID ? getResidentialEraName(city.eraIndex) : item.name;
  showToast(`Mode penempatan ${name} aktif. Klik lahan untuk membangun.`);
}

function updateBuildActionButton() {
  const button = $('#build-action-button');
  if (!button) return;
  const label = button.querySelector('strong');
  const hint = $('#build-action-hint');
  const selected = Boolean(selectedBuildingId);
  button.classList.toggle('is-placement-active', buildMode);
  button.disabled = !buildMode && !selected;
  button.setAttribute('aria-disabled', String(button.disabled));
  button.setAttribute('aria-label', buildMode ? 'Batalkan mode penempatan' : (selected ? 'Konfirmasi bangunan yang dipilih' : 'Pilih bangunan terlebih dahulu'));
  if (label) label.textContent = buildMode ? 'Batalkan' : 'Bangun';
  if (hint) {
    const item = BUILDINGS.find((building) => building.id === selectedBuildingId);
    const copy = hint.querySelector('span:last-child');
    if (copy) copy.innerHTML = buildMode
      ? 'Klik pada tanah<br>untuk menempatkan'
      : (selected ? `Siap membangun<br>${item?.short ?? 'Town Hall'}` : 'Pilih bangunan<br>dan tempatkan di kota');
  }
}

function setRayFromPointer(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function getBuildingAtPointer(clientX, clientY) {
  if (!city) return null;
  setRayFromPointer(clientX, clientY);
  const roots = [city.townHall, ...city.buildings.map((item) => item.object)].filter(Boolean);
  const hit = raycaster.intersectObjects(roots, true)[0];
  if (!hit) return null;
  let root = hit.object;
  while (root.parent && root.parent !== scene) root = root.parent;
  if (root === city.townHall) return { isTownHall: true, object: root };
  const record = city.buildings.find((item) => item.object === root);
  return record ? { ...record, isTownHall: false } : null;
}

function getWorldObjectAtPointer(clientX, clientY) {
  if (!worldEnvironment) return null;
  setRayFromPointer(clientX, clientY);
  const roots = [worldEnvironment.river, worldEnvironment.forest, worldEnvironment.fujiLabel].filter(Boolean);
  const hit = raycaster.intersectObjects(roots, true)[0];
  if (!hit) return null;
  let root = hit.object;
  while (root.parent && root.parent !== scene) root = root.parent;
  if (root === worldEnvironment.forest) return { isWorldObject: true, name: 'Hutan Jepang', objectType: 'Kawasan alam' };
  if (root === worldEnvironment.river) return { isWorldObject: true, name: 'Sungai lembah', objectType: 'Sumber air' };
  if (root === worldEnvironment.fujiLabel) return { isWorldObject: true, name: 'Gunung Fuji', objectType: 'Landmark alam' };
  return null;
}

function updateBuildingHighlight(target) {
  const object = target?.object ?? null;
  if (hoverHelper?.userData.target === object) return;
  if (hoverHelper) {
    scene.remove(hoverHelper);
    hoverHelper.geometry.dispose();
    hoverHelper.material.dispose();
    hoverHelper = null;
  }
  if (!object) return;
  hoverHelper = new THREE.BoxHelper(object, 0xd4d8df);
  hoverHelper.material.depthTest = false;
  hoverHelper.material.transparent = true;
  hoverHelper.material.opacity = 0.9;
  hoverHelper.renderOrder = 12;
  hoverHelper.userData.target = object;
  scene.add(hoverHelper);
}

function cancelCameraFocus() {
  cameraFocusAnimation = null;
}

function focusCameraOnBuilding(object) {
  if (!camera || !controls || !object) return;

  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return;

  const center = bounds.getCenter(new THREE.Vector3());
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  // Orthographic focus keeps the fixed isometric angle and changes only framing.
  const targetZoom = getBuildingFocusZoom(sphere.radius, camera.userData.aspect ?? 1);
  const targetOffset = center.clone().sub(controls.target);
  const destination = camera.position.clone().add(targetOffset);
  cameraFocusAnimation = {
    startedAt: performance.now(),
    duration: 1120,
    fromPosition: camera.position.clone(),
    toPosition: destination,
    fromTarget: controls.target.clone(),
    toTarget: center,
    fromZoom: camera.zoom,
    toZoom: targetZoom
  };
}

function updateCameraFocus(now) {
  if (!cameraFocusAnimation) return;
  const animation = cameraFocusAnimation;
  const progress = THREE.MathUtils.clamp((now - animation.startedAt) / animation.duration, 0, 1);
  // Quintic smoothstep: mulai dan berhenti sangat halus tanpa animasi berat.
  const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);

  camera.position.lerpVectors(animation.fromPosition, animation.toPosition, eased);
  controls.target.lerpVectors(animation.fromTarget, animation.toTarget, eased);
  camera.zoom = THREE.MathUtils.lerp(animation.fromZoom, animation.toZoom, eased);
  camera.updateProjectionMatrix();
  controls.update();

  if (progress >= 1) cameraFocusAnimation = null;
}

function resolveInspectedBuilding() {
  if (!inspectedBuilding) return null;
  if (inspectedBuilding.isTownHall) {
    return city.townHall ? { isTownHall: true, object: city.townHall } : null;
  }
  const current = city.buildings.find((item) => item.object === inspectedBuilding.object);
  return current ? { ...current, isTownHall: false } : null;
}

function finishInspectorClose() {
  if (inspectorCloseTimer) {
    window.clearTimeout(inspectorCloseTimer);
    inspectorCloseTimer = null;
  }
  if (inspectorTransitionHandler) {
    buildingInspector.removeEventListener('transitionend', inspectorTransitionHandler);
    inspectorTransitionHandler = null;
  }
  buildingInspector.hidden = true;
  buildingInspector.classList.remove('is-open', 'is-closing');
  buildingInspector.setAttribute('aria-hidden', 'true');
  syncOverlayLayoutState();
}

function closeBuildingInspector() {
  inspectedBuilding = null;
  updateBuildingHighlight(hoveredBuilding);
  if (buildingInspector.hidden || buildingInspector.classList.contains('is-closing')) return;

  buildingInspector.classList.remove('is-open');
  buildingInspector.classList.add('is-closing');
  buildingInspector.setAttribute('aria-hidden', 'true');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishInspectorClose();
    return;
  }

  if (inspectorTransitionHandler) buildingInspector.removeEventListener('transitionend', inspectorTransitionHandler);
  inspectorTransitionHandler = (event) => {
    if (event.target !== buildingInspector || event.propertyName !== 'transform') return;
    if (buildingInspector.classList.contains('is-closing')) finishInspectorClose();
  };
  buildingInspector.addEventListener('transitionend', inspectorTransitionHandler);
  inspectorCloseTimer = window.setTimeout(() => {
    if (buildingInspector.classList.contains('is-closing')) finishInspectorClose();
  }, 360);
}

function openBuildingInspector(target) {
  if (!target) {
    closeBuildingInspector();
    return;
  }
  // The inspector replaces the dock rather than stacking over it. Finish the
  // outgoing panel before animating the inspector in to avoid a brief overlap.
  if (!dockPopover.hidden || dockPopover.classList.contains('is-closing')) {
    closeControlPanel();
    finishDockClose();
  }
  if (inspectorCloseTimer) {
    window.clearTimeout(inspectorCloseTimer);
    inspectorCloseTimer = null;
  }
  if (inspectorTransitionHandler) {
    buildingInspector.removeEventListener('transitionend', inspectorTransitionHandler);
    inspectorTransitionHandler = null;
  }
  const shouldAnimateOpen = buildingInspector.hidden || buildingInspector.classList.contains('is-closing');
  inspectedBuilding = target.isTownHall
    ? { isTownHall: true, object: city.townHall }
    : { isTownHall: false, object: target.object };
  buildingInspector.hidden = false;
  buildingInspector.classList.remove('is-closing');
  buildingInspector.setAttribute('aria-hidden', 'false');
  syncOverlayLayoutState();
  if (shouldAnimateOpen) {
    buildingInspector.classList.remove('is-open');
    void buildingInspector.offsetWidth;
    requestAnimationFrame(() => {
      if (!buildingInspector.hidden && !buildingInspector.classList.contains('is-closing')) {
        buildingInspector.classList.add('is-open');
      }
    });
  } else {
    buildingInspector.classList.add('is-open');
  }
  renderBuildingInspector();
  focusCameraOnBuilding(inspectedBuilding.object);
  updateBuildingHighlight(hoveredBuilding ?? inspectedBuilding);
}

function renderWarehouseInventory() {
  const values = {
    food: city.resources.food,
    wood: city.resources.wood,
    stone: city.resources.stone,
    iron: city.resources.iron,
    eggs: city.resources.eggs,
    meat: city.resources.meat
  };
  for (const [key, value] of Object.entries(values)) {
    const element = $(`#warehouse-${key}`);
    if (element) element.textContent = Math.floor(value ?? 0).toLocaleString('id-ID');
  }
}

function renderBuildingInspector() {
  warehouseInventory.hidden = true;
  buildingDemolishButton.hidden = true;
  buildingDemolishButton.disabled = true;
  const target = resolveInspectedBuilding();
  if (!target) {
    closeBuildingInspector();
    return;
  }

  if (target.isTownHall) {
    const era = ERAS[city.eraIndex];
    const upgradeStatus = getUpgradeStatus();
    const { nextEra, checks, requirements, ready } = upgradeStatus;
    inspectorName.textContent = 'Town Hall';
    inspectorSubtitle.textContent = `${era.townHall} · pusat pemerintahan kota`;
    inspectorType.textContent = 'Pemerintahan';
    inspectorLevel.textContent = `LEVEL ${String(city.eraIndex + 1).padStart(2, '0')}`;
    inspectorResidentLabel.textContent = 'TOTAL WARGA KOTA';
    inspectorResidents.textContent = `${city.getPopulation().toLocaleString('id-ID')} jiwa`;
    inspectorResidentNote.textContent = 'Jumlah penghuni seluruh kota';
    inspectorDescription.textContent = era.description;
    inspectorUpgradeLabel.textContent = 'BIAYA UPGRADE ERA';
    inspectorUpgradeCost.textContent = nextEra ? formatYen(requirements.upgradeCost) : 'Maksimum';
    const missingRequirements = checks
      .filter((check) => !check.ok)
      .map((check) => `${check.label}: ${Math.floor(check.current).toLocaleString('id-ID')}/${check.required.toLocaleString('id-ID')}`);
    inspectorUpgradeNote.textContent = nextEra
      ? (ready
        ? `Semua syarat terpenuhi. Kota siap memasuki era ${nextEra.name}.`
        : `Belum dapat ditingkatkan. ${missingRequirements.join(' · ')}. Stok resource 500 adalah cadangan dan tidak dikurangi saat upgrade.`)
      : 'Kota telah mencapai era terakhir.';
    buildingUpgradeButton.textContent = nextEra ? `Upgrade ke ${nextEra.name}` : 'Era maksimum';
    buildingUpgradeButton.disabled = !ready;
    buildingUpgradeButton.dataset.upgradeTarget = 'townhall';
    return;
  }

  const record = city.buildings.find((item) => item.object === target.object);
  if (!record) return closeBuildingInspector();
  const definition = BUILDINGS.find((item) => item.id === record.type);
  if (!definition) return closeBuildingInspector();
  const level = Math.max(1, Number(record.level) || 1);
  const quote = city.getBuildingUpgradeQuote(record);
  const residentialVisualEra = Number.isInteger(record.visualEraIndex) ? record.visualEraIndex : city.eraIndex;
  const buildingDisplayName = record.type === RESIDENTIAL_BUILDING_ID
    ? getResidentialEraName(residentialVisualEra)
    : definition.name;
  inspectorName.textContent = buildingDisplayName;
  inspectorSubtitle.textContent = record.type === RESIDENTIAL_BUILDING_ID
    ? `Hunian tunggal · arsitektur ${ERAS[residentialVisualEra]?.name ?? 'Jōmon'} · level ${level}`
    : `${ERAS[definition.unlockEra]?.name ?? 'Era tidak diketahui'} · ${definition.description}`;
  inspectorType.textContent = CATEGORY_NAMES[definition.category] ?? definition.category;
  inspectorLevel.textContent = `LEVEL ${String(level).padStart(2, '0')}`;
  const hasRoadAccess = city.isBuildingConnectedToRoad(record);
  if (definition.population > 0) {
    inspectorResidentLabel.textContent = 'PENGHUNI BANGUNAN';
    inspectorResidents.textContent = `${city.getBuildingResidents(record).toLocaleString('id-ID')} / ${city.getBuildingCapacity(record).toLocaleString('id-ID')} jiwa`;
    inspectorResidentNote.textContent = city.getBuildingResidents(record) > 0
      ? 'Penghuni saat ini / kapasitas rumah'
      : 'Kosong · belum menghasilkan pendapatan hunian';
  } else if (record.type === 'passenger-terminal') {
    const throughput = getPassengerBuildingThroughput(record);
    inspectorResidentLabel.textContent = 'ARUS PENUMPANG';
    inspectorResidents.textContent = hasRoadAccess ? `${throughput} warga / 5 menit` : `0 aktif · potensi ${throughput}`;
    inspectorResidentNote.textContent = hasRoadAccess
      ? 'Aktif · menambah kecepatan perpindahan warga'
      : 'Offline · sambungkan terminal ke jalan kota untuk mengaktifkan arus';
  } else if (record.type === 'cargo-terminal') {
    const bonus = Math.round(getCargoBuildingBonus(record) * 100);
    inspectorResidentLabel.textContent = 'KAPASITAS PENGIRIMAN';
    inspectorResidents.textContent = hasRoadAccess ? `+${bonus}% barang` : `0% aktif · potensi +${bonus}%`;
    inspectorResidentNote.textContent = hasRoadAccess
      ? 'Aktif · meningkatkan resource terkirim per siklus'
      : 'Offline · sambungkan terminal ke jalan kota untuk mengaktifkan kargo';
  } else if (record.type === 'storehouse') {
    inspectorResidentLabel.textContent = 'STOK RESOURCE KOTA';
    inspectorResidents.textContent = '6 jenis resource';
    inspectorResidentNote.textContent = 'Jumlah inventaris yang tersedia untuk kota';
    warehouseInventory.hidden = false;
    renderWarehouseInventory();
  } else {
    inspectorResidentLabel.textContent = 'PENGHUNI';
    inspectorResidents.textContent = 'Tidak ada';
    inspectorResidentNote.textContent = 'Bangunan ini bukan hunian';
  }

  const extractor = RESOURCE_EXTRACTORS[record.type];
  if (extractor) {
    const demolitionQuote = city.getBuildingDemolitionQuote(record);
    buildingDemolishButton.hidden = !demolitionQuote.available;
    buildingDemolishButton.disabled = !demolitionQuote.available;
    buildingDemolishButton.textContent = 'Bongkar fasilitas produksi';
    const site = RESOURCE_SITES.find((item) => item.id === record.resourceSiteId);
    const sourceText = site
      ? ` Sumber: ${site.name}. Produksi dasar ${extractor.baseYield} ${extractor.label.toLowerCase()} setiap 5 menit.`
      : ' Belum terdaftar pada zona sumber daya yang valid.';
    const deliveryText = hasRoadAccess
      ? ' Status logistik: tersambung ke jalan kota dan resource dapat dikirim ke stok.'
      : ' Status logistik: BELUM TERHUBUNG KE JALAN. Produksi dan pendapatan ditahan sampai fasilitas tersambung ke jaringan jalan permukiman.';
    inspectorDescription.textContent = `${definition.description}${sourceText}${deliveryText}`;
  } else if (record.type === 'passenger-terminal') {
    inspectorDescription.textContent = `${definition.description} Level ${level} melayani ${getPassengerBuildingThroughput(record)} warga tambahan setiap siklus 5 menit${hasRoadAccess ? '.' : '. Terminal belum beroperasi karena belum terhubung ke jalan.'}`;
  } else if (record.type === 'cargo-terminal') {
    inspectorDescription.textContent = `${definition.description} Level ${level} menambah kapasitas pengiriman sebesar ${Math.round(getCargoBuildingBonus(record) * 100)}%${hasRoadAccess ? '.' : '. Terminal belum beroperasi karena belum terhubung ke jalan.'}`;
  } else if (record.type === 'storehouse') {
    inspectorDescription.textContent = 'Lumbung menampilkan stok resource yang tersedia untuk seluruh kota. Resource baru dapat masuk ke inventaris setelah fasilitas penghasil terhubung melalui jaringan jalan.';
  } else if (record.type === RESIDENTIAL_BUILDING_ID) {
    const nextEraName = getResidentialEraName(Math.min(14, city.eraIndex + 1));
    const currentCapacity = city.getBuildingCapacity(record);
    inspectorDescription.textContent = quote.available
      ? (quote.visualWillEvolve
        ? `MyJapan hanya memiliki satu jenis hunian. Rumah ini sekarang bergaya ${buildingDisplayName} dan menampung hingga ${currentCapacity} warga. Upgrade berikutnya akan mengubah arsitektur menjadi ${quote.nextVisualName}, meningkatkan kapasitas, serta menambahkan detail sesuai zaman. Rumah lain tetap mempertahankan desain masing-masing sampai di-upgrade.`
        : `MyJapan hanya memiliki satu jenis hunian. Rumah ini menggunakan arsitektur ${buildingDisplayName} dengan kapasitas ${currentCapacity} warga. Upgrade berikutnya meningkatkan kapasitas dan detail rumah. Saat zaman berkembang, upgrade rumah ini akan membuka desain ${nextEraName}.`)
      : `MyJapan hanya memiliki satu jenis hunian. Rumah ini menggunakan arsitektur ${buildingDisplayName} dengan kapasitas ${currentCapacity} warga. Rumah akan berubah mengikuti zaman saat di-upgrade, sedangkan hunian lain tetap mempertahankan desainnya sendiri.`;
  } else {
    inspectorDescription.textContent = definition.description;
  }
  inspectorUpgradeLabel.textContent = quote.available ? 'BIAYA UPGRADE' : 'STATUS UPGRADE';
  if (quote.available) {
    const resourceText = formatResourceCost(quote.resources);
    inspectorUpgradeCost.textContent = formatYen(quote.cost);
    inspectorUpgradeNote.textContent = record.type === RESIDENTIAL_BUILDING_ID
      ? `${resourceText} · menuju Lv. ${quote.nextLevel} · ${quote.visualWillEvolve ? `desain baru: ${quote.nextVisualName}` : 'detail dan kapasitas meningkat'}`
      : `${resourceText} · menuju level ${quote.nextLevel}`;
    buildingUpgradeButton.textContent = `Upgrade · Lv. ${quote.nextLevel}`;
    buildingUpgradeButton.disabled = !quote.affordable;
  } else {
    inspectorUpgradeCost.textContent = `Level ${level}/${quote.maxLevel ?? city.getMaxBuildingLevel()}`;
    inspectorUpgradeNote.textContent = quote.reason;
    buildingUpgradeButton.textContent = 'Batas level era';
    buildingUpgradeButton.disabled = true;
  }
  buildingUpgradeButton.dataset.upgradeTarget = 'building';
}

function demolishInspectedBuilding() {
  const target = resolveInspectedBuilding();
  if (!target || target.isTownHall) return;
  const record = city.buildings.find((item) => item.object === target.object);
  const quote = city.getBuildingDemolitionQuote(record);
  if (!quote.available) {
    showToast(quote.reason, 'warning');
    renderBuildingInspector();
    return;
  }

  const resourceRefundText = Object.entries(quote.resourceRefund)
    .map(([key, amount]) => `${amount} ${({ food: 'pangan', wood: 'kayu', stone: 'batu', iron: 'besi' })[key] ?? key}`)
    .join(', ');
  const confirmation = [
    `Bongkar ${quote.definition.name}?`,
    `${Math.round(quote.moneyRefundRate * 100)}% biaya uang konstruksi awal (${formatYen(quote.moneyRefund)}) dan ${Math.round(quote.resourceRefundRate * 100)}% material (${resourceRefundText || 'tidak ada'}) akan dikembalikan.`,
    'Bangunan akan hilang dan slot sumber dayanya kembali tersedia.'
  ].join('\n\n');
  if (!window.confirm(confirmation)) return;

  const result = city.demolishBuilding(record);
  if (!result.ok) {
    showToast(result.reason, 'warning');
    renderBuildingInspector();
    return;
  }

  if (hoveredBuilding?.object === target.object) hoveredBuilding = null;
  closeBuildingInspector();
  renderHUD();
  renderBuildingMenu();
  updateResourceSiteOverlay();
  const refundedResources = Object.entries(result.resourceRefund)
    .map(([key, amount]) => `+${amount} ${({ food: 'pangan', wood: 'kayu', stone: 'batu', iron: 'besi' })[key] ?? key}`)
    .join(' · ');
  showToast(`${result.definition.name} dibongkar · +${formatYen(result.moneyRefund)}${refundedResources ? ` · ${refundedResources}` : ''}`, 'success');
}

function upgradeInspectedBuilding() {
  const target = resolveInspectedBuilding();
  if (!target) return closeBuildingInspector();
  if (target.isTownHall) {
    const upgraded = handleUpgrade();
    if (upgraded) {
      inspectedBuilding = { isTownHall: true, object: city.townHall };
      renderBuildingInspector();
      updateBuildingHighlight(inspectedBuilding);
    }
    return;
  }
  const record = city.buildings.find((item) => item.object === target.object);
  const result = city.upgradeBuilding(record);
  if (!result.ok) {
    showToast(result.reason, 'warning');
    renderBuildingInspector();
    return;
  }
  // The house model is replaced on upgrade; keep Inspector attached to it.
  inspectedBuilding = { isTownHall: false, object: record.object };
  renderHUD();
  renderBuildingInspector();
  updateBuildingHighlight(inspectedBuilding);
  const upgradedName = record.type === RESIDENTIAL_BUILDING_ID
    ? getResidentialEraName(record.visualEraIndex)
    : result.definition.name;
  showToast(`${upgradedName} ditingkatkan ke level ${record.level}.`, 'success');
}

function updateBuildingHover(clientX, clientY) {
  if (buildMode) {
    hoveredBuilding = null;
    updateBuildingHighlight(null);
    hideHoverObjectLabel();
    if (renderer) renderer.domElement.style.cursor = 'crosshair';
    return;
  }
  hoveredBuilding = getBuildingAtPointer(clientX, clientY);
  const hoverTarget = hoveredBuilding ?? getWorldObjectAtPointer(clientX, clientY);
  updateBuildingHighlight(hoveredBuilding ?? inspectedBuilding);
  updateHoverObjectLabel(hoverTarget, clientX, clientY);
  if (renderer) renderer.domElement.style.cursor = hoverTarget ? 'pointer' : 'grab';
}

function getCellFromPointer(clientX, clientY) {
  setRayFromPointer(clientX, clientY);
  const hit = raycaster.intersectObject(buildSurface, false)[0];
  if (!hit) return null;
  return city.getCellFromWorld(hit.point.x, hit.point.z);
}

function canPlaceAt(item, cell) {
  if (!cell) return false;
  if (selectedBuildingId === 'townhall') return city.getTownHallPlacementStatus(cell.gx, cell.gz).ok;
  if (!item) return false;
  const placement = city.getBuildingPlacementStatus(item.id, cell.gx, cell.gz);
  return placement.ok && canAffordBuilding(item);
}

function updatePreview(clientX, clientY) {
  if (!buildMode || !selectedBuildingId) {
    preview.visible = false;
    return;
  }
  const cell = getCellFromPointer(clientX, clientY);
  if (!cell) {
    preview.visible = false;
    return;
  }
  const item = BUILDINGS.find((building) => building.id === selectedBuildingId);
  preview.visible = true;
  if (selectedBuildingId === 'townhall') {
    const world = city.getTownHallWorldPosition(cell.gx, cell.gz);
    preview.position.set(world.x, terrainHeight(world.x, world.z) + 0.16, world.z);
    preview.scale.set(TOWN_HALL_FOOTPRINT_SIZE, 1, TOWN_HALL_FOOTPRINT_SIZE);
  } else {
    preview.position.set(cell.x, terrainHeight(cell.x, cell.z) + 0.16, cell.z);
    preview.scale.set(1, 1, 1);
  }
  const valid = canPlaceAt(item, cell);
  preview.material.color.setHex(valid ? 0x89d7a1 : 0xe16b62);
  preview.material.opacity = valid ? 0.48 : 0.55;
}

function placeSelectedBuilding(clientX, clientY) {
  if (!buildMode || !selectedBuildingId) {
    showToast('Buka tab Build dan pilih bangunan terlebih dahulu.');
    return;
  }
  const cell = getCellFromPointer(clientX, clientY);
  if (!cell) return;
  const previousLogistics = city.getRoadNetworkSummary();
  const placedType = selectedBuildingId;
  if (placedType === 'townhall') {
    const result = city.placeTownHall(cell.gx, cell.gz);
    if (!result.ok) {
      showToast(result.reason, 'warning');
      return;
    }
    selectedBuildingId = null;
    buildMode = false;
    preview.visible = false;
    preview.scale.set(1, 1, 1);
    updateResourceSiteOverlay();
    renderBuildingMenu();
    renderHUD();
    updateToolUI();
    showToast('Town Hall berhasil dibangun! Pusat pemerintahan dan perkembangan era kini aktif.', 'success');
    return;
  }
  const result = city.placeBuilding(placedType, cell.gx, cell.gz);
  if (!result.ok) {
    showToast(result.reason, 'warning');
    return;
  }
  const residentialLimitReached = result.definition.category === 'residential' && city.getResidentialCount() >= city.getResidentialLimit();
  if (residentialLimitReached) {
    buildMode = false;
    selectedBuildingId = null;
    preview.visible = false;
  }
  renderBuildingMenu();
  updateResourceSiteOverlay();
  renderHUD();
  if (RESOURCE_EXTRACTORS[placedType]) {
    const placedRecord = city.buildings.at(-1);
    if (!city.isBuildingConnectedToRoad(placedRecord)) {
      showToast(`${result.definition.name} dibangun, tetapi belum bisa mengirim resource. Hubungkan fasilitas ke jaringan jalan permukiman${city.townHall ? ' yang tersambung ke Town Hall' : ' yang dimulai dari jalan pertama'}.`, 'warning');
      return;
    }
  }
  const updatedLogistics = city.getRoadNetworkSummary();
  if (placedType === 'road') {
    if (updatedLogistics.connectedExtractors > previousLogistics.connectedExtractors) {
      const newlyConnected = updatedLogistics.connectedExtractors - previousLogistics.connectedExtractors;
      showToast(`Jalur jalan tersambung. ${newlyConnected} fasilitas kini dapat mengirim resource.`, 'success');
    } else if (updatedLogistics.connectedRoads === previousLogistics.connectedRoads) {
      showToast(city.townHall
        ? 'Jalan dibangun, tetapi masih terpisah. Sambungkan ke jalan akses pertama.'
        : 'Jalan pertama menjadi akses permukiman. Sambungkan ruas jalan berikutnya ke ruas ini.', 'warning');
    } else {
      showToast(city.townHall
        ? 'Jalan tersambung ke jaringan Town Hall. Pastikan fasilitas sumber daya berada maksimal dua petak dari jalan terhubung.'
        : 'Jalan tersambung ke jaringan akses awal permukiman. Town Hall dapat dibangun setelah 50 penduduk.', 'success');
    }
    return;
  }
  showToast(residentialLimitReached
    ? `${result.definition.name} dibangun. Kapasitas hunian ${city.getResidentialLimit()}/${city.getResidentialLimit()} telah penuh.`
    : `${result.definition.name} berhasil dibangun.`, 'success');
}

function cancelBuildMode() {
  buildMode = false;
  selectedBuildingId = null;
  if (preview) {
    preview.visible = false;
    preview.scale.set(1, 1, 1);
  }
  updateResourceSiteOverlay();
  if (activeTab === 'build') renderBuildingMenu();
  updateTutorialCompanion();
  updateToolUI();
  updateBuildActionButton();
}

function handleUpgrade() {
  const { nextEra } = getUpgradeStatus();
  if (!nextEra) return false;
  const upgradeResult = city.upgradeEra();
  if (!upgradeResult.ok) {
    showToast(upgradeResult.reason || 'Persyaratan upgrade belum terpenuhi.', 'warning');
    renderHUD();
    return false;
  }
  const reward = nextEra.eraReward ?? {};
  city.money += Math.max(0, Number(reward.money) || 0);
  for (const key of ['food', 'wood', 'stone', 'iron']) {
    city.resources[key] = Math.max(0, Number(city.resources[key]) || 0) + Math.max(0, Number(reward[key]) || 0);
  }
  selectedBuildingId = null;
  buildMode = false;
  if (preview) preview.visible = false;
  updateResourceSiteOverlay();
  renderBuildingMenu();
  renderHUD();
  const rewardLabel = reward.money ? ` Bonus perkembangan +${formatYen(reward.money)} dan resource awal.` : '';
  showToast(`Selamat! Kota memasuki era ${nextEra.name}. Tema UI berubah ke ${nextEra.uiMaterial ?? 'material baru'}.${rewardLabel}`, 'success');
  return true;
}

function enablePerformanceDiagnostics() {
  if (!performanceDiagnosticsEnabled || performanceMonitor) return;

  performanceMonitor = createPerformanceMonitor({
    getEnvironment: () => ({
      browserUserAgent: navigator.userAgent,
      logicalCores: navigator.hardwareConcurrency ?? null,
      deviceMemoryGiB: navigator.deviceMemory ?? null,
      mobileViewport: isMobile,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio || 1,
      rendererPixelRatio: renderer?.getPixelRatio?.() ?? null,
      graphicsQuality,
      shadowsEnabled: Boolean(renderer?.shadowMap?.enabled),
      webgl2: Boolean(renderer?.capabilities?.isWebGL2),
      maxTextureSize: renderer?.capabilities?.maxTextureSize ?? null
    }),
    onSample: (sample) => console.info('[MyJapan perf]', sample)
  });

  const downloadReport = () => {
    const report = performanceMonitor.getReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `myjapan-perf-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  try {
    Object.defineProperty(window, '__MYJAPAN_PERF__', {
      configurable: true,
      value: Object.freeze({
        getReport: () => performanceMonitor.getReport(),
        reset: () => performanceMonitor.reset(),
        download: downloadReport
      })
    });
    console.info('[MyJapan perf] Diagnostics aktif. Gunakan __MYJAPAN_PERF__.getReport() atau .download().');
  } catch (error) {
    // Diagnostics are optional and must never prevent the game from starting.
    performanceMonitor = null;
    console.warn('[MyJapan perf] Diagnostics tidak dapat dipasang; game tetap berjalan.', error);
  }
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bd7ed);
  scene.fog = new THREE.Fog(0x9bd7ed, 112, 188);

  camera = createMainCamera(window.innerWidth / window.innerHeight);
  const lowPowerDevice = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const initialRenderProfile = getRendererProfile('balanced', isMobile, lowPowerDevice);
  renderer = new THREE.WebGLRenderer({
    antialias: initialRenderProfile.antialias,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, initialRenderProfile.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = initialRenderProfile.toneMappingExposure;
  renderer.shadowMap.enabled = initialRenderProfile.shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'world-canvas';
  renderer.domElement.setAttribute('aria-label', 'Peta 2.5D MyJapan. Seret untuk menggeser dan scroll untuk zoom.');
  renderer.domElement.style.cursor = 'grab';
  $('#game-root').prepend(renderer.domElement);

  hemiLight = new THREE.HemisphereLight(0xeaf6ff, 0x667b53, 1.45);
  scene.add(hemiLight);
  fillLight = new THREE.DirectionalLight(0xc8def4, 0.34);
  fillLight.position.set(42, 28, 34);
  scene.add(fillLight);
  sunLight = new THREE.DirectionalLight(0xfff0d7, 2.55);
  sunLight.position.set(-35, 65, -20);
  sunLight.castShadow = !isMobile && !lowPowerDevice;
  sunLight.shadow.mapSize.setScalar(initialRenderProfile.shadowMapSize);
  sunLight.shadow.camera.left = -75;
  sunLight.shadow.camera.right = 75;
  sunLight.shadow.camera.top = 75;
  sunLight.shadow.camera.bottom = -75;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 150;
  sunLight.shadow.bias = -0.00012;
  sunLight.shadow.normalBias = 0.035;
  sunLight.shadow.radius = 4;
  sunLight.shadow.camera.updateProjectionMatrix();
  scene.add(sunLight);

  worldEnvironment = createJapaneseTerrain(scene);
  buildSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide })
  );
  buildSurface.rotation.x = -Math.PI / 2;
  buildSurface.position.y = 0;
  buildSurface.name = 'Build interaction surface';
  scene.add(buildSurface);
  controls = createCityCamera(camera, renderer);
  controls.addEventListener('start', () => { cancelCameraFocus(); hideHoverObjectLabel(); });
  city = new CityManager(scene);
  resourceSiteOverlay = createResourceSiteOverlay(scene);

  preview = new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 0.07, 1.92),
    new THREE.MeshBasicMaterial({ color: 0x89d7a1, transparent: true, opacity: 0.48, depthWrite: false })
  );
  preview.visible = false;
  preview.renderOrder = 2;
  scene.add(preview);
  enablePerformanceDiagnostics();
}

function applyGraphicsQuality(level) {
  const validLevels = ['low', 'balanced', 'high'];
  if (!validLevels.includes(level) || !renderer) return;
  graphicsQuality = level;
  const deviceMemory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const lowPowerDevice = deviceMemory <= 4 || cores <= 4;
  const profile = getRendererProfile(level, isMobile, lowPowerDevice);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = profile.shadowsEnabled;
  renderer.toneMappingExposure = profile.toneMappingExposure;
  if (sunLight) {
    sunLight.castShadow = profile.shadowsEnabled;
    sunLight.shadow.mapSize.setScalar(profile.shadowMapSize);
    sunLight.shadow.needsUpdate = true;
  }
  document.querySelectorAll('[data-quality]').forEach((button) => {
    const active = button.dataset.quality === level;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function toggleGamePause() {
  if (!gameStarted) return;
  const button = $('#top-pause-button');
  if (!isGamePaused) {
    isGamePaused = true;
    pauseStartedAt = Date.now();
    if (controls) controls.enabled = false;
    button?.setAttribute('aria-pressed', 'true');
    button?.setAttribute('aria-label', 'Lanjutkan permainan');
    button?.setAttribute('title', 'Lanjutkan');
    gameUI.classList.add('game-is-paused');
    showToast('Permainan dijeda. Kota tidak menghasilkan resource selama jeda.', 'info');
    return;
  }
  const pausedDuration = Math.max(0, Date.now() - pauseStartedAt);
  isGamePaused = false;
  if (city) {
    city.worldStartedAt += pausedDuration;
    city.lastEconomyTickAt += pausedDuration;
  }
  lastEconomyUiUpdate = Date.now();
  lastWorldUiUpdate = Date.now();
  if (controls) controls.enabled = true;
  button?.setAttribute('aria-pressed', 'false');
  button?.setAttribute('aria-label', 'Jeda permainan');
  button?.setAttribute('title', 'Jeda');
  gameUI.classList.remove('game-is-paused');
  renderWorldBanner(Date.now());
  renderHUD();
  showToast('Permainan dilanjutkan.', 'success');
}

function resetCameraView() {
  if (!camera || !controls) return;
  cancelCameraFocus();
  resetMainCamera(camera, controls);
  showToast('Sudut kamera dikembalikan ke posisi awal.', 'success');
}

function handleRightClickCancel(event) {
  if (event.button !== 2) return;

  // Right-click is the universal cancel/close action inside the game.
  // Capture it before OrbitControls or canvas handlers can interpret it.
  event.preventDefault();
  event.stopPropagation();
  pointerStart = null;
  pointerDragging = false;

  if (buildMode) {
    cancelBuildMode();
    showToast('Build Mode dibatalkan. Mode inspeksi aktif kembali.');
    return;
  }

  const clickedInsideInspector = buildingInspector.contains(event.target);
  const clickedInsideDock = dockPopover.contains(event.target) || event.target.closest?.('.dock-launcher');
  const inspectorOpen = !buildingInspector.hidden && !buildingInspector.classList.contains('is-closing');
  const dockOpen = !dockPopover.hidden && !dockPopover.classList.contains('is-closing');

  // Close the surface under the pointer first. If the user right-clicks
  // elsewhere, close the topmost active card before the dock panel.
  if (inspectorOpen && (clickedInsideInspector || (!clickedInsideDock && !dockOpen))) {
    closeBuildingInspector();
    return;
  }
  if (dockOpen && clickedInsideDock) {
    closeControlPanel();
    return;
  }
  if (inspectorOpen) {
    closeBuildingInspector();
    return;
  }
  if (dockOpen) {
    closeControlPanel();
  }
}

function setupInput() {
  buildingList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-building]');
    if (!button || button.disabled) return;
    selectBuilding(button.dataset.building);
  });
  buildCategoryRail.addEventListener('click', (event) => {
    const button = event.target.closest('[data-build-category]');
    if (!button || button.disabled || PLANNED_BUILD_CATEGORY_KEYS.includes(button.dataset.buildCategory)) return;
    selectedBuildCategory = button.dataset.buildCategory;
    selectedBuildingId = null;
    buildMode = false;
    if (preview) preview.visible = false;
    updateResourceSiteOverlay();
    renderBuildingMenu();
    updateToolUI();
  });
  $('#tutorial-mask-toggle').addEventListener('click', handleTutorialEmblemClick);
  $('#tutorial-collapse-button').addEventListener('click', toggleTutorialCompanion);
  $('#tutorial-next-button').addEventListener('click', showNextTutorialTip);

  for (const launcherButton of document.querySelectorAll('[data-panel]')) {
    launcherButton.addEventListener('click', () => setActiveTab(launcherButton.dataset.panel, true));
  }
  closeDockButton.addEventListener('click', closeControlPanel);
  $('#resource-hud-open').addEventListener('click', () => setActiveTab('stats', false));
  $('#top-help-button')?.addEventListener('click', () => {
    tutorialCompanion?.classList.remove('is-collapsed');
    $('#tutorial-mask-toggle')?.setAttribute('aria-expanded', 'true');
    $('#tutorial-collapse-button')?.setAttribute('aria-label', 'Ringkas panduan');
    showToast('Panduan Shogun dibuka.', 'info');
  });
  $('#top-pause-button')?.addEventListener('click', toggleGamePause);
  $('#build-action-button')?.addEventListener('click', () => {
    if (buildMode) { cancelBuildMode(); return; }
    if (selectedBuildingId) { activateSelectedBuilding(); return; }
    showToast('Pilih kartu bangunan terlebih dahulu untuk mengonfirmasi pembangunan.', 'info');
  });
  $('#quick-missions-button')?.addEventListener('click', () => {
    tutorialCompanion?.classList.remove('is-collapsed');
    $('#tutorial-mask-toggle')?.setAttribute('aria-expanded', 'true');
    $('#tutorial-collapse-button')?.setAttribute('aria-label', 'Ringkas panduan');
    showToast('Panduan misi pembangunan ditampilkan.', 'info');
  });
  $('#quick-notifications-button')?.addEventListener('click', () => {
    setActiveTab('stats', false);
    const detail = $('#network-warning-detail')?.textContent;
    showToast(networkWarning.hidden ? 'Belum ada notifikasi logistik.' : detail, networkWarning.hidden ? 'info' : 'warning');
  });
  $('#quick-report-button')?.addEventListener('click', () => setActiveTab('stats', false));
  $('#minimap-center-button')?.addEventListener('click', resetCameraView);

  networkWarning.addEventListener('click', () => setActiveTab('stats', false));
  cancelBuildButton.addEventListener('click', cancelBuildMode);
  document.querySelectorAll('[data-quality]').forEach((button) => {
    button.addEventListener('click', () => applyGraphicsQuality(button.dataset.quality));
  });
  $('#camera-reset-button').addEventListener('click', resetCameraView);
  $('#return-main-menu-button').addEventListener('click', returnToMainMenu);

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (pointerStart) {
      const dragDistance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (dragDistance > 7) {
        pointerDragging = true;
        hideHoverObjectLabel();
        hoveredBuilding = null;
        updateBuildingHighlight(inspectedBuilding);
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }
    }
    if (buildMode) updatePreview(event.clientX, event.clientY);
    else {
      if (preview) preview.visible = false;
      updateBuildingHover(event.clientX, event.clientY);
    }
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    if (preview) preview.visible = false;
    hoveredBuilding = null;
    updateBuildingHighlight(inspectedBuilding);
    hideHoverObjectLabel();
    if (!pointerStart && !buildMode && renderer) renderer.domElement.style.cursor = 'grab';
  });
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    pointerDragging = false;
    renderer.domElement.style.cursor = 'grabbing';
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    const wasDragging = pointerDragging || distance > 7;
    pointerStart = null;
    pointerDragging = false;
    if (renderer && !buildMode) renderer.domElement.style.cursor = hoveredBuilding ? 'pointer' : 'grab';
    else if (renderer && buildMode) renderer.domElement.style.cursor = 'crosshair';
    // Left-drag is exclusively camera panning; only a short release counts as a click.
    if (wasDragging) return;
    if (buildMode) placeSelectedBuilding(event.clientX, event.clientY);
    else openBuildingInspector(getBuildingAtPointer(event.clientX, event.clientY));
  });
  const clearPointerGesture = () => {
    pointerStart = null;
    pointerDragging = false;
    if (renderer && !buildMode) renderer.domElement.style.cursor = 'grab';
  };
  renderer.domElement.addEventListener('pointercancel', clearPointerGesture);
  renderer.domElement.addEventListener('lostpointercapture', clearPointerGesture);
  // One consistent mouse convention across the canvas and floating UI:
  // left click accepts/selects; right click cancels the active mode or closes a panel.
  gameRoot.addEventListener('pointerdown', handleRightClickCancel, true);
  gameRoot.addEventListener('contextmenu', (event) => event.preventDefault());
  upgradeButton.addEventListener('click', handleUpgrade);
  buildingUpgradeButton.addEventListener('click', upgradeInspectedBuilding);
  buildingDemolishButton.addEventListener('click', demolishInspectedBuilding);
  inspectorCloseButton.addEventListener('click', closeBuildingInspector);
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (isTyping || event.repeat) return;
    if (event.key.toLowerCase() === 'b' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (selectedBuildingId && !buildMode) activateSelectedBuilding();
      else setActiveTab('build', true);
      return;
    }
    if (event.key !== 'Escape') return;
    if (buildMode) cancelBuildMode();
    else if (!buildingInspector.hidden) closeBuildingInspector();
    else if (!dockPopover.hidden) closeControlPanel();
  });

  window.addEventListener('resize', () => {
    resizeMainCamera(camera, window.innerWidth / window.innerHeight);
    applyGraphicsQuality(graphicsQuality);
  });
}

function animate() {
  if (!gameStarted) {
    animationStarted = false;
    return;
  }
  requestAnimationFrame(animate);
  if (!isGamePaused) {
    controls.update();
    updateCameraFocus(performance.now());
    if (hoverHelper && gameStarted) hoverHelper.update();
  }

  // Render continues during pause, but all city simulation clocks and economy stop.
  if (gameStarted && !isGamePaused) {
    const now = Date.now();
    if (now - lastWorldUiUpdate >= 1000) {
      renderWorldBanner(now);
      lastWorldUiUpdate = now;
    }

    sampleCityGrowth(now);
    if (now - lastEconomyUiUpdate >= 1000) {
      const payout = city.processEconomy(now);
      if (payout.ticks > 0) {
        renderHUD();
        if (inspectedBuilding) renderBuildingInspector();
        const cycleLabel = payout.ticks > 1 ? `${payout.ticks} siklus` : '1 siklus';
        const residentLabel = payout.residentsAdded > 0 ? ` ${payout.residentsAdded} warga baru menetap.` : '';
        showToast(`Kas kota menerima ${formatYen(payout.total)} dari ${cycleLabel}.${residentLabel}`, 'success');
      }
      renderEconomyPanel(now);
      lastEconomyUiUpdate = now;
    }
  }

  if (performanceMonitor) {
    const renderStartedAt = performance.now();
    renderer.render(scene, camera);
    const frameCompletedAt = performance.now();
    performanceMonitor.recordFrame(frameCompletedAt, renderer, frameCompletedAt - renderStartedAt);
  } else {
    renderer.render(scene, camera);
  }
}

function startNewGameLoading() {
  const startedAt = performance.now();
  let animationFrame = 0;

  loadingScreen.classList.remove('is-hidden', 'is-leaving');
  loadingScreen.classList.add('is-active');
  loadingProgress.style.width = '0%';
  loadingPercent.textContent = '0%';
  loadingStatus.textContent = getLoadingMessage(0);
  mainMenuScreen.classList.add('is-leaving');

  const updateLoading = (now) => {
    const elapsed = Math.max(0, now - startedAt);
    const progress = getLoadingProgress(elapsed);
    loadingProgress.style.width = `${(progress * 100).toFixed(2)}%`;
    loadingPercent.textContent = `${Math.round(progress * 100)}%`;
    loadingStatus.textContent = getLoadingMessage(elapsed);

    if (elapsed < LOADING_DURATION_MS) {
      animationFrame = requestAnimationFrame(updateLoading);
      newGameLoadingFrame = animationFrame;
      return;
    }

    cancelAnimationFrame(animationFrame);
    loadingStatus.textContent = 'Dunia siap dijelajahi';
    window.setTimeout(() => {
      loadingScreen.classList.add('is-leaving');
      window.setTimeout(() => {
        loadingScreen.classList.add('is-hidden');
        loadingScreen.classList.remove('is-active', 'is-leaving');
        mainMenuScreen.classList.add('is-hidden');
        mainMenuScreen.classList.remove('is-visible', 'is-leaving');
        mainMenuScreen.setAttribute('aria-hidden', 'true');
        mainMenuMessage.textContent = '';

        lastEconomyUiUpdate = Date.now();
        lastWorldUiUpdate = Date.now();
        if (!animationStarted) {
          animationStarted = true;
          animate();
        }
        // The finished loading screen hands off to a short cinematic welcome:
        // title first, then a lightweight wind sweep of sakura petals and leaves.
        showPostLoadingWelcome();
      }, 620);
    }, 160);
  };

  animationFrame = requestAnimationFrame(updateLoading);
  newGameLoadingFrame = animationFrame;
}

function clearWelcomeSequenceTimers() {
  for (const timer of welcomeSequenceTimers) window.clearTimeout(timer);
  welcomeSequenceTimers = [];
}

function scheduleWelcomeSequenceStep(callback, delay) {
  const timer = window.setTimeout(() => {
    welcomeSequenceTimers = welcomeSequenceTimers.filter((activeTimer) => activeTimer !== timer);
    callback();
  }, delay);
  welcomeSequenceTimers.push(timer);
  return timer;
}

function revealPlayableGame() {
  if (welcomeSplash) {
    welcomeSplash.classList.add('is-hidden');
    welcomeSplash.classList.remove('is-visible', 'is-leaving', 'is-game-intro', 'is-sakura-transition');
    welcomeSplash.setAttribute('aria-hidden', 'true');
  }

  gameUI.classList.remove('is-hidden');
  gameUI.classList.add('game-ui-entering');
  requestAnimationFrame(() => {
    gameUI.classList.remove('game-ui-entering');
    gameUI.classList.add('game-ui-visible');
    // Keep the first playable view clean. Build is opened only by the player.
    selectedBuildingId = null;
    buildMode = false;
    closeControlPanel();
    updateToolUI();
    showToast('Permukiman siap. Buka tab Build saat ingin memilih jalan dan bangunan pertama.', 'success');
  });
}

function showPostLoadingWelcome() {
  if (!welcomeSplash) {
    revealPlayableGame();
    return;
  }

  clearWelcomeSequenceTimers();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timing = getWelcomeSequenceTiming(reducedMotion);

  welcomeSplash.classList.remove('is-hidden', 'is-leaving', 'is-sakura-transition', 'is-visible', 'is-startup');
  welcomeSplash.classList.add('is-game-intro');
  welcomeSplash.setAttribute('aria-hidden', 'false');
  const windItems = welcomeSplash.querySelectorAll('.welcome-wind-layer i');
  windItems.forEach((item, index) => {
    const drift = 58 + Math.random() * 38;
    const midY = (Math.random() - 0.5) * 19;
    const endY = (Math.random() - 0.5) * 29;
    const duration = 2.35 + Math.random() * 1.25;
    const delay = Math.random() * 0.42 + index * 0.012;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 520);
    item.style.setProperty('--wind-drift-x', `${drift.toFixed(1)}vw`);
    item.style.setProperty('--wind-mid-y', `${midY.toFixed(1)}vh`);
    item.style.setProperty('--wind-end-y', `${endY.toFixed(1)}vh`);
    item.style.setProperty('--wind-duration', `${duration.toFixed(2)}s`);
    item.style.setProperty('--wind-delay', `${delay.toFixed(2)}s`);
    item.style.setProperty('--wind-spin', `${spin.toFixed(0)}deg`);
  });
  requestAnimationFrame(() => welcomeSplash.classList.add('is-visible'));

  // Let the title read clearly before the wind carries the scene into gameplay.
  scheduleWelcomeSequenceStep(() => {
    welcomeSplash.classList.add('is-sakura-transition');
    scheduleWelcomeSequenceStep(() => {
      welcomeSplash.classList.add('is-leaving');
      scheduleWelcomeSequenceStep(revealPlayableGame, timing.fadeOutMs);
    }, timing.windSweepMs);
  }, timing.titleHoldMs);
}

function beginNewGame() {
  if (gameStarted) return;
  if (menuTransitionTimer) window.clearTimeout(menuTransitionTimer);
  if (newGameLoadingFrame) cancelAnimationFrame(newGameLoadingFrame);
  clearWelcomeSequenceTimers();

  try {
    // Every New Game starts from the original Jōmon settlement. Save/Continue
    // remain disabled in this development build, so no prior city is restored.
    city.reset();
  } catch (error) {
    console.warn('A fresh in-memory city was created because browser storage reset was unavailable.', error);
    city = new CityManager(scene);
  }

  gameStarted = true;
  isGamePaused = false;
  pauseStartedAt = 0;
  if (controls) controls.enabled = true;
  $('#top-pause-button')?.setAttribute('aria-pressed', 'false');
  gameUI.classList.remove('game-is-paused');
  cityHistory.snapshots.length = 0;
  sampleCityGrowth(Date.now(), true);
  selectedBuildingId = null;
  selectedBuildCategory = null;
  resetTutorialCompanion();
  buildMode = false;
  inspectedBuilding = null;
  hoveredBuilding = null;
  activeTab = null;
  pointerStart = null;
  pointerDragging = false;
  if (preview) {
    preview.visible = false;
    preview.scale.set(1, 1, 1);
  }
  closeBuildingInspector();
  closeControlPanel();
  updateResourceSiteOverlay();
  resetMainCamera(camera, controls);
  renderBuildingMenu();
  renderHUD();
  renderWorldBanner(Date.now());
  lastEconomyUiUpdate = Date.now();
  lastWorldUiUpdate = Date.now();
  startNewGameLoading();
}

function returnToMainMenu() {
  if (!gameStarted) return;

  // Stop simulation first; the animation loop will pause on its next frame.
  gameStarted = false;
  isGamePaused = false;
  pauseStartedAt = 0;
  if (controls) controls.enabled = true;
  buildMode = false;
  selectedBuildingId = null;
  selectedBuildCategory = null;
  resetTutorialCompanion();
  activeTab = null;
  inspectedBuilding = null;
  hoveredBuilding = null;
  pointerStart = null;
  pointerDragging = false;
  cancelCameraFocus();
  hideHoverObjectLabel();
  if (preview) {
    preview.visible = false;
    preview.scale.set(1, 1, 1);
  }
  closeBuildingInspector();
  closeControlPanel();

  // Force-close the floating dock after its close animation is requested.
  if (dockPopover) {
    dockPopover.classList.remove('is-open', 'is-closing');
    dockPopover.hidden = true;
    dockPopover.setAttribute('aria-hidden', 'true');
  }
  for (const button of document.querySelectorAll('[data-panel]')) {
    button.classList.remove('is-active');
    button.setAttribute('aria-expanded', 'false');
  }

  // No save/continue exists yet: leaving the city discards this in-memory run.
  city.reset();
  resetMainCamera(camera, controls);
  renderBuildingMenu();
  renderHUD();
  closeExitLetter();
  mainMenuOptions.hidden = false;
  mainMenuSettings.hidden = true;
  mainMenuSettings.classList.remove('is-open', 'is-returning');
  mainMenuMessage.textContent = 'Kota telah ditutup. Sampai jumpa kembali!';
  gameUI.classList.remove('game-ui-visible', 'game-ui-entering');
  gameUI.classList.add('is-hidden');
  mainMenuScreen.classList.remove('is-visible', 'is-leaving');
  mainMenuScreen.classList.add('is-hidden');
  mainMenuScreen.setAttribute('aria-hidden', 'true');
  if (farewellScreen) {
    farewellScreen.classList.remove('is-hidden', 'is-leaving');
    farewellScreen.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => farewellScreen.classList.add('is-visible'));
  } else {
    mainMenuScreen.classList.remove('is-hidden');
    mainMenuScreen.classList.add('is-visible');
    mainMenuScreen.setAttribute('aria-hidden', 'false');
  }
  updateResourceSiteOverlay();
}

function openExitLetter() {
  if (!exitLetterScreen) return;
  mainMenuMessage.textContent = '';
  exitLetterScreen.classList.remove('is-hidden', 'is-closing', 'is-open', 'is-opening');
  exitLetterScreen.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => exitLetterScreen.classList.add('is-opening'));
  if (exitLetterTimer) window.clearTimeout(exitLetterTimer);
  exitLetterTimer = window.setTimeout(() => {
    exitLetterScreen.classList.add('is-open');
  }, 1050);
}

function closeExitLetter() {
  if (!exitLetterScreen || exitLetterScreen.classList.contains('is-hidden')) return;
  if (exitLetterTimer) window.clearTimeout(exitLetterTimer);
  exitLetterScreen.classList.remove('is-open', 'is-opening');
  exitLetterScreen.classList.add('is-closing');
  exitLetterScreen.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    exitLetterScreen.classList.add('is-hidden');
    exitLetterScreen.classList.remove('is-closing');
  }, 520);
}

function openMainMenuSettings() {
  mainMenuMessage.textContent = '';
  mainMenuOptions.hidden = true;
  mainMenuSettings.hidden = false;
  mainMenuSettings.classList.remove('is-returning');
  requestAnimationFrame(() => mainMenuSettings.classList.add('is-open'));
}

function closeMainMenuSettings() {
  mainMenuSettings.classList.remove('is-open');
  mainMenuSettings.classList.add('is-returning');
  window.setTimeout(() => {
    mainMenuSettings.hidden = true;
    mainMenuSettings.classList.remove('is-returning');
    mainMenuOptions.hidden = false;
    mainMenuMessage.textContent = '';
  }, 240);
}

function showWelcomeSplash() {
  if (!welcomeSplash) {
    mainMenuScreen.classList.remove('is-hidden', 'is-leaving');
    mainMenuScreen.classList.add('is-visible');
    mainMenuScreen.setAttribute('aria-hidden', 'false');
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startupFadeInDuration = reducedMotion ? 20 : 5_000;
  // Let the full five-second crest fade-in finish, then hold it briefly before transitioning to the menu.
  const visibleDuration = reducedMotion ? 500 : startupFadeInDuration + 650;
  const fadeDuration = reducedMotion ? 20 : 850;

  mainMenuScreen.classList.remove('is-visible', 'is-leaving');
  mainMenuScreen.classList.add('is-hidden');
  mainMenuScreen.setAttribute('aria-hidden', 'true');
  welcomeSplash.classList.remove('is-hidden', 'is-leaving', 'is-game-intro', 'is-sakura-transition', 'is-visible');
  welcomeSplash.classList.add('is-startup');
  welcomeSplash.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => welcomeSplash.classList.add('is-visible'));
  window.setTimeout(() => {
    welcomeSplash.classList.remove('is-visible');
    welcomeSplash.classList.add('is-leaving');
    window.setTimeout(() => {
      welcomeSplash.classList.add('is-hidden');
      welcomeSplash.classList.remove('is-leaving');
      welcomeSplash.setAttribute('aria-hidden', 'true');
      mainMenuScreen.classList.remove('is-hidden', 'is-leaving');
      mainMenuScreen.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => mainMenuScreen.classList.add('is-visible'));
    }, fadeDuration);
  }, visibleDuration);
}

function returnFromFarewellToMainMenu() {
  if (!farewellScreen) return;
  farewellScreen.classList.remove('is-visible');
  farewellScreen.classList.add('is-leaving');
  farewellScreen.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    farewellScreen.classList.add('is-hidden');
    farewellScreen.classList.remove('is-leaving');
    mainMenuScreen.classList.remove('is-hidden', 'is-leaving');
    mainMenuScreen.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => mainMenuScreen.classList.add('is-visible'));
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 480);
}

function setupMainMenu() {
  $('#new-game-button').addEventListener('click', beginNewGame);
  $('#farewell-main-menu-button')?.addEventListener('click', returnFromFarewellToMainMenu);
  $('#menu-settings-button').addEventListener('click', openMainMenuSettings);
  $('#menu-settings-back').addEventListener('click', closeMainMenuSettings);
  $('#exit-game-button').addEventListener('click', openExitLetter);
  $('#exit-letter-back-button').addEventListener('click', closeExitLetter);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && exitLetterScreen && !exitLetterScreen.classList.contains('is-hidden')) {
      closeExitLetter();
    }
  });
}

function initialiseApp() {
  try {
    setupScene();
    // No load, no automatic save, and no resume: every page access starts at
    // the title screen with a clean Jōmon session waiting behind the menu.
    try { city.reset(); } catch { /* fresh in-memory starter city remains available */ }
    setupInput();
    setupMainMenu();
    renderBuildingMenu();
    renderHUD();
    renderWorldBanner(Date.now());
    closeControlPanel();
    applyGraphicsQuality('balanced');
    loadingScreen.classList.add('is-hidden');
    showWelcomeSplash();
  } catch (error) {
    console.error(error);
    loadingScreen.classList.add('is-hidden');
    startupErrorScreen?.classList.remove('is-hidden');
    startupErrorScreen?.setAttribute('aria-hidden', 'false');
    const detail = $('#startup-error-detail');
    if (detail) detail.textContent = error?.message
      ? `Detail teknis: ${error.message}`
      : 'Browser tidak dapat menyiapkan dunia permainan.';
  }
}

$('#startup-error-reload')?.addEventListener('click', () => window.location.reload());

initialiseApp();
