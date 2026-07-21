import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let vozLectura = null; // Audio
let manifest = null;
let zonaActual = null;
let infoEscenas = {};
let escenaActualIndex = 0;
let zonaActualIndex = 0;

let scene, camera, renderer, sphere, controls;
let raycaster, pointer;
let infoHotspot = null;

// Giroscopio
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
const floatingBtn = document.getElementById("floatingMenuBtn");
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

// Puntero central
const centerPointer = document.getElementById("centerPointer");

// Mini mapa
const gpsMarker = document.getElementById("gpsMarker");
const mapPoints = document.querySelectorAll(".map-point");

const toggleMapBtn = document.getElementById("toggleMapBtn");
const miniMap = document.getElementById("miniMap");


toggleMapBtn.addEventListener("click", () => {
  miniMap.classList.toggle("hidden");
});
const infoCardDescription =
  document.getElementById("infoCardDescription");
const infoCardSubtitle =
  document.getElementById("infoCardSubtitle");

const infoCardImage =
  document.getElementById("infoCardImage");



const infoLocation = document.getElementById("infoLocation");

const infoReading = document.getElementById("infoReading");

const playAudioBtn = document.getElementById("playAudioBtn");

const viewModelBtn = document.getElementById("viewModelBtn");


// Coordenadas del mapa por zona
const mapaCoords = {
  zona1: { left: "32%", top: "22%" },
  zona2: { left: "65%", top: "22%" },
  zona3: { left: "64%", top: "43%" },
  zona4: { left: "57%", top: "57%" },
  zona5: { left: "59%", top: "63%" },
  zona6: { left: "55%", top: "82%" }

};

async function cargarInfo() {
  const response = await fetch("info.json");
  if (!response.ok) {
    throw new Error("No se pudo cargar info.json");
  }
  infoEscenas = await response.json();

}

function esMovil() {
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
}

async function init() {
  try {
    initThree();

    const response = await fetch("Manifest.json");
    if (!response.ok) {
      throw new Error(`No se pudo cargar Manifest.json (${response.status})`);
    }

    manifest = await response.json();
    projectTitleEl.textContent = manifest.nombre || "Tour VR";
    await cargarInfo();
    bindLugaresMenu();
    bindMiniMapa();

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
    60,
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

  const geometry = new THREE.SphereGeometry(1000, 60, 40);
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
    if (infoHotspot) {
      const t = performance.now() * 0.001;
      //Flotar
      infoHotspot.position.y += Math.sin(t * 2) * 0.015;
      //Rotar halo
      const glow = infoHotspot.getObjectByName("glow");

      if (glow) {
        glow.rotation.z += 0.01;
        glow.scale.setScalar(
          1 + Math.sin(t * 4) * 0.08
        );
      }
    }
    renderer.render(scene, camera);
  });
  window.addEventListener("resize", onWindowResize);
}

function bindLugaresMenu() {
  lugaresToggleBtn?.addEventListener("click", () => {
    lugaresList?.classList.toggle("open");
    lugaresChevron?.classList.toggle("rotated");
  });

}

function bindMiniMapa() {
  mapPoints.forEach((point) => {
    point.addEventListener("click", () => {
      const zonaId = point.dataset.zona;
      if (zonaId) {
        cargarZona(zonaId);
      }
    });
  });
}

function actualizarMiniMapa() {
  if (!gpsMarker || !zonaActual) return;

  const pos = mapaCoords[zonaActual.id];
  if (!pos) return;
  gpsMarker.style.left = pos.left;
  gpsMarker.style.top = pos.top;
  mapPoints.forEach((point) => {
    point.classList.toggle("active", point.dataset.zona === zonaActual.id);
  });
}

function crearHotspotInfo() {
  if (infoHotspot) {
    scene.remove(infoHotspot);
  }
  const group = new THREE.Group();
  // Disco principal
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 64),
    new THREE.MeshBasicMaterial({
      color: 0x00cfff,
      transparent: true,
      opacity: 0.85
    })
  );

  group.add(base);
  // Borde
  const borde = new THREE.Mesh(
    new THREE.RingGeometry(4.4, 5.2, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1
    })
  );
  group.add(borde);
  // Halo exterior
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(5.5, 7.2, 64),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    })
  );
  glow.name = "glow";
  group.add(glow);
  // Texto
  const sprite = crearTextoSprite("i");
  sprite.scale.set(5, 5, 1);
  sprite.position.z = 1;
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

function cargarZona(zonaId, escena = 0) {

  if (!manifest?.zonas) return;

  const nuevoIndice = manifest.zonas.findIndex(
    z => z.id === zonaId
  );

  if (nuevoIndice === -1) return;

  zonaActualIndex = nuevoIndice;

  zonaActual = manifest.zonas[zonaActualIndex];

  escenaActualIndex = escena;

  actualizarMiniMapa();

  cargarEscena(escena);

  actualizarHotspotInfo();

}
/*function marcarLugarActivo(zonaId) {
  document.querySelectorAll(".lugar-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.zona === zonaId);
  });
}*/

function cargarEscena(index) {

  if (!zonaActual) return;
  if (index < 0 || index >= zonaActual.imagenes.length) return;


  // actualizar inmediatamente
  escenaActualIndex = index;


  const ruta = `${zonaActual.ruta}${zonaActual.imagenes[index]}`;

  console.log("Cargando:", ruta);


  const loader = new THREE.TextureLoader();

  loader.load(
    ruta,
    (texture) => {

      texture.colorSpace = THREE.SRGBColorSpace;

      sphere.material.map = texture;
      sphere.material.needsUpdate = true;


      actualizarPanelInfo();

      actualizarHotspotInfo();

      detenerLectura();
      cerrarInfoEscena();
      actualizarPosicionHotspot();
      gazeStartTime = null;
      infoAbiertaPorApuntado = false;

    }
  );
}

function actualizarPosicionHotspot() {
  if (!infoHotspot || !zonaActual) return;

  if (zonaActual.id === "zona1") {
    infoHotspot.position.set(48, -12, -170);
  } else if (zonaActual.id === "zona2") {
    infoHotspot.position.set(40, -10, -110);
  } else if (zonaActual.id === "zona3") {
    infoHotspot.position.set(-45, -5, -115);
  } else if (zonaActual.id === "zona4") {
    infoHotspot.position.set(10, -8, -110);
  } else if (zonaActual.id === "zona5") {
    infoHotspot.position.set(-18, -12, -112);
  } else {
    infoHotspot.position.set(0, -20, -120);
  }
}

function actualizarPanelInfo() {
  if (!zonaActual) return;

  const archivo = zonaActual.imagenes[escenaActualIndex];

  sceneTitleEl.textContent =
    `${zonaActual.nombre} - Escena ${escenaActualIndex + 1}`;

  sceneInfoEl.textContent =
    `Archivo: ${archivo}`;


  // Desactivar anterior solo si es la primera escena
  prevBtn.disabled =
    escenaActualIndex === 0
    && zonaActualIndex === 0;


  // IMPORTANTE:
  // nunca bloquear siguiente porque puede cambiar de zona
  nextBtn.disabled = false;

}


function actualizarHotspotInfo() {

  if (!infoHotspot || !zonaActual) return;


  const data = infoEscenas?.[zonaActual.id]?.[escenaActualIndex];


  if (data && data.mostrarHotspot) {

    infoHotspot.visible = true;

  } else {

    infoHotspot.visible = false;

  }

}
function abrirInfoEscena() {

  if (!zonaActual || !infoModalOverlay) return;

  const data = infoEscenas?.[zonaActual.id]?.[escenaActualIndex];
  if (!data || !data.mostrarHotspot) {
    infoHotspot.visible = false;
    return;
  }

  infoHotspot.visible = true;

  if (!data) return;

  infoCardTitle.textContent = data.titulo || "";

  infoCardSubtitle.textContent = data.subtitulo || "";

  infoCardDescription.textContent = data.descripcion || "";
  if (data.modeloUrl) {
    viewModelBtn.dataset.url = data.modeloUrl;
    viewModelBtn.style.display = "inline-flex";
  } else {
    viewModelBtn.style.display = "none";
  }

  if (data.imagen) {
    infoCardImage.src = data.imagen;
    infoCardImage.style.display = "block";
  } else {
    infoCardImage.style.display = "none";
  }

  infoLocation.textContent = "📍 Pachacamac";
  infoReading.textContent = "⏱ 1 min lectura";

  playAudioBtn.style.display =
    data.audio ? "inline-flex" : "none";


  infoModalOverlay.classList.remove("hidden");
}

function cerrarInfoEscena() {

  if (!infoModalOverlay) return;

  detenerLectura();

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

  if (!zonaActual) return;
  console.log("ANTES PREV");
  console.log("Zona:", zonaActual.id);
  console.log("Indice zona:", zonaActualIndex);
  console.log("Escena:", escenaActualIndex);
  console.log("Total escenas:", zonaActual.imagenes.length);

  if (escenaActualIndex > 0) {

    console.log("IR A ESCENA ANTERIOR");

    cargarEscena(escenaActualIndex - 1);

    return;
  }

  console.log("PRIMERA ESCENA - CAMBIO DE ZONA HACIA ATRÁS");
  if (zonaActualIndex > 0) {

    const zonaAnterior =
      manifest.zonas[zonaActualIndex - 1];
    console.log(
      "Nueva zona:",
      zonaAnterior.id
    );
    console.log(
      "Última escena de zona anterior:",
      zonaAnterior.imagenes.length - 1
    );
    cargarZona(
      zonaAnterior.id,
      zonaAnterior.imagenes.length - 1
    );
  } else {

    console.log("YA ESTÁS EN LA PRIMERA ZONA");
  }

});

nextBtn?.addEventListener("click", () => {

  if (!zonaActual) return;
  console.log("ANTES");
  console.log("Zona:", zonaActual.id);
  console.log("Indice zona:", zonaActualIndex);
  console.log("Escena:", escenaActualIndex);
  console.log("Total:", zonaActual.imagenes.length);

  //más
  if (escenaActualIndex < zonaActual.imagenes.length - 1) {

    cargarEscena(escenaActualIndex + 1);

    return;
  }

  console.log("CAMBIO DE ZONA");
  if (zonaActualIndex < manifest.zonas.length - 1) {
    const nuevaZona =
      manifest.zonas[zonaActualIndex + 1];
    console.log(
      "Nueva zona:",
      nuevaZona.id
    );
    cargarZona(nuevaZona.id, 0);
  } else {

    console.log("FIN DEL RECORRIDO");

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

// estado inicial
floatingBtn.style.display = "none";

// botón del panel (cerrar/abrir)
togglePanelBtn?.addEventListener("click", () => {
  overlayPanel.classList.toggle("collapsed");

  const isClosed = overlayPanel.classList.contains("collapsed");

  floatingBtn.style.display = isClosed ? "block" : "none";
});

// botón flotante (abrir)
floatingBtn?.addEventListener("click", () => {
  overlayPanel.classList.remove("collapsed");
  floatingBtn.style.display = "none";
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



const expandMapBtn = document.getElementById("expandMapBtn");
const closeMapBtn = document.getElementById("closeMapBtn");
const mapOverlay = document.getElementById("mapOverlay");
const miniMapCanvas = document.getElementById("miniMapCanvas");
const mapExpandedContent = document.getElementById("mapExpandedContent");

expandMapBtn?.addEventListener("click", () => {
  abrirMapaGrande();
});

closeMapBtn?.addEventListener("click", () => {
  cerrarMapaGrande();
});

function abrirMapaGrande() {
  if (!miniMapCanvas || !mapExpandedContent) return;

  // Clonar mapa
  const clone = miniMapCanvas.cloneNode(true);

  // limpiar contenedor
  mapExpandedContent.innerHTML = "";
  mapExpandedContent.appendChild(clone);

  mapOverlay.classList.remove("hidden");

  // volver a bindear eventos del mapa
  const puntos = clone.querySelectorAll(".map-point");
  puntos.forEach(p => {
    p.addEventListener("click", () => {
      const zonaId = p.dataset.zona;
      if (zonaId) cargarZona(zonaId);
      cerrarMapaGrande();
    });
  });

  // actualizar gps
  const gps = clone.querySelector("#gpsMarker");
  if (gps && zonaActual) {
    const pos = mapaCoords[zonaActual.id];
    if (pos) {
      gps.style.left = pos.left;
      gps.style.top = pos.top;
    }
  }
}

function cerrarMapaGrande() {
  mapOverlay.classList.add("hidden");
}
viewModelBtn?.addEventListener("click", () => {

  const url = viewModelBtn.dataset.url;

  if (!url) {
    alert("No hay un modelo 3D disponible para esta escena.");
    return;
  }

  window.open(url, "_blank");

});

playAudioBtn?.addEventListener("click", () => {

  reproducirDescripcion();

});



function reproducirDescripcion() {

  const texto = infoCardDescription.textContent;

  if (!texto) return;

  // detener una lectura anterior
  window.speechSynthesis.cancel();

  vozLectura = new SpeechSynthesisUtterance(texto);

  vozLectura.lang = "es-ES";
  vozLectura.rate = 1;
  vozLectura.pitch = 1;
  vozLectura.volume = 1;

  window.speechSynthesis.speak(vozLectura);
}

function detenerLectura() {

  window.speechSynthesis.cancel();

}


init();
