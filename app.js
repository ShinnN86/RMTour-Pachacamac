let manifest = null;
let viewer = null;
let zonaActual = null;
let escenaActualIndex = 0;

// Elementos UI
const zoneListEl = document.getElementById("zoneList");
const projectTitleEl = document.getElementById("projectTitle");
const sceneTitleEl = document.getElementById("sceneTitle");
const sceneInfoEl = document.getElementById("sceneInfo");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const overlayPanel = document.getElementById("overlayPanel");
const togglePanelBtn = document.getElementById("togglePanelBtn");

async function init() {
  try {
    const response = await fetch("Manifest.json");
    if (!response.ok) {
      throw new Error("No se pudo cargar manifest.json");
    }

    manifest = await response.json();

    projectTitleEl.textContent = manifest.nombre || "Tour 360";
    renderBotonesZona();

    if (manifest.zonas && manifest.zonas.length > 0) {
      cargarZona(manifest.zonas[0].id);
    } else {
      sceneTitleEl.textContent = "Sin escena";
      sceneInfoEl.textContent = "No hay zonas en el manifest.";
    }
  } catch (error) {
    console.error(error);
    projectTitleEl.textContent = "Error";
    sceneTitleEl.textContent = "Sin escena";
    sceneInfoEl.textContent =
      "No se pudo cargar el manifest. Verifica que uses servidor local.";
  }
}

function renderBotonesZona() {
  zoneListEl.innerHTML = "";

  manifest.zonas.forEach((zona) => {
    const btn = document.createElement("button");
    btn.className = "zone-button";
    btn.textContent = `${zona.nombre} (${zona.imagenes.length} escenas)`;
    btn.dataset.zoneId = zona.id;

    btn.addEventListener("click", () => {
      cargarZona(zona.id);
    });

    zoneListEl.appendChild(btn);
  });
}

function marcarZonaActiva(zonaId) {
  const buttons = document.querySelectorAll(".zone-button");

  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.zoneId === zonaId);
  });
}

function cargarZona(zonaId) {
  const zona = manifest.zonas.find((z) => z.id === zonaId);
  if (!zona) return;

  zonaActual = zona;
  escenaActualIndex = 0;

  marcarZonaActiva(zona.id);
  crearViewerZona(zona);
  actualizarPanelInfo();
}

function crearViewerZona(zona) {
  const scenes = {};

  zona.imagenes.forEach((imagen, index) => {
    const sceneId = `scene${index}`;
    const hotSpots = [];

    if (index > 0) {
      hotSpots.push({
        pitch: -6,
        yaw: -35,
        type: "scene",
        text: "Escena anterior",
        sceneId: `scene${index - 1}`,
        cssClass: "custom-hotspot"
      });
    }

    if (index < zona.imagenes.length - 1) {
      hotSpots.push({
        pitch: -6,
        yaw: 25,
        type: "scene",
        text: "Escena siguiente",
        sceneId: `scene${index + 1}`,
        cssClass: "custom-hotspot"
      });
    }

    scenes[sceneId] = {
      type: "equirectangular",
      panorama: zona.ruta + imagen,
      hfov: 110,
      pitch: 0,
      yaw: 0,
      hotSpots
    };
  });

  const panoramaEl = document.getElementById("panorama");
  panoramaEl.innerHTML = "";

  viewer = pannellum.viewer("panorama", {
    default: {
      firstScene: "scene0",
      sceneFadeDuration: 500,
      autoLoad: true,
      autoRotate: 0,
      showControls: true
    },
    scenes
  });

  viewer.on("scenechange", (sceneId) => {
    const index = parseInt(sceneId.replace("scene", ""), 10);

    if (!Number.isNaN(index)) {
      escenaActualIndex = index;
      actualizarPanelInfo();
      precargarSiguienteEscena(index);
    }
  });

  viewer.on("load", () => {
    actualizarPanelInfo();
    precargarSiguienteEscena(escenaActualIndex);
  });
}

function actualizarPanelInfo() {
  if (!zonaActual) return;

  const archivo = zonaActual.imagenes[escenaActualIndex];

  sceneTitleEl.textContent = `${zonaActual.nombre} - Escena ${escenaActualIndex + 1}`;
  sceneInfoEl.textContent = `Archivo: ${archivo}`;

  prevBtn.disabled = escenaActualIndex === 0;
  nextBtn.disabled = escenaActualIndex === zonaActual.imagenes.length - 1;
}

function irAEscena(index) {
  if (!viewer || !zonaActual) return;
  if (index < 0 || index >= zonaActual.imagenes.length) return;

  escenaActualIndex = index;
  viewer.loadScene(`scene${index}`);
  actualizarPanelInfo();
}

function precargarSiguienteEscena(index) {
  if (!zonaActual) return;

  const nextIndex = index + 1;
  if (nextIndex < zonaActual.imagenes.length) {
    const nextImg = new Image();
    nextImg.src = zonaActual.ruta + zonaActual.imagenes[nextIndex];
  }
}

prevBtn.addEventListener("click", () => {
  irAEscena(escenaActualIndex - 1);
});

nextBtn.addEventListener("click", () => {
  irAEscena(escenaActualIndex + 1);
});

fullscreenBtn.addEventListener("click", () => {
  const elem = document.documentElement;

  if (!document.fullscreenElement) {
    elem.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

if (togglePanelBtn) {
  togglePanelBtn.addEventListener("click", () => {
    overlayPanel.classList.toggle("collapsed");
  });
}

init();
