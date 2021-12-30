import {Categories, Characteristic, CharacteristicValue, Service, WithUUID} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";
import {AbstractServiceUtility} from "./service-utility";

export default class SwitchUtility extends AbstractServiceUtility {

    getServiceTag(): string {
        return "switch";
    }

    getServiceCategory(): Categories {
        return Categories.SWITCH;
    }

    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>): Service {
        this.log.info("Configuring [%s] as a Switch", accessory.displayName);
        return accessory.addService(this.hap.Service.Switch, accessory.displayName);
    }

    translateHomebridgeState(targetState: CharacteristicValue): string {
        return targetState ? "on" : "off";
    }

    translateServerState(deviceState: string, targetCharacteristic): CharacteristicValue {
        return deviceState === "on" ? 1 : 0;
    }

    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
        this.server.attemptToggleDevice(accessory.context.deviceId).then(_ => {
            accessory.getService(this.hap.Service.Switch)?.setCharacteristic(this.hap.Characteristic.On, targetState);
        }).catch((error) => {
            this.log.error("Error experienced when attempting to toggle accessory [%s] state", accessory.displayName);
            throw error;
        })
    }

    configure(accessory: PlatformAccessory<EweLinkContext>) {
        this.configureEditableCharacteristic(accessory, this.hap.Characteristic.On);
    }

    getEditableCharacteristics(): WithUUID<{ new(): Characteristic}>[]{
        return [this.hap.Characteristic.On]
    }

    getCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>): Characteristic {
        return accessory.getService(this.hap.Service.Switch)?.getCharacteristic(char)!;
    }

    setCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>, serverState: string) {
        const homebridgeState = this.translateServerState(serverState, char);
        return accessory.getService(this.hap.Service.Switch)!.setCharacteristic(char, homebridgeState);
    }
}