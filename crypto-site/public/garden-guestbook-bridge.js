(()=>{const target=document.body.dataset.gardenCommunity;
function compose(){if(!target)return;if(window.parent!==window)window.parent.postMessage({gardenAction:'compose'},'*');else window.location.href=target}
document.addEventListener('click',event=>{if(event.target.closest('[data-garden-compose]')){event.preventDefault();compose()}});
if(['#nicheng','#compose'].includes(location.hash))compose();addEventListener('hashchange',()=>{if(['#nicheng','#compose'].includes(location.hash))compose()});
const frame=document.querySelector('iframe[title="秘密花园"]');if(frame&&target)addEventListener('message',event=>{if(event.source===frame.contentWindow&&event.data?.gardenAction==='compose')location.href=target});})();
