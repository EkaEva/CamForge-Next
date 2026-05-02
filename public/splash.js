// Splash screen animation — extracted from index.html for CSP compliance
(function(){
  // Wait for icon font to load before starting splash animation
  var fontReady=false;
  if(document.fonts&&document.fonts.load){
    document.fonts.load('20px Material Symbols Outlined').then(function(){fontReady=true;});
  }else{fontReady=true;}

  // Pre-compute cam profile points
  var cx=100,cy=100,r0=55,h=20,n=120;
  var pts=[];
  for(var i=0;i<=n;i++){var a=(i/n)*2*Math.PI,s=h*(0.5-0.5*Math.cos(a)),r=r0+s;pts.push([cx+r*Math.sin(a),cy-r*Math.cos(a)]);}

  var p=document.getElementById('splash-cam-path');
  var camGroup=document.getElementById('splash-cam-group');
  var camBase=document.getElementById('splash-cam-base');
  var titleEl=document.querySelector('.splash-title');
  var subEl=document.querySelector('.splash-subtitle');
  var verEl=document.querySelector('.splash-version');
  var curvesEl=document.querySelector('.splash-curves');
  var gridEl=document.querySelector('.splash-grid');
  var splash=document.getElementById('splash');
  if(!p)return;

  // Timeline (~2.0s total):
  // cam draw: 0.1s-0.8s
  // title spring: 0.35s
  // subtitle spring: 0.5s
  // version spring: 0.65s
  // curves fade in: 0.55s
  // cam rotation: 0.8s-1.3s
  // global fade out: 1.5s-2.0s

  var t0=performance.now();

  // Spring simulation helper
  function springVal(elapsed,delay,damping){
    var t=Math.max(0,(elapsed-delay)/1000);
    if(t<=0)return{v:0,y:30};
    var omega=8;
    var val=1-Math.exp(-damping*t)*Math.cos(omega*t);
    val=Math.min(1,Math.max(0,val));
    return{v:val,y:30*(1-val)};
  }

  function tick(now){
    var elapsed=now-t0;

    // 1. Cam draw (progressive point reveal, 0.1s-0.8s)
    var drawProg=Math.min(Math.max((elapsed-100)/700,0),1);
    var visPts=Math.floor(n*drawProg);
    var d='';
    for(var i=0;i<=visPts;i++){d+=(i===0?'M ':'L ')+pts[i][0].toFixed(2)+' '+pts[i][1].toFixed(2)+' ';}
    if(drawProg>=1)d+='Z';
    p.setAttribute('d',d);

    // 2. Cam base triangle appears when draw > 30%
    if(camBase){
      camBase.style.opacity=drawProg>0.3?'1':'0';
      camBase.style.transition='opacity 0.3s ease';
    }

    // 3. Title spring (delay 0.35s, damping 14)
    if(titleEl){
      var ts=springVal(elapsed,350,14);
      titleEl.style.opacity=ts.v;
      titleEl.style.transform='translateY('+ts.y+'px)';
    }

    // 4. Subtitle spring (delay 0.5s, damping 16)
    if(subEl){
      var ss=springVal(elapsed,500,16);
      subEl.style.opacity=ss.v;
      subEl.style.transform='translateY('+(30*(1-ss.v))+'px)';
    }

    // 5. Version spring (delay 0.65s, damping 18)
    if(verEl){
      var vs=springVal(elapsed,650,18);
      verEl.style.opacity=vs.v;
      verEl.style.transform='translateY('+(15*(1-vs.v))+'px)';
    }

    // 6. Curves fade in (from 0.55s, target opacity 0.4)
    if(curvesEl){
      var curveOp=Math.min(Math.max((elapsed-550)/250,0),0.4);
      curvesEl.style.opacity=curveOp;
    }

    // 7. Cam rotation (0.8s-1.3s)
    if(camGroup&&drawProg>=1){
      var rotProg=Math.min(Math.max((elapsed-800)/500,0),1);
      var rotEase=rotProg<0.5?2*rotProg*rotProg:1-Math.pow(-2*rotProg+2,2)/2;
      camGroup.setAttribute('transform','rotate('+(rotEase*360)+' 100 100)');
    }

    // 8. Global fade out — wait for icon font (max 2.0s total)
    var canFade=fontReady||elapsed>=2000;
    var fadeOut=(canFade&&elapsed>=1500)?Math.min((elapsed-1500)/500,1):0;
    if(fadeOut>0){
      var op=1-fadeOut;
      splash.style.opacity=op;
      if(gridEl)gridEl.style.opacity=0.15*op;
    }

    // Stop when fully faded
    if(fadeOut>=1){
      splash.remove();
      return;
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();