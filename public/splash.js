// Splash screen — JS only removes the DOM element after CSS animation completes.
// All visual animations are driven by CSS @keyframes + SVG animateTransform.
(function(){
  var splash=document.getElementById('splash');
  if(!splash)return;
  function removeSplash(){
    var el=document.getElementById('splash');
    if(el)el.remove();
  }
  splash.addEventListener('animationend',function(e){
    if(e.animationName==='splash-fade-out')removeSplash();
  });
  setTimeout(removeSplash,3000);
})();