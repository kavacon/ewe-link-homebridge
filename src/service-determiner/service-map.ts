import {EwelinkConnection} from "../ewelink-connection";
import {HAP} from "homebridge";
import {readdirSync} from "fs";
import {AbstractServiceType} from "./service-types/service-type";
import {Logging} from "homebridge/lib/logger";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../context";
import Switch from "./service-types/switch";

export class ServiceMap {
    private readonly serviceTypeMap: Map<string, AbstractServiceType> = new Map<string, AbstractServiceType>();
    private readonly defaultType: AbstractServiceType;
    private readonly log: Logging;

    constructor(log: Logging, server: EwelinkConnection, hap: HAP) {
        this.log = log;
        this.defaultType = new Switch(server, log, hap);
        this.fillServiceMap(log, server, hap);
    }

    private fillServiceMap(log: Logging, server: EwelinkConnection, hap: HAP) {
        const files = readdirSync(__dirname + "/service-types/");
        log.info("Found files: ", JSON.stringify(files));
        for (const file of files) {
            if (!file.includes("service-type") && file.endsWith(".js")) {
                log.info(file);
                import("./service-types/" + file).then(Constructor => {
                        const serviceType: AbstractServiceType = new Constructor.default(server, log, hap);
                        this.serviceTypeMap.set(serviceType.getServiceTag(), serviceType);
                        log.info("Initialised service management for: [%s]", serviceType.getServiceTag());
                    }
                )
            }
        }
    }

    getServiceType(accessory: PlatformAccessory<EweLinkContext>): AbstractServiceType {
        return this.serviceTypeMap.get(accessory.context.deviceServiceKey)!;
    }

    calculateServiceType(name: string): AbstractServiceType {
        let serviceType = this.defaultType;
        this.serviceTypeMap.forEach( (value, key) => {
            this.log("Checking accessory [%s] against service key [%s]", name, key);
            if (name.toLowerCase().includes(key.toLowerCase())) {
                serviceType = value;
                this.log("Accessory matched with service");
            }
        });
        return serviceType;
    }
}