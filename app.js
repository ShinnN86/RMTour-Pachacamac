import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let vozLectura = null;
let manifest = null;
let zonaActual = null;
let infoEscenas = {};
let escenaActualIndex = 0;
let zonaActualIndex = 0;

let scene, camera, renderer, sphere, controls;
let raycaster, pointer;

let infoHotspot = null;

// ========================================
// BOTONES 3D DE NAVEGACIÓN
// ========================================

let navigationHotspots = [];

const gltfLoader = new GLTFLoader();

const RUTA_AVANZAR = "modelos/avanzar.glb";
const RUTA_RETROCEDER = "modelos/retroceder.glb";

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
const infoCardDescription = document.getElementById("infoCardDescription");
const infoCardSubtitle = document.getElementById("infoCardSubtitle");
const infoCardImage = document.getElementById("infoCardImage");
const infoLocation = document.getElementById("infoLocation");
const infoReading = document.getElementById("infoReading");
const playAudioBtn = document.getElementById("playAudioBtn");
const viewModelBtn = document.getElementById("viewModelBtn");

// Puntero central
const centerPointer = document.getElementById("centerPointer");

// Mini mapa
const gpsMarker = document.getElementById("gpsMarker");
const mapPoints = document.querySelectorAll(".map-point");

const toggleMapBtn = document.getElementById("toggleMapBtn");
const miniMap = document.getElementById("miniMap");

toggleMapBtn?.addEventListener("click", () => {
  miniMap?.classList.toggle("hidden");
});

// Coordenadas del mapa por zona
const mapaCoords = {
  zona1: { left: "32%", top: "22%" },
  zona2: { left: "65%", top: "22%" },
  zona3: { left: "64%", top: "43%" },
  zona4: { left: "57%", top: "57%" },
  zona5: { left: "59%", top: "63%" },
  zona6: { left: "55%", top: "82%" }
};

// ========================================
// CARGAR INFORMACIÓN
// ========================================

async function cargarInfo() {
  const response = await fetch("info.json");

  if (!response.ok) {
    throw new Error("No se pudo cargar info.json");
  }

  infoEscenas = await response.json();
}

// ========================================
// DETECTAR MÓVIL
// ========================================

function esMovil() {
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(
    navigator.userAgent
  );
}

// ========================================
// INICIO
// ========================================

async function init() {
  try {
    initThree();

    const response = await fetch("Manifest.json");

    if (!response.ok) {
      throw new Error(
        `No se pudo cargar Manifest.json (${response.status})`
      );
    }

    manifest = await response.json();

    projectTitleEl.textContent =
      manifest.nombre || "Tour VR";

    await cargarInfo();

    bindLugaresMenu();
    bindMiniMapa();

    if (gyroBtn) {
      gyroBtn.style.display = esMovil()
        ? "inline-block"
        : "none";
    }

    if (manifest.zonas?.length > 0) {
      cargarZona(manifest.zonas[0].id);
    } else {
      sceneTitleEl.textContent = "Sin escenas";
      sceneInfoEl.textContent =
        "No hay zonas registradas en el manifest.";
    }

  } catch (error) {
    console.error("Error al iniciar:", error);

    projectTitleEl.textContent = "Error";
    sceneTitleEl.textContent = "No se pudo iniciar";
    sceneInfoEl.textContent = error.message;
  }
}

// ========================================
// THREE.JS
// ========================================

