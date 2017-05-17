local js = require "js"

-- Save references to lua baselib functions used
local _G = _G
local error = error
local load = load
local pack, unpack = table.pack, table.unpack
local tostring = tostring
local traceback = debug.traceback
local xpcall = xpcall

local document = js.global.document
local hljs = js.global.hljs

local output = document:getElementById("fengari-console")
local prompt = document:getElementById("fengari-prompt")
local input = document:getElementById("fengari-input")
assert(output and prompt and input)

local function triggerEvent(el, type)
    local e = document:createEvent("HTMLEvents")
    e:initEvent(type, false, true)
    el:dispatchEvent(e)
end

_G.print = function(...)
    local toprint = pack(...)

    local line = document:createElement("span")
    output:appendChild(line)
    output:appendChild(document:createElement("br"))

    for i = 1, toprint.n do
        local item = document:createElement("pre")
        item.style["white-space"] = "pre-wrap"
        item:appendChild(document:createTextNode(tostring(toprint[i])))
        line:appendChild(item)
    end

    output.scrollTop = output.scrollHeight
end

local function doREPL()
    do
        local line = document:createElement("span")
        line:appendChild(document:createTextNode(prompt.textContent))
        local item = document:createElement("span")
        item.class = "lua"
        item.style.padding = "0"
        item.style.display = "inline"
        item.textContent = input.value
        hljs:highlightBlock(item)
        line:appendChild(item)
        output:appendChild(line)
        output:appendChild(document:createElement("br"))
        output.scrollTop = output.scrollHeight
    end

    if input.value.length == 0 then
        return
    end

    local fn, err = load("return " .. input.value, "stdin")
    if not fn then
        fn, err = load(input.value, "stdin")
    end

    if fn then
        local results = pack(xpcall(fn, traceback))
        if results[1] then
            if results.n > 1 then
                _G.print(unpack(results, 2, results.n))
            end
        else
            _G.print(results[2])
        end
    else
        _G.print(err)
    end

    input.value = ""
    prompt.textContent = _G._PROMPT or "> "

    triggerEvent(output, "change")
end

function input:onkeypress(e)
    if not e then
        e = js.global.event
    end

    local keyCode = e.keyCode or e.which
    if keyCode == 13 and not e.shiftKey then
        doREPL()
        return false
    end
end

_G.print(_G._COPYRIGHT)
