
import * as THREE from "three";

export class VRNavigation {
  constructor({ scene, camera, renderer, onNext, onPrevious }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.onNext = onNext;
    this.onPrevious = onPrevious;

    this.raycaster = new THREE.Raycaster();
    this.botones = [];

    this.grupo = null;
    this.cursorGrupo = null;

    this.tiempoApuntado = 1000;

    this.posicion = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.escala = new THREE.Vector3();
    this.direccion = new THREE.Vector3();

    this.handleSessionStart = () => {
      console.log("VR activado");
      this.crearBotones();
    };

    this.handleSessionEnd = () => {
      console.log("VR desactivado");
      this.limpiar();
    };

    this.renderer.xr.addEventListener(
      "sessionstart",
      this.handleSessionStart
    );

    this.renderer.xr.addEventListener(
      "sessionend",
      this.handleSessionEnd
    );

    if (this.renderer.xr.isPresenting) {
      this.crearBotones();
    }
  }

  crearBotones() {
    this.limpiar();

    const xrCamera = this.renderer.xr.getCamera(this.camera);

    xrCamera.updateMatrixWorld(true);

    xrCamera.matrixWorld.decompose(
      this.posicion,
      this.quaternion,
      this.escala
    );

    // GRUPO DE BOTONES: SE QUEDA FIJO EN EL MUNDO 3D
    this.grupo = new THREE.Group();

    this.grupo.position.copy(this.posicion);
    this.grupo.quaternion.copy(this.quaternion);

    this.scene.add(this.grupo);

    // GRUPO DEL CURSOR: SIGUE LA MIRADA
    this.cursorGrupo = new THREE.Group();
    this.scene.add(this.cursorGrupo);

    const cursorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      transparent: true
    });

    const cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.018, 0.032, 32),
      cursorMaterial
    );

    cursor.position.set(0, 0, -2);
    cursor.renderOrder = 999;

    this.cursorGrupo.add(cursor);

    const punto = new THREE.Mesh(
      new THREE.CircleGeometry(0.008, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        depthTest: false
      })
    );

    punto.position.set(0, 0, -2);
    punto.renderOrder = 1000;

    this.cursorGrupo.add(punto);

    // CREAR BOTONES DE NAVEGACIÓN
    const crear = (texto, x, direccion) => {
      const boton = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 48),
        new THREE.MeshBasicMaterial({
          color: 0x0077bb,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthTest: false
        })
      );

      boton.position.set(x, -0.30, -2);
      boton.renderOrder = 998;

      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;

      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "white";
      ctx.font = "bold 190px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(texto, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false
        })
      );

      sprite.scale.set(0.19, 0.19, 1);
      boton.add(sprite);
      // TEXTO DESCRIPTIVO DEL BOTÓN
const canvasTexto = document.createElement("canvas");
canvasTexto.width = 512;
canvasTexto.height = 100;

const ctxTexto = canvasTexto.getContext("2d");

ctxTexto.fillStyle = "#ffffff";
ctxTexto.font = "bold 48px Arial";
ctxTexto.textAlign = "center";
ctxTexto.textBaseline = "middle";

ctxTexto.fillText(
  direccion === "anterior" ? "ANTERIOR" : "SIGUIENTE",
  256,
  50
);

const texturaTexto = new THREE.CanvasTexture(canvasTexto);

const etiqueta = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: texturaTexto,
    transparent: true,
    depthTest: false
  })
);

// Tamaño y posición del texto
etiqueta.scale.set(0.55, 0.11, 1);
etiqueta.position.set(0, -0.20, 0.01);

boton.add(etiqueta);


      boton.userData.direccion = direccion;
      boton.userData.inicio = null;
      boton.userData.activado = false;

      this.grupo.add(boton);
      this.botones.push(boton);
    };

    crear("‹", -0.35, "anterior");
    crear("›", 0.35, "siguiente");
  }

  update() {
    if (!this.renderer.xr.isPresenting || !this.grupo) return;

    const xrCamera = this.renderer.xr.getCamera(this.camera);

    xrCamera.updateMatrixWorld(true);

    xrCamera.matrixWorld.decompose(
      this.posicion,
      this.quaternion,
      this.escala
    );

    // SOLAMENTE EL CURSOR SIGUE LA CABEZA
    if (this.cursorGrupo) {
      this.cursorGrupo.position.copy(this.posicion);
      this.cursorGrupo.quaternion.copy(this.quaternion);
      this.cursorGrupo.updateMatrixWorld(true);
    }

    // LOS BOTONES PERMANECEN EN SU POSICIÓN ORIGINAL
    this.grupo.updateMatrixWorld(true);

    // RAYO DESDE EL CENTRO DE LA MIRADA
    this.direccion.set(0, 0, -1)
      .applyQuaternion(this.quaternion)
      .normalize();

    this.raycaster.ray.origin.copy(this.posicion);
    this.raycaster.ray.direction.copy(this.direccion);

    const hits = this.raycaster.intersectObjects(
      this.botones,
      false
    );

    if (hits.length === 0) {
      this.resetearBotones();
      return;
    }

    const boton = hits[0].object;

    this.resetearBotones(boton);

    boton.material.color.set(0x00ffff);

    if (boton.userData.inicio === null) {
      boton.userData.inicio = performance.now();
    }

    const tiempo = performance.now() - boton.userData.inicio;

    if (
      tiempo >= this.tiempoApuntado &&
      !boton.userData.activado
    ) {
      boton.userData.activado = true;
      this.ejecutar(boton);
    }
  }

  ejecutar(boton) {
    const direccion = boton.userData.direccion;

    if (direccion === "siguiente") {
      this.onNext?.();
    } else {
      this.onPrevious?.();
    }

    this.resetearBotones();
  }

  resetearBotones(excepto = null) {
    this.botones.forEach(boton => {
      if (boton !== excepto) {
        boton.userData.inicio = null;
        boton.userData.activado = false;
        boton.material.color.set(0x0077bb);
      }
    });
  }

  limpiar() {
    const grupos = [this.grupo, this.cursorGrupo];

    grupos.forEach(grupo => {
      if (!grupo) return;

      this.scene.remove(grupo);

      grupo.traverse(objeto => {
        if (objeto.geometry) {
          objeto.geometry.dispose();
        }

        if (objeto.material) {
          const materiales = Array.isArray(objeto.material)
            ? objeto.material
            : [objeto.material];

          materiales.forEach(material => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
    });

    this.botones = [];
    this.grupo = null;
    this.cursorGrupo = null;
  }

  dispose() {
    this.limpiar();

    this.renderer.xr.removeEventListener(
      "sessionstart",
      this.handleSessionStart
    );

    this.renderer.xr.removeEventListener(
      "sessionend",
      this.handleSessionEnd
    );
  }
}
