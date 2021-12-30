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
import {EweLinkContext} from "./context";
import {ServiceManager} from "./service-determiner/service-manager";
import {AccessoryInformation, mapDevicesToAccessoryInformation} from "./accessory/accessory-mapper";
import {AccessoryService} from "./accessory/accessory-service";

const PLUGIN_NAME = "homebridge-ewelink-with-api";
const PLATFORM_NAME = "EweLink";

let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
    hap = api.hap;
    Accessory = api.platformAccessory;
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, EweLinkPlatform);
};

class EweLinkPlatform implements DynamicPlatformPlugin {
    private readonly log: Logging;
    private readonly api: API;
    private readonly connection: EwelinkConnection;
    private readonly serviceManager: ServiceManager;
    private readonly accessoryService: AccessoryService;

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
        this.accessoryService = new AccessoryService(this.log, this.connection, hap);
        // Only occurs once all existing accessories have been loaded
        this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => this.apiDidFinishLaunching(config.real_time_update))
    }

    private apiDidFinishLaunching(enableWebSocket: boolean){
        this.log.info("apiDidFinishLaunching callback activating");

        //log in to ewelink
        let connectionPromise = this.connection.activateConnection(value => {
            if (value) {
                this.log.info("eweLink Connection established");
            }
        });

        //retrieve devices from ewelink
        connectionPromise = connectionPromise
            .then(() => this.connection.requestDevices(devices => mapDevicesToAccessoryInformation(this.log, devices)))
            .then(this.sortAccessoryInformation.bind(this))
            //bulk add all new accessories
            .then(this.processAccessoryInformation.bind(this));

         if (enableWebSocket) {
             connectionPromise = connectionPromise.then(() => this.connection.openMonitoringSocket(this.accessoryService.updateAccessory))
         }

         connectionPromise.catch( reason => this.log.error("Upstream error: [%s]", reason))
            .finally(() => this.log.info("Accessory and connection setup completed, check earlier logs for any errors"))


    }

    private sortAccessoryInformation(infoArray: AccessoryInformation[] | null): { new: AccessoryInformation[], existing: AccessoryInformation[], deletions: string[] } {
        const map = new Map(infoArray?.map(i => [i.id, i]))
        const sorting = this.accessoryService.determineExistence(Array.from(map.keys()));

        return {
            new: sorting.notFound.map(i => map.get(i)!),
            existing: sorting.intersection.map(i => map.get(i)!),
            deletions: sorting.serviceOnly,
        }
    }

    private processAccessoryInformation(sortedInformation: {new: AccessoryInformation[], existing: AccessoryInformation[], deletions: string[]}){
        const newAccessories = sortedInformation.new.map(this.accessoryService.createAccessory);
        const expiredAccessories = sortedInformation.deletions.map(this.accessoryService.removeAccessory);
        sortedInformation.existing.forEach(this.accessoryService.updateAccessoryInformation);

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, expiredAccessories);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories)

    }

    configureAccessory(accessory: PlatformAccessory<EweLinkContext>): void {
        this.log.info("Loading saved accessory: [%s]", accessory.displayName);
        this.accessoryService.configureIdentify(accessory);
        this.accessoryService.configureService(accessory);
        this.accessoryService.saveAccessory(accessory);
    }
}