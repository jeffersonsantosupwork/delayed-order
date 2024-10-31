import genericPool from 'generic-pool'
class PortHandler {
    ports : string[]  = [
        "9220" , "9221", '9222', '9223'
    ]
    runningPort ?: string
    
    constructor() {
        this.runningPort = this.ports.pop()
    }

    async close() {

        if(this.runningPort)
            this.ports.push(this.runningPort)

    }
}

const DEFAULTS = {
    min: 0,
    max: 1,
    testOnBorrow: true,
    validate: () => Promise.resolve(true),
};


function createFactory({ validate }: { validate: any }) {
    const factory: genericPool.Factory<unknown> = {
        create: async function createFn() {
            return new PortHandler();
        },
        destroy: async function destroyFn(browserHandlerInstance) {
            //@ts-expect-error
            return browserHandlerInstance.close();
        }
    };

    if (validate && typeof validate === 'function') {
        factory.validate = validate;
    }

    return factory;
}

function createPool(poolConfig?: any) {
    const config = Object.assign({}, DEFAULTS, poolConfig);
    const factory = createFactory(Object.assign({}, config));

    delete config.validate;
    return genericPool.createPool(factory, config);
}

export default createPool