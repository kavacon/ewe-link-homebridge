import {AbstractServiceType} from "./service-type";
import {Characteristic, CharacteristicValue, Service} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";

export class Switch extends AbstractServiceType {
    readonly characteristics = [Characteristic.On];
    readonly service = Service.Switch;

    getServiceTag(): string {
        return "switch";
    }

    translateHomebridgeState(targetState: CharacteristicValue): string {
        return targetState ? "on" : "off";
    }

    translateServerState(deviceState: string): CharacteristicValue {
        return deviceState === "on" ? 1 : 0;
    }

    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
        this.server.attemptToggleDevice(accessory.context.deviceId, DeviceState => {
            accessory.getService(this.service).setCharacteristic(Characteristic.On, targetState);
        }).catch((error) => {
            this.log.error("Error experienced when attempting to toggle accessory [%s] state", accessory.displayName);
            throw error;
        })
    }
}