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

import {EwelinkConnection} from "./ewelink/ewelink-connection"
import {EweLinkContext} from "./context";
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

        this.accessoryService = new AccessoryService(this.log, this.connection, this.api, hap);
        // Only occurs once all existing accessories have been loaded
        this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => this.apiDidFinishLaunching(config.real_time_update, config.real_time_tolerance_window,));
        this.api.on(APIEvent.SHUTDOWN, () => this.shutdown())
    }

    private apiDidFinishLaunching(enableWebSocket: boolean, webSocketToleranceWindow: number){
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
            connectionPromise = connectionPromise.then(() => this.connection.openMonitoringSocket(webSocketToleranceWindow,
                (id, state) => this.accessoryService.updateAccessoryState(id, state)));
        }

         connectionPromise.catch( reason => this.log.error("Upstream error: [%s]", reason))
            .finally(() => this.log.info("Accessory and connection setup completed, check earlier logs for any errors"))


    }

    private shutdown() {
        this.connection.closeMonitoringSocket();
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
        const newAccessories = sortedInformation.new.map(a => this.accessoryService.createAccessory(a));
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories)
        newAccessories.forEach(a => this.accessoryService.saveAccessory(a))

        const expiredAccessories = sortedInformation.deletions.map(a => this.accessoryService.removeAccessory(a));
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, expiredAccessories);

        sortedInformation.existing.forEach(a => this.accessoryService.updateAccessoryInformation(a));
        sortedInformation.existing.forEach(a => this.accessoryService.updateAccessoryState(a.id, a.state));
    }

    configureAccessory(accessory: PlatformAccessory<EweLinkContext>): void {
        this.log.info("Loading saved accessory: [%s]", accessory.displayName);
        this.accessoryService.configureIdentify(accessory);
        this.accessoryService.configureService(accessory);
        this.accessoryService.saveAccessory(accessory);
    }
}