import {HAP} from "homebridge";
import {AbstractServiceUtility} from "./service-utility";
import {Logging} from "homebridge/lib/logger";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../context";
import SwitchUtility from "./switch-utility";
import GarageDoorOpenerUtility from "./garage-door-opener-utility";
import {Queue} from "../queue/queue";
import {Connection} from "../connection/connection";

export class ServiceUtilities {
    private readonly utilityByTag: Map<string, AbstractServiceUtility> = new Map<string, AbstractServiceUtility>();
    private readonly defaultUpdater: AbstractServiceUtility;
    private readonly log: Logging;

    constructor(log: Logging, server: Connection, hap: HAP, queue: Queue) {
        this.log = log;
        this.defaultUpdater = new SwitchUtility(server, log, hap, queue);
        this.initServiceUtilities(log, server, hap, queue);
    }

    private async initServiceUtilities(log: Logging, server: Connection, hap: HAP, queue: Queue) {
        const garageDoorUtility = new GarageDoorOpenerUtility(server, log, hap, queue);
        const switchUtility = new SwitchUtility(server, log, hap, queue);

        this.utilityByTag.set(garageDoorUtility.getServiceTag(), garageDoorUtility);
        this.utilityByTag.set(switchUtility.getServiceTag(), switchUtility);
    }

    getServiceUtility(accessory: PlatformAccessory<EweLinkContext>): AbstractServiceUtility {
        return this.utilityByTag.get(accessory.context.deviceServiceKey)!;
    }

    calculateServiceTag(name: string): AbstractServiceUtility {
        let serviceType = this.defaultUpdater;
        this.utilityByTag.forEach( (value, tag) => {
            this.log("Checking accessory [%s] against service tag [%s]", name, tag);
            if (name.toLowerCase().includes(tag.toLowerCase())) {
                serviceType = value;
                this.log("Accessory matched with service");
            }
        });
        return serviceType;
    }
}