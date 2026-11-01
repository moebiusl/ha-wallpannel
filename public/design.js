/* Shared design routing. No network requests, device commands or audio. ES5. */
(function(root){'use strict';
 function normalize(v){if(v==='apartment'){v='home';}return ['classic','home','panel'].indexOf(v)>=0?v:'classic';}
 function read(){try{return normalize(root.localStorage.getItem('haWallpanel.theme'));}catch(_){return 'classic';}}
 function store(v){v=normalize(v);try{root.localStorage.setItem('haWallpanel.theme',v);root.sessionStorage.removeItem('haWallpanel.themePreview');}catch(_){}return v;}
 function targetWindow(){try{if(root.parent!==root&&root.parent.wallpanelShell){return root.parent;}}catch(_){}return root;}
 function go(v){v=store(v);var target=targetWindow(),url=v==='panel'?'/panel/':'/start.html';target.location.replace(url+'?_reload='+Date.now());}
 function options(){return '<option value="classic">Klassisch</option><option value="home">Apple</option><option value="panel">Neues Wallpanel</option>';}

 root.WallpanelDesign={normalize:normalize,read:read,store:store,go:go,options:options};
}(window));
