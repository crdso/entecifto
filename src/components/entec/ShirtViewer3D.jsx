import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Modelo e estampas locais/temporários para manter o visual do componente sem depender de um CDN externo.
const SHIRT_MODEL_URL = "/models/shirt.glb";
const FRONT_ART_URL = "/images/front-art.jpeg";
const BACK_ART_URL = "/images/back-art.jpg";

// ============================================================
//  CONFIGURAÇÃO DAS ESTAMPAS — ajuste apenas estes valores.
//  x, y      -> posição no modelo normalizado (frente = +Z, costas = -Z)
//  z         -> leve afastamento da superfície ao longo da normal
//  scale     -> largura da estampa em unidades do modelo
//  rotation  -> giro da estampa no próprio plano (radianos)
// ============================================================
const frontPrint = {
  x: 0.35, // lado esquerdo de quem veste (= direita de quem olha a frente)
  y: 0.62, // altura do peito
  z: 0.02,
  scale: 0.4, // logo pequena
  rotation: 0,
};

const backPrint = {
  x: 0, // centralizada nas costas
  y: 0.1,
  z: -0.035,
  scale: 1.1, // região central das costas
  rotation: 0,
};

const nameLabelPrint = {
  x: 0, // posicione horizontalmente no centro das costas
  y: -0.85, // ajuste este valor para mover o texto para cima/baixo
  z: -0.07, // empurra o texto levemente para frente da superfície
  scale: 0.75, // largura do texto
  rotation: 0,
};

const NAME_LABEL_TEXT = "SEU NOME";

/** @param {THREE.Object3D} obj */
function disposeObject(obj) {
  obj.traverse(
    /** @param {THREE.Object3D} o */
    (o) => {
      if (o instanceof THREE.Mesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material))
            o.material.forEach(
              /** @param {THREE.Material} m */
              (m) => m.dispose()
            );
          else o.material.dispose();
        }
      }
    }
  );
}

/** @param {string} text */
function createTextTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.floor(canvas.height * 0.65)}px Arial`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Constrói o placeholder de camisa (Shape extrudado + gola)
function buildShirtMesh() {
  const shape = new THREE.Shape();
  shape.moveTo(0.28, 1.42);
  shape.quadraticCurveTo(0.6, 1.36, 0.92, 1.3); // ombro direito
  shape.quadraticCurveTo(1.28, 1.16, 1.52, 1.0); // manga direita topo
  shape.quadraticCurveTo(1.62, 0.78, 1.42, 0.55); // ponta da manga direita
  shape.quadraticCurveTo(1.2, 0.62, 1.0, 0.74); // axila direita
  shape.lineTo(0.93, -1.5); // barra direita
  shape.quadraticCurveTo(0, -1.62, -0.93, -1.5); // barra (leve curva)
  shape.lineTo(-1.0, 0.74); // sobe esquerda
  shape.quadraticCurveTo(-1.2, 0.62, -1.42, 0.55); // ponta da manga esquerda
  shape.quadraticCurveTo(-1.62, 0.78, -1.52, 1.0); // manga esquerda topo
  shape.quadraticCurveTo(-1.28, 1.16, -0.92, 1.3); // ombro esquerdo
  shape.quadraticCurveTo(-0.6, 1.36, -0.28, 1.42); // pescoço esquerdo
  shape.quadraticCurveTo(0, 1.08, 0.28, 1.42); // decote

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 4,
    curveSegments: 32,
  });
  geo.center();
  geo.computeVertexNormals();

  const fabric = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.82,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, fabric);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Gola (meio toro formando o U do decote)
  const collarGeo = new THREE.TorusGeometry(0.27, 0.07, 16, 48, Math.PI);
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.8,
    metalness: 0.0,
  });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.rotation.z = Math.PI; // U aberto para cima
  collar.position.set(0, 1.12, 0.0);
  collar.castShadow = true;
  collar.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  group.add(collar);
  return group;
}

export default function ShirtViewer3D() {
  const mountRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const stateRef = useRef(/** @type {unknown} */ (null));

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight || Math.min(window.innerHeight * 0.62, 560);

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // transparente — fundo do site aparece
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Use a neutral exposure and ensure the renderer outputs sRGB so
    // color textures (sRGB) appear with correct saturation/contrast.
    renderer.toneMappingExposure = 1.0;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // --- Scene ---
    const scene = new THREE.Scene();

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 6.2);

    // --- Lights ---
    const hemi = new THREE.HemisphereLight(0x9fb4ff, 0x24104a, 0.8);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0004;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x6644cc, 1.4);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x6644cc, 0.6);
    fill.position.set(0, -3, 3);
    scene.add(fill);

    // --- Group (para flutuação) ---
    const group = new THREE.Group();
    scene.add(group);

    // --- Modelo ---
    /** @type {THREE.Object3D | null} */
    let loadedModel = null;
    const placeholder = buildShirtMesh();
    group.add(placeholder);

    // Aplica uma estampa como um PLANO texturizado fixado na superfície da camisa
    // (frente ou costas). Mais robusto/visível que decal e responde direto aos
    // valores de frontPrint/backPrint (x, y, z, scale, rotation).
    /**
     * @param {THREE.Texture} texture
     * @param {{x:number,y:number,z:number,scale:number,rotation:number}} config
     * @param {boolean} isBack
     * @param {{alphaTest?: boolean}} [options]
     */
    const applyPrint = (texture, config, isBack, options = {}) => {
      // Acha a superfície em (x, y) via raycast a partir de +Z (frente) ou -Z (costas)
      const origin = new THREE.Vector3(config.x, config.y, isBack ? -6 : 6);
      const dir = new THREE.Vector3(0, 0, isBack ? 1 : -1);
      const ray = new THREE.Raycaster(origin, dir, 0.1, 50);
      const hits = loadedModel ? ray.intersectObject(loadedModel, true) : [];

      let pos, normal;
      if (hits.length) {
        const hit = hits[0];
        pos = hit.point.clone();
        normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, isBack ? -1 : 1);
        normal.transformDirection(hit.object.matrixWorld).normalize();
        pos.add(normal.clone().multiplyScalar(0.06)); // desloca mais pra frente para ficar acima de relevos
        pos.z += config.z; // ajuste fino do usuário (frente +, costas -)
      } else {
        pos = new THREE.Vector3(config.x, config.y, config.z);
        normal = new THREE.Vector3(0, 0, isBack ? -1 : 1);
      }

      const img = texture.image;
      const aspect = img && img.width ? img.height / img.width : 1;

      // Material sem iluminação (sempre visível) que descarta pixels quase pretos:
      // o fundo preto das imagens some sobre a camisa preta e só aparece a arte.
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaTest: options.alphaTest ? 0.08 : 0,
      });
      if (!options.alphaTest) {
        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#include <map_fragment>
             float _lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
             if (_lum < 0.08) discard;`
          );
        };
      }

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(config.scale, config.scale * aspect),
        mat
      );
      plane.position.copy(pos);
      plane.lookAt(pos.clone().add(normal));
      plane.rotateZ(config.rotation); // giro da estampa no próprio plano
      group.add(plane); // segue a flutuação da camisa
    };

    if (SHIRT_MODEL_URL) {
      const loader = new GLTFLoader();
      loader.load(
        SHIRT_MODEL_URL,
        (gltf) => {
          loadedModel = gltf.scene;
          // normaliza escala
          const box = new THREE.Box3().setFromObject(loadedModel);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 3 / maxDim;
          loadedModel.scale.setScalar(scale);
          loadedModel.position.sub(center.multiplyScalar(scale));

          // Tecido preto — preserva aparência de tecido, a estampa vem como decal
          const fabric = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            roughness: 0.82,
            metalness: 0.0,
          });
          loadedModel.traverse(
            /** @param {THREE.Object3D} o */
            (o) => {
              if (o instanceof THREE.Mesh) {
                o.castShadow = true;
                o.receiveShadow = true;
                o.material = fabric;
              }
            }
          );

          group.remove(placeholder);
          disposeObject(placeholder);
          group.add(loadedModel);
          loadedModel.updateMatrixWorld(true);

          // Estampas (decals) — frente e costas
          /**
           * @param {string} url
           * @param {{x:number,y:number,z:number,scale:number,rotation:number}} cfg
           * @param {boolean} isBack
           */
          const configureAndApply = (url, cfg, isBack) => {
            new THREE.TextureLoader().load(url, (tex) => {
              if (!tex) return applyPrint(tex, cfg, isBack);

              // Color management: mark as sRGB so the renderer linearizes correctly
              tex.colorSpace = THREE.SRGBColorSpace;

              // Filtering / mipmaps: enable mipmaps only for power-of-two images
              if (tex.image && tex.image.width && tex.image.height) {
                const potW = THREE.MathUtils.isPowerOfTwo(tex.image.width);
                const potH = THREE.MathUtils.isPowerOfTwo(tex.image.height);
                if (potW && potH) {
                  tex.generateMipmaps = true;
                  tex.minFilter = THREE.LinearMipmapLinearFilter;
                } else {
                  tex.generateMipmaps = false;
                  tex.minFilter = THREE.LinearFilter;
                }
              } else {
                tex.generateMipmaps = false;
                tex.minFilter = THREE.LinearFilter;
              }
              tex.magFilter = THREE.LinearFilter;

              // Improve sharpness at glancing angles
              tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

              tex.needsUpdate = true;

              applyPrint(tex, cfg, isBack);
            });
          };

          if (FRONT_ART_URL) configureAndApply(FRONT_ART_URL, frontPrint, false);
          if (BACK_ART_URL) configureAndApply(BACK_ART_URL, backPrint, true);

          const nameTexture = createTextTexture(NAME_LABEL_TEXT);
          if (nameTexture) {
            nameTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            nameTexture.needsUpdate = true;
            applyPrint(nameTexture, nameLabelPrint, true, { alphaTest: true });
          }
        },
        undefined,
        () => {
          // mantém o placeholder se falhar
        }
      );
    }

    // --- Ground (sombra suave) ---
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3, 48),
      new THREE.ShadowMaterial({ opacity: 0.28 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.85;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 3.5;
    controls.maxDistance = 10;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.target.set(0, 0, 0);

    let userTookOver = false;
    controls.addEventListener("start", () => {
      if (!userTookOver) {
        userTookOver = true;
        controls.autoRotate = false;
      }
    });

    // --- Loop de animação ---
    /** @type {number} */
    let frame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      // flutua leve apenas enquanto rotação automática
      if (controls.autoRotate) {
        group.position.y = Math.sin(t * 1.2) * 0.08;
      } else {
        group.position.y += (0 - group.position.y) * 0.1;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize ---
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(mount);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      disposeObject(placeholder);
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full"
      style={{ height: "min(62vh, 560px)", minHeight: "340px", touchAction: "none" }}
    />
  );
}