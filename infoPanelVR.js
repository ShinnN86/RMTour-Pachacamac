
import * as THREE from "three";

export class InfoPanelVR {

  constructor({ scene, camera, renderer, onClose }) {

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.onClose = onClose;

    this.grupo = null;
    this.panel = null;
    this.closeRing = null;

    this.raycaster = new THREE.Raycaster();

    this.visible = false;
    this.data = null;

    // Configuración de mirada
    this.gazeStart = null;
    this.gazeDelay = 1000;
    this.gazeProgress = 0;

    // Canvas
    this.canvas = null;
    this.ctx = null;
    this.texture = null;

    this.image = null;
    this.imageLoaded = false;

    this.width = 1200;
    this.height = 760;

    // Dimensiones del panel 3D
   this.panelWidth = 3.2;
  this.panelHeight = 2.1;

    // Vectores reutilizables
    this.cameraPosition = new THREE.Vector3();
    this.cameraQuaternion = new THREE.Quaternion();
    this.direction = new THREE.Vector3();

    this.crearCanvas();
  }

  // ========================================
  // CREAR CANVAS
  // ========================================

  crearCanvas() {

    this.canvas = document.createElement("canvas");

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.ctx = this.canvas.getContext("2d");

    this.texture = new THREE.CanvasTexture(this.canvas);

    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.redibujar();
  }

  // ========================================
  // DIBUJAR TARJETA
  // ========================================

  redibujar(data = this.data) {

    const ctx = this.ctx;

    if (!ctx) return;

    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Fondo
    ctx.fillStyle = "#101c2c";

    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 36);
    ctx.fill();

    // Borde
    ctx.strokeStyle = "#36c9f5";
    ctx.lineWidth = 5;

    ctx.stroke();

    // Cabecera
    ctx.fillStyle = "#123b55";

    ctx.beginPath();
    ctx.roundRect(0, 0, w, 145, 36);
    ctx.fill();

    // Título de cabecera
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px Arial";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "INFORMACIÓN",
      55,
      72
    );

    // Botón cerrar X
    ctx.fillStyle = "#e54b5b";

    ctx.beginPath();
    ctx.arc(1110, 72, 39, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(1093, 55);
    ctx.lineTo(1127, 89);

    ctx.moveTo(1127, 55);
    ctx.lineTo(1093, 89);

    ctx.stroke();

    if (!data) {

      this.texture.needsUpdate = true;
      return;
    }

    // ====================================
    // TÍTULO
    // ====================================

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 58px Arial";
    ctx.textBaseline = "top";

    this.dibujarTexto(
      data.titulo || "Información",
      55,
      185,
      1090,
      60,
      2
    );

    // ====================================
    // SUBTÍTULO
    // ====================================

    if (data.subtitulo) {

      ctx.fillStyle = "#48c9f5";
      ctx.font = "38px Arial";

      this.dibujarTexto(
        data.subtitulo,
        55,
        275,
        1090,
        42,
        2
      );
    }

    // ====================================
    // IMAGEN
    // ====================================

    if (this.imageLoaded && this.image) {

      const x = 55;
      const y = 355;
      const iw = 430;
      const ih = 345;

      ctx.save();

      ctx.beginPath();

      ctx.roundRect(
        x,
        y,
        iw,
        ih,
        20
      );

      ctx.clip();

      const ratio = Math.max(
        iw / this.image.width,
        ih / this.image.height
      );

      const sw = iw / ratio;
      const sh = ih / ratio;

      const sx = (
        this.image.width - sw
      ) / 2;

      const sy = (
        this.image.height - sh
      ) / 2;

      ctx.drawImage(
        this.image,
        sx,
        sy,
        sw,
        sh,
        x,
        y,
        iw,
        ih
      );

      ctx.restore();

    } else {

      ctx.fillStyle = "#1c3045";

      ctx.beginPath();

      ctx.roundRect(
        55,
        355,
        430,
        345,
        20
      );

      ctx.fill();

      ctx.fillStyle = "#8da8bd";
      ctx.font = "30px Arial";
      ctx.textAlign = "center";

      ctx.fillText(
        "Información histórica",
        270,
        530
      );

      ctx.textAlign = "left";
    }

    // ====================================
    // DESCRIPCIÓN
    // ====================================

    ctx.fillStyle = "#e7edf5";
    ctx.font = "30px Arial";

    this.dibujarTexto(
      data.descripcion || "",
      530,
      355,
      610,
      48,
      7
    );

    this.texture.needsUpdate = true;
  }

  // ========================================
  // DIBUJAR TEXTO CON SALTO DE LÍNEA
  // ========================================

  dibujarTexto(
    texto,
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines
  ) {

    const ctx = this.ctx;

    const palabras = String(texto).split(/\s+/);

    let linea = "";
    let lineas = [];

    for (const palabra of palabras) {

      const prueba = linea
        ? linea + " " + palabra
        : palabra;

      if (
        ctx.measureText(prueba).width > maxWidth &&
        linea
      ) {

        lineas.push(linea);
        linea = palabra;

      } else {

        linea = prueba;
      }
    }

    if (linea) {
      lineas.push(linea);
    }

    // Limitar cantidad de líneas
    if (lineas.length > maxLines) {

      lineas = lineas.slice(0, maxLines);

      let ultima = lineas[maxLines - 1];

      while (
        ctx.measureText(ultima + "...").width > maxWidth &&
        ultima.length > 0
      ) {

        ultima = ultima.slice(0, -1);
      }

      lineas[maxLines - 1] = ultima + "...";
    }

    let actualY = y;

    lineas.forEach((lineaTexto) => {

      ctx.fillText(
        lineaTexto,
        x,
        actualY
      );

      actualY += lineHeight;
    });
  }

  // ========================================
  // MOSTRAR PANEL
  // ========================================

  mostrar(data, hotspot) {

    if (!data || !hotspot) return;

    // Cerrar panel anterior sin ejecutar callback
    this.ocultar(false);

    this.data = data;

    this.image = null;
    this.imageLoaded = false;

    this.redibujar(data);

    // ====================================
    // CARGAR IMAGEN
    // ====================================

    if (data.imagen) {

      const image = new Image();

      image.crossOrigin = "anonymous";

      image.onload = () => {

        // Evitar actualizar un panel anterior
        if (this.data !== data) return;

        this.image = image;
        this.imageLoaded = true;

        this.redibujar(data);
      };

      image.onerror = () => {

        console.warn(
          "No se pudo cargar la imagen:",
          data.imagen
        );
      };

      image.src = data.imagen;
    }


    this.hotspotActivo = hotspot;

if (this.hotspotActivo) {
    this.hotspotActivo.visible = false;
}

    // ====================================
    // CREAR GRUPO 3D
    // ====================================

    this.grupo = new THREE.Group();

    const geometry = new THREE.PlaneGeometry(
      this.panelWidth,
      this.panelHeight
    );

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: false,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });

    this.panel = new THREE.Mesh(
      geometry,
      material
    );

    this.panel.renderOrder = 1000;

    this.grupo.add(this.panel);

    // ====================================
    // INDICADOR DE MIRADA PARA CERRAR
    // ====================================

   const ringGeometry = new THREE.RingGeometry(
    0.045,
    0.065,
    48
);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x36e6ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });

    this.closeRing = new THREE.Mesh(
      ringGeometry,
      ringMaterial
    );

    this.closeRing.position.set(
    1.35,
    0.83,
    0.15
);

    this.closeRing.visible = false;

    this.grupo.add(this.closeRing);

    // ====================================
    // POSICIÓN DEL HOTSPOT
    // ====================================

    // ====================================
// POSICIÓN DEL PANEL FRENTE AL USUARIO
// ====================================

const xrCamera = this.renderer.xr.getCamera(this.camera);

xrCamera.updateMatrixWorld(true);

const posicionCamara = new THREE.Vector3();
const direccionCamara = new THREE.Vector3();

xrCamera.getWorldPosition(posicionCamara);