function initThree() {

  const container =
    document.getElementById("panorama");

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    1100
  );

  camera.position.set(0, 0, 0.1);
  camera.rotation.order = "YXZ";

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.xr.enabled = true;

  container.appendChild(renderer.domElement);

  document.body.appendChild(
    VRButton.createButton(renderer)
  );

  // ========================================
  // ESFERA 360
  // ========================================

  const geometry =
    new THREE.SphereGeometry(
      1000,
      60,
      40
    );

  geometry.scale(-1, 1, 1);

  const material =
    new THREE.MeshBasicMaterial({
      color: 0xffffff
    });

  sphere = new THREE.Mesh(
    geometry,
    material
  );

  scene.add(sphere);

  // ========================================
  // CONTROLES
  // ========================================

  controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = -0.25;

  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;

  // ========================================
  // RAYCASTER
  // ========================================

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  renderer.domElement.addEventListener(
    "click",
    onSceneClick
  );

  renderer.domElement.addEventListener(
    "mousemove",
    onSceneMouseMove
  );

  // ========================================
  // HOTSPOT DE INFORMACIÓN
  // ========================================

  crearHotspotInfo();

  // ========================================
  // ANIMACIÓN
  // ========================================

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

    // ----------------------------------------
    // HOTSPOT INFO
    // ----------------------------------------

    if (infoHotspot) {

      infoHotspot.lookAt(
        camera.position
      );

      const t =
        performance.now() * 0.001;

      // Animación de flotación
      if (infoHotspot.userData.baseY !== undefined) {

        infoHotspot.position.y =
          infoHotspot.userData.baseY +
          Math.sin(t * 2) * 1.5;
      }

      // Halo
      const glow =
        infoHotspot.getObjectByName("glow");

      if (glow) {

        glow.rotation.z += 0.01;

        glow.scale.setScalar(
          1 + Math.sin(t * 4) * 0.08
        );
      }
    }

    // ----------------------------------------
    // BOTONES 3D
    // ----------------------------------------

    navigationHotspots.forEach((nav) => {

      if (!nav.visible) return;

      const t =
        performance.now() * 0.001;

      if (nav.userData.baseY !== undefined) {

        nav.position.y =
          nav.userData.baseY +
          Math.sin(
            t * 2 + nav.userData.offset
          ) * 1.5;
      }

      // Rotación suave
      if (nav.userData.rotar) {
        nav.rotation.y += 0.005;
      }

    });

    // ----------------------------------------
    // APUNTADO AUTOMÁTICO
    // ----------------------------------------

    detectarApuntadoAutomatico();

    renderer.render(
      scene,
      camera
    );
  });

  window.addEventListener(
    "resize",
    onWindowResize
  );
}

// ========================================
// MENÚ LUGARES
// ========================================

function bindLugaresMenu() {

  lugaresList?.classList.remove("open");
  lugaresChevron?.classList.remove("rotated");

  lugaresToggleBtn?.addEventListener(
    "click",
    () => {

      lugaresList?.classList.toggle("open");

      lugaresChevron?.classList.toggle(
        "rotated"
      );
    }
  );
}

// ========================================
// MINI MAPA
// ========================================

function bindMiniMapa() {

  mapPoints.forEach((point) => {

    point.addEventListener(
      "click",
      () => {

        const zonaId =
          point.dataset.zona;

        if (zonaId) {
          cargarZona(zonaId);
        }
      }
    );
  });
}

function actualizarMiniMapa() {

  if (!gpsMarker || !zonaActual) return;

  const pos =
    mapaCoords[zonaActual.id];

  if (!pos) return;

  gpsMarker.style.left = pos.left;
  gpsMarker.style.top = pos.top;

  mapPoints.forEach((point) => {

    point.classList.toggle(
      "active",
      point.dataset.zona ===
        zonaActual.id
    );
  });
}

// ========================================
// HOTSPOT INFORMACIÓN
// ========================================

function crearHotspotInfo() {

  if (infoHotspot) {
    scene.remove(infoHotspot);
  }

  const group =
    new THREE.Group();

  // Disco principal
  const base =
    new THREE.Mesh(
      new THREE.CircleGeometry(
        4.2,
        64
      ),
      new THREE.MeshBasicMaterial({
        color: 0x00cfff,
        transparent: true,
        opacity: 0.85
      })
    );

  group.add(base);

  // Borde
  const borde =
    new THREE.Mesh(
      new THREE.RingGeometry(
        4.4,
        5.2,
        64
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1
      })
    );

  group.add(borde);

  // Halo
  const glow =
    new THREE.Mesh(
      new THREE.RingGeometry(
        5.5,
        7.2,
        64
      ),
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
  const sprite =
    crearTextoSprite("i");

  sprite.scale.set(5, 5, 1);
  sprite.position.z = 1;

  group.add(sprite);

  group.position.set(
    0,
    -20,
    -120
  );

  group.userData.isInfoHotspot = true;

  infoHotspot = group;

  scene.add(infoHotspot);
}

