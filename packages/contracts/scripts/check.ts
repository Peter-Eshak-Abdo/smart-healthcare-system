import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildOpenApiDocument } from './openapi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(__dirname, '../openapi/smarthealth.v1.yaml');

if (!fs.existsSync(outFile)) {
  console.error('Missing openapi/smarthealth.v1.yaml. Run `pnpm contracts:openapi`.');
  process.exit(1);
}

const committed = fs.readFileSync(outFile, 'utf8');
const generated = yaml.dump(buildOpenApiDocument(), { noRefs: true, sortKeys: false });

if (committed !== generated) {
  console.error('openapi/smarthealth.v1.yaml is out of date. Run `pnpm contracts:openapi`.');
  process.exit(1);
}

process.stdout.write('OpenAPI contract check passed.\n');
