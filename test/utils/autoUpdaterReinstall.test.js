import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import childProcess from 'child_process';
import { syncBuiltinESMExports } from 'module';
import { EventEmitter } from 'events';
import fetch from 'npm-registry-fetch';
import { AutoUpdater } from '../../src/utils/autoUpdater.js';

// The registry and the global install are stubbed: a real `npm install -g` would replace the
// developer's or runner's installed server. Versions are far above anything published.
function fakeInstall(exitCode) {
  return () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    setImmediate(() => proc.emit('close', exitCode));
    return proc;
  };
}

describe('AutoUpdater reinstall guard', function() {
  let spawnStub;
  let registryStub;
  let updater;

  beforeEach(function() {
    spawnStub = sinon.stub(childProcess, 'spawn').callsFake(fakeInstall(0));
    // autoUpdater.js imports spawn by name; push the stub through to the ESM binding.
    syncBuiltinESMExports();
    registryStub = sinon.stub(fetch, 'json');
    updater = new AutoUpdater();
  });

  afterEach(function() {
    sinon.restore();
    syncBuiltinESMExports();
  });

  it('installs a release once, then not again while it is still latest', async function() {
    registryStub.resolves({ 'dist-tags': { latest: '99.0.0' } });

    expect(await updater.checkForUpdates()).to.equal(true);
    expect(await updater.checkForUpdates()).to.equal(false);
    expect(await updater.checkForUpdates()).to.equal(false);

    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args).to.deep.equal(
      ['npm', ['install', '-g', `${updater.packageName}@99.0.0`], { stdio: ['pipe', 'pipe', 'pipe'] }]
    );
  });

  it('still installs a newer release after one was installed', async function() {
    registryStub.resolves({ 'dist-tags': { latest: '99.0.0' } });
    await updater.checkForUpdates();

    registryStub.resolves({ 'dist-tags': { latest: '99.0.1' } });
    expect(await updater.checkForUpdates()).to.equal(true);

    expect(spawnStub.callCount).to.equal(2);
    expect(spawnStub.lastCall.args[1]).to.deep.equal(['install', '-g', `${updater.packageName}@99.0.1`]);
  });

  it('retries on the next check when the install failed', async function() {
    spawnStub.callsFake(fakeInstall(1));
    registryStub.resolves({ 'dist-tags': { latest: '99.0.0' } });

    expect(await updater.checkForUpdates()).to.equal(false);
    expect(updater.pendingUpdateVersion).to.be.undefined;

    spawnStub.callsFake(fakeInstall(0));
    expect(await updater.checkForUpdates()).to.equal(true);
    expect(spawnStub.callCount).to.equal(2);
  });
});