function crearTextoSprite(texto) {

  const canvas =
    document.createElement("canvas");

  canvas.width = 256;
  canvas.height = 256;

  const ctx =
    canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.fillStyle = "white";

  ctx.font =
    "bold 180px Arial";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    texto,
    canvas.width / 2,
    canvas.height / 2 + 8
  );

  const texture =
    new THREE.CanvasTexture(canvas);

  const material =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });

  return new THREE.Sprite(material);
}

// ========================================
// BOTONES 3D GLB
// ========================================

function limpiarBotonesNavegacion() {

  navigationHotspots.forEach((nav) => {

    scene.remove(nav);

    nav.traverse((child) => {

      if (child.isMesh) {

        child.geometry?.dispose();

        if (child.material) {

          if (Array.isArray(child.material)) {

            child.material.forEach(
              material => material.dispose()
            );

          } else {

            child.material.dispose();
          }
        }
      }
    });
  });

  navigationHotspots = [];
}


// Botones 3D para desplazamietno


function crearBotonNavegacion(direccion, posicion) { 
 
  const ruta = 
    direccion === "siguiente" 
      ? RUTA_AVANZAR 
      : RUTA_RETROCEDER; 
 
  gltfLoader.load( 
 
    ruta, 
 
    (gltf) => { 
 
      const modelo = gltf.scene; 
 
      modelo.scale.set(10, 10, 10); 
 
      modelo.position.set( 
          posicion.x, 
          posicion.y, 
          posicion.z 
      ); 
 
          modelo.rotation.set(
        0,
        posicion.rotacion ?? 0,
        0
      );
 
      // ------------------------------------ 
      // DATOS 
      // ------------------------------------ 
 
      modelo.userData.esNavegacion = true; 
 
      modelo.userData.direccion = 
        direccion; 
 
      modelo.userData.escenaDestino = 
        posicion.escena; 
 
      modelo.userData.baseY = 
        posicion.y; 
 
      modelo.userData.offset = 
        direccion === "siguiente" 
          ? 0 
          : Math.PI; 
 
      modelo.userData.rotar = false; 
 
      // ------------------------------------ 
      // SOMBRA / MATERIAL 
      // ------------------------------------ 
 
      modelo.traverse((child) => { 
 
        if (child.isMesh) { 
 
          child.castShadow = false; 
          child.receiveShadow = false; 
 
          if (child.material) { 
 
            child.material.side = 
              THREE.DoubleSide; 
          } 
        } 
      }); 
 
      // ------------------------------------ 
      // GUARDAR 
      // ------------------------------------ 
 
      navigationHotspots.push( 
        modelo 
      ); 
 
      scene.add(modelo); 
 
      console.log( 
        `Botón ${direccion} cargado`, 
        posicion 
      ); 
    }, 
 
    undefined, 
 
    (error) => { 
 
      console.error( 
        `Error cargando ${ruta}:`, 
        error 
      ); 
    } 
  ); 
}
// ========================================
// ACTUALIZAR BOTONES SEGÚN ESCENA
// ========================================

