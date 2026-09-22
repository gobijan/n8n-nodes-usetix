import { cp } from 'node:fs/promises';
for (const icon of ['usetix.svg', 'usetix.dark.svg'])
  await cp(`nodes/Usetix/${icon}`, `dist/nodes/Usetix/${icon}`);
for (const name of ['Usetix', 'UsetixTrigger']) {
  await cp(`nodes/${name}/${name}.node.json`, `dist/nodes/${name}/${name}.node.json`);
}
