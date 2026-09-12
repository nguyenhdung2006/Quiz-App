(function (global) {
"use strict";

function endOfLocalDay(now = new Date()) {
return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

function isDueToday(value, now = new Date()) {
let due = value instanceof Date ? value : new Date(value);
if (Number.isNaN(due.getTime())) return false;
return due < endOfLocalDay(now);
}

global.WordArenaDateUtils = Object.freeze({ endOfLocalDay, isDueToday });
})(typeof window !== "undefined" ? window : globalThis);
