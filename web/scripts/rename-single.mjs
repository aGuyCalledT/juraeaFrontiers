import { renameSync } from 'node:fs';
renameSync(new URL('../../play/index.html', import.meta.url), new URL('../../play/juraea-frontiers.html', import.meta.url));
