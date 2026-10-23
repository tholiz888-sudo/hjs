import {loadArchive} from './archive.mjs';
const archive=loadArchive();console.log(JSON.stringify(archive.stats,null,2));
for(const route of ['/','/club/garden.html'])if(!archive.pages.get(route)?.available)throw Error('Missing core page: '+route);
console.log(archive.stats.importComplete?'All successfully captured files are imported. Original-site missing resources and legacy backend/plugin features still require separate handling.':'Some captured files still need to be imported.');
