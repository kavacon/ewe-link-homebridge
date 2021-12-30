import {EwelinkConnection} from "../ewelink-connection";
import {HAP} from "homebridge";
import {readdirSync} from "fs";
import {AbstractServiceUtility} from "./service-utility/service-utility";
import {Logging} from "homebridge/lib/logger";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../context";
import SwitchImpl from "./service-utility/switch-impl";
import GarageDoorImpl from "./service-utility/garage-door-impl";

export class ServiceMap {
    private readonly serviceTypeMap: Map<string, AbstractServiceUtility> = new Map<string, AbstractServiceUtility>();
    private readonly defaultUpdater: AbstractServiceUtility;
    private readonly log: Logging;

    constructor(log: Logging, server: EwelinkConnection, hap: HAP) {
        this.log = log;
        this.defaultUpdater = new SwitchImpl(server, log, hap);
        this.fillServiceMap(log, server, hap);
    }

    private async fillServiceMap(log: Logging, server: EwelinkConnection, hap: HAP) {
        const garageDoorUtility = new GarageDoorImpl(server, log, hap);
        const switchUtility = new SwitchImpl(server, log, hap);

        this.serviceTypeMap.set(garageDoorUtility.getServiceTag(), garageDoorUtility);
        this.serviceTypeMap.set(switchUtility.getServiceTag(), switchUtility);
    }

    getServiceType(accessory: PlatformAccessory<EweLinkContext>): AbstractServiceUtility {
        return this.serviceTypeMap.get(accessory.context.deviceServiceKey)!;
    }

    calculateServiceType(name: string): AbstractServiceUtility {
        let serviceType = this.defaultUpdater;
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