import {Categories, Characteristic, CharacteristicValue, Service, WithUUID} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";
import {AbstractServiceUtility} from "./service-utility";
import {checkNotNull} from "../../util";

export default class GarageDoorOpenerUtility extends AbstractServiceUtility {

    getServiceTag(): string {
        return "garage";
    }

    getServiceCategory(): Categories {
        return Categories.GARAGE_DOOR_OPENER;
    }

    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>): Service {
        this.log.info("Configuring [%s] as a Garage Door Opener", accessory.displayName);
        return accessory.addService(this.hap.Service.GarageDoorOpener, accessory.displayName);
    }

    translateHomebridgeState(targetState: CharacteristicValue): string {
        return targetState === this.hap.Characteristic.TargetDoorState.OPEN ? "on" : "off";
    }

    translateServerState(deviceState: string, targetCharacteristic): CharacteristicValue {
        if (targetCharacteristic == this.hap.Characteristic.TargetDoorState) {
            return deviceState === "on" ? this.hap.Characteristic.TargetDoorState.OPEN
                : this.hap.Characteristic.TargetDoorState.CLOSED;
        }
        if (targetCharacteristic == this.hap.Characteristic.CurrentDoorState) {
            return deviceState === "on" ? this.hap.Characteristic.CurrentDoorState.OPEN
                : this.hap.Characteristic.TargetDoorState.CLOSED;
        }
        throw new Error("unknown translation for garage characteristic");
    }

    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
        const currentDoorState = this.calculateCurrentState(targetState);
        accessory.getService(this.hap.Service.GarageDoorOpener)?.setCharacteristic(this.hap.Characteristic.CurrentDoorState, currentDoorState);
        this.server.attemptToggleDevice(accessory.context.deviceId).then(deviceState => {
            checkNotNull(deviceState)
            // build in delay to account for speed of door
            setTimeout(() => accessory.getService(this.hap.Service.GarageDoorOpener)
                ?.setCharacteristic(this.hap.Characteristic.CurrentDoorState, targetState), 20000);
        }).catch((error) => {
            this.log.error("Error experienced when attempting to toggle accessory [%s] state", accessory.displayName);
            accessory.getService(this.hap.Service.GarageDoorOpener)
                ?.setCharacteristic(this.hap.Characteristic.CurrentDoorState, this.hap.Characteristic.CurrentDoorState.STOPPED);
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

    setCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>, serverState: string): Service {
        const homebridgeState = this.translateServerState(serverState, char);
        const currentDoorState = this.calculateCurrentState(homebridgeState);
        if (char != this.hap.Characteristic.TargetDoorState) {
            throw new Error("set action requested on readonly characteristic, can only explicitly set TargetDoorState");
        }
        const service = accessory.getService(this.hap.Service.GarageDoorOpener)!.setCharacteristic(char, homebridgeState)
            .setCharacteristic(this.hap.Characteristic.CurrentDoorState, currentDoorState);
        setTimeout(() => service.setCharacteristic(this.hap.Characteristic.CurrentDoorState, homebridgeState), 20000);
        return service;
    }

    private calculateCurrentState(targetState: CharacteristicValue): number {
        return targetState === this.hap.Characteristic.CurrentDoorState.OPEN
            ? this.hap.Characteristic.CurrentDoorState.OPENING
            : this.hap.Characteristic.CurrentDoorState.CLOSING;
    }
}