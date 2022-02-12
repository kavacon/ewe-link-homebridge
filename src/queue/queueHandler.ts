import {EmptyQueueError, Queue} from "./queue";
import {Logging} from "homebridge/lib/logger";

export interface TopicHandler<T> {
    handleMessage(message: T);
}

export class QueueHandler {
    private readonly log: Logging
    private readonly queue: Queue;
    private readonly topicHandlers: Map<string, TopicHandler<any>> = new Map<string, TopicHandler<any>>();

    constructor(log:Logging, queue: Queue) {
        this.log = log;
        this.queue = queue;
    }

    registerTopic<T>(topic: string, handler: TopicHandler<T>) {
        this.log.info("Registered topic: [%s]", topic);
        this.topicHandlers.set(topic, handler);
        this.queue.registerTopic(topic);
    }

    processQueue() {
        this.topicHandlers.forEach((handler, topic) => {
            try {
                const message = this.queue.pop(topic);
                handler.handleMessage(message.message);
                this.log.info("Processed topic: [%s], message: ", topic, JSON.stringify(message.message));
            } catch (e) {
                if (!(e instanceof EmptyQueueError)) {
                    throw e;
                }
            }
        });
    }
}