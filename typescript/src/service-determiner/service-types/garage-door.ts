import {AbstractServiceType} from "./service-type";
import {Characteristic, CharacteristicValue, Service} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";

export class GarageDoor extends AbstractServiceType {
    readonly characteristics = [Characteristic.TargetDoorState, Characteristic.CurrentDoorState];
    readonly service = Service.GarageDoorOpener;

    getServiceTag(): string {
        return "garage";
    }

    translateHomebridgeState(targetState: CharacteristicValue): string {
        return targetState === Characteristic.TargetDoorState.OPEN ? "on" : "off";
    }

    translateServerState(deviceState: string): CharacteristicValue {
        return deviceState === "on" ? Characteristic.TargetDoorState.OPEN : Characteristic.TargetDoorState.CLOSED;
    }

    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
        const currentDoorState = targetState === Characteristic.CurrentDoorState.OPEN
            ? Characteristic.CurrentDoorState.OPENING
            : Characteristic.CurrentDoorState.CLOSING;
        accessory.getService(this.service).setCharacteristic(Characteristic.CurrentDoorState, currentDoorState);
        this.server.attemptToggleDevice(accessory.context.deviceId, DeviceState => {
            accessory.getService(this.service).setCharacteristic(Characteristic.CurrentDoorState, targetState);
        }).catch((error) => {
            this.log.error("Error experienced when attempting to toggle accessory [%s] state", accessory.displayName);
            accessory.getService(this.service).setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.STOPPED);
            throw error;
        })
    }
}