import {Categories, Characteristic, CharacteristicValue, Service, WithUUID} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";
import {EwelinkConnection} from "../../ewelink-connection";
import {Logging} from "homebridge/lib/logger";
import {HAP} from "homebridge";
import {AbstractServiceUtility} from "./service-utility";

export default class SwitchImpl extends AbstractServiceUtility {
    protected readonly service: WithUUID<typeof Service>;
    protected readonly serviceName = "Switch";

    constructor(server: EwelinkConnection, log: Logging, hap: HAP) {
        super(server, log, hap);
        this.service = hap.Service.Switch;
    }
    getServiceTag(): string {
        return "switch";
    }

    getServiceCategory(): Categories {
        return Categories.SWITCH;
    }

    translateHomebridgeState(targetState: CharacteristicValue): string {
        return targetState ? "on" : "off";
    }

    translateServerState(deviceState: string, targetCharacteristic): CharacteristicValue {
        return deviceState === "on" ? 1 : 0;
    }

    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
        this.server.attemptToggleDevice(accessory.context.deviceId, DeviceState => {
            accessory.getService(this.service)?.setCharacteristic(this.hap.Characteristic.On, targetState);
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