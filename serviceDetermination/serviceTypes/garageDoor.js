const ServiceType = require("../serviceType");

class GarageDoor extends ServiceType{
    constructor(Service, Characteristic, platform){
        super(Service.GarageDoorOpener, platform);
        this.Characteristic = Characteristic;
        this.Service = Service;
    }

    getServiceName() {
        return "garage";
    }

    translateServerState(device){
        return device.params.switch === "on" ? this.Characteristic.TargetDoorState.OPEN : this.Characteristic.TargetDoorState.CLOSED
    }

    translateLocalState(targetState){
        return targetState === this.Characteristic.TargetDoorState.OPEN ? "on" : "off";
    }

    async performLocalStateChange(accessory, targetState){
        accessory.getService(this.Service.GarageDoorOpener).setCharacteristic(this.Characteristic.CurrentDoorState, targetState + 2);
        await this.platform.connection.toggleDevice(accessory.context.deviceId);
        accessory.getService(this.Service.GarageDoorOpener).setCharacteristic(this.Characteristic.CurrentDoorState, targetState);
    }

    updateCharacteristic(deviceId, state) {
        const targetState = state === "on" ? this.Characteristic.TargetDoorState.OPEN : this.Characteristic.TargetDoorState.CLOSED;
        const accessory = this.platform.accessories.get(deviceId);

        this.platform.log("Updating Characteristic.TargetDoorState for accessory [%s] to [%s]", accessory.displayName, targetState);
        accessory.getService(this.Service.GarageDoorOpener).setCharacteristic(this.Characteristic.TargetDoorState, targetState);
        accessory.getService(this.Service.GarageDoorOpener).setCharacteristic(this.Characteristic.CurrentDoorState, targetState);
    };

    configureCharacteristics(service, accessory) {
        service.getCharacteristic(Characteristic.TargetDoorState)
            .on("set", function(value, callback){this.setState(accessory, value, callback);})
            .on("get", function(callback){this.getState(accessory, callback);});

        service.getCharacteristic(Characteristic.CurrentDoorState)
            .on("get", function(callback){this.getState(accessory, callback);})
    }
}

module.exports = GarageDoor;