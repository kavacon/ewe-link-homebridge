import {Device} from "ewelink-api";
import {Logging} from "homebridge";


export interface AccessoryInformation {
    id: string,
    name: string,
    serialNumber: string,
    manufacturer: string,
    model: string,
    firmwareRevision: string,
    apiKey: string,
    state: string,
}

export function mapDevicesToAccessoryInformation(log: Logging, devices: Device[] | null): AccessoryInformation[]{
    if (devices) {
        log.info("Following devices retrieved from eweLink:\n%s", JSON.stringify(devices, null, 4));
        return devices.map(device => {
            return {
                id: device.deviceid,
                name: device.name,
                serialNumber: device.extra.extra.mac,
                manufacturer: device.productModel,
                model: device.extra.extra.model,
                firmwareRevision: device.params.fwVersion,
                apiKey: device.apikey,
                state: device.params.switch
            }
        })
    } else {
        log.warn("No devices retrieved from eweLink check previous logs for any errors");
        return [];
    }
}

export function mapServiceType() {

}