direccionCamara.set(0, 0, -1);

direccionCamara.applyQuaternion(
    xrCamera.getWorldQuaternion(new THREE.Quaternion())
);

direccionCamara.normalize();

// Colocar panel a 2 metros delante del usuario
this.grupo.position.copy(posicionCamara);

this.grupo.position.add(
    direccionCamara.multiplyScalar(2)
);

// Agregar a escena
this.scene.add(this.grupo);

    this.visible = true;

    this.gazeStart = null;
    this.gazeProgress = 0;

    console.log(
      "Panel informativo VR abierto:",
      data.titulo
    );
  }

  // ========================================
  // ACTUALIZAR PANEL Y DETECTAR MIRADA
  // ========================================

  update() {

    if (
      !this.visible ||
      !this.grupo ||
      !this.renderer.xr.isPresenting
    ) {
      return;
    }

    const xrCamera = this.renderer.xr.getCamera(
      this.camera
    );

    xrCamera.updateMatrixWorld(true);

    xrCamera.getWorldPosition(
      this.cameraPosition
    );

    xrCamera.getWorldQuaternion(
      this.cameraQuaternion
    );

    // Orientar tarjeta hacia el usuario
    this.grupo.lookAt(
      this.cameraPosition
    );

    // Dirección central de la mirada
    this.direction.set(
      0,
      0,
      -1
    );

    this.direction.applyQuaternion(
      this.cameraQuaternion
    );

    this.direction.normalize();

    // Lanzar rayo
    this.raycaster.set(
      this.cameraPosition,
      this.direction
    );

    const intersections =
      this.raycaster.intersectObject(
        this.panel,
        false
      );

    let apuntandoCerrar = false;

    if (intersections.length > 0) {

      const uv = intersections[0].uv;

      // Esquina superior derecha
      apuntandoCerrar =
        uv.x > 0.89 &&
        uv.y > 0.84;
    }

    // ====================================
    // GAZE PARA CERRAR
    // ====================================

   

    if (apuntandoCerrar) {

      if (this.gazeStart === null) {

        this.gazeStart = performance.now();
      }

      const elapsed =
        performance.now() - this.gazeStart;

      this.gazeProgress = Math.min(
        elapsed / this.gazeDelay,
        1
      );

      this.closeRing.visible = true;

      this.closeRing.scale.setScalar(
        0.4 + this.gazeProgress * 0.6
      );

      // Cerrar después de un segundo
      if (this.gazeProgress >= 1) {

        this.ocultar(true);
      }

    } else {

      this.gazeStart = null;

      this.gazeProgress = 0;

      if (this.closeRing) {

        this.closeRing.visible = false;
      }
    }
  }

  // ========================================
  // OCULTAR PANEL
  // ========================================

  ocultar(notificar = true) {

    if (this.grupo) {

      this.scene.remove(this.grupo);

      this.grupo.traverse((objeto) => {

        if (objeto.geometry) {
          objeto.geometry.dispose();
        }

        if (objeto.material) {

          if (Array.isArray(objeto.material)) {

            objeto.material.forEach(
              material => material.dispose()
            );

          } else {

            objeto.material.dispose();
          }
        }
      });

      this.grupo = null;
    }

    // Restaurar el hotspot al cerrar el panel
      if (this.hotspotActivo) {
          this.hotspotActivo.visible = true;
          this.hotspotActivo = null;
      }

    this.panel = null;
    this.closeRing = null;

    this.visible = false;

    this.gazeStart = null;
    this.gazeProgress = 0;

    this.data = null;
    this.image = null;
    this.imageLoaded = false;

    if (notificar && this.onClose) {

      this.onClose();
    }

    console.log(
      "Panel informativo VR cerrado"
    );
  }

  // ========================================
  // LIBERAR RECURSOS
  // ========================================

  dispose() {

    this.ocultar(false);

    if (this.texture) {

      this.texture.dispose();

      this.texture = null;
    }

    this.canvas = null;
    this.ctx = null;
  }
}
