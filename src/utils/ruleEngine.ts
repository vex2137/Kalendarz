import * as engine from 'rrule';
// rrule exposes ESM to bundlers and CommonJS to Node's test runner.
export const RRule: typeof engine.RRule =
  engine.RRule ?? Reflect.get(engine, 'default').RRule;
