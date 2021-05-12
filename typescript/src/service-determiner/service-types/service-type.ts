import {
    Characteristic,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAPStatus,
    Service, WithUUID,
} from "hap-nodejs";
import {Logging} from "homebridge/lib/logger";
import {PlatformAccessory, PlatformAccessoryEvent} from "homebridge/lib/platformAccessory";
import {EwelinkConnection} from "../../ewelink-connection";
import {EweLinkContext} from "../../context";

interface ServiceType {
    readonly service: WithUUID<typeof Service>
    readonly log: Logging
    readonly server: EwelinkConnection
    readonly characteristics: WithUUID<{new(): Characteristic}>[]

    getServiceTag(): string

    /**
     * Set the accessory to the target state on the server
     * @param accessory the local homebridge accessory
     * @param targetState the homebridge state requested
     * @param callback the homebridge completion callback
     */
    setServerState(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue, callback: CharacteristicSetCallback): void

    /**
     * Update homebridge characteristics to align with the requested state
     * @param accessory the updated accessory
     * @param targetState the new state
     * @return {Promise<void>}
     */
    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue)

    /**
     * Get the server state of the accessory for homebridge
     * @param accessory the homebridge accessory
     * @param callback the completion callback for homebridge
     */
    getServerState(accessory: PlatformAccessory<EweLinkContext>, callback: CharacteristicGetCallback): void

    /**
     * Translate the state of a device on the server into a homebridge characteristic state
     * @param deviceState the server device state
     */
    translateServerState(deviceState: string): CharacteristicValue

    /**
     * Translate the homebridge state into a server side representation
     * @param targetState
     */
    translateHomebridgeState(targetState: CharacteristicValue): string

    /**
     * Add a new accessory for the service type
     * @param accessory the new accessory
     * @param name the display name of the accessory
     * @return {Service}
     */
    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>, name: string): Service

    /**
     * Refresh an existing accessory for this service type
     * @param accessory the accessory
     * @return {Service}
     */
    refreshServiceAccessory(accessory: PlatformAccessory<EweLinkContext>): Service

    /**
     * Set the identify call for the accessory
     * @param accessory the accessory
     */
    setAccessoryOnIdentify(accessory: PlatformAccessory<EweLinkContext>): void

    /**
     * update the power state of an accessory from a server update
     * @param accessory the accessory
     * @param serverState the server state
     */
    updateCharacteristics(accessory: PlatformAccessory<EweLinkContext>, serverState: string)

}

export abstract class AbstractServiceType implements ServiceType {
    readonly abstract log: Logging;
    readonly abstract service: WithUUID<typeof Service>;
    readonly server: EwelinkConnection;
    readonly characteristics: WithUUID<{new(): Characteristic}>[];


    abstract getServiceTag(): string;
    abstract updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue);
    abstract translateHomebridgeState(targetState: CharacteristicValue): string;
    abstract translateServerState(deviceState: string): CharacteristicValue;

    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>, name: string) {
        this.log.info("Configuring [%s] as a [%s] service", name, this.service.prototype.displayName)
        return accessory.addService(this.service, name)
    }

    getServerState(accessory: PlatformAccessory<EweLinkContext>, callback: CharacteristicGetCallback) {
        this.log.info("Checking server side state for accessory [%s]", accessory.displayName)
        this.server.requestDeviceState(accessory.context.deviceId, deviceState => {
            if (deviceState.error == undefined && deviceState.status != undefined){
                this.log.info("Device state successfuly retrieved");
                this.log.info("Device [%s] is in state [%s]", accessory.displayName, deviceState.state)
                callback(null, this.translateServerState(deviceState.state))
            } else {
                this.log.error("Unable to retrieve state for device [%s]", accessory.displayName)
                this.log.error("DeviceState error: [%d] [%s]", deviceState.error, deviceState.msg)
                callback(HAPStatus.SERVICE_COMMUNICATION_FAILURE)
            }
        }).catch(() => {
                callback(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
            }
        )
    }

    refreshServiceAccessory(accessory: PlatformAccessory<EweLinkContext>) {
        this.log.info("Refreshing existing accessory [%s]", accessory.displayName);
        return accessory.getService(this.service)
    }

    setAccessoryOnIdentify(accessory: PlatformAccessory<EweLinkContext>) {
        accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
            this.log.warn("Identify not supported for [%s]", accessory.displayName)
        })
    }

    setServerState(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue, callback: CharacteristicSetCallback) {
        const targetServerState = this.translateHomebridgeState(targetState);
        this.log.info("Setting powerstate for accessory [%s]", accessory.displayName);
        this.log.info("Request device server state is [%s]", targetServerState);

        this.server.requestDeviceState(accessory.context.deviceId, deviceState => {
            if (deviceState.error == undefined && deviceState.state != undefined) {
                if (deviceState.state != targetServerState) {
                    this.log.info("Device not in requested state, updating");
                    this.updateAccessoryStates(accessory, targetState)
                } else {
                    this.log.warn("Device [%s] already in requested state", accessory.displayName)
                }
            } else {
                this.log.error("Could not retrieve current power state, device [%s] cannot be set", accessory.displayName);
                callback(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
            }
        }).catch(() => {
                callback(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
            }
        )
    }

    updateCharacteristics(accessory: PlatformAccessory<EweLinkContext>, serverState: string) {
        const homebridgeState = this.translateServerState(serverState);

        this.characteristics.forEach(characteristic => {
            this.log.info("Updating [%s] for accessory [%s] to [%s]", characteristic.toString(),
                accessory.displayName, homebridgeState);
            accessory.getService(this.service).setCharacteristic(characteristic, homebridgeState);
        })

    }
}

