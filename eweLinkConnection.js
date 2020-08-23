const ewelink = require("ewelink-api");

/**
 * Wrapper class for ewelink connection allows separation of connection creation from authentication.
 * This is important as when accessories are cached requests may be attempted to the ewe link server before the
 * api is initialised, the wrapper allows us to intercept this and check if login/authentication has been attempted
 * before passing on the call to the connection
 */
class EweLinkConnection{

    constructor(config, log){
        this.log = log;
        this.auth = null;
        log("Connection being created")
        this.connection = new ewelink({
            email: config["email"],
            password: config["password"],
            region: config["region"],
        });
    }

    async authenticate(){
        this.log("Authentication on connection requested");
        this.auth = await this.connection.getCredentials();
        this.log("Auth details received");
    }

    async getDevicePowerState(deviceId){
        return this.runIfAuthenticated(async () => await this.connection.getDevicePowerState(deviceId),
            "getDevicePowerState")
    }

    async getDevice(deviceId){
        return this.runIfAuthenticated(async () => await this.connection.getDevice(deviceId),
            "getDevice");
    }

    async getDevices(){
        return this.runIfAuthenticated(async () => await this.connection.getDevices(),
            "getDevices");
    }

    async toggleDevice(deviceId){
        return this.runIfAuthenticated(async () => await this.connection.toggleDevice(deviceId),
            "toggleDevice");
    }

    /**
     * Check if the connection has authenticated, if not log the failed request and return null
     * @param callback the function to call if authenticated
     * @param requestName the name of the request to log on failure
     * @return {Promise<null|*>}
     */
    async runIfAuthenticated(callback, requestName){
        if (this.auth){
            return await callback()
        }
        else {
            this.log("Service is not authenticated, no connection available cannot complete request [%s]", requestName);
            return null;
        }
    }
}

module.exports = EweLinkConnection;
