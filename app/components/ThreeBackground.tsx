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

// Liquid gradient shader - creates flowing gradient effect like Apple M4 Pro chip
const liquidGradientShader = {
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) }, // Normalized mouse position
    uMouseVelocity: { value: new THREE.Vector2(0, 0) }, // Mouse movement speed
    uColor1: { value: new THREE.Color("#000000") },
    uColor2: { value: new THREE.Color("#001133") },
    uColor3: { value: new THREE.Color("#0066ff") },
    uColor4: { value: new THREE.Color("#00ccff") },
    uNoiseScale: { value: 2.0 },
    uSpeed: { value: 0.3 },
    uGlowIntensity: { value: 0.5 },
    uGlowColor: { value: new THREE.Color("#00aaff") },
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
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform float uNoiseScale;
    uniform float uSpeed;
    uniform float uGlowIntensity;
    uniform vec3 uGlowColor;

    varying vec2 vUv;
    varying vec3 vPosition;

    // Simplex noise functions
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // Smooth noise for solid liquid blobs (fewer octaves, lower frequency)
    float liquidFbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.6;
      float frequency = 0.8;
      // Only 2 octaves for smoother, more solid appearance
      for (int i = 0; i < 2; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.4;
        frequency *= 1.8;
      }
      return value;
    }

    // Metaball-like function for solid blob boundaries
    float metaball(vec2 uv, vec2 center, float radius) {
      float d = length(uv - center);
      return radius / (d * d + 0.01);
    }

    void main() {
      float time = uTime * uSpeed;

      // Rotate UV coordinates 45 degrees for diagonal gradient
      vec2 center = vec2(0.5, 0.5);
      vec2 centeredUv = vUv - center;
      float angle = 0.785398;
      vec2 rotatedUv;
      rotatedUv.x = centeredUv.x * cos(angle) - centeredUv.y * sin(angle);
      rotatedUv.y = centeredUv.x * sin(angle) + centeredUv.y * cos(angle);
      rotatedUv += center;

      // === MOUSE INTERACTION (thick liquid displacement) ===
      vec2 mouseOffset = vUv - uMouse;
      float mouseDist = length(mouseOffset);
      float mouseRadius = 0.3;
      // Sharper falloff for solid liquid feel
      float mouseInfluence = pow(smoothstep(mouseRadius, 0.0, mouseDist), 2.0);

      // Heavy displacement like pushing through thick liquid
      vec2 mouseRepel = normalize(mouseOffset + vec2(0.001)) * mouseInfluence * 0.2;

      // Slower, heavier swirl for viscous feel
      float velocityMag = length(uMouseVelocity);
      float swirlAngle = atan(mouseOffset.y, mouseOffset.x) + time * 0.8;
      vec2 mouseSwirl = vec2(cos(swirlAngle), sin(swirlAngle)) * mouseInfluence * velocityMag * 0.15;

      // === SOLID LIQUID BLOBS ===
      // Low frequency noise for large, smooth blobs
      vec3 noiseCoord = vec3(vUv * uNoiseScale * 0.6, time * 0.15);
      float blobNoise = liquidFbm(noiseCoord);
      float blobNoise2 = liquidFbm(noiseCoord + vec3(100.0, 50.0, time * 0.1));

      // Slow, heavy movement
      vec2 blobDisplace = vec2(
        sin(blobNoise * 2.0 + time * 0.3) * 0.08,
        cos(blobNoise2 * 2.0 + time * 0.25) * 0.08
      );

      // Apply displacement
      vec2 liquidUv = rotatedUv + blobDisplace + mouseRepel + mouseSwirl;

      // === SOLID COLOR REGIONS WITH SHARP BOUNDARIES ===
      // Base diagonal gradient
      float baseGradient = (liquidUv.x + liquidUv.y) * 0.5;

      // Create distinct blob regions using stepped noise
      float blobField = liquidFbm(vec3(vUv * 1.5, time * 0.12));

      // Threshold the noise to create solid regions
      float region1 = smoothstep(-0.1, 0.05, blobField);
      float region2 = smoothstep(0.1, 0.25, blobField);
      float region3 = smoothstep(0.3, 0.45, blobField);

      // Combine gradient with blob regions for solid color bands
      float colorIndex = baseGradient + blobField * 0.3;
      colorIndex = clamp(colorIndex, 0.0, 1.0);

      // Sharp color transitions (solid liquid, not smoky)
      vec3 color;
      if (colorIndex < 0.25) {
        float t = smoothstep(0.0, 0.25, colorIndex);
        t = t * t * (3.0 - 2.0 * t); // Smootherstep for solid feel
        color = mix(uColor1, uColor2, t);
      } else if (colorIndex < 0.5) {
        float t = smoothstep(0.25, 0.5, colorIndex);
        t = t * t * (3.0 - 2.0 * t);
        color = mix(uColor2, uColor3, t);
      } else if (colorIndex < 0.75) {
        float t = smoothstep(0.5, 0.75, colorIndex);
        t = t * t * (3.0 - 2.0 * t);
        color = mix(uColor3, uColor4, t);
      } else {
        color = uColor4;
      }

      // Add subtle surface tension highlights (not shimmer)
      float surfaceTension = liquidFbm(vec3(liquidUv * 3.0, time * 0.2));
      float highlight = smoothstep(0.3, 0.5, surfaceTension) * 0.12;
      color += uColor4 * highlight;

      // === MOUSE CREATES DEPRESSION/BULGE IN LIQUID ===
      // Solid glow like light reflecting off liquid surface
      float surfaceGlow = pow(mouseInfluence, 3.0) * 0.5;
      color += uColor4 * surfaceGlow;

      // Subtle ring where liquid is displaced (surface tension)
      float ring = smoothstep(0.15, 0.18, mouseDist) * smoothstep(0.25, 0.18, mouseDist);
      ring *= mouseInfluence * 2.0;
      color += uColor3 * ring * 0.3;

      // Velocity creates stretched highlight
      color += uColor4 * velocityMag * mouseInfluence * 0.4;

      // === EDGE GLOW (refined) ===
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      float edgeY = min(vUv.y, 1.0 - vUv.y);
      float edge = min(edgeX, edgeY);
      float glowWidth = 0.06;
      float edgeMask = smoothstep(0.0, glowWidth, edge);

      // Subtle animated edge glow
      float glowPulse = sin(time * 2.0) * 0.1 + 0.9;
      vec3 edgeGlow = uGlowColor * (1.0 - edgeMask) * uGlowIntensity * glowPulse * 0.7;

      color = color * edgeMask + edgeGlow + color * (1.0 - edgeMask) * 0.4;

      // Boost saturation for solid liquid look
      float luminance = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luminance), color, 1.2);

      gl_FragColor = vec4(color, 1.0);
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
        uColor1: { value: new THREE.Color(colors[0] || "#000000") },
        uColor2: { value: new THREE.Color(colors[1] || "#001133") },
        uColor3: { value: new THREE.Color(colors[2] || "#0066ff") },
        uColor4: { value: new THREE.Color(colors[3] || "#00ccff") },
        uNoiseScale: { value: config.noiseScale ?? 2.0 },
        uSpeed: { value: config.speed ?? 0.3 },
        uGlowIntensity: { value: config.glowIntensity ?? 0.5 },
        uGlowColor: { value: new THREE.Color(config.glowColor || "#00aaff") },
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
