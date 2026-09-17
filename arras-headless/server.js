(async () => {
    const { Worker } = await import("worker_threads");
    const path = await import("path");
    const { WebSocketServer } = await import("ws");
    const { pack, unpack } = await import("msgpackr");
    const http = await import("http");
    const fetchModule = await import("node-fetch");
    const realFetch = fetchModule.default || fetchModule;


    const PROXIES = ["http://spjkufyo3c:bc9QQa_elQYmp63qg5@dc.decodo.com:10000/"];
    const prod = false;
    const WORKER_MEMORY_MB = 96;
    const BOTS_PER_WORKER = 2;
    const PREWARM_POOL_SIZE = 2;
    const SPAWN_BASE_DELAY_MS = 300;
    const SPAWN_JITTER_MS = 120;
    let arrasScriptCache = null;
    let arrasWasmCache = null;

    // HTTP SERVER
    const server = http.createServer((req, res) => {
        res.writeHead(426, { "Content-Type": "text/plain" });
        res.end("lll elk ez big fat noob");
    });


    // WS SERVER
    function randint(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    const botWorkerPath = path.join(__dirname, "index.js");

    function extractArrasScript(html) {
        const scriptTagStart = html.indexOf("<script>");
        if (scriptTagStart === -1) {
            throw new Error("Could not find arras script tag");
        }
        const scriptStart = scriptTagStart + 8;
        const scriptTagEnd = html.indexOf("</script", scriptStart);
        if (scriptTagEnd === -1) {
            throw new Error("Could not find arras script close tag");
        }
        return html.slice(scriptStart, scriptTagEnd);
    }

    async function preloadArrasAssets() {
        try {
            console.log("Preloading arras script + wasm...");
            const [htmlRes, wasmRes] = await Promise.all([
                realFetch("https://arras.io"),
                realFetch("https://arras.io/app.wasm")
            ]);

            const html = await htmlRes.text();
            const wasm = await wasmRes.arrayBuffer();

            arrasScriptCache = extractArrasScript(html);
            arrasWasmCache = new Uint8Array(wasm);
            console.log("Arras preload ready:", arrasScriptCache.length, "script chars,", arrasWasmCache.byteLength, "wasm bytes");
        } catch (err) {
            console.error("Arras preload failed. Bots will fall back to per-worker fetch:", err);
        }
    }

    function createBotWorker(session) {
        const worker = new Worker(botWorkerPath, {
            resourceLimits: {
                maxOldGenerationSizeMb: WORKER_MEMORY_MB,
                maxYoungGenerationSizeMb: 16,
                codeRangeSizeMb: 16,
            }
        });
        worker.send = (message) => worker.postMessage(message);
        worker.botId = null;
        worker.botIds = [];
        worker.activeBots = 0;
        worker.isPooled = false;
        worker.on("error", (err) => {
            console.error(`Bot worker ${worker.botId ?? "?"} error:`, err);
        });
        worker.on("message", (message) => {
            if (!message || message.type !== "log") { return; }
            console.log(`[bot ${message.id ?? worker.botId ?? "?"}] ${message.message}`);
        });
        worker.on("exit", (code) => {
            worker.activeBots = 0;
            worker.botIds = [];
            let idx = session.workers.indexOf(worker);
            if (idx !== -1) {
                session.workers.splice(idx, 1);
            }
            idx = session.pool.indexOf(worker);
            if (idx !== -1) {
                session.pool.splice(idx, 1);
            }
            if (code !== 0) {
                console.log(`Bot worker ${worker.botId ?? "?"} exited with code`, code);
            }
        });
        return worker;
    }

    function prepareWorker(worker) {
        worker.send({
            type: "prepare",
            arrasCache: arrasScriptCache,
            wasmCache: arrasWasmCache,
        });
    }

    function fillPool(session) {
        while (session.pool.length < PREWARM_POOL_SIZE) {
            const worker = createBotWorker(session);
            worker.isPooled = true;
            session.pool.push(worker);
            prepareWorker(worker);
        }
    }

    function acquireWorker(session) {
        let worker = session.workers.find((candidate) => candidate.activeBots < BOTS_PER_WORKER);
        if (worker) {
            return worker;
        }

        worker = session.pool.shift() || createBotWorker(session);
        worker.isPooled = false;
        if (!session.workers.includes(worker)) {
            session.workers.push(worker);
        }
        return worker;
    }

    function queueBotSpawn(session, hash, botName) {
        session.spawnQueue.push({ hash, botName });
        processSpawnQueue(session);
    }

    function processSpawnQueue(session) {
        if (session.spawnQueueActive) { return; }
        const job = session.spawnQueue.shift();
        if (!job) {
            fillPool(session);
            return;
        }

        session.spawnQueueActive = true;
        const botId = session.nextBotId++;
        const spawnDelay = SPAWN_BASE_DELAY_MS + randint(0, SPAWN_JITTER_MS);

        session.spawnTimer = setTimeout(() => {
            session.spawnTimer = null;
            if (session.proxyIdx >= PROXIES.length) {
                session.proxyIdx = 0;
            }

            const worker = acquireWorker(session);
            worker.botId = botId;
            worker.botIds.push(botId);
            worker.activeBots++;
            console.log(`Starting bot ${botId} in worker slot ${worker.activeBots}/${BOTS_PER_WORKER} after queued ${spawnDelay}ms (${session.spawnQueue.length} waiting)`);

            let selectedTank = session.tank;
            if (session.tanks.length) {
                selectedTank = session.tanks[session.tankIdx];
                session.tankIdx++;
                if (session.tankIdx >= session.tanks.length) {
                    session.tankIdx = 0;
                }
            }

            worker.send({
                type: "start", config: {
                    id: botId,
                    proxy: {
                        type: "http",
                        url: PROXIES[session.proxyIdx]
                    },
                    hash: "#" + job.hash,
                    name: job.botName,
                    stats: [0, 0, 0, 0, 0, 0, 0, 9],
                    type: "follow",
                    token: "follow-8fe6ca",
                    autoFire: false,
                    autoRespawn: true,
                    keys: [],
                    keysHold: [],
                    tank: "Auto4",
                    chatSpam: "",
                    initialTarget: { tank: selectedTank },
                    squadId: job.hash,
                    reconnectAttempts: 5,
                    reconnectDelay: 8000,
                    arrasCache: arrasScriptCache,
                    wasmCache: arrasWasmCache,
                }
            });

            session.proxyIdx++;
            session.spawnQueueActive = false;
            processSpawnQueue(session);
        }, spawnDelay);
    }

    const sessions = new Map();
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws, req) => {
        const addr = req.socket.remoteAddress;
        console.log(addr, "connected");

        // Initialize or retrieve session for this IP
        if (!sessions.has(addr)) {
            sessions.set(addr, {
                workers: [],
                pool: [],
                spawnQueue: [],
                spawnQueueActive: false,
                spawnTimer: null,
                spawnTimers: new Set(),
                nextBotId: 0,
                tank: "auto6",
                tanks: [],
                tankIdx: 0,
                proxyIdx: 0
            });
        }
        const session = sessions.get(addr);

        let challenge;
        let verified = false;

        function packet(...args) {
            ws.send(pack(args));
        }

        function close() {
            ws.close();
            // We only destroy workers if explicitly told to, or if the session is terminated.
            // For now, we don't destroy them on socket close to support refresh.
        }

        ws.on("message", (msg) => {
            try {
                const data = unpack(msg);
                const type = data.shift();

                switch (type) {
                    case "M":
                        if (challenge || data[0] != 72011) {
                            close();
                        }

                        challenge = randint(0b1000000000, 0b1111111111);
                        packet("M", challenge);
                        break;

                    case "C":
                        if (data[0] == (challenge ^ 845)) {
                            verified = true;
                            console.log(addr, "verified");
                            fillPool(session);
                        } else {
                            close();
                            console.log(addr, "true noob")
                        }

                        break;

                    case "Z":
                        session.tank = data[0];
                        if (session.tank instanceof Array) {
                            session.tanks = session.tank;
                            session.tankIdx = 0;

                            for (const worker of session.workers) {
                                for (const botId of worker.botIds) {
                                    const t = session.tanks[session.tankIdx];
                                    worker.send({ type: "tankselect", tank: t, botId });

                                    session.tankIdx++;
                                    if (session.tankIdx >= session.tanks.length) {
                                        session.tankIdx = 0;
                                    }
                                }
                            }
                        } else {
                            session.tanks = [];
                            for (const worker of session.workers) {
                                worker.send({ type: "tankselect", tank: session.tank })
                            }
                        }

                        break;

                    case "F":
                        if (verified) {
                            const hash = data[0];
                            const count = parseInt(data[1]) || 1;
                            const botName = String(data[2] || "thara's Bot").trim() || "thara's Bot";

                            console.log(`Queueing ${count} bots for hash: ${hash}`);
                            for (let i = 0; i < count; i++) {
                                queueBotSpawn(session, hash, botName);
                            }
                        }

                        break;

                    case "B":
                        if (verified) {
                            session.spawnQueue = [];
                            session.spawnQueueActive = false;
                            if (session.spawnTimer) {
                                clearTimeout(session.spawnTimer);
                                session.spawnTimer = null;
                            }
                            for (const timer of session.spawnTimers) {
                                clearTimeout(timer);
                            }
                            session.spawnTimers.clear();
                            for (const worker of session.workers) {
                                worker.send({ type: "destroy" });
                            }
                            session.workers = [];
                        }

                        break;

                    case "A":
                        if (verified) {
                            for (const worker of session.workers) {
                                worker.send({
                                    type: "position",
                                    x: data[0],
                                    y: data[1],
                                    mouseX: data[2],
                                    mouseY: data[3],
                                    mouseDown: data[4],
                                    rMouseDown: data[5],
                                    mouse: data[6],
                                    feeding: data[7],
                                    shift: data[8],
                                    autofire: data[9],
                                    autospin: data[10],
                                    manualMode: data[11],
                                    manualX: data[12],
                                    manualY: data[13]
                                });
                            }
                        }
                        break;

                    case "T":
                        if (verified) {
                            for (const worker of session.workers) {
                                worker.send({
                                    type: "chat",
                                    message: data[0],
                                    spam: data[1]
                                });
                            }
                        }
                        break;

                    default:
                        close();
                        break;
                }
            } catch (e) {
                console.error(e);
            }
        });

        ws.on("close", () => {
            console.log(addr, "disconnected (session retained)");
        });
    });


    const port = prod ? process.env.PORT : 8082;
    await preloadArrasAssets();
    server.listen(port, () => {
        console.log("Server listening on port!!!!", port);
    });
})();
