import * as winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch'
import crypto from 'crypto'

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp() , winston.format.json())
});


const myFormat = winston.format.printf(({ level, message, label, timestamp } : winston.LogEntry) => {
    return `${timestamp}  ${level}: ${JSON.stringify(message)}`;
});

if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === '' ) {
    logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }))
    logger.add(new winston.transports.File({ filename: 'logs/main.log' }))
    logger.add(new winston.transports.Console({
        format: myFormat,
    }));
}

if (["live" , "production" , "staging"].includes(process.env.NODE_ENV || "")) {
    const cloudwatchConfig = {
        logGroupName: process.env.CLOUDWATCH_GROUP_NAME,
        logStreamName: `${crypto.randomBytes(16).toString("hex")}`,
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretKey: process.env.AWS_ACCESS_KEY_SECRET,
        awsRegion: process.env.AWS_REGION,
    }
        logger.add(new WinstonCloudWatch(cloudwatchConfig))
}
console.log(process.env.NODE_ENV)

export default logger