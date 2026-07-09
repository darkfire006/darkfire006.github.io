let DEBUG = {
    ENABLED: false,
    WARP_TO_SELF:     false,
    PRINT_KEY:        false,
    IMAGE_DIMENSIONS: true,
    NETWORK: true
}

const AUTOTRACKER_DEVELOPMENT = false;

const LINKTYPE_WARP = "warp";
const LINKTYPE_MARK = "mark";

const CACHE = {
    GAME_LOADED:       "last-game-loaded",
    SMOOTH_IMAGES:     "smooth-images-v2",
    FIT_TO_SCREEN:     "fit-to-screen",
    DEBUG_LOCATION:    "debug-location",
    LAST_VERSION:      "last-version",
    LINE_COLOR:        "line-color",
    TOOLTIPS_DISABLED: "tooltips-disabled-v2",
    MAP_SWITCHING:     "map-switching",
    SHOW_PORT:         "show-port",
    SHOW_PASSWORD:     "show-password",
    DECOUPLED_MODE:     "decoupled-mode",
}
const CURRENT_VERSION = 2;

let game;
let games = {};
function init() {
    DEBUG.ENABLED = document.URL.endsWith("?debug");

    // Retrieve line color
    let cached_line_color = localStorage.getItem(CACHE.LINE_COLOR);
    if (cached_line_color) { line_color = cached_line_color; }

    // Create map of games
    for (let g of ordered_games) {
        if (!g.debug || (g.debug && DEBUG.ENABLED)) {
            games[g.name] = g;
        }
    }
    
    InitTrackerToUnknowns();
    InitRendering();
    RetrieveAllHTMLElements();
    if (DEBUG.ENABLED) { RunTests(); }

    // Show explanation + changelog if we haven't shown it before
    let last_version = localStorage.getItem(CACHE.LAST_VERSION);
    if (!last_version) { // New user
        ShowHelp();
        html.help.changelog.classList.add("config_hidden");
        for (let i = 1; i < CURRENT_VERSION; ++i) {
            html.help.versions[i].classList.add("config_hidden");
        }
    }
    if (last_version && last_version < CURRENT_VERSION) { // Show last changes
        for (let i = 0; i < last_version; ++i) {
            html.help.versions[i].classList.add("config_hidden");
        }

        ShowHelp();
    }    localStorage.setItem(CACHE.LAST_VERSION, CURRENT_VERSION);

    // Get last loaded game and load it
    let last_game = localStorage.getItem(CACHE.GAME_LOADED);
    game = rb;
    if (last_game && games[last_game]) {
        game = games[last_game];
    }
    game.button.disabled = true;
    current_location = game.start_location;
    if (DEBUG.ENABLED) {
        let last_location = localStorage.getItem(CACHE.DEBUG_LOCATION);
        if (last_location && game.locations[last_location]) current_location = last_location;

    }
    for (let key_game in games) {
        games[key_game].ready = false;
        games[key_game].obtained = new Set();
    }
    if (localStorage.getItem("warps") != null) {
        game.warps = JSON.parse(localStorage.getItem("warps"));
        let count = 0;
        for (let location in game.warps) {
            for (let name in game.warps[location]) {
                if (game.warps[location][name]["link"] == "unknown") {
                    count++;
                }
            }
        }
        game.marks[0][0][1] = count;
    }

    LoadImages();
    RegisterInputEvents();
    document.fonts.onloadingdone = FontReady;

    // Create reader to load files (just in case)
    loadfile_selector = document.createElement("input");
    loadfile_selector.type = "file";
    loadfile_selector.multiple = false;
    loadfile_selector.onchange = function(e) { FileUploaded(e); };

    // Start tracker
    requestAnimationFrame(GameLoop);

    // Autotracker stuff for debugging
    if (DEBUG.ENABLED && AUTOTRACKER_DEVELOPMENT) {
        AT_Start();
    }
}

let html = {};
const HTML_ID = {
    config: {
        window: "config_window",
        smooth_checkbox: "checkbox_smooth",
        tooltipsdisabled: "checkbox_tooltips",
        fit_to_screen: "checkbox_fittoscreen",
        decoupled_mode: "checkbox_decoupled",
        loading_text: "loading_game_text",
        game_buttons: "game_buttons",
        line_color: "line_color",
        network: {
            toggle: "config_networktoggle",
            div: "config_network",
            input_name:    "networkinput_name",
            input_connect: "networkinput_connect",
            name: "network_name",
            id: "network_id",
            connectto: "network_connectto",
            connections: "network_connections",
            warning: "network_warning",
        }
    },
    help: {
        window: "help_window",
        changelog: "changelog_header",
        update_header: "update_header",
        versions: "help_v" // this is an array of size == CURRENT_VERSION
    },
    archipelago: {
        window: "archipelago_window",
        hostname: "archipelago_hostname",
        port: "archipelago_port",
        player: "archipelago_player",
        password: "archipelago_password",
        map_switching: "checkbox_map_switching",
        show_port: "checkbox_show_port",
        show_password: "checkbox_show_password",
        archipelago_decoupled: "archipelago_decoupled",
    },
    canvas: "canvas", // + context
};
// Finds and creates all HTML elements
function RetrieveAllHTMLElements() {
    // Init html class
    html.config         = {};
    html.config.network = {};
    html.help           = {};
    html.archipelago    = {};

    // Retrieve canvas and create auxiliar canvases
    html.canvas  = document.getElementById(HTML_ID.canvas);
    html.context = html.canvas.getContext("2d");
    html.context.imageSmoothingEnabled = false;

    // Retrieve config elements
    let config  = html.config;
    config.window           = document.getElementById(HTML_ID.config.window);
    config.loading_text     = document.getElementById(HTML_ID.config.loading_text);
    config.smooth_checkbox  = document.getElementById(HTML_ID.config.smooth_checkbox);
    config.fit_to_screen    = document.getElementById(HTML_ID.config.fit_to_screen);
    config.decoupled_mode   = document.getElementById(HTML_ID.config.decoupled_mode);
    config.tooltipsdisabled = document.getElementById(HTML_ID.config.tooltipsdisabled);
    config.line_color       = document.getElementById(HTML_ID.config.line_color);
    config.loading_text.innerHTML = "";
    config.smooth_checkbox.checked  = (localStorage.getItem(CACHE.SMOOTH_IMAGES)     == "false") ? false : true;
    config.fit_to_screen.checked    = (localStorage.getItem(CACHE.FIT_TO_SCREEN)     == "false") ? false : true;
    config.tooltipsdisabled.checked = (localStorage.getItem(CACHE.TOOLTIPS_DISABLED) == "true") ? true : false;
    config.decoupled_mode.checked = (localStorage.getItem(CACHE.DECOUPLED_MODE) == "true") ? true : false;
    config.line_color.value = line_color;
    
    // Retrieve networking elements
    let network = html.config.network;
    network.input_name    = document.getElementById(HTML_ID.config.network.input_name);
    network.input_connect = document.getElementById(HTML_ID.config.network.input_connect);
    network.id            = document.getElementById(HTML_ID.config.network.id);
    network.input_name.value    = "";
    network.input_connect.value = "";
    network.id.value            = "---";
    network.connectto   = document.getElementById(HTML_ID.config.network.connectto);
    network.connections = document.getElementById(HTML_ID.config.network.connections);
    network.name        = document.getElementById(HTML_ID.config.network.name);
    network.warning     = document.getElementById(HTML_ID.config.network.warning);
    network.div         = document.getElementById(HTML_ID.config.network.div);
    network.toggle      = document.getElementById(HTML_ID.config.network.toggle);

    
    let ap_window = html.archipelago;
    ap_window.window = document.getElementById(HTML_ID.archipelago.window);
    ap_window.hostname = document.getElementById(HTML_ID.archipelago.hostname);
    ap_window.hostname.value = localStorage.getItem("archipelago-hostname");
    ap_window.port = document.getElementById(HTML_ID.archipelago.port);
    ap_window.port.value = localStorage.getItem("archipelago-port");
    ap_window.player = document.getElementById(HTML_ID.archipelago.player);
    ap_window.player.value = localStorage.getItem("archipelago-player");
    ap_window.password = document.getElementById(HTML_ID.archipelago.password);
    ap_window.password.value = localStorage.getItem("archipelago-password");
    ap_window.map_switching = document.getElementById(HTML_ID.archipelago.map_switching);
    ap_window.map_switching.checked = (localStorage.getItem(CACHE.MAP_SWITCHING) == "false") ? false : true;
    ap_window.show_port = document.getElementById(HTML_ID.archipelago.show_port);
    ap_window.show_port.checked = (localStorage.getItem(CACHE.SHOW_PORT) == "true") ? true : false;
    ap_window.show_password = document.getElementById(HTML_ID.archipelago.show_password);
    ap_window.show_password.checked = (localStorage.getItem(CACHE.SHOW_PASSWORD) == "true") ? true : false;
    ap_window.port.type = ap_window.show_port.checked ? "text" : "password";
    ap_window.password.type = ap_window.show_password.checked ? "text" : "password";
    ap_window.archipelago_decoupled = document.getElementById(HTML_ID.archipelago.archipelago_decoupled);
    ap_window.archipelago_decoupled.checked = false;
    // Retrieve help window elements
    let help    = html.help;
    help.window    = document.getElementById(HTML_ID.help.window);
    help.changelog = document.getElementById(HTML_ID.help.changelog);
    help.update_header = document.getElementById(HTML_ID.help.update_header);
    help.versions = [];
    for (let i = 0; i <= CURRENT_VERSION; i++) {
        help.versions.push(document.getElementById(HTML_ID.help.versions + i));
    }

    // Create config buttons
    config.game_buttons = document.getElementById("game_buttons");
    for (let g of ordered_games) {
        if (!games[g.name]) continue;

        let div = document.createElement("div");

            g.button = document.createElement("button");
                g.button.className = "load_button";
                g.button.id = g.name + "_button";
                g.button.onclick = function() { ChangeGame(g); };
                g.button.innerHTML = "Load";
            div.appendChild(g.button);

            let text = document.createElement("div");
                text.innerHTML = g.config_name;
                
                if (g.config_randomizer_author) {
                    text.innerHTML += " for "
                    if (g.config_randomizer_link) {
                        let link = document.createElement("a");
                            link.href = g.config_randomizer_link;
                            link.innerHTML = g.config_randomizer_author;
                        text.appendChild(link);
                    }
                    else {
                        text.innerHTML += g.config_randomizer_author;
                    }
                    text.innerHTML += "'s randomizer"
                }

                if (g.config_tracker_author) {
                    text.innerHTML += " by "
                    if (g.config_tracker_link) {
                        let link = document.createElement("a");
                            link.href = g.config_tracker_link;
                            link.innerHTML = g.config_tracker_author;
                        text.appendChild(link);
                    }
                    else {
                        text.innerHTML += g.config_tracker_author;
                    }
                }
                g.unknownCount = g.marks[0][0][1] + g.marks[0][1][1];
                text.innerHTML += " (" + g.marks[0][0][1] + " warps)";

            div.appendChild(text);
        game_buttons.appendChild(div);
    }
}

let delta_time = 0;
let last_time = 0;
function GameLoop() {
    let current_time = GetCurrentMilliseconds();
    delta_time = current_time - last_time;
    last_time = current_time;

    if (game.ready) { Render(); }
    requestAnimationFrame(GameLoop);

    if (DEBUG.ENABLED && AUTOTRACKER_DEVELOPMENT) {
        if (socket.readyState == SOCKET_READYSTATE.OPEN) {
            let current_time = new Date().getTime();
            if (current_time - autotracker_last_poll > SECONDS_BETWEEN_POLLS*1000) {
                AT_SendReadRequest();
                autotracker_last_poll = current_time;
            }
        }
    }
}

function FontReady() { RerenderLayer(LAYER_LOCATION); }
function GetCurrentMilliseconds() { return (new Date()).getTime(); }
