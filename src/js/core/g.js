/* ---- shared mutable state ----
   Variables that several modules reassign live here as properties of G (an imported binding can't be reassigned by
   the module that imports it). Read and write them as G.name. */
export const G = {};
