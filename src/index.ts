import { IotcOpcuaTestServer } from './services/IotcOpcuaTestServer';
import { forget } from './utils';
import * as fse from 'fs-extra';
import { resolve as pathResolve } from 'path';

export interface IAppConfig {
    serverConfig: any;
    server: IotcOpcuaTestServer;
    log: (tags: any, message: any) => void;
}

const app: IAppConfig = {
    serverConfig: {},
    server: null,
    log: (tags: any, message: any) => {
        const tagsMessage = (tags && Array.isArray(tags)) ? `[${tags.join(', ')}]` : '[]';

        // tslint:disable-next-line:no-console
        console.log(`[${new Date().toTimeString()}] [${tagsMessage}] ${message}`);
    }
};

async function start() {
    try {
        const stopServer = async () => {
            if (app.server) {
                app.log(['shutdown', 'info'], '☮︎ Stopping opcua server');
                await app.server.stop();
            }

            app.log(['shutdown', 'info'], `⏏︎ Server stopped`);
            process.exit(0);
        };

        process.on('SIGINT', stopServer);
        process.on('SIGTERM', stopServer);

        const systemConfigPath = pathResolve(process.env.CONTENT_ROOT, 'systemConfig.json');
        this.systemConfig = fse.readJSONSync(systemConfigPath);

        app.server = new IotcOpcuaTestServer(app);

        app.log(['startup', 'info'], `Starting server`);
        await app.server.start();

        app.log(['startup', 'info'], `Server started ( press CTRL+C to stop)`);

        app.log(['startup', 'info'], `Server endpoint: ${app.server.getEndpoint()}`);

        await testClient.connect('Woodshop', 'opc.tcp://Scotts-MBPro16.local:4334/UA/Factory_001');
        await testClient.startTests(deviceConfig);
    }
    catch (ex) {
        // tslint:disable-next-line:no-console
        console.log(`['startup', 'error'], 👹 Error starting server: ${ex.message}`);
    }
}

forget(start);
