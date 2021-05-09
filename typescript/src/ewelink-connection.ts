import eWelink, {Device, DeviceState, LoginInfo} from "ewelink-api"
import {Logging} from "homebridge/lib/logger";


interface ConnectionParams {
    readonly email: string;
    readonly password: string;
}

interface Connection {
    readonly _connection: any;
    readonly params: ConnectionParams

    activateConnection<T>(onSuccess: (auth: LoginInfo) => T): Promise<T | void>

    requestDevice<T>(deviceId: string, onSuccess: (device: Device) => T): Promise<T | void>

    requestDeviceState<T>(deviceId: string, onSuccess: (state: DeviceState) => T): Promise<T | void>

    requestDevices<T>(onSuccess: (devices: Device[]) => T): Promise<T | void>

    openMonitoringSocket(onChange: (deviceId: string, state: string) => void)

    attemptToggleDevice<T>(deviceId: string, onSuccess: (DeviceState) => void): Promise<T | void>
}

/**
 * Wrapper class for the ewelink connection, allows us to abstract establishing the connection and
 * manage promises effectively, previous version made all async calls await causing uncaught errors
 */
export class EwelinkConnection implements Connection {
    readonly _connection: eWelink;
    readonly params: ConnectionParams;
    readonly logger: Logging;
    private socket: any;

    constructor(props: ConnectionParams, logger: Logging) {
        this.params = props;
        this._connection = new eWelink(this.params);
        this.logger = logger
    }

    activateConnection<T>(onSuccess: (auth: LoginInfo) => void): Promise<any> {
        return this._connection.login()
            .then(onSuccess, this.onFailure("activateConnection"));
    }

    requestDevice<T>(deviceId: string, onSuccess: (device: Device) => T): Promise<T | void> {
       return this._connection.getDevice(deviceId)
            .then(onSuccess, this.onFailure("requestDevice"));
    }

    requestDeviceState<T>(deviceId: string, onSuccess: (state: DeviceState) => T): Promise<T | void> {
        return this._connection.getDevicePowerState(deviceId)
            .then(onSuccess, this.onFailure("requestDeviceState"))
    }

    requestDevices<T>(onSuccess: (devices: Device[]) => T): Promise<T | void> {
        return this._connection.getDevices()
            .then(onSuccess, this.onFailure("requestDevices"))
    }


    attemptToggleDevice<T>(deviceId: string, onSuccess: (DeviceState) => T): Promise<T | void> {
        return this._connection.toggleDevice(deviceId)
            .then(onSuccess, this.onFailure("attemptToggleDevice"))
    }

    openMonitoringSocket(onChange: (deviceId: string, state: string) => void) {
        this._connection.openWebSocket(data => {
            onChange(data["deviceid"], data["params"].switch)
        }).then(socket => {
                this.logger.info("Web socket for state monitoring successfully opened");
                this.socket = socket;
            },
            this.onFailure("openMonitoringSocket"));
    }

    closeMonitoringSocket(){
        this.socket.close();
    }

    private onFailure(method: string){
        return (reason: any) => {
            this.logger.error("The following error was encountered by the eweLink connection " +
                "while attempting to execute function [%s] %s", method, reason)
        }
    }
}