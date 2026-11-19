/* Das Wallpanel kennt nur noch ein Design (das neue Panel). Keine Netzwerkzugriffe, Gerätebefehle oder Töne. ES5. */
(function(root){'use strict';
 function normalize(){return 'panel';}
 function read(){return 'panel';}
 function store(){try{root.localStorage.setItem('haWallpanel.theme','panel');root.sessionStorage.removeItem('haWallpanel.themePreview');}catch(_){}return 'panel';}
 function targetWindow(){try{if(root.parent!==root&&root.parent.wallpanelShell){return root.parent;}}catch(_){}return root;}
 function go(){store();targetWindow().location.replace('/panel/?_reload='+Date.now());}

 root.WallpanelDesign={normalize:normalize,read:read,store:store,go:go};
}(window));
