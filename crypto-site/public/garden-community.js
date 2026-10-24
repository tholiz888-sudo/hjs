// Account forms, messages and pagination are rendered by the server and work without fetch or JavaScript.
(()=>{if(location.hash==='#compose'){const form=document.querySelector('#compose:not([hidden])')||document.getElementById('account');form?.scrollIntoView({block:'start'})}})();
