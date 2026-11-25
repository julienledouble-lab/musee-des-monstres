export function speciesOwned(world) {
  return new Set([...world.monsters.values()].map((m) => m.speciesId)).size;
}

// Shown in this order; checks receive the World.
export const OBJECTIVES = [
  { id: 'visitors25', check: (w) => w.totalVisitors >= 25 },
  { id: 'species3', check: (w) => speciesOwned(w) >= 3 },
  { id: 'money10000', check: (w) => w.wallet.money >= 10000 },
  { id: 'visitors150', check: (w) => w.totalVisitors >= 150 },
  { id: 'allSpecies', check: (w) => speciesOwned(w) >= 5 },
];

// Returns the ids completed by this call and adds them to world.completedObjectives.
export function checkObjectives(world) {
  const done = [];
  for (const o of OBJECTIVES) {
    if (!world.completedObjectives.has(o.id) && o.check(world)) {
      world.completedObjectives.add(o.id);
      done.push(o.id);
    }
  }
  return done;
}
