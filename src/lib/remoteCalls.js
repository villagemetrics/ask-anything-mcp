import { AsyncLocalStorage } from 'node:async_hooks';
const contexts = new AsyncLocalStorage();
export const currentRemoteCall = () => contexts.getStore();
// The Engine owns the parent context and signal. Library mode transports it
// separately from model-authored tool arguments and never mutates the session.
export async function withRemoteCall(context, work) {
  if (!context) return work();
  if (typeof context.check !== 'function' || typeof context.run !== 'function') throw new TypeError('Remote call context must provide check and run');
  // Axios receives this signal directly. Leave the underlying rejection visible
  // to the Engine's bounded accounting drain instead of racing it a second time.
  return contexts.run(context, async () => {
    context.check();
    const result = await work();
    try { context.check(); }
    catch (error) { throw Object.assign(error, { providerUsage: (result?.result ?? result)?.providerUsage || [], usageIncomplete: true }); }
    return result;
  });
}
