import EventEmitter from 'node:events';

export type JobEventMap = {
  success: any[];
  error: [Error];
};

class Job<TResult> extends EventEmitter<JobEventMap> {
  readonly id: number;
  readonly queue: Queue;
  private runner: (job: Job<TResult>) => Promise<TResult>;
  readonly result: Promise<TResult>;

  constructor(
    queue: Queue,
    id: number,
    runner: (job: Job<TResult>) => Promise<TResult>,
  ) {
    super();
    this.id = id;
    this.queue = queue;
    this.runner = runner;
    this.result = new Promise((resolve, reject) => {
      this.once('success', resolve);
      this.once('error', reject);
    });
  }

  async run() {
    try {
      const result = await this.runner(this);
      this.emit('success', result);
    } catch (error) {
      if (error instanceof Error) {
        this.emit('error', error);
      } else {
        this.emit('error', new Error('Unknown error'));
      }
    }
  }
}

class Queue<TResult = any> {
  private jobs: Job<TResult>[] = [];
  private prevId = 0;

  constructor() {}

  private getNextId() {
    return ++this.prevId;
  }

  run() {
    this.process();
  }

  add(runner: (job: Job<TResult>) => Promise<TResult>) {
    const id = this.getNextId();
    const job = new Job(this, id, runner);
    this.jobs.push(job);
    this.run();
    return job;
  }

  async process() {
    while (this.jobs.length) {
      const job = this.jobs.shift()!;
      await job.run();
    }
  }
}

export default new Queue();
