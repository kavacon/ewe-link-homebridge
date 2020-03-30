const switches = require("./switches");
const garageDoor = require("./garageDoor");
let Service, Characteristic, platform;
const serviceMap = new Map();
const accessoryCache = new Map();

module.exports.configure = function(platformInstance, service, characteristic){
    Service = service;
    Characteristic = characteristic;
    platform = platformInstance;
    fillMaps();
    switches.configure(platformInstance, service, characteristic);
    garageDoor.configure(platformInstance, service, characteristic);
    platform.log("service determination configure");
}

function fillMaps(){
    serviceMap.set("garage", garageDoor);
    serviceMap.set("default", switches);
}

function retrieveServiceType(name){
    let serviceType = accessoryCache.get(name);

    if(serviceType){
        platform.log("Device [%s] has cached service type", name);
    }
    else {
        platform.log("Cache lookup for [%s] not successful", name);
        serviceType = determineServiceType(name);
    }

    return serviceType;

}

function determineServiceType(name){
    let serviceType = serviceMap.get("default");

    serviceMap.forEach((value, key, map) => {
        platform.log("Checking accessory [%s] against service key [%s]", name, key);
        if (name.toUpperCase().includes(key.toUpperCase())){
            serviceType = value
            platform.log("Match for accessory [%s] against service key [%s] storing in cache", name, key);
            accessoryCache.set(name, value);
        }
    });

    return serviceType;
}

module.exports.configureAccessoryAsService = function(accessory, name){
    let serviceType = retrieveServiceType(name);
    let serviceInstance = serviceType.addService(accessory, name);
    serviceType.configureCharacteristics(serviceInstance, accessory)
    serviceType.setOnIdentify(accessory);
};

module.exports.configureExistingAccessory = function(accessory){
    let serviceType = retrieveServiceType(accessory.displayName);
    let serviceInstance = serviceType.refreshService(accessory);
    serviceType.configureCharacteristics(serviceInstance, accessory)
}

module.exports.updateCharacteristic = function(deviceId, state){
    let serviceType = retrieveServiceType(platform.accessories.get(deviceId).displayName);
    serviceType.updateCharacteristic(deviceId, state);
}