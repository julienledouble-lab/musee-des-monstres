import { BALANCE } from '../config/balance.js';
import { SPECIES } from '../config/species.js';

// How many monsters of this species the enclosure can hold (at least 1).
export function capacity(enclosure, speciesId) {
  return Math.max(1, Math.floor(enclosure.area / SPECIES[speciesId].minArea));
}

// Enclosed monsters of the enclosure that are happy and fed enough to breed.
export function breedingParents(enclosure, monsters) {
  return enclosure.monsterIds
    .map((id) => monsters.get(id))
    .filter((m) => m && m.state === 'enclosed'
      && m.happiness >= BALANCE.breedMinHappiness && m.hunger < BALANCE.breedMaxHunger);
}

// pendingEggs: eggs already laid by this enclosure and not hatched yet (they need a place too).
export function canBreed(enclosure, monsters, pendingEggs) {
  if (!enclosure.speciesId) return false;
  if (breedingParents(enclosure, monsters).length < 2) return false;
  return enclosure.monsterIds.length + pendingEggs < capacity(enclosure, enclosure.speciesId);
}

export function rollBabyRare(parents, rng) {
  const chance = parents.some((m) => m.rare) ? BALANCE.rareChanceFromRareParent : BALANCE.rareChance;
  return rng() < chance;
}
