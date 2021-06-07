/**
 * Example Config
 * {
            "name": "EweLink",
            "platform": "EweLink",
            "email": "kavacon@icloud.com",
            "password": "",
            "region": "cn"
        }
 * @type {module:ewelink-api}
 */
import {
    API,
    APIEvent,
    DynamicPlatformPlugin,
    HAP,
    Logging,
    PlatformAccessory,
    PlatformConfig,
} from "homebridge";

import {EwelinkConnection} from "./ewelink-connection"
import {Device} from "ewelink-api";
import {Characteristic, Service} from "hap-nodejs";
import {EweLinkContext} from "./context";
import {ServiceManager} from "./service-determiner/service-manager";

const PLUGIN_NAME = "homebridge-ewelink-with-api";
const PLATFORM_NAME = "EweLink";

let hap: HAP;
let Accessory: typeof PlatformAccessory;

interface AccessoryInformation {
    id: string,
    name: string,
    serialNumber: string,
    manufacturer: string,
    model: string,
    firmareRevision: string,
    apiKey: string,
    state: string,
}

export = (api: API) => {
    hap = api.hap;
    Accessory = api.platformAccessory;
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, EweLinkPlatform);
};

class EweLinkPlatform implements DynamicPlatformPlugin {
    private readonly log: Logging;
    private readonly api: API;
    private readonly connection: EwelinkConnection;
    private readonly accessories: Map<String,PlatformAccessory<EweLinkContext>> = new Map();
    private readonly serviceManager: ServiceManager;

    constructor(log: Logging, config: PlatformConfig, api: API) {
        this.log = log;
        this.api = api;

        this.log.info("Ewelink bridge starting up");
        this.connection = new EwelinkConnection({
                email: config.email,
                password: config.password,
            },
            this.log
        );

        this.serviceManager = new ServiceManager(this.connection, this.log, hap);
        this.api.on(APIEvent.DID_FINISH_LAUNCHING, this.apiDidFinishLaunching.bind(this))
    }

    private apiDidFinishLaunching(){
        this.log.info("apiDidFinishLaunching callback activating");

        //log in to ewelink
        const connectionPromise = this.connection.activateConnection(value => {
            if (value) {
                this.log.info("eweLink Connection established");
            }
        });

        //retrieve devices from ewelink
        connectionPromise
            .then(() => this.connection.requestDevices(devices => devices))
            .then(this.mapDevicesToAccessoryInformation.bind(this))
            .then(this.sortAccessoryInformation.bind(this))
            //bulk add all new accessories
            .then(this.processAccessoryInformation.bind(this))
            .then(() => this.connection.openMonitoringSocket(this.onAccessoryStateChange.bind(this)))
            .catch( reason => this.log.error("Upstream error: [%s]", reason))
            .finally(() => this.log.info("Accessory and connection setup completed, check earlier logs for any errors"))


    }

    private mapDevicesToAccessoryInformation(devices: Device[] | null): AccessoryInformation[]{
        if (devices) {
            this.log.info("Following devices retrieved from eweLink:\n%s", JSON.stringify(devices, null, 4));
            return devices.map(device => {
               return {
                   id: device.deviceid,
                   name: device.name,
                   serialNumber: device.extra.extra.mac,
                   manufacturer: device.productModel,
                   model: device.extra.extra.model,
                   firmareRevision: device.params.fwVersion,
                   apiKey: device.apikey,
                   state: device.params.switch
               }
           })
        } else {
            this.log.warn("No devices retrieved from eweLink check previous logs for any errors");
            return [];
        }
    }

    private sortAccessoryInformation(infoArray: AccessoryInformation[]): { new: AccessoryInformation[], existing: AccessoryInformation[], deletions: String[] } {
        const newAccessories = new Array<AccessoryInformation>();
        const existingAccessories = new Array<AccessoryInformation>();
        const deletions = Array.from(this.accessories.keys());

        infoArray.forEach(info => {
            if (this.accessories.has(info.id)) {
                existingAccessories.push(info);
                const idx = deletions.indexOf(info.id);
                deletions.splice(idx, 1);
            } else {
                newAccessories.push(info);
            }
        });

        return {
            new: newAccessories,
            existing: existingAccessories,
            deletions: deletions
        }
    }

    private processAccessoryInformation(sortedInformation: {new: AccessoryInformation[], existing: AccessoryInformation[], deletions: String[]}){
        const newAccessories = sortedInformation.new.map(this.createAccessory.bind(this));
        const expiredAccessories = sortedInformation.deletions.map((id) => this.removeAccessory(id));
        sortedInformation.existing.forEach(this.updateAccessory.bind(this));

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, expiredAccessories);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories)

    }

    private createAccessory(information: AccessoryInformation): PlatformAccessory<EweLinkContext> {
        //create an accessory using AccessoryInformation and cache it locally
        this.log.info("Found Accessory with Name : [%s], Manufacturer : [%s], API Key: [%s] ",
            information.name, information.manufacturer, information.apiKey);
        const accessory = new Accessory<EweLinkContext>(information.name, hap.uuid.generate(information.id));
        accessory.context.deviceId = information.id;
        accessory.context.apiKey = information.apiKey;

        this.serviceManager.configureNewAccessoryWithService(accessory);
        accessory.getService(Service.AccessoryInformation)!
            .setCharacteristic(Characteristic.SerialNumber, information.serialNumber)
            .setCharacteristic(Characteristic.Manufacturer, information.manufacturer)
            .setCharacteristic(Characteristic.Model, information.model)
            .setCharacteristic(Characteristic.FirmwareRevision, information.firmareRevision);

        this.accessories.set(information.id, accessory);
        return accessory
    }

    private updateAccessory(information: AccessoryInformation) {
        this.log("Device [%s] already configured, updating configuration", information.name);
        const accessory = this.accessories.get(information.id);
        accessory!.getService(Service.AccessoryInformation)!
            .setCharacteristic(Characteristic.Name, information.name)
            .setCharacteristic(Characteristic.SerialNumber, information.serialNumber)
            .setCharacteristic(Characteristic.Manufacturer, information.manufacturer)
            .setCharacteristic(Characteristic.Model, information.model)
            .setCharacteristic(Characteristic.FirmwareRevision, information.firmareRevision);
        this.serviceManager.updateCharacteristicStates(accessory!, information.state);
    }

    private onAccessoryStateChange(deviceId: string, state: string) {
        this.log.info("Websocket indicates that device [%s] is now in state [%s]", deviceId, state);
        const accessory = this.accessories.get(deviceId);
        this.serviceManager.updateCharacteristicStates(accessory!, state);
    }

    private removeAccessory(deviceId: String): PlatformAccessory<EweLinkContext>{
        const accessory = this.accessories.get(deviceId);
        this.log.info("Removing accessory [%s]", accessory?.displayName);
        this.accessories.delete(deviceId);
        return accessory!;
    }

    configureAccessory(accessory: PlatformAccessory<EweLinkContext>): void {
        this.log.info("Running configureAccessory on accessory: [%s]", accessory.displayName);
        this.serviceManager.configureAccessoryWithService(accessory);
        this.accessories.set(accessory.context.deviceId, accessory);
    }
}