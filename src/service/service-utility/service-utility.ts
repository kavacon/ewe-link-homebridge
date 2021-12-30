import {
    Categories,
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

interface ServiceUtility {

    /**
     * @return a string tag used to filter accessories into service
     */
    getServiceTag(): string

    getServiceCategory(): Categories

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
     * @param char the characteristic to check for
     * @param accessory the homebridge accessory
     */
    getServerState(callback: CharacteristicGetCallback, char: WithUUID<{ new(): Characteristic }>, accessory: PlatformAccessory<EweLinkContext>)

    /**
     * Translate the state of a device on the server into a homebridge characteristic state
     * @param deviceState the server device state
     * @param targetCharacteristic the charactertistic to translate for
     */
    translateServerState(deviceState: string, targetCharacteristic: WithUUID<{ new(): Characteristic }>): CharacteristicValue

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
     * Configure the update settings of an accessory's characteristics
     * @param accessory
     */
    configure(accessory: PlatformAccessory<EweLinkContext>)

    getEditableCharacteristics(): WithUUID<{ new(): Characteristic }>[]

    getCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>): Characteristic;

    setCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>, value: string)

}

export abstract class AbstractServiceUtility implements ServiceUtility {
    protected readonly log: Logging;
    protected readonly hap: HAP;
    protected readonly abstract service: WithUUID<typeof Service>;
    protected readonly abstract serviceName: string;
    protected readonly server: EwelinkConnection;

    protected constructor(server: EwelinkConnection, log: Logging, hap: HAP) {
        this.log = log;
        this.server = server;
        this.hap = hap;
    }

    abstract getServiceTag(): string;

    abstract getServiceCategory(): Categories

    abstract updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue);

    abstract translateHomebridgeState(targetState: CharacteristicValue): string;

    abstract translateServerState(deviceState: string, targetCharacteristic: WithUUID<{ new(): Characteristic }>): CharacteristicValue;

    abstract configure(accessory: PlatformAccessory<EweLinkContext>);

    abstract getEditableCharacteristics();

    abstract getCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>): Characteristic;

    abstract setCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>, value: string);

    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>): Service {
        this.log.info("Configuring [%s] as a [%s] service", accessory.displayName,
            this.serviceName);
        return accessory.addService(this.service, accessory.displayName);
    }

    getServerState(callback: CharacteristicGetCallback, char: WithUUID<{ new(): Characteristic }>,
                   accessory: PlatformAccessory<EweLinkContext>) {
        this.log.info("Checking server side state for accessory [%s]", accessory.displayName);
        this.server.requestDeviceState(accessory.context.deviceId)
            .then(deviceState => {
                if (!deviceState) {
                    throw Error("no device state found")
                }
                if (!deviceState.error && deviceState.state) {
                    this.log.info("Device state successfuly retrieved");
                    this.log.info("Device [%s] is in state [%s]", accessory.displayName, deviceState.state);
                    callback(HAPStatus.SUCCESS, this.translateServerState(deviceState.state, char));
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

        this.server.requestDeviceState(accessory.context.deviceId)
            .then(deviceState => {
                if (!deviceState) {
                    throw Error("no device state found")
                }
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

    configureReadonlyCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>) {
        this.getCharacteristic(accessory, char)
            .on(CharacteristicEventTypes.GET, (callback) => this.getServerState(callback, char, accessory));
    }

    configureEditableCharacteristic(accessory: PlatformAccessory<EweLinkContext>, char: WithUUID<{ new(): Characteristic }>) {
        this.getCharacteristic(accessory, char)
            .on(CharacteristicEventTypes.GET, (callback) => this.getServerState(callback, char, accessory));
        this.getCharacteristic(accessory, char)
            .on(CharacteristicEventTypes.SET, (targetState, callback) => this.setServerState(callback, accessory, targetState));

    }
}

