import {
    Characteristic,
    CharacteristicValue,
    Service,
    WithUUID,
} from "hap-nodejs";
import {Logging} from "homebridge/lib/logger";
import {PlatformAccessory, PlatformAccessoryEvent} from "homebridge/lib/platformAccessory";
import {EwelinkConnection} from "../../ewelink-connection";
import {EweLinkContext} from "../../context";

interface ServiceType {

    /**
     * @return a string tag used to filter accessories into service
     */
    getServiceTag(): string

    /**
     * Set the accessory to the target state on the server
     * @param accessory the local homebridge accessory
     * @param targetState the homebridge state requested
     */
    setServerState(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue): void

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
    getServerState(accessory: PlatformAccessory<EweLinkContext>): Promise<CharacteristicValue | null>

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

export abstract class AbstractServiceType implements ServiceType {
    protected readonly log: Logging;
    protected readonly abstract service: WithUUID<typeof Service>;
    protected readonly server: EwelinkConnection;
    protected readonly abstract characteristics: WithUUID<{new(): Characteristic}>[];

    constructor(server: EwelinkConnection, log: Logging) {
        this.log = log;
        this.server = server;
    }

    abstract getServiceTag(): string;
    abstract updateAccessoryStates(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue);
    abstract translateHomebridgeState(targetState: CharacteristicValue): string;
    abstract translateServerState(deviceState: string): CharacteristicValue;

    addAccessoryToService(accessory: PlatformAccessory<EweLinkContext>): Service {
        this.log.info("Configuring [%s] as a [%s] service", accessory.displayName,
            this.service.prototype.displayName);
        return accessory.addService(this.service, accessory.displayName);
    }

    getServerState(accessory: PlatformAccessory<EweLinkContext>): Promise<CharacteristicValue | null> {
        this.log.info("Checking server side state for accessory [%s]", accessory.displayName);
        return this.server.requestDeviceState(accessory.context.deviceId, deviceState => {
            if (!deviceState.error && deviceState.state){
                this.log.info("Device state successfuly retrieved");
                this.log.info("Device [%s] is in state [%s]", accessory.displayName, deviceState.state);
                return this.translateServerState(deviceState.state)
            } else {
                this.log.error("Unable to retrieve state for device [%s]", accessory.displayName);
                this.log.error("DeviceState error: [%d] [%s]", deviceState.error, deviceState.msg);
                return null;
            }
        }).catch((error) => {
            this.log.error("Error %s", error);
            return null;
            }
        )
    }

    setAccessoryOnIdentify(accessory: PlatformAccessory<EweLinkContext>) {
        accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
            this.log.warn("Identify not supported for [%s]", accessory.displayName)
        })
    }

    setServerState(accessory: PlatformAccessory<EweLinkContext>, targetState: CharacteristicValue) {
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
            } else {
                this.log.error("Could not retrieve current power state, device [%s] cannot be set", accessory.displayName);
                this.log.error("DeviceState error: [%d] [%s]", deviceState.error, deviceState.msg)
            }
        }).catch((error) => {
            this.log.error("Error %s", error)
            }
        )
    }

    updateCharacteristics(accessory: PlatformAccessory<EweLinkContext>, serverState: string) {
        const homebridgeState = this.translateServerState(serverState);

        this.characteristics.forEach(characteristic => {
            this.log.info("Updating [%s] for accessory [%s] to [%s]", characteristic.toString(),
                accessory.displayName, homebridgeState);
            accessory.getService(this.service)?.setCharacteristic(characteristic, homebridgeState);
        })

    }

    configureAccessoryCharacteristics(accessory: PlatformAccessory<EweLinkContext>) {
        this.characteristics.forEach(characteristic => {
            accessory.getService(this.service)?.getCharacteristic(characteristic)
                .onGet(() => this.getServerState(accessory))
                .onSet((targetState) => this.setServerState(accessory, targetState))
        })
    }
}

