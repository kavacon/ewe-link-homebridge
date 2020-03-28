const ewelink = require('ewelink-api');
let Accessory, Service, Characteristic, UUIDGen;

// homebridge entry function, will allow plugin to register with the server
module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessoryConstructor;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-ewelink-with-api", "EweLink", EweLink, true);

}


/*********************************** Homebridge functions ********************************/
// start up the plugin
function EweLink(log, config, api) {
    log("Ewelink bridge starting up");

    //configure for external access
    var platform = this;
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = new Map();

    this.api.on('didFinishLaunching', apiDidFinishLaunching(platform))

}

// Retrieve accessory/device list and update accordingly
async function apiDidFinishLaunching(platform){
    //retrieve list of devices from ewelink and homebridge cache
    const connection = new ewelink.eWelink({
        email: this.config['email'],
        password: this.config['password'],
        region: this.config['region'],
    });
    
    const devices = await connection.getDevices();
    platform.log("Devices returned by ewe link are:");
    platform.log(devices);

    //remove and add devices as needed
    platform.log("Devices currently stored in local cache are:")
    platform.log(platform.accessories)

    //add and update the devices found in the ewelink connection
    devices.forEach(function (device){
        platform.apiKey = device.apiKey;
        if (platform.accessories.has(device.deviceid)){
            platform.log("Device Id [%s] already configured, updating configuration", device.deviceid);
            accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Name, device.name);
            accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, device.extra.extra.mac);
            accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, device.productModel);
            accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, device.extra.extra.model);
            accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.FirmwareRevision, device.params.fwVersion);
            platform.updatePowerStateCharacteristic(device.deviceid, device.switch);
        }
        else {
            platform.log("Device Id [%s] needs to be added, adding device", device.deviceid);
            platform.addAccessory(device);
        }
    });

    //remove devices not in the ewelink connection
    platform.accessories.forEach(function (accessory){
        if (!devices.has(accessory.deviceId)){
            platform.log("Accessory with device Id [%s] no longer active, removing", accessory.deviceId);
            platform.removeAccessory(accessory);
        }
    });
}

//update the power state of an accessory from external source
EweLink.prototype.updatePowerStateCharacteristic = function(deviceId, state){
    var platform = this;
    const targetState = state == "on";
    const accessory = platform.accessories.get(deviceId);

    platform.log("Updating Characteristic.On for accessory [%s] to [%s]", accessory.displayName, targetState);
    accessory.getService(Service.Switch).setCharacteristic(Characteristic.On, targetState);
}

//set the power state (on/off) of an accessorry
EweLink.prototype.setPowerState = async function(accessory, isOn, callback) {
    var platform = this;
    const targetState = isOn ? "on" : "off";

    const connection = new ewelink.eWelink({
        email: platform.config['email'],
        password: platform.config['password'],
        region: platform.config['region'],
    });

    const currentState = await connection.getDevicePowerState(accessory.context.deviceId);

    if(currentState){
        if (currentState.state != targetState){
            platform.log("Device state does not match target state, toggling [%s]", accessory.displayName)
                const status = await connection.toggleDevice(accessory.context.deviceId);
        }
        else {
            platform.log("Device [%s] already in requested state", accessory.displayName);
        }
        callback();
    }
    else {
        platform.log("Could not retrieve current power state, device [%s] cannot be set", accessory.displayName);
        callback("Unable to determine power state");
    }
}

//retrieve the power state (on/off) of the device from ewelink
EweLink.prototype.getPowerstate = async function(accessory, callback){
    var platform = this;

    const connection = new ewelink.eWelink({
        email: platform.config['email'],
        password: platform.config['password'],
        region: platform.config['region'],
    });
    const device = await connection.getDevice(accessory.context.deviceId);

    //check the result returned is not null
    if (device){
        //check if online
        if (device.onLine) {
            //record state
            accessory.reachable = true;
            platform.log("Device [%s] was found and is online", accessory.displayName)
            platform.log("Device [%s] has state [%s]", device.name, device.switch);
            callback(null, device.switch == "on" ? 1 : 0);
        }
        else{
            accessory.reachable = false;
            platform.log("Device [%s] was found but is not online", accessory.displayName)
        }
    }
    else {
        platform.log("Device [%s] was not found on ewelink and will be removed", accessory.displayName);
        platform.removeAccessory(accessory)
        callback("Device discovery failure");
    }
}

//remove an accessory from the current platform
EweLink.prototype.removeAccessory = function(accessory){
    var platform = this;

    platform.log("Removing accessory [%s]", accessory.displayName);
    platform.accessories.delete(accessory.context.deviceId);
    platform.api.unregisterPlatformAccessories("homebridge-ewelink-with-api", "EweLink", [accessory])
}

//add an accessory dynamically to the current platform
EweLink.prototype.addAccessory = function(device){
    var platform = this;

    if (platform.accessories.get(device.deviceid)){
        platform.log("Device with id [%s] already recorded as an accessory, no further action", device.deviceid)
    }

    else{
        platform.log("Found Accessory with Name : [%s], Manufacturer : [%s], Status : [%s], Is Online : [%s], API Key: [%s] "
            , device.name, device.productModel, device.switch, device.onLine, device.apikey);

        //create and configure the accessory
        const accessory = new Accessory(device.name, UUIDGen.generate(device.deviceid.toString()))
        accessory.context.deviceId = device.deviceid;
        accessory.context.apiKey = device.apikey;
        accessory.reachable = device.onLine;

        accessory.addService(Service.switch, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', async function (value, callback){ await platform.setPowerState(accessory, value, callback);})
            .on('get', async function (callback){await platform.getPowerstate(accessory, callback);});

        accessory.on('identify', function(paired, callback) {platform.log(accessory.displayName, "Identify not supported"); callback();});
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, device.extra.extra.mac);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, device.productModel);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, device.extra.extra.model);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Identify, false);
        accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.FirmwareRevision, device.params.fwVersion);

        platform.accessories.set(device.deviceid, accessory);
        platform.api.registerPlatformAccessories("homebridge-ewelink-with-api", "EweLink", [accessory]);
    }
}