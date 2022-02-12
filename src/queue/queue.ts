export interface QueueMessage<T> {
    message: T;
}

export class EmptyQueueError extends Error {
}

export class UndefinedQueueTopicError extends Error {
}

export class Queue {
    private readonly messages = {}

    registerTopic<V>(topic: string) {
        this.messages[topic] = [];
    }

    push<V>(topic: string, message: QueueMessage<V>) {
        this.checkTopicExists(topic);
        this.messages[topic].push(message)
    }

    pop<V>(topic: string): QueueMessage<V> {
        this.checkTopicExists(topic)
        const message = this.messages[topic].pop();
        if (message) {
            return message
        }
        throw new EmptyQueueError();
    }

    private checkTopicExists(topic: string) {
        if (this.messages[topic] === undefined) {
            throw new UndefinedQueueTopicError();
        }
    }

}