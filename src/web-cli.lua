local js = require "js"

-- Save references to lua baselib functions used
local _G = _G
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

local history = {}
local historyIndex = nil
local historyLimit = 100

_G.print = function(...)
    local toprint = pack(...)

    local line = document:createElement("span")
    output:appendChild(line)

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
        local item = document:createElement("pre")
        item.className = "lua"
        item.style.padding = "0"
        item.style.display = "inline"
        item.style["white-space"] = "pre-wrap"
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

    local line = input.value
    table.insert(history, line)
    if #history > historyLimit then
        table.remove(history, 1)
    end

    local fn, err = load("return " .. line, "stdin")
    if not fn then
        fn, err = load(line, "stdin")
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

function input:onkeydown(e)
    if not e then
        e = js.global.event
    end

    local key = e.key or e.which
    if key == "Enter" and not e.shiftKey then
        doREPL()
        return false
    elseif key == "ArrowUp" then
        historyIndex = historyIndex and historyIndex - 1 or #history
        historyIndex = historyIndex > 0 and historyIndex or 1
        input.value = history[historyIndex]
        return false
    elseif key == "ArrowDown" then
        historyIndex = historyIndex and historyIndex + 1
        historyIndex = historyIndex <= #history and historyIndex or #history
        input.value = history[historyIndex]
        return false
    end
end

_G.print(_G._COPYRIGHT)
