const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const math = require('../transferMath.js');
const BmoRoom = require('../multiplayer.js');

test('transfer position and velocity scale to a different desktop', () => {
  const origin={x:0,y:0,width:1920,height:1080};
  const target={x:100,y:50,width:1280,height:720};
  const payload=math.normalize({x:1700,y:500,vx:500,vy:-300,area:origin,characterType:'BMO'});
  const mapped=math.denormalize(payload,target);
  assert.equal(payload.characterType,'BMO');
  assert.ok(mapped.x>=target.x && mapped.x<=target.x+target.width-220);
  assert.ok(mapped.y>=target.y && mapped.y<=target.y+target.height-300);
  assert.equal(mapped.vx,500/1920*1280);
  assert.equal(mapped.vy,-300/1080*720);
  assert.ok(math.lerp(0,100,.016)>0);
});

test('gravity stops at receiver taskbar and bounces', () => {
  const area={x:0,y:0,width:1280,height:720};
  const state={x:500,y:418,vx:0,vy:400};
  math.step(state,.05,area);
  assert.equal(state.y,420);
  assert.ok(state.vy<0);
});

test('room validates chat and transfer data', () => {
  class FakePeer extends EventEmitter {constructor(id){super();this.id=id;this.open=true;} destroy(){} connect(){return new EventEmitter();}}
  const messages=[];
  const room=new BmoRoom({PeerClass:FakePeer,onMessage:message=>messages.push(message)});
  room.start();
  assert.match(room.roomCode,/^BMO-\d{4}$/);
  const connection=new EventEmitter();
  connection.peer='BMO-1234';connection.open=true;connection.send=()=>{};
  room.attach(connection,true);
  connection.emit('data',{type:'CHAT',sender:'BMO',message:'Merhaba'});
  connection.emit('data',{type:'CHAT',sender:'BMO',message:'x'.repeat(141)});
  connection.emit('data',{type:'TRANSFER',posXPercent:.5,posYPercent:.4,velocityX:.1,velocityY:0,characterType:'BMO'});
  assert.equal(messages.length,2);
  assert.equal(messages[0].message,'Merhaba');
  assert.equal(messages[1].characterType,'BMO');
  connection.emit('data',{type:'CHAT',sender:'BMO2',message:'Selam'});
  assert.deepEqual(messages[2],{type:'CHAT',sender:'BMO2',message:'Selam'});
});

test('repeat connect preserves pending and open chat channel and custom name', () => {
  const room=new BmoRoom({PeerClass:class {}});
  let attempts=0;
  const channel=new EventEmitter();
  channel.peer='BMO-0042';
  const sent=[];
  channel.send=message=>sent.push(message);
  room.peer={open:true,connect:()=>{attempts++;return channel;}};
  room.connect(channel.peer);
  room.connect(channel.peer);
  channel.open=true;
  channel.emit('open');
  room.connect(channel.peer);
  assert.equal(attempts,1);
  assert.equal(room.connection,channel);
  const chat={type:'CHAT',sender:'BMO2',name:'Papatya',message:'selam'};
  assert.equal(room.send(chat),true);
  assert.deepEqual(sent,[chat]);
  let received;
  room.onMessage=data=>received=data;
  channel.emit('data',chat);
  assert.deepEqual(received,chat);
});
