/* Runs only inside the editor's isolated, read-only app frame. */
function initEditorAppPreview() {
  const noop=()=>{};
  // No app startup, OAuth, progress, GPS, audio, weather or analytics in this frame.
  trackEvent=recordVisit=refreshWeather=unlockAudio=playVoice=stopVoice=syncCloud=noop;
  fetchHomePosition=callback=>callback(null);
  startGPS=stopGPS=noop;
  window.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
  window.addEventListener('submit',e=>e.preventDefault(),true);
  window.addEventListener('message',e=>{
    if(e.source!==parent||e.data?.type!=='walk-editor-preview-data')return;
    try {
      const d=e.data.data;
      cfg=Object.fromEntries(d.config.map(r=>[r.key,r.value]));
      currentSheetId='editor-preview';
      allCourses=d.courses.map(c=>({...c,recommended:String(c.recommended).toUpperCase()==='TRUE',display_order:parseInt(c.display_order)||99,duration_min:parseInt(c.duration_min)||0,distance_m:parseInt(c.distance_m)||0}));
      allSpots=d.spots.map(s=>({...s,lat:parseFloat(s.lat),lng:parseFloat(s.lng)}));
      allCourseSpots=d.course_spots.map(r=>({...r,order:parseInt(r.order)||99}));
      allFacilities=d.facilities;
      document.documentElement.removeAttribute('style');
      document.querySelectorAll('.home-header-img').forEach(img=>img.remove());
      document.querySelectorAll('.home-badge,.home-title,.home-subtitle,.home-area-name,.home-header-overlay').forEach(el=>el.removeAttribute('style'));
      applyConfig();uiLang=cfg.lang||'ja';localizeStaticDom();
      setHomeTheme(d.theme);
      const course=allCourses.find(c=>c.course_id===d.courseId)||allCourses[0];
      if(d.screen==='intro'&&course)showCourseIntro(course);
      else if(d.screen==='spot'&&course){currentCourse=course;courseSpots=buildCourseSpots(course);currentIdx=Math.max(0,courseSpots.findIndex(s=>s.spot_id===d.spotId));if(courseSpots[currentIdx])showExplain(courseSpots[currentIdx]);else{renderHome();showScreen('screen-home');}}
      else if(d.screen==='certificate'&&course){currentCourse=course;courseSpots=buildCourseSpots(course);totalWalkDist=Number(course.distance_m)||0;showGoal();}
      else{renderHome();showScreen('screen-home');}
      const actual=document.querySelector('.screen.active')?.id;
      parent.postMessage({type:'walk-editor-preview-rendered',screen:d.screen,actual,note:d.screen==='intro'&&actual!=='screen-intro'?'この版では非公開のコースのため、ホームを表示しています。':''},'*');
    }catch(error){parent.postMessage({type:'walk-editor-preview-error',message:error.message},'*');}
  });
  parent.postMessage({type:'walk-editor-preview-ready'},'*');
}
