// ============================================================================
// Geometry Types
// ============================================================================

export type GeometryType =
  | "box"
  | "sphere"
  | "cylinder"
  | "cone"
  | "torus"
  | "torusKnot"
  | "plane"
  | "circle"
  | "ring"
  | "dodecahedron"
  | "icosahedron"
  | "octahedron"
  | "tetrahedron";

export interface BoxParams {
  width?: number;
  height?: number;
  depth?: number;
}

export interface SphereParams {
  radius?: number;
  widthSegments?: number;
  heightSegments?: number;
}

export interface CylinderParams {
  radiusTop?: number;
  radiusBottom?: number;
  height?: number;
  radialSegments?: number;
}

export interface ConeParams {
  radius?: number;
  height?: number;
  radialSegments?: number;
}

export interface TorusParams {
  radius?: number;
  tube?: number;
  radialSegments?: number;
  tubularSegments?: number;
}

export interface TorusKnotParams {
  radius?: number;
  tube?: number;
  tubularSegments?: number;
  radialSegments?: number;
  p?: number;
  q?: number;
}

export interface PlaneParams {
  width?: number;
  height?: number;
}

export interface CircleParams {
  radius?: number;
  segments?: number;
}

export interface RingParams {
  innerRadius?: number;
  outerRadius?: number;
}

export interface PolyhedronParams {
  radius?: number;
}

export type GeometryParams =
  | BoxParams
  | SphereParams
  | CylinderParams
  | ConeParams
  | TorusParams
  | TorusKnotParams
  | PlaneParams
  | CircleParams
  | RingParams
  | PolyhedronParams;

// ============================================================================
// Material Types
// ============================================================================

export type MaterialType =
  | "basic"
  | "standard"
  | "phong"
  | "lambert"
  | "toon"
  | "normal";

export interface MaterialConfig {
  type: MaterialType;
  color?: string; // hex color e.g., "#ff0000"
  wireframe?: boolean;
  transparent?: boolean;
  opacity?: number; // 0-1
  metalness?: number; // 0-1 (standard only)
  roughness?: number; // 0-1 (standard only)
  emissive?: string; // hex color
  emissiveIntensity?: number;
  side?: "front" | "back" | "double";
}

// ============================================================================
// Vector & Transform Types
// ============================================================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// Animation Types
// ============================================================================

export type AnimationType =
  | "rotate"
  | "bounce"
  | "float"
  | "pulse"
  | "orbit"
  | "none";

export interface AnimationConfig {
  type: AnimationType;
  speed?: number; // multiplier, default 1
  axis?: "x" | "y" | "z" | "all";
  amplitude?: number; // for bounce/float/pulse
  center?: Vector3; // for orbit
  radius?: number; // for orbit
}

// ============================================================================
// Scene Object Types
// ============================================================================

export interface SceneObject {
  id: string;
  name?: string;
  geometry: {
    type: GeometryType;
    params?: GeometryParams;
  };
  material: MaterialConfig;
  position?: Vector3;
  rotation?: Vector3; // in radians
  scale?: Vector3;
  animation?: AnimationConfig;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

// ============================================================================
// Light Types
// ============================================================================

export type LightType =
  | "ambient"
  | "directional"
  | "point"
  | "spot"
  | "hemisphere";

export interface SceneLight {
  id: string;
  name?: string;
  type: LightType;
  color?: string;
  intensity?: number;
  position?: Vector3;
  target?: Vector3; // for directional/spot
  // Spot light specific
  angle?: number;
  penumbra?: number;
  decay?: number;
  distance?: number;
  // Hemisphere specific
  groundColor?: string;
  castShadow?: boolean;
}

// ============================================================================
// Camera Types
// ============================================================================

export interface CameraConfig {
  position: Vector3;
  lookAt?: Vector3;
  fov?: number; // field of view (perspective)
  near?: number;
  far?: number;
  zoom?: number;
}

// ============================================================================
// Scene Config Types
// ============================================================================

export interface SceneConfig {
  background?: string; // hex color or 'transparent'
  fog?: {
    color: string;
    near: number;
    far: number;
  };
}

// ============================================================================
// Complete Scene State
// ============================================================================

export interface SceneState {
  objects: Record<string, SceneObject>;
  lights: Record<string, SceneLight>;
  camera: CameraConfig;
  config: SceneConfig;
}

// ============================================================================
// Scene Commands (sent from Claude via data parts)
// ============================================================================

export type SceneCommand =
  | { action: "addObject"; object: SceneObject }
  | { action: "updateObject"; id: string; updates: Partial<Omit<SceneObject, "id">> }
  | { action: "removeObject"; id: string }
  | { action: "addLight"; light: SceneLight }
  | { action: "updateLight"; id: string; updates: Partial<Omit<SceneLight, "id">> }
  | { action: "removeLight"; id: string }
  | { action: "setCamera"; config: Partial<CameraConfig> }
  | { action: "setConfig"; config: Partial<SceneConfig> }
  | { action: "clearScene" }
  | { action: "resetScene" };