function actualizarBotonesNavegacion() {

  limpiarBotonesNavegacion();

  if (!zonaActual) return;

  const data =
    infoEscenas?.[
      zonaActual.id
    ]?.[
      escenaActualIndex
    ];

  if (!data) return;

  const navegacion =
    data.navegacion;

  if (!navegacion) return;

  // ----------------------------------------
  // AVANZAR
  // ----------------------------------------

  if (navegacion.siguiente) {

    const siguiente =
      navegacion.siguiente;

    crearBotonNavegacion(
      "siguiente",
      {
        escena:
          siguiente.escena,

        x:
          siguiente.x ?? 0,

        y:
          siguiente.y ?? -70,

        z:
          siguiente.z ?? -150,  
          rotacion: siguiente.rotacion ?? 0

      }
    );
  }

  // ----------------------------------------
  // RETROCEDER
  // ----------------------------------------

  if (navegacion.anterior) {

    const anterior =
      navegacion.anterior;

    crearBotonNavegacion(
      "anterior",
      {
        escena:
          anterior.escena,

        x:
          anterior.x ?? 0,

        y:
          anterior.y ?? -70,

        z:
          anterior.z ?? 150,
           rotacion: anterior.rotacion ?? 0
      }
    );
  }
}

// ========================================
// MOUSE
// ========================================

function onSceneMouseMove(event) {

  if (!renderer) return;

  updatePointer(event);

  raycaster.setFromCamera(
    pointer,
    camera
  );

  // Buscar navegación
  const navIntersects =
    raycaster.intersectObjects(
      navigationHotspots,
      true
    );

  // Buscar información
  const infoIntersects =
    infoHotspot
      ? raycaster.intersectObject(
          infoHotspot,
          true
        )
      : [];

  renderer.domElement.style.cursor =
    navIntersects.length > 0 ||
    infoIntersects.length > 0
      ? "pointer"
      : "default";
}

// ========================================
// CLICK
// ========================================

function onSceneClick(event) {

  if (!renderer) return;

  // Si modal abierto
  if (
    infoModalOverlay &&
    !infoModalOverlay.classList.contains(
      "hidden"
    )
  ) {
    return;
  }

  updatePointer(event);

  raycaster.setFromCamera(
    pointer,
    camera
  );

  // ========================================
  // PRIMERO BOTONES 3D
  // ========================================

  const navIntersects =
    raycaster.intersectObjects(
      navigationHotspots,
      true
    );

  if (navIntersects.length > 0) {

    const objeto =
      navIntersects[0].object;

    let boton =
      objeto;

    while (
      boton.parent &&
      !boton.userData.esNavegacion
    ) {
      boton =
        boton.parent;
    }

    if (
      boton.userData.esNavegacion
    ) {

      ejecutarNavegacion(
        boton
      );

      return;
    }
  }

  // ========================================
  // HOTSPOT INFO
  // ========================================

  if (!infoHotspot) return;

  const infoIntersects =
    raycaster.intersectObject(
      infoHotspot,
      true
    );

  if (infoIntersects.length > 0) {

    abrirInfoEscena();
  }
}

// ========================================
// EJECUTAR NAVEGACIÓN
// ========================================

function ejecutarNavegacion(
  boton
) {

  if (!boton) return;

  const direccion =
    boton.userData.direccion;

  const escenaDestino =
    boton.userData.escenaDestino;

  if (
    escenaDestino === undefined ||
    escenaDestino === null
  ) {
    return;
  }

  console.log(
    "Navegación:",
    direccion,
    "Destino:",
    escenaDestino
  );

  cargarEscena(
    escenaDestino
  );
}

// ========================================
// POINTER
// ========================================

function updatePointer(event) {

  const rect =
    renderer.domElement.getBoundingClientRect();

  pointer.x =
    (
      (event.clientX - rect.left) /
      rect.width
    ) * 2 - 1;

  pointer.y =
    -(
      (event.clientY - rect.top) /
      rect.height
    ) * 2 + 1;
}

// ========================================
// APUNTADO AUTOMÁTICO
// ========================================

