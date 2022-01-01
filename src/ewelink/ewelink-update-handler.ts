import {Logging} from "homebridge";
import Timeout = NodeJS.Timeout;

const deviceUpdates = new Map<string, Timeout>()

export function handleWebSocketMessage(log: Logging, toleranceWindow: number, data, onChange: (deviceId: string, state: string) => void) {
    if (data.action === "update") {
        log.info("Web socket update received: %s", JSON.stringify(data, null, 4))
        scheduleUpdate(toleranceWindow, data.deviceid, () => onChange(data.deviceid, data.params.switch));
    } else if (data.error > 0) {
        log.error("Error code in websocket: %s", data.error)
    }
}

function scheduleUpdate(toleranceWindow: number, deviceId: string, callback:  () => void) {
    let timeout = deviceUpdates.get(deviceId);
    if (timeout) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(callback, toleranceWindow);
    deviceUpdates.set(deviceId, timeout);
}