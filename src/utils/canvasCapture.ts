/**
 * Holds a reference to the live Three.js canvas so other parts of the app
 * (e.g. the install guide) can grab a snapshot of the current wall render
 * without having to lift the whole 3D scene through React state.
 */
export const canvasCaptureRef: { current: HTMLCanvasElement | null } = { current: null };