function detectarApuntadoAutomatico() {

  if (
    !camera ||
    !raycaster ||
    !zonaActual
  ) {
    return;
  }

  if (
    infoModalOverlay &&
    !infoModalOverlay.classList.contains(
      "hidden"
    )
  ) {

    gazeStartTime = null;

    centerPointer?.classList.remove(
      "active"
    );

    return;
  }

  raycaster.setFromCamera(
    new THREE.Vector2(0, 0),
    camera
  );

  // ========================================
  // PRIMERO NAVEGACIÓN
  // ========================================

  const navIntersects =
    raycaster.intersectObjects(
      navigationHotspots,
      true
    );

  if (navIntersects.length > 0) {

    const objeto =
      navIntersects[0].object;

    let boton =
      objeto;

    while (
      boton.parent &&
      !boton.userData.esNavegacion
    ) {
      boton =
        boton.parent;
    }

    if (
      boton.userData.esNavegacion
    ) {

      centerPointer?.classList.add(
        "active"
      );

      if (
        !boton.userData.gazeStart
      ) {

        boton.userData.gazeStart =
          performance.now();
      }

      const elapsed =
        performance.now() -
        boton.userData.gazeStart;

      if (
        elapsed >= GAZE_OPEN_DELAY &&
        !boton.userData.gazeActivated
      ) {

        ejecutarNavegacion(
          boton
        );

        boton.userData.gazeActivated =
          true;
      }

      return;
    }
  }

  // ========================================
  // INFO
  // ========================================

  if (!infoHotspot) return;

  raycaster.setFromCamera(
    new THREE.Vector2(0, 0),
    camera
  );

  const intersects =
    raycaster.intersectObject(
      infoHotspot,
      true
    );

  const screenPos =
    infoHotspot.position
      .clone()
      .project(camera);

  const dentroDelCentro =
    Math.abs(screenPos.x) <
      CENTER_GAZE_RADIUS &&
    Math.abs(screenPos.y) <
      CENTER_GAZE_RADIUS &&
    screenPos.z < 1;

  const apuntando =
    intersects.length > 0 &&
    dentroDelCentro;

  if (apuntando) {

    centerPointer?.classList.add(
      "active"
    );

    if (gazeStartTime === null) {

      gazeStartTime =
        performance.now();
    }

    const elapsed =
      performance.now() -
      gazeStartTime;

    if (
      elapsed >= GAZE_OPEN_DELAY &&
      !infoAbiertaPorApuntado
    ) {

      abrirInfoEscena();

      infoAbiertaPorApuntado =
        true;
    }

  } else {

    gazeStartTime = null;

    infoAbiertaPorApuntado =
      false;

    centerPointer?.classList.remove(
      "active"
    );

    // Resetear gaze de botones
    navigationHotspots.forEach(
      nav => {

        nav.userData.gazeStart =
          null;

        nav.userData.gazeActivated =
          false;
      }
    );
  }
}

// ========================================
// RESIZE
// ========================================

function onWindowResize() {

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}

// ========================================
// CARGAR ZONA
// ========================================

function cargarZona(
  zonaId,
  escena = 0
) {

  if (!manifest?.zonas) return;

  const nuevoIndice =
    manifest.zonas.findIndex(
      z => z.id === zonaId
    );

  if (nuevoIndice === -1) return;

  zonaActualIndex =
    nuevoIndice;

  zonaActual =
    manifest.zonas[
      zonaActualIndex
    ];

  escenaActualIndex =
    escena;

  actualizarMiniMapa();

  cargarEscena(
    escena
  );
}

// ========================================
// CARGAR ESCENA
// ========================================

function cargarEscena(index) {

  if (!zonaActual) return;

  if (
    index < 0 ||
    index >= zonaActual.imagenes.length
  ) {
    return;
  }

  escenaActualIndex =
    index;

  const ruta =
    `${zonaActual.ruta}${zonaActual.imagenes[index]}`;

  console.log(
    "Cargando:",
    ruta
  );

  const loader =
    new THREE.TextureLoader();

  loader.load(

    ruta,

    (texture) => {

      texture.colorSpace =
        THREE.SRGBColorSpace;

      sphere.material.map =
        texture;

      sphere.material.needsUpdate =
        true;

      actualizarPanelInfo();

      actualizarHotspotInfo();

      actualizarPosicionHotspot();

      actualizarBotonesNavegacion();

      detenerLectura();

      cerrarInfoEscena();

      gazeStartTime = null;

      infoAbiertaPorApuntado =
        false;
    },

    undefined,

    (error) => {

      console.error(
        "Error cargando panorama:",
        ruta,
        error
      );
    }
  );
}

