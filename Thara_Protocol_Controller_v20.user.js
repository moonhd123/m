// ==UserScript==
// @name         Thara Protocol Controller
// @namespace    http://tampermonkey.net/
// @version      v1.9.7
// @description  Arras.io Protocol-Only Controller
// @author       thara
// @match        *://arras.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=arras.io
// @require      https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

/* global msgpack */

(function() {
    'use strict';

    // ==========================================
    // 1. CORE HACK: ANTI-INVISIBILITY
    // ==========================================
    window.antiInviActive = true;

    const originalDrawElements = WebGLRenderingContext.prototype.drawElements;
    WebGLRenderingContext.prototype.drawElements = function(mode, count, type, offset) {
        const isTank = window.antiInviActive && count > 50 && count < 600;
        if (isTank) this.disable(this.BLEND);
        const result = originalDrawElements.call(this, mode, count, type, offset);
        if (isTank) this.enable(this.BLEND);
        return result;
    };

    const proto = CanvasRenderingContext2D.prototype;
    const globalAlphaDesc = Object.getOwnPropertyDescriptor(proto, 'globalAlpha');
    Object.defineProperty(proto, 'globalAlpha', {
        set(val) {
            if (window.antiInviActive && val > 0.05 && val < 0.95) val = 1;
            globalAlphaDesc.set.call(this, val);
        },
        get: globalAlphaDesc.get,
        configurable: true
    });

    let x = null,
        y = null,
        positionFreshUntil = 0;
    const MANUAL_COORD_SCALE = 30;
    const FOLLOW_MOUSE_PIXEL_SCALE = 10;

    function setPositionDisplay(value) {
        const pd = document.getElementById('posDisplay');
        if (pd) pd.textContent = value;
        const cd = document.getElementById('currentCoordsDisplay');
        if (cd) cd.textContent = value;
    }

    function setManualCoordinateInputs(nextX, nextY) {
        const manualX = document.getElementById('manualX');
        const manualY = document.getElementById('manualY');
        if (!manualX || !manualY) return;
        manualX.value = nextX.toFixed(1);
        manualY.value = nextY.toFixed(1);
    }

    function readArrasText(text) {
        if (typeof text !== "string") text = String(text);

        if (text === 'You have spawned! Welcome to the game.') {
            setPositionDisplay("Waiting for coordinates...");
            return;
        }

        if (text.startsWith('Coordinates: (')) {
            let coordsStr = text.slice(14);
            const endIndex = coordsStr.indexOf(')');
            if (endIndex !== -1) coordsStr = coordsStr.slice(0, endIndex);

            const parts = coordsStr.split(', ');
            if (parts.length === 2) {
                const nextX = parseFloat(parts[0]);
                const nextY = parseFloat(parts[1]);
                if (!isNaN(nextX) && !isNaN(nextY)) {
                    x = nextX;
                    y = nextY;
                    positionFreshUntil = performance.now() + 5000;
                    setPositionDisplay(`X: ${x.toFixed(1)}, Y: ${y.toFixed(1)}`);
                }
            }
            return;
        }

        if (
            text.startsWith("You have been killed by") ||
            text === "You have died a stupid death." ||
            text === "You have self-destructed." ||
            text.startsWith("The connection closed due to ")
        ) {
            x = y = null;
            positionFreshUntil = 0;
            setPositionDisplay("Not in game");
        }
    }

    try {
        const oldFillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = new Proxy(oldFillText, {
            apply(target, thisArg, args) {
                readArrasText(args[0]);
                return Reflect.apply(target, thisArg, args);
            }
        });

        const oldStrokeText = CanvasRenderingContext2D.prototype.strokeText;
        CanvasRenderingContext2D.prototype.strokeText = new Proxy(oldStrokeText, {
            apply(target, thisArg, args) {
                readArrasText(args[0]);
                return Reflect.apply(target, thisArg, args);
            }
        });
    } catch (e) {
        console.error("[Thara Protocol] Error proxying canvas text:", e);
    }

    function initController() {
        if (document.getElementById('kMenu')) return;

        // ==========================================
        // 2. PREMIUM UI — AURORA THEME
        // ==========================================
        const style = document.createElement('style');
        style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        :root {
            --bg:         #07070e;
            --bg2:        #0c0c16;
            --bg3:        #10101d;
            --card:       rgba(255,255,255,0.035);
            --card-h:     rgba(255,255,255,0.065);
            --border:     rgba(129,140,248,0.18);
            --border-h:   rgba(129,140,248,0.38);

            --indigo:     #818cf8;
            --indigo2:    #6366f1;
            --indigo-g:   rgba(99,102,241,0.35);

            --cyan:       #22d3ee;
            --cyan-g:     rgba(34,211,238,0.3);

            --green:      #34d399;
            --green2:     #059669;
            --green-g:    rgba(52,211,153,0.35);

            --red:        #f87171;
            --red2:       #dc2626;
            --red-g:      rgba(248,113,113,0.3);

            --violet:     #a78bfa;
            --pink:       #f472b6;
            --amber:      #fbbf24;

            --text:       #f1f5f9;
            --text2:      #94a3b8;
            --text3:      #475569;

            --font:       'Outfit', sans-serif;
            --r:          10px;
            --r2:         7px;
        }

        /* ══ MENU SHELL ══ */
        #kMenu {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 490px;
            background: var(--bg);
            border: 1px solid var(--border-h);
            border-radius: 16px;
            color: var(--text);
            font-family: var(--font);
            z-index: 9999999;
            display: flex; flex-direction: column;
            box-shadow:
                0 0 0 1px rgba(129,140,248,0.08),
                0 8px 32px rgba(0,0,0,0.8),
                0 32px 80px rgba(0,0,0,0.6),
                0 0 80px rgba(99,102,241,0.08),
                inset 0 1px 0 rgba(255,255,255,0.06);
            animation: menuIn 0.28s cubic-bezier(0.34,1.56,0.64,1);
            user-select: none; overflow: hidden;
        }

        @keyframes menuIn {
            from { opacity:0; transform:translate(-50%,-46%) scale(0.93); }
            to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
        }

        /* ══ HEADER ══ */
        .k-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 14px 18px;
            background: var(--bg2);
            border-bottom: 1px solid var(--border);
            cursor: grab;
            position: relative;
            overflow: hidden;
        }
        .k-header:active { cursor: grabbing; }

        /* animated aurora gradient shimmer behind header */
        .k-header::before {
            content: '';
            position: absolute; inset: 0;
            background: linear-gradient(105deg,
                transparent 40%,
                rgba(99,102,241,0.07) 50%,
                rgba(34,211,238,0.05) 60%,
                transparent 70%
            );
            background-size: 200% 100%;
            animation: shimmer 4s linear infinite;
            pointer-events: none;
        }
        @keyframes shimmer { from{background-position:200% 0} to{background-position:-200% 0} }

        .k-title {
            display: flex; align-items: center; gap: 10px;
            pointer-events: none;
        }
        .k-title-text {
            font-size: 13px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            background: linear-gradient(90deg, var(--indigo), var(--cyan));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .k-badge {
            font-size: 9px; font-weight: 700; letter-spacing: 1px;
            color: var(--indigo); background: rgba(99,102,241,0.12);
            border: 1px solid rgba(129,140,248,0.3);
            border-radius: 5px; padding: 2px 7px;
            -webkit-text-fill-color: var(--indigo);
        }

        /* ══ STATUS PILL ══ */
        .k-status {
            display: flex; align-items: center; gap: 7px;
            font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
            text-transform: uppercase;
            color: var(--text3);
            padding: 5px 12px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 20px;
            transition: 0.3s;
            pointer-events: none;
        }
        .k-status.live {
            color: var(--green);
            background: rgba(52,211,153,0.08);
            border-color: rgba(52,211,153,0.25);
        }
        .k-dot {
            width: 7px; height: 7px;
            background: var(--text3); border-radius: 50%;
            box-shadow: 0 0 6px currentColor;
            transition: 0.3s;
        }
        .k-status.live .k-dot {
            background: var(--green);
            animation: pulse-dot 1.5s ease-in-out infinite;
        }
        @keyframes pulse-dot {
            0%,100%{ transform:scale(1); opacity:1; }
            50%    { transform:scale(1.4); opacity:0.7; }
        }

        /* ══ TABS ══ */
        .k-tabs {
            display: flex; gap: 6px;
            padding: 10px 14px;
            background: var(--bg2);
            border-bottom: 1px solid var(--border);
        }
        .k-tab {
            flex: 1; padding: 9px 12px;
            font-family: var(--font); font-size: 11px; font-weight: 700;
            letter-spacing: 0.8px; text-transform: uppercase;
            color: var(--text3); text-align: center;
            border-radius: 8px; cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid transparent;
        }
        .k-tab:hover { color: var(--text2); background: var(--card); border-color: var(--border); }
        .k-tab.active {
            color: #fff;
            background: linear-gradient(135deg, var(--indigo2), #4f46e5);
            border-color: transparent;
            box-shadow: 0 4px 20px rgba(99,102,241,0.4), 0 0 0 1px rgba(129,140,248,0.3);
        }

        /* ══ BODY / SCROLL ══ */
        .k-body {
            display: flex; flex-direction: column; gap: 12px;
            padding: 14px; max-height: 60vh; overflow-y: auto;
            background: var(--bg);
            scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.4) transparent;
        }
        .k-body::-webkit-scrollbar { width: 3px; }
        .k-body::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 2px; }

        .k-pane { display: none; flex-direction: column; gap: 12px; }
        .k-pane.active { display: flex; }

        /* ══ CARDS ══ */
        .k-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--r);
            padding: 14px 16px;
            display: flex; flex-direction: column; gap: 12px;
            position: relative; overflow: hidden;
        }
        /* colored top accent line per card */
        .k-card::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0;
            height: 2px;
            background: var(--card-accent, linear-gradient(90deg, var(--indigo2), var(--cyan)));
            border-radius: 10px 10px 0 0;
        }
        .k-card-title {
            display: flex; align-items: center; gap: 8px;
            font-size: 10px; font-weight: 800; letter-spacing: 1.5px;
            text-transform: uppercase; color: var(--text2);
        }
        .k-card-title svg { width: 14px; height: 14px; flex-shrink: 0; }
        .k-card-icon { color: var(--indigo); }

        /* ══ TOGGLE ROWS ══ */
        .k-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

        .k-toggle {
            display: flex; justify-content: space-between; align-items: center;
            background: var(--bg2); border: 1px solid rgba(255,255,255,0.06);
            border-radius: var(--r2); padding: 11px 14px;
            cursor: pointer; transition: all 0.2s;
        }
        .k-toggle:hover { background: var(--card-h); border-color: var(--border); }
        .k-toggle input { display: none; }
        .k-tname { font-size: 12px; font-weight: 600; color: var(--text); }
        .k-tname.small { font-size: 11px; }

        /* pill switch */
        .k-sw {
            width: 38px; height: 21px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 21px; position: relative;
            transition: all 0.25s ease; flex-shrink: 0;
        }
        .k-sw::after {
            content: '';
            position: absolute;
            width: 15px; height: 15px;
            background: var(--text3); border-radius: 50%;
            top: 2px; left: 2px;
            transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        .k-toggle input:checked ~ .k-sw {
            background: var(--indigo2);
            border-color: transparent;
            box-shadow: 0 0 14px rgba(99,102,241,0.5);
        }
        .k-toggle input:checked ~ .k-sw::after { left: 20px; background: #fff; }

        /* special: anti-invi → violet */
        #antiInviToggle:checked ~ .k-sw {
            background: linear-gradient(135deg, var(--violet), var(--pink)) !important;
            box-shadow: 0 0 16px rgba(167,139,250,0.5) !important;
        }
        /* autospin → cyan */
        #autospin:checked ~ .k-sw {
            background: var(--cyan) !important;
            box-shadow: 0 0 14px rgba(34,211,238,0.45) !important;
        }

        /* ══ LABELS & INPUTS ══ */
        .k-lbl {
            font-size: 10px; font-weight: 700; letter-spacing: 1px;
            text-transform: uppercase; color: var(--text3);
            margin-bottom: 5px; display: block;
        }
        .k-input {
            user-select: text;
            width: 100%; box-sizing: border-box;
            background: var(--bg2);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: var(--r2);
            padding: 10px 14px;
            color: var(--text); font-family: var(--font); font-size: 13px;
            outline: none; transition: all 0.2s;
            clip-path: none;
        }
        .k-input:focus {
            border-color: var(--indigo);
            box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
        textarea.k-input { resize: vertical; min-height: 75px; }

        /* ══ DROPDOWN ══ */
        .k-sel { position: relative; }
        .k-sel-head {
            display: flex; justify-content: space-between; align-items: center;
            background: var(--bg2);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: var(--r2); padding: 10px 14px;
            cursor: pointer; transition: 0.2s; font-size: 13px;
        }
        .k-sel-head:hover { border-color: var(--border); }
        .k-sel-head svg { opacity: 0.5; flex-shrink: 0; }

        /* ── FIXED-POSITION DROPDOWN (escapes overflow:hidden parent) ── */
        .k-drop {
            position: fixed;
            top: 0; left: 0; width: 0;
            background: #0e0e1a;
            border: 1px solid var(--border);
            border-radius: var(--r); max-height: 260px; overflow-y: auto;
            z-index: 99999999; display: none;
            box-shadow: 0 24px 60px rgba(0,0,0,0.8), 0 0 24px rgba(99,102,241,0.12);
            scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.3) transparent;
        }
        .k-drop.show { display: block; }
        .k-dg {
            padding: 8px 14px 5px;
            font-size: 9px; font-weight: 800; letter-spacing: 2px;
            text-transform: uppercase; color: var(--indigo);
            background: rgba(99,102,241,0.05);
        }
        .k-di {
            padding: 10px 14px; font-size: 13px; color: var(--text2);
            cursor: pointer; transition: 0.15s;
        }
        .k-di:hover { color: var(--text); background: rgba(99,102,241,0.08); padding-left: 20px; }
        .k-di.sel { color: #fff; background: var(--indigo2); font-weight: 600; }

        /* ══ SLIDER ══ */
        .k-slider-wrap {
            background: var(--bg2);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: var(--r2); padding: 12px 14px;
        }
        .k-slider-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .k-slider-row span { font-size: 12px; font-weight: 600; color: var(--text2); }
        .k-slider-row .k-val { color: var(--cyan); font-weight: 700; font-size: 13px; }
        input[type="range"] {
            -webkit-appearance: none; width: 100%; height: 4px;
            background: linear-gradient(90deg, var(--indigo2), var(--cyan));
            border-radius: 2px; outline: none;
            border: none; padding: 0; clip-path: none;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; width: 18px; height: 18px;
            background: #fff; border-radius: 50%;
            cursor: pointer; clip-path: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(99,102,241,0.4);
        }

        /* ══ BUTTONS ══ */
        .k-btn {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            padding: 12px 18px; border: none; border-radius: var(--r2);
            font-family: var(--font); font-size: 12px; font-weight: 700;
            letter-spacing: 1px; text-transform: uppercase;
            cursor: pointer; transition: all 0.2s; clip-path: none;
        }

        /* DEPLOY — main CTA: green→cyan gradient */
        #connectNoob {
            background: linear-gradient(135deg, #059669, #0891b2);
            color: #fff; width: 100%;
            font-size: 13px; font-weight: 800; letter-spacing: 1.5px;
            box-shadow: 0 6px 24px rgba(5,150,105,0.4), 0 2px 8px rgba(0,0,0,0.4);
            padding: 14px;
        }
        #connectNoob:hover { box-shadow: 0 8px 32px rgba(5,150,105,0.55); transform: translateY(-2px); }
        #connectNoob:active { transform: translateY(0); }
        #connectNoob.spamming {
            background: linear-gradient(135deg, var(--red2), #9f1239);
            box-shadow: 0 6px 24px rgba(220,38,38,0.45);
            animation: kPulse 0.9s ease-in-out infinite;
        }
        @keyframes kPulse {
            0%,100%{ transform:scale(1); }
            50%    { transform:scale(1.02); }
        }

        .k-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

        /* CONNECT — indigo outline */
        #reconnectServer {
            background: rgba(99,102,241,0.1);
            color: var(--indigo);
            border: 1px solid rgba(99,102,241,0.35);
        }
        #reconnectServer:hover { background: rgba(99,102,241,0.18); border-color: var(--indigo); }

        /* KILL ALL — red danger */
        #deleteNoobs {
            background: rgba(220,38,38,0.08);
            color: var(--red); width: 100%;
            border: 1px solid rgba(248,113,113,0.22);
            margin-top: 4px;
        }
        #deleteNoobs:hover { background: rgba(220,38,38,0.16); border-color: var(--red); }

        /* BROADCAST — indigo→violet */
        #broadcastBtn {
            background: linear-gradient(135deg, var(--indigo2), var(--violet));
            color: #fff; width: 100%;
            box-shadow: 0 4px 18px rgba(99,102,241,0.4);
        }
        #broadcastBtn:hover { box-shadow: 0 6px 28px rgba(99,102,241,0.55); transform: translateY(-1px); }

        /* PHRASE BUTTONS */
        .k-phrase-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-top: 4px; }
        .phrase-btn {
            padding: 9px 6px;
            font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
            background: var(--bg2);
            border: 1px solid rgba(255,255,255,0.07) !important;
            color: var(--text2); border-radius: 7px;
            clip-path: none; font-family: var(--font);
        }
        .phrase-btn:hover { color: var(--cyan); border-color: rgba(34,211,238,0.35) !important; background: rgba(34,211,238,0.06); }

        /* ══ SMALL HELPERS ══ */
        .k-row { display: flex; align-items: center; gap: 10px; }
        .k-row-label {
            font-size: 11px; font-weight: 600; color: var(--text2);
            white-space: nowrap; flex-shrink: 0;
        }
        .k-hint { font-size: 10px; color: var(--text3); }

        /* ══ FOOTER ══ */
        .k-footer {
            text-align: center; font-size: 10px;
            color: var(--text3); padding: 10px 18px;
            border-top: 1px solid var(--border);
            background: var(--bg2);
            letter-spacing: 0.5px;
        }
        .k-footer b { color: var(--indigo); font-weight: 700; }
        .k-footer span { color: var(--text3); margin: 0 4px; }

        /* ══ DIVIDER ══ */
        .k-sep {
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--border), transparent);
            border: none; margin: 0;
        }

        /* ══ INPUT GROUPS ══ */
        input[type="text"].k-input,
        input[type="number"].k-input,
        textarea.k-input {
            user-select: text;
        }

        /* ══ CHAT SECTION ══ */
        .k-chat-wrap { display: flex; flex-direction: column; gap: 10px; }
    `;
        document.head.appendChild(style);

        // ── BUILD MENU ──
        const menu = document.createElement('div');
        menu.id = 'kMenu';
        menu.style.display = 'flex';

        menu.innerHTML = `
        <div class="k-header" id="menuHeader">
            <div class="k-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#grad1)" stroke-width="2.5">
                    <defs><linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient></defs>
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <span class="k-title-text">Thara Protocol</span>
                <span class="k-badge">v1.9.7</span>
            </div>
            <div class="k-status" id="statusPill">
                <div class="k-dot"></div>
                <span id="serverStatus">Offline</span>
            </div>
        </div>

        <div class="k-tabs">
            <div class="k-tab active" data-tab="main">⚡ Main</div>
            <div class="k-tab" data-tab="macros">💬 Chat</div>
        </div>

        <div class="k-body">

            <!-- MAIN PANE -->
            <div id="mainTab" class="k-pane active">

                <!-- COMBAT CARD -->
                <div class="k-card" style="--card-accent: linear-gradient(90deg,#7c3aed,#a78bfa);">
                    <div class="k-card-title" style="color:#a78bfa;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l-2 2-3-3-2 2L2 16l2-2-3-3 2-2 3 3 2-2 2 2z"/></svg>
                        Combat & Visuals
                    </div>

                    <!-- Anti-Invi full width -->
                    <label class="k-toggle" style="background:rgba(167,139,250,0.06); border-color:rgba(167,139,250,0.2);">
                        <div>
                            <div class="k-tname" style="color:#c4b5fd;">⬡ Anti-Invisibility</div>
                            <div style="font-size:10px;color:#6b7280;margin-top:2px;">Reveal hidden tanks</div>
                        </div>
                        <input id="antiInviToggle" type="checkbox" checked>
                        <div class="k-sw"></div>
                    </label>

                    <div class="k-grid2">
                        <label class="k-toggle">
                            <div class="k-tname small">🔥 Auto Fire</div>
                            <input id="autofire" type="checkbox">
                            <div class="k-sw"></div>
                        </label>
                        <label class="k-toggle" style="border-color:rgba(34,211,238,0.2);">
                            <div class="k-tname small" style="color:#67e8f9;">↺ Override</div>
                            <input id="autospin" type="checkbox" checked>
                            <div class="k-sw"></div>
                        </label>
                    </div>

                    <div class="k-slider-wrap">
                        <div class="k-slider-row">
                            <span>Aim Strength</span>
                            <span class="k-val"><span id="sensitivityValue">20</span>%</span>
                        </div>
                        <input id="mouseSensitivity" type="range" min="1" max="100" step="1" value="20">
                    </div>
                </div>

                <!-- SWARM CARD -->
                <div class="k-card" style="--card-accent: linear-gradient(90deg,#059669,#22d3ee);">
                    <div class="k-card-title" style="color:#6ee7b7;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 15h.01M16 15h.01"/></svg>
                        Swarm Intelligence
                    </div>

                    <div class="k-grid2">
                        <label class="k-toggle">
                            <div class="k-tname small">🖱 Follow Parent</div>
                            <input id="mbs" type="checkbox" checked>
                            <div class="k-sw"></div>
                        </label>
                        <label class="k-toggle">
                            <div class="k-tname small">⚡ Auto Feed</div>
                            <input id="followMouse" type="checkbox">
                            <div class="k-sw"></div>
                        </label>
                        <label class="k-toggle">
                            <div class="k-tname small">Auto Feed</div>
                            <input id="feeding" type="checkbox">
                            <div class="k-sw"></div>
                        </label>
                    </div>

                    <label class="k-toggle">
                        <div class="k-tname small">📍 Manual Coordinates</div>
                        <input id="manualMode" type="checkbox">
                        <div class="k-sw"></div>
                    </label>

                    <div class="k-hint" id="coordModeHint" style="color:#fbbf24;">Press L in-game so coordinates are visible before using Follow Parent or Manual Coordinates.</div>

                    <div id="manualCoordsSection" style="display:none; flex-direction:column; gap:8px;">
                        <div class="k-lbl" style="color:#22d3ee;">Your current coordinates: <span id="currentCoordsDisplay">Not in game</span></div>
                        <button class="k-btn" id="fillCoordsBtn" style="background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.35);color:#67e8f9;">
                            Fill in your current coordinates
                        </button>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                            <input id="manualX" class="k-input" type="number" placeholder="X Coord">
                            <input id="manualY" class="k-input" type="number" placeholder="Y Coord">
                        </div>
                        <button class="k-btn" id="goBtn" style="background:linear-gradient(135deg,#6366f1,#22d3ee);color:#fff;">
                            📍 Go to Coordinates
                        </button>
                    </div>

                    <!-- Tank Selector -->
                    <div class="k-sel" id="tankContainer">
                        <div class="k-sel-head" id="tankTrigger">
                            <span id="selectedTankDisplay">Select Tank Class</span>
                            <input class="k-input" type="text" id="tankSearchInput" placeholder="Search tanks…" style="display:none;padding:0;border:none;border-radius:0;background:transparent;flex:1;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                        <div class="k-drop" id="tankOptionsList"></div>
                    </div>
                </div>

                <!-- SERVER CARD -->
                <div class="k-card" style="--card-accent: linear-gradient(90deg,#6366f1,#22d3ee);">
                    <div class="k-card-title" style="color:#93c5fd;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                        Protocol-Only Deploy
                    </div>

                    <div>
                        <span class="k-lbl" style="color:#818cf8;">Controller Bridge URLs</span>
                        <textarea id="botServerUrls" class="k-input" placeholder="ws://localhost:8082&#10;wss://effective-robot-77vvpr76pqrqfpxp-8082.app.github.dev/"></textarea>
                    </div>

                    <div>
                        <span class="k-lbl">Game Server Hash</span>
                        <input id="serverHash" class="k-input" type="text" placeholder="#hash or paste link">
                    </div>

                    <div>
                        <span class="k-lbl" style="color:#f9a8d4;">Clan Tag / Bot Name</span>
                        <input id="clanTag" class="k-input" type="text" placeholder="[CLAN] or BotName" value="[kaka]">
                    </div>

                    <div class="k-grid2">
                        <div>
                            <span class="k-lbl">Bots / Server</span>
                            <input id="botCount" class="k-input" type="number" value="5" min="1" max="200">
                        </div>
                        <div>
                            <span class="k-lbl">Spawn Delay (ms)</span>
                            <input id="spawnDelay" class="k-input" type="number" value="20" min="0" max="1000">
                        </div>
                    </div>

                    <button class="k-btn" id="connectNoob">▶ Deploy Protocol</button>
                    <div class="k-btn-row">
                        <button class="k-btn" id="reconnectServer">⟳ Connect Servers</button>
                        <button class="k-btn" id="deleteNoobs" style="margin-top:0; width:auto;">✕ Kill All</button>
                    </div>
                </div>
            </div>

            <!-- CHAT PANE -->
            <div id="macrosTab" class="k-pane">
                <div class="k-card" style="--card-accent: linear-gradient(90deg,#0891b2,#7c3aed);">
                    <div class="k-card-title" style="color:#7dd3fc;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Transmission Hub
                    </div>
                    <div class="k-chat-wrap">
                        <input id="chatMessage" class="k-input" type="text" placeholder="Type message to broadcast…">
                        <label class="k-toggle">
                            <div class="k-tname small">🔁 Continuous Spam Loop</div>
                            <input id="repeatChat" type="checkbox">
                            <div class="k-sw"></div>
                        </label>
                        <button class="k-btn" id="broadcastBtn">⚡ Execute Transmission</button>
                        <div class="k-phrase-row">
                            <button class="k-btn phrase-btn" data-msg="GG">[1] GG</button>
                            <button class="k-btn phrase-btn" data-msg="EZ">[2] EZ</button>
                            <button class="k-btn phrase-btn" data-msg="WP">[3] WP</button>
                            <button class="k-btn phrase-btn" data-msg="?">[4] ?</button>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <div style="display:none;">
            📍 Position: <span id="posDisplay">Not in game</span>
        </div>
        <div class="k-footer">
            <b>ESC</b><span>·</span>Toggle&nbsp;&nbsp;
            <b>E</b><span>·</span>Auto-Fire&nbsp;&nbsp;
            <b>R</b><span>·</span>Override&nbsp;&nbsp;
            <b>1–4</b><span>·</span>Quick Chat
        </div>
    `;
        document.body.appendChild(menu);

        // ==========================================
        // DRAG & DROP
        // ==========================================
        const header = document.getElementById('menuHeader');
        let isDragging = false,
            offsetX = 0,
            offsetY = 0;

        header.addEventListener('mousedown', e => {
            isDragging = true;
            const rect = menu.getBoundingClientRect();
            if (menu.style.transform !== 'none') {
                menu.style.transform = 'none';
                menu.style.left = rect.left + 'px';
                menu.style.top = rect.top + 'px';
            }
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            menu.style.left = (e.clientX - offsetX) + 'px';
            menu.style.top = (e.clientY - offsetY) + 'px';
            positionTankDropdown();
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // ==========================================
        // UI REFERENCES
        // ==========================================
        const $ = id => document.getElementById(id);
        const HTML = {
            serverStatus: $("serverStatus"),
            serverStatusBadge: $("statusPill"),
            reconnectServer: $("reconnectServer"),
            tankContainer: $("tankContainer"),
            tankTrigger: $("tankTrigger"),
            selectedTankDisplay: $("selectedTankDisplay"),
            tankSearchInput: $("tankSearchInput"),
            tankOptionsList: $("tankOptionsList"),
            botServerUrls: $("botServerUrls"),
            serverHash: $("serverHash"),
            botCount: $("botCount"),
            clanTag: $("clanTag"),
            mbs: $("mbs"),
            followMouse: $("followMouse"),
            feeding: $("feeding"),
            connectNoob: $("connectNoob"),
            deleteNoobs: $("deleteNoobs"),
            autofire: $("autofire"),
            autospin: $("autospin"),
            manualMode: $("manualMode"),
            manualX: $("manualX"),
            manualY: $("manualY"),
            fillCoordsBtn: $("fillCoordsBtn"),
            goBtn: $("goBtn"),
            coordModeHint: $("coordModeHint"),
            manualCoordsSection: $("manualCoordsSection"),
            mouseSensitivity: $("mouseSensitivity"),
            sensitivityValue: $("sensitivityValue"),
            broadcastBtn: $("broadcastBtn"),
            chatMessage: $("chatMessage"),
            repeatChat: $("repeatChat"),
            tabs: {
                main: $("mainTab"),
                macros: $("macrosTab")
            },
            spawnDelay: $("spawnDelay"),
            antiInviToggle: $("antiInviToggle")
        };

        // Move the dropdown out of #kMenu so overflow/transform clipping cannot hide it.
        document.body.appendChild(HTML.tankOptionsList);
        ['mousedown', 'mouseup', 'click', 'contextmenu', 'dblclick'].forEach(evt => {
            menu.addEventListener(evt, e => e.stopPropagation());
            HTML.tankOptionsList.addEventListener(evt, e => e.stopPropagation());
        });

        // Block game from stealing keyboard input inside text fields
        menu.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') e.stopPropagation();
        });

        // Tabs
        document.querySelectorAll('.k-tab').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.k-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.k-pane').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                HTML.tabs[btn.dataset.tab].classList.add('active');
            };
        });

        // ==========================================
        // CHAT / SPAM LOOP
        // ==========================================
        let chatLoopTimer = null;
        let chatLoopMessage = "";

        const stopChatLoop = () => {
            if (chatLoopTimer !== null) {
                clearInterval(chatLoopTimer);
                chatLoopTimer = null;
            }
            chatLoopMessage = "";
        };

        const sendChatOnce = message => {
            const msg = String(message || "").trim();
            if (!msg) return false;
            packetToAll("T", msg, false);
            return true;
        };

        const startChatLoop = message => {
            const msg = String(message || "").trim();
            stopChatLoop();
            if (!msg) return;
            chatLoopMessage = msg;
            sendChatOnce(chatLoopMessage);
            chatLoopTimer = setInterval(() => {
                if (!HTML.repeatChat.checked || !chatLoopMessage) {
                    stopChatLoop();
                    return;
                }
                sendChatOnce(chatLoopMessage);
            }, 2000);
        };

        HTML.broadcastBtn.onclick = () => {
            const msg = HTML.chatMessage.value.trim();
            if (!msg) {
                if (!HTML.repeatChat.checked) stopChatLoop();
                return;
            }
            if (HTML.repeatChat.checked) {
                startChatLoop(msg);
            } else {
                stopChatLoop();
                sendChatOnce(msg);
                HTML.chatMessage.value = "";
                saveSettings();
            }
        };

        HTML.chatMessage.onkeydown = e => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.preventDefault();
                HTML.broadcastBtn.click();
            }
        };

        document.querySelectorAll('.phrase-btn').forEach(btn => {
            btn.onclick = () => {
                const msg = btn.dataset.msg || "";
                if (HTML.repeatChat.checked) {
                    startChatLoop(msg);
                    HTML.chatMessage.value = msg;
                } else {
                    stopChatLoop();
                    sendChatOnce(msg);
                }
            };
        });
        let manualActive = false;
        if (HTML.followMouse?.previousElementSibling) {
            HTML.followMouse.previousElementSibling.textContent = "Follow Mouse";
        }
        HTML.coordModeHint.textContent = "Press L in-game so coordinates are visible before using Follow Parent, Follow Mouse, or Manual Coordinates.";

        HTML.goBtn.addEventListener('click', () => {
            HTML.manualMode.checked = true;
            HTML.mbs.checked = false;
            HTML.followMouse.checked = false;
            HTML.manualCoordsSection.style.display = "flex";
            manualActive = true;
            saveSettings();
        });
        HTML.fillCoordsBtn.addEventListener('click', () => {
            copyCurrentPositionToManualInputs();
        });

        HTML.manualMode.onchange = () => {
            if (HTML.manualMode.checked) {
                HTML.mbs.checked = false;
                HTML.followMouse.checked = false;
                setPositionDisplay("Press L in-game so coordinates are visible.");
            }
            HTML.manualCoordsSection.style.display = HTML.manualMode.checked ? "flex" : "none";
            if (!HTML.manualMode.checked) {
                manualActive = false;
            }
        };
        HTML.mbs.onchange = () => {
            if (HTML.mbs.checked) {
                HTML.manualMode.checked = false;
                HTML.followMouse.checked = false;
                HTML.manualCoordsSection.style.display = "none";
                manualActive = false;
                setPositionDisplay("Press L in-game so coordinates are visible.");
            }
            saveSettings();
        };
        HTML.followMouse.onchange = () => {
            if (HTML.followMouse.checked) {
                HTML.manualMode.checked = false;
                HTML.mbs.checked = false;
                HTML.manualCoordsSection.style.display = "none";
                manualActive = false;
                setPositionDisplay("Press L in-game so coordinates are visible.");
            }
            saveSettings();
        };
        HTML.antiInviToggle.onchange = e => {
            window.antiInviActive = e.target.checked;
            saveSettings();
        };

        let currentTank = "basic";

        const saveSettings = () => {
            const s = {
                botServerUrls: HTML.botServerUrls.value,
                serverHash: HTML.serverHash.value,
                botCount: HTML.botCount.value,
                clanTag: HTML.clanTag.value,
                autofire: HTML.autofire.checked,
                autospin: HTML.autospin.checked,
                mbs: HTML.mbs.checked,
                followMouse: HTML.followMouse.checked,
                feeding: HTML.feeding.checked,
                manualMode: HTML.manualMode.checked,
                manualX: HTML.manualX.value,
                manualY: HTML.manualY.value,
                mouseSensitivity: HTML.mouseSensitivity.value,
                chatMessage: HTML.chatMessage.value,
                repeatChat: HTML.repeatChat.checked,
                currentTank,
                spawnDelay: HTML.spawnDelay.value,
                antiInvi: HTML.antiInviToggle.checked
            };
            localStorage.setItem('noob_settings_v20', JSON.stringify(s));
        };

        const loadSettings = () => {
            const raw = localStorage.getItem('noob_settings_v20');
            if (!raw) return;
            try {
                const s = JSON.parse(raw);
                if (s.botServerUrls !== undefined) HTML.botServerUrls.value = s.botServerUrls;
                if (s.serverHash !== undefined) HTML.serverHash.value = s.serverHash;
                if (s.botCount !== undefined) HTML.botCount.value = s.botCount;
                if (s.clanTag !== undefined) HTML.clanTag.value = s.clanTag;
                if (s.autofire !== undefined) HTML.autofire.checked = s.autofire;
                if (s.autospin !== undefined) HTML.autospin.checked = s.autospin;
                if (s.mbs !== undefined) HTML.mbs.checked = s.mbs;
                if (s.followMouse !== undefined) HTML.followMouse.checked = s.followMouse;
                if (s.feeding !== undefined) HTML.feeding.checked = s.feeding;
                if (s.manualMode !== undefined) HTML.manualMode.checked = s.manualMode;
                if (s.mouseSensitivity !== undefined) {
                    HTML.mouseSensitivity.value = s.mouseSensitivity;
                    HTML.sensitivityValue.textContent = s.mouseSensitivity;
                }
                if (s.spawnDelay !== undefined) HTML.spawnDelay.value = s.spawnDelay;
                if (s.currentTank !== undefined) currentTank = s.currentTank;
                if (s.chatMessage !== undefined) HTML.chatMessage.value = s.chatMessage;
                if (s.repeatChat !== undefined) HTML.repeatChat.checked = s.repeatChat;
                if (s.antiInvi !== undefined) {
                    HTML.antiInviToggle.checked = s.antiInvi;
                    window.antiInviActive = s.antiInvi;
                }
                HTML.manualMode.onchange();
                if (HTML.followMouse.checked) {
                    HTML.manualMode.checked = false;
                    HTML.mbs.checked = false;
                    HTML.manualCoordsSection.style.display = "none";
                    manualActive = false;
                } else if (HTML.mbs.checked) {
                    HTML.manualMode.checked = false;
                    HTML.manualCoordsSection.style.display = "none";
                    manualActive = false;
                }
            } catch (e) {
                console.error(e);
            }
        };

        // ==========================================
        // 4. FULL TANK CATEGORIES
        // ==========================================
        const tankCategories = {
            "Essentials": {
                basic: "Basic",
                twin: "Twin",
                sniper: "Sniper",
                machinegun: "Machine Gun",
                flankguard: "Flank Guard",
                director: "Director",
                pounder: "Pounder",
                megasmasher: "Smasher",
                auto6: "Auto-4/6",
                mega3: "Mega-3",
                shotgun: "Shotgun",
                pursuer: "Pursuer"
            },
            "Advanced Tanks": {
                doubletwin: "Double Twin",
                tripleshot: "Triple Shot",
                sprayer: "Sprayer",
                redistributor: "Redistributor",
                hexatank: "Hexa Tank",
                octotank: "Octo Tank",
                booster: "Booster",
                fighter: "Fighter",
                tripletwin: "Triple Twin",
                overseer: "Overseer",
                underseer: "Underseer",
                manager: "Manager",
                destroyer: "Destroyer",
                anni: "Annihilator",
                rocketeer: "Rocketeer",
                gunner: "Gunner",
                nailgun: "Nailgun",
                pincer: "Pincer",
                auto3: "Auto-3",
                auto4: "Auto-4",
                toppler: "Toppler",
                crack: "Crackshot",
                triplex: "Triplex",
                quadruplex: "Quadruplex",
                predator: "Predator",
                lorry: "Lorry",
                parapet: "Parapet"
            },
            "Traps": {
                septatrap: "Septa Trap",
                hexatrapper: "Hexa Trapper",
                trapguard: "Trap Guard",
                gunnertrapper: "Gunner Trapper",
                tritrapper: "Tri-Trapper",
                fortress: "Fortress",
                septatrapper: "Septa Trapper",
                buchwhacker: "Bushwhacker",
                conqueror: "Conqueror",
                bulwark: "Bulwark"
            },
            "Arms Race / Special": {
                browser: "Browser",
                strider: "Strider",
                surfer: "Surfer",
                eagle: "Eagle",
                phoenix: "Phoenix",
                vulture: "Vulture",
                automingler: "Automingler",
                mingler: "Mingler",
                gale: "Gale",
                nona: "Nona",
                septamachine: "Septa Machine",
                jerker: "Jerker",
                lever: "Lever",
                hognose: "Hognose",
                limpet: "Limpet",
                firework: "Firework",
                coli: "Collision",
                levi: "Leviathan",
                cyclone: "Cyclone",
                spinner: "Spinner",
                helix_ar: "Helix",
                hyperswarmer: "Hyperswarmer",
                neutron: "Neutron",
                triangle: "Tri-Angle",
                falcon: "Falcon",
                banshee: "Banshee",
                assassin: "Assassin",
                stalker: "Stalker",
                launcher: "Launcher",
                cruiser: "Cruiser",
                directordrive: "Director Drive",
                honcho: "Honcho",
                shopper: "Shopper",
                megaspawner: "Mega Spawner",
                ultraspawner: "Ultra Spawner",
                autofighter: "Auto Fighter",
                griffin: "Griffin",
                rocket: "Rocket (ram)"
            },
            "Support & Utility": {
                engineer: "Engineer",
                assembler: "Assembler",
                architect: "Architect",
                factory: "Factory",
                spawner: "Spawner",
                foundry: "Foundry",
                topbanana: "Top Banana",
                healer: "Healer",
                physician: "Physician",
                chemist: "Chemist"
            },
            "Smashers & Rams": {
                megasmasher: "Mega Smasher",
                spike: "Spike",
                autoshasher: "Auto Smasher",
                landmine: "Landmine",
                thorn: "Thorn",
                megaspike: "Mega Spike",
                claymore: "Claymore",
                spear: "Spear",
                prick: "Prick",
                slammer: "Slammer",
                basher: "Basher"
            },
            "Complete Tank Index": {
                auto5: "Auto-5",
                auto7: "Auto-7",
                autoanni: "Auto Annihilator",
                autoauto4: "Auto Auto-4",
                autobattleship: "Auto Battleship",
                autobomber: "Auto Bomber",
                autocruiserdrive: "Auto Cruiser Drive",
                autoeagle: "Auto Eagle",
                autogunner: "Auto Gunner",
                autonecro: "Auto Necro",
                autooperator: "Auto Operator",
                autooverdrive: "Auto Overdrive",
                autooverlord: "Auto Overlord",
                autopentaseer: "Auto Pentaseer",
                autoprod: "Auto Prod",
                autotriangle: "Auto Tri-Angle",
                batter4: "Batter-4",
                battlerdrive: "Battler Drive",
                bismarck: "Bismarck",
                bomber: "Bomber",
                compound: "Compound",
                dirigible: "Dirigible",
                diviner: "Diviner",
                doubleequalizer: "Double Equalizer",
                doublespread: "Double Spread",
                electrocutor: "Electrocutor",
                eradicator: "Eradicator",
                fieldgun: "Field Gun",
                gyro: "Gyro",
                headman: "Headman",
                hurler3: "Hurler-3",
                hypercluster: "Hypercluster",
                hyperskimmer: "Hyperskimmer",
                hypertwister: "Hypertwister",
                kicker: "Kicker",
                machinegunner: "Machine Gunner",
                manufacture: "Manufacture",
                mega5: "Mega-5",
                megaautooverseer: "Mega Auto Overseer",
                megaautotriangle: "Mega Auto Tri-Angle",
                megaautounderdrive: "Mega Auto Underdrive",
                molotov: "Molotov",
                necrodrive: "Necro Drive",
                obliterator: "Obliterator",
                octo: "Octo",
                overcheese: "Overcheese",
                overczar: "Overczar",
                overstorm: "Overstorm",
                palisade: "Palisade",
                penta: "Penta",
                pentadrive: "Penta Drive",
                pentamancer: "Pentamancer",
                proddrive: "Prod Drive",
                ream: "Ream",
                rigger: "Rigger",
                roller: "Roller",
                septamech: "Septa Mech",
                shaver: "Shaver",
                sidewinder: "Sidewinder",
                skidder: "Skidder",
                skimmer: "Skimmer",
                spread: "Spread",
                stomper: "Stomper",
                surferdrive: "Surfer Drive",
                swarmer: "Swarmer",
                tempest: "Tempest",
                tripleautooverseer: "Triple Auto Overseer",
                tripleautotriangle: "Triple Auto Tri-Angle",
                tripleautounderdrive: "Triple Auto Underdrive",
                triplet: "Triplet",
                twister: "Twister",
                tyrant: "Tyrant",
                warlock: "Warlock",
                warship: "Warship",
                whirlwind: "Whirlwind",
                wiper: "Wiper",
            },
            "Branches": {
                triangle_path: {
                    name: "Tri-Angle Path",
                    tanks: ["fighter", "autotriangle", "surfer", "eagle", "bomber", "vulture", "phoenix"]
                },
                launchers: {
                    name: "Launchers Path",
                    tanks: ["skimmer", "twister", "swarmer", "sidewinder", "fieldgun"]
                },
                drones: {
                    name: "Drones Path",
                    tanks: ["overczar", "tyrant", "autooverlord", "megaautooverseer", "tripleautooverseer", "autooverdrive", "headman", "overcheese", "overstorm"]
                },
                auto3_path: {
                    name: "Auto-3 Path",
                    tanks: ["auto5", "mega3", "auto6"]
                },
                dps: {
                    name: "DPS Path",
                    tanks: ["penta", "spread", "octo", "autogunner", "triplet", "predator", "triplex", "quadruplex", "machinegunner"]
                },
                smashers_branch: {
                    name: "Smashers Path",
                    tanks: ["megasmasher", "spike", "autoshasher", "landmine"]
                },
                traps_branch: {
                    name: "Traps Path",
                    tanks: ["hexatrapper", "tritrapper", "fortress", "septatrapper", "gunnertrapper", "septatrap"]
                }
            },
            "Siege Support Branch": {
                siegehealer: { name: "Healer — Siege", tank: "healer" },
                siegephysician: { name: "Physician — Siege", tank: "physician" },
                siegechemist: { name: "Chemist — Siege", tank: "chemist" },
                siegefactory: { name: "Factory — Siege", tank: "factory" }
            },
            "Ram & Pursuit Branch": {
                ram_pursuer: { name: "Pursuer — Ram", tank: "pursuer" },
                ram_rocket: { name: "Rocket — Ram", tank: "rocket" },
                ram_spike: { name: "Spike — Ram", tank: "spike" },
                ram_megaspike: { name: "Mega Spike — Ram", tank: "megaspike" },
                ram_landmine: { name: "Landmine — Ram", tank: "landmine" }
            },
            "Arms Race Branches": {
                triangle_ar: {
                    name: "Tri-Angle (AR)",
                    tanks: ["browser", "strider", "autobomber", "tripleautotriangle", "surferdrive", "electrocutor", "kicker", "megaautotriangle", "roller", "autoeagle"]
                },
                launchers_ar: {
                    name: "Launchers (AR)",
                    tanks: ["hyperskimmer", "skidder", "gyro", "hypercluster", "coli", "molotov", "hypertwister", "ream"]
                },
                annies: {
                    name: "Annihilators (AR)",
                    tanks: ["obliterator", "compound", "wiper", "stomper", "autoanni", "shaver", "eradicator"]
                },
                necro: {
                    name: "Underseer (AR)",
                    tanks: ["diviner", "autonecro", "necrodrive", "megaautounderdrive", "tripleautounderdrive", "pentamancer", "pentadrive", "warlock", "autopentaseer"]
                },
                carriers: {
                    name: "Carriers (AR)",
                    tanks: ["warship", "battlerdrive", "bismarck", "proddrive", "manufacture", "dirigible", "autobattleship", "autoprod", "autocruiserdrive"]
                },
                auto3_ar: {
                    name: "Auto-3 (AR)",
                    tanks: ["auto6", "auto7", "mega5", "batter4", "hurler3", "autoauto4"]
                },
                dps_ar: {
                    name: "DPS (AR)",
                    tanks: ["toppler", "coli", "crack", "autooperator", "manufacture", "lorry"]
                },
                spikes_ar: {
                    name: "Spikes (AR)",
                    tanks: ["thorn", "megaspike", "claymore", "spear", "prick"]
                },
                crash: {
                    name: "Crash (AR)",
                    tanks: ["whirlwind", "tempest", "septamech", "doubleequalizer", "rigger", "lorry", "manufacture", "doublespread", "palisade"]
                }
            }
        };

        function getResolvedTankCode() {
            let def;
            for (const g in tankCategories) {
                if (tankCategories[g][currentTank]) {
                    def = tankCategories[g][currentTank];
                    break;
                }
            }
            return (def && typeof def === "string") ? def : currentTank;
        }

        function populateTankOptions(filter = "") {
            const list = HTML.tankOptionsList;
            list.innerHTML = "";
            const q = filter.toLowerCase();
            for (const gName in tankCategories) {
                const matches = [];
                for (const k in tankCategories[gName]) {
                    const d = tankCategories[gName][k];
                    // Branch entries are presets/groupings, not wire-level tank codes.
                    // Expand their actual tank members instead of ever sending the
                    // branch object's array as a tank selection.
                    if (d && typeof d === "object" && Array.isArray(d.tanks)) {
                        d.tanks.forEach(tankKey => {
                            if (!tankCategories["Complete Tank Index"]?.[tankKey] && !Object.values(tankCategories).some(group => typeof group?.[tankKey] === "string")) return;
                            let tankName = tankCategories["Complete Tank Index"]?.[tankKey];
                            if (!tankName) {
                                for (const groupName in tankCategories) {
                                    if (typeof tankCategories[groupName]?.[tankKey] === "string") {
                                        tankName = tankCategories[groupName][tankKey];
                                        break;
                                    }
                                }
                            }
                            if (tankName && tankName.toLowerCase().includes(q)) matches.push({
                                key: tankKey,
                                name: `${tankName} · ${d.name}`
                            });
                        });
                        continue;
                    }
                    const n = typeof d === "string" ? d : d?.name;
                    if (n && n.toLowerCase().includes(q)) matches.push({
                        key: k,
                        name: n
                    });
                }
                if (matches.length) {
                    const lbl = document.createElement("div");
                    lbl.className = "k-dg";
                    lbl.textContent = gName;
                    list.appendChild(lbl);
                    matches.forEach(m => {
                        const item = document.createElement("div");
                        item.className = "k-di" + (m.key === currentTank ? " sel" : "");
                        item.textContent = m.name;
                        item.onclick = e => {
                            e.stopPropagation();
                            selectTank(m.key, m.name);
                        };
                        list.appendChild(item);
                    });
                }
            }
        }

        function selectTank(key) {
            if (key) currentTank = key;
            let def;
            for (const g in tankCategories) {
                if (tankCategories[g][currentTank]) {
                    def = tankCategories[g][currentTank];
                    break;
                }
            }
            if (def) {
                if (typeof def !== "string") {
                    const firstTank = Array.isArray(def.tanks) ? def.tanks.find(k => Object.values(tankCategories).some(group => typeof group?.[k] === "string")) : null;
                    if (firstTank) {
                        currentTank = firstTank;
                        return selectTank(firstTank);
                    }
                    closeDropdown();
                    return;
                }
                HTML.selectedTankDisplay.textContent = def;
                packetToAll("Z", currentTank);
                saveSettings();
            }
            closeDropdown();
        }

        // ── FIXED-POSITION DROPDOWN OPEN/CLOSE ──
        function positionTankDropdown() {
            if (!HTML.tankOptionsList.classList.contains("show")) return;
            const rect = HTML.tankTrigger.getBoundingClientRect();
            HTML.tankOptionsList.style.top = (rect.bottom + 6) + 'px';
            HTML.tankOptionsList.style.left = rect.left + 'px';
            HTML.tankOptionsList.style.width = rect.width + 'px';
        }

        function openDropdown() {
            HTML.tankOptionsList.classList.add("show");
            positionTankDropdown();
            HTML.selectedTankDisplay.style.display = "none";
            HTML.tankSearchInput.style.display = "block";
            HTML.tankSearchInput.value = "";
            HTML.tankSearchInput.focus();
            populateTankOptions();
        }

        function closeDropdown() {
            HTML.tankOptionsList.classList.remove("show");
            HTML.selectedTankDisplay.style.display = "block";
            HTML.tankSearchInput.style.display = "none";
        }

        HTML.tankTrigger.onclick = e => {
            e.stopPropagation();
            HTML.tankOptionsList.classList.contains("show") ? closeDropdown() : openDropdown();
        };
        HTML.tankSearchInput.oninput = () => populateTankOptions(HTML.tankSearchInput.value);
        HTML.tankSearchInput.onkeydown = e => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.preventDefault();
                const fi = HTML.tankOptionsList.querySelector(".k-di");
                if (fi) fi.click();
            }
        };
        window.addEventListener("click", e => {
            if (!HTML.tankContainer.contains(e.target) && !HTML.tankOptionsList.contains(e.target)) closeDropdown();
        });
        window.addEventListener("resize", positionTankDropdown);
        window.addEventListener("scroll", positionTankDropdown, true);

        loadSettings();
        populateTankOptions();
        setTimeout(() => selectTank(currentTank), 100);

        // Input change → save
        [HTML.botServerUrls, HTML.serverHash, HTML.botCount, HTML.clanTag, HTML.manualX, HTML.manualY, HTML.mouseSensitivity, HTML.spawnDelay].forEach(el => {
            el.addEventListener('input', () => {
                if (el === HTML.mouseSensitivity) HTML.sensitivityValue.textContent = el.value;
                saveSettings();
            });
        });
        HTML.chatMessage.addEventListener('input', () => {
            saveSettings();
        });
        [HTML.autofire, HTML.autospin, HTML.feeding, HTML.manualMode, HTML.followMouse].forEach(el => el.addEventListener('change', saveSettings));
        HTML.repeatChat.addEventListener('change', () => {
            saveSettings();
            if (!HTML.repeatChat.checked) {
                stopChatLoop();
                return;
            }
            const msg = HTML.chatMessage.value.trim();
            if (msg) startChatLoop(msg);
        });

        // ==========================================
        // 5. MULTI-SERVER WEBSOCKET
        // ==========================================
        let keys = {},
            menuVisible = true,
            wsArray = [];

        function copyCurrentPositionToManualInputs() {
            if (x === null || y === null || positionFreshUntil < performance.now()) {
                return false;
            }
            setManualCoordinateInputs(x, y);
            saveSettings();
            return true;
        }

        function syncCombatState() {
            const div = parseFloat(HTML.mouseSensitivity.value) || 20;
            const aim = getSafeAim(div);

            packetToAll("A",
                x, y,
                aim[0],
                aim[1],
                mouseDown, rMouseDown,
                HTML.mbs.checked,
                HTML.feeding.checked,
                keys["ShiftLeft"],
                HTML.autofire.checked,
                HTML.autospin.checked,
                false,
                0,
                0,
                false,
                MANUAL_COORD_SCALE,
                MANUAL_COORD_SCALE
            );
        }

        document.addEventListener("keydown", e => {
            if (keys[e.code]) return;
            keys[e.code] = true;
            if (e.key === "Escape") {
                menuVisible = !menuVisible;
                menu.style.display = menuVisible ? "flex" : "none";
                e.preventDefault();
                e.stopPropagation();
            }
            if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
                if (e.code === "KeyL") {
                    setPositionDisplay("Waiting for coordinates...");
                }
                if (e.code === "KeyE") {
                    HTML.autofire.checked = !HTML.autofire.checked;
                    saveSettings();
                    syncCombatState();
                }
                if (e.code === "KeyR") {
                    HTML.autospin.checked = !HTML.autospin.checked;
                    saveSettings();
                    syncCombatState();
                }
                if (e.code === "Digit1" || e.code === "Numpad1") packetToAll("T", "GG", false);
                if (e.code === "Digit2" || e.code === "Numpad2") packetToAll("T", "EZ", false);
                if (e.code === "Digit3" || e.code === "Numpad3") packetToAll("T", "WP", false);
                if (e.code === "Digit4" || e.code === "Numpad4") packetToAll("T", "?", false);
            }
        }, true);
        document.addEventListener("keyup", e => {
            keys[e.code] = false;
        }, true);

        let mouseX = 0,
            mouseY = 0,
            mouseDown = false,
            rMouseDown = false;
        let lastAimX = 0,
            lastAimY = -80;
        const AIM_AXIS_MAX = 126;
        const AIM_DEADZONE_PIXELS = 10;
        window.addEventListener("mousedown", e => {
            if (e.button == 0) mouseDown = true;
            else if (e.button == 2) rMouseDown = true;
            syncCombatState();
        });
        window.addEventListener("mouseup", e => {
            if (e.button == 0) mouseDown = false;
            else if (e.button == 2) rMouseDown = false;
            syncCombatState();
        });
        window.addEventListener("mousemove", e => {
            mouseX = e.clientX - (window.innerWidth / 2);
            mouseY = e.clientY - (window.innerHeight / 2);
        });

        function getSafeAim(div) {
            const dx = Number.isFinite(mouseX) ? mouseX : 0;
            const dy = Number.isFinite(mouseY) ? mouseY : 0;
            const distance = Math.hypot(dx, dy);
            if (distance < AIM_DEADZONE_PIXELS) {
                return [lastAimX, lastAimY];
            }
            const strength = Math.max(1, Math.min(100, Number(div) || 20));
            const magnitude = Math.max(70, Math.min(AIM_AXIS_MAX, 130 - strength * 0.4));
            lastAimX = dx / distance * magnitude;
            lastAimY = dy / distance * magnitude;
            return [lastAimX, lastAimY];
        }

        function packetToAll(...args) {
            const enc = msgpack.encode(args);
            wsArray.forEach(ws => {
                if (ws && ws.readyState === WebSocket.OPEN) ws.send(enc);
            });
        }

        function updateConnectionStatus() {
            const active = wsArray.filter(ws => ws.readyState === WebSocket.OPEN).length;
            const total = wsArray.length;
            if (active > 0) {
                HTML.serverStatus.innerHTML = `Live: ${active}/${total}`;
                HTML.serverStatusBadge.classList.add("live");
            } else {
                HTML.serverStatus.innerHTML = "Offline";
                HTML.serverStatusBadge.classList.remove("live");
            }
        }

        function connectAll() {
            wsArray.forEach(ws => {
                if (ws) ws.close();
            });
            wsArray = [];
            let urls = HTML.botServerUrls.value.split('\n').map(u => u.trim()).filter(u => u);
            if (!urls.length) urls = ["ws://localhost:8082"];
            HTML.serverStatus.innerHTML = "Connecting…";
            urls.forEach(url => {
                try {
                    let ws = new WebSocket(url);
                    ws.binaryType = "arraybuffer";
                    ws.onopen = () => {
                        updateConnectionStatus();
                        ws.send(msgpack.encode(["M", 72011]));
                    };
                    ws.onmessage = m => {
                        const d = msgpack.decode(new Uint8Array(m.data));
                        const type = d.shift();
                        if (type === "M") {
                            ws.send(msgpack.encode(["C", d[0] ^ 845]));
                            selectTank();
                        } else if (type === "U" || type === "P") {
                            const hash = d[0] || "";
                            const socketUrl = d[1] || "";
                            const error = d[2] || "";
                            if (socketUrl) {
                                HTML.serverStatus.innerHTML = type === "P" ? `Protocol live: #${hash}` : `URL ready: #${hash}`;
                                HTML.serverStatusBadge.classList.add("live");
                                isSpawning = false;
                                HTML.connectNoob.textContent = "Deploy Protocol";
                                HTML.connectNoob.classList.remove("spamming");
                                console.log("[Thara Protocol] Resolved socket URL:", socketUrl);
                                if (type === "U") alert(`Resolved socket URL for #${hash}:\n${socketUrl}`);
                            } else {
                                HTML.serverStatus.innerHTML = type === "P" ? "Protocol failed" : "URL failed";
                                HTML.serverStatusBadge.classList.remove("live");
                                isSpawning = false;
                                HTML.connectNoob.textContent = "Deploy Protocol";
                                HTML.connectNoob.classList.remove("spamming");
                                alert(`Failed to ${type === "P" ? "deploy protocol" : "resolve socket URL"}${hash ? " for #" + hash : ""}: ${error || "unknown error"}`);
                            }
                        }
                    };
                    ws.onclose = () => updateConnectionStatus();
                    ws.onerror = () => updateConnectionStatus();
                    wsArray.push(ws);
                } catch (e) {
                    console.error("Invalid URL:", url);
                }
            });
        }

        connectAll();
        HTML.reconnectServer.addEventListener("click", () => connectAll());

        let spawnInterval = null,
            isSpawning = false;
        HTML.connectNoob.addEventListener("click", () => {
            const hash = HTML.serverHash.value?.replace("#", "") || window.location.hash.slice(1);
            const countPerServer = parseInt(HTML.botCount.value) || 5;
            const delay = parseInt(HTML.spawnDelay.value) || 0;
            const clanName = HTML.clanTag.value.trim() || "";
            if (!hash) return alert("Please paste a server hash!");
            if (isSpawning) {
                clearInterval(spawnInterval);
                isSpawning = false;
                HTML.connectNoob.textContent = "▶ Deploy Protocol";
                HTML.connectNoob.classList.remove("spamming");
                return;
            }
            if (!wsArray.filter(ws => ws.readyState === WebSocket.OPEN).length) return alert("No active bot servers connected!");
            isSpawning = true;
            HTML.connectNoob.classList.add("spamming");
            HTML.connectNoob.textContent = `Protocol starting #${hash}...`;
            HTML.serverStatus.innerHTML = `Protocol resolving #${hash}...`;
            packetToAll("P", hash, countPerServer, clanName, delay);
        });

        HTML.deleteNoobs.addEventListener("click", () => {
            packetToAll("B");
            if (isSpawning) HTML.connectNoob.click();
        });

        // ==========================================
        // 6. MOVEMENT LOOP (30ms)
        // ==========================================
        setInterval(() => {
            if (positionFreshUntil && positionFreshUntil < performance.now() && x !== null && y !== null) {
                setPositionDisplay(`X: ${x.toFixed(1)}, Y: ${y.toFixed(1)} [STALE]`);
            }

            const div = parseFloat(HTML.mouseSensitivity.value) || 20;
            const uiManualActive = HTML.manualMode.checked && manualActive;
            const hasFreshParentPosition = x !== null && y !== null && positionFreshUntil >= performance.now();
            const hasKnownParentPosition = x !== null && y !== null;
            const followParentActive = HTML.mbs.checked && hasFreshParentPosition;
            const followMouseActive = HTML.followMouse.checked && hasKnownParentPosition;
            const targetModeActive = uiManualActive || followParentActive || followMouseActive;
            const mouseWorldX = hasKnownParentPosition ? x + (mouseX / FOLLOW_MOUSE_PIXEL_SCALE) : 0;
            const mouseWorldY = hasKnownParentPosition ? y + (mouseY / FOLLOW_MOUSE_PIXEL_SCALE) : 0;
            const targetX = followMouseActive ? mouseWorldX : (followParentActive ? x : (uiManualActive ? parseFloat(HTML.manualX.value) || 0 : 0));
            const targetY = followMouseActive ? mouseWorldY : (followParentActive ? y : (uiManualActive ? parseFloat(HTML.manualY.value) || 0 : 0));
            const aim = getSafeAim(div);
            packetToAll("A",
                x, y,
                aim[0],
                aim[1],
                mouseDown, rMouseDown,
                HTML.mbs.checked, HTML.feeding.checked, keys["ShiftLeft"],
                HTML.autofire.checked, HTML.autospin.checked,
                targetModeActive,
                targetX,
                targetY,
                followMouseActive,
                MANUAL_COORD_SCALE,
                MANUAL_COORD_SCALE
            );
        }, 30);

        // ==========================================
        // 7. AUTO RE-UPGRADE
        // ==========================================
        setInterval(() => {
            if (currentTank) packetToAll("Z", getResolvedTankCode());
        }, 1500);

    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", initController, {
            once: true
        });
    } else {
        initController();
    }
})();
