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

/**
 * This function schedules a status update and overrides any previously scheduled updates. Ewelink devices sometimes
 * send keep alive events that show the switch status as on then immediately off which causes spam events to homebridge
 * by waiting for a configurable tolerance window we can avoid this spam by overriding the previous update.
 * @param toleranceWindow the length of time to wait for new updates before executing the current one
 * @param deviceId the device being updated
 * @param callback the update callback
 */
function scheduleUpdate(toleranceWindow: number, deviceId: string, callback:  () => void) {
    let timeout = deviceUpdates.get(deviceId);
    if (timeout) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(callback, toleranceWindow);
    deviceUpdates.set(deviceId, timeout);
}