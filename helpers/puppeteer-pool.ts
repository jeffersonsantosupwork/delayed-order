import genericPool from 'generic-pool'
import puppeteer , { Browser } from 'puppeteer';
import { getRandomPortsList } from '.';
import logger from './winston';

let ports = getRandomPortsList({})
let proxyPorts = getRandomPortsList({initial : 9000 , end : 9009 , interval : 1})


let activePorts: (string | undefined)[] = []
let activeProxyPorts: (string| undefined)[] = []

class BrowserHandler {
    launch_browser: any
    browser : boolean | Browser = false
    port : string | undefined
    proxyPort: string | undefined
  
    
    constructor(puppeteerLaunchArgs: any) {
        logger.info({puppeteerLaunchArgs})
        this.launch_browser = async () => {

            if(!this.port){
                this.port = ports.pop()
                logger.info(`DEBUG: port ${this.port}`)
                if(this.port)
                activePorts.push(this.port)
            }

            if(!this.proxyPort){
                this.proxyPort = proxyPorts.pop()
                logger.info(`DEBUG: proxy ${this.port}`)
                if(this.proxyPort)
                activeProxyPorts.push(this.proxyPort)
            }
            logger.info(`DEBUG: Active ports ${activePorts}`)
            logger.info(`DEBUG: Active Proxy ${activeProxyPorts}`)

            this.browser = false;            
            puppeteerLaunchArgs?.[0]?.args.push(`--remote-debugging-port=${this.port}`)
            puppeteerLaunchArgs?.[0]?.args.push(`--proxy-server=rotating.proxyempire.io:${this.proxyPort}`)
            this.browser = await puppeteer.launch(...puppeteerLaunchArgs);
            this.browser.on('disconnected', this.launch_browser);
           
        };

        (async () => {
            await this.launch_browser();
        })();


    }

    async close() {

        if(typeof this.browser !== "boolean"){
            this.browser.off('disconnected', this.launch_browser);
            await this.browser.close();

            logger.info(`DEBUG: Releasing Port ${this.port}`)
            logger.info(`DEBUG: Releasing Proxy ${this.proxyPort}`)

            if(this.port){
                // clear from active port
                activePorts = activePorts.filter(_port => _port !== this.port && this.port)
                if(this.port)
                    ports.push(this.port)
                this.port = undefined
            }

            if(this.proxyPort){
                // clear from active port
                activeProxyPorts = activeProxyPorts.filter(_port => _port !== this.proxyPort && this.proxyPort)
                if(this.proxyPort)
                    proxyPorts.push(this.proxyPort)
                this.proxyPort = undefined
            }

        }

    }
}

export const DEFAULTS = {
    min: 2,
    max: 10,
    testOnBorrow: true,
    puppeteerLaunchArgs: [{ headless: false }],
    validate: () => Promise.resolve(true),
    fifo : true
};


function createFactory({ puppeteerLaunchArgs, validate }: { puppeteerLaunchArgs: any, validate: any }) {
    const factory: genericPool.Factory<unknown> = {
        create: async function createFn() {
            logger.info(`DEBUG: Pool being created`)
            return new BrowserHandler(puppeteerLaunchArgs);
        },
        destroy: async function destroyFn(browserHandlerInstance) {
            logger.info(`DEBUG: Pool being destroyed`)
            //@ts-expect-error
            return browserHandlerInstance.close();
        }
    };

    if (validate && typeof validate === 'function') {
        factory.validate = validate;
    }

    return factory;
}

function createPool(poolConfig: any) {
    const config = Object.assign({}, DEFAULTS, poolConfig);
    const factory = createFactory(Object.assign({}, config));

    delete config.validate;
    delete config.puppeteerLaunchArgs;
    return genericPool.createPool(factory, config);
}

export default createPool