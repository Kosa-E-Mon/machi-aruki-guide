(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CertificateState=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 class State{constructor(){this.busy=false;this.requested=false;this.confirmed=false;this.dismissed=false;this.message='未保存';}begin(){if(this.busy)return false;this.busy=true;return true;}requestedSave(){this.busy=false;this.requested=true;this.message='保存要求済み・端末保存は未確認';}fail(message){this.busy=false;this.message=message;}confirm(){if(this.busy||!this.requested)return false;this.confirmed=true;return true;}needsGuard(){return this.busy||(!this.confirmed&&!this.dismissed);}}
 return {State};
});
