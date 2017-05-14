"use strict";

window.WEB = true;

const lua          = fengari.lua;
const lauxlib      = fengari.lauxlib;
const lualib       = fengari.lualib;

const stdin = lua.to_luastring("=stdin");
const _PROMPT = lua.to_luastring("_PROMPT");
const _PROMPT2 = lua.to_luastring("_PROMPT2");

const output = document.getElementById('fengari-console');
const input = document.getElementById('fengari-input');
const prompt = document.getElementById('fengari-prompt');


const triggerEvent = function(el, type) {
    var e = document.createEvent('HTMLEvents');
    e.initEvent(type, false, true);
    el.dispatchEvent(e);
}

const out = function(msg) {
    output.innerHTML += msg;
    triggerEvent(output, 'change');
    output.scrollTop = output.scrollHeight;
};

const luaW_print = function(L) {
    let n = lua.lua_gettop(L); /* number of arguments */
    let str = [];

    lua.lua_getglobal(L, lua.to_luastring("tostring", true));
    for (let i = 1; i <= n; i++) {
        lua.lua_pushvalue(L, -1);  /* function to be called */
        lua.lua_pushvalue(L, i);  /* value to print */
        lua.lua_call(L, 1, 1);
        let s = lua.lua_tolstring(L, -1);
        if (s === null)
            return lauxlib.luaL_error(L, lua.to_luastring("'tostring' must return a string to 'print'", true));
        if (i > 1) s = ["\t".charCodeAt(0)].concat(s);
        str = str.concat(s);
        lua.lua_pop(L, 1);
    }

    out(lua.to_jsstring(str) + "\n");
    return 0;
};

const report = function(L, status) {
    if (status !== lua.LUA_OK) {
        out(`${lua.lua_tojsstring(L, -1)}\n`);
        lua.lua_pop(L, 1);
    }
    return status;
};

const msghandler = function(L) {
    let msg = lua.lua_tostring(L, 1);
    if (msg === null) {  /* is error object not a string? */
        if (lauxlib.luaL_callmeta(L, 1, "__tostring") &&  /* does it have a metamethod */
          lua.lua_type(L, -1) == lua.LUA_TSTRING)  /* that produces a string? */
            return 1;  /* that is the message */
        else
            msg = lua.lua_pushstring(L, lua.to_luastring(`(error object is a ${lua.to_jsstring(lauxlib.luaL_typename(L, 1))} value)`));
    }
    lauxlib.luaL_traceback(L, L, msg, 1);  /* append a standard traceback */

    out(lua.lua_tojsstring(L, -1));

    return 1;  /* return the traceback */
};

const docall = function(L, narg, nres) {
    let base = lua.lua_gettop(L) - narg;
    lua.lua_pushcfunction(L, msghandler);
    lua.lua_insert(L, base);
    let status = lua.lua_pcall(L, narg, nres, base);
    lua.lua_remove(L, base);
    return status;
};

const doREPL = function(L) {
    lua.lua_getglobal(L, _PROMPT);
    prompt.innerHTML = ">";
    out("\n> " + input.value + "\n");
    lua.lua_pop(L, 1);

    if (input.value.length === 0)
        return;

    let status;
    {
        let buffer = lua.to_luastring("return " + input.value);
        status = lauxlib.luaL_loadbuffer(L, buffer, buffer.length, stdin);
    }
    if (status !== lua.LUA_OK) {
        lua.lua_pop(L, 1);
        let buffer = lua.to_luastring(input.value);
        if (lauxlib.luaL_loadbuffer(L, buffer, buffer.length, stdin) === lua.LUA_OK) {
            status = lua.LUA_OK;
        }
    }
    while (status === lua.LUA_ERRSYNTAX && lua.lua_tojsstring(L, -1).endsWith("<eof>")) {
        /* continuation */
        lua.lua_pop(L, 1);
        lua.lua_getglobal(L, _PROMPT2);
        out("\n");
        prompt.innerHTML = ">>";
        lua.lua_pop(L, 1);
        let buffer = lua.to_luastring(input.value);
        status = lauxlib.luaL_loadbuffer(L, buffer, buffer.length, stdin);
    }
    if (status === lua.LUA_OK) {
        status = docall(L, 0, lua.LUA_MULTRET);
    }
    if (status === lua.LUA_OK) {
        let n = lua.lua_gettop(L);
        if (n > 0) {  /* any result to be printed? */
            luaW_print(L);
        }
    } else {
        report(L, status);
    }
    lua.lua_settop(L, 0);  /* remove eventual returns */

    input.value = "";
};

const L = lauxlib.luaL_newstate();

output.innerHTML += lua.FENGARI_COPYRIGHT + "\n";
/* open standard libraries */
lualib.luaL_openlibs(L);

// Overwrite luaB_print
lua.lua_register(L, lua.to_luastring("print"), luaW_print);

input.onkeypress = function(e){
    if (!e) e = window.event;
    var keyCode = e.keyCode || e.which;
    if (keyCode == '13'){
        doREPL(L);
        return false;
    }
};
