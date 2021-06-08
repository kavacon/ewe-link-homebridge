import {
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAPStatus,
    Service,
    WithUUID,
} from "hap-nodejs";
import {Logging} from "homebridge/lib/logger";
import {PlatformAccessory, PlatformAccessoryEvent} from "homebridge/lib/platformAccessory";
import {EwelinkConnection} from "../../ewelink-connection";
import {EweLinkContext} from "../../context";
import {HAP} from "homebridge";

interface ServiceType {

    /**
     * @return a string tag used to filter accessories into service
     */
    getServiceTag(): string

    /**
     * Set the accessory to the target state on the server
     * @param callback to communicate result
     * @param accessory the local homebridge accessory
     * @param targetState the homebridge state requested
     */
    setServerState(callback: CharacteristicSetCallback, accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue)

    /**
     * Update homebridge characteristics to align with the requested state
     * @param accessory the updated accessory
     * @param targetState the new state
     * @return {Promise<void>}
     */
    updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue)

    /**
     * Get the server state of the accessory for homebridge
     * @param callback to communicate server state back to homebridge
     * @param accessory the homebridge accessory
     */
    getServerState(callback: CharacteristicGetCallback, accessory: PlatformAccessory<EweLinkContext>)

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
     * @return {Service}
     */
    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>): Service

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

    /**
     * Configure the update settings of an accessory's characteristics
     * @param accessory
     */
    configureAccessoryCharacteristics(accessory: PlatformAccessory<EweLinkContext>)

}

export type CharacteristicConfig = {item: WithUUID<{new(): Characteristic}> , excluded?: CharacteristicEventTypes[] }

export abstract class AbstractServiceType implements ServiceType {
    protected readonly log: Logging;
    protected readonly hap: HAP;
    protected readonly abstract service: WithUUID<typeof Service>;
    protected readonly abstract serviceName: string;
    protected readonly server: EwelinkConnection;
    protected readonly abstract charConfig: CharacteristicConfig[];

    protected constructor(server: EwelinkConnection, log: Logging, hap: HAP) {
        this.log = log;
        this.server = server;
        this.hap = hap;
    }

    abstract getServiceTag(): string;
    abstract updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue);
    abstract translateHomebridgeState(targetState: CharacteristicValue): string;
    abstract translateServerState(deviceState: string): CharacteristicValue;

    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>): Service {
        this.log.info("Configuring [%s] as a [%s] service", accessory.displayName,
            this.serviceName);
        return accessory.addService(this.service, accessory.displayName);
    }

    getServerState(callback: CharacteristicGetCallback, accessory: PlatformAccessory<EweLinkContext>) {
        this.log.info("Checking server side state for accessory [%s]", accessory.displayName);
        this.server.requestDeviceState(accessory.context.deviceId, deviceState => {
            if (!deviceState.error && deviceState.state){
                this.log.info("Device state successfuly retrieved");
                this.log.info("Device [%s] is in state [%s]", accessory.displayName, deviceState.state);
                callback(HAPStatus.SUCCESS, this.translateServerState(deviceState.state));
            } else {
                this.log.error("Unable to retrieve state for device [%s]", accessory.displayName);
                this.log.error("DeviceState error: [%d] [%s]", deviceState.error, deviceState.msg);
                callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
            }
        }).catch((error) => {
            this.log.error("Error %s", error);
            callback(HAPStatus.SERVICE_COMMUNICATION_FAILURE)
            }
        )
    }

    setAccessoryOnIdentify(accessory: PlatformAccessory<EweLinkContext>) {
        accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
            this.log.warn("Identify not supported for [%s]", accessory.displayName)
        })
    }

    setServerState(callback: CharacteristicSetCallback, accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
        const targetServerState = this.translateHomebridgeState(targetState);
        this.log.info("Setting powerstate for accessory [%s]", accessory.displayName);
        this.log.info("Request device server state is [%s]", targetServerState);

        this.server.requestDeviceState(accessory.context.deviceId, deviceState => {
            if (!deviceState.error && deviceState.state) {
                if (deviceState.state != targetServerState) {
                    this.log.info("Device not in requested state, updating");
                    this.updateAccessoryStates(accessory, targetState)
                } else {
                    this.log.warn("Device [%s] already in requested state", accessory.displayName)
                }
                callback(HAPStatus.SUCCESS);
            } else {
                this.log.error("Could not retrieve current power state, device [%s] cannot be set", accessory.displayName);
                this.log.error("DeviceState error: [%d] [%s]", deviceState.error, deviceState.msg)
                callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
            }
        }).catch((error) => {
            this.log.error("Error %s", error)
            callback(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
            }
        )
    }

    updateCharacteristics(accessory: PlatformAccessory<EweLinkContext>, serverState: string) {
        const homebridgeState = this.translateServerState(serverState);
        this.charConfig.forEach(config => {
            this.log.info("Updating [%s] for accessory [%s] to [%s]", config.item.UUID,
                accessory.displayName, homebridgeState);
            accessory.getService(this.service)?.setCharacteristic(config.item, homebridgeState);
        })

    }

    configureAccessoryCharacteristics(accessory: PlatformAccessory<EweLinkContext>) {
        this.charConfig.forEach(config => {
            if (!config.excluded?.includes(CharacteristicEventTypes.GET)) {
                accessory.getService(this.service)?.getCharacteristic(config.item)
                    .on(CharacteristicEventTypes.GET, (callback) => this.getServerState(callback, accessory));
            }
            if (!config.excluded?.includes(CharacteristicEventTypes.SET)) {
                accessory.getService(this.service)?.getCharacteristic(config.item)
                    .on(CharacteristicEventTypes.SET, (targetState, callback) => this.setServerState(callback, accessory, targetState));

            }
        })
    }
}

