"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useSceneStore } from "@/lib/scene-store";
import type {
  SceneObject,
  SceneLight,
  MaterialConfig,
  AnimationConfig,
  GeometryType,
  GeometryParams,
  BoxParams,
  RoundedBoxParams,
  SphereParams,
  CylinderParams,
  ConeParams,
  TorusParams,
  TorusKnotParams,
  PlaneParams,
  CircleParams,
  RingParams,
  PolyhedronParams,
  ShaderConfig,
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
    case "roundedBox": {
      const p = params as RoundedBoxParams | undefined;
      return new RoundedBoxGeometry(
        p?.width ?? 1,
        p?.height ?? 1,
        p?.depth ?? 1,
        p?.segments ?? 4,
        p?.radius ?? 0.1
      );
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
// Shader Factory
// ============================================================================

// Liquid gradient shader - sinusoidal warp with bump mapping (inspired by Shadertoy)
const liquidGradientShader = {
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uMouseVelocity: { value: new THREE.Vector2(0, 0) },
    // Colors
    uColor1: { value: new THREE.Color("#000000") },
    uColor2: { value: new THREE.Color("#001133") },
    uColor3: { value: new THREE.Color("#0066ff") },
    uColor4: { value: new THREE.Color("#00ccff") },
    uGlowColor: { value: new THREE.Color("#00aaff") },
    // Animation
    uSpeed: { value: 0.3 },
    uNoiseScale: { value: 2.0 },
    uGlowIntensity: { value: 0.5 },
    // Warp controls
    uWarpScale: { value: 4.0 },
    uWarpFrequency: { value: 3.0 },
    uWarpAmplitude: { value: 1.0 },
    // Lighting controls
    uBumpStrength: { value: 0.15 },
    uLightOrbitSpeed: { value: 1.5 },
    uLightOrbitRadius: { value: 0.4 },
    uSpecularPower: { value: 16.0 },
    uSpecularIntensity: { value: 1.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec2 uMouseVelocity;
    // Colors
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform vec3 uGlowColor;
    // Animation
    uniform float uSpeed;
    uniform float uNoiseScale;
    uniform float uGlowIntensity;
    // Warp controls
    uniform float uWarpScale;
    uniform float uWarpFrequency;
    uniform float uWarpAmplitude;
    // Lighting controls
    uniform float uBumpStrength;
    uniform float uLightOrbitSpeed;
    uniform float uLightOrbitRadius;
    uniform float uSpecularPower;
    uniform float uSpecularIntensity;

    varying vec2 vUv;
    varying vec3 vPosition;

    // ============================================================================
    // Sinusoidal Warp Function (from Shadertoy - Fabrice's Plop 2)
    // Creates organic, liquid-metal-like deformations through layered sin/cos feedback
    // ============================================================================
    vec2 warp(vec2 p, float t) {
      // Scale and offset for interesting starting point
      p = (p + 3.0) * uWarpScale;

      // Layered sinusoidal feedback - the magic sauce
      // Each iteration adds more organic complexity
      for (int i = 0; i < 3; i++) {
        p += cos(p.yx * uWarpFrequency + vec2(t, 1.57)) / 3.0 * uWarpAmplitude;
        p += sin(p.yx + t + vec2(1.57, 0.0)) / 2.0 * uWarpAmplitude;
        p *= 1.3;
      }

      // Add subtle jitter to smooth high-frequency areas
      p += fract(sin(p + vec2(13.0, 7.0)) * 5e5) * 0.03 - 0.015;

      return mod(p, 2.0) - 1.0; // Normalize to [-1, 1]
    }

    // Bump function - returns the "height" at a point for bump mapping
    float bumpFunc(vec2 p, float t) {
      return length(warp(p, t)) * 0.7071;
    }

    // Smooth color palette blending
    vec3 smoothFract(vec3 x) {
      x = fract(x);
      return min(x, x * (1.0 - x) * 12.0);
    }

    void main() {
      float time = uTime * uSpeed;

      // ============================================================================
      // BUMP MAPPING - Perturbing the surface normal
      // ============================================================================
      vec2 eps = vec2(0.005, 0.0);

      float f = bumpFunc(vUv, time);
      float fx = bumpFunc(vUv - eps.xy, time);
      float fy = bumpFunc(vUv - eps.yx, time);

      // Calculate gradient for normal perturbation
      float gradX = (fx - f) / eps.x;
      float gradY = (fy - f) / eps.x;

      // Perturb the surface normal (plane facing -Z toward viewer)
      vec3 sn = normalize(vec3(0.0, 0.0, -1.0) + vec3(gradX, gradY, 0.0) * uBumpStrength);

      // ============================================================================
      // LIGHTING - Moving point light with attenuation
      // ============================================================================
      vec3 sp = vec3(vUv, 0.0); // Surface position
      vec3 rd = normalize(vec3(vUv - 0.5, 1.0)); // Ray direction

      // Orbiting light position influenced by mouse
      vec3 lp = vec3(
        cos(time * uLightOrbitSpeed) * uLightOrbitRadius + (uMouse.x - 0.5) * 0.3,
        sin(time * uLightOrbitSpeed * 0.8) * uLightOrbitRadius * 0.75 + (uMouse.y - 0.5) * 0.3,
        -0.8
      );

      // Light direction and distance
      vec3 ld = lp - sp;
      float lDist = max(length(ld), 0.0001);
      ld /= lDist;

      // Light attenuation with distance
      float atten = 1.0 / (1.0 + lDist * lDist * 0.5);

      // Darken crevices using bump height
      atten *= f * 0.85 + 0.15;

      // Diffuse lighting - enhanced for liquid look
      float diff = max(dot(sn, ld), 0.0);
      diff = pow(diff, 4.0) * 0.6 + pow(diff, 8.0) * 0.4;

      // Specular highlighting - creates that wet/metallic sheen
      float spec = pow(max(dot(reflect(-ld, sn), -rd), 0.0), uSpecularPower);

      // ============================================================================
      // COLOR - Warped gradient with 4-color palette
      // ============================================================================
      vec2 warpedUv = warp(vUv, time);

      // Create color index from warped coordinates
      float colorIndex = (warpedUv.x + warpedUv.y) * 0.25 + 0.5;
      colorIndex += f * 0.3; // Add bump variation
      colorIndex = clamp(colorIndex, 0.0, 1.0);

      // Smooth 4-color gradient
      vec3 texCol;
      if (colorIndex < 0.33) {
        float t = smoothstep(0.0, 0.33, colorIndex);
        texCol = mix(uColor1, uColor2, t);
      } else if (colorIndex < 0.66) {
        float t = smoothstep(0.33, 0.66, colorIndex);
        texCol = mix(uColor2, uColor3, t);
      } else {
        float t = smoothstep(0.66, 1.0, colorIndex);
        texCol = mix(uColor3, uColor4, t);
      }

      // Boost saturation slightly
      texCol = pow(texCol, vec3(0.9));

      // ============================================================================
      // FINAL COMPOSITING
      // ============================================================================
      // Combine diffuse lighting with colors
      vec3 col = texCol * (diff * vec3(1.0, 0.97, 0.92) * 2.5 + 0.3);

      // Add specular highlights with glow color influence
      col += mix(vec3(1.0, 0.7, 0.3), uGlowColor, 0.5) * spec * uSpecularIntensity;

      // Apply light attenuation
      col *= atten;

      // Faux environment mapping - adds that extra shine
      float envRef = max(dot(reflect(rd, sn), vec3(1.0, 0.5, 0.0)), 0.0);
      col += col * pow(envRef, 4.0) * uGlowColor * uGlowIntensity * 2.0;

      // Edge glow
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      float edgeY = min(vUv.y, 1.0 - vUv.y);
      float edge = min(edgeX, edgeY);
      float edgeMask = smoothstep(0.0, 0.08, edge);

      float glowPulse = sin(time * 2.0) * 0.15 + 0.85;
      vec3 edgeGlow = uGlowColor * (1.0 - edgeMask) * uGlowIntensity * glowPulse;
      col = col * edgeMask + edgeGlow + col * (1.0 - edgeMask) * 0.3;

      // Gamma correction (sqrt approximation for 2.0 gamma)
      gl_FragColor = vec4(sqrt(clamp(col, 0.0, 1.0)), 1.0);
    }
  `,
};

function createShaderMaterial(config: ShaderConfig): THREE.ShaderMaterial {
  const shaderType = config.shaderType || "liquidGradient";

  if (shaderType === "liquidGradient") {
    const colors = config.colors || ["#000000", "#001133", "#0066ff", "#00ccff"];
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMouseVelocity: { value: new THREE.Vector2(0, 0) },
        // Colors
        uColor1: { value: new THREE.Color(colors[0] || "#000000") },
        uColor2: { value: new THREE.Color(colors[1] || "#001133") },
        uColor3: { value: new THREE.Color(colors[2] || "#0066ff") },
        uColor4: { value: new THREE.Color(colors[3] || "#00ccff") },
        uGlowColor: { value: new THREE.Color(config.glowColor || "#00aaff") },
        // Animation
        uSpeed: { value: config.speed ?? 0.3 },
        uNoiseScale: { value: config.noiseScale ?? 2.0 },
        uGlowIntensity: { value: config.glowIntensity ?? 0.5 },
        // Warp controls
        uWarpScale: { value: config.warpScale ?? 4.0 },
        uWarpFrequency: { value: config.warpFrequency ?? 3.0 },
        uWarpAmplitude: { value: config.warpAmplitude ?? 1.0 },
        // Lighting controls
        uBumpStrength: { value: config.bumpStrength ?? 0.15 },
        uLightOrbitSpeed: { value: config.lightOrbitSpeed ?? 1.5 },
        uLightOrbitRadius: { value: config.lightOrbitRadius ?? 0.4 },
        uSpecularPower: { value: config.specularPower ?? 16.0 },
        uSpecularIntensity: { value: config.specularIntensity ?? 1.5 },
      },
      vertexShader: liquidGradientShader.vertexShader,
      fragmentShader: liquidGradientShader.fragmentShader,
      side: THREE.DoubleSide,
    });
    return material;
  }

  // Default fallback
  return new THREE.ShaderMaterial({
    uniforms: liquidGradientShader.uniforms,
    vertexShader: liquidGradientShader.vertexShader,
    fragmentShader: liquidGradientShader.fragmentShader,
    side: THREE.DoubleSide,
  });
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

    case "shader":
      if (config.shader) {
        return createShaderMaterial(config.shader);
      }
      // Fallback to default liquid gradient if no shader config
      return createShaderMaterial({ shaderType: "liquidGradient" });

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

  // Mouse tracking refs
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseVelocityRef = useRef({ x: 0, y: 0 });
  const lastMouseRef = useRef({ x: 0.5, y: 0.5 });

  // Camera orbit refs
  const cameraConfigRef = useRef(camera);
  const cameraOrbitAngleRef = useRef(0);
  const cameraOrbitRadiusRef = useRef(0);
  const cameraOrbitHeightRef = useRef(0);

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

    // Mouse tracking - normalized to 0-1 range
    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      // Normalize mouse position to 0-1 range relative to the container
      targetMouseRef.current = {
        x: (event.clientX - rect.left) / rect.width,
        y: 1.0 - (event.clientY - rect.top) / rect.height, // Flip Y for WebGL coordinates
      };
    };

    // Also handle touch for mobile
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        const rect = container.getBoundingClientRect();
        targetMouseRef.current = {
          x: (touch.clientX - rect.left) / rect.width,
          y: 1.0 - (touch.clientY - rect.top) / rect.height,
        };
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    // Animation loop
    let animationId: number;
    let lastTime = performance.now();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Smooth mouse movement with lerp (easing factor)
      const lerpFactor = 0.08;
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * lerpFactor;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * lerpFactor;

      // Calculate mouse velocity (smoothed)
      mouseVelocityRef.current.x = (mouseRef.current.x - lastMouseRef.current.x) / Math.max(deltaTime, 0.001);
      mouseVelocityRef.current.y = (mouseRef.current.y - lastMouseRef.current.y) / Math.max(deltaTime, 0.001);

      // Store last mouse position
      lastMouseRef.current.x = mouseRef.current.x;
      lastMouseRef.current.y = mouseRef.current.y;

      // Apply animations to all meshes and update shader uniforms
      meshesRef.current.forEach((mesh, id) => {
        const objConfig = objectConfigsRef.current[id];

        // Update shader uniforms if it's a shader material
        if (mesh.material instanceof THREE.ShaderMaterial) {
          if (mesh.material.uniforms.uTime) {
            mesh.material.uniforms.uTime.value += deltaTime;
          }
          // Update mouse uniforms
          if (mesh.material.uniforms.uMouse) {
            mesh.material.uniforms.uMouse.value.set(
              mouseRef.current.x,
              mouseRef.current.y
            );
          }
          if (mesh.material.uniforms.uMouseVelocity) {
            // Clamp velocity for smoother effect
            const vx = Math.max(-2, Math.min(2, mouseVelocityRef.current.x));
            const vy = Math.max(-2, Math.min(2, mouseVelocityRef.current.y));
            mesh.material.uniforms.uMouseVelocity.value.set(vx, vy);
          }
        }

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

      // Camera auto-rotation (orbit around lookAt point)
      const camConfig = cameraConfigRef.current;
      if (camConfig.autoRotate) {
        const speed = (camConfig.autoRotateSpeed ?? 1) * 0.3;
        cameraOrbitAngleRef.current += deltaTime * speed;

        const lookAt = camConfig.lookAt ?? { x: 0, y: 0, z: 0 };
        const radius = cameraOrbitRadiusRef.current;
        const height = cameraOrbitHeightRef.current;

        // Orbit camera around the lookAt point
        threeCamera.position.x = lookAt.x + Math.cos(cameraOrbitAngleRef.current) * radius;
        threeCamera.position.z = lookAt.z + Math.sin(cameraOrbitAngleRef.current) * radius;
        threeCamera.position.y = height;
        threeCamera.lookAt(lookAt.x, lookAt.y, lookAt.z);
      }

      renderer.render(scene, threeCamera);
    };
    animate();

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
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

    // Update camera config ref for animation loop
    cameraConfigRef.current = camera;

    // Calculate orbit radius and height from initial camera position
    const lookAt = camera.lookAt ?? { x: 0, y: 0, z: 0 };
    const dx = camera.position.x - lookAt.x;
    const dz = camera.position.z - lookAt.z;
    cameraOrbitRadiusRef.current = Math.sqrt(dx * dx + dz * dz);
    cameraOrbitHeightRef.current = camera.position.y;
    // Initialize angle from current position
    cameraOrbitAngleRef.current = Math.atan2(dz, dx);

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
