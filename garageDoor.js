let Service, Characteristic, platform;
const ewelink = require("ewelink-api");

module.exports.configure = function(platformInstance, service, characteristic){
    Service = service;
    Characteristic = characteristic;
    platform = platformInstance;
    platform.log("garage door service module configured");
}

module.exports.setIdentify = function(accessory){
    accessory.on("identify", function(paired, callback) {
        platform.log(accessory.displayName, "Identify not supported");
        callback();
    });
}