const ServiceType = require("../serviceType");

class Switch extends ServiceType{
    constructor(Service, Characteristic, platform){
        super(Service.Switch, platform);
        this.Characteristic = Characteristic;
        this.Service = Service;
    }

    getServiceName() {
        return "switch";
    }

    translateServerState(device){
        return device.params.switch === "on" ? 1 : 0;
    }

    translateLocalState(targetState){
        return targetState ? "on" : "off";
    }

    async performLocalStateChange(accessory, targetState){
        await this.platform.connection.toggleDevice(accessory.context.deviceId);
    }

    updateCharacteristic(deviceId, state) {
        const targetState = state === "on";
        const accessory = this.platform.accessories.get(deviceId);

        this.platform.log("Updating Characteristic.On for accessory [%s] to [%s]", accessory.displayName, targetState);
        accessory.getService(this.Service.Switch).setCharacteristic(this.Characteristic.On, targetState);
    };

    //configure the characteristics of a switch
    configureCharacteristics(service, accessory) {
        service.getCharacteristic(this.Characteristic.On)
            .on("set", function(value, callback){this.setState(accessory, value, callback);})
            .on("get", function(callback){this.getState(accessory, callback);});
    }
}

module.exports = Switch;