// ========================================
// POSICIÓN HOTSPOT INFO
// ========================================

function actualizarPosicionHotspot() {

  if (
    !infoHotspot ||
    !zonaActual
  ) {
    return;
  }

  if (
    zonaActual.id === "zona1"
  ) {

    infoHotspot.position.set(
      48,
      -12,
      -170
    );

  } else if (
    zonaActual.id === "zona2"
  ) {

    infoHotspot.position.set(
      0,
      -5,
      130
    );

  } else if (
    zonaActual.id === "zona3"
  ) {

    infoHotspot.position.set(
      15,
      -5,
      125
    );

  } else if (
    zonaActual.id === "zona4"
  ) {

    infoHotspot.position.set(
      10,
      -8,
      -110
    );

  } else if (
    zonaActual.id === "zona5"
  ) {

    infoHotspot.position.set(
      -18,
      -12,
      -112
    );

  } else {

    infoHotspot.position.set(
      -160,
      20,
      -120
    );
  }

  infoHotspot.userData.baseY =
    infoHotspot.position.y;
}

// ========================================
// PANEL INFO
// ========================================

function actualizarPanelInfo() {

  if (!zonaActual) return;

  sceneTitleEl.textContent =
    zonaActual.nombre;

  sceneInfoEl.textContent =
    "";

  prevBtn.disabled =
    escenaActualIndex === 0 &&
    zonaActualIndex === 0;

  nextBtn.disabled =
    false;
}

// ========================================
// VISIBILIDAD HOTSPOT
// ========================================

function actualizarHotspotInfo() {

  if (
    !infoHotspot ||
    !zonaActual
  ) {
    return;
  }

  const data =
    infoEscenas?.[
      zonaActual.id
    ]?.[
      escenaActualIndex
    ];

  if (
    data &&
    data.mostrarHotspot
  ) {

    infoHotspot.visible =
      true;

  } else {

    infoHotspot.visible =
      false;
  }
}

// ========================================
// ABRIR INFO
// ========================================

function abrirInfoEscena() {

  if (
    !zonaActual ||
    !infoModalOverlay
  ) {
    return;
  }

  const data =
    infoEscenas?.[
      zonaActual.id
    ]?.[
      escenaActualIndex
    ];

  if (
    !data ||
    !data.mostrarHotspot
  ) {

    if (infoHotspot) {
      infoHotspot.visible =
        false;
    }

    return;
  }

  infoHotspot.visible =
    true;

  infoCardTitle.textContent =
    data.titulo || "";

  infoCardSubtitle.textContent =
    data.subtitulo || "";

  infoCardDescription.textContent =
    data.descripcion || "";

  // Modelo 3D
  if (data.modeloUrl) {

    viewModelBtn.dataset.url =
      data.modeloUrl;

    viewModelBtn.style.display =
      "inline-flex";

  } else {

    viewModelBtn.style.display =
      "none";
  }

  // Imagen
  if (data.imagen) {

    infoCardImage.src =
      data.imagen;

    infoCardImage.style.display =
      "block";

  } else {

    infoCardImage.style.display =
      "none";
  }

  infoLocation.textContent =
    "📍 Pachacamac";

  infoReading.textContent =
    "⏱ 1 min lectura";

  playAudioBtn.style.display =
    data.audio
      ? "inline-flex"
      : "none";

  infoModalOverlay.classList.remove(
    "hidden"
  );
}

// ========================================
// CERRAR INFO
// ========================================

