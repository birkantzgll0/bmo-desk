const test = require('node:test');
const assert = require('node:assert/strict');
const motion = require('../characterMotion.js');

test('both BMO characters share a stable idle and dance rhythm', () => {
  const idle = motion.pose(1, false, false);
  const dancing = motion.pose(1, true, false);
  assert.ok(Number.isFinite(idle.leftArm));
  assert.ok(dancing.bounce > idle.bounce);
  assert.ok(Math.abs(dancing.leftLeg) > Math.abs(idle.leftLeg));
});
