import {readdirSync} from "fs";
import {EwelinkConnection} from "../ewelink-connection";
import {Logging} from "homebridge/lib/logger";
import {AbstractServiceType} from "./service-types/service-type";
import {Switch} from "./service-types/switch";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../context";

export class ServiceManager {
    readonly serviceTypeMap: Map<string, AbstractServiceType> = new Map<string, AbstractServiceType>();
    readonly defaultType: AbstractServiceType;
    readonly log: Logging;
    readonly accessoryCache: Map<string, AbstractServiceType> = new Map<string, AbstractServiceType>();

    constructor(server: EwelinkConnection, log: Logging) {
        this.fillMaps(server, log);
        this.defaultType = new Switch(server, log);
        this.log = log;

    }

    private async fillMaps(server: EwelinkConnection, log: Logging) {
        const files = readdirSync(__dirname + "service-types/");
        for (const file in files) {
            if (file !== "service-type.ts") {
                const Constructor = await import("./service-types/" + file);
                const serviceType: AbstractServiceType = new Constructor(server, log);
                this.serviceTypeMap.set(serviceType.getServiceTag(),serviceType);
            }
        }
    }

    private calculateServiceTypeFromName(name: string): AbstractServiceType {
        let serviceType = this.defaultType;
        this.serviceTypeMap.forEach( (value, key) => {
            this.log("Checking accessory [%s] against service key [%s]", name, key);
            if (name.toLowerCase().includes(key.toLowerCase())) {
                serviceType = value;
                this.log("Accessory matched with service");
                this.accessoryCache.set(name, value);
            }
        });
        return serviceType;
    }

    private getServiceTypeForAccessory(name: string): AbstractServiceType {
        return this.accessoryCache.get(name) || this.calculateServiceTypeFromName(name);
    }

    public refreshCharacteristicStates(accessory: PlatformAccessory<EweLinkContext>, serverState: string) {
        this.getServiceTypeForAccessory(accessory.displayName).updateCharacteristics(accessory, serverState);
    }

    public configureNewAccessoryWithService(accessory: PlatformAccessory<EweLinkContext>) {
        const serviceType = this.getServiceTypeForAccessory(accessory.displayName);
        serviceType.addAccessoryToService(accessory);
        serviceType.configureAccessoryCharacteristics(accessory);
        serviceType.setAccessoryOnIdentify(accessory);
    }

    public configureAccessoryWithService(accessory: PlatformAccessory<EweLinkContext>) {
        const serviceType = this.getServiceTypeForAccessory(accessory.displayName);
        serviceType.configureAccessoryCharacteristics(accessory);
    }
}