function cerrarInfoEscena() {

  if (!infoModalOverlay) return;

  detenerLectura();

  infoModalOverlay.classList.add(
    "hidden"
  );

  gazeStartTime = null;

  infoAbiertaPorApuntado =
    false;

  centerPointer?.classList.remove(
    "active"
  );
}

// ========================================
// GIROSCOPIO
// ========================================

function manejarOrientacion(event) {

  if (!gyroActivo) return;

  const alpha =
    event.alpha;

  const beta =
    event.beta;

  if (
    alpha == null ||
    beta == null
  ) {
    return;
  }

  yaw =
    THREE.MathUtils.degToRad(
      alpha
    );

  const betaClamped =
    Math.max(
      -85,
      Math.min(
        85,
        beta
      )
    );

  pitch =
    THREE.MathUtils.degToRad(
      betaClamped
    );
}

// ========================================
// ACTIVAR GIROSCOPIO
// ========================================

async function activarGiroscopio() {

  if (!esMovil()) return;

  try {

    if (
      typeof DeviceOrientationEvent !==
        "undefined" &&
      typeof DeviceOrientationEvent.requestPermission ===
        "function"
    ) {

      const permission =
        await DeviceOrientationEvent.requestPermission();

      if (
        permission !==
        "granted"
      ) {

        alert(
          "No se concedió permiso para usar el giroscopio."
        );

        return;
      }
    }

    if (!gyroListenerActivo) {

      window.addEventListener(
        "deviceorientation",
        manejarOrientacion,
        true
      );

      gyroListenerActivo =
        true;
    }

    gyroActivo =
      true;

    controls.enabled =
      false;

    if (gyroBtn) {

      gyroBtn.textContent =
        "Gyro ON";
    }

  } catch (error) {

    console.error(
      "Error activando giroscopio:",
      error
    );

    alert(
      "No se pudo activar el giroscopio en este dispositivo."
    );
  }
}

// ========================================
// DESACTIVAR GIROSCOPIO
// ========================================

function desactivarGiroscopio() {

  gyroActivo =
    false;

  controls.enabled =
    true;

  if (gyroBtn) {

    gyroBtn.textContent =
      "Giroscopio";
  }
}

// ========================================
// BOTÓN PREV
// ========================================

prevBtn?.addEventListener(
  "click",
  () => {

    if (!zonaActual) return;

    if (
      escenaActualIndex > 0
    ) {

      cargarEscena(
        escenaActualIndex - 1
      );

      return;
    }

    if (
      zonaActualIndex > 0
    ) {

      const zonaAnterior =
        manifest.zonas[
          zonaActualIndex - 1
        ];

      cargarZona(
        zonaAnterior.id,
        zonaAnterior.imagenes.length - 1
      );
    }
  }
);

// ========================================
// BOTÓN NEXT
// ========================================

nextBtn?.addEventListener(
  "click",
  () => {

    if (!zonaActual) return;

    if (
      escenaActualIndex <
      zonaActual.imagenes.length - 1
    ) {

      cargarEscena(
        escenaActualIndex + 1
      );

      return;
    }

    if (
      zonaActualIndex <
      manifest.zonas.length - 1
    ) {

      const nuevaZona =
        manifest.zonas[
          zonaActualIndex + 1
        ];

      cargarZona(
        nuevaZona.id,
        0
      );
    }
  }
);

// ========================================
// FULLSCREEN
// ========================================

fullscreenBtn?.addEventListener(
  "click",
  async () => {

    const elem =
      document.documentElement;

    if (!document.fullscreenElement) {

      await elem.requestFullscreen?.();

    } else {

      await document.exitFullscreen?.();
    }
  }
);

// ========================================
// PANEL
// ========================================

floatingBtn.style.display =
  "none";

togglePanelBtn?.addEventListener(
  "click",
  () => {

    overlayPanel.classList.toggle(
      "collapsed"
    );

    const isClosed =
      overlayPanel.classList.contains(
        "collapsed"
      );

    floatingBtn.style.display =
      isClosed
        ? "block"
        : "none";
  }
);

// ========================================
// BOTÓN FLOTANTE
// ========================================

floatingBtn?.addEventListener(
  "click",
  () => {

    overlayPanel.classList.remove(
      "collapsed"
    );

    floatingBtn.style.display =
      "none";
  }
);

// ========================================
// INFO
// ========================================

infoBtn?.addEventListener(
  "click",
  abrirInfoEscena
);

closeInfoBtn?.addEventListener(
  "click",
  cerrarInfoEscena
);

// ========================================
// GIROSCOPIO
// ========================================

gyroBtn?.addEventListener(
  "click",
  async () => {

    if (!esMovil()) return;

    if (gyroActivo) {

      desactivarGiroscopio();

    } else {

      await activarGiroscopio();
    }
  }
);

// ========================================
// CERRAR MODAL
// ========================================

infoModalOverlay?.addEventListener(
  "click",
  (e) => {

    if (
      e.target ===
      infoModalOverlay
    ) {

      cerrarInfoEscena();
    }
  }
);

document.addEventListener(
  "keydown",
  (e) => {

    if (e.key === "Escape") {

      cerrarInfoEscena();
    }
  }
);

// ========================================
// MAPA GRANDE
// ========================================

const expandMapBtn =
  document.getElementById(
    "expandMapBtn"
  );

const closeMapBtn =
  document.getElementById(
    "closeMapBtn"
  );

const mapOverlay =
  document.getElementById(
    "mapOverlay"
  );

const miniMapCanvas =
  document.getElementById(
    "miniMapCanvas"
  );

const mapExpandedContent =
  document.getElementById(
    "mapExpandedContent"
  );

expandMapBtn?.addEventListener(
  "click",
  abrirMapaGrande
);

closeMapBtn?.addEventListener(
  "click",
  cerrarMapaGrande
);

function abrirMapaGrande() {

  if (
    !miniMapCanvas ||
    !mapExpandedContent
  ) {
    return;
  }

  const clone =
    miniMapCanvas.cloneNode(
      true
    );

  mapExpandedContent.innerHTML =
    "";

  mapExpandedContent.appendChild(
    clone
  );

  mapOverlay.classList.remove(
    "hidden"
  );

  const puntos =
    clone.querySelectorAll(
      ".map-point"
    );

  puntos.forEach((p) => {

    p.addEventListener(
      "click",
      () => {

        const zonaId =
          p.dataset.zona;

        if (zonaId) {
          cargarZona(zonaId);
        }

        cerrarMapaGrande();
      }
    );
  });

  const gps =
    clone.querySelector(
      "#gpsMarker"
    );

  if (
    gps &&
    zonaActual
  ) {

    const pos =
      mapaCoords[
        zonaActual.id
      ];

    if (pos) {

      gps.style.left =
        pos.left;

      gps.style.top =
        pos.top;
    }
  }
}

function cerrarMapaGrande() {

  mapOverlay?.classList.add(
    "hidden"
  );
}

// ========================================
// MODELO 3D DESDE INFO
// ========================================

viewModelBtn?.addEventListener(
  "click",
  () => {

    const url =
      viewModelBtn.dataset.url;

    if (!url) {

      alert(
        "No hay un modelo 3D disponible para esta escena."
      );

      return;
    }

    window.open(
      url,
      "_blank"
    );
  }
);



playAudioBtn?.addEventListener(
  "click",
  () => {

    reproducirDescripcion();
  }
);

function reproducirDescripcion() {

  const texto =
    infoCardDescription.textContent;

  if (!texto) return;

  window.speechSynthesis.cancel();

  vozLectura =
    new SpeechSynthesisUtterance(
      texto
    );

  vozLectura.lang =
    "es-ES";

  vozLectura.rate =
    1;

  vozLectura.pitch =
    1;

  vozLectura.volume =
    1;

  window.speechSynthesis.speak(
    vozLectura
  );
}

function detenerLectura() {

  window.speechSynthesis.cancel();
}

init();
