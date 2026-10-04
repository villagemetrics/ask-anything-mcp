import { describe, it } from 'mocha';
import { expect } from 'chai';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Published package', function() {
  this.timeout(30000);

  // A bin target packed without its exec bit installs that way globally, and npx then
  // fails with "Permission denied" (Claude Desktop shows "Server disconnected"). In CI the
  // packed mode comes from the git index, so this guards the tracked file mode.
  it('ships every bin target executable', function() {
    const { bin } = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
    const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }));
    const modes = Object.fromEntries(packed.files.map(f => [f.path, f.mode]));

    for (const target of Object.values(bin)) {
      const path = target.replace(/^\.\//, '');
      expect(modes, `${path} missing from tarball`).to.have.property(path);
      expect(modes[path] & 0o111, `${path} is not executable in the tarball`).to.not.equal(0);
    }
  });
});
