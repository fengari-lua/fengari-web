/*jshint esversion: 6 */
"use strict";

window.WEB = true;

const fengari  = require('fengari');
const lua      = fengari.lua;
const lauxlib  = fengari.lauxlib;
const lualib   = fengari.lualib;
const interop  = require('fengari-interop');

const L = lauxlib.luaL_newstate();

/* open standard libraries */
lualib.luaL_openlibs(L);
lauxlib.luaL_requiref(L, lua.to_luastring("js"), interop.luaopen_js, 1);
lua.lua_pop(L, 1); /* remove lib */

lua.lua_pushstring(L, lua.to_luastring(lua.FENGARI_COPYRIGHT));
lua.lua_setglobal(L, lua.to_luastring("_COPYRIGHT"));

let tag = document.getElementById("cli.lua");
let code = tag.innerHTML;
let chunkname = tag.src ? ("@"+tag.src) : tag.id ? ("="+tag.id) : code;
let ok = lauxlib.luaL_loadbuffer(L, lua.to_luastring(code), null, lua.to_luastring(chunkname));
if (ok !== lua.LUA_OK) {
	let msg = lua.lua_tojsstring(L, -1);
	lua.lua_pop(L, 1);
	throw Error(msg);
}
lua.lua_call(L, 0, 0, 0);
