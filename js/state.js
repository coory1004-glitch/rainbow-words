// state.js (owner: core) — shared runtime state. store.P is filled by storage.load().
export const ROUNDS = 8;                 // questions per game
export const store = {
  S: { screen:'home', game:'worm', ses:null, cat:'dress' },  // view/session state, not persisted
  P: null,                                                     // persistent progress, set by storage.load()
};
// true when the device asks for less motion (fx and css respect it)
export const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
