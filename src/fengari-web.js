"use strict";

import {lua, lauxlib, lualib} from 'fengari';
import * as interop from 'fengari-interop';

export {
	lua,
	lauxlib,
	lualib,
	interop
};
export const L = lauxlib.luaL_newstate();

/* open standard libraries */
lualib.luaL_openlibs(L);
lauxlib.luaL_requiref(L, lua.to_luastring("js"), interop.luaopen_js, 1);
lua.lua_pop(L, 1); /* remove lib */

lua.lua_pushstring(L, lua.to_luastring(lua.FENGARI_COPYRIGHT));
lua.lua_setglobal(L, lua.to_luastring("_COPYRIGHT"));

/* Helper function to load a JS string of Lua source */
export function load(source, chunkname) {
	if (typeof source == "string")
		source = lua.to_luastring(source);
	else if (!Array.isArray(source))
		throw TypeError("expected string or array of bytes");


	chunkname = chunkname?lua.to_luastring(chunkname):null;
	let ok = lauxlib.luaL_loadbuffer(L, source, null, chunkname);
	let res;
	if (ok === lua.LUA_ERRSYNTAX) {
		res = new SyntaxError(lua.lua_tojsstring(L, -1));
	} else {
		res = interop.tojs(L, -1);
	}
	lua.lua_pop(L, 1);
	if (ok !== lua.LUA_OK) {
		throw res;
	}
	return res;
}

/* global WorkerGlobalScope */ /* see https://github.com/sindresorhus/globals/issues/127 */
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
	/* in a web worker */
} else {
	const crossorigin_to_credentials = function(crossorigin) {
		switch(crossorigin) {
			case "anonymous": return "omit";
			case "use-credentials": return "include";
			default: return "same-origin";
		}
	};

	const msghandler = function(L) {
		let ar = new lua.lua_Debug();
		if (lua.lua_getstack(L, 2, ar))
			lua.lua_getinfo(L, lua.to_luastring("Sl"), ar);
		interop.push(L, new ErrorEvent("error", {
			bubbles: true,
			cancelable: true,
			message: lua.lua_tojsstring(L, 1),
			error: interop.tojs(L, 1),
			filename: ar.short_src ? lua.to_jsstring(ar.short_src) : void 0,
			lineno: ar.currentline > 0 ? ar.currentline : void 0
		}));
		return 1;
	};

	const run_lua_script = function(tag, code, chunkname) {
		let ok = lauxlib.luaL_loadbuffer(L, code, null, chunkname);
		let e;
		if (ok === lua.LUA_ERRSYNTAX) {
			let msg = lua.lua_tojsstring(L, -1);
			let filename = tag.src?tag.src:document.location;
			let lineno = void 0; /* TODO: extract out of msg */
			let syntaxerror = new SyntaxError(msg, filename, lineno);
			e = new ErrorEvent("error", {
				message: msg,
				error: syntaxerror,
				filename: filename,
				lineno: lineno
			});
		} else if (ok === lua.LUA_OK) {
			/* insert message handler below function */
			let base = lua.lua_gettop(L);
			lua.lua_pushcfunction(L, msghandler);
			lua.lua_insert(L, base);
			/* set document.currentScript.
			   We can't set it normally; but we can create a getter for it, then remove the getter */
			Object.defineProperty(document, 'currentScript', {
				value: tag,
				configurable: true
			});
			ok = lua.lua_pcall(L, 0, 0, base);
			/* Remove the currentScript getter installed above; this restores normal behaviour */
			delete document.currentScript;
			/* Remove message handler */
			lua.lua_remove(L, base);
			/* Check if normal error that msghandler would have handled */
			if (ok === lua.LUA_ERRRUN) {
				e = interop.checkjs(L, -1);
			}
		}
		if (ok !== lua.LUA_OK) {
			if (e === void 0) {
				e = new ErrorEvent("error", {
					message: lua.lua_tojstring(L, -1),
					error: interop.tojs(L, -1)
				});
			}
			lua.lua_pop(L, 1);
			if (window.dispatchEvent(e)) {
				console.error("uncaught exception", e.error);
			}
		}
	};

	const process_xhr_response = function(xhr, tag, chunkname) {
		if (xhr.status >= 200 && xhr.status < 300) {
			let code = xhr.response;
			if (typeof code === "string") {
				code = lua.to_luastring(xhr.response);
			} else { /* is an array buffer */
				code = new Uint8Array(code);
			}
			/* TODO: subresource integrity check? */
			run_lua_script(tag, code, chunkname);
		} else {
			tag.dispatchEvent(new Event("error"));
		}
	};

	/* in main browser window */
	const run_lua_script_tag = function(tag) {
		if (tag.src) {
			let chunkname = lua.to_luastring("@"+tag.src);
			/* JS script tags are async after document has loaded */
			if (document.readyState === "complete" || tag.async) {
				if (typeof fetch === "function") {
					fetch(tag.src, {
						method: "GET",
						credentials: crossorigin_to_credentials(tag.crossorigin),
						redirect: "follow",
						integrity: tag.integrity
					}).then(function(resp) {
						if (resp.ok) {
							return resp.arrayBuffer();
						} else {
							throw "unable to fetch";
						}
					}).then(function(buffer) {
						let code = new Uint8Array(buffer);
						run_lua_script(tag, code, chunkname);
					}).catch(function(reason) {
						tag.dispatchEvent(new Event("error"));
					});
				} else {
					let xhr = new XMLHttpRequest();
					xhr.open("GET", tag.src, true);
					xhr.responseType = "arraybuffer";
					xhr.onreadystatechange = function() {
						if (xhr.readyState === 4)
							process_xhr_response(xhr, tag, chunkname);
					};
					xhr.send();
				}
			} else {
				/* Needs to be synchronous: use an XHR */
				let xhr = new XMLHttpRequest();
				xhr.open("GET", tag.src, false);
				xhr.send();
				process_xhr_response(xhr, tag, chunkname);
			}
		} else {
			let code = lua.to_luastring(tag.innerHTML);
			let chunkname = tag.id ? lua.to_luastring("="+tag.id) : code;
			run_lua_script(tag, code, chunkname);
		}
	};

	const contentTypeRegexp = /^(.*?\/.*?)([\t ]*;.*)?$/;
	const try_tag = function(tag) {
		if (tag.tagName !== "SCRIPT")
			return;

		/* strip off mime type parameters */
		const contentTypeMatch = contentTypeRegexp.exec(tag.type);
		if (contentTypeMatch) {
			const mimetype = contentTypeMatch[1];
			if (mimetype === "application/lua" || mimetype === "text/lua") {
				run_lua_script_tag(tag);
			}
		}
	};

	/* watch for new script tags added to document */
	(new MutationObserver(function(records, observer) {
		for (let i=0; i<records.length; i++) {
			let record = records[i];
			for (let j=0; j<record.addedNodes.length; j++) {
				try_tag(record.addedNodes[j]);
			}
		}
	})).observe(document, {
		childList: true,
		subtree: true
	});

	/* the query selector here is slightly liberal,
	   more checks occur in try_tag */
	const selector = 'script[type^="application/lua"] script[type^="text/lua"]';

	/* try to run existing script tags */
	Array.prototype.forEach.call(document.querySelectorAll(selector), try_tag);
}
