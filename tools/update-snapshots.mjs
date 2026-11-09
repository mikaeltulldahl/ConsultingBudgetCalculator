// Regenerates tests/regression/snapshot.json from the current engine.
import { writeFileSync } from 'node:fs';
import { computeSnapshot, serialize, SNAPSHOT_FILE } from '../tests/regression/snapshot.mjs';

writeFileSync(SNAPSHOT_FILE, serialize(computeSnapshot()));
console.log(`Wrote ${SNAPSHOT_FILE.pathname}`);
