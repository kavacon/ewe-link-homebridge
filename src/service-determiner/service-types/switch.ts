import {AbstractServiceType, CharacteristicConfig} from "./service-type";
import {CharacteristicValue, Service, WithUUID} from "hap-nodejs";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {EweLinkContext} from "../../context";
import {EwelinkConnection} from "../../ewelink-connection";
import {Logging} from "homebridge/lib/logger";
import {HAP} from "homebridge";

export default class Switch extends AbstractServiceType {
    protected readonly charConfig: CharacteristicConfig[];
    protected readonly service: WithUUID<typeof Service>;
    protected readonly serviceName = "Switch";

    constructor(server: EwelinkConnection, log: Logging, hap: HAP) {
        super(server, log, hap);
        this.service = hap.Service.Switch;
        this.charConfig = [{item: hap.Characteristic.On}];
    }
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
            accessory.getService(this.service)?.setCharacteristic(this.hap.Characteristic.On, targetState);
        }).catch((error) => {
            this.log.error("Error experienced when attempting to toggle accessory [%s] state", accessory.displayName);
            throw error;
        })
    }
}