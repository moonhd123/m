(async () => {
  const { WebSocket } = await import('ws');
  const { HttpsProxyAgent } = await import('https-proxy-agent');
  const { SocksProxyAgent } = await import('socks-proxy-agent');
  const { parentPort } = await import('worker_threads');
  const { monitorEventLoopDelay } = await import('perf_hooks');
  const url = await import('url');
  const vm = await import('vm');
  //const fs = await import('fs');
  const fetchModule = await import('node-fetch');
  const realFetch = fetchModule.default || fetchModule;
  const ipc = parentPort || process;
  const sendParent = function (message) {
    if (parentPort) {
      parentPort.postMessage(message);
    } else if (process.send) {
      process.send(message);
    }
  };

  // ===== CHECK FOR COMMAND LINE ARGUMENTS =====
  const args = process.argv.slice(2);

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      autoStartCount = parseInt(args[i + 1]);
      autoStartMode = true;
      break;
    }
  }

  process.on('uncaughtException', function (e) { console.log(e) });
  // --- WORKER PROCESS (Bot logic) ---
  let isPaused = false;
  let currentBotInterface = {};
  let currentBotInterfaces = [];
  let devastate = () => {
    for (const bot of currentBotInterfaces) {
      if (bot && bot.destroy) {
        bot.destroy();
      }
    }
  };
  let sharedTarget = {
    tank: 'basic',
    followMouse: true,
    feed: false,
    shift: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    rMouseDown: false,
    autofire: false,
    autospin: false,
    manualMode: false,
    manualX: 0,
    manualY: 0,
    chatSpam: ""
  };
  //const names = fs.readFileSync("names.txt").toString().split("\n");

  const builds = {
    basic: "0/4/6/7/7/7/7/4",
    triangle: "0/2/3/7/7/7/7/7",
    smasher: "12/12/0/0/0/0/3/12/2/1",
    // Team-support preset: survivability + sustain for siege-style play.
    siegeHealer: "0/12/0/0/0/0/12/12/3/3",
    // Ram preset: prioritize body-contact stats while retaining mobility.
    ramPursuer: "12/12/0/0/0/0/0/12/3/3"
  };

  const upgrade_map = {
    1: 50,
    2: 90,
    3: 120,
    4: 180
  };

  const tanks = {
    basic: {
      path: "",
      build: ""
    },

    // OTHER
    pursuer: {
      path: "uyiy",
      build: builds.ramPursuer
    },
    anni: {
      path: "kyu",
      build: builds.basic
    },
    shotgun: {
      path: "kj",
      build: builds.basic
    },
    penta: {
      path: "yuy",
      build: builds.basic
    },
    spread: {
      path: "yuu",
      build: builds.basic
    },
    octo: {
      path: "hyyc",
      build: "3/3/0/7/8/7/9/3/1/1"
    },
    autogunner: {
      path: "iiy",
      build: builds.basic
    },
    triplet: {
      path: "yuj",
      build: builds.basic
    },
    predator: {
      path: "uuy",
      build: builds.basic
    },
    triplex: {
      path: "yjy",
      build: builds.basic
    },
    quadruplex: {
      path: "yju",
      build: builds.basic
    },
    machinegunner: {
      path: "iih",
      build: builds.basic
    },
    cyclone: {
      path: "hyuc",
      build: builds.basic
    },
    factory: {
      path: "jhy",
      build: builds.basic
    },
    septatrap: {
      path: "hjic",
      build: "0/6/0/9/9/9/9"
    },

    // ANNIES
    obliterator: {
      path: "vkyuy",
      build: builds.basic
    },
    compound: {
      path: "kyui",
      build: builds.basic
    },
    wiper: {
      path: "kyuj",
      build: builds.basic
    },
    stomper: {
      path: ["k", "y", "u", [1, 3]],
      build: builds.basic
    },
    autoanni: {
      path: ["k", "y", "u", [2, 3]],
      build: builds.basic
    },
    shaver: {
      path: ["k", "y", "u", [2, 4]],
      build: builds.basic
    },
    eradicator: {
      path: ["k", "y", "u", [1, 4]],
      build: builds.basic
    },

    // FOR CRASH
    whirlwind: {
      path: "chyuk",
      build: "9/9/0/0/0/0/9"
    },
    tempest: {
      path: "chyuh",
      build: "9/9/0/0/0/0/9"
    },
    septamech: {
      path: "chjkh",
      build: "9/9/0/0/0/0/9"
    },
    doubleequalizer: {
      path: "yjyk",
      build: "9/9/0/0/0/0/9"
    },
    rigger: {
      path: "yjkk",
      build: "9/9/0/0/0/0/9"
    },
    doublespread: {
      path: "yuuy",
      build: "9/9/0/0/0/0/9"
    },
    palisade: {
      path: ["h", "j", "y", [3, 3]],
      build: "9/9/0/0/0/0/9"
    },

    // SMASHERS
    megasmasher: {
      path: ["r", [3, 3], "y"],
      build: builds.smasher
    },
    spike: {
      path: ["r", [3, 3], "u"],
      build: builds.smasher
    },
    autoshasher: {
      path: ["r", [3, 3], "i"],
      build: builds.smasher
    },
    landmine: {
      path: ["r", [3, 3], "h"],
      build: builds.smasher
    },

    thorn: {
      path: ["r", [2, 3], "u", "y"],
      build: builds.smasher
    },
    megaspike: {
      path: ["r", [2, 3], "u", "u"],
      build: "12/12/0/0/0/0/0/7/3/8" // bc its faster by default
    },
    claymore: {
      path: ["r", [2, 3], "u", "i"],
      build: builds.smasher
    },
    spear: {
      path: ["r", [2, 3], "u", "j"],
      build: builds.smasher
    },
    prick: {
      path: ["r", [2, 3], "u", "k"],
      build: builds.smasher
    },

    slammer: {
      path: [[2, 3], "k", "y"],
      build: "8/10/12/0/0/0/0/12"
    },
    basher: {
      path: [[2, 3], "j", "j"],
      build: "8/10/12/0/0/0/0/12"
    },
    physician: {
      path: [[2, 3], [3, 3]],
      build: "0/12/0/0/0/0/12/12/3/3"
    },

    // DPS
    toppler: {
      path: "uijh",
      build: builds.basic
    },
    crack: {
      path: "yuyj",
      build: builds.basic
    },
    autooperator: {
      path: [[1, 3], "j", "j", [2, 3]],
      build: builds.basic
    },
    lorry: {
      path: "ihyy",
      build: "3/3/0/7/8/7/9/3/1/1"
    },

    // BUILDERS
    engineer: {
      path: "kui",
      build: builds.basic
    },
    assembler: {
      path: "kuj",
      build: builds.basic
    },
    architect: {
      path: "kuk",
      build: builds.basic
    },

    // AUTO
    auto5: {
      path: "hiy",
      build: builds.basic
    },
    mega3: {
      path: "hiu",
      build: builds.basic
    },
    auto6: {
      path: "hiiy",
      build: builds.basic
    },

    auto7: {
      path: "hiyy",
      build: builds.basic
    },
    mega5: {
      path: "hiyu",
      build: builds.basic
    },
    autoauto4: {
      path: "hiii",
      build: builds.basic
    },
    hurler3: {
      path: "hiui",
      build: builds.basic
    },
    batter4: {
      path: "hiiu",
      build: builds.basic
    },

    // LAUNCHERS
    skimmer: {
      path: "khy",
      build: builds.basic
    },
    twister: {
      path: "khu",
      build: builds.basic
    },
    swarmer: {
      path: "khi",
      build: builds.basic
    },
    sidewinder: {
      path: "khh",
      build: builds.basic
    },
    fieldgun: {
      path: "khj",
      build: builds.basic
    },

    // AR LAUNCHERS
    spinner: {
      path: "khju",
      build: builds.basic
    },
    helix_ar: {
      path: "khuh",
      build: builds.basic
    },
    hypertwister: {
      path: "khui",
      build: builds.basic
    },
    gyro: {
      path: "khuk",
      build: builds.basic
    },
    coli: {
      path: ["k", "h", "u", [3, 3]],
      build: builds.basic
    },

    hyperskimmer: {
      path: "khyi",
      build: builds.basic
    },
    skidder: {
      path: "khjy",
      build: builds.basic
    },
    ream: {
      path: "khyh",
      build: builds.basic
    },

    hyperswarmer: {
      path: "khih",
      build: builds.basic
    },
    molotov: {
      path: "khij",
      build: builds.basic
    },

    firework: {
      path: "khky",
      build: builds.basic
    },
    levi: {
      path: "khkh",
      build: builds.basic
    },

    hypercluster: {
      path: ["k", "h", [4, 2], "h"],
      build: builds.basic
    },
    neutron: {
      path: ["k", "h", [4, 2], [1, 4]],
      build: builds.basic
    },

    // DRONES
    overczar: {
      path: "jyyy",
      build: builds.basic
    },
    tyrant: {
      path: "jyyk",
      build: builds.basic
    },
    autooverlord: {
      path: "jyyj",
      build: builds.basic
    },
    megaautooverseer: {
      path: "jyiy",
      build: builds.basic
    },
    tripleautooverseer: {
      path: "jyiu",
      build: builds.basic
    },
    autooverdrive: {
      path: "jyhh",
      build: builds.basic
    },
    headman: {
      path: "jkyy",
      build: builds.basic
    },
    overcheese: {
      path: "jkyu",
      build: builds.basic
    },
    overstorm: {
      path: "jjyu",
      build: builds.basic
    },

    // NECRO
    diviner: {
      path: "jiyy",
      build: builds.basic
    },
    autonecro: {
      path: "jiyi",
      build: builds.basic
    },
    necrodrive: {
      path: "jiyh",
      build: builds.basic
    },
    megaautounderdrive: {
      path: "jiiy",
      build: builds.basic
    },
    tripleautounderdrive: {
      path: "jiiu",
      build: builds.basic
    },

    pentamancer: {
      path: "jiky",
      build: builds.basic
    },
    pentadrive: {
      path: "jikh",
      build: builds.basic
    },
    warlock: {
      path: "jikj",
      build: builds.basic
    },
    autopentaseer: {
      path: "jiki",
      build: builds.basic
    },

    // CARRIER
    warship: {
      path: "juuy",
      build: builds.basic
    },
    battlerdrive: {
      path: "jjiu",
      build: builds.basic
    },
    bismarck: {
      path: "juku",
      build: builds.basic
    },
    proddrive: {
      path: "jjjj",
      build: builds.basic
    },
    manufacture: {
      path: "jukj",
      build: builds.basic
    },
    dirigible: {
      path: "jukk",
      build: builds.basic
    },
    autobattleship: {
      path: "juhh",
      build: builds.basic
    },
    autoprod: {
      path: "juki",
      build: builds.basic
    },
    autocruiserdrive: {
      path: "jjih",
      build: builds.basic
    },


    // TRI ANGLE
    rocket: {
      path: "huuy",
      build: "8/8/0/0/0/0/8/8/2/8"
    },
    fighter: {
      path: "huy",
      build: builds.triangle
    },
    bomber: {
      path: "huh",
      build: builds.triangle
    },
    autotriangle: {
      path: "huj",
      build: builds.triangle
    },
    surfer: {
      path: "huk",
      build: builds.triangle
    },
    eagle: {
      path: "kk",
      build: builds.triangle
    },
    phoenix: {
      path: "ihu",
      build: builds.triangle
    },
    vulture: {
      path: "uij",
      build: builds.triangle
    },

    // ARMS RACE TRI ANGLE
    // surfer
    browser: {
      path: "huky",
      build: builds.triangle
    },
    surferdrive: {
      path: "huki",
      build: builds.triangle
    },
    roller: {
      path: "hukh",
      build: builds.triangle
    },
    strider: {
      path: "hukk",
      build: builds.triangle
    },

    // auto tri angle
    megaautotriangle: {
      path: "hujy",
      build: builds.triangle
    },
    tripleautotriangle: {
      path: "huju",
      build: builds.triangle
    },
    autofighter: {
      path: "huji",
      build: builds.triangle
    },
    autobomber: {
      path: "hujk",
      build: builds.triangle
    },

    // taser
    kicker: {
      path: "uikj",
      build: builds.triangle
    },
    electrocutor: {
      path: "uiki",
      build: builds.triangle
    },

    // eagle
    autoeagle: {
      path: "kkk",
      build: builds.triangle
    },
    griffin: {
      path: "kkh",
      build: builds.triangle
    },

    // BASIC & TREE TANKS
    twin: {
      path: "y",
      build: builds.basic
    },
    doubletwin: {
      path: "yy",
      build: builds.basic
    },
    tripleshot: {
      path: "yu",
      build: builds.basic
    },
    sniper: {
      path: "u",
      build: builds.basic
    },
    machinegun: {
      path: "i",
      build: builds.basic
    },
    sprayer: {
      path: "ih",
      build: builds.basic
    },
    redistributor: {
      path: "ihy",
      build: builds.basic
    },
    flankguard: {
      path: "h",
      build: builds.basic
    },
    hexatank: {
      path: "hy",
      build: builds.basic
    },
    octotank: {
      path: "hyy",
      build: "3/3/0/7/8/7/9/3/1/1"
    },
    hexatrapper: {
      path: "hyi",
      build: builds.basic
    },
    triangle: {
      path: "hu",
      build: builds.basic
    },
    booster: {
      path: "huu",
      build: builds.triangle
    },
    falcon: {
      path: "hui",
      build: builds.triangle
    },
    auto3: {
      path: "hui",
      build: builds.basic
    },
    auto4: {
      path: "hii",
      build: builds.basic
    },
    banshee: {
      path: "huih",
      build: builds.basic
    },
    trapguard: {
      path: "hh",
      build: builds.basic
    },
    buchwhacker: {
      path: "hhy",
      build: builds.basic
    },
    gunnertrapper: {
      path: "hhu",
      build: builds.basic
    },
    conqueror: {
      path: "hhj",
      build: builds.basic
    },
    bulwark: {
      path: "hhk",
      build: builds.basic
    },
    parapet: {
      path: "hhjy",
      build: "3/3/0/7/8/7/8/5/1/0"
    },
    tritrapper: {
      path: "hj",
      build: builds.basic
    },
    fortress: {
      path: "hjy",
      build: builds.basic
    },
    septatrapper: {
      path: "hji",
      build: builds.basic
    },
    tripletwin: {
      path: "hk",
      build: builds.basic
    },
    director: {
      path: "j",
      build: builds.basic
    },
    pounder: {
      path: "k",
      build: builds.basic
    },
    automingler: {
      path: "hykj",
      build: "2/3/2/7/8/7/9/3/1/0"
    },
    mingler: {
      path: "hyk",
      build: builds.basic
    },
    underseer: {
      path: "ji",
      build: builds.basic
    },
    rocketeer: {
      path: "khk",
      build: builds.basic
    },
    destroyer: {
      path: "ky",
      build: builds.basic
    },
    launcher: {
      path: "kh",
      build: builds.basic
    },
    gale: {
      path: "hyyi",
      build: "3/3/0/7/8/7/9/3/1/1"
    },

    gunner: {
      path: "ii",
      build: builds.basic
    },
    nailgun: {
      path: "iiu",
      build: builds.basic
    },
    pincer: {
      path: "iiuk",
      build: builds.basic
    },
    nona: {
      path: "hjiy",
      build: builds.basic
    },
    septamachine: {
      path: "hjiu",
      build: builds.basic
    },
    assassin: {
      path: "uy",
      build: builds.basic
    },
    stalker: {
      path: "uyi",
      build: builds.basic
    },
    healer: {
      path: "x",
      build: builds.siegeHealer
    },
    siegehealer: {
      path: "x",
      build: builds.siegeHealer
    },

    overseer: {
      path: "jy",
      build: builds.basic
    },
    cruiser: {
      path: "ju",
      build: builds.basic
    },
    spawner: {
      path: "jh",
      build: builds.basic
    },
    directordrive: {
      path: "jj",
      build: builds.basic
    },
    honcho: {
      path: "jk",
      build: builds.basic
    },
    manager: {
      path: "jx",
      build: builds.basic
    },
    foundry: {
      path: "jh",
      build: builds.basic
    },
    topbanana: {
      path: "jh",
      build: builds.basic
    },
    shopper: {
      path: "jh k",
      build: builds.basic
    },
    megaspawner: {
      path: "jhi",
      build: builds.basic
    },
    ultraspawner: {
      path: "jhiy",
      build: builds.basic
    },
    chemist: {
      path: [[2, 3], [1, 2], [1, 2]],
      build: "3/3/0/7/8/7/9/3/1/1"
    },
    jerker: {
      path: [[2, 1], [3, 1], [2, 3], [3, 3]],
      build: builds.smasher
    },
    lever: {
      path: "hikh",
      build: builds.basic
    },
    hognose: {
      path: ["k", "h", "h", [3, 4]],
      build: builds.basic
    },
    limpet: {
      path: [[2, 3], [1, 2], [1, 1]],
      build: builds.smasher
    }
  };

  const options = { start: () => { } };

  WebAssembly.instantiateStreaming = false
  const arras = (function () {
    const log = function () {
      global.console.log(`[headless]`, ...arguments)
    }

    let app = false
    const wasm = function () {
      return {
        arrayBuffer: function () {
          return app
        }
      }
    }
    let lastStatus = 0, statusData = ''
    const getStatus = function (f, s) {
      let now = global.performance.now()
      if (statusData && now - lastStatus < 15000) {
        return {
          then: function () {
            return {
              then: function (f) {
                let i = JSON.parse(statusData)
                s(i)
                f(i)
              }
            }
          }
        }
      }
      let then = function () { }
      realFetch(f).then(x => x.text()).then(x => {
        statusData = x
        let i = JSON.parse(x)
        s(i)
        then(i)
      })
      return {
        then: function () {
          return {
            then: function (f) {
              then = f
            }
          }
        }
      }
    }

    let ready = false, script = false, o = [], then = function (f) {
      if (ready) {
        f();
      } else {
        o.push(f);
      }
    };

    const initializeAndRunQueue = function () {
      ready = true;
      //log('Headless arras ready.');
      for (let i = 0, l = o.length; i < l; i++) {
        o[i]();
      }
      o = [];
      then = function (f) {
        f();
      };
    }

    let prerequisites = 0;
    const onPrerequisiteLoaded = function () {
      prerequisites++;
      if (prerequisites === 2) {
        initializeAndRunQueue();
      }
    }

    const toArrayBuffer = function (value) {
      if (!value) { return null; }
      if (value instanceof ArrayBuffer) {
        return value.slice(0);
      }
      if (ArrayBuffer.isView(value)) {
        return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      }
      return null;
    }

    const loadWasm = function () {
      const cachedWasm = toArrayBuffer(options.wasmCache);
      if (cachedWasm) {
        app = cachedWasm;
        onPrerequisiteLoaded();
        return;
      }

      realFetch('https://arras.io/app.wasm').then(x => {
        x.arrayBuffer().then(x => {
          app = x;
          //log('Prerequisite 1/2: app.wasm loaded.');
          onPrerequisiteLoaded();
        })
      });
    }

    const loadScript = function () {
      const activateBot = (scriptContent) => {
        script = scriptContent;
        //log('Prerequisite 2/2: Game script loaded.');
        onPrerequisiteLoaded();
      };

      const extractScriptFromHtml = (html) => {
        const scriptTagStart = html.indexOf('<script>');
        if (scriptTagStart === -1) {
          log('Error: Could not find <script> tag in content.');
          return null;
        }
        let scriptContent = html.slice(scriptTagStart + 8);
        const scriptTagEnd = scriptContent.indexOf('</script');
        if (scriptTagEnd === -1) {
          log('Error: Could not find closing </script> tag.');
          return null;
        }
        scriptContent = scriptContent.slice(0, scriptTagEnd);
        return scriptContent;
      };

      if (options.arrasCache) {
        activateBot(options.arrasCache);
        return;
      }

      //log('Fetching from https://arras.io to ensure correct script execution order...');
      realFetch('https://arras.io').then(x => x.text()).then(html => {
        const extractedScript = extractScriptFromHtml(html);
        if (extractedScript) {
          activateBot(extractedScript);
        }
      }).catch(err => {
        log('FATAL: Could not fetch from arras.io. Please check network or use a valid cache file.', err);
      });
    }

    let loadingPrerequisites = false;
    const ensurePrerequisites = function () {
      if (ready || loadingPrerequisites) { return; }
      loadingPrerequisites = true;
      loadWasm();
      loadScript();
    }

    const createBotGlobalScope = function () {
      const scope = {
        console: globalThis.console,
        setInterval: globalThis.setInterval.bind(globalThis),
        clearInterval: globalThis.clearInterval.bind(globalThis),
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
        WebAssembly: globalThis.WebAssembly,
        Buffer: globalThis.Buffer,
        Uint8Array: globalThis.Uint8Array,
        ArrayBuffer: globalThis.ArrayBuffer,
        DataView: globalThis.DataView,
        TextEncoder: globalThis.TextEncoder,
        TextDecoder: globalThis.TextDecoder,
        URL: globalThis.URL,
        URLSearchParams: globalThis.URLSearchParams,
        Promise: globalThis.Promise,
        Math: globalThis.Math,
        Date: globalThis.Date,
        JSON: globalThis.JSON,
        Object: globalThis.Object,
        Array: globalThis.Array,
        Number: globalThis.Number,
        String: globalThis.String,
        Boolean: globalThis.Boolean,
        RegExp: globalThis.RegExp,
        Error: globalThis.Error,
        TypeError: globalThis.TypeError,
        Map: globalThis.Map,
        WeakMap: globalThis.WeakMap,
        Set: globalThis.Set,
        Proxy: globalThis.Proxy,
        Reflect: globalThis.Reflect,
        parseInt: globalThis.parseInt,
        parseFloat: globalThis.parseFloat,
        isNaN: globalThis.isNaN,
      };
      scope.atob = function (value) {
        return Buffer.from(String(value), 'base64').toString('binary');
      };
      scope.btoa = function (value) {
        return Buffer.from(String(value), 'binary').toString('base64');
      };
      scope.global = scope;
      scope.globalThis = scope;
      scope.self = scope;
      return scope;
    };

    const run = function (x, config, oa) {
      const global = createBotGlobalScope();
      // Each bot gets its own control-state object. Commands are broadcast into
      // these objects below, while startup-only state (notably tank selection)
      // cannot be overwritten by the next bot assigned to this Worker.
      const target = { ...sharedTarget, ...(config.initialTarget || {}) };
      let trigger = {};
      // These values track transitions consumed by one bot. Keeping them at
      // Worker scope means the first of two bots consumes the transition and
      // the second bot never receives the corresponding key press/chat tick.
      let lastAutofire = false;
      let lastAutospin = false;
      let lastChatAt = 0;
      const log = function () {
        global.console.log(`[headless ${config.id}]`, ...arguments)
      }
      const statusLog = function () {
        const message = Array.from(arguments).join(' ');
        log(message);
        sendParent({ type: 'log', id: config.id, message });
      }

      const eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
      eventLoopMonitor.enable();
      let lastCpuUsage = process.cpuUsage();
      let lastDiagAt = Date.now();
      let wsMessageCount = 0;
      let wsMessageBytes = 0;
      let deathTrigger = '';
      const healthInterval = global.setInterval(function () {
        const now = Date.now();
        const elapsedMs = Math.max(now - lastDiagAt, 1);
        const cpu = process.cpuUsage(lastCpuUsage);
        lastCpuUsage = process.cpuUsage();
        lastDiagAt = now;
        const cpuPct = ((cpu.user + cpu.system) / 1000 / elapsedMs) * 100;
        const mem = process.memoryUsage();
        const lagMeanMs = Number.isFinite(eventLoopMonitor.mean) ? eventLoopMonitor.mean / 1e6 : 0;
        const lagMaxMs = Number.isFinite(eventLoopMonitor.max) ? eventLoopMonitor.max / 1e6 : 0;
        if (connected || inGame || wsMessageCount > 0) {
          statusLog(`[diag] cpu=${cpuPct.toFixed(1)}% rss=${(mem.rss / 1048576).toFixed(1)}MB heap=${(mem.heapUsed / 1048576).toFixed(1)}MB lagMean=${lagMeanMs.toFixed(1)}ms lagMax=${lagMaxMs.toFixed(1)}ms wsMsgs=${wsMessageCount} wsMB=${(wsMessageBytes / 1048576).toFixed(2)} deathTrigger=${deathTrigger || 'none'}`);
        }
        wsMessageCount = 0;
        wsMessageBytes = 0;
        eventLoopMonitor.reset();
      }, 5000);

      const internalBotInterface = {
        id: config.id,
        log: log,
        updateTarget: (patch) => Object.assign(target, patch),
        simulateKey: (code) => {
          if (trigger.keydown && trigger.keyup) {
            trigger.keydown(code);
            setTimeout(() => trigger.keyup(code), 50);
          }
        }
      };

      let destroy = function () {
        if (destroyed) { return }
        destroyed = true
        log('Destroying instance...')
        for (const key of "WASD") {
          try { trigger.keyup("Key" + key); } catch (_) {}
        }
        if (gameSocket && gameSocket.readyState < 3) {
          try { gameSocket.close() } catch (_) {}
          gameSocket = false
        }
        clearInterval(healthInterval)
        eventLoopMonitor.disable()
        clearInterval(mainInterval)
        for (const key of Object.keys(timeouts)) {
          delete timeouts[key]
        }
      }, destroyed = false

      const setInterval = new Proxy(global.setInterval, {
        apply: function (a, b, c) {
          if (destroyed) { return }
          return Reflect.apply(a, b, c)
        }
      }), setTimeout = new Proxy(global.setTimeout, {
        apply: function (a, b, c) {
          if (destroyed) { return }
          return Reflect.apply(a, b, c)
        }
      })
      const h = function (o) {
        return new Proxy(o, {
          get: function (a, b, c) {
            let d = Reflect.get(a, b, c)
            return d
          }, set: function (a, b, c) {
            return Reflect.set(a, b, c)
          }
        })
      }
      const elementListeners = new WeakMap();
      const allElements = [];
      const handleListener = function (type, f, element) {
        if (!element) return;
        if (!elementListeners.has(element)) {
          elementListeners.set(element, {});
        }
        const listeners = elementListeners.get(element);
        if (!listeners[type]) {
          listeners[type] = [];
        }
        listeners[type].push(f);
      }
      const broadcastEvent = (type, event) => {
        const targets = [global.window, global.document, ...allElements];
        for (const target of targets) {
          const listeners = elementListeners.get(target);
          if (listeners && listeners[type]) {
            for (const f of listeners[type]) {
              try { f.call(target, event); } catch (e) { }
            }
          }
        }
      };

      trigger = {
        mousemove: function (clientX, clientY) {
          broadcastEvent('mousemove', {
            isTrusted: true,
            clientX: clientX,
            clientY: clientY
          });
        },
        mousedown: function (clientX, clientY, button) {
          broadcastEvent('mousedown', {
            isTrusted: true,
            clientX: clientX,
            clientY: clientY,
            button: button
          });
        },
        mouseup: function (clientX, clientY, button) {
          broadcastEvent('mouseup', {
            isTrusted: true,
            clientX: clientX,
            clientY: clientY,
            button: button
          });
        },
        keydown: function (code, repeat) {
          broadcastEvent('keydown', {
            isTrusted: true,
            code: code,
            key: '',
            repeat: repeat || false,
            preventDefault: function () { }
          });
        },
        keyup: function (code, repeat) {
          broadcastEvent('keyup', {
            isTrusted: true,
            code: code,
            key: '',
            repeat: repeat || false,
            preventDefault: function () { }
          });
        }
      }

      global.window = global.parent = global.top = {
        WebAssembly,
        googletag: {
          cmd: {
            push: function (f) { try { f(); } catch (e) { } }
          },
          defineSlot: function () { return this; },
          addService: function () { return this; },
          display: function () { return this; },
          pubads: function () { return this; },
          enableSingleRequest: function () { return this; },
          collapseEmptyDivs: function () { return this; },
          enableServices: function () { return this; }
        },
        arrasAdDone: true
      };

      global.crypto = global.window.crypto = {
        getRandomValues: function (a) { return a }
      };
      global.addEventListener = global.window.addEventListener = function (type, f) {
        handleListener(type, f, global.window)
      };
      global.removeEventListener = global.window.removeEventListener = function (type, f) {
      };
      global.Image = global.window.Image = function () {
        return {}
      };

      let inputs = [], setValue = function (str) {
        for (let i = 0, l = inputs.length; i < l; i++) {
          const input = inputs[i];
          input.value = str;
          const listeners = elementListeners.get(input);
          if (listeners) {
            const event = { target: input, isTrusted: true };
            if (listeners.input) {
              for (const f of listeners.input) {
                try { f.call(input, event); } catch (e) { }
              }
            }
            if (listeners.change) {
              for (const f of listeners.change) {
                try { f.call(input, event); } catch (e) { }
              }
            }
          }
        }
      }
      let position = [0, 0, 5], died = false, died2 = false, ignore = false, disconnected = false, connected = false, inGame = false, upgrade = false, reconnectCount = 0, isUpgrading = false;

      let innerWidth = global.window.innerWidth = 500
      let innerHeight = global.window.innerHeight = 500

      let st = 2, lx = 0, gd = 1, canvasRef = {}, sr = 1, s = 1;

      const g = function () {
        let w = innerWidth;
        let h = innerHeight;
        if (!canvasRef.width) canvasRef.width = w;
        if (w * 0.5625 > h) {
          s = 888.888888888 / w;
        } else {
          s = 500 / h;
        }
        sr = canvasRef.width / w;
      };
      g();

      global.document = global.window.document = (function () {
        const emptyFunc = () => { };
        const emptyStyle = { setProperty: emptyFunc };

        const simulatedContext2D = {
          isContextLost: () => false,

          fillText: function () {
            if (ignore) { return }
            let a = Array.from(arguments)
            const screenText = String(a[0] ?? '');
            if (this.font === 'bold 7px Ubuntu' && this.fillStyle === 'rgb(255,255,255)') {
              if (screenText === `You have spawned! Welcome to the game.`) {
                hasJoined = firstJoin = true;
                position[0] = position[1] = 0; // Reset internal tracking on spawn
                statusLog('spawn detected');
              } else if (screenText === 'You have traveled through a portal!') {
                hasJoined = true;
                position[0] = position[1] = 0;
                statusLog('portal travel detected');
              }
              if (!died && (
                (screenText.startsWith('The server was ') && screenText.endsWith('% active'))
                || screenText.startsWith('Survived for ')
                || screenText.startsWith('Succumbed to ')
                || screenText === 'You have self-destructed.'
                || screenText === `Vanished into thin air`
                || screenText.startsWith('You have been killed by '))) {
                deathTrigger = screenText;
                statusLog(`[death-trigger] ${screenText}`);
                died = true
              }
              if (!screenText.startsWith(`You're using an ad blocker.`) && screenText !== 'Respawn' && screenText !== 'Back' && screenText !== 'Reconnect' && screenText.length > 2) {
                //log('[arras]', a[0])
                if (screenText.startsWith("You have been killed by ") || screenText === "You have died a stupid death.") {
                  deathTrigger = screenText;
                  statusLog(`[death-trigger] ${screenText}`);
                  died = true;
                }
              }
            }
            if (this.font === 'bold 7.5px Ubuntu' && this.fillStyle === 'rgb(231,137,109)') {
              if (screenText === 'You have been temporarily banned from the game.' || screenText === 'Your IP address have been blacklisted due to suspicious activities.') {
                disconnected = true
                destroy()
                statusLog('[arras]', screenText)
              } else if (screenText.startsWith('The connection closed due to ')) {
                disconnected = true
                statusLog(`[arras-disconnect] ${screenText}`);
                if (!destroyed) {
                  destroy()
                  if (connected) {
                    if (reconnectCount < config.reconnectAttempts) {
                      reconnectCount++;
                      const reconnectDelay = config.reconnectDelay + Math.floor(Math.random() * 2500);
                      statusLog(`reconnect in ${(reconnectDelay / 1000).toFixed(1)}s (${reconnectCount}/${config.reconnectAttempts})`);
                      global.setTimeout(function () {
                        statusLog('reconnecting');
                        run(x, config, arras);
                      }, reconnectDelay);
                    } else {
                      statusLog(`max reconnect attempts reached (${config.reconnectAttempts})`);
                    }
                  }
                }
                statusLog('[arras]', a[0])
              }
            }
            if (this.font === 'bold 5.1px Ubuntu' && this.fillStyle === 'rgb(255,255,255)') {
              if (a[0].startsWith('Coordinates: (')) {
                if (died2) {
                  hasJoined = true;
                }

                let b = a[0].slice(14), l = b.length
                if (b[l - 1] === ')') {
                  b = b.slice(0, l - 1).split(', ')
                  if (b.length === 2) {
                    let x = parseFloat(b[0])
                    let y = parseFloat(b[1])
                    position[0] = x
                    position[1] = y
                    position[2] = 5
                  }
                }
              }
            }
          },

          measureText: (text) => ({ width: text.length }),
          clearRect: emptyFunc, strokeRect: emptyFunc, fillRect: emptyFunc,
          save: emptyFunc, translate: emptyFunc, clip: emptyFunc, restore: emptyFunc,
          beginPath: emptyFunc,
          moveTo: function () {
            canvasRef = this.canvas;
            if (st > 0) {
              st--;
              if (st === 1) {
                lx = arguments[0];
              } else {
                const diff = arguments[0] - lx;
                if (diff !== 0) {
                  gd = sr / diff;
                }
              }
            }
          },
          lineTo: emptyFunc, rect: emptyFunc,
          arc: emptyFunc, ellipse: emptyFunc, roundRect: emptyFunc, closePath: emptyFunc,
          fill: emptyFunc, stroke: emptyFunc, strokeText: emptyFunc, drawImage: emptyFunc,
        };

        const createElement = function (tag, options) {
          const element = {
            tag: tag ? tag.toLowerCase() : '',
            appended: false,
            value: '',
            style: emptyStyle,
            addEventListener: (type, f) => handleListener(type, f, element),
            setAttribute: emptyFunc,
            appendChild: (e) => { e.appended = true },
            focus: emptyFunc,
            blur: emptyFunc,
            remove: emptyFunc,
            getBoundingClientRect: () => ({
              width: innerWidth, height: innerHeight, top: 0, left: 0, bottom: innerHeight, right: innerWidth,
            }),
          };

          if (element.tag === 'canvas') {
            element.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC';
            element.getContext = (type) => {
              if (type === '2d') {
                simulatedContext2D.canvas = element;
                return simulatedContext2D;
              }
              return null;
            };
          }

          if (element.tag === 'input') {
            inputs.push(element);
          }
          allElements.push(element);

          if (options) {
            Object.assign(element, options);
          }

          return element;
        };

        const doc = createElement('document', {
          createElement: createElement,
          body: null,
          fonts: { load: () => true },
          referrer: '',
        });
        doc.body = createElement('body');

        return doc;
      })();

      global.location = global.window.location = {
        hostname: 'arras.io',
        hash: config.hash,
        query: ''
      }
      let lastHash = global.location.hash
      global.prompt = global.window.prompt = function () {
        console.log('prompt', ...arguments)
      }
      let devicePixelRatio = global.window.devicePixelRatio = 1
      let a = false
      global.requestAnimationFrame = global.window.requestAnimationFrame = function (f) {
        st = 2;
        g();
        a = f
      }
      global.performance = {
        time: 0,
        now: function () {
          return this.time
        }
      }
      const console = {
        log: new Proxy(global.console.log, {
          apply: function (a, b, args) {
            if (args[0] === '%cStop!' || (args[0] && args[0].startsWith && args[0].startsWith('%cHackers have been known'))) { return }
            return Reflect.apply(a, b, args)
          }
        })
      }
      global.console = global.window.console = console;

      let proxyAgent = null;
      if (config.proxy) {
        if (config.proxy.type === 'socks') {
          proxyAgent = new SocksProxyAgent(config.proxy.url);
        } else if (config.proxy.type === 'http') {
          proxyAgent = new HttpsProxyAgent(config.proxy.url);
        }
      }

      let i = 0, controller = {
        x: 250,
        y: 250,
        mouseDown: function (button) {
          trigger.mousedown(controller.x, controller.y, button)
        },
        mouseUp: function (button) {
          trigger.mouseup(controller.x, controller.y, button)
        },
        click: async function (x, y) {
          trigger.mousedown(x, y, 0);
          await new Promise(r => setTimeout(r, 50)); // Tiny delay for click registration
          trigger.mouseup(x, y, 0);
        },
        press: function (code) {
          trigger.keydown(code)
          trigger.keyup(code)
        },
        chat: function (str) {
          if (!str) return;
          // Open chat
          controller.press('Enter');
          global.performance.time += 200;
          if (typeof a === 'function') a();

          // Type message
          setValue(str);
          global.performance.time += 200;
          if (typeof a === 'function') a();

          // Send message
          controller.press('Enter');
          global.performance.time += 200;
          if (typeof a === 'function') a();

          // Clear input buffer
          setValue("");
        },
        moveDirection: function (x, y) {
          trigger[x < 0 ? 'keydown' : 'keyup']('KeyA')
          trigger[y < 0 ? 'keydown' : 'keyup']('KeyW')
          trigger[x > 0 ? 'keydown' : 'keyup']('KeyD')
          trigger[y > 0 ? 'keydown' : 'keyup']('KeyS')
        },
        iv: 4 / Math.PI,
        dv: Math.PI / 4,
        ix: [1, 1, 0, -1, -1, -1, 0, 1],
        iy: [0, 1, 1, 1, 0, -1, -1, -1],
        moveVector: function (x, y, i) {
          let d = Math.atan2(y, x)
          let h = (Math.round(d * controller.iv) % 8 + 8) % 8
          let x2 = controller.ix[h]
          let y2 = controller.iy[h]
          controller.moveDirection(x2, y2)
          return h * controller.dv
        }
      }, statusRecieved = false, firstJoin = false, hasJoined = false, timeouts = {}, timeout = function (f, t) {
        if (!(t >= 1)) { t = 1 }
        let n = i + t
        let a = timeouts[n]
        if (!a) {
          a = timeouts[n] = []
        }
        a.push(f)
      }, block = false

      async function waitTime(timeout) {
        await new Promise(resolve => setTimeout(resolve, timeout));
      }


      // PATH FIND FUNC
      function getDir(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
      }

      function randint(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
      }

      function choice(array) {
        return array[randint(0, array.length - 1)];
      }

      function stopMoving() {
        for (const key of "WASD") {
          trigger.keyup("Key" + key);
        }
      }

      function pathfind(x, y) {
        const angle = getDir(position[0], position[1], x, y);
        let hold = {};

        // Perfect 8-direction movement
        if (angle >= -Math.PI / 8 && angle < Math.PI / 8) {
          // Right
          hold["KeyD"] = true;
        } else if (angle >= Math.PI / 8 && angle < 3 * Math.PI / 8) {
          // Down-Right
          hold["KeyS"] = true;
          hold["KeyD"] = true;
        } else if (angle >= 3 * Math.PI / 8 && angle < 5 * Math.PI / 8) {
          // Down
          hold["KeyS"] = true;
        } else if (angle >= 5 * Math.PI / 8 && angle < 7 * Math.PI / 8) {
          // Down-Left
          hold["KeyS"] = true;
          hold["KeyA"] = true;
        } else if (angle >= 7 * Math.PI / 8 || angle < -7 * Math.PI / 8) {
          // Left
          hold["KeyA"] = true;
        } else if (angle >= -7 * Math.PI / 8 && angle < -5 * Math.PI / 8) {
          // Up-Left
          hold["KeyW"] = true;
          hold["KeyA"] = true;
        } else if (angle >= -5 * Math.PI / 8 && angle < -3 * Math.PI / 8) {
          // Up
          hold["KeyW"] = true;
        } else {
          // Up-Right
          hold["KeyW"] = true;
          hold["KeyD"] = true;
        }

        for (let key of "WASD") {
          key = "Key" + key;
          trigger[hold[key] ? "keydown" : "keyup"](key);
        }
      }

      async function onJoin() {
        if (isUpgrading) return;
        isUpgrading = true;
        block = true; // Lock movement during upgrade
        died2 = false; // Prevent fillText from setting hasJoined = true while upgrading

        // Force coordinates ON immediately so we aren't blind
        controller.press('KeyL');
        position[2] = 5;

        reconnectCount = 0;
        if (config.id === 0) log(`[Bot 0] Joining as: ${target.tank}`);

        for (const key of tanks[target.tank].path) {
          if (key === "wait") {
            await waitTime(1000);
          } else if (key instanceof Array) {
            await waitTime(500);
            await controller.click(upgrade_map[key[0]], upgrade_map[key[1]]);
            await waitTime(500);
          } else {
            controller.press("Key" + key.toUpperCase());
          }
        }

        let build;
        if (target.feed) {
          build = [0, 0, 12, 0, 0, 0, 0, 8]
          controller.press("KeyR");
        } else {
          build = tanks[target.tank].build.split("/");
        }

        let i2 = 0;
        for (let i = 1; i <= build.length; i++) {
          const stat = parseInt(build[i2]);

          if (i == 10) {
            i = 0;
          }

          for (let i3 = 0; i3 < stat; i3++) {
            controller.press("Digit" + i);
          }

          if (i == 0)
            break;

          i2++;
        }

        for (const key of config.keysHold) {
          trigger.keydown("Key" + key.toUpperCase());
        }

        inGame = true
        statusLog(`joined as ${target.tank || 'basic'}`);

        if (target.autofire) {
          controller.press("KeyE");
        }
        lastAutofire = target.autofire;

        if (target.autospin) {
          controller.press("KeyC");
        }
        lastAutospin = target.autospin;

        block = false; // Unlock movement
        isUpgrading = false;
        hasJoined = false; // Clear any queued spawn triggers
      }

      const mainInterval = setInterval(function () {
        if (block || isPaused) {
          return
        }

        if (a) {
          switch (i) {
            case 1: {
              setValue(config.name)
              // xd setValue(choice(names))

              controller.press("Enter")
              log('Play button clicked!', config.name, global.location.hash)
              break
            }
          }
          if (lastHash !== global.location.hash) {
            log('hash =', global.location.hash)
            lastHash = global.location.hash
          }
          let at = timeouts[i]
          if (at) {
            delete timeouts[i]
            for (let i = 0, l = at.length; i < l; i++) {
              at[i]()
            }
          }
          position[2]--
          if (position[2] < 0) {
            controller.press('KeyL')
          }
          if (hasJoined) {
            hasJoined = false;

            if (isUpgrading) return;

            firstJoin = false;

            // Ensure target.tank is valid
            if (!target.tank || !tanks[target.tank]) {
              target.tank = 'basic';
            }

            // If the tank uses coordinate clicks, delay slightly to ensure UI is ready
            const path = tanks[target.tank].path;
            if (Array.isArray(path) && path.some(key => Array.isArray(key))) {
              setTimeout(onJoin, 1200);
            } else {
              onJoin();
            }
          }
          if (inGame && config.type === 'follow') {
            // if (i % 35 === 34) {
            //   controller.chat("7".repeat(randint(1, 60)))
            // }

            // if (Math.random() < 0.002) {
            //   controller.chat("#PRAISETHEPRIMORDIALNOOB");
            // }

            let moveTarget = { x: 0, y: 0 };
            let aimTarget = { x: 0, y: 0 };
            let valid = false;

            if (target.manualMode) {
              moveTarget.x = aimTarget.x = target.manualX;
              moveTarget.y = aimTarget.y = target.manualY;
              valid = true;
            } else if (target.x !== undefined && target.x !== null) {
              // Base targets
              moveTarget.x = target.x;
              moveTarget.y = target.y;
              aimTarget.x = target.x + target.mouseX;
              aimTarget.y = target.y + target.mouseY;

              if (target.followMouse) {
                // If following mouse, movement target matches aiming target
                moveTarget.x = aimTarget.x;
                moveTarget.y = aimTarget.y;
              }
              valid = true;
            }

            if (valid) {
              if (position[2] > 0) {
                pathfind(moveTarget.x, moveTarget.y);
              } else {
                stopMoving(); // Stay still if we can't see our own coordinates
              }

              // Aim in the same coordinate system as the controller.
              // When followMouse is enabled, mouseX/mouseY are already the
              // live aim vector from the controller, so do not turn them
              // into a second world-space vector (that was causing aim drift).
              let aimX;
              let aimY;
              if (target.followMouse && Number.isFinite(target.mouseX) && Number.isFinite(target.mouseY)) {
                aimX = target.mouseX;
                aimY = target.mouseY;
              } else if (target.shift && Number.isFinite(target.mouseX) && Number.isFinite(target.mouseY)) {
                aimX = target.mouseX;
                aimY = target.mouseY;
              } else {
                const angle = getDir(
                  position[0],
                  position[1],
                  aimTarget.x,
                  aimTarget.y
                );
                aimX = Math.cos(angle);
                aimY = Math.sin(angle);
              }

              const aimLength = Math.hypot(aimX, aimY);
              if (aimLength > 0.001) {
                const aimRadius = Math.max(100, Math.min(innerWidth, innerHeight) * 0.4);
                controller.x = (innerWidth / 2) + (aimX / aimLength) * aimRadius;
                controller.y = (innerHeight / 2) + (aimY / aimLength) * aimRadius;
              } else {
                controller.x = innerWidth / 2;
                controller.y = innerHeight / 2;
              }
              trigger.mousemove(controller.x, controller.y);
            }

            /*if (Math.random() < 0.01) {
              let dist = 20;
              let randomAngle = 2 * Math.PI * Math.random();
              trigger.mousemove(
                controller.x = 250 + dist * Math.cos(randomAngle),
                controller.y = 250 + dist * Math.sin(randomAngle)
              );
            }*/

            controller[target.mouseDown && !target.feed ? "mouseDown" : "mouseUp"]()
            controller[target.rMouseDown && !target.feed ? "mouseDown" : "mouseUp"](2)

            if (target.autofire !== lastAutofire) {
              controller.press("KeyE");
              lastAutofire = target.autofire;
            }
            if (target.autospin !== lastAutospin) {
              controller.press("KeyC");
              lastAutospin = target.autospin;
            }

            // Chat Spam Logic
            if (target.chatSpam && Date.now() - lastChatAt > 3000) {
              lastChatAt = Date.now();
              controller.chat(target.chatSpam);
            }
          }
          if (died) {
            inGame = false
            statusLog('death detected');
            stopMoving();
            block = true
            ignore = true
            // The old death handler repeatedly changed viewport/devicePixelRatio
            // and rendered the client 60 times. That could spike CPU/event-loop
            // usage and make a worker look like it randomly terminated.
            // A single bounded cleanup render is enough before respawn.
            let end = function () {
              innerWidth = global.window.innerWidth = 500
              innerHeight = global.window.innerHeight = 500
              devicePixelRatio = global.window.devicePixelRatio = 1
              if (config.autoRespawn) {
                statusLog('auto respawn started');
                died2 = true;
                const interv = setInterval(() => {
                  controller.press('Enter')
                  controller.press('Escape')
                  if (!died2) {
                    clearInterval(interv);
                  }
                }, 4000);
              } else {
                //log('Render cache cleared.')
              }
              block = false
              ignore = false
              global.performance.time += 9000
              a()
              if (statusRecieved) { i++ }
            }
            global.setTimeout(end, 30);
            died = false
            return
          }
          global.performance.time += 150
          a()
          if (statusRecieved) {
            i++
          }
        }
      }, 150)
      global.localStorage = global.window.localStorage = {
        setItem: function (i, v) {
          this[i] = v
        },
        getItem: function (i) {
          return this[i]
        }
      }

      global.fetch = global.window.fetch = new Proxy(realFetch, {
        apply: function (a, b, args) {
          let url = args[0];

          if (url.startsWith('./')) {
            url = args[0] = 'https://arras.io' + url.slice(1)
          } else if (url.startsWith('/')) {
            url = args[0] = 'https://arras.io' + url
          }

          let options = args[1] || {};
          if (proxyAgent) {
            options.agent = proxyAgent;
          }
          args[1] = options;

          if (url.includes('app.wasm')) { return wasm() }

          if (url.endsWith('/clientCount')) {
            // receiving clientCount instantly to improve network
            return new Promise(resolve => resolve({
              json: async () => {
                return { "ok": true, "clients": 7777 }
              }
            }));
          }

          const fetchPromise = Reflect.apply(a, b, args);

          if (url.endsWith('/status')) {
            return fetchPromise.then(async response => {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                // It's JSON, process it and return the original response
                const cloned = response.clone();
                cloned.json().then(i => {
                  if (i.ok && i.status) {
                    statusRecieved = true;
                    status = Object.values(i.status);
                  }
                }).catch(() => { });
                return response;
              } else {
                // Not JSON (probably HTML/404), return a fake JSON response to prevent client crash
                log(`Warning: /status returned non-JSON content from ${url}. Returning mock JSON.`);
                return {
                  ok: true,
                  status: 200,
                  headers: new Map([['content-type', 'application/json']]),
                  json: async () => ({ ok: false, status: {} }),
                  text: async () => JSON.stringify({ ok: false, status: {} }),
                  arrayBuffer: async () => Buffer.from(JSON.stringify({ ok: false, status: {} })),
                  clone: function () { return this; }
                };
              }
            }).catch(err => {
              log(`Failed to fetch status (${url}):`, err);
              return {
                ok: false,
                json: async () => ({ ok: false }),
                clone: function () { return this; }
              };
            });
          }

          return fetchPromise;
        }
      })

      global.navigator = global.window.navigator = {}
      let gameSocket = false, host = false

      global.WebSocket = global.window.WebSocket = new Proxy(WebSocket, {
        construct: function (a, b, c) {
          const fullUrl = b[0];
          host = new url.URL(fullUrl).host

          let h = {
            headers: {
              'user-agent': `Mozilla/5.0 (X11; CrOS x86_64 14588.123.0) AppleWebKit/${(100 + 900 * Math.random()).toFixed(2)} (KHTML, like Gecko) Chrome 101.0.0.0 Safari ${(100 + 900 * Math.random()).toFixed(2)}`,
              'accept-encoding': 'gzip, deflate, br',
              'accept-language': 'en-US,en;q=0.9',
              'cache-control': 'no-cache',
              'connection': 'Upgrade',
              'origin': 'https://arras.io',
              'pragma': 'no-cache',
              'upgrade': 'websocket',
              'Sec-WebSocket-Protocol': b[1] ? b[1].join(', ') : '',
              'host': host
            },
            followRedirects: true,
            origin: 'https://arras.io',
          }

          if (proxyAgent) { h.agent = proxyAgent; }

          const newArgs = [fullUrl, b[1], h];
          const d = Reflect.construct(a, newArgs, c)
          const wsOpenedAt = Date.now();

          d.addEventListener('open', function () {
            log('WebSocket open.')
            connected = true
          })

          d.addEventListener('error', function (e) {
            const err = e && (e.error || e.message || e);
            const message = err && err.stack ? err.stack : String(err || 'unknown websocket error');
            statusLog(`[ws-error] ${message}`);
          })

          d.addEventListener('close', function (e) {
            if (gameSocket === d) { gameSocket = false; }
            statusLog(`websocket closed clean=${e.wasClean} code=${e.code} reason=${e.reason || ''} age=${((Date.now() - wsOpenedAt) / 1000).toFixed(1)}s state=${d.readyState} deathTrigger=${deathTrigger || 'none'}`);
          })

          let closed = false
          d.addEventListener('message', function (e) {
            wsMessageCount++;
            if (e && e.data) {
              wsMessageBytes += Number(e.data.byteLength || e.data.length || 0);
            }
          })
          d.send = new Proxy(d.send, { apply: function (f, g, h) { return Reflect.apply(f, g, h) } })
          d.close = new Proxy(d.close, {
            apply: function (f, g, h) {
              if (closed) { return }
              const closeArgs = h.map((value) => String(value)).join(', ');
              const stack = new Error('client websocket close caller').stack || '';
              statusLog(`[ws-client-close] args=[${closeArgs}] stack=${stack.replace(/\s+/g, ' ').slice(0, 700)}`);
              closed = true
              Reflect.apply(f, g, h)
            }
          })
          d.addEventListener = new Proxy(d.addEventListener, { apply: function (a, b, c) { return Reflect.apply(a, b, c) } })
          gameSocket = d
          return d
        }
      })
      vm.runInContext(x, vm.createContext(global), {
        filename: `arras-bot-${config.id}.js`,
        displayErrors: true,
      })
      let ca = oa || {}
      ca.window = global.window
      ca.destroy = destroy
      ca.controller = controller
      ca.trigger = trigger
      return Object.assign(ca, internalBotInterface);
    }

    let arras = {
      then: (cb) => {
        ensurePrerequisites();
        then(() => cb(arras));
      },
      create: function (o) {
        if (!ready) {
          log("Warning: 'create' called before arras was ready. It will be queued.");
        }
        o.id = o.id !== undefined ? o.id : id++;
        return run(script, o)
      }
    }
    if (options.start) {
      options.start(arras)
    }
    return arras
  })()

  const updateAllTargets = function (patch) {
    Object.assign(sharedTarget, patch);
    for (const bot of currentBotInterfaces) {
      if (bot && bot.updateTarget) {
        bot.updateTarget(patch);
      }
    }
  };

  ipc.on('message', (message) => {
    if (message.type === 'prepare') {
      options.arrasCache = message.arrasCache;
      options.wasmCache = message.wasmCache;
      arras.then(function () {
        sendParent({ type: 'log', id: 'pool', message: 'prewarmed worker ready' });
      });
    } else if (message.type === 'start') {
      const config = message.config;
      options.token = config.token;
      options.loadFromCache = config.loadFromCache;
      options.cache = config.cache;
      options.arrasCache = config.arrasCache;
      options.wasmCache = config.wasmCache;

      arras.then(function () {
        currentBotInterface = arras.create(config);
        currentBotInterfaces.push(currentBotInterface);
      });
    } else if (message.type === 'pause') {
      isPaused = message.paused;
      for (const bot of currentBotInterfaces) {
        if (bot.log) {
          bot.log(`Bot state is now: ${isPaused ? 'PAUSED' : 'RESUMED'}`);
        }
      }
    } else if (message.type === 'key_command') {
      const key = message.key;
      for (const bot of currentBotInterfaces) {
        if (bot.log) bot.log(`CMD Key: ${key}`);
      }

      // Find trigger functions in scope? No, they are inside run()...
      // We need 'run' scope to access 'trigger'.
      // Actually, trigger is not exposed globally. 
      // Wait, the message listener is currently OUTSIDE 'run'.
      // We need a way to pass this down.
      // currentBotInterface is the object returned by arras.create(config).
      // Does it expose trigger? No.

      // FIX: Reroute this message to the internal listeners if possible.
      // Or store a global reference to the trigger?
      // Since we are in the worker context, let's look at where 'run' is called.
      // 'arras.create(config)' calls 'run(app, config, ...)'
      // 'run' defines 'trigger' and 'listeners'.

      // We can expose an event handler on currentBotInterface.
      for (const bot of currentBotInterfaces) {
        if (bot.simulateKey) {
          bot.simulateKey(key);
        }
      }
    } else if (message.type == 'position') {
      updateAllTargets({
        x: message.x,
        y: message.y,
        mouseX: message.mouseX,
        mouseY: message.mouseY,
        mouseDown: message.mouseDown,
        rMouseDown: message.rMouseDown,
        followMouse: message.mouse,
        feed: message.feeding,
        shift: message.shift,
        autofire: message.autofire,
        autospin: message.autospin,
        manualMode: message.manualMode,
        manualX: message.manualX,
        manualY: message.manualY,
        manualAimWithMovement: Boolean(message.manualAimWithMovement),
        manualScaleX: message.manualScaleX,
        manualScaleY: message.manualScaleY,
      });
    } else if (message.type == 'tankselect') {
      if (message.botId === undefined) {
        updateAllTargets({ tank: message.tank });
      } else {
        const bot = currentBotInterfaces.find((candidate) => candidate.id === message.botId);
        if (bot && bot.updateTarget) {
          bot.updateTarget({ tank: message.tank });
        }
      }
    } else if (message.type == 'chat') {
      updateAllTargets({ chatSpam: message.spam ? message.message : "" });
      if (message.message && !message.spam) {
        for (const bot of currentBotInterfaces) {
          if (bot.controller && bot.controller.chat) {
            bot.controller.chat(message.message);
          }
        }
      }
    } else if (message.type == 'destroy') {
      console.log("why devastatee");
      devastate();
      if (parentPort) {
        parentPort.close();
      }
      process.exit();
    }
  });

  // setInterval(() => {
  //   const data = fs.readFileSync("active", "utf-8");

  //   if (data == "closed") {
  //     devastate();
  //     process.exit();
  //   }
  // }, 2000);
})();
