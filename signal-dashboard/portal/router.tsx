import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
const base=()=>document.getElementById('signal-root')?.dataset.base?.replace(/\/$/,'')||'';
const current=()=>window.location.pathname.slice(base().length).replace(/\/$/,'')||'/';
const Context=createContext({path:'/',navigate:(_href:string)=>{}});
export function Router({children}:{children:ReactNode}){
 const [path,setPath]=useState(current);
 useEffect(()=>{const update=()=>setPath(current());window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update)},[]);
 return <Context.Provider value={{path,navigate:href=>{history.pushState(null,'',base()+href);setPath(current());window.scrollTo(0,0)}}}>{children}</Context.Provider>;
}
export function usePathname(){return useContext(Context).path;}
export default function Link({href,children,onClick,...props}:Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'>&{href:string}){
 const {navigate}=useContext(Context);
 return <a {...props} href={base()+href} onClick={event=>{onClick?.(event);if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||props.target==='_blank')return;event.preventDefault();navigate(href)}}>{children}</a>;
}
