import {
    Client,
    DataStorageManager
} from "https://unpkg.com/archipelago.js@2.0.2/dist/index.js";

// Create a new Archipelago client
const client = new Client();
const datastorage = new DataStorageManager(client);

const form = document.getElementById("connection_details")
let entrance_pairs = {};
let decoupled = false;
// Connect to the Archipelago server
function connectToServer(event) {
    if (event !== null) {
        event.preventDefault()
    }

    if (client.authenticated) {
        disconnectFromServer();
        return;
    }

    var url = document.getElementById("archipelago_hostname").value + ":" + document.getElementById("archipelago_port").value
    var player = document.getElementById("archipelago_player").value
    var conn_options = {
        password: document.getElementById("archipelago_password").value,
        slotData: true,
        tags: ["EntranceTracker"]
    }

    document.getElementById("status-connected").classList.add("default-hidden")
    document.getElementById("status-failed").classList.add("default-hidden")

    document.getElementById("status-connecting").classList.remove("default-hidden")
    client.login(url, player, "TUNIC", conn_options).then((response) => {
        ResetTracker();
        
        if ("entrance_rando" in response && response["entrance_rando"] == 0) {
            alert("Connected slot does not have entrance rando enabled!")
            disconnectFromServer();
            return;
        }

        if ("decoupled" in response && response["decoupled"] == 1) {
            decoupled = true;
            html.archipelago.archipelago_decoupled.checked = true;
        }
        
        if ("Entrance Rando" in response) {
            entrance_pairs = response["Entrance Rando"];
            let slot = client.players.self.slot;
    
            let keys = [];
            for (const ent in response["Entrance Rando"]) {
                keys.push(`Slot:${slot}:${ent}`);
            }
            datastorage.fetch(keys).then((response) => {
                for (const key in response) {
                    if (response[key]) {
                        updateWarpFromDataStorage(key);
                    }
                }
            });
            datastorage.notify(keys, (key, value, oldValue) => {
                if (value) {
                    setTimeout(() => {
                        updateWarpFromDataStorage(key);
                    }, "500");
                }
            });

            let mapKey = `Slot:${slot}:Entrance Tracker Map`;
            datastorage.fetch(mapKey).then((response) => {
                if (response in tunic.locations && html.archipelago.map_switching.checked) {
                    current_location = response;
                    if (DEBUG.ENABLED) {
                        localStorage.setItem(CACHE.DEBUG_LOCATION, current_location);
                    }
                    RerenderLayer(LAYER_LOCATION);
                }
            });
            datastorage.notify([mapKey], (key, value, oldValue) => {
                if (value in tunic.locations && html.archipelago.map_switching.checked) {
                    setTimeout(() => {
                        current_location = value;
                        if (DEBUG.ENABLED) {
                            localStorage.setItem(CACHE.DEBUG_LOCATION, current_location);
                        }
                        RerenderLayer(LAYER_LOCATION);
                    }, "500");
                }
            });
        }
        console.log("Connected to the server");
        document.getElementById("status-connecting").classList.add("default-hidden")
        document.getElementById("status-connected").classList.remove("default-hidden")
        document.getElementById("submit-button").value = "Disconnect";
        // You are now connected and authenticated to the server. You can add more code here if need be.
    })
    .catch((error) => {
        console.error("Failed to connect:", error);
        document.getElementById("status-connecting").classList.add("default-hidden")
        document.getElementById("status-failed").classList.remove("default-hidden")
        alert(error);
        // Handle the connection error.
    });
}

function disconnectFromServer() {
    document.getElementById("status-connecting").classList.add("default-hidden");
    document.getElementById("status-connected").classList.add("default-hidden");
    document.getElementById("status-failed").classList.add("default-hidden");
    document.getElementById("submit-button").value = "Connect";
    html.archipelago.archipelago_decoupled.checked = false;
    
    entrance_pairs = {};
    decoupled = false;
    client.socket.disconnect();
}
form.addEventListener("submit", connectToServer);

function updateWarpFromDataStorage(key) {
    let split = key.split(":");
    if (split.length == 3) {
        let entrance = split[2];
        if (entrance in entrance_pairs && entrance in archipelago_converted_entrances) {
            let to = tunic_converted_entrances[archipelago_converted_entrances[entrance_pairs[entrance]]];
            let from = tunic_converted_entrances[archipelago_converted_entrances[entrance]];
            ChangeWarp(tunic, from[1], from[0], "warp", to[1], to[0], "");
            if (!decoupled) {
                ChangeWarp(tunic, to[1], to[0], "warp", from[1], from[0], "");
            }
        }
    }
}

//Disconnect from the server when unloading window.
window.addEventListener("beforeunload", () => {
    client.socket.disconnect();
});

function updateLocalStorage() {
    localStorage.setItem("archipelago-hostname", document.getElementById(HTML_ID.archipelago.hostname).value);
    localStorage.setItem("archipelago-port", document.getElementById(HTML_ID.archipelago.port).value);
    localStorage.setItem("archipelago-player", document.getElementById(HTML_ID.archipelago.player).value);
    localStorage.setItem("archipelago-password", document.getElementById(HTML_ID.archipelago.password).value);
}
document.getElementById(HTML_ID.archipelago.hostname).addEventListener("change", updateLocalStorage);
document.getElementById(HTML_ID.archipelago.port).addEventListener("change", updateLocalStorage);
document.getElementById(HTML_ID.archipelago.player).addEventListener("change", updateLocalStorage);
document.getElementById(HTML_ID.archipelago.password).addEventListener("change", updateLocalStorage);