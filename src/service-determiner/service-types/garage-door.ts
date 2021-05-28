import {AbstractServiceType} from "./service-type";
import {Characteristic, CharacteristicValue, Service, WithUUID} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";

export class GarageDoor extends AbstractServiceType {
    protected readonly characteristics: WithUUID<{new(): Characteristic}>[] = [Characteristic.TargetDoorState, Characteristic.CurrentDoorState];
    protected readonly service: WithUUID<typeof Service> = Service.GarageDoorOpener;

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