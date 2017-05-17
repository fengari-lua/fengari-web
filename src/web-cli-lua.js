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

const run_lua_script = function(code, chunkname) {
	let ok = lauxlib.luaL_loadbuffer(L, code, null, chunkname);
	if (ok === lua.LUA_OK) {
		ok = lua.lua_pcall(L, 0, 0, 0); /* TODO: use message handler to add traceback */
	}
	if (ok !== lua.LUA_OK) {
		let msg = lauxlib.luaL_tolstring(L, -1);
		lua.lua_pop(L, 1);
		console.error(lua.to_jsstring(msg));
	}
};

const crossorigin_to_credentials = function(crossorigin) {
	switch(crossorigin) {
		case "anonymous": return "omit";
		case "use-credentials": return "include";
		default: return "same-origin";
	}
};

const run_lua_script_tag = function(tag) {
	if (tag.src) {
		let chunkname = "@"+tag.src;
		/* JS script tags are async after document has loaded */
		if (document.readyState === "complete" || tag.async) {
			fetch(tag.src, {
				method: "GET",
				credentials: crossorigin_to_credentials(tag.crossorigin),
				redirect: "follow",
				integrity: tag.integrity
			}).then(function(resp) {
				if (resp.ok) {
					resp.arrayBuffer().then(function(buffer) {
						let code = Array.from(new Uint8Array(buffer));
						run_lua_script(code, lua.to_luastring(chunkname));
					});
				}
			});
		} else {
			/* Needs to be synchronous: use an XHR */
			let xhr = new XMLHttpRequest();
			xhr.open("GET", tag.src, false);
			xhr.send();
			let code = xhr.response;
			/* TODO: subresource integrity check? */
			run_lua_script(lua.to_luastring(code), lua.to_luastring(chunkname));
		}
	} else {
		let code = tag.innerHTML;
		let chunkname = tag.id ? ("="+tag.id) : code;
		run_lua_script(lua.to_luastring(code), lua.to_luastring(chunkname));
	}
};

/* watch for new <script type="text/lua"> tags added to document */
(new MutationObserver(function(records, observer) {
    for (let r=0; r<records.length; r++) {
        for (let i=0; i<records[r].addedNodes.length; i++) {
            let tag = records[r].addedNodes[i];
            if (tag.tagName == "SCRIPT" && tag.type == "text/lua") {
                run_lua_script_tag(tag);
            }
        }
    }
})).observe(document, {
    childList: true,
    subtree: true
});

/* run existing <script type="text/lua"> tags */
Array.prototype.forEach.call(document.querySelectorAll('script[type=\"text\/lua\"]'), run_lua_script_tag);
