/**
 * Example Config
 * {
            "name": "EweLink",
            "platform": "EweLink",
            "email": "kavacon@icloud.com",
            "password": "",
            "region": "cn",
            "isPolling": true,
            "pollingInterval": 15 --if isPolling is false, this is not required
        }
 * @type {module:ewelink-api}
 */
const ServiceDeterminer = require("./serviceDetermination/serviceDeterminer");
const EweLinkConnection = require("./eweLinkConnection");
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
    homebridge.registerPlatform("homebridge-ewelink-with-api", "EweLink", EweLink, true);
};

/*********************************** Homebridge functions ********************************/
// start up the plugin
function EweLink(log, config, api) {
     (async () => {
        log("Ewelink bridge starting up");

        //configure native homebridge parameters for shared access
        const platform = this;
        this.log = log;
        this.config = config;
        this.accessories = new Map();
        this.connection = new EweLinkConnection(this.config, this.log);
        this.servDet = new ServiceDeterminer(this, Service, Characteristic);

         if(api) {
             this.log("API is present");
             this.api = api;
             this.api.on("didFinishLaunching", function() {apiDidFinishLaunching(platform);});
         }
     })();
}

// Retrieve accessory/device list and update accordingly
function apiDidFinishLaunching(platform){
    //retrieve list of devices from ewelink and homebridge cache
    platform.log("apiDidFinishLaunching callback activating");
    (async () => {

        //configure ewelink connection to retrieve auth details
        //needs to be done here to ensure auth details are present for future calls
        await platform.connection.authenticate();

        const devices = await platform.connection.getDevices();
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
                platform.servDet.updateCharacteristic(device.deviceid, device.params.switch);
            } else {
                platform.log("Device Id [%s] needs to be added, adding device", device.deviceid);
                platform.addAccessory(platform, device);
            }
        });

        //remove devices not in the ewelink connection
        platform.accessories.forEach(function (accessory) {
            if (!devicesToKeep.includes(accessory.context.deviceId)) {
                platform.log("Accessory with device Id [%s] no longer active, removing", accessory.context.deviceId);
                platform.removeAccessory(platform, accessory);
            }
        });
        if (platform.config["isPolling"]) {
            setInterval(function () {
                stateCheck(platform, platform.connection);
            }, platform.config["pollingInterval"] * 1000);
        }
     })();
}

//poll to test the state of accessories
function stateCheck(platform, connection){
    platform.accessories.forEach( async (accessory) => {
        const response = await connection.getDevicePowerState(accessory.context.deviceId);
        platform.log("State check for: [%s], server says [%s]", accessory.displayName, response);
        platform.servDet.updateCharacteristic(accessory.context.deviceId, response.state)
    });
}

//remove an accessory from the current platform
EweLink.prototype.removeAccessory = function(platform, accessory){


    platform.log("Removing accessory [%s]", accessory.displayName);
    platform.accessories.delete(accessory.context.deviceId);
    platform.api.unregisterPlatformAccessories("homebridge-ewelink-with-api", "EweLink", [accessory])
};

//add an accessory dynamically to the current platform
EweLink.prototype.addAccessory = function(platform, device){

    if (platform.accessories.get(device.deviceid)){
        platform.log("Device with id [%s] already recorded as an accessory, no further action", device.deviceid)
    }

    else{
        platform.log("Found Accessory with Name : [%s], Manufacturer : [%s], Status : [%s], Is Online : [%s], API Key: [%s] "
            , device.name, device.productModel, device.params.switch, device.online, device.apikey);

        //create and configure the accessory
        const accessory = new Accessory(device.name, UUIDGen.generate(device.deviceid.toString()));
        accessory.context.deviceId = device.deviceid;
        accessory.context.apiKey = device.apikey;
        accessory.reachable = device.online;

        platform.servDet.configureAccessoryAsService(accessory, device.name)

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
    this.log("Configure Accessory: [%s]", accessory.displayName);
    if (!this.servDet) {
        this.servDet = new ServiceDeterminer(this, Service, Characteristic);
    }
    this.servDet.configureExistingAccessory(accessory);
    this.accessories.set(accessory.context.deviceId, accessory);
};