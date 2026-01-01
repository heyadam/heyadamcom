"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useSceneStore } from "@/lib/scene-store";
import type {
  SceneObject,
  SceneLight,
  MaterialConfig,
  AnimationConfig,
  GeometryType,
  GeometryParams,
  BoxParams,
  SphereParams,
  CylinderParams,
  ConeParams,
  TorusParams,
  TorusKnotParams,
  PlaneParams,
  CircleParams,
  RingParams,
  PolyhedronParams,
} from "@/lib/scene-types";

// ============================================================================
// Geometry Factory
// ============================================================================

function createGeometry(
  type: GeometryType,
  params?: GeometryParams
): THREE.BufferGeometry {
  switch (type) {
    case "box": {
      const p = params as BoxParams | undefined;
      return new THREE.BoxGeometry(p?.width ?? 1, p?.height ?? 1, p?.depth ?? 1);
    }
    case "sphere": {
      const p = params as SphereParams | undefined;
      return new THREE.SphereGeometry(
        p?.radius ?? 1,
        p?.widthSegments ?? 32,
        p?.heightSegments ?? 32
      );
    }
    case "cylinder": {
      const p = params as CylinderParams | undefined;
      return new THREE.CylinderGeometry(
        p?.radiusTop ?? 1,
        p?.radiusBottom ?? 1,
        p?.height ?? 2,
        p?.radialSegments ?? 32
      );
    }
    case "cone": {
      const p = params as ConeParams | undefined;
      return new THREE.ConeGeometry(
        p?.radius ?? 1,
        p?.height ?? 2,
        p?.radialSegments ?? 32
      );
    }
    case "torus": {
      const p = params as TorusParams | undefined;
      return new THREE.TorusGeometry(
        p?.radius ?? 1,
        p?.tube ?? 0.4,
        p?.radialSegments ?? 16,
        p?.tubularSegments ?? 100
      );
    }
    case "torusKnot": {
      const p = params as TorusKnotParams | undefined;
      return new THREE.TorusKnotGeometry(
        p?.radius ?? 1,
        p?.tube ?? 0.3,
        p?.tubularSegments ?? 100,
        p?.radialSegments ?? 16,
        p?.p ?? 2,
        p?.q ?? 3
      );
    }
    case "plane": {
      const p = params as PlaneParams | undefined;
      return new THREE.PlaneGeometry(p?.width ?? 1, p?.height ?? 1);
    }
    case "circle": {
      const p = params as CircleParams | undefined;
      return new THREE.CircleGeometry(p?.radius ?? 1, p?.segments ?? 32);
    }
    case "ring": {
      const p = params as RingParams | undefined;
      return new THREE.RingGeometry(p?.innerRadius ?? 0.5, p?.outerRadius ?? 1);
    }
    case "dodecahedron": {
      const p = params as PolyhedronParams | undefined;
      return new THREE.DodecahedronGeometry(p?.radius ?? 1);
    }
    case "icosahedron": {
      const p = params as PolyhedronParams | undefined;
      return new THREE.IcosahedronGeometry(p?.radius ?? 1);
    }
    case "octahedron": {
      const p = params as PolyhedronParams | undefined;
      return new THREE.OctahedronGeometry(p?.radius ?? 1);
    }
    case "tetrahedron": {
      const p = params as PolyhedronParams | undefined;
      return new THREE.TetrahedronGeometry(p?.radius ?? 1);
    }
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

// ============================================================================
// Material Factory
// ============================================================================

function createMaterial(config: MaterialConfig): THREE.Material {
  const color = config.color ? new THREE.Color(config.color) : undefined;
  const side =
    config.side === "back"
      ? THREE.BackSide
      : config.side === "double"
        ? THREE.DoubleSide
        : THREE.FrontSide;

  const baseProps = {
    color,
    wireframe: config.wireframe,
    transparent: config.transparent,
    opacity: config.opacity,
    side,
  };

  switch (config.type) {
    case "basic":
      return new THREE.MeshBasicMaterial(baseProps);

    case "standard":
      return new THREE.MeshStandardMaterial({
        ...baseProps,
        metalness: config.metalness ?? 0,
        roughness: config.roughness ?? 1,
        emissive: config.emissive ? new THREE.Color(config.emissive) : undefined,
        emissiveIntensity: config.emissiveIntensity,
      });

    case "phong":
      return new THREE.MeshPhongMaterial({
        ...baseProps,
        emissive: config.emissive ? new THREE.Color(config.emissive) : undefined,
        emissiveIntensity: config.emissiveIntensity,
      });

    case "lambert":
      return new THREE.MeshLambertMaterial({
        ...baseProps,
        emissive: config.emissive ? new THREE.Color(config.emissive) : undefined,
        emissiveIntensity: config.emissiveIntensity,
      });

    case "toon":
      return new THREE.MeshToonMaterial(baseProps);

    case "normal":
      return new THREE.MeshNormalMaterial({
        wireframe: config.wireframe,
        transparent: config.transparent,
        opacity: config.opacity,
        side,
      });

    default:
      return new THREE.MeshBasicMaterial(baseProps);
  }
}

// ============================================================================
// Light Factory
// ============================================================================

function createLight(config: SceneLight): THREE.Light {
  const color = config.color
    ? new THREE.Color(config.color)
    : new THREE.Color(0xffffff);
  const intensity = config.intensity ?? 1;

  let light: THREE.Light;

  switch (config.type) {
    case "ambient":
      light = new THREE.AmbientLight(color, intensity);
      break;

    case "directional": {
      const dirLight = new THREE.DirectionalLight(color, intensity);
      if (config.position) {
        dirLight.position.set(
          config.position.x,
          config.position.y,
          config.position.z
        );
      }
      if (config.castShadow) {
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
      }
      light = dirLight;
      break;
    }

    case "point": {
      const pointLight = new THREE.PointLight(
        color,
        intensity,
        config.distance ?? 0,
        config.decay ?? 2
      );
      if (config.position) {
        pointLight.position.set(
          config.position.x,
          config.position.y,
          config.position.z
        );
      }
      if (config.castShadow) {
        pointLight.castShadow = true;
      }
      light = pointLight;
      break;
    }

    case "spot": {
      const spotLight = new THREE.SpotLight(
        color,
        intensity,
        config.distance ?? 0,
        config.angle ?? Math.PI / 3,
        config.penumbra ?? 0,
        config.decay ?? 2
      );
      if (config.position) {
        spotLight.position.set(
          config.position.x,
          config.position.y,
          config.position.z
        );
      }
      if (config.castShadow) {
        spotLight.castShadow = true;
      }
      light = spotLight;
      break;
    }

    case "hemisphere": {
      const groundColor = config.groundColor
        ? new THREE.Color(config.groundColor)
        : new THREE.Color(0x444444);
      light = new THREE.HemisphereLight(color, groundColor, intensity);
      break;
    }

    default:
      light = new THREE.AmbientLight(color, intensity);
  }

  return light;
}

// ============================================================================
// Animation State
// ============================================================================

interface AnimationState {
  time: number;
  initialPosition: THREE.Vector3;
  initialScale: THREE.Vector3;
}

function applyAnimation(
  mesh: THREE.Object3D,
  config: AnimationConfig,
  state: AnimationState,
  deltaTime: number
): void {
  const speed = config.speed ?? 1;
  state.time += deltaTime * speed;

  switch (config.type) {
    case "rotate": {
      const rotSpeed = 0.5 * speed;
      if (config.axis === "x" || config.axis === "all")
        mesh.rotation.x += rotSpeed * deltaTime;
      if (config.axis === "y" || config.axis === "all" || !config.axis)
        mesh.rotation.y += rotSpeed * deltaTime;
      if (config.axis === "z" || config.axis === "all")
        mesh.rotation.z += rotSpeed * deltaTime;
      break;
    }

    case "bounce": {
      const amplitude = config.amplitude ?? 0.5;
      mesh.position.y =
        state.initialPosition.y + Math.abs(Math.sin(state.time * 2)) * amplitude;
      break;
    }

    case "float": {
      const amplitude = config.amplitude ?? 0.3;
      mesh.position.y = state.initialPosition.y + Math.sin(state.time) * amplitude;
      break;
    }

    case "pulse": {
      const amplitude = config.amplitude ?? 0.2;
      const scale = 1 + Math.sin(state.time * 2) * amplitude;
      mesh.scale.set(
        state.initialScale.x * scale,
        state.initialScale.y * scale,
        state.initialScale.z * scale
      );
      break;
    }

    case "orbit": {
      const radius = config.radius ?? 2;
      const center = config.center ?? { x: 0, y: 0, z: 0 };
      mesh.position.x = center.x + Math.cos(state.time) * radius;
      mesh.position.z = center.z + Math.sin(state.time) * radius;
      break;
    }

    case "none":
      // No animation
      break;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export default function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to scene state from Zustand store
  const objects = useSceneStore((state) => state.objects);
  const lights = useSceneStore((state) => state.lights);
  const camera = useSceneStore((state) => state.camera);
  const config = useSceneStore((state) => state.config);

  // Refs for Three.js objects that persist across renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const lightsRef = useRef<Map<string, THREE.Light>>(new Map());
  const animationStatesRef = useRef<Map<string, AnimationState>>(new Map());
  const objectConfigsRef = useRef<Record<string, SceneObject>>({});

  // Initialize Three.js scene (runs once)
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create camera with initial settings
    const threeCamera = new THREE.PerspectiveCamera(
      camera.fov ?? 75,
      container.clientWidth / container.clientHeight,
      camera.near ?? 0.1,
      camera.far ?? 1000
    );
    threeCamera.position.set(camera.position.x, camera.position.y, camera.position.z);
    if (camera.lookAt) {
      threeCamera.lookAt(camera.lookAt.x, camera.lookAt.y, camera.lookAt.z);
    }
    cameraRef.current = threeCamera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      threeCamera.aspect = width / height;
      threeCamera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // Animation loop
    let animationId: number;
    let lastTime = performance.now();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Apply animations to all meshes
      meshesRef.current.forEach((mesh, id) => {
        const objConfig = objectConfigsRef.current[id];
        if (objConfig?.animation && objConfig.animation.type !== "none") {
          let state = animationStatesRef.current.get(id);
          if (!state) {
            state = {
              time: 0,
              initialPosition: mesh.position.clone(),
              initialScale: mesh.scale.clone(),
            };
            animationStatesRef.current.set(id, state);
          }
          applyAnimation(mesh, objConfig.animation, state, deltaTime);
        }
      });

      renderer.render(scene, threeCamera);
    };
    animate();

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync camera with store
  useEffect(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;

    cam.position.set(camera.position.x, camera.position.y, camera.position.z);
    if (camera.lookAt) {
      cam.lookAt(camera.lookAt.x, camera.lookAt.y, camera.lookAt.z);
    }
    if (camera.fov !== undefined) cam.fov = camera.fov;
    if (camera.zoom !== undefined) cam.zoom = camera.zoom;
    cam.updateProjectionMatrix();
  }, [camera]);

  // Sync scene config with store
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (config.background === "transparent") {
      scene.background = null;
    } else if (config.background) {
      scene.background = new THREE.Color(config.background);
    }

    if (config.fog) {
      scene.fog = new THREE.Fog(config.fog.color, config.fog.near, config.fog.far);
    } else {
      scene.fog = null;
    }
  }, [config]);

  // Sync objects with store
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Store current configs for animation reference
    objectConfigsRef.current = objects;

    // Find objects to remove (in Three.js but not in store)
    meshesRef.current.forEach((mesh, id) => {
      if (!objects[id]) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
        meshesRef.current.delete(id);
        animationStatesRef.current.delete(id);
      }
    });

    // Add or update objects
    Object.values(objects).forEach((obj) => {
      let mesh = meshesRef.current.get(obj.id);

      if (!mesh) {
        // Create new mesh
        const geometry = createGeometry(obj.geometry.type, obj.geometry.params);
        const material = createMaterial(obj.material);
        mesh = new THREE.Mesh(geometry, material);
        mesh.name = obj.name ?? obj.id;
        meshesRef.current.set(obj.id, mesh);
        scene.add(mesh);
      } else {
        // Update existing mesh - recreate geometry and material
        mesh.geometry.dispose();
        mesh.geometry = createGeometry(obj.geometry.type, obj.geometry.params);

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
        mesh.material = createMaterial(obj.material);
      }

      // Apply transforms
      if (obj.position) {
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
      } else {
        mesh.position.set(0, 0, 0);
      }

      if (obj.rotation) {
        mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
      } else {
        mesh.rotation.set(0, 0, 0);
      }

      if (obj.scale) {
        mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
      } else {
        mesh.scale.set(1, 1, 1);
      }

      mesh.visible = obj.visible ?? true;
      mesh.castShadow = obj.castShadow ?? false;
      mesh.receiveShadow = obj.receiveShadow ?? false;

      // Reset animation state if animation changed
      if (obj.animation) {
        const existingState = animationStatesRef.current.get(obj.id);
        if (existingState) {
          existingState.initialPosition = mesh.position.clone();
          existingState.initialScale = mesh.scale.clone();
        }
      }
    });
  }, [objects]);

  // Sync lights with store
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Find lights to remove
    lightsRef.current.forEach((light, id) => {
      if (!lights[id]) {
        scene.remove(light);
        light.dispose();
        lightsRef.current.delete(id);
      }
    });

    // Add or update lights
    Object.values(lights).forEach((lightConfig) => {
      let light = lightsRef.current.get(lightConfig.id);

      if (!light) {
        // Create new light
        light = createLight(lightConfig);
        light.name = lightConfig.name ?? lightConfig.id;
        lightsRef.current.set(lightConfig.id, light);
        scene.add(light);
      } else {
        // Update existing light properties
        if (lightConfig.color) {
          light.color.set(lightConfig.color);
        }
        if (lightConfig.intensity !== undefined) {
          light.intensity = lightConfig.intensity;
        }
        if (lightConfig.position && "position" in light) {
          (light as THREE.PointLight).position.set(
            lightConfig.position.x,
            lightConfig.position.y,
            lightConfig.position.z
          );
        }
      }
    });
  }, [lights]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
