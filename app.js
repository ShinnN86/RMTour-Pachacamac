import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let manifest = null;
let zonaActual = null;
let escenaActualIndex = 0;

let scene, camera, renderer, sphere, controls;
let raycaster, pointer;
let infoHotspot = null;

// Giroscopio nativo
let gyroActivo = false;
let gyroListenerActivo = false;
let yaw = 0;
let pitch = 0;

// Detección por apuntado
let gazeStartTime = null;
let infoAbiertaPorApuntado = false;

const GAZE_OPEN_DELAY = 700;
const CENTER_GAZE_RADIUS = 0.16;

// UI principal
const projectTitleEl = document.getElementById("projectTitle");
const sceneTitleEl = document.getElementById("sceneTitle");
const sceneInfoEl = document.getElementById("sceneInfo");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const overlayPanel = document.getElementById("overlayPanel");
const togglePanelBtn = document.getElementById("togglePanelBtn");
const gyroBtn = document.getElementById("gyroBtn");

// Menú Lugares
const lugaresToggleBtn = document.getElementById("lugaresToggleBtn");
const lugaresList = document.getElementById("lugaresList");
const lugaresChevron = document.getElementById("lugaresChevron");

// Modal de información
const infoBtn = document.getElementById("infoBtn");
const infoModalOverlay = document.getElementById("infoModalOverlay");
const closeInfoBtn = document.getElementById("closeInfoBtn");
const infoCardTitle = document.getElementById("infoCardTitle");
const infoCardContent = document.getElementById("infoCardContent");

// Puntero central
const centerPointer = document.getElementById("centerPointer");

// Información por escena
const infoEscenas = {
  zona1: [
    {
      titulo: "Zona 1 - Escena 1",
      texto:
        "Vista panorámica inicial de la Zona 1. Aquí se aprecia el entorno general y la distribución espacial del sitio."
    },
    {
      titulo: "Zona 1 - Escena 2",
      texto:
        "En esta escena se observa una perspectiva más cercana del recorrido y de los principales elementos del entorno."
    },
    {
      titulo: "Zona 1 - Escena 3",
      texto:
        "Esta escena permite identificar detalles arquitectónicos y visuales relevantes del espacio recorrido."
    },
    {
      titulo: "Zona 1 - Escena 4",
      texto:
        "Vista complementaria de la Zona 1, útil para apreciar la continuidad del recorrido panorámico."
    },
    {
      titulo: "Zona 1 - Escena 5",
      texto: "Información descriptiva de esta escena."
    },
    {
      titulo: "Zona 1 - Escena 6",
      texto: "Información descriptiva de esta escena."
    },
    {
      titulo: "Zona 1 - Escena 7",
      texto: "Información descriptiva de esta escena."
    }
  ],
  zona2: [
    {
      titulo: "Zona 2 - Escena 1",
      texto:
        "Ingreso visual a la Zona 2 con una vista panorámica general del área."
    },
    {
      titulo: "Zona 2 - Escena 2",
      texto:
        "En esta escena pueden apreciarse otros detalles del recorrido y del espacio circundante."
    },
    {
      titulo: "Zona 2 - Escena 3",
      texto: "Descripción de la escena 3 de la Zona 2."
    },
    {
      titulo: "Zona 2 - Escena 4",
      texto: "Descripción de la escena 4 de la Zona 2."
    },
    {
      titulo: "Zona 2 - Escena 5",
      texto: "Descripción de la escena 5 de la Zona 2."
    },
    {
      titulo: "Zona 2 - Escena 6",
      texto: "Descripción de la escena 6 de la Zona 2."
    },
    {
      titulo: "Zona 2 - Escena 7",
      texto: "Descripción de la escena 7 de la Zona 2."
    },
    {
      titulo: "Zona 2 - Escena 8",
      texto: "Descripción de la escena 8 de la Zona 2."
    },
    {
      titulo: "Zona 2 - Escena 9",
      texto: "Descripción de la escena 9 de la Zona 2."
    }
  ],
  zona3: [
    {
      titulo: "Zona 3 - Escena 1",
      texto: "Vista de apertura de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 2",
      texto: "Descripción de la escena 2 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 3",
      texto: "Descripción de la escena 3 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 4",
      texto: "Descripción de la escena 4 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 5",
      texto: "Descripción de la escena 5 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 6",
      texto: "Descripción de la escena 6 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 7",
      texto: "Descripción de la escena 7 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 8",
      texto: "Descripción de la escena 8 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 9",
      texto: "Descripción de la escena 9 de la Zona 3."
    },
    {
      titulo: "Zona 3 - Escena 10",
      texto: "Descripción de la escena 10 de la Zona 3."
    }
  ]
};

function esMovil() {
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
}

async function init() {
  try {
    initThree();

    const response = await fetch("./Manifest.json");
    if (!response.ok) {
      throw new Error(`No se pudo cargar Manifest.json (${response.status})`);
    }

    manifest = await response.json();
    projectTitleEl.textContent = manifest.nombre || "Tour VR";

    bindLugaresMenu();

    if (gyroBtn) {
      gyroBtn.style.display = esMovil() ? "inline-block" : "none";
    }

    if (manifest.zonas?.length > 0) {
      cargarZona(manifest.zonas[0].id);
    } else {
      sceneTitleEl.textContent = "Sin escenas";
      sceneInfoEl.textContent = "No hay zonas registradas en el manifest.";
    }
  } catch (error) {
    console.error("Error al iniciar:", error);
    projectTitleEl.textContent = "Error";
    sceneTitleEl.textContent = "No se pudo iniciar";
    sceneInfoEl.textContent = error.message;
  }
}

function initThree() {
  const container = document.getElementById("panorama");

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    1100
  );
  camera.position.set(0, 0, 0.1);
  camera.rotation.order = "YXZ";

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  container.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);

  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = -0.25;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  renderer.domElement.addEventListener("click", onSceneClick);
  renderer.domElement.addEventListener("mousemove", onSceneMouseMove);

  crearHotspotInfo();

  renderer.setAnimationLoop(() => {
    if (!renderer.xr.isPresenting) {
      if (gyroActivo) {
        camera.rotation.order = "YXZ";
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
      } else {
        controls.update();
      }
    }

    if (infoHotspot) {
      infoHotspot.lookAt(camera.position);
    }

    detectarApuntadoAutomatico();
    renderer.render(scene, camera);
  });

  window.addEventListener("resize", onWindowResize);
}

function bindLugaresMenu() {
  lugaresToggleBtn?.addEventListener("click", () => {
    lugaresList?.classList.toggle("open");
    lugaresChevron?.classList.toggle("rotated");
  });

  document.querySelectorAll(".lugar-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const zonaId = btn.dataset.zona;
      if (zonaId) {
        cargarZona(zonaId);
      }
    });
  });
}

function crearHotspotInfo() {
  if (infoHotspot) {
    scene.remove(infoHotspot);
    infoHotspot = null;
  }

  const group = new THREE.Group();

  const circleGeo = new THREE.CircleGeometry(6, 48);
  const circleMat = new THREE.MeshBasicMaterial({
    color: 0x00bcd4,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const circle = new THREE.Mesh(circleGeo, circleMat);
  group.add(circle);

  const ringGeo = new THREE.RingGeometry(7, 9, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  group.add(ring);

  const sprite = crearTextoSprite("i");
  sprite.scale.set(6, 6, 1);
  sprite.position.set(0, 0, 1);
  group.add(sprite);

  group.position.set(0, -20, -120);
  group.userData.isInfoHotspot = true;

  infoHotspot = group;
  scene.add(infoHotspot);
}

function crearTextoSprite(texto) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "bold 180px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, canvas.width / 2, canvas.height / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  return new THREE.Sprite(material);
}

function onSceneMouseMove(event) {
  if (!infoHotspot) return;

  updatePointer(event);

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(infoHotspot, true);

  renderer.domElement.style.cursor =
    intersects.length > 0 ? "pointer" : "default";
}

function onSceneClick(event) {
  if (!infoHotspot) return;
  if (infoModalOverlay && !infoModalOverlay.classList.contains("hidden")) return;

  updatePointer(event);

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(infoHotspot, true);

  if (intersects.length > 0) {
    abrirInfoEscena();
  }
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function detectarApuntadoAutomatico() {
  if (!infoHotspot || !camera || !raycaster || !zonaActual) return;

  if (infoModalOverlay && !infoModalOverlay.classList.contains("hidden")) {
    gazeStartTime = null;
    centerPointer?.classList.remove("active");
    return;
  }

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const intersects = raycaster.intersectObject(infoHotspot, true);

  const screenPos = infoHotspot.position.clone().project(camera);
  const dentroDelCentro =
    Math.abs(screenPos.x) < CENTER_GAZE_RADIUS &&
    Math.abs(screenPos.y) < CENTER_GAZE_RADIUS &&
    screenPos.z < 1;

  const apuntando = intersects.length > 0 && dentroDelCentro;

  if (apuntando) {
    centerPointer?.classList.add("active");

    if (gazeStartTime === null) {
      gazeStartTime = performance.now();
    }

    const elapsed = performance.now() - gazeStartTime;

    if (elapsed >= GAZE_OPEN_DELAY && !infoAbiertaPorApuntado) {
      abrirInfoEscena();
      infoAbiertaPorApuntado = true;
    }
  } else {
    gazeStartTime = null;
    infoAbiertaPorApuntado = false;
    centerPointer?.classList.remove("active");
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function cargarZona(zonaId) {
  if (!manifest?.zonas) return;

  zonaActual = manifest.zonas.find((z) => z.id === zonaId);
  if (!zonaActual) return;

  escenaActualIndex = 0;
  marcarLugarActivo(zonaId);
  cargarEscena(0);
}

function marcarLugarActivo(zonaId) {
  document.querySelectorAll(".lugar-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.zona === zonaId);
  });
}

function cargarEscena(index) {
  if (!zonaActual) return;
  if (index < 0 || index >= zonaActual.imagenes.length) return;

  const ruta = `${zonaActual.ruta}${zonaActual.imagenes[index]}`;
  console.log("Cargando:", ruta);

  const loader = new THREE.TextureLoader();
  loader.load(
    ruta,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      sphere.material.map = texture;
      sphere.material.needsUpdate = true;

      escenaActualIndex = index;
      actualizarPanelInfo();
      cerrarInfoEscena();

      gazeStartTime = null;
      infoAbiertaPorApuntado = false;

      actualizarPosicionHotspot();
    },
    undefined,
    (error) => {
      console.error("Error cargando textura:", ruta, error);
      sceneTitleEl.textContent = "Error de carga";
      sceneInfoEl.textContent = `No se pudo cargar ${ruta}`;
    }
  );
}

function actualizarPosicionHotspot() {
  if (!infoHotspot || !zonaActual) return;

  if (zonaActual.id === "zona1") {
    infoHotspot.position.set(0, -20, -120);
  } else if (zonaActual.id === "zona2") {
    infoHotspot.position.set(40, -10, -110);
  } else if (zonaActual.id === "zona3") {
    infoHotspot.position.set(-45, -5, -115);
  } else {
    infoHotspot.position.set(0, -20, -120);
  }
}

function actualizarPanelInfo() {
  if (!zonaActual) return;

  const archivo = zonaActual.imagenes[escenaActualIndex];
  sceneTitleEl.textContent =
    `${zonaActual.nombre} - Escena ${escenaActualIndex + 1}`;
  sceneInfoEl.textContent = `Archivo: ${archivo}`;

  prevBtn.disabled = escenaActualIndex === 0;
  nextBtn.disabled = escenaActualIndex === zonaActual.imagenes.length - 1;
}

function abrirInfoEscena() {
  if (!zonaActual || !infoModalOverlay || !infoCardTitle || !infoCardContent) return;

  const dataZona = infoEscenas[zonaActual.id];
  const dataEscena = dataZona?.[escenaActualIndex];

  infoCardTitle.textContent =
    dataEscena?.titulo ||
    `${zonaActual.nombre} - Escena ${escenaActualIndex + 1}`;

  infoCardContent.textContent =
    dataEscena?.texto || "No hay información registrada para esta escena.";

  infoModalOverlay.classList.remove("hidden");
}

function cerrarInfoEscena() {
  if (!infoModalOverlay) return;

  infoModalOverlay.classList.add("hidden");
  gazeStartTime = null;
  infoAbiertaPorApuntado = false;
  centerPointer?.classList.remove("active");
}

function manejarOrientacion(event) {
  if (!gyroActivo) return;

  const alpha = event.alpha;
  const beta = event.beta;

  if (alpha == null || beta == null) return;

  yaw = THREE.MathUtils.degToRad(alpha);

  const betaClamped = Math.max(-85, Math.min(85, beta));
  pitch = THREE.MathUtils.degToRad(betaClamped);
}

async function activarGiroscopio() {
  if (!esMovil()) return;

  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const permission = await DeviceOrientationEvent.requestPermission();

      if (permission !== "granted") {
        alert("No se concedió permiso para usar el giroscopio.");
        return;
      }
    }

    if (!gyroListenerActivo) {
      window.addEventListener("deviceorientation", manejarOrientacion, true);
      gyroListenerActivo = true;
    }

    gyroActivo = true;
    controls.enabled = false;

    if (gyroBtn) {
      gyroBtn.textContent = "Gyro ON";
    }
  } catch (error) {
    console.error("Error activando giroscopio:", error);
    alert("No se pudo activar el giroscopio en este dispositivo.");
  }
}

function desactivarGiroscopio() {
  gyroActivo = false;
  controls.enabled = true;

  if (gyroBtn) {
    gyroBtn.textContent = "Giroscopio";
  }
}

prevBtn?.addEventListener("click", () => {
  if (escenaActualIndex > 0) {
    cargarEscena(escenaActualIndex - 1);
  }
});

nextBtn?.addEventListener("click", () => {
  if (zonaActual && escenaActualIndex < zonaActual.imagenes.length - 1) {
    cargarEscena(escenaActualIndex + 1);
  }
});

fullscreenBtn?.addEventListener("click", async () => {
  const elem = document.documentElement;

  if (!document.fullscreenElement) {
    await elem.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
});

togglePanelBtn?.addEventListener("click", () => {
  overlayPanel?.classList.toggle("collapsed");
});

infoBtn?.addEventListener("click", abrirInfoEscena);
closeInfoBtn?.addEventListener("click", cerrarInfoEscena);

gyroBtn?.addEventListener("click", async () => {
  if (!esMovil()) return;

  if (gyroActivo) {
    desactivarGiroscopio();
  } else {
    await activarGiroscopio();
  }
});

infoModalOverlay?.addEventListener("click", (e) => {
  if (e.target === infoModalOverlay) {
    cerrarInfoEscena();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarInfoEscena();
  }
});

init();
