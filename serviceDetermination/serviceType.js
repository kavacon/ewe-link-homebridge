class ServiceType {
    constructor(serviceKind, platform) {
        this.serviceKind = serviceKind;
        this.platform = platform;
        this.platform.log("<%s> service module configured", this.getServiceName());
    }

    getServiceName() {
        throw("getServiceName has not been defined, this is an invalid ServiceType")
    }

    setState(accessory, targetState, callback) {
        const targetServerState = this.translateLocalState(targetState);

        this.platform.log("Setting powerstate for accessory: [%s]", accessory.displayName);
        this.platform.log("Requested state is [%s]", targetState);

        (async () => {

            const serverState = await this.platform.connection.getDevicePowerState(accessory.context.deviceId);
            this.platform.log("Device state returned as [%s]", serverState);

            if (serverState) {
                if (serverState.state !== targetServerState) {
                    this.platform.log("Device state does not match target state, updating [%s]", accessory.displayName);
                    await this.performLocalStateChange(targetState);
                } else {
                    this.platform.log("Device [%s] already in requested state", accessory.displayName);
                }
                callback();
            } else {
                this.platform.log("Could not retrieve current power state, device [%s] cannot be set", accessory.displayName);
                callback("Unable to determine power state");
            }
        })();
    };

    getState(accessory, callback) {
        this.platform.log("Checking powerstate for accessory: [%s]", accessory.displayName);
        (async () => {

            const device = await this.platform.connection.getDevice(accessory.context.deviceId);
            const state = this.translateServerState(device);
            //check the result returned is not null
            if (device) {
                //check if online
                if (device.online) {
                    //record state
                    accessory.reachable = true;
                    this.platform.log("Device [%s] was found and is online", accessory.displayName);
                    this.platform.log("Device [%s] has state [%s]", device.name, device.params.switch);
                    callback(null, state);

                } else {
                    accessory.reachable = false;
                    this.platform.log("Device [%s] was found but is not online", accessory.displayName)
                }
            } else {
                this.platform.log("Device [%s] was not found on ewelink and will be removed", accessory.displayName);
                this.platform.removeAccessory(accessory);
                callback("Device discovery failure");
            }
        })();
    };

    translateServerState(device){
        throw("translateServerState has not been defined, this is an invalid ServiceType")
    }

    translateLocalState(targetState){
        throw("translateServerState has not been defined, this is an invalid ServiceType")
    }

    async performLocalStateChange(accessory, targetState){
        throw("updateCharacteristicsForLocalState has not been defined, this is an invalid ServiceType")
    }

    //update the power state of an accessory from external source
    updateCharacteristic(deviceId, state) {
        throw("updateCharacteristic not been defined, this is an invalid ServiceType")
    };

    //configure the characteristics of a switch
    configureCharacteristics(service, accessory) {
        throw("configureCharacteristics has not been defined, this is an invalid ServiceType")
    }

    //set switch service on a new accessory
    addService(accessory, name) {
        this.platform.log("Configuring [%s] as a [%s] service", name, this.serviceKind);
        return accessory.addService(this.serviceKind, name);
    };

    //set switch service on an existing accessory
    refreshService(accessory) {
        this.platform.log("Configuring [%s] as a [%s] service", accessory.displayName, this.serviceKind);
        return accessory.getService(this.serviceKind);
    };

    setOnIdentify(accessory) {
        accessory.on("identify", function (paired, callback) {
            this.platform.log(accessory.displayName, "Identify not supported");
            callback();
        });
    }
}

module.exports = ServiceType;