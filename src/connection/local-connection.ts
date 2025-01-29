import {Connection} from "./connection";
import {Device, DeviceState} from "ewelink-api";
import fetch from 'node-fetch';
import {checkNotNull, deleteIf} from "../util";
import {Logging} from "homebridge/lib/logger";
import eweLink from 'ewelink-api-next'
import * as crypto from "crypto";
interface LANDevice {
    ip: string;
    port: number;
    deviceId: string;
}

class LANConnection {
    private readonly ewelinkLan
    private devices: LANDevice[] = []
    private readonly log: Logging;
    private readonly apiKey: string
    constructor(log: Logging) {
        this.log = log;
        this.apiKey = crypto.randomBytes(20).toString('hex');
        this.ewelinkLan = new eweLink.Lan({
            selfApikey: this.apiKey,
            logObj: eweLink.createLogger("lan")
        });
    }

    start() {
        this.log.info("starting lan connection")
        this.ewelinkLan.discovery(this.recordDevice.bind(this))
    }

    getDevices(): LANDevice[] {
        return this.devices;
    }

    private recordDevice(service) {
        try {
            this.log.info("local device discovery: %s", service.fqdn)
            const {ip, port} = this.ewelinkLan.getDeviceIp(service)
            const device = {
                ip,
                port,
                deviceId: LANConnection.extractDeviceId(service.fqdn),
            }
            this.devices.push(device)
        } catch (e) {
            this.log.error(JSON.stringify(e));
        }
    }

    // private removeDevice(service: Service) {
    //     try {
    //         this.log.info("local device removed: %s", service.fqdn)
    //         const deviceId = LANConnection.extractDeviceId(service.fqdn)
    //         this.devices = deleteIf(d => d.deviceId === deviceId, this.devices)
    //     } catch (e) {
    //         this.log.error(JSON.stringify(e));
    //     }
    // }

    private static extractDeviceId(fqdn: string): string {
        const regex = 'eWeLink_(.*).local';
        const deviceId = fqdn.match(regex);
        checkNotNull(deviceId);
        return deviceId?.pop() || '';
    }
}

export class LocalConnection implements Connection {
    private readonly lan: LANConnection;
    private readonly deviceAddressMap = new Map<string, string>();
    private readonly log: Logging;

    constructor(log: Logging) {
        this.log = log;
        this.lan = new LANConnection(this.log);
    }

    activateConnection<T>(onSuccess: (auth: any) => void): Promise<any> {
        this.lan.start()
        onSuccess(1);
        return Promise.resolve();
    }

    attemptSetDeviceState<T>(deviceId: string, state: string): Promise<DeviceState | null> {
        const address = this.deviceAddressMap.get(deviceId);
        return fetch(`http://${address}/zeroconf/switch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deviceid: `${deviceId}`,
                data: {
                    switch: state
                }
            })
        }).then(data => {
            return {
                error: data.error,
                state: data.state
            }
        }, this.onFailure("attemptSetDeviceState"));
    }

    openMonitoringSocket(): Promise<any> {
        return Promise.reject("real time monitoring not implemented");
    }

    closeMonitoringSocket(): void {
    }

    requestDevice<T>(deviceId: string, onSuccess: (device: Device) => T): Promise<T | null> {
        return this.getDeviceInformation([deviceId])
            .then(devices => onSuccess(devices[0]))
            .catch(this.onFailure("requestDevice"));
    }

    requestDeviceState<T>(deviceId: string): Promise<DeviceState | null> {
        return this.getDeviceInformation([deviceId])
            .then(devices => {
                return {
                    state: devices ? devices[0].params.switch : undefined,
                    error: devices ? undefined : 1
                }
            })
            .catch(this.onFailure("requestDeviceState"));
    }

    requestDevices<T>(onSuccess: (devices: Device[]) => T): Promise<T | null> {
        return Promise.resolve(this.lan.getDevices())
            .then(devices => this.refreshDeviceMap(devices))
            .then(devices => this.getDeviceInformation(devices))
            .then(devices => onSuccess(devices))
            .catch(this.onFailure("requestDevices"));
    }

    private refreshDeviceMap(devices: LANDevice[]): string[] {
        this.deviceAddressMap.clear();
        devices.forEach(device => {
            this.deviceAddressMap.set(device.deviceId, `${device.ip}:${device.port}`);
        });
        return Array.from(this.deviceAddressMap.keys());
    }

    private getDeviceInformation(devices: string[]): Promise<Device[]> {
        const responses = Promise.all(devices.map(device => {
            const address = this.deviceAddressMap.get(device);
            return fetch(`http://${address}/zeroconf/info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceid: `${device}`,
                    data: {}
                })
            })
        }));
        return responses
            .then(res => res.map(r => r.json().data));
    }

    private onFailure(method: string){
        return (reason: any) => {
            this.log.error("The following error was encountered by the local connection " +
                "while attempting to execute function [%s] %s", method, JSON.stringify(reason));
            return null;
        }
    }

}