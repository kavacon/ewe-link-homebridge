const Switch = require("./serviceTypes/switch");
const fs = require("fs");

class ServiceDeterminer {
    constructor(platform, service, characteristic) {
        this.platform = platform;
        this.serviceMap = new Map();
        this.accessoryCache = new Map();
        this.fillMaps(service, characteristic, platform);
        this.defaultType = new Switch(service, characteristic, platform)
        this.platform.log("service determination initialised");
    }

    fillMaps(service, characteristic, platform) {
        const files = fs.readdirSync(__dirname + "serviceTypes/");
        files.forEach(file => {
                const Constructor = require("./serviceTypes/"+file);
                const type = new Constructor(service, characteristic, platform);
                this.serviceMap.set(type.getServiceName(), type);
            });
    }

    retrieveServiceType(name) {
        let serviceType = this.accessoryCache.get(name);

        if (serviceType) {
            this.platform.log("Device [%s] has cached service type", name);
        } else {
            this.platform.log("Cache lookup for [%s] not successful", name);
            serviceType = this.determineServiceType(name);
        }

        return serviceType;

    }

    determineServiceType(name) {
        let serviceType = this.defaultType;

        this.serviceMap.forEach((value, key) => {
            this.platform.log("Checking accessory [%s] against service key [%s]", name, key);
            if (name.toUpperCase().includes(key.toUpperCase())) {
                serviceType = value;
                this.platform.log("Match for accessory [%s] against service key [%s] storing in cache", name, key);
                this.accessoryCache.set(name, value);
            }
        });

        return serviceType;
    }

    configureAccessoryAsService(accessory, name) {
        let serviceType = this.retrieveServiceType(name);
        let serviceInstance = serviceType.addService(accessory, name);
        serviceType.configureCharacteristics(serviceInstance, accessory);
        serviceType.setOnIdentify(accessory);
    };

    configureExistingAccessory (accessory) {
        let serviceType = this.retrieveServiceType(accessory.displayName);
        let serviceInstance = serviceType.refreshService(accessory);
        serviceType.configureCharacteristics(serviceInstance, accessory);
    }

    updateCharacteristic(deviceId, state) {
        let serviceType = this.retrieveServiceType(this.platform.accessories.get(deviceId).displayName);
        serviceType.updateCharacteristic(deviceId, state);
    }
}
module.exports = ServiceDeterminer;