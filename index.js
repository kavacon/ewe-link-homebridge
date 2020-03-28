let ewelink = require('ewelink-api');
let Accessory, Service, Characteristic, UUIDGen;

// homebridge entry function, will allow plugin to register with the server and provide its internal
// function

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessoryConstructor;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("ewelink-homebridge", "EweLink", EweLink, true);

}

// start up the plugin
function EweLink(log, config, api){
    log("Ewelink bridge starting up");

    //establish connection to ewelink
    const connection = ewelink({
        email: config['email'],
        password: config['password'],
        region: config['region'],
    });

    //configure for external access
    var platform = this;
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = new Map();
    this.connection = connection;

    this.api.on('didFinishLaunching', apiDidFinishLaunching(platform))

}

// Retrieve accessory/device list and update accordingly
function apiDidFinishLaunching(platform){
    //retrieve list of devices from ewelink and homebridge cache
    const devices = platform.connection.getDevices();
    platform.log("Devices returned by ewe link are:");
    platform.log(devices);

    //remove and add devices as needed
    platform.log("Devices currently stored in local cache are:")
    platform.log(platform.accessories)

    //add and update the devices found in the ewelink connection
    devices.forEach(function (device){
        platform.apiKey = device.apiKey;
        if (platform.accessories.has(device.deviceId)){
            platform.log("Device Id [%s] already configured, updating configuration", device.deviceId);
            //TODO: update the configuration
        }
        else {
            platform.log("Device Id [%s] needs to be added, adding device", device.deviceId);
            //TODO: add device to accessories
        }
    });

    //remove devices not in the ewelink connection
    platform.accessories.forEach(function (accessory){
        if (!devices.has(accessory.deviceId)){
            platform.log("Accessory with device Id [%s] no longer active, removing", device.deviceId);
            //TODO: remove deviceId from accessories
        }
    });
}