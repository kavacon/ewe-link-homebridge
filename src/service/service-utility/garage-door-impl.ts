import {Categories, Characteristic, CharacteristicValue, Service, WithUUID} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";
import {EwelinkConnection} from "../../ewelink-connection";
import {Logging} from "homebridge/lib/logger";
import {HAP} from "homebridge";
import {AbstractServiceUtility} from "./service-utility";

export default class GarageDoorImpl extends AbstractServiceUtility {
    protected readonly service: WithUUID<typeof Service>;
    protected readonly serviceName = "GarageDoorOpener";

    constructor(server: EwelinkConnection, log: Logging, hap: HAP) {
        super(server, log, hap);
        this.service = hap.Service.GarageDoorOpener;
    }

    getServiceTag(): string {
        return "garage";
    }

    getServiceCategory(): Categories {
        return Categories.GARAGE_DOOR_OPENER;
    }

    translateHomebridgeState(targetState: CharacteristicValue): string {
        this.log.info("translate state")
        return targetState === this.hap.Characteristic.TargetDoorState.OPEN ? "on" : "off";
    }

    translateServerState(deviceState: string, targetCharacteristic): CharacteristicValue {
        this.log.info("translate server state")
        if (targetCharacteristic == this.hap.Characteristic.TargetDoorState) {
            return deviceState === "on" ? this.hap.Characteristic.TargetDoorState.OPEN
                : this.hap.Characteristic.TargetDoorState.CLOSED;
        }
        throw new Error("unknown translation for garage characteristic");
    }

    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
        this.log.info("update accessory states")
        const currentDoorState = targetState === this.hap.Characteristic.CurrentDoorState.OPEN
            ? this.hap.Characteristic.CurrentDoorState.OPENING
            : this.hap.Characteristic.CurrentDoorState.CLOSING;
        accessory.getService(this.service)?.setCharacteristic(this.hap.Characteristic.CurrentDoorState, currentDoorState);
        this.server.attemptToggleDevice(accessory.context.deviceId, DeviceState => {
            accessory.getService(this.service)?.setCharacteristic(this.hap.Characteristic.CurrentDoorState, targetState);
        }).catch((error) => {
            this.log.error("Error experienced when attempting to toggle accessory [%s] state", accessory.displayName);
            accessory.getService(this.service)?.setCharacteristic(this.hap.Characteristic.CurrentDoorState, this.hap.Characteristic.CurrentDoorState.STOPPED);
            throw error;
        })
    }

    configure(accessory: PlatformAccessory<EweLinkContext>) {
        this.configureEditableCharacteristic(accessory, this.hap.Characteristic.TargetDoorState);
        this.configureReadonlyCharacteristic(accessory, this.hap.Characteristic.CurrentDoorState);
    }

    getEditableCharacteristics(): WithUUID<{ new(): Characteristic}>[] {
        return [this.hap.Characteristic.TargetDoorState];
    }

    getCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>): Characteristic {
        return accessory.getService(this.hap.Service.GarageDoorOpener)?.getCharacteristic(char)!;
    }

    setCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>, serverState: string) {
        const homebridgeState = this.translateServerState(serverState, char);
        return accessory.getService(this.hap.Service.GarageDoorOpener)!.setCharacteristic(char, homebridgeState);
    }
}