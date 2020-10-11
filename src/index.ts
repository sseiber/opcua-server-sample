import { IotcOpcuaTestServer } from './services/iotcOpcuaTestServer';
import { IotcOpcuaTestClient } from './services/iotcOpcuaTestClient';
import { forget } from './utils';
import * as fse from 'fs-extra';
import { resolve as pathResolve } from 'path';

export interface IAppConfig {
    serverConfig: any;
    server: IotcOpcuaTestServer;
    client: IotcOpcuaTestClient;
    log: (tags: any, message: any) => void;
}

const app: IAppConfig = {
    serverConfig: {},
    server: null,
    client: null,
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
        app.serverConfig = fse.readJSONSync(systemConfigPath);

        app.server = new IotcOpcuaTestServer(app);

        app.log(['startup', 'info'], `Starting server`);
        await app.server.start();

        app.log(['startup', 'info'], `Server started ( press CTRL+C to stop)`);

        app.log(['startup', 'info'], `Server endpoint: ${app.server.getEndpoint()}`);

        app.client = new IotcOpcuaTestClient(app);

        await app.client.connect();
        await app.client.startTests();
    }
    catch (ex) {
        // tslint:disable-next-line:no-console
        console.log(`['startup', 'error'], 👹 Error starting server: ${ex.message}`);
    }
}

forget(start);
