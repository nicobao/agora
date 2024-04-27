import{c as i,g as E,p as I,a0 as T,a1 as K,$ as j,a2 as D}from"./index-9R13QD6u.js";import{k as M,g as B}from"./dom-ULL9VdJn.js";function V(e){return e.appContext.config.globalProperties.$router!==void 0}function F(e){return e.isUnmounted===!0||e.isDeactivated===!0}function L(e){return e?e.aliasOf?e.aliasOf.path:e.path:""}function O(e,r){return(e.aliasOf||e)===(r.aliasOf||r)}function N(e,r){for(const a in r){const t=r[a],n=e[a];if(typeof t=="string"){if(t!==n)return!1}else if(Array.isArray(n)===!1||n.length!==t.length||t.some((c,u)=>c!==n[u]))return!1}return!0}function P(e,r){return Array.isArray(r)===!0?e.length===r.length&&e.every((a,t)=>a===r[t]):e.length===1&&e[0]===r}function H(e,r){return Array.isArray(e)===!0?P(e,r):Array.isArray(r)===!0?P(r,e):e===r}function U(e,r){if(Object.keys(e).length!==Object.keys(r).length)return!1;for(const a in e)if(H(e[a],r[a])===!1)return!1;return!0}const G={to:[String,Object],replace:Boolean,exact:Boolean,activeClass:{type:String,default:"q-router-link--active"},exactActiveClass:{type:String,default:"q-router-link--exact-active"},href:String,target:String,disable:Boolean};function J({fallbackTag:e,useDisableForRouterLinkProps:r=!0}={}){const a=E(),{props:t,proxy:n,emit:c}=a,u=V(a),o=i(()=>t.disable!==!0&&t.href!==void 0),q=r===!0?i(()=>u===!0&&t.disable!==!0&&o.value!==!0&&t.to!==void 0&&t.to!==null&&t.to!==""):i(()=>u===!0&&o.value!==!0&&t.to!==void 0&&t.to!==null&&t.to!==""),f=i(()=>q.value===!0?A(t.to):null),p=i(()=>f.value!==null),h=i(()=>o.value===!0||p.value===!0),k=i(()=>t.type==="a"||h.value===!0?"a":t.tag||e||"div"),d=i(()=>o.value===!0?{href:t.href,target:t.target}:p.value===!0?{href:f.value.href,target:t.target}:{}),$=i(()=>{if(p.value===!1)return-1;const{matched:s}=f.value,{length:l}=s,v=s[l-1];if(v===void 0)return-1;const m=n.$route.matched;if(m.length===0)return-1;const g=m.findIndex(O.bind(null,v));if(g!==-1)return g;const b=L(s[l-2]);return l>1&&L(v)===b&&m[m.length-1].path!==b?m.findIndex(O.bind(null,s[l-2])):g}),y=i(()=>p.value===!0&&$.value!==-1&&N(n.$route.params,f.value.params)),C=i(()=>y.value===!0&&$.value===n.$route.matched.length-1&&U(n.$route.params,f.value.params)),_=i(()=>p.value===!0?C.value===!0?` ${t.exactActiveClass} ${t.activeClass}`:t.exact===!0?"":y.value===!0?` ${t.activeClass}`:"":"");function A(s){try{return n.$router.resolve(s)}catch{}return null}function x(s,{returnRouterError:l,to:v=t.to,replace:m=t.replace}={}){if(t.disable===!0)return s.preventDefault(),Promise.resolve(!1);if(s.metaKey||s.altKey||s.ctrlKey||s.shiftKey||s.button!==void 0&&s.button!==0||t.target==="_blank")return Promise.resolve(!1);s.preventDefault();const g=n.$router[m===!0?"replace":"push"](v);return l===!0?g:g.then(()=>{}).catch(()=>{})}function R(s){if(p.value===!0){const l=v=>x(s,v);c("click",s,l),s.defaultPrevented!==!0&&l()}else c("click",s)}return{hasRouterLink:p,hasHrefLink:o,hasLink:h,linkTag:k,resolvedLink:f,linkIsActive:y,linkIsExactActive:C,linkClass:_,linkAttrs:d,getLink:A,navigateToRouterLink:x,navigateOnClick:R}}function X(e,r=250){let a=!1,t;return function(){return a===!1&&(a=!0,setTimeout(()=>{a=!1},r),t=e.apply(this,arguments)),t}}function S(e,r,a,t){a.modifiers.stop===!0&&j(e);const n=a.modifiers.color;let c=a.modifiers.center;c=c===!0||t===!0;const u=document.createElement("span"),o=document.createElement("span"),q=D(e),{left:f,top:p,width:h,height:k}=r.getBoundingClientRect(),d=Math.sqrt(h*h+k*k),$=d/2,y=`${(h-d)/2}px`,C=c?y:`${q.left-f-$}px`,_=`${(k-d)/2}px`,A=c?_:`${q.top-p-$}px`;o.className="q-ripple__inner",B(o,{height:`${d}px`,width:`${d}px`,transform:`translate3d(${C},${A},0) scale3d(.2,.2,1)`,opacity:0}),u.className=`q-ripple${n?" text-"+n:""}`,u.setAttribute("dir","ltr"),u.appendChild(o),r.appendChild(u);const x=()=>{u.remove(),clearTimeout(R)};a.abort.push(x);let R=setTimeout(()=>{o.classList.add("q-ripple__inner--enter"),o.style.transform=`translate3d(${y},${_},0) scale3d(1,1,1)`,o.style.opacity=.2,R=setTimeout(()=>{o.classList.remove("q-ripple__inner--enter"),o.classList.add("q-ripple__inner--leave"),o.style.opacity=0,R=setTimeout(()=>{u.remove(),a.abort.splice(a.abort.indexOf(x),1)},275)},250)},50)}function w(e,{modifiers:r,value:a,arg:t}){const n=Object.assign({},e.cfg.ripple,r,a);e.modifiers={early:n.early===!0,stop:n.stop===!0,center:n.center===!0,color:n.color||t,keyCodes:[].concat(n.keyCodes||13)}}const Q=M({name:"ripple",beforeMount(e,r){const a=r.instance.$.appContext.config.globalProperties.$q.config||{};if(a.ripple===!1)return;const t={cfg:a,enabled:r.value!==!1,modifiers:{},abort:[],start(n){t.enabled===!0&&n.qSkipRipple!==!0&&n.type===(t.modifiers.early===!0?"pointerdown":"click")&&S(n,e,t,n.qKeyEvent===!0)},keystart:X(n=>{t.enabled===!0&&n.qSkipRipple!==!0&&I(n,t.modifiers.keyCodes)===!0&&n.type===`key${t.modifiers.early===!0?"down":"up"}`&&S(n,e,t,!0)},300)};w(t,r),e.__qripple=t,T(t,"main",[[e,"pointerdown","start","passive"],[e,"click","start","passive"],[e,"keydown","keystart","passive"],[e,"keyup","keystart","passive"]])},updated(e,r){if(r.oldValue!==r.value){const a=e.__qripple;a!==void 0&&(a.enabled=r.value!==!1,a.enabled===!0&&Object(r.value)===r.value&&w(a,r))}},beforeUnmount(e){const r=e.__qripple;r!==void 0&&(r.abort.forEach(a=>{a()}),K(r,"main"),delete e._qripple)}});export{Q as R,J as a,G as u,F as v};
