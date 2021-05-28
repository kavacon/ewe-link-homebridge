import eWelink, {Device, DeviceState, LoginInfo} from "ewelink-api"
import {Logging} from "homebridge/lib/logger";


interface ConnectionParams {
    readonly email: string;
    readonly password: string;
}

interface Connection {
    readonly _connection: any;
    readonly params: ConnectionParams

    activateConnection<T>(onSuccess: (auth: LoginInfo) => T): Promise<T | null>

    requestDevice<T>(deviceId: string, onSuccess: (device: Device) => T): Promise<T | null>

    requestDeviceState<T>(deviceId: string, onSuccess: (state: DeviceState) => T): Promise<T | null>

    requestDevices<T>(onSuccess: (devices: Device[]) => T): Promise<T | null>

    openMonitoringSocket(onChange: (deviceId: string, state: string) => void)

    attemptToggleDevice<T>(deviceId: string, onSuccess: (DeviceState) => T): Promise<T | null>
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
    private authenticated: boolean = false;

    constructor(props: ConnectionParams, logger: Logging) {
        this.params = props;
        this._connection = new eWelink(this.params);
        this.logger = logger
    }

    activateConnection<T>(onSuccess: (auth: LoginInfo) => void): Promise<any> {
        return this._connection.login()
            .then(auth => {this.authenticated = (auth != undefined);return auth})
            .then(onSuccess, this.onFailure("activateConnection"));
    }

    requestDevice<T>(deviceId: string, onSuccess: (device: Device) => T): Promise<T | null> {
       return this.connection()
           .then( c => c.getDevice(deviceId).then(onSuccess))
           .catch(this.onFailure("requestDevice"));
    }

    requestDeviceState<T>(deviceId: string, onSuccess: (state: DeviceState) => T): Promise<T | null> {
        return this.connection()
            .then( c => c.getDevicePowerState(deviceId).then(onSuccess))
            .catch(this.onFailure("requestDeviceState"));
    }

    requestDevices<T>(onSuccess: (devices: Device[]) => T): Promise<T | null> {
        return this.connection()
            .then( c => c.getDevices().then(onSuccess))
            .catch(this.onFailure("requestDevices"));
    }


    attemptToggleDevice<T>(deviceId: string, onSuccess: (DeviceState) => T): Promise<T | null> {
        return this.connection()
            .then( c => c.toggleDevice(deviceId).then(onSuccess))
            .catch(this.onFailure("attemptToggleDevice"));
    }

    openMonitoringSocket(onChange: (deviceId: string, state: string) => void) {
        return this.connection()
            .then(c =>
                c.openWebSocket(data => {onChange(data["deviceid"], data["params"].switch)})
                    .then(socket => {
                        this.logger.info("Web socket for state monitoring successfully opened");
                        this.socket = socket;
                    }))
            .catch(this.onFailure("openMonitoringSocket"));
    }

    closeMonitoringSocket(){
        this.socket.close();
    }

    private onFailure(method: string){
        return (reason: any) => {
            this.logger.error("The following error was encountered by the eweLink connection " +
                "while attempting to execute function [%s] %s", method, reason);
            return null;
        }
    }

    private connection(attempt: number = 0) : Promise<eWelink> {
        if (this.authenticated) {
            return Promise.resolve(this._connection);
        } else {
            return new Promise<eWelink>((resolve, reject) => {
                if (attempt >= 3) {
                    reject("Connection authentication has not occurred in the last 30 seconds, no more attempts")
                }
                setTimeout(() => {
                    resolve(this.connection(attempt + 1))
                }, 10000)
            })
        }
    }
}