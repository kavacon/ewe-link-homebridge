import {Logging} from "homebridge";
import Timeout = NodeJS.Timeout;
import {deleteFrom} from "../util";

export class EwelinkUpdateHandler {
    private readonly deviceUpdates = new Map<string, Timeout>();
    private readonly blockedDevices = new Array<string>();
    private readonly log: Logging;

    constructor(log: Logging) {
        this.log = log;
    }

    handleWebSocketMessage(toleranceWindow: number, data, onChange: (deviceId: string, state: string) => void) {
        if (this.blockedDevices.find(d => d === data.deviceid)) {
            this.log.warn("Web socket update received for device %s which has a block in place");
        } else if (data.action === "update") {
            this.log.info("Web socket update received: %s", JSON.stringify(data, null, 4))
            this.scheduleUpdate(toleranceWindow, data.deviceid, () => onChange(data.deviceid, data.params.switch));
        } else if (data.error > 0) {
            this.log.error("Error code in websocket: %s", data.error)
        }
    }

    /**
     * Place 5 second block on updates for specific devices, this may be to prevent duplicate updates following
     * a manual toggle or to respond to some other kind of change
     * @param deviceId device to block updates for
     */
    blockUpdates(deviceId: string) {
        this.blockedDevices.push(deviceId);
        setTimeout(() => deleteFrom(deviceId, this.blockedDevices), 5000)
    }

    /**
     * This function schedules a status update and overrides any previously scheduled updates. Ewelink devices sometimes
     * send keep alive events that show the switch status as on then immediately off which causes spam events to homebridge
     * by waiting for a configurable tolerance window we can avoid this spam by overriding the previous update.
     * @param toleranceWindow the length of time to wait for new updates before executing the current one
     * @param deviceId the device being updated
     * @param callback the update callback
     */
    private scheduleUpdate(toleranceWindow: number, deviceId: string, callback: () => void) {
        let timeout = this.deviceUpdates.get(deviceId);
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(callback, toleranceWindow * 1000);
        this.deviceUpdates.set(deviceId, timeout);
    }
}