import {Device, DeviceState, LoginInfo} from "ewelink-api";

export interface Connection {
    readonly _connection: any;

    activateConnection<T>(onSuccess: (auth: LoginInfo) => T): Promise<T | null>

    requestDevice<T>(deviceId: string, onSuccess: (device: Device) => T): Promise<T | null>

    requestDeviceState<T>(deviceId: string): Promise<DeviceState | null>

    requestDevices<T>(onSuccess: (devices: Device[]) => T): Promise<T | null>

    openMonitoringSocket(): Promise<any>

    closeMonitoringSocket(): void

    attemptSetDeviceState<T>(deviceId: string, state: string): Promise<DeviceState | null>
}