import {AbstractServiceType, CharacteristicConfig} from "./service-type";
import {CharacteristicEventTypes, CharacteristicValue, Service, WithUUID} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";
import {EwelinkConnection} from "../../ewelink-connection";
import {Logging} from "homebridge/lib/logger";
import {HAP} from "homebridge";

export default class GarageDoor extends AbstractServiceType {
    protected readonly charConfig: CharacteristicConfig[];
    protected readonly service: WithUUID<typeof Service>;
    protected readonly serviceName = "GarageDoorOpener";

    constructor(server: EwelinkConnection, log: Logging, hap: HAP) {
        super(server, log, hap);
        this.service = hap.Service.GarageDoorOpener;
        this.charConfig = [
            { item:hap.Characteristic.TargetDoorState } ,
            { item: hap.Characteristic.CurrentDoorState, excluded: [CharacteristicEventTypes.SET]  }
            ];
    }

    getServiceTag(): string {
        return "garage";
    }

    translateHomebridgeState(targetState: CharacteristicValue): string {
        return targetState === this.hap.Characteristic.TargetDoorState.OPEN ? "on" : "off";
    }

    translateServerState(deviceState: string): CharacteristicValue {
        return deviceState === "on" ? this.hap.Characteristic.TargetDoorState.OPEN : this.hap.Characteristic.TargetDoorState.CLOSED;
    }

    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
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
}