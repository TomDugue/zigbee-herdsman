export class QueueJobSupersededError extends Error {
    constructor() {
        super("Queue job superseded");
    }
}

export interface QueueExecuteOptions {
    key?: string | number;
    supersedeKey?: string;
}

type ExecuteKey = string | number | QueueExecuteOptions | undefined;

interface Job {
    key?: string | number;
    supersedeKey?: string;
    running: boolean;
    started: boolean;
    start?: () => void;
    reject?: (error: Error) => void;
}

function normalizeExecuteKey(executeKey: ExecuteKey): {key?: string | number; supersedeKey?: string} {
    if (executeKey === undefined || typeof executeKey === "string" || typeof executeKey === "number") {
        return {key: executeKey};
    }

    return {key: executeKey.key, supersedeKey: executeKey.supersedeKey};
}

export function queueExecuteKey(
    networkAddress: number,
    endpoint: number,
    streamType?: "color" | "brightness",
    idleKey: string | number | null = networkAddress,
): string | number | QueueExecuteOptions | undefined {
    if (streamType) {
        return {key: networkAddress, supersedeKey: `${endpoint}:${streamType}`};
    }

    if (idleKey === null) {
        return undefined;
    }

    return idleKey;
}

export class Queue {
    readonly #concurrent: number;
    readonly #jobs: Job[] = [];
    #running = 0;

    constructor(concurrent = 1) {
        this.#concurrent = concurrent;
    }

    public async execute<T>(func: () => Promise<T>, executeKey?: ExecuteKey): Promise<T> {
        const {key, supersedeKey} = normalizeExecuteKey(executeKey);

        if (supersedeKey !== undefined) {
            this.#supersedePending(key, supersedeKey);
        }

        const job: Job = {key, supersedeKey, running: false, started: false};
        this.#jobs.push(job);

        // Minor optimization/workaround: various tests like the idea that a job that is immediately runnable is run without an event loop spin.
        // This also helps with stack traces in some cases, so avoid an `await` if we can help it.
        try {
            if (this.#getNext() !== job) {
                await new Promise<void>((resolve, reject): void => {
                    job.start = (): void => {
                        job.running = true;
                        job.started = true;
                        this.#running += 1;
                        resolve();
                    };
                    job.reject = reject;

                    this.#executeNext();
                });
            } else {
                job.running = true;
                job.started = true;
                this.#running += 1;
            }

            return await func();
        } finally {
            const index = this.#jobs.indexOf(job);

            if (index >= 0) {
                this.#jobs.splice(index, 1);
            }

            if (job.started) {
                this.#running = Math.max(this.#running - 1, 0);
                this.#executeNext();
            }
        }
    }

    #supersedePending(key: string | number | undefined, supersedeKey: string): void {
        for (let i = this.#jobs.length - 1; i >= 0; i--) {
            const pending = this.#jobs[i];

            if (pending.running || pending.supersedeKey !== supersedeKey || pending.key !== key) {
                continue;
            }

            this.#jobs.splice(i, 1);
            pending.reject?.(new QueueJobSupersededError());
        }
    }

    #executeNext(): void {
        const job = this.#getNext();

        if (job) {
            // biome-ignore lint/style/noNonNullAssertion: if we get here, start is always defined for job
            job.start!();
        }
    }

    #getNext(): Job | undefined {
        if (this.#running > this.#concurrent - 1) {
            return undefined;
        }

        for (let i = 0; i < this.#jobs.length; i++) {
            const job = this.#jobs[i];

            if (!job.running && (!job.key || !this.#jobs.find((j) => j.key === job.key && j.running))) {
                return job;
            }
        }

        return undefined;
    }

    public clear(): void {
        this.#running = 0;
        this.#jobs.length = 0;
    }

    public count(): number {
        return this.#jobs.length;
    }
}
