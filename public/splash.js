// Splash screen animation — CSS-driven with font-aware fade-out timing
// CSS @keyframes handle all visual animations on the compositor thread,
// so they continue running even when the main thread is blocked by module parsing.
(function(){
  // Pre-compute full cam profile points (set immediately, CSS animates reveal)
  var cx=100,cy=100,r0=55,h=20,n=120;
  var pts=[];
  for(var i=0;i<=n;i++){var a=(i/n)*2*Math.PI,s=h*(0.5-0.5*Math.cos(a)),r=r0+s;pts.push([cx+r*Math.sin(a),cy-r*Math.cos(a)]);}

  var p=document.getElementById('splash-cam-path');
  var splash=document.getElementById('splash');
  if(!p||!splash)return;

  // Set full path immediately — CSS stroke-dashoffset animation reveals it
  var d='';
  for(var i=0;i<=n;i++){d+=(i===0?'M ':'L ')+pts[i][0].toFixed(2)+' '+pts[i][1].toFixed(2)+' ';}
  d+='Z';
  p.setAttribute('d',d);

  // Font-aware fade-out: if Material Symbols loads fast, fade-out at CSS timing (1.5s).
  // If font is slow, fade-out at 2.0s via max-timeout.
  // Remove splash when fade-out animation completes.
  var fontReady=false;
  if(document.fonts&&document.fonts.load){
    document.fonts.load('20px Material Symbols Outlined').then(function(){fontReady=true;});
  }else{fontReady=true;}

  // After CSS animation period (~2.0s), remove splash element
  var t0=Date.now();
  function cleanup(){
    var elapsed=Date.now()-t0;
    // Wait until fonts are ready or 2.2s have passed (allow fade-out to complete)
    if(fontReady||elapsed>=2200){
      var el=document.getElementById('splash');
      if(el)el.remove();
      return;
    }
    setTimeout(cleanup,100);
  }
  setTimeout(cleanup,2000);
})();
