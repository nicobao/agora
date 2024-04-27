import{c as u,h as r,r as z,l as J,m as U,g as X,n as f,Y,z as Z,p as M,Z as p,$ as ee,d as te,J as ne,P as ae,M as R,f as le,_ as ue}from"./index-9R13QD6u.js";import{j as N,c as A,u as ie,e as re,Q as O,a as oe}from"./dom-ULL9VdJn.js";import{u as se,a as ce,R as de}from"./Ripple-8436jrgd.js";const ve={size:{type:[Number,String],default:"1em"},color:String};function fe(e){return{cSize:u(()=>e.size in N?`${N[e.size]}px`:e.size),classes:u(()=>"q-spinner"+(e.color?` text-${e.color}`:""))}}const be=A({name:"QSpinner",props:{...ve,thickness:{type:Number,default:5}},setup(e){const{cSize:i,classes:c}=fe(e);return()=>r("svg",{class:c.value+" q-spinner-mat",width:i.value,height:i.value,viewBox:"25 25 50 50"},[r("circle",{class:"path",cx:"50",cy:"50",r:"20",fill:"none",stroke:"currentColor","stroke-width":e.thickness,"stroke-miterlimit":"10"})])}}),K={left:"start",center:"center",right:"end",between:"between",around:"around",evenly:"evenly",stretch:"stretch"},ge=Object.keys(K),me={align:{type:String,validator:e=>ge.includes(e)}};function he(e){return u(()=>{const i=e.align===void 0?e.vertical===!0?"stretch":"left":e.align;return`${e.vertical===!0?"items":"justify"}-${K[i]}`})}const j={none:0,xs:4,sm:8,md:16,lg:24,xl:32},ye={xs:8,sm:10,md:14,lg:20,xl:24},ke=["button","submit","reset"],xe=/[^\s]\/[^\s]/,qe=["flat","outline","push","unelevated"],Ee=(e,i)=>e.flat===!0?"flat":e.outline===!0?"outline":e.push===!0?"push":e.unelevated===!0?"unelevated":i,_e={...ie,...se,type:{type:String,default:"button"},label:[Number,String],icon:String,iconRight:String,...qe.reduce((e,i)=>(e[i]=Boolean)&&e,{}),square:Boolean,round:Boolean,rounded:Boolean,glossy:Boolean,size:String,fab:Boolean,fabMini:Boolean,padding:String,color:String,textColor:String,noCaps:Boolean,noWrap:Boolean,dense:Boolean,tabindex:[Number,String],ripple:{type:[Boolean,Object],default:!0},align:{...me.align,default:"center"},stack:Boolean,stretch:Boolean,loading:{type:Boolean,default:null},disable:Boolean};function Be(e){const i=re(e,ye),c=he(e),{hasRouterLink:q,hasLink:E,linkTag:_,linkAttrs:L,navigateOnClick:w}=ce({fallbackTag:"button"}),C=u(()=>{const a=e.fab===!1&&e.fabMini===!1?i.value:{};return e.padding!==void 0?Object.assign({},a,{padding:e.padding.split(/\s+/).map(v=>v in j?j[v]+"px":v).join(" "),minWidth:"0",minHeight:"0"}):a}),T=u(()=>e.rounded===!0||e.fab===!0||e.fabMini===!0),h=u(()=>e.disable!==!0&&e.loading!==!0),P=u(()=>h.value===!0?e.tabindex||0:-1),n=u(()=>Ee(e,"standard")),B=u(()=>{const a={tabindex:P.value};return E.value===!0?Object.assign(a,L.value):ke.includes(e.type)===!0&&(a.type=e.type),_.value==="a"?(e.disable===!0?a["aria-disabled"]="true":a.href===void 0&&(a.role="button"),q.value!==!0&&xe.test(e.type)===!0&&(a.type=e.type)):e.disable===!0&&(a.disabled="",a["aria-disabled"]="true"),e.loading===!0&&e.percentage!==void 0&&Object.assign(a,{role:"progressbar","aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":e.percentage}),a}),d=u(()=>{let a;e.color!==void 0?e.flat===!0||e.outline===!0?a=`text-${e.textColor||e.color}`:a=`bg-${e.color} text-${e.textColor||"white"}`:e.textColor&&(a=`text-${e.textColor}`);const v=e.round===!0?"round":`rectangle${T.value===!0?" q-btn--rounded":e.square===!0?" q-btn--square":""}`;return`q-btn--${n.value} q-btn--${v}`+(a!==void 0?" "+a:"")+(h.value===!0?" q-btn--actionable q-focusable q-hoverable":e.disable===!0?" disabled":"")+(e.fab===!0?" q-btn--fab":e.fabMini===!0?" q-btn--fab-mini":"")+(e.noCaps===!0?" q-btn--no-uppercase":"")+(e.dense===!0?" q-btn--dense":"")+(e.stretch===!0?" no-border-radius self-stretch":"")+(e.glossy===!0?" glossy":"")+(e.square?" q-btn--square":"")}),y=u(()=>c.value+(e.stack===!0?" column":" row")+(e.noWrap===!0?" no-wrap text-no-wrap":"")+(e.loading===!0?" q-btn__content--hidden":""));return{classes:d,style:C,innerClasses:y,attributes:B,hasLink:E,linkTag:_,navigateOnClick:w,isActionable:h}}const{passiveCapture:o}=Z;let b=null,g=null,m=null;const Se=A({name:"QBtn",props:{..._e,percentage:Number,darkPercentage:Boolean,onTouchstart:[Function,Array]},emits:["click","keydown","mousedown","keyup"],setup(e,{slots:i,emit:c}){const{proxy:q}=X(),{classes:E,style:_,innerClasses:L,attributes:w,hasLink:C,linkTag:T,navigateOnClick:h,isActionable:P}=Be(e),n=z(null),B=z(null);let d=null,y,a=null;const v=u(()=>e.label!==void 0&&e.label!==null&&e.label!==""),Q=u(()=>e.disable===!0||e.ripple===!1?!1:{keyCodes:C.value===!0?[13,32]:[13],...e.ripple===!0?{}:e.ripple}),F=u(()=>({center:e.round})),D=u(()=>{const t=Math.max(0,Math.min(100,e.percentage));return t>0?{transition:"transform 0.6s",transform:`translateX(${t-100}%)`}:{}}),I=u(()=>{if(e.loading===!0)return{onMousedown:x,onTouchstart:x,onClick:x,onKeydown:x,onKeyup:x};if(P.value===!0){const t={onClick:$,onKeydown:W,onMousedown:G};if(q.$q.platform.has.touch===!0){const l=e.onTouchstart!==void 0?"":"Passive";t[`onTouchstart${l}`]=H}return t}return{onClick:f}}),V=u(()=>({ref:n,class:"q-btn q-btn-item non-selectable no-outline "+E.value,style:_.value,...w.value,...I.value}));function $(t){if(n.value!==null){if(t!==void 0){if(t.defaultPrevented===!0)return;const l=document.activeElement;if(e.type==="submit"&&l!==document.body&&n.value.contains(l)===!1&&l.contains(n.value)===!1){n.value.focus();const S=()=>{document.removeEventListener("keydown",f,!0),document.removeEventListener("keyup",S,o),n.value!==null&&n.value.removeEventListener("blur",S,o)};document.addEventListener("keydown",f,!0),document.addEventListener("keyup",S,o),n.value.addEventListener("blur",S,o)}}h(t)}}function W(t){n.value!==null&&(c("keydown",t),M(t,[13,32])===!0&&g!==n.value&&(g!==null&&k(),t.defaultPrevented!==!0&&(n.value.focus(),g=n.value,n.value.classList.add("q-btn--active"),document.addEventListener("keyup",s,!0),n.value.addEventListener("blur",s,o)),f(t)))}function H(t){n.value!==null&&(c("touchstart",t),t.defaultPrevented!==!0&&(b!==n.value&&(b!==null&&k(),b=n.value,d=t.target,d.addEventListener("touchcancel",s,o),d.addEventListener("touchend",s,o)),y=!0,a!==null&&clearTimeout(a),a=setTimeout(()=>{a=null,y=!1},200)))}function G(t){n.value!==null&&(t.qSkipRipple=y===!0,c("mousedown",t),t.defaultPrevented!==!0&&m!==n.value&&(m!==null&&k(),m=n.value,n.value.classList.add("q-btn--active"),document.addEventListener("mouseup",s,o)))}function s(t){if(n.value!==null&&!(t!==void 0&&t.type==="blur"&&document.activeElement===n.value)){if(t!==void 0&&t.type==="keyup"){if(g===n.value&&M(t,[13,32])===!0){const l=new MouseEvent("click",t);l.qKeyEvent=!0,t.defaultPrevented===!0&&p(l),t.cancelBubble===!0&&ee(l),n.value.dispatchEvent(l),f(t),t.qKeyEvent=!0}c("keyup",t)}k()}}function k(t){const l=B.value;t!==!0&&(b===n.value||m===n.value)&&l!==null&&l!==document.activeElement&&(l.setAttribute("tabindex",-1),l.focus()),b===n.value&&(d!==null&&(d.removeEventListener("touchcancel",s,o),d.removeEventListener("touchend",s,o)),b=d=null),m===n.value&&(document.removeEventListener("mouseup",s,o),m=null),g===n.value&&(document.removeEventListener("keyup",s,!0),n.value!==null&&n.value.removeEventListener("blur",s,o),g=null),n.value!==null&&n.value.classList.remove("q-btn--active")}function x(t){f(t),t.qSkipRipple=!0}return J(()=>{k(!0)}),Object.assign(q,{click:$}),()=>{let t=[];e.icon!==void 0&&t.push(r(O,{name:e.icon,left:e.stack!==!0&&v.value===!0,role:"img","aria-hidden":"true"})),v.value===!0&&t.push(r("span",{class:"block"},[e.label])),t=oe(i.default,t),e.iconRight!==void 0&&e.round===!1&&t.push(r(O,{name:e.iconRight,right:e.stack!==!0&&v.value===!0,role:"img","aria-hidden":"true"}));const l=[r("span",{class:"q-focus-helper",ref:B})];return e.loading===!0&&e.percentage!==void 0&&l.push(r("span",{class:"q-btn__progress absolute-full overflow-hidden"+(e.darkPercentage===!0?" q-btn__progress--dark":"")},[r("span",{class:"q-btn__progress-indicator fit block",style:D.value})])),l.push(r("span",{class:"q-btn__content text-center col items-center q-anchor--skip "+L.value},t)),e.loading!==null&&l.push(r(Y,{name:"q-transition--fade"},()=>e.loading===!0?[r("span",{key:"loading",class:"absolute-full flex flex-center"},i.loading!==void 0?i.loading():[r(be)])]:null)),U(r(T.value,V.value,l),[[de,Q.value,void 0,F.value]])}}}),Le={class:"fullscreen bg-blue text-white text-center q-pa-md flex flex-center"},we=R("div",{style:{"font-size":"30vh"}},"404",-1),Ce=R("div",{class:"text-h2",style:{opacity:"0.4"}}," Oops. Nothing here... ",-1),Te=te({name:"ErrorNotFound",__name:"ErrorNotFound",setup(e){return(i,c)=>(ne(),ae("div",Le,[R("div",null,[we,Ce,le(Se,{class:"q-mt-xl",color:"white","text-color":"blue",unelevated:"",to:"/",label:"Go Home","no-caps":""})])]))}}),ze=ue(Te,[["__file","ErrorNotFound.vue"]]);export{ze as default};
