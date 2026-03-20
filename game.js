"use strict";
// ================================================================
//  Athera Chronicle — game.js v3.0
//  Feliss Engine Web Demo (Vanilla JS + Three.js r128)
//
//  NEW v3: Difficulty system, Gun weapon, PRESS ANY BUTTON menu,
//          Save/Continue, ESC pause, Mobile touch controls,
//          Landscape support, Melee range + MP regen on hit
// ================================================================

// ── World constants ──
var SCALE=40, GW=800, GH=560, COLS=20, ROWS=14;
var WALL=0,FLOOR=1,ROAD=2,DUNGEON=3;

// ── Combat constants ──
var MELEE_RANGE = 130;    // ~3.25 tiles (was 72)
var MELEE_MP_REGEN = 8;   // MP per melee hit
var GUN_RANGE = 240;      // 6 tiles
var GUN_DMG_MULT = 2.0;
var GUN_BULLETS = 3;
var GUN_RELOAD = 2.0;     // seconds
var GUN_ATKCD = 0.9;      // slow fire
var MAGIC_COST = 15;

// ── Map ──
var MAP=[
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,0,2,2,2,2,2,2,2,2,2,0,1,1,1,1,0],
  [0,1,1,1,0,2,2,2,2,2,2,2,2,2,0,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,0,2,2,1,1,1,1,1,2,2,0,1,1,1,1,0],
  [0,0,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,0,0,0],
  [0,1,1,1,1,1,1,3,3,3,3,3,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,3,3,3,3,3,1,1,1,1,1,1,1,0],
  [0,0,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,0,0,0],
  [0,1,1,1,0,2,2,1,1,1,1,1,2,2,0,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,0,2,2,2,2,2,2,2,2,2,0,1,1,1,1,0],
  [0,1,1,1,0,2,2,2,2,2,2,2,2,2,0,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// ── Enemy defs ──
var EDEF={
  grunt:   {hp:45, atk:12,spd:82, sight:220,ar:40,acd:1.2, xp:20,sc:100},
  shade:   {hp:28, atk:19,spd:145,sight:300,ar:32,acd:0.85,xp:35,sc:180},
  enforcer:{hp:130,atk:29,spd:55, sight:170,ar:48,acd:2.0, xp:65,sc:350},
  specter: {hp:20, atk:22,spd:178,sight:330,ar:28,acd:0.7, xp:50,sc:260},
  boss:    {hp:420,atk:48,spd:64, sight:240,ar:58,acd:1.35,xp:220,sc:1800,scale:1.28,boss:true},
};

// ── Difficulty ──
var DIFF={
  easy:     {name:"EASY",     waves:5,  mult:0.7, col:"#2ecc71",bg:"rgba(46,204,113,.18)"},
  normal:   {name:"NORMAL",   waves:8,  mult:1.0, col:"#3498db",bg:"rgba(52,152,219,.18)"},
  hard:     {name:"HARD",     waves:12, mult:1.4, col:"#e67e22",bg:"rgba(230,126,34,.18)"},
  nightmare:{name:"NIGHTMARE",waves:20, mult:2.0, col:"#e74c3c",bg:"rgba(231,76,60,.18)"},
};

// ── Base wave templates ──
var BASE_WAVES=[
  [{t:"grunt",n:4}],
  [{t:"grunt",n:5},{t:"shade",n:2}],
  [{t:"grunt",n:4},{t:"shade",n:3},{t:"enforcer",n:1}],
  [{t:"grunt",n:6},{t:"shade",n:2},{t:"enforcer",n:2},{t:"specter",n:1}],
  [{t:"grunt",n:5},{t:"shade",n:4},{t:"enforcer",n:2},{t:"specter",n:3}],
];

var SPAWNS=[
  {x:90,y:90},{x:710,y:90},{x:90,y:470},{x:710,y:470},
  {x:400,y:58},{x:400,y:500},{x:60,y:280},{x:740,y:280},
];

// ── Utils ──
function d2(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function d2xy(ax,ay,bx,by){var dx=ax-bx,dy=ay-by;return Math.hypot(dx,dy);}
function d2sqxy(ax,ay,bx,by){var dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rnd(a,b){return a+Math.random()*(b-a);}
function ri(a,b){return Math.floor(rnd(a,b+1));}
function lerp(a,b,t){return a+(b-a)*t;}
var _uid=0; function uid(){return ++_uid;}

function isWall(px,py){
  var c=Math.floor(px/SCALE),r=Math.floor(py/SCALE);
  if(c<0||c>=COLS||r<0||r>=ROWS) return true;
  return MAP[r][c]===WALL;
}

function moveCC(obj,dx,dy,rad){
  rad=rad||12;
  var nx=obj.x+dx;
  if(!isWall(nx+(dx>0?rad:-rad),obj.y)&&
     !isWall(nx+(dx>0?rad:-rad),obj.y-rad*.7)&&
     !isWall(nx+(dx>0?rad:-rad),obj.y+rad*.7))
    obj.x=clamp(nx,rad,GW-rad);
  var ny=obj.y+dy;
  if(!isWall(obj.x,ny+(dy>0?rad:-rad))&&
     !isWall(obj.x-rad*.7,ny+(dy>0?rad:-rad))&&
     !isWall(obj.x+rad*.7,ny+(dy>0?rad:-rad)))
    obj.y=clamp(ny,rad,GH-rad);
}

// ── Wave generation ──
function buildWaves(diffKey){
  var cfg=DIFF[diffKey];
  var total=cfg.waves;
  var mult=cfg.mult;
  var result=[];
  for(var i=0;i<total;i++){
    var wn=i+1;
    if(wn<=BASE_WAVES.length){
      var base=BASE_WAVES[wn-1];
      result.push(base.map(function(g){return{t:g.t,n:Math.max(1,Math.round(g.n*mult))};}));
    } else {
      var m=mult, ws=[];
      var ng=Math.floor(wn*1.5*m); if(ng>0)ws.push({t:"grunt",n:ng});
      var ns=Math.floor(wn*0.6*m); if(ns>0)ws.push({t:"shade",n:ns});
      var ne=Math.floor(wn*0.45*m);if(ne>0)ws.push({t:"enforcer",n:ne});
      var nsp=Math.floor(wn*0.3*m);if(nsp>0)ws.push({t:"specter",n:nsp});
      result.push(ws.length?ws:[{t:"grunt",n:Math.max(3,Math.floor(wn*m))}]);
    }
  }
  return result;
}

// ================================================================
//  Three.js helpers (r128 safe)
// ================================================================
function mStd(col,rough,metal){
  return new THREE.MeshStandardMaterial({color:col,roughness:rough||0.5,metalness:metal||0});
}
function mEm(col,em,ei,rough,metal,transp,op){
  return new THREE.MeshStandardMaterial({
    color:col,emissive:new THREE.Color(em||0),emissiveIntensity:ei||1,
    roughness:rough||0.3,metalness:metal||0,transparent:transp||false,opacity:op||1,
  });
}
function addM(parent,geo,mat,x,y,z,name){
  var m=new THREE.Mesh(geo,mat);
  m.position.set(x||0,y||0,z||0);
  if(name) m.name=name;
  parent.add(m); return m;
}
function addL(parent,col,intensity,range,x,y,z,name){
  var l=new THREE.PointLight(col,intensity,range);
  l.position.set(x||0,y||0,z||0);
  if(name) l.name=name;
  parent.add(l); return l;
}
function addDisc(parent,r,op){
  var m=new THREE.Mesh(
    new THREE.CylinderGeometry(r||0.35,r||0.35,0.01,12),
    new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:op||0.3})
  );
  m.position.set(0,-0.49,0); parent.add(m); return m;
}

// ================================================================
//  3D Model Builders
// ================================================================
function buildPlayer(){
  var g=new THREE.Group(); g.name="player";
  addDisc(g,0.42,0.32);
  var bm=mStd(0x0d1520,0.9,0.1);
  addM(g,new THREE.BoxGeometry(0.18,0.15,0.28),bm,-0.15,-0.52,0.06,"bootL");
  addM(g,new THREE.BoxGeometry(0.18,0.15,0.28),bm, 0.15,-0.52,0.06,"bootR");
  var lm=mStd(0x1a2a4a,0.6,0.5);
  var lgeo=new THREE.CylinderGeometry(0.11,0.14,0.56,8);
  addM(g,lgeo,lm,-0.15,-0.25,0,"legL");
  addM(g,lgeo,lm, 0.15,-0.25,0,"legR");
  addM(g,new THREE.BoxGeometry(0.58,0.1,0.35),mStd(0x7a5a10,0.7,0.4),0,-0.1,0);
  addM(g,new THREE.BoxGeometry(0.56,0.6,0.33),mStd(0x1e3a6e,0.4,0.65),0,0.13,0,"torso");
  addM(g,new THREE.BoxGeometry(0.2,0.2,0.06),mEm(0x00d4ff,0x00d4ff,1.4),0,0.18,0.18,"rune");
  var sm=mEm(0x2255aa,0x0044ff,0.5,0.3,0.8);
  addM(g,new THREE.SphereGeometry(0.19,8,8),sm,-0.35,0.28,0);
  addM(g,new THREE.SphereGeometry(0.19,8,8),sm, 0.35,0.28,0);
  var am=mStd(0x1e3a6e,0.5,0.55);
  var ageo=new THREE.CylinderGeometry(0.09,0.12,0.45,7);
  addM(g,ageo,am,-0.35,0.06,0,"armL");
  addM(g,ageo,am, 0.35,0.06,0,"armR");
  addM(g,new THREE.SphereGeometry(0.23,10,10),mStd(0x2255aa,0.35,0.7),0,0.57,0,"head");
  addM(g,new THREE.BoxGeometry(0.3,0.09,0.12),mEm(0x00d4ff,0x00d4ff,1.8),0,0.58,0.2,"visor");
  addM(g,new THREE.BoxGeometry(0.06,0.2,0.22),mStd(0xb8b8c0,0.3,0.9),0,0.77,0);
  addM(g,new THREE.BoxGeometry(0.5,0.52,0.06),new THREE.MeshStandardMaterial({color:0x0a1a3a,roughness:0.95,side:THREE.DoubleSide}),0,0.08,-0.2);
  // Sword
  var sw=new THREE.Group(); sw.name="sword";
  addM(sw,new THREE.BoxGeometry(0.06,0.75,0.04),mEm(0xc0e8ff,0x00d4ff,1.1));
  addM(sw,new THREE.BoxGeometry(0.3,0.07,0.08),mStd(0xb8860b,0.4,0.8),0,0.3,0);
  addM(sw,new THREE.CylinderGeometry(0.04,0.04,0.22,6),mStd(0x3a2010,0.9,0.1),0,0.14,0);
  sw.position.set(0.56,0.08,0.1); sw.rotation.z=-0.22; g.add(sw);
  // Gun (hidden by default)
  var gn=new THREE.Group(); gn.name="gun";
  addM(gn,new THREE.BoxGeometry(0.12,0.28,0.52),mStd(0x1a1a1a,0.6,0.8));
  addM(gn,new THREE.BoxGeometry(0.1,0.08,0.62),mStd(0x2a2a2a,0.5,0.9),0,0.1,0.05);
  addM(gn,new THREE.BoxGeometry(0.05,0.05,0.06),mEm(0xff8800,0xff6600,2.0),0,0.1,0.34,"muzzle");
  gn.position.set(0.5,0.06,0.16); gn.visible=false; g.add(gn);
  addL(g,0x4488ff,1.4,5.5,0,1.2,0,"plight");
  return g;
}

function buildGrunt(){
  var g=new THREE.Group(); g.name="grunt";
  addDisc(g,0.3,0.28);
  var bm=mStd(0xd4c8a0,0.8,0.05);
  var rm=mStd(0x6b3a1a,0.9,0.2);
  var em=mEm(0xff2200,0xff2200,2.0,0.1,0);
  addM(g,new THREE.BoxGeometry(0.36,0.14,0.22),bm,0,-0.28,0);
  addM(g,new THREE.CylinderGeometry(0.05,0.06,0.82,6),bm,0,0.1,0);
  addM(g,new THREE.BoxGeometry(0.44,0.38,0.28),bm,0,0.2,0);
  [0.08,0.18,0.28].forEach(function(oy){addM(g,new THREE.BoxGeometry(0.42,0.04,0.26),bm,0,oy,0);});
  var lge=new THREE.CylinderGeometry(0.07,0.09,0.52,6);
  addM(g,lge,bm,-0.12,-0.5,0); addM(g,lge,bm,0.12,-0.5,0);
  var uge=new THREE.CylinderGeometry(0.055,0.07,0.4,6);
  var al=addM(g,uge,bm,-0.3,0.22,0,"armL"); al.rotation.z=0.4;
  var ar=addM(g,uge,bm, 0.3,0.22,0,"armR"); ar.rotation.z=-0.4;
  var sk=addM(g,new THREE.SphereGeometry(0.2,8,8),bm,0,0.64,0,"skull"); sk.scale.set(1,1.12,0.95);
  addM(g,new THREE.BoxGeometry(0.16,0.1,0.18),bm,0,0.47,0.08);
  addM(g,new THREE.SphereGeometry(0.042,7,7),em,-0.08,0.65,0.17);
  addM(g,new THREE.SphereGeometry(0.042,7,7),em, 0.08,0.65,0.17);
  addM(g,new THREE.BoxGeometry(0.15,0.2,0.08),rm,-0.26,0.22,0);
  addM(g,new THREE.BoxGeometry(0.15,0.2,0.08),rm, 0.26,0.22,0);
  var rsw=addM(g,new THREE.BoxGeometry(0.08,0.62,0.06),rm,0.62,-0.06,0.06); rsw.rotation.z=-0.18;
  addL(g,0xff4400,0.7,3.5,0,0.9,0);
  return g;
}

function buildShade(){
  var g=new THREE.Group(); g.name="shade";
  addDisc(g,0.28,0.38);
  var cm=mEm(0x4a0e6b,0x8e44ad,0.9,0.15,0.1);
  var om=new THREE.MeshStandardMaterial({color:0x8e44ad,transparent:true,opacity:0.32,roughness:0.1,side:THREE.DoubleSide});
  var em=mEm(0xff00ff,0xff00ff,2.2,0.1,0);
  var sm=mEm(0x6b1a8e,0x4a0e6b,0.6,0.5,0.1);
  addM(g,new THREE.SphereGeometry(0.28,12,12),cm,0,0,0,"core");
  addM(g,new THREE.SphereGeometry(0.46,10,10),om,0,0,0,"outer");
  addM(g,new THREE.SphereGeometry(0.056,8,8),em,-0.12,0.07,0.24);
  addM(g,new THREE.SphereGeometry(0.056,8,8),em, 0.12,0.07,0.24);
  var sge=new THREE.ConeGeometry(0.09,0.44,6);
  var sd=[[0.46,0,0,0,0,-Math.PI/2],[-0.46,0,0,0,0,Math.PI/2],[0,0,0.46,Math.PI/2,0,0],[0,0,-0.46,-Math.PI/2,0,0],[0,0.46,0,0,0,0],[0,-0.46,0,Math.PI,0,0]];
  sd.forEach(function(d,i){var sp=addM(g,sge,sm,d[0],d[1],d[2]); sp.rotation.set(d[3],d[4],d[5]);});
  for(var i=0;i<4;i++){var a=(i/4)*Math.PI*2;var td=addM(g,new THREE.ConeGeometry(0.045,0.52,5),sm,Math.cos(a)*0.18,-0.38,Math.sin(a)*0.18);td.rotation.z=Math.PI;}
  addL(g,0xaa00ff,1.1,4.5);
  return g;
}

function buildEnforcer(){
  var g=new THREE.Group(); g.name="enforcer";
  addDisc(g,0.58,0.38);
  var am=mEm(0x4a1a00,0x2a0800,0.35,0.55,0.55);
  var dm=mStd(0x1a0800,0.9,0.1);
  var sk=mStd(0x8b0000,0.25,0.85);
  var em=mEm(0xff6600,0xff6600,1.6);
  var lge=new THREE.CylinderGeometry(0.2,0.25,0.56,8);
  addM(g,lge,am,-0.23,-0.32,0); addM(g,lge,am,0.23,-0.32,0);
  addM(g,new THREE.BoxGeometry(0.32,0.18,0.4),dm,-0.23,-0.58,0.06);
  addM(g,new THREE.BoxGeometry(0.32,0.18,0.4),dm, 0.23,-0.58,0.06);
  addM(g,new THREE.BoxGeometry(0.9,0.78,0.6),am,0,0.14,0,"body");
  addM(g,new THREE.BoxGeometry(0.72,0.3,0.14),dm,0,-0.06,0.32);
  var pge=new THREE.BoxGeometry(0.34,0.34,0.4);
  addM(g,pge,am,-0.6,0.38,0); addM(g,pge,am,0.6,0.38,0);
  addM(g,new THREE.ConeGeometry(0.09,0.36,6),sk,-0.6,0.6,0);
  addM(g,new THREE.ConeGeometry(0.09,0.36,6),sk, 0.6,0.6,0);
  var cs1=addM(g,new THREE.ConeGeometry(0.07,0.26,6),sk,-0.22,0.28,0.32); cs1.rotation.x=-Math.PI/2;
  var cs2=addM(g,new THREE.ConeGeometry(0.07,0.26,6),sk, 0.22,0.28,0.32); cs2.rotation.x=-Math.PI/2;
  var age=new THREE.CylinderGeometry(0.17,0.21,0.5,8);
  addM(g,age,am,-0.62,0.1,0,"armL"); addM(g,age,am,0.62,0.1,0,"armR");
  addM(g,new THREE.BoxGeometry(0.34,0.3,0.32),sk,-0.62,-0.14,0.06);
  addM(g,new THREE.BoxGeometry(0.34,0.3,0.32),sk, 0.62,-0.14,0.06);
  addM(g,new THREE.BoxGeometry(0.52,0.46,0.48),am,0,0.67,0,"head");
  addM(g,new THREE.BoxGeometry(0.14,0.07,0.07),em,-0.13,0.71,0.26);
  addM(g,new THREE.BoxGeometry(0.14,0.07,0.07),em, 0.13,0.71,0.26);
  var hl=addM(g,new THREE.ConeGeometry(0.07,0.42,6),sk,-0.18,0.98,0); hl.rotation.z=0.32;
  var hr=addM(g,new THREE.ConeGeometry(0.07,0.42,6),sk, 0.18,0.98,0); hr.rotation.z=-0.32;
  addL(g,0xff6600,1.2,5.5,0,0.5,0);
  return g;
}

function buildBoss(){
  var g=buildEnforcer();
  g.name="boss";
  g.scale.setScalar(EDEF.boss.scale||1.28);
  var body=g.getObjectByName("body");
  var head=g.getObjectByName("head");
  if(body&&body.material){
    body.material=body.material.clone();
    body.material.color.setHex(0x5e1208);
    body.material.emissive=new THREE.Color(0x220500);
    body.material.emissiveIntensity=0.6;
  }
  if(head&&head.material){
    head.material=head.material.clone();
    head.material.color.setHex(0x7a120a);
    head.material.emissive=new THREE.Color(0x280700);
    head.material.emissiveIntensity=0.8;
  }
  addL(g,0xff2200,1.8,7.2,0,0.75,0,"bossAura");
  return g;
}

function buildSpecter(){
  var g=new THREE.Group(); g.name="specter";
  addDisc(g,0.22,0.25);
  var gm=new THREE.MeshStandardMaterial({color:0x0d5a4a,emissive:new THREE.Color(0x16a085),emissiveIntensity:1.0,transparent:true,opacity:0.88,roughness:0.1});
  var cm=new THREE.MeshStandardMaterial({color:0x1be0bb,emissive:new THREE.Color(0x1be0bb),emissiveIntensity:1.6,transparent:true,opacity:0.92,roughness:0.05});
  var ey=new THREE.MeshStandardMaterial({color:0xffffff,emissive:new THREE.Color(0xccffee),emissiveIntensity:2.2});
  var wm=new THREE.MeshStandardMaterial({color:0x16a085,transparent:true,opacity:0.32,emissive:new THREE.Color(0x16a085),emissiveIntensity:0.6});
  var body=addM(g,new THREE.SphereGeometry(0.28,10,10),gm,0,0,0,"body"); body.scale.set(0.85,1.38,0.85);
  var inner=addM(g,new THREE.SphereGeometry(0.18,8,8),cm,0,0,0,"inner"); inner.scale.set(0.8,1.25,0.8);
  addM(g,new THREE.SphereGeometry(0.06,7,7),ey,-0.1,0.12,0.22);
  addM(g,new THREE.SphereGeometry(0.06,7,7),ey, 0.1,0.12,0.22);
  addM(g,new THREE.CylinderGeometry(0.04,0.22,0.58,8),gm,0,-0.54,0,"tail");
  for(var i=0;i<3;i++){var a=(i/3)*Math.PI*2;var w=addM(g,new THREE.ConeGeometry(0.06,0.42,5),wm,Math.cos(a)*0.15,-0.65,Math.sin(a)*0.15);w.rotation.z=Math.PI;}
  for(var j=0;j<3;j++) addM(g,new THREE.SphereGeometry(0.072,7,7),cm,0,0,0,"orb"+j);
  addL(g,0x00ffbb,1.1,5,0,0,0,"plight");
  return g;
}

function buildMagicProj(){
  var g=new THREE.Group();
  addM(g,new THREE.SphereGeometry(0.13,8,8),mEm(0xb388ff,0x7c4dff,2.2,0.1,0,true,0.95));
  addM(g,new THREE.SphereGeometry(0.24,8,8),new THREE.MeshStandardMaterial({color:0xd4b0ff,transparent:true,opacity:0.38,emissive:new THREE.Color(0xb388ff),emissiveIntensity:1.2}));
  addL(g,0x7c4dff,0.9,2.8);
  return g;
}

function buildGunProj(){
  var g=new THREE.Group();
  addM(g,new THREE.SphereGeometry(0.08,6,6),mEm(0xffdd44,0xff8800,3.0,0.1,0,true,0.95));
  addM(g,new THREE.SphereGeometry(0.16,6,6),new THREE.MeshStandardMaterial({color:0xffaa00,transparent:true,opacity:0.3,emissive:new THREE.Color(0xff8800),emissiveIntensity:1.5}));
  addL(g,0xff8800,1.2,2.0);
  return g;
}

// ================================================================
//  MAP BUILD
// ================================================================
function buildMap(scene){
  var wm=mStd(0x1a1a2e,0.85,0.05),wtm=mStd(0x242456,0.7,0.1);
  var fm=mStd(0x0d0d1e,0.92,0),rm=mStd(0x0b1425,0.88,0);
  var dm=mEm(0x08080f,0x0a0020,0.55,0.96,0);
  var lm=mEm(0x1c3c60,0x0a1a2e,0.5,0.5,0);
  var rum=mEm(0x0e0e1e,0x1a0038,0.9,0.98,0);
  var gm=new THREE.MeshBasicMaterial({color:0x0f1020,transparent:true,opacity:0.6});
  for(var r=0;r<ROWS;r++) for(var c=0;c<COLS;c++){
    var tile=MAP[r][c],wx=c+0.5,wz=r+0.5;
    if(tile===WALL){
      var w=new THREE.Mesh(new THREE.BoxGeometry(1,1.62,1),wm);w.position.set(wx,0.52,wz);scene.add(w);
      var wt=new THREE.Mesh(new THREE.BoxGeometry(1,0.09,1),wtm);wt.position.set(wx,1.35,wz);scene.add(wt);
    } else {
      var mat=tile===ROAD?rm:tile===DUNGEON?dm:fm;
      var fl=new THREE.Mesh(new THREE.BoxGeometry(1,0.1,1),mat);fl.position.set(wx,-0.05,wz);scene.add(fl);
      if(tile===ROAD&&c%4<2){var ln=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.02,0.72),lm);ln.position.set(wx,0.06,wz);scene.add(ln);}
      if(tile===DUNGEON&&(r+c)%2===0){var rn=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.02,0.72),rum);rn.position.set(wx,0.06,wz);scene.add(rn);}
      var gx=new THREE.Mesh(new THREE.BoxGeometry(0.98,0.015,0.015),gm);gx.position.set(wx,0.07,wz);scene.add(gx);
      var gz=new THREE.Mesh(new THREE.BoxGeometry(0.015,0.015,0.98),gm);gz.position.set(wx,0.07,wz);scene.add(gz);
    }
  }
  [[7.5,6.5],[9.5,6.5],[11.5,6.5],[8.5,7.5],[10.5,7.5]].forEach(function(xz){
    var dl=new THREE.PointLight(0x4400aa,0.65,3.8);dl.position.set(xz[0],0.5,xz[1]);scene.add(dl);
  });
}

// ================================================================
//  SCENE INIT
// ================================================================
var renderer,camera,scene,playerMesh;
var eMeshMap={},pMeshMap={};
var camX=COLS/2,camZ=ROWS/2+12.5;
var groundPlane,raycaster,mouseNDC,worldPt;
var bootFailed=false;

function initScene(){
  var canvas=document.getElementById("gameCanvas");
  var W=window.innerWidth,H=window.innerHeight;
  renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
  renderer.setSize(W,H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x01010a);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  camera=new THREE.PerspectiveCamera(50,W/H,0.1,200);
  camera.position.set(COLS/2,19,ROWS/2+12.5);
  camera.lookAt(COLS/2,0,ROWS/2);
  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x02020f,0.045);
  scene.add(new THREE.AmbientLight(0x1a1a3a,1.0));
  var sun=new THREE.DirectionalLight(0x3355aa,1.6);
  sun.position.set(8,22,6);sun.castShadow=true;
  sun.shadow.mapSize.width=1024;sun.shadow.mapSize.height=1024;
  sun.shadow.camera.near=0.5;sun.shadow.camera.far=70;
  sun.shadow.camera.left=-16;sun.shadow.camera.right=16;
  sun.shadow.camera.top=16;sun.shadow.camera.bottom=-16;
  scene.add(sun);
  var fill=new THREE.DirectionalLight(0x0a0a22,0.45);fill.position.set(-5,8,-8);scene.add(fill);
  buildMap(scene);
  playerMesh=buildPlayer();playerMesh.position.set(GW/2/SCALE,0,GH/2/SCALE);scene.add(playerMesh);
  groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  raycaster=new THREE.Raycaster();
  mouseNDC=new THREE.Vector2();
  worldPt=new THREE.Vector3();
  window.addEventListener("resize",function(){
    var W2=window.innerWidth,H2=window.innerHeight;
    renderer.setSize(W2,H2);camera.aspect=W2/H2;camera.updateProjectionMatrix();
  });
}

// ================================================================
//  SAVE / LOAD (localStorage)
// ================================================================
var LS_SAVE="atheraSave3";
var LS_UNLOCKED="atheraUnlocked3";
var LS_DIFF="atheraDiff3";

function saveGame(){
  if(!G||G.phase==="intro") return;
  var data={
    difficulty:currentDiff,
    wave:G.wave,
    score:G.score,
    player:{level:G.player.level,xp:G.player.xp,xpNext:G.player.xpNext,atk:G.player.atk,def:G.player.def,maxHp:G.player.maxHp,maxMana:G.player.maxMana,hp:G.player.hp,mana:G.player.mana},
    weapon:currentWeapon,
    bullets:gunBullets,
    ts:Date.now()
  };
  try{localStorage.setItem(LS_SAVE,JSON.stringify(data));}catch(e){}
  showNotif("PROGRESS SAVED");
}

function loadSave(){
  try{var r=localStorage.getItem(LS_SAVE);return r?JSON.parse(r):null;}catch(e){return null;}
}

function isNightmareUnlocked(){
  try{return localStorage.getItem(LS_UNLOCKED)==="1";}catch(e){return false;}
}

function unlockNightmare(){
  try{localStorage.setItem(LS_UNLOCKED,"1");}catch(e){}
}

function saveDiff(d){
  try{localStorage.setItem(LS_DIFF,d);}catch(e){}
}

function loadDiff(){
  try{return localStorage.getItem(LS_DIFF)||"normal";}catch(e){return "normal";}
}

function showNotif(txt){
  var n=document.createElement("div");
  n.textContent=txt;
  n.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,180,255,.12);border:1px solid rgba(0,180,255,.3);color:#00d4ff;font-size:11px;letter-spacing:.2em;padding:10px 24px;border-radius:4px;z-index:99;pointer-events:none;font-family:monospace";
  document.body.appendChild(n);
  setTimeout(function(){if(n.parentNode)n.parentNode.removeChild(n);},1800);
}

// ================================================================
//  GAME STATE
// ================================================================
var G=null;
var currentDiff="normal";
var currentWeapon="sword"; // "sword" or "gun"
var gunBullets=GUN_BULLETS;
var gunReloading=false;
var gunReloadTimer=0;
var isPaused=false;
var isMobile=false;
var currentWaves=[];

function getSpecialBossChance(diffKey,wave){
  if(diffKey==="hard"&&wave>=10&&wave<=12) return 0.5;
  if(diffKey==="nightmare"&&wave>=10&&wave<=20){
    if(wave===10||wave===15||wave===18||wave===20) return 0.7;
    return 0.6;
  }
  return 0;
}

function mkGame(fromSave){
  _uid=0;
  currentWaves=buildWaves(currentDiff);
  G={
    phase:"playing",wave:0,score:0,
    betweenWave:true,waveTimer:3.0,
    spawnQ:[],spawnCD:0,
    aliveEnemies:0,deadEnemies:0,cleanupTimer:0.8,hudTimer:0,
    player:{x:GW/2,y:GH/2,hp:100,maxHp:100,mana:60,maxMana:60,manaT:0,level:1,xp:0,xpNext:100,atk:25,def:5,spd:195,atkCD:0,rollCD:0,iframes:0,flash:0,angle:0,walkT:0,atkAnim:0,rolling:false,rollDur:0,rvx:0,rvy:0},
    enemies:[],projs:[],shake:0,time:0,
  };
  if(fromSave){
    var p=fromSave;
    currentDiff=p.difficulty||"normal";
    currentWaves=buildWaves(currentDiff);
    currentWeapon=p.weapon||"sword";
    gunBullets=p.bullets!=null?p.bullets:GUN_BULLETS;
    G.wave=Math.max(0,p.wave-1);
    G.score=p.score||0;
    var ps=p.player;
    if(ps){
      G.player.level=ps.level||1;
      G.player.xp=ps.xp||0;
      G.player.xpNext=ps.xpNext||100;
      G.player.atk=ps.atk||25;
      G.player.def=ps.def||5;
      G.player.maxHp=ps.maxHp||100;
      G.player.hp=ps.hp||ps.maxHp||100;
      G.player.maxMana=ps.maxMana||60;
      G.player.mana=ps.mana||ps.maxMana||60;
    }
  }
}

// ================================================================
//  WAVE SYSTEM
// ================================================================
function startWave(){
  G.wave++;G.betweenWave=false;
  if(G.wave>currentWaves.length){endGame(true);return;}
  var def=currentWaves[G.wave-1];
  var q=[];def.forEach(function(d){for(var i=0;i<d.n;i++)q.push(d.t);});
  var bossChance=getSpecialBossChance(currentDiff,G.wave);
  if(bossChance>0&&Math.random()<bossChance){
    q.push("boss");
    showNotif("SPECIAL BOSS INCOMING");
  }
  for(var i=q.length-1;i>0;i--){var j=ri(0,i);var tmp=q[i];q[i]=q[j];q[j]=tmp;}
  G.spawnQ=q;G.spawnCD=0.45;
}

function spawnEnemy(type){
  var d=EDEF[type];
  var sp=SPAWNS.reduce(function(b,s){return d2(s,G.player)>d2(b,G.player)?s:b;},SPAWNS[0]);
  G.enemies.push({hp:d.hp,maxHp:d.hp,atk:d.atk,spd:d.spd,sight:d.sight,ar:d.ar,acd:d.acd,xp:d.xp,sc:d.sc,id:uid(),type:type,x:sp.x+rnd(-28,28),y:sp.y+rnd(-28,28),atkCD:0,hurtT:0,state:"patrol",ptx:sp.x+rnd(-60,60),pty:sp.y+rnd(-60,60),ptimer:rnd(2,5),alive:true,wt:0,scale:d.scale||1,boss:!!d.boss});
  G.aliveEnemies++;
}

// ================================================================
//  COMBAT
// ================================================================
function hitEnemy(e,dmg){
  e.hp-=dmg;e.hurtT=0.2;e.state="chase";G.shake=Math.max(G.shake,3);
  if(e.hp<=0){
    e.alive=false;G.aliveEnemies=Math.max(0,G.aliveEnemies-1);G.deadEnemies++;G.score+=e.sc;G.player.xp+=e.xp;G.shake=Math.max(G.shake,6);
    var m=eMeshMap[e.id];if(m){scene.remove(m);delete eMeshMap[e.id];}
    var p=G.player;
    while(p.xp>=p.xpNext){p.xp-=p.xpNext;p.level++;p.xpNext=Math.floor(p.xpNext*1.42);p.maxHp+=20;p.hp=p.maxHp;p.maxMana+=10;p.mana=p.maxMana;p.atk+=5;p.def+=2;}
  }
}

function doMelee(){
  var p=G.player;p.atkCD=0.52;p.atkAnim=0.38;
  var hit=false;
  var meleeRangeSq=MELEE_RANGE*MELEE_RANGE;
  G.enemies.forEach(function(e){
    if(e.alive&&d2sqxy(p.x,p.y,e.x,e.y)<=meleeRangeSq){
      hitEnemy(e,p.atk+ri(0,8));
      hit=true;
    }
  });
  if(hit){p.mana=Math.min(p.maxMana,p.mana+MELEE_MP_REGEN);}
}

function doGun(){
  var p=G.player;
  if(gunBullets<=0||gunReloading) return;
  p.atkCD=GUN_ATKCD;
  gunBullets--;
  var dmg=Math.floor(p.atk*GUN_DMG_MULT);
  var spd=600;
  G.projs.push({id:uid(),x:p.x,y:p.y,vx:Math.cos(p.angle)*spd,vy:Math.sin(p.angle)*spd,dmg:dmg,life:GUN_RANGE/spd,hit:{},projType:"gun"});
  if(gunBullets<=0){gunReloading=true;gunReloadTimer=GUN_RELOAD;}
  updateWeaponHUD();
}

function doMagic(){
  var p=G.player;p.atkCD=0.44;p.mana-=MAGIC_COST;
  G.projs.push({id:uid(),x:p.x,y:p.y,vx:Math.cos(p.angle)*420,vy:Math.sin(p.angle)*420,dmg:Math.floor(p.atk*1.65),life:1.5,hit:{},projType:"magic"});
}

// ================================================================
//  UPDATE LOOP
// ================================================================
var keys={},mouse3d={x:COLS/2,z:ROWS/2};

function updateGame(dt){
  if(isPaused) return;
  G.time+=dt;G.shake=Math.max(0,G.shake-dt*18);

  // Gun reload
  if(gunReloading){
    gunReloadTimer-=dt;
    if(gunReloadTimer<=0){gunReloading=false;gunBullets=GUN_BULLETS;updateWeaponHUD();}
  }

  if(G.phase!=="playing") return;

  // DungeonManager
  if(G.betweenWave){
    G.waveTimer-=dt;
    if(G.waveTimer<=0){
      if(G.wave>=currentWaves.length) endGame(true);
      else startWave();
    }
  } else {
    if(G.spawnQ.length>0){G.spawnCD-=dt;if(G.spawnCD<=0){spawnEnemy(G.spawnQ.shift());G.spawnCD=0.48;}}
    if(!G.spawnQ.length&&!G.aliveEnemies){
      G.betweenWave=true;G.waveTimer=4.0;
      var b=G.wave*500*DIFF[currentDiff].mult;G.score+=Math.floor(b);
      G.player.hp=Math.min(G.player.maxHp,G.player.hp+Math.floor(G.player.maxHp*.18));
      G.player.mana=G.player.maxMana;
    }
  }

  // Player (PlayerController.lua)
  var p=G.player;
  p.atkCD=Math.max(0,p.atkCD-dt);p.rollCD=Math.max(0,p.rollCD-dt);
  p.iframes=Math.max(0,p.iframes-dt);p.flash=Math.max(0,p.flash-dt);
  p.atkAnim=Math.max(0,(p.atkAnim||0)-dt);
  p.manaT+=dt;if(p.manaT>=1){p.manaT=0;p.mana=Math.min(p.maxMana,p.mana+5);}
  p.angle=Math.atan2(mouse3d.z*SCALE-p.y,mouse3d.x*SCALE-p.x);

  if(p.rolling){
    p.rollDur-=dt;moveCC(p,p.rvx*272*dt,p.rvy*272*dt,12);if(p.rollDur<=0)p.rolling=false;
  } else {
    var dx=0,dy=0;
    if(keys["w"]||keys["arrowup"])    dy-=1;
    if(keys["s"]||keys["arrowdown"])  dy+=1;
    if(keys["a"]||keys["arrowleft"])  dx-=1;
    if(keys["d"]||keys["arrowright"]) dx+=1;
    var spr=keys["shift"]||keys["mbsprint"];
    var spd2=p.spd*(spr?1.78:1);
    if(dx&&dy){var ll=1/Math.SQRT2;dx*=ll;dy*=ll;}
    if(dx||dy)p.walkT+=dt;
    moveCC(p,dx*spd2*dt,dy*spd2*dt,12);
    // Dodge roll
    if((keys[" "]||keys["mbdash"])&&p.rollCD<=0&&(dx||dy)){
      p.rolling=true;p.rollDur=0.22;p.rollCD=1.1;p.iframes=0.44;
      p.rvx=dx||Math.cos(p.angle);p.rvy=dy||Math.sin(p.angle);
      delete keys[" "];delete keys["mbdash"];
    }
    // Toggle weapon
    if(keys["e"]||keys["mbtoggle"]){
      currentWeapon=currentWeapon==="sword"?"gun":"sword";
      updateWeaponHUD();updateWeaponModel();
      delete keys["e"];delete keys["mbtoggle"];
    }
    // Melee
    if((keys["f"]||keys["click"]||keys["mbatk"])&&p.atkCD<=0&&currentWeapon==="sword"){
      doMelee();delete keys["f"];delete keys["click"];delete keys["mbatk"];
    }
    // Gun
    if((keys["g"]||keys["click"]||keys["mbatk"])&&p.atkCD<=0&&currentWeapon==="gun"&&!gunReloading&&gunBullets>0){
      doGun();delete keys["g"];delete keys["click"];delete keys["mbatk"];
    }
    // Magic
    if((keys["q"]||keys["mbmagic"])&&p.atkCD<=0&&p.mana>=MAGIC_COST){
      doMagic();delete keys["q"];delete keys["mbmagic"];
    }
  }

  // EnemyAI (EnemyAI.lua state machines)
  G.enemies.forEach(function(e){
    if(!e.alive)return;
    e.atkCD=Math.max(0,e.atkCD-dt);
    if(e.hurtT>0){e.hurtT-=dt;return;}
    var dd=d2xy(e.x,e.y,p.x,p.y);
    if(e.state==="patrol"&&dd<e.sight)e.state="chase";
    if(e.state==="chase"){if(dd>e.sight*1.7)e.state="patrol";else if(dd<=e.ar)e.state="attack";}
    if(e.state==="attack"&&dd>e.ar*1.5)e.state="chase";
    if(e.type==="specter"&&e.state==="patrol"&&Math.random()<.006){var s=SPAWNS[ri(0,SPAWNS.length-1)];e.x=s.x+rnd(-22,22);e.y=s.y+rnd(-22,22);}
    if(e.state==="patrol"){
      e.ptimer-=dt;if(e.ptimer<=0){e.ptx=SCALE*1.5+rnd(0,GW-SCALE*3);e.pty=SCALE*1.5+rnd(0,GH-SCALE*3);e.ptimer=rnd(2,5);}
      var pd=d2(e,{x:e.ptx,y:e.pty});if(pd>6)moveCC(e,(e.ptx-e.x)/pd*e.spd*.44*dt,(e.pty-e.y)/pd*e.spd*.44*dt,12);
    } else if(e.state==="chase"){
      if(dd>1)moveCC(e,(p.x-e.x)/dd*e.spd*dt,(p.y-e.y)/dd*e.spd*dt,12);
    } else if(e.state==="attack"){
      if(e.atkCD<=0&&dd<=e.ar*1.2){
        e.atkCD=e.acd;
        if(p.iframes<=0){
          var dmg=Math.max(1,e.atk-p.def+ri(0,4));
          p.hp-=dmg;p.flash=0.18;G.shake=Math.max(G.shake,7);
          if(p.hp<=0){p.hp=0;endGame(false);}
        }
      }
    }
  });

  // Projectiles
  G.projs=G.projs.filter(function(pr){
    var hitRadiusSq=26*26;
    pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;pr.life-=dt;
    if(pr.life<=0||isWall(pr.x,pr.y)){var m=pMeshMap[pr.id];if(m){scene.remove(m);delete pMeshMap[pr.id];}return false;}
    for(var i=0;i<G.enemies.length;i++){var e=G.enemies[i];if(!e.alive||pr.hit[e.id]||d2sqxy(pr.x,pr.y,e.x,e.y)>hitRadiusSq)continue;pr.hit[e.id]=1;hitEnemy(e,pr.dmg);var m2=pMeshMap[pr.id];if(m2){scene.remove(m2);delete pMeshMap[pr.id];}return false;}
    return true;
  });

  G.cleanupTimer-=dt;
  if(G.deadEnemies>0&&(G.deadEnemies>=10||G.cleanupTimer<=0)){
    G.enemies=G.enemies.filter(function(e){return e.alive;});
    G.deadEnemies=0;
    G.cleanupTimer=0.8;
  }

  G.hudTimer-=dt;
  if(G.hudTimer<=0){
    updateHUD();
    G.hudTimer=0.08;
  }
}

// ================================================================
//  3D SYNC
// ================================================================
function sync3D(){
  if(!G||!playerMesh) return;
  var t=G.time,p=G.player;
  playerMesh.position.set(p.x/SCALE,p.rolling?0:Math.sin(p.walkT*10)*0.04,p.y/SCALE);
  playerMesh.rotation.y=-p.angle+Math.PI/2;
  playerMesh.rotation.x=p.rolling?lerp(playerMesh.rotation.x,1.1,0.3):lerp(playerMesh.rotation.x,0,0.22);
  var ll=playerMesh.getObjectByName("legL");if(ll)ll.rotation.x= Math.sin(p.walkT*10)*0.38;
  var lr=playerMesh.getObjectByName("legR");if(lr)lr.rotation.x=-Math.sin(p.walkT*10)*0.38;
  var pal=playerMesh.getObjectByName("armL");if(pal)pal.rotation.x=-Math.sin(p.walkT*10)*0.28;
  var par=playerMesh.getObjectByName("armR");if(par)par.rotation.x= Math.sin(p.walkT*10)*0.28;
  var sw=playerMesh.getObjectByName("sword");if(sw)sw.rotation.z=(p.atkAnim>0)?(-0.22-(p.atkAnim/0.4)*1.5):lerp(sw.rotation.z,-0.22,0.22);
  var rune=playerMesh.getObjectByName("rune");if(rune&&rune.material)rune.material.emissiveIntensity=0.9+0.6*Math.sin(t*4);
  var visor=playerMesh.getObjectByName("visor");if(visor&&visor.material)visor.material.emissiveIntensity=p.flash>0?3.5:(1.6+0.3*Math.sin(t*3));
  var pl=playerMesh.getObjectByName("plight");if(pl){pl.intensity=p.flash>0?3.2:(p.iframes>0?0.7:1.4);pl.color.setHex(p.flash>0?0xff4444:0x4488ff);}
  var mz=playerMesh.getObjectByName("muzzle");if(mz&&mz.material)mz.material.emissiveIntensity=currentWeapon==="gun"?(1.5+Math.sin(t*8)*0.5):0;

  G.enemies.forEach(function(e){
    if(!e.alive)return;
    if(!eMeshMap[e.id]){var m=null;if(e.type==="grunt")m=buildGrunt();else if(e.type==="shade")m=buildShade();else if(e.type==="enforcer")m=buildEnforcer();else if(e.type==="specter")m=buildSpecter();else if(e.type==="boss")m=buildBoss();if(m){scene.add(m);eMeshMap[e.id]=m;}}
    var mesh=eMeshMap[e.id];if(!mesh)return;
    e.wt=(e.wt||0)+0.016;
    mesh.rotation.y=Math.atan2(p.x-e.x,p.y-e.y);
    if(e.type==="grunt"){mesh.position.set(e.x/SCALE,Math.sin(e.wt*8)*0.04,e.y/SCALE);var ma=mesh.getObjectByName("armR");if(ma)ma.rotation.x=Math.sin(e.wt*8)*0.45;var mb=mesh.getObjectByName("armL");if(mb)mb.rotation.x=-Math.sin(e.wt*8)*0.35;}
    else if(e.type==="shade"){mesh.position.set(e.x/SCALE,0.25+Math.sin(t*2.4+e.id*0.1)*0.19,e.y/SCALE);var outer=mesh.getObjectByName("outer");if(outer){outer.scale.setScalar(0.94+0.1*Math.sin(t*3+e.id*0.1));outer.rotation.y+=0.022;}}
    else if(e.type==="enforcer"){mesh.position.set(e.x/SCALE,Math.sin(e.wt*5)*0.03,e.y/SCALE);var ma2=mesh.getObjectByName("armL");if(ma2)ma2.rotation.x=Math.sin(e.wt*5)*0.22;var mb2=mesh.getObjectByName("armR");if(mb2)mb2.rotation.x=-Math.sin(e.wt*5)*0.22;}
    else if(e.type==="boss"){mesh.position.set(e.x/SCALE,0.05+Math.sin(e.wt*4.2)*0.04,e.y/SCALE);var ma3=mesh.getObjectByName("armL");if(ma3)ma3.rotation.x=Math.sin(e.wt*4.2)*0.28;var mb3=mesh.getObjectByName("armR");if(mb3)mb3.rotation.x=-Math.sin(e.wt*4.2)*0.28;var aura=mesh.getObjectByName("bossAura");if(aura)aura.intensity=1.5+0.45*Math.sin(t*5+e.id*0.1);}
    else if(e.type==="specter"){mesh.position.set(e.x/SCALE,0.22+Math.sin(t*3.4+e.id*0.13)*0.22,e.y/SCALE);for(var i=0;i<3;i++){var orb=mesh.getObjectByName("orb"+i);if(orb){var a=t*2.6+(i/3)*Math.PI*2;orb.position.set(Math.cos(a)*0.4,Math.sin(t*2+i)*0.15,Math.sin(a)*0.4);}}var tail=mesh.getObjectByName("tail");if(tail)tail.rotation.x=0.15+Math.sin(t*3)*0.18;var spl=mesh.getObjectByName("plight");if(spl)spl.intensity=0.9+0.4*Math.sin(t*4+e.id*0.1);}
  });

  G.projs.forEach(function(pr){
    if(!pMeshMap[pr.id]){var m=(pr.projType==="gun")?buildGunProj():buildMagicProj();scene.add(m);pMeshMap[pr.id]=m;}
    var m=pMeshMap[pr.id];if(m){m.position.set(pr.x/SCALE,0.55,pr.y/SCALE);m.rotation.y+=0.14;}
  });

  // Camera
  var px=G.player.x/SCALE,pz=G.player.y/SCALE;
  camX=lerp(camX,px,0.07);camZ=lerp(camZ,pz+12,0.07);
  camera.position.set(camX+(G.shake>0.1?rnd(-G.shake*.03,G.shake*.03):0),19,camZ+(G.shake>0.1?rnd(-G.shake*.03,G.shake*.03):0));
  camera.lookAt(camX,0,camZ-12.5);
}

// ================================================================
//  HUD DOM (UIManager.lua -> DOM)
// ================================================================
function setBar(id,ratio,col){
  var el=document.getElementById(id);if(!el)return;
  el.style.width=(clamp(ratio,0,1)*100)+"%";
  if(col){el.style.background=col;el.style.boxShadow="0 0 6px "+col+"88";}
}
function setText(id,txt){var el=document.getElementById(id);if(el)el.textContent=txt;}

function updateHUD(){
  if(!G) return;
  var p=G.player;
  var hpR=clamp(p.hp/p.maxHp,0,1);
  var hpC=hpR>.55?"#2ecc71":hpR>.28?"#f39c12":"#e74c3c";
  setBar("barHP",hpR,hpC);setText("valHP",Math.ceil(p.hp)+"/"+p.maxHp);
  setBar("barMP",clamp(p.mana/p.maxMana,0,1),null);setText("valMP",Math.ceil(p.mana)+"/"+p.maxMana);
  setBar("barXP",clamp(p.xp/p.xpNext,0,1),null);setText("valXP",p.xp+"/"+p.xpNext);
  setText("statLv","Lv."+p.level);setText("statAtk","ATK "+p.atk+" DEF "+p.def);
  setText("statScore","Score: "+G.score.toLocaleString());
  var alive=G.aliveEnemies+G.spawnQ.length;
  var cfg=DIFF[currentDiff];
  setText("waveLabel",G.wave===0?"GET READY":"WAVE "+G.wave+"/"+currentWaves.length);
  var db=document.getElementById("diffBadge");if(db){db.textContent=cfg.name;db.style.color=cfg.col;}
  var ec=document.getElementById("enemyCount");if(ec){ec.textContent="Enemies: "+alive;ec.style.color=alive>0?"#e74c3c":"#2ecc71";}
  var wn=document.getElementById("waveNext");if(wn)wn.textContent=(G.betweenWave&&G.wave>0&&G.wave<currentWaves.length)?"Next wave: "+Math.ceil(G.waveTimer)+"s":"";
}

function updateWeaponHUD(){
  var wl=document.getElementById("weaponLabel");
  var bb=document.getElementById("bulletBar");
  if(!wl||!bb) return;
  if(currentWeapon==="sword"){
    wl.textContent="SWORD";wl.style.color="#00d4ff";bb.textContent="";
  } else {
    wl.textContent="GUN";wl.style.color="#ff8800";
    if(gunReloading){
      bb.textContent="RELOAD...";bb.style.color="#ff4400";
    } else {
      var bars="";
      for(var i=0;i<GUN_BULLETS;i++) bars+=(i<gunBullets?"| ":". ");
      bb.textContent=bars.trim();bb.style.color="#ffcc44";
    }
  }
  // Update mobile toggle button
  var tog=document.getElementById("mbToggle");
  if(tog) tog.textContent=currentWeapon==="sword"?"SWORD":"GUN";
}

function updateWeaponModel(){
  if(!playerMesh) return;
  var sw=playerMesh.getObjectByName("sword");
  var gn=playerMesh.getObjectByName("gun");
  if(sw) sw.visible=(currentWeapon==="sword");
  if(gn) gn.visible=(currentWeapon==="gun");
}

// ================================================================
//  MENU SYSTEM
// ================================================================
function G_pressAny(){
  var pa=document.getElementById("pressAny");
  var mm=document.getElementById("mainMenu");
  if(pa) pa.classList.add("hidden");
  if(mm){
    mm.classList.remove("hidden");
    // Check continue
    var save=loadSave();
    var cb=document.getElementById("continueBtn");
    if(cb) cb.style.opacity=save?"1":"0.38";
  }
}

function G_showMenu(){
  var dp=document.getElementById("diffPanel");
  var mm=document.getElementById("mainMenu");
  if(dp) dp.classList.add("hidden");
  if(mm) mm.classList.remove("hidden");
}

function G_showDiff(){
  var mm=document.getElementById("mainMenu");
  var dp=document.getElementById("diffPanel");
  if(mm) mm.classList.add("hidden");
  if(dp){
    dp.classList.remove("hidden");
    renderDiffButtons();
  }
}

function renderDiffButtons(){
  var cont=document.getElementById("diffButtons");
  if(!cont) return;
  cont.innerHTML="";
  var unlocked=isNightmareUnlocked();
  Object.keys(DIFF).forEach(function(key){
    var cfg=DIFF[key];
    var locked=(key==="nightmare"&&!unlocked);
    var btn=document.createElement("button");
    btn.className="diff-btn"+(currentDiff===key?" active":"")+(locked?" locked":"");
    btn.style.borderColor=locked?"rgba(255,255,255,.08)":cfg.col+"55";
    if(currentDiff===key) btn.style.color=cfg.col;
    btn.innerHTML=cfg.name+(locked?" <span class='lock-badge'>CLEAR NORMAL/HARD TO UNLOCK</span>":"")+" &nbsp;<span style='font-size:9px;color:#556677'>"+cfg.waves+" WAVES</span>";
    if(!locked) btn.onclick=(function(k){return function(){currentDiff=k;saveDiff(k);renderDiffButtons();};})(key);
    cont.appendChild(btn);
  });
}

function G_startNew(){
  currentDiff=loadDiff()||"normal";
  currentWeapon="sword";gunBullets=GUN_BULLETS;gunReloading=false;
  mkGame(null);
  showGameUI();startWave();updateWeaponHUD();updateWeaponModel();
}

function G_continue(){
  var save=loadSave();
  if(!save){showNotif("NO SAVE FOUND");return;}
  currentDiff=save.difficulty||"normal";
  mkGame(save);
  showGameUI();startWave();updateWeaponHUD();updateWeaponModel();
  showNotif("LOADED — WAVE "+G.wave+" "+DIFF[currentDiff].name);
}

function showGameUI(){
  document.getElementById("titleScreen").classList.add("hidden");
  document.getElementById("endScreen").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  if(isMobile) document.getElementById("mobileCtrl").classList.remove("hidden");
}

function G_resume(){
  isPaused=false;
  document.getElementById("pauseMenu").classList.add("hidden");
}

function G_save(){saveGame();G_resume();}

function G_goTitle(){
  isPaused=false;
  G=null;
  // Clear meshes
  Object.keys(eMeshMap).forEach(function(k){scene.remove(eMeshMap[k]);delete eMeshMap[k];});
  Object.keys(pMeshMap).forEach(function(k){scene.remove(pMeshMap[k]);delete pMeshMap[k];});
  playerMesh.position.set(GW/2/SCALE,0,GH/2/SCALE);
  camX=COLS/2;camZ=ROWS/2+12.5;
  document.getElementById("pauseMenu").classList.add("hidden");
  document.getElementById("endScreen").classList.add("hidden");
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("mobileCtrl").classList.add("hidden");
  var ts=document.getElementById("titleScreen");ts.classList.remove("hidden");
  var pa=document.getElementById("pressAny");if(pa)pa.classList.remove("hidden");
  var mm=document.getElementById("mainMenu");if(mm)mm.classList.add("hidden");
  var dp=document.getElementById("diffPanel");if(dp)dp.classList.add("hidden");
  // Re-arm press-any (small delay so the click that triggered goTitle doesn't immediately fire it)
  setTimeout(setupPressAny,200);
}

function endGame(victory){
  if(!G||G.phase!=="playing") return;
  G.phase=victory?"victory":"gameover";
  // Unlock nightmare if cleared normal/hard
  if(victory&&(currentDiff==="normal"||currentDiff==="hard")){unlockNightmare();}
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("mobileCtrl").classList.add("hidden");
  var es=document.getElementById("endScreen");es.classList.remove("hidden");
  var et=document.getElementById("endTitle");
  if(et){et.textContent=victory?"ATHERA SECURED":"FALLEN IN ATHERA";et.className="end-title "+(victory?"victory":"gameover");}
  var cfg=DIFF[currentDiff];
  setText("endStats","Difficulty: "+cfg.name+"\nWave "+G.wave+" / "+currentWaves.length+"\nLevel "+G.player.level+"\nScore "+G.score.toLocaleString());
}

function G_showDiffFromPause(){G_goTitle();}

// ================================================================
//  MOBILE DETECTION & CONTROLS
// ================================================================
function detectMobile(){
  isMobile=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
  if(isMobile){
    document.getElementById("ctrlBar").classList.add("hidden");
  }
}

function setupMobileControls(){
  function hold(id,key){
    var el=document.getElementById(id);if(!el)return;
    el.addEventListener("touchstart",function(e){e.preventDefault();keys[key]=true;},{passive:false});
    el.addEventListener("touchend",function(e){e.preventDefault();delete keys[key];},{passive:false});
    el.addEventListener("mousedown",function(){keys[key]=true;});
    el.addEventListener("mouseup",function(){delete keys[key];});
  }
  hold("btnUp","w");hold("btnDown","s");hold("btnLeft","a");hold("btnRight","d");
  hold("mbSprint","mbsprint");hold("mbDash","mbdash");hold("mbMagic","mbmagic");
  hold("mbAtk","mbatk");
  var tog=document.getElementById("mbToggle");
  if(tog){
    tog.addEventListener("touchstart",function(e){e.preventDefault();keys["mbtoggle"]=true;},{passive:false});
    tog.addEventListener("touchend",function(e){e.preventDefault();delete keys["mbtoggle"];},{passive:false});
  }
  // Joystick aim: tap right side of screen updates mouse3d
  document.getElementById("gameCanvas").addEventListener("touchmove",function(e){
    e.preventDefault();
    // Use first touch for aiming if on right half
    for(var i=0;i<e.touches.length;i++){
      var t=e.touches[i];
      if(t.clientX>window.innerWidth*0.45){
        var rc=document.getElementById("gameCanvas").getBoundingClientRect();
        mouseNDC.x=(t.clientX-rc.left)/rc.width*2-1;
        mouseNDC.y=-((t.clientY-rc.top)/rc.height)*2+1;
        raycaster.setFromCamera(mouseNDC,camera);
        raycaster.ray.intersectPlane(groundPlane,worldPt);
        mouse3d.x=worldPt.x;mouse3d.z=worldPt.z;
      }
    }
  },{passive:false});
}

// ================================================================
//  INPUT
// ================================================================
var pressAnyReady=false;

function setupPressAny(){
  var pa=document.getElementById("pressAny");
  var ts=document.getElementById("titleScreen");
  pressAnyReady=true;
  // Remove any old listeners, re-attach fresh
  document.removeEventListener("keydown",_onPressAnyKey);
  document.removeEventListener("pointerdown",_onPressAnyPtr);
  document.removeEventListener("click",_onPressAnyPtr);
  document.removeEventListener("touchstart",_onPressAnyPtr);
  if(pa){
    pa.removeEventListener("click",_onPressAnyPtr);
    pa.removeEventListener("touchstart",_onPressAnyPtr);
  }
  if(ts){
    ts.removeEventListener("click",_onPressAnyPtr);
    ts.removeEventListener("touchstart",_onPressAnyPtr);
  }
  document.addEventListener("keydown",_onPressAnyKey);
  document.addEventListener("pointerdown",_onPressAnyPtr);
  document.addEventListener("click",_onPressAnyPtr);
  document.addEventListener("touchstart",_onPressAnyPtr,{passive:false});
  if(pa){
    pa.addEventListener("click",_onPressAnyPtr);
    pa.addEventListener("touchstart",_onPressAnyPtr,{passive:false});
  }
  if(ts){
    ts.addEventListener("click",_onPressAnyPtr);
    ts.addEventListener("touchstart",_onPressAnyPtr,{passive:false});
  }
}

function _onPressAnyKey(e){
  if(!pressAnyReady) return;
  var k=e.key;
  if(k==="F5"||k==="F12"||k==="Tab") return;
  pressAnyReady=false;
  document.removeEventListener("keydown",_onPressAnyKey);
  document.removeEventListener("pointerdown",_onPressAnyPtr);
  G_pressAny();
}

function _onPressAnyPtr(e){
  if(!pressAnyReady) return;
  if(e&&e.type==="touchstart"&&e.preventDefault) e.preventDefault();
  // Ignore clicks on menu buttons themselves (they handle their own onclick)
  if(e.target&&e.target.tagName==="BUTTON") return;
  pressAnyReady=false;
  document.removeEventListener("keydown",_onPressAnyKey);
  document.removeEventListener("pointerdown",_onPressAnyPtr);
  document.removeEventListener("click",_onPressAnyPtr);
  document.removeEventListener("touchstart",_onPressAnyPtr);
  G_pressAny();
}

function initInput(){
  window.addEventListener("keydown",function(e){
    var k=e.key.toLowerCase();
    if(["w","s","a","d"," "].indexOf(k)>=0) e.preventDefault();
    // Don't set game keys while on title screen
    if(pressAnyReady) return;
    keys[k]=true;
    // ESC pause
    if(k==="escape"&&G&&G.phase==="playing"){
      if(isPaused){G_resume();}
      else{isPaused=true;document.getElementById("pauseMenu").classList.remove("hidden");}
    }
  });
  window.addEventListener("keyup",function(e){delete keys[e.key.toLowerCase()];});

  var canvas=document.getElementById("gameCanvas");
  canvas.addEventListener("mousemove",function(e){
    var rc=canvas.getBoundingClientRect();
    mouseNDC.x=(e.clientX-rc.left)/rc.width*2-1;
    mouseNDC.y=-((e.clientY-rc.top)/rc.height)*2+1;
    raycaster.setFromCamera(mouseNDC,camera);
    raycaster.ray.intersectPlane(groundPlane,worldPt);
    mouse3d.x=worldPt.x;mouse3d.z=worldPt.z;
  });
  canvas.addEventListener("mousedown",function(e){if(e.button===0)keys["click"]=true;});
  window.addEventListener("mouseup",function(){delete keys["click"];});
  canvas.addEventListener("contextmenu",function(e){e.preventDefault();});
}

// ================================================================
//  MAIN LOOP
// ================================================================
var lastTime=0;
function loop(now){
  var dt=Math.min((now-lastTime)/1000,0.05);lastTime=now;
  if(G&&G.phase==="playing") updateGame(dt);
  else if(G&&G.phase!=="playing"){/* nothing */}
  if(!bootFailed&&renderer&&scene&&camera){
    sync3D();
    renderer.render(scene,camera);
  }
  requestAnimationFrame(loop);
}

// ── BOOT ──
initInput();
detectMobile();
setupMobileControls();
currentDiff=loadDiff();
setupPressAny();
try{
  initScene();
}catch(e){
  bootFailed=true;
  console.error("Athera boot failed:",e);
}
requestAnimationFrame(function(now){lastTime=now;requestAnimationFrame(loop);});
