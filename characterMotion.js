const BmoCharacterMotion = {
  pose(time, dancing, playing) {
    const lively = dancing || playing;
    const step = Math.sin(time * (dancing ? 7.5 : 4)) * (dancing ? .35 : .04);
    return {
      sway: Math.sin(time * (lively ? 5 : 1.8)) * .014,
      bounce: Math.sin(time * 2.1) * .015 + (lively ? Math.abs(Math.sin(time * 7.5)) * .055 : 0),
      leftArm: dancing ? -2.45 + Math.sin(time * 8) * .22 : -.08 - Math.abs(Math.sin(time * (playing ? 7.5 : 2))) * .16,
      rightArm: dancing ? 2.45 + Math.cos(time * 8) * .22 : .08 + Math.abs(Math.cos(time * (playing ? 7.5 : 2))) * .16,
      leftLeg: step,
      rightLeg: -step
    };
  },
  ease(current, target, dt) { return current + (target - current) * Math.min(1, dt * 12); }
};

if (typeof module !== 'undefined' && module.exports) module.exports = BmoCharacterMotion;
if (typeof window !== 'undefined') window.BmoCharacterMotion = BmoCharacterMotion;
