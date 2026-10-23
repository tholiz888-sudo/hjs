import {defineConfig} from 'vite';
export default defineConfig({server:{host:'0.0.0.0',port:5173,strictPort:true,proxy:{'/garden/view':{target:'http://127.0.0.1:3020'},'/api':{target:'http://127.0.0.1:3020'}}},build:{target:'es2022'}});
