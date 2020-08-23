/**
 * A wrapper class for the homebridge Service.
 * Allows encapsulation of update methods between the ewe-link server and homebridge
 * and is used by service determiner to assign appropriate update methods to accessories
 */
class ServiceType {
    constructor(serviceKind, platform) {
        this.serviceKind = serviceKind;
        this.platform = platform;
        this.platform.log("<%s> service module configured", this.getServiceName());
    }

    /**
     * The local name/key for this service, is used to determine if a named accessory belongs
     * to this service type
     */
    getServiceName() {
        throw("getServiceName has not been defined, this is an invalid ServiceType")
    }

    serviceTypeAsString(){
        this.getServiceName();
    }

    /**
     * Set the accessory to the target state on the server
     * @param accessory the local homebridge accessory
     * @param targetState the homebridge state requested
     * @param callback the homebridge completion callback
     */
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

    /**
     * Get the server state of the accessory for homebridge
     * @param accessory the homebridge accessory
     * @param callback the completion callback for homebridge
     */
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

    /**
     * Translate the state of a device on the server into a homebridge characteristic state
     * @param device the server device
     */
    translateServerState(device){
        throw("translateServerState has not been defined, this is an invalid ServiceType")
    }

    /**
     * Translate the homebridge state into a server side representation
     * @param targetState
     */
    translateLocalState(targetState){
        throw("translateServerState has not been defined, this is an invalid ServiceType")
    }

    /**
     * Update homebridge characteristics to align with the requested state
     * @param accessory the updated accessory
     * @param targetState the new state
     * @return {Promise<void>}
     */
    async performLocalStateChange(accessory, targetState){
        throw("updateCharacteristicsForLocalState has not been defined, this is an invalid ServiceType")
    }

    /**
     * update the power state of an accessory from a server update
     * @param deviceId the id of the accessory on the server
     * @param state the server state
     */
    updateCharacteristic(deviceId, state) {
        throw("updateCharacteristic not been defined, this is an invalid ServiceType")
    };

    /**
     * configure the characteristics of an accessory
     * @param service the homebridge characteristic service
     * @param accessory the accessory being configured
     */
    configureCharacteristics(service, accessory) {
        throw("configureCharacteristics has not been defined, this is an invalid ServiceType")
    }

    /**
     * Add a new accessory for the service type
     * @param accessory the new accessory
     * @param name the display name of the accessory
     * @return {Service | Service}
     */
    addService(accessory, name) {
        this.platform.log("Configuring [%s] as a [%s] service", name, this.serviceTypeAsString());
        return accessory.addService(this.serviceKind, name);
    };

    /**
     * Refresh an existing accessory for this service type
     * @param accessory the accessory
     * @return {DataStreamTransportManagement | Service | Service}
     */
    refreshService(accessory) {
        this.platform.log("Configuring [%s] as a [%s] service", accessory.displayName, this.serviceTypeAsString());
        return accessory.getService(this.serviceKind);
    };

    /**
     * Set the identify call for the accessory
     * @param accessory the accessory
     */
    setOnIdentify(accessory) {
        accessory.on("identify", function (paired, callback) {
            this.platform.log(accessory.displayName, "Identify not supported");
            callback();
        });
    }
}

module.exports = ServiceType;