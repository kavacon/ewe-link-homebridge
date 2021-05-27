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
    api.registerPlatform(PLATFORM_NAME, EweLinkPlatform);
};

class EweLinkPlatform implements DynamicPlatformPlugin {
    private readonly log: Logging;
    private readonly api: API;
    private readonly connection: EwelinkConnection;
    private readonly accessories: Map<String,PlatformAccessory<EweLinkContext>> = new Map();
    private readonly serviceManager: ServiceManager;
    private ewelinkApiToken: string = "";

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

        this.serviceManager = new ServiceManager(this.connection, this.log);
        this.api.on(APIEvent.DID_FINISH_LAUNCHING, this.apiDidFinishLaunching)
    }

    private apiDidFinishLaunching(){
        this.log.info ("apiDidFinishLaunching callback activating");

        //log in to ewelink
        const connectionPromise = this.connection.activateConnection(value => {
            if (value) {
                this.log.info("eweLink Connection established");
                this.ewelinkApiToken = value.at;
            }
        });

        //bulk remove all old accessories
        this.accessories.forEach( accessory => {
            this.log.info("Accessory with device Id [%s] no longer active, removing", accessory.context.deviceId);
            this.removeAccessory(accessory);
        });
        this.accessories.clear();

        //retrieve devices from ewelink
        connectionPromise
            .then(() => this.connection.requestDevices(devices => devices))
            .then(this.mapDevicesToAccessoryInformation)
            .then(accessoryInfo => accessoryInfo.map(this.createAccessory))
            //bulk add all new accessories
            .then(accessories => this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessories))
            .then(() => this.connection.openMonitoringSocket(this.onAccessoryStateChange))
            .finally(() => this.log.info("Accessory and connection setup completed, check earlier logs for any errors"))


    }

    private mapDevicesToAccessoryInformation(devices: Device[] | null): AccessoryInformation[]{
        if (devices) {
            this.log.info("Following devices retrieved from eweLink:\n%s", devices);
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
            .setCharacteristic(Characteristic.FirmwareRevision, information.firmareRevision);

        this.accessories.set(information.id, accessory);
        return accessory
    }

    private onAccessoryStateChange(deviceId: string, state: string) {
        //TODO: implement update once tested to make sure params are correct
        this.log.info("Websocket indicates that device [%s] is now in state [%s]", deviceId, state)
    }

    private removeAccessory(accessory: PlatformAccessory<EweLinkContext>) {
        this.log.info("Removing accessory [%s]", accessory.displayName);
        this.accessories.delete(accessory.context.deviceId);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }


    configureAccessory(accessory: PlatformAccessory<EweLinkContext>): void {
        this.log.info("Running configureAccessory on accessory: [%s]", accessory.displayName)
        this.serviceManager.configureAccessoryWithService(accessory);
        this.accessories.set(accessory.context.deviceId, accessory);
    }
}