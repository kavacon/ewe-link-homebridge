import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {AccessoryInformation} from "./accessory-mapper";
import {EweLinkContext} from "../context";
import {Characteristic, Service} from "hap-nodejs";
import {API, HAP, Logging} from "homebridge";
import {ServiceMap} from "../service/service-map";
import {EwelinkConnection} from "../ewelink/ewelink-connection";
import {deleteFrom} from "../util";
import {Queue} from "../queue/queue";
import {TopicHandler} from "../queue/queueHandler";

export interface AccessoryChanged {
    id: string;
    serverState: string;
}

export class AccessoryService implements TopicHandler<AccessoryChanged> {
    private readonly accessories: Map<string, PlatformAccessory<EweLinkContext>> = new Map();
    private readonly log: Logging;
    private readonly hap: HAP
    private readonly api: API
    private readonly serviceMap: ServiceMap

    constructor(log: Logging, server: EwelinkConnection, api: API, hap: HAP, queue: Queue) {
        this.log = log;
        this.hap = hap;
        this.api = api;
        this.serviceMap = new ServiceMap(log, server, hap, queue);
    }

    configureIdentify(accessory: PlatformAccessory<EweLinkContext>) {
        const serviceType = this.serviceMap.getServiceType(accessory);
        serviceType.setAccessoryOnIdentify(accessory);
    }

    configureService(accessory: PlatformAccessory<EweLinkContext>) {
        const serviceType = this.serviceMap.getServiceType(accessory);
        serviceType.configure(accessory);
    }

    saveAccessory(accessory: PlatformAccessory<EweLinkContext>) {
        this.accessories.set(accessory.context.deviceId, accessory);
    }

    removeAccessory(id: string): PlatformAccessory<EweLinkContext> {
        const accessory = this.accessories.get(id)!
        this.log.warn("Removing accessory [%s]", accessory.displayName);
        this.accessories.delete(id);
        return accessory;
    }

    createAccessory(information: AccessoryInformation): PlatformAccessory<EweLinkContext> {
        this.log.info("Found Accessory with Name : [%s], Manufacturer : [%s], API Key: [%s] ",
            information.name, information.manufacturer, information.apiKey);
        const service = this.serviceMap.calculateServiceType(information.name);
        const uuid = this.hap.uuid.generate(information.id);
        const accessory = new this.api.platformAccessory<EweLinkContext>(information.name, uuid, service.getServiceCategory());
        accessory.context.deviceId = information.id;
        accessory.context.apiKey = information.apiKey;
        accessory.context.deviceServiceKey = service.getServiceTag();

        service.addAccessoryToService(accessory)
        this.configureIdentify(accessory);
        this.configureService(accessory);
        this.updateAccessoryInformation(information, accessory)
        return accessory;
    }

    updateAccessoryInformation(information: AccessoryInformation, accessory?: PlatformAccessory<EweLinkContext>) {
        this.log("Device [%s] already configured, updating configuration", information.name);
        accessory = accessory ? accessory : this.accessories.get(information.id)!
        accessory.getService(Service.AccessoryInformation)!
            .setCharacteristic(Characteristic.Name, information.name)
            .setCharacteristic(Characteristic.SerialNumber, information.serialNumber)
            .setCharacteristic(Characteristic.Manufacturer, information.manufacturer)
            .setCharacteristic(Characteristic.Model, information.model)
            .setCharacteristic(Characteristic.FirmwareRevision, information.firmwareRevision);
    }

    handleMessage(message: AccessoryChanged) {
        const accessory = this.accessories.get(message.id)!;
        const serviceType = this.serviceMap.getServiceType(accessory);

        serviceType.getEditableCharacteristics().forEach(char => {
            this.log.info("Updating [%s] for accessory [%s] to [%s]", char.UUID,
                accessory.displayName, message.serverState);
            serviceType.setCharacteristic(accessory, char, message.serverState);
        })
    }

    determineExistence(ids: string[]): {notFound: string[], intersection: string[], serviceOnly: string[]} {
        const notFound = new Array<string>();
        const intersection = new Array<string>();
        const noMatch = Array.from(this.accessories.keys());

        ids.forEach(id => {
            if (this.accessories.has(id)) {
                intersection.push(id);
                deleteFrom(id, noMatch);
            } else {
                notFound.push(id);
            }
        });

        return {
            notFound: notFound,
            intersection: intersection,
            serviceOnly: noMatch
        }
    }
}