// Janitor's procedural meshes are converted to Three.js geometry for the shared scene.
window.createJanitorModel = function () {
  const group = new THREE.Group();
  const C = {
    skin:[0.39,0.36,0.29], skinLight:[0.53,0.48,0.38], skinDark:[0.25,0.23,0.19],
    coat:[0.20,0.19,0.13], coatLight:[0.30,0.28,0.20], coatDark:[0.12,0.12,0.09],
    hat:[0.12,0.10,0.08], hatLight:[0.22,0.18,0.13], cloth:[0.32,0.30,0.24],
    bandage:[0.49,0.45,0.36], bandageDark:[0.32,0.29,0.23],
    teeth:[0.72,0.66,0.52], mouth:[0.08,0.055,0.045], shoe:[0.13,0.13,0.12],
    metal:[0.42,0.36,0.23]
  };
  const identity = () => LIBS.identity();
  const compose = (pos, rot, scale) => {
    let m=LIBS.translation(pos[0],pos[1],pos[2]);
    if (rot) { m=LIBS.multiply(m,LIBS.rotationX(rot[0]||0)); m=LIBS.multiply(m,LIBS.rotationY(rot[1]||0)); m=LIBS.multiply(m,LIBS.rotationZ(rot[2]||0)); }
    if (scale) m=LIBS.multiply(m,LIBS.scaling(scale[0],scale[1],scale[2]));
    return m;
  };
  function addMesh(vertices, indices, color, model, mode) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(color[0], color[1], color[2]),
      roughness: 0.95,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.fromArray(model || identity());
    group.add(mesh);
  }
  function sphere(pos, scale, color, rot) {
    const v=[], ind=[], lat=18, lon=24;
    for(let y=0;y<=lat;y++){const t=y*Math.PI/lat;for(let x=0;x<=lon;x++){const p=x*2*Math.PI/lon;v.push(Math.sin(t)*Math.cos(p),Math.cos(t),Math.sin(t)*Math.sin(p));}}
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;ind.push(a,a+1,b,b,a+1,b+1);}
    addMesh(v,ind,color,compose(pos,rot,scale));
  }
  function frustum(pos, radiusBottom, radiusTop, height, color, rot, segments=24) {
    const v=[], ind=[];
    for(let y=0;y<=1;y++){const r=radiusBottom+(radiusTop-radiusBottom)*y;for(let i=0;i<=segments;i++){const a=i*2*Math.PI/segments;v.push(Math.cos(a)*r,y*height-height/2,Math.sin(a)*r);}}
    for(let i=0;i<segments;i++){const a=i,b=a+segments+1;ind.push(a,b,a+1,b,b+1,a+1);}
    addMesh(v,ind,color,compose(pos,rot,[1,1,1]));
  }
  function nose(color) {
    const profile=[
      [3.36,0.47,0.065,0.035],
      [3.28,0.52,0.095,0.065],
      [3.19,0.59,0.125,0.105],
      [3.11,0.66,0.175,0.13],
      [3.055,0.63,0.145,0.105],
      [3.035,0.57,0.085,0.065]
    ];
    const v=[], ind=[], seg=28;
    profile.forEach(([y,z,width,depth])=>{
      for(let i=0;i<=seg;i++){
        const a=i*2*Math.PI/seg;
        v.push(width*Math.cos(a),y,z+depth*Math.sin(a));
      }
    });
    for(let r=0;r<profile.length-1;r++){
      for(let i=0;i<seg;i++){
        const a=r*(seg+1)+i,b=a+seg+1;
        ind.push(a,a+1,b,a+1,b+1,b);
      }
    }
    addMesh(v,ind,color);
  }
  function bezier(p0,p1,p2,p3,t){const u=1-t;return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1],u*u*u*p0[2]+3*u*u*t*p1[2]+3*u*t*t*p2[2]+t*t*t*p3[2]];}
  function tube(points, radius, color, sides=9) {
    const v=[], ind=[];
    for(let i=0;i<points.length;i++){
      const p=points[i], prev=points[Math.max(0,i-1)], next=points[Math.min(points.length-1,i+1)];
      let tx=next[0]-prev[0],ty=next[1]-prev[1],tz=next[2]-prev[2],tl=Math.hypot(tx,ty,tz)||1;tx/=tl;ty/=tl;tz/=tl;
      let ax=-tz,ay=0,az=tx,al=Math.hypot(ax,ay,az)||1;ax/=al;ay/=al;az/=al;
      const bx=ty*az-tz*ay,by=tz*ax-tx*az,bz=tx*ay-ty*ax;
      for(let j=0;j<=sides;j++){const a=j*2*Math.PI/sides;v.push(p[0]+radius*(Math.cos(a)*ax+Math.sin(a)*bx),p[1]+radius*(Math.cos(a)*ay+Math.sin(a)*by),p[2]+radius*(Math.cos(a)*az+Math.sin(a)*bz));}
    }
    for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;ind.push(a,b,a+1,b,b+1,a+1);}
    addMesh(v,ind,color);
  }
  function bezierTube(p0,p1,p2,p3,r,color,steps=28){const pts=[];for(let i=0;i<=steps;i++)pts.push(bezier(p0,p1,p2,p3,i/steps));tube(pts,r,color,10);}
  function box(pos, scale, color, rot) {
    const v=[-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5, -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5];
    const ind=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3];
    addMesh(v,ind,color,compose(pos,rot,scale));
  }

  // ===== Kepala dan tengkorak lonjong =====
  sphere([0,3.15,0],[0.73,1.02,0.53],C.skin,[0,0,-0.05]);
  // telinga yang besar dan menonjol
  sphere([-0.69,3.35,0.00],[0.22,0.31,0.17],C.skinLight,[0,0,-0.18]);
  sphere([0.69,3.35,0.00],[0.22,0.31,0.17],C.skinLight,[0,0,0.18]);
  sphere([-0.70,3.35,0.145],[0.11,0.19,0.045],C.skinDark);
  sphere([0.70,3.35,0.145],[0.11,0.19,0.045],C.skinDark);
  // kain penutup mata seperti lilitan kain, berlapis
  sphere([0,3.43,0.405],[0.70,0.24,0.16],C.bandage,[0,0,-0.06]);
  sphere([-0.08,3.48,0.49],[0.62,0.12,0.10],C.bandageDark,[0,0,-0.08]);
  // lipatan kain berupa kurva
  bezierTube([-0.58,3.52,0.47],[-0.30,3.62,0.58],[0.18,3.57,0.58],[0.55,3.49,0.46],0.025,C.teeth,18);
  bezierTube([-0.56,3.38,0.48],[-0.20,3.31,0.59],[0.25,3.34,0.58],[0.58,3.40,0.46],0.018,C.skinDark,18);
  // Hidung berbatang sempit, ujung melebar, dan lubang hidung di bagian bawah.
  nose(C.skinLight);
  sphere([-0.095,3.055,0.705],[0.038,0.018,0.012],C.skinDark);
  sphere([0.095,3.055,0.705],[0.038,0.018,0.012],C.skinDark);
  // mulut terbuka dan rahang
  sphere([0,2.88,0.43],[0.47,0.27,0.13],C.mouth,[0,0,-0.03]);
  sphere([0,2.78,0.40],[0.42,0.13,0.14],C.skinDark,[0,0,0]);
  // bibir dan gigi atas individual
  bezierTube([-0.42,2.93,0.52],[-0.22,3.02,0.57],[0.20,3.02,0.57],[0.42,2.92,0.52],0.035,C.skinLight,18);
  for(let i=0;i<9;i++){
    const x=-0.34+i*0.085;
    box([x,2.91+(Math.abs(x)*0.10),0.555],[0.065,0.095,0.035],C.teeth,[0,0,(i-4)*0.025]);
  }
  for(let i=0;i<5;i++){
    const x=-0.24+i*0.12;
    box([x,2.78,0.55],[0.075,0.065,0.03],C.teeth,[0,0,(i-2)*-0.04]);
  }
  // hidung keriput dan lipatan pipi
  bezierTube([-0.40,3.08,0.48],[-0.30,3.13,0.54],[-0.25,3.14,0.54],[-0.18,3.11,0.53],0.018,C.skinDark,12);
  bezierTube([0.18,3.11,0.53],[0.27,3.15,0.54],[0.33,3.12,0.52],[0.41,3.07,0.48],0.018,C.skinDark,12);

  // ===== Topi: brim silinder gepeng + crown frustum =====
  sphere([0,4.02,-0.015],[0.72,0.10,0.55],C.hat);
  frustum([0,4.20,-0.03],0.46,0.34,0.34,C.hat,[0,0,0],32);
  sphere([0,4.36,-0.03],[0.35,0.08,0.33],C.hatLight);
  bezierTube([-0.43,4.06,0.25],[-0.18,4.10,0.42],[0.18,4.10,0.42],[0.43,4.06,0.25],0.018,C.hatLight,20);

  // ===== Leher, badan jas panjang dan kerah =====
  frustum([0,2.15,0],0.40,0.56,1.25,C.coat,[0,0,0],28);
  sphere([0,2.72,0.01],[0.43,0.22,0.35],C.skinDark);
  // panel depan jas
  box([0,2.20,0.305],[0.42,0.82,0.06],C.coatLight,[0,0,-0.02]);
  // kerah jas
  box([-0.18,2.65,0.31],[0.19,0.28,0.07],C.coatDark,[0,0,-0.30]);
  box([0.18,2.65,0.31],[0.19,0.28,0.07],C.coatDark,[0,0,0.30]);
  // kancing dan saku
  for(let i=0;i<4;i++) sphere([0.04,2.48-i*0.18,0.35],[0.035,0.035,0.018],C.metal);
  box([-0.22,2.24,0.35],[0.18,0.20,0.035],C.coatDark);
  bezierTube([-0.29,2.30,0.38],[-0.23,2.32,0.39],[-0.17,2.32,0.39],[-0.14,2.30,0.38],0.012,C.coatLight,10);
  // pinggang dan celana
  frustum([0,1.42,0],0.30,0.35,0.35,C.coatDark,[0,0,0],24);
  frustum([-0.18,1.12,0],0.13,0.17,0.48,C.coat,[0,0,-0.04],18);
  frustum([0.18,1.12,0],0.13,0.17,0.48,C.coat,[0,0,0.04],18);
  // sepatu
  sphere([-0.20,0.78,0.10],[0.25,0.14,0.34],C.shoe,[0,0,-0.02]);
  sphere([0.20,0.78,0.10],[0.25,0.14,0.34],C.shoe,[0,0,0.02]);
  box([-0.20,0.70,0.13],[0.42,0.06,0.50],C.shoe);
  box([0.20,0.70,0.13],[0.42,0.06,0.50],C.shoe);

  // ===== Lengan panjang: Bézier tube sebagai mesh =====
  const armPoint=p=>[p[0]<0?-0.4+(p[0]+0.4)*1.3:0.4+(p[0]-0.4)*1.3,p[1],p[2]];
  const armTube=(p0,p1,p2,p3,r,color,steps)=>bezierTube(armPoint(p0),armPoint(p1),armPoint(p2),armPoint(p3),r,color,steps);
  // lengan kiri menjuntai dan melengkung ke luar
  armTube([-0.40,2.58,0.02],[-0.72,2.55,0.10],[-0.90,1.98,0.20],[-1.23,1.82,0.34],0.16,C.coat,34);
  armTube([-1.23,1.82,0.34],[-1.48,1.72,0.39],[-1.68,1.70,0.44],[-1.78,1.57,0.48],0.115,C.skin,22);
  // lengan kanan panjang lurus lalu menurun
  armTube([0.40,2.58,0.02],[0.80,2.52,0.02],[1.20,2.47,0.10],[1.53,2.44,0.20],0.15,C.coat,30);
  armTube([1.53,2.44,0.20],[1.76,2.43,0.26],[1.90,2.36,0.30],[2.03,2.31,0.34],0.11,C.skin,20);
  // garis lipatan lengan jas
  for(let i=0;i<4;i++){
    const y=2.25+i*0.10;
    armTube([1.30,y,0.29],[1.38,y+0.03,0.30],[1.45,y+0.03,0.30],[1.51,y,0.29],0.012,C.coatLight,8);
  }
  // telapak tangan kiri dan kanan
  sphere(armPoint([-1.84,1.53,0.49]),[0.22,0.10,0.13],C.skin);
  sphere(armPoint([2.08,2.27,0.35]),[0.22,0.10,0.12],C.skin);
  // jari tangan dengan kurva Bézier
  const leftFingers=[
    [[-1.90,1.54,.56],[-1.98,1.48,.63],[-2.05,1.42,.65],[-2.11,1.38,.65]],
    [[-1.88,1.51,.57],[-1.94,1.43,.64],[-1.98,1.35,.65],[-2.00,1.31,.65]],
    [[-1.84,1.50,.57],[-1.87,1.42,.64],[-1.88,1.36,.65],[-1.87,1.32,.65]],
    [[-1.80,1.51,.56],[-1.79,1.45,.63],[-1.78,1.40,.64],[-1.75,1.37,.64]]
  ];
  leftFingers.forEach(p=>bezierTube(...p.map(armPoint),0.035,C.skin,12));
  const rightFingers=[
    [[2.12,2.29,.40],[2.20,2.31,.46],[2.27,2.31,.48],[2.34,2.30,.48]],
    [[2.13,2.26,.41],[2.22,2.25,.48],[2.30,2.23,.49],[2.36,2.21,.49]],
    [[2.12,2.24,.40],[2.20,2.19,.47],[2.26,2.16,.48],[2.31,2.14,.48]],
    [[2.07,2.22,.39],[2.11,2.15,.45],[2.14,2.10,.46],[2.16,2.08,.46]]
  ];
  rightFingers.forEach(p=>bezierTube(...p.map(armPoint),0.032,C.skin,12));
  // kuku / ruas jari sebagai garis halus
  armTube([-2.05,1.41,.67],[-2.04,1.40,.68],[-2.02,1.40,.68],[-2.01,1.40,.68],0.009,C.skinDark,5);
  armTube([2.27,2.30,.50],[2.29,2.30,.51],[2.31,2.30,.51],[2.33,2.30,.50],0.008,C.skinDark,5);

  // Pose berdiri netral, kepala agak condong. Mesh disimpan sebagai bagian-bagian terpisah.
  return group;
};
