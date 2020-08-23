let Service, Characteristic, platform;

module.exports.configure = function(platformInstance, service, characteristic){
    Service = service;
    Characteristic = characteristic;
    platform = platformInstance;
    platform.log("garage door service module configured");
}

function setState(accessory, targetState, callback){
    const targetServerState = targetState === Characteristic.TargetDoorState.OPEN ? "on" : "off";

    platform.log("Setting powerstate for accessory: [%s]", accessory.displayName);
    platform.log("Requested state is [%s]", targetState);

    (async () => {

        const serverState = await platform.connection.getDevicePowerState(accessory.context.deviceId);
        platform.log("Device state returned as [%s]", serverState);

        if (serverState) {
            if (serverState.state !== targetServerState) {
                platform.log("Device state does not match target state, toggling [%s]", accessory.displayName);
                accessory.getService(Service.GarageDoorOpener).setCharacteristic(Characteristic.CurrentDoorState, targetState + 2);
                await platform.connection.toggleDevice(accessory.context.deviceId);
                accessory.getService(Service.GarageDoorOpener).setCharacteristic(Characteristic.CurrentDoorState, targetState);
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

function getState(accessory, callback){

    platform.log("Checking powerstate for accessory: [%s]", accessory.displayName);
    (async () => {

        const device = await platform.connection.getDevice(accessory.context.deviceId);
        const state = device.params.switch === "on" ? Characteristic.TargetDoorState.OPEN : Characteristic.TargetDoorState.CLOSED;
        //check the result returned is not null
        if (device) {
            //check if online
            if (device.online) {
                //record state
                accessory.reachable = true;
                platform.log("Device [%s] was found and is online", accessory.displayName);
                platform.log("Device [%s] has state [%s]", device.name, device.params.switch);
                callback(null, state);

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

//update the power state of an accessory from external source
module.exports.updateCharacteristic = function(deviceId, state){

    const targetState = state === "on" ? Characteristic.TargetDoorState.OPEN : Characteristic.TargetDoorState.CLOSED;
    const accessory = platform.accessories.get(deviceId);

    platform.log("Updating Characteristic.TargetDoorState for accessory [%s] to [%s]", accessory.displayName, targetState);
    accessory.getService(Service.GarageDoorOpener).setCharacteristic(Characteristic.TargetDoorState, targetState);
    accessory.getService(Service.GarageDoorOpener).setCharacteristic(Characteristic.CurrentDoorState, targetState);
};

//set switch service on a new accessory
module.exports.addService = function(accessory, name){
    platform.log("Configuring [%s] as a GarageDoorOpener service", name);
    return accessory.addService(Service.GarageDoorOpener, name);
};

//set switcg service on an existing accessory
module.exports.refreshService = function(accessory){
    platform.log("Configuring [%s] as a GarageDoorOpener service", accessory.displayName);
    return accessory.getService(Service.GarageDoorOpener)
};

//configure the characteristics of a switch
module.exports.configureCharacteristics = function(service, accessory){
    service.getCharacteristic(Characteristic.TargetDoorState)
        .on("set", function(value, callback){setState(accessory, value, callback);})
        .on("get", function(callback){getState(accessory, callback);});

    service.getCharacteristic(Characteristic.CurrentDoorState)
        .on("get", function(callback){getState(accessory, callback);})
}

module.exports.setOnIdentify = function(accessory){
    accessory.on("identify", function(paired, callback) {
        platform.log(accessory.displayName, "Identify not supported");
        callback();
    });
}

