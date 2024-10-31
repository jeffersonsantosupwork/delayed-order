import Queue, { JobOptions } from 'bull'
import { DEFAULTS } from '../helpers/puppeteer-pool';
import logger from '../helpers/winston';
import puppeteerQueueProcess from './puppeteerQueue'

const BUFFER_TIME = 1000 * 60 * 60 * 24 * 7; // 7 days in miliseconds.

const puppeteerQueue = new Queue('puppeteer-queue', {
    limiter: {
        max: DEFAULTS.max,
        duration: 5000
    },
    redis: {
        password: process.env.REDIS_CLIENT_PASS,
        host: process.env.REDIS_CLIENT_HOST,
        port: Number(process.env.REDIS_CLIENT_PORT),
    }
});

puppeteerQueue.process(DEFAULTS.max, puppeteerQueueProcess)

const send = (data: any, options?: JobOptions) => puppeteerQueue.add(data, options)


puppeteerQueue.on('completed', async (job, result) => {

    logger.info({
        job: `JOB Completed #${job.id}`,
    })

    puppeteerQueue.clean(0, 'completed').then(() => {
        logger.info("Cleaned Completed Tasks ")
    })
})

puppeteerQueue.on('error', (err) => {
    logger.info({
        err
    })
})

puppeteerQueue.on('failed', (job, error) => {
    logger.info("Failed", {
        job, error
    })

    //  clean all failed jobs over 7days ago
    puppeteerQueue.clean(BUFFER_TIME, 'failed').then(() => {
        logger.info("Cleaned Failed Tasks")
    })
})

// immediately clean all completed jobs
puppeteerQueue.clean(0, 'completed').then(() => {
    logger.info("Cleaned Completed Tasks")
})

//  clean all failed jobs over 7days ago
puppeteerQueue.clean(BUFFER_TIME, 'failed').then(() => {
    logger.info("Cleaned Failed Tasks")
})

puppeteerQueue.on('cleaned', function (jobs, type) {
    logger.info('Cleaned jobs', JSON.stringify({
        jobs: jobs.length, type
    }));
});


// this is to check all jobs
// puppeteerQueue.getJobs(['completed'
// , 'waiting'
// , 'active'
// , 'delayed'
// , 'failed'
// , 'paused']).then((jobs) => {
//     console.log("Jobs", jobs)
// })


export {
    send
}