import {Queue, QueueMessage} from "./queue";

export interface TopicHandler<T> {
    handleMessage(message: T);
}

export class QueueHandler {
    private readonly queue: Queue;
    private readonly topicHandlers: Map<string, TopicHandler<any>> = new Map<string, TopicHandler<any>>();

    constructor(queue: Queue) {
        this.queue = queue;
    }

    registerTopic<T>(topic: string, handler: TopicHandler<T>) {
        this.topicHandlers.set(topic, handler);
        this.queue.registerTopic(topic);
    }

    processQueue() {
        this.topicHandlers.forEach((handler, topic) => {
            const message = this.queue.pop(topic);
            handler.handleMessage(message.message);
        });
    }
}