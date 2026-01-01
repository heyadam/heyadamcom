import { create } from "zustand";
import type {
  SceneState,
  SceneCommand,
  SceneObject,
  SceneLight,
  CameraConfig,
  SceneConfig,
  ShaderConfig,
} from "./scene-types";

// Default camera positioned at z=5, looking at origin
const DEFAULT_CAMERA: CameraConfig = {
  position: { x: 0, y: 0, z: 5 },
  lookAt: { x: 0, y: 0, z: 0 },
  fov: 75,
  near: 0.1,
  far: 1000,
};

// Default scene config with transparent background
const DEFAULT_CONFIG: SceneConfig = {
  background: "transparent",
};

// Default ambient light so objects are visible
const DEFAULT_AMBIENT_LIGHT: SceneLight = {
  id: "default-ambient",
  type: "ambient",
  color: "#ffffff",
  intensity: 0.5,
};

// Apple M4-inspired liquid gradient shader config
const LIQUID_GRADIENT_SHADER: ShaderConfig = {
  shaderType: "liquidGradient",
  // Deep navy/black to bright cyan gradient inspired by M4 Pro chip
  colors: ["#000005", "#001028", "#0055aa", "#00bbff"],
  speed: 0.4, // Slightly faster for more visible liquid motion
  noiseScale: 2.2, // More distortion for liquid feel
  glowIntensity: 0.7,
  glowColor: "#00aaff",
};

// Initial liquid gradient plane
const INITIAL_GRADIENT_PLANE: SceneObject = {
  id: "liquid-gradient",
  name: "Liquid Gradient Background",
  geometry: {
    type: "plane",
    params: {
      width: 8,
      height: 8,
    },
  },
  material: {
    type: "shader",
    shader: LIQUID_GRADIENT_SHADER,
  },
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

// Initial state for a fresh scene
const INITIAL_STATE: SceneState = {
  objects: {
    "liquid-gradient": INITIAL_GRADIENT_PLANE,
  },
  lights: {
    "default-ambient": DEFAULT_AMBIENT_LIGHT,
  },
  camera: DEFAULT_CAMERA,
  config: DEFAULT_CONFIG,
};

// Store interface extends state with actions
interface SceneStore extends SceneState {
  // Main command dispatcher - called from onData
  applyCommand: (command: SceneCommand) => void;

  // Individual actions for each command type
  addObject: (object: SceneObject) => void;
  updateObject: (id: string, updates: Partial<Omit<SceneObject, "id">>) => void;
  removeObject: (id: string) => void;
  addLight: (light: SceneLight) => void;
  updateLight: (id: string, updates: Partial<Omit<SceneLight, "id">>) => void;
  removeLight: (id: string) => void;
  setCamera: (config: Partial<CameraConfig>) => void;
  setConfig: (config: Partial<SceneConfig>) => void;
  clearScene: () => void;
  resetScene: () => void;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  // Spread initial state
  ...INITIAL_STATE,

  // Command dispatcher - routes commands to appropriate actions
  applyCommand: (command: SceneCommand) => {
    const actions = get();

    switch (command.action) {
      case "addObject":
        actions.addObject(command.object);
        break;
      case "updateObject":
        actions.updateObject(command.id, command.updates);
        break;
      case "removeObject":
        actions.removeObject(command.id);
        break;
      case "addLight":
        actions.addLight(command.light);
        break;
      case "updateLight":
        actions.updateLight(command.id, command.updates);
        break;
      case "removeLight":
        actions.removeLight(command.id);
        break;
      case "setCamera":
        actions.setCamera(command.config);
        break;
      case "setConfig":
        actions.setConfig(command.config);
        break;
      case "clearScene":
        actions.clearScene();
        break;
      case "resetScene":
        actions.resetScene();
        break;
    }
  },

  // Add a new object to the scene
  addObject: (object) =>
    set((state) => ({
      objects: { ...state.objects, [object.id]: object },
    })),

  // Update an existing object (merges updates)
  updateObject: (id, updates) =>
    set((state) => {
      const existing = state.objects[id];
      if (!existing) return state;

      return {
        objects: {
          ...state.objects,
          [id]: { ...existing, ...updates },
        },
      };
    }),

  // Remove an object by id
  removeObject: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.objects;
      return { objects: rest };
    }),

  // Add a new light to the scene
  addLight: (light) =>
    set((state) => ({
      lights: { ...state.lights, [light.id]: light },
    })),

  // Update an existing light (merges updates)
  updateLight: (id, updates) =>
    set((state) => {
      const existing = state.lights[id];
      if (!existing) return state;

      return {
        lights: {
          ...state.lights,
          [id]: { ...existing, ...updates },
        },
      };
    }),

  // Remove a light by id
  removeLight: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.lights;
      return { lights: rest };
    }),

  // Update camera settings (merges with existing)
  setCamera: (config) =>
    set((state) => ({
      camera: { ...state.camera, ...config },
    })),

  // Update scene config (merges with existing)
  setConfig: (config) =>
    set((state) => ({
      config: { ...state.config, ...config },
    })),

  // Clear all objects but keep default light
  clearScene: () =>
    set({
      objects: {},
      lights: { "default-ambient": DEFAULT_AMBIENT_LIGHT },
    }),

  // Reset everything to initial state
  resetScene: () => set(INITIAL_STATE),
}));
