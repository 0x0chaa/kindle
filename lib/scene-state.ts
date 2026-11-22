/**
 * Mutable, non-React state shared between the DOM and the WebGL scene.
 * Kept outside React on purpose: it changes every frame and must never
 * trigger a re-render.
 */
export const sceneState = {
  mouse: { x: 0, y: 0 },
};
