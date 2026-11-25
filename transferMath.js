const BmoTransferMath = {
  clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
  normalize({x,y,vx,vy,area,width=220,height=300,characterType='BMO'}) {
    return {
      posXPercent:this.clamp((x-area.x)/Math.max(1,area.width-width),0,1),
      posYPercent:this.clamp((y-area.y)/Math.max(1,area.height-height),0,1),
      velocityX:vx/area.width,
      velocityY:vy/area.height,
      characterType
    };
  },
  denormalize(payload,area,width=220,height=300) {
    return {
      x:area.x+this.clamp(payload.posXPercent,0,1)*Math.max(0,area.width-width),
      y:area.y+this.clamp(payload.posYPercent,0,1)*Math.max(0,area.height-height),
      vx:payload.velocityX*area.width,
      vy:payload.velocityY*area.height
    };
  },
  step(state,dt,area,width=220,height=300) {
    const floor=area.y+area.height-height;
    state.vy+=1850*dt;
    state.x+=state.vx*dt;
    state.y+=state.vy*dt;
    state.vx*=Math.exp(-5*dt);
    if(state.x<area.x){state.x=area.x;state.vx=Math.abs(state.vx)*.36;}
    if(state.x>area.x+area.width-width){state.x=area.x+area.width-width;state.vx=-Math.abs(state.vx)*.36;}
    if(state.y>=floor){state.y=floor;state.vy=state.vy>130?-state.vy*.35:0;}
    return state;
  },
  lerp(current,target,dt) { return current+(target-current)*Math.min(1,dt*14); }
};
if(typeof module!=='undefined'&&module.exports)module.exports=BmoTransferMath;
if(typeof window!=='undefined')window.BmoTransferMath=BmoTransferMath;
