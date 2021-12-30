import {UnknownContext} from "homebridge/lib/platformAccessory";

export interface  EweLinkContext extends UnknownContext{
    deviceId: string
    apikey: string
    deviceServiceKey: string
}