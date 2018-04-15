"use strict";

import {
	FENGARI_AUTHORS,
	FENGARI_COPYRIGHT,
	FENGARI_RELEASE,
	FENGARI_VERSION,
	FENGARI_VERSION_MAJOR,
	FENGARI_VERSION_MINOR,
	FENGARI_VERSION_NUM,
	FENGARI_VERSION_RELEASE,

	luastring_eq,
	luastring_indexOf,
	luastring_of,
	to_jsstring,
	to_luastring,
	to_uristring,

	lua,
	lauxlib,
	lualib
} from 'fengari';
import * as interop from 'fengari-interop';

const {
	LUA_ERRRUN,
	LUA_ERRSYNTAX,
	LUA_OK,
	LUA_VERSION_MAJOR,
	LUA_VERSION_MINOR,
	lua_Debug,
	lua_getinfo,
	lua_getstack,
	lua_gettop,
	lua_insert,
	lua_pcall,
	lua_pop,
	lua_pushcfunction,
	lua_pushstring,
	lua_remove,
	lua_setglobal,
	lua_tojsstring
} = lua;
const {
	luaL_loadbuffer,
	luaL_newstate,
	luaL_requiref
} = lauxlib;
const {
	checkjs,
	luaopen_js,
	push,
	tojs
} = interop;

export {
	FENGARI_AUTHORS,
	FENGARI_COPYRIGHT,
	FENGARI_RELEASE,
	FENGARI_VERSION,
	FENGARI_VERSION_MAJOR,
	FENGARI_VERSION_MINOR,
	FENGARI_VERSION_NUM,
	FENGARI_VERSION_RELEASE,

	luastring_eq,
	luastring_indexOf,
	luastring_of,
	to_jsstring,
	to_luastring,
	to_uristring,

	lua,
	lauxlib,
	lualib,
	interop
};

export const L = luaL_newstate();

/* open standard libraries */
lualib.luaL_openlibs(L);
luaL_requiref(L, to_luastring("js"), luaopen_js, 1);
lua_pop(L, 1); /* remove lib */

lua_pushstring(L, to_luastring(FENGARI_COPYRIGHT));
lua_setglobal(L, to_luastring("_COPYRIGHT"));

/* Helper function to load a JS string of Lua source */
export function load(source, chunkname) {
	if (typeof source == "string")
		source = to_luastring(source);
	else if (!(source instanceof Uint8Array))
		throw new TypeError("expects an array of bytes or javascript string");

	chunkname = chunkname?to_luastring(chunkname):null;
	let ok = luaL_loadbuffer(L, source, null, chunkname);
	let res;
	if (ok === LUA_ERRSYNTAX) {
		res = new SyntaxError(lua_tojsstring(L, -1));
	} else {
		res = tojs(L, -1);
	}
	lua_pop(L, 1);
	if (ok !== LUA_OK) {
		throw res;
	}
	return res;
}

if (typeof document !== 'undefined' && document instanceof HTMLDocument) {
	/* Have a document, e.g. we are in main browser window */

	const crossorigin_to_credentials = function(crossorigin) {
		switch(crossorigin) {
			case "anonymous": return "omit";
			case "use-credentials": return "include";
			default: return "same-origin";
		}
	};

	const msghandler = function(L) {
		let ar = new lua_Debug();
		if (lua_getstack(L, 2, ar))
			lua_getinfo(L, to_luastring("Sl"), ar);
		push(L, new ErrorEvent("error", {
			bubbles: true,
			cancelable: true,
			message: lua_tojsstring(L, 1),
			error: tojs(L, 1),
			filename: ar.short_src ? to_jsstring(ar.short_src) : void 0,
			lineno: ar.currentline > 0 ? ar.currentline : void 0
		}));
		return 1;
	};

	const run_lua_script = function(tag, code, chunkname) {
		let ok = luaL_loadbuffer(L, code, null, chunkname);
		let e;
		if (ok === LUA_ERRSYNTAX) {
			let msg = lua_tojsstring(L, -1);
			let filename = tag.src?tag.src:document.location;
			let lineno = void 0; /* TODO: extract out of msg */
			let syntaxerror = new SyntaxError(msg, filename, lineno);
			e = new ErrorEvent("error", {
				message: msg,
				error: syntaxerror,
				filename: filename,
				lineno: lineno
			});
		} else if (ok === LUA_OK) {
			/* insert message handler below function */
			let base = lua_gettop(L);
			lua_pushcfunction(L, msghandler);
			lua_insert(L, base);
			/* set document.currentScript.
			   We can't set it normally; but we can create a getter for it, then remove the getter */
			Object.defineProperty(document, 'currentScript', {
				value: tag,
				configurable: true
			});
			ok = lua_pcall(L, 0, 0, base);
			/* Remove the currentScript getter installed above; this restores normal behaviour */
			delete document.currentScript;
			/* Remove message handler */
			lua_remove(L, base);
			/* Check if normal error that msghandler would have handled */
			if (ok === LUA_ERRRUN) {
				e = checkjs(L, -1);
			}
		}
		if (ok !== LUA_OK) {
			if (e === void 0) {
				e = new ErrorEvent("error", {
					message: lua_tojsstring(L, -1),
					error: tojs(L, -1)
				});
			}
			lua_pop(L, 1);
			if (window.dispatchEvent(e)) {
				console.error("uncaught exception", e.error);
			}
		}
	};

	const process_xhr_response = function(xhr, tag, chunkname) {
		if (xhr.status >= 200 && xhr.status < 300) {
			let code = xhr.response;
			if (typeof code === "string") {
				code = to_luastring(xhr.response);
			} else { /* is an array buffer */
				code = new Uint8Array(code);
			}
			/* TODO: subresource integrity check? */
			run_lua_script(tag, code, chunkname);
		} else {
			tag.dispatchEvent(new Event("error"));
		}
	};

	const run_lua_script_tag = function(tag) {
		if (tag.src) {
			let chunkname = to_luastring("@"+tag.src);
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
							throw new Error("unable to fetch");
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
			let code = to_luastring(tag.innerHTML);
			let chunkname = tag.id ? to_luastring("="+tag.id) : code;
			run_lua_script(tag, code, chunkname);
		}
	};

	const contentTypeRegexp = /^(.*?\/.*?)([\t ]*;.*)?$/;
	const luaVersionRegex = /^(\d+)\.(\d+)$/;
	const try_tag = function(tag) {
		if (tag.tagName !== "SCRIPT")
			return;

		/* strip off mime type parameters */
		let contentTypeMatch = contentTypeRegexp.exec(tag.type);
		if (!contentTypeMatch)
			return;
		let mimetype = contentTypeMatch[1];
		if (mimetype !== "application/lua" && mimetype !== "text/lua")
			return;

		if (tag.hasAttribute("lua-version")) {
			let lua_version = luaVersionRegex.exec(tag.getAttribute("lua-version"));
			if (!lua_version || lua_version[1] !== LUA_VERSION_MAJOR || lua_version[2] !== LUA_VERSION_MINOR)
				return;
		}

		run_lua_script_tag(tag);
	};

	if (typeof MutationObserver !== 'undefined') {
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
	} else if (console.warn) {
		console.warn("fengari-web: MutationObserver not found; lua script tags will not be run when inserted");
	}

	/* the query selector here is slightly liberal,
	   more checks occur in try_tag */
	const selector = 'script[type^="application/lua"], script[type^="text/lua"]';

	/* try to run existing script tags */
	Array.prototype.forEach.call(document.querySelectorAll(selector), try_tag);
}
