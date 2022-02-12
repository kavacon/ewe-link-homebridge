import {EwelinkConnection} from "../ewelink/ewelink-connection";
import {HAP} from "homebridge";
import {readdirSync} from "fs";
import {AbstractServiceUtility} from "./service-utility/service-utility";
import {Logging} from "homebridge/lib/logger";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../context";
import SwitchUtility from "./service-utility/switch-utility";
import GarageDoorOpenerUtility from "./service-utility/garage-door-opener-utility";
import {Queue} from "../queue/queue";

export class ServiceMap {
    private readonly serviceTypeMap: Map<string, AbstractServiceUtility> = new Map<string, AbstractServiceUtility>();
    private readonly defaultUpdater: AbstractServiceUtility;
    private readonly log: Logging;

    constructor(log: Logging, server: EwelinkConnection, hap: HAP, queue: Queue) {
        this.log = log;
        this.defaultUpdater = new SwitchUtility(server, log, hap, queue);
        this.fillServiceMap(log, server, hap, queue);
    }

    private async fillServiceMap(log: Logging, server: EwelinkConnection, hap: HAP, queue: Queue) {
        const garageDoorUtility = new GarageDoorOpenerUtility(server, log, hap, queue);
        const switchUtility = new SwitchUtility(server, log, hap, queue);

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