import{c as m,u as v,e as g,Q as S,f as h,g as u,i as y}from"./dom-ULL9VdJn.js";import{c as f,h as s}from"./index-9R13QD6u.js";const q=m({name:"QAvatar",props:{...v,fontSize:String,color:String,textColor:String,icon:String,square:Boolean,rounded:Boolean},setup(e,{slots:o}){const t=g(e),n=f(()=>"q-avatar"+(e.color?` bg-${e.color}`:"")+(e.textColor?` text-${e.textColor} q-chip--colored`:"")+(e.square===!0?" q-avatar--square":e.rounded===!0?" rounded-borders":"")),i=f(()=>e.fontSize?{fontSize:e.fontSize}:null);return()=>{const r=e.icon!==void 0?[s(S,{name:e.icon})]:void 0;return s("div",{class:n.value,style:t.value},[s("div",{class:"q-avatar__content row flex-center overflow-hidden",style:i.value},h(o.default,r))])}}}),b=[null,document,document.body,document.scrollingElement,document.documentElement];function C(e,o){let t=y(o);if(t===void 0){if(e==null)return window;t=e.closest(".scroll,.scroll-y,.overflow-auto")}return b.includes(t)?window:t}function E(e){return(e===window?document.body:e).scrollHeight}function x(e){return e===window?window.pageYOffset||window.scrollY||document.body.scrollTop||0:e.scrollTop}function P(e){return e===window?window.pageXOffset||window.scrollX||document.body.scrollLeft||0:e.scrollLeft}function w(e,o,t=0){const n=arguments[3]===void 0?performance.now():arguments[3],i=x(e);if(t<=0){i!==o&&d(e,o);return}requestAnimationFrame(r=>{const c=r-n,a=i+(o-i)/Math.max(c,t)*c;d(e,a),a!==o&&w(e,o,t-c,r)})}function d(e,o){if(e===window){window.scrollTo(window.pageXOffset||window.scrollX||document.body.scrollLeft||0,o);return}e.scrollTop=o}function Q(e,o,t){if(t){w(e,o,t);return}d(e,o)}let l;function T(){if(l!==void 0)return l;const e=document.createElement("p"),o=document.createElement("div");u(e,{width:"100%",height:"200px"}),u(o,{position:"absolute",top:"0px",left:"0px",visibility:"hidden",width:"200px",height:"150px",overflow:"hidden"}),o.appendChild(e),document.body.appendChild(o);const t=e.offsetWidth;o.style.overflow="scroll";let n=e.offsetWidth;return t===n&&(n=o.clientWidth),o.remove(),l=t-n,l}export{q as Q,x as a,P as b,T as c,E as d,C as g,Q as s};
