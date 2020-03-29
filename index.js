/**
 * Example Config
 * {
            "name": "EweLink",
            "platform": "EweLink",
            "email": "kavacon@icloud.com",
            "password": "",
            "region": "cn"
        }
 * @type {module:ewelink-api}
 */

const ewelink = require("ewelink-api");
const serviceDetermination = require("./serviceDetermination");
let Service;
let Accessory;
let Characteristic;
let UUIDGen;


// homebridge entry function, will allow plugin to register with the server
module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    UUIDGen = homebridge.hap.uuid;
    serviceDetermination.configure(Service, Characteristic);
    homebridge.registerPlatform("homebridge-ewelink-with-api", "EweLink", EweLink, true);
};

/*********************************** Homebridge functions ********************************/
// start up the plugin
function EweLink(log, config, api) {
     (async () => {
        log("Ewelink bridge starting up");

        //configure for external access
        const platform = this;
         log("Platform recorded");
        const connection = new ewelink({
            email: config["email"],
            password: config["password"],
            region: config["region"],
        });
        log("Connection requested");
        this.auth = await connection.getCredentials();
        log("Auth details received");
        this.log = log;
        this.config = config;
        this.accessories = new Map();

         if(api) {
             platform.log("API is present");
             this.api = api;
             this.api.on("didFinishLaunching", apiDidFinishLaunching.bind(platform));
         }
     })();
}

// Retrieve accessory/device list and update accordingly
function apiDidFinishLaunching(platform){
    //retrieve list of devices from ewelink and homebridge cache
    platform.log("apiDidFinishLaunching callback activating");
    (async () => {
        const connection = new ewelink({
            at: platform.auth.at,
            region: platform.auth.region
        });

        const devices = await connection.getDevices();
        let devicesToKeep = [];

        platform.log("Devices returned by ewe link are:");
        platform.log(devices);

        //remove and add devices as needed
        platform.log("Devices currently stored in local cache are:");
        platform.log(platform.accessories);

        //add and update the devices found in the ewelink connection
        devices.forEach(function (device) {
            platform.apiKey = device.apikey;
            devicesToKeep.push(device.deviceid);
            if (platform.accessories.has(device.deviceid)) {
                platform.log("Device Id [%s] already configured, updating configuration", device.deviceid);
                const accessory = platform.accessories.get(device.deviceid);
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Name, device.name);
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, device.extra.extra.mac);
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, device.productModel);
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, device.extra.extra.model);
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.FirmwareRevision, device.params.fwVersion);
                platform.updatePowerStateCharacteristic(device.deviceid, device.params.switch);
            } else {
                platform.log("Device Id [%s] needs to be added, adding device", device.deviceid);
                platform.addAccessory(device);
            }
        });

        //remove devices not in the ewelink connection
        platform.accessories.forEach(function (accessory) {
            if (!devicesToKeep.includes(accessory.context.deviceId)) {
                platform.log("Accessory with device Id [%s] no longer active, removing", accessory.context.deviceId);
                platform.removeAccessory(accessory);
            }
        });
    })();
}

//update the power state of an accessory from external source
EweLink.prototype.updatePowerStateCharacteristic = function(deviceId, state){
    const platform = this;
    const targetState = state === "on";
    const accessory = platform.accessories.get(deviceId);

    platform.log("Updating Characteristic.On for accessory [%s] to [%s]", accessory.displayName, targetState);
    accessory.getService(Service.Switch).setCharacteristic(Characteristic.On, targetState);
};

//set the power state (on/off) of an accessorry
EweLink.prototype.setPowerState = function(accessory, isOn, callback) {
    const platform = this;
    const targetState = isOn ? "on" : "off";

    platform.log("Setting powerstate for accessory: [%s]", accessory.displayName);
    (async () => {
        const connection = new ewelink({
            at: platform.auth.at,
            region: platform.auth.region
        });

        const currentState = await connection.getDevicePowerState(accessory.context.deviceId);

        if (currentState) {
            if (currentState.state !== targetState) {
                platform.log("Device state does not match target state, toggling [%s]", accessory.displayName);
                await connection.toggleDevice(accessory.context.deviceId);
            } else {
                platform.log("Device [%s] already in requested state", accessory.displayName);
            }
            callback();
        } else {
            platform.log("Could not retrieve current power state, device [%s] cannot be set", accessory.displayName);
            callback("Unable to determine power state");
        }
    })();
};

//retrieve the power state (on/off) of the device from ewelink
EweLink.prototype.getPowerstate = function(accessory, callback){
    const platform = this;
    platform.log("Checking powerstate for accessory: [%s]", accessory.displayName);
    (async () => {
        const connection = new ewelink({
            at: platform.auth.at,
            region: platform.auth.region
        });

        const device = await connection.getDevice(accessory.context.deviceId);
        //check the result returned is not null
        if (device) {
            //check if online
            if (device.online) {
                //record state
                accessory.reachable = true;
                platform.log("Device [%s] was found and is online", accessory.displayName);
                platform.log("Device [%s] has state [%s]", device.name, device.params.switch);
                callback(null, device.params.switch === "on" ? 1 : 0);
            } else {
                accessory.reachable = false;
                platform.log("Device [%s] was found but is not online", accessory.displayName)
            }
        } else {
            platform.log("Device [%s] was not found on ewelink and will be removed", accessory.displayName);
            platform.removeAccessory(accessory);
            callback("Device discovery failure");
        }
    }) ();
};

//remove an accessory from the current platform
EweLink.prototype.removeAccessory = function(accessory){
    const platform = this;

    platform.log("Removing accessory [%s]", accessory.displayName);
    platform.accessories.delete(accessory.context.deviceId);
    platform.api.unregisterPlatformAccessories("homebridge-ewelink-with-api", "EweLink", [accessory])
};

//add an accessory dynamically to the current platform
EweLink.prototype.addAccessory = function(device){
    const platform = this;

    if (platform.accessories.get(device.deviceid)){
        platform.log("Device with id [%s] already recorded as an accessory, no further action", device.deviceid)
    }

    else{
        platform.log("Found Accessory with Name : [%s], Manufacturer : [%s], Status : [%s], Is Online : [%s], API Key: [%s] "
            , device.name, device.productModel, device.params.switch, device.online, device.apikey);

        //create and configure the accessory
        const accessory = new Accessory(device.name, UUIDGen.generate(device.deviceid.toString()));
        platform.log(UUIDGen.generate(device.deviceid.toString()));
        accessory.context.deviceId = device.deviceid;
        accessory.context.apiKey = device.apikey;
        accessory.reachable = device.online;

        accessory.addService(Service.Switch, device.name)
            .getCharacteristic(Characteristic.On)
            .on("set", platform.setPowerState.bind(accessory))
            .on("get", platform.getPowerstate.bind(accessory));

        accessory.on("identify", function(paired, callback) {platform.log(accessory.displayName, "Identify not supported"); callback();});
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, device.extra.extra.mac);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, device.productModel);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, device.extra.extra.model);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Identify, false);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.FirmwareRevision, device.params.fwVersion);

        platform.accessories.set(device.deviceid, accessory);
        platform.api.registerPlatformAccessories("homebridge-ewelink-with-api", "EweLink", [accessory]);
    }
};

EweLink.prototype.configureAccessory = function(accessory){
    const platform = this;
    platform.log(accessory.displayName, "Configure Accessory");

    accessory.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("set", platform.setPowerState.bind(accessory))
            .on("get", platform.getPowerstate.bind(accessory));


    platform.accessories.set(accessory.context.deviceId, accessory);
};