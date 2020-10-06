import { IotcOpcuaServer } from './services/iotcOpcuaServer';
import { IotcOpcuaTestClient } from './services/iotcOpcuaTestClient';
import { forget } from './utils';

let server: IotcOpcuaServer;
let testClient: IotcOpcuaTestClient;

async function start() {
    try {
        const stopServer = async () => {
            server.log(['shutdown', 'info'], '☮︎ Stopping opcua server');
            // await server.stop({ timeout: 10000 });

            server.log(['shutdown', 'info'], `⏏︎ Server stopped`);
            process.exit(0);
        };

        process.on('SIGINT', stopServer);
        process.on('SIGTERM', stopServer);

        server = new IotcOpcuaServer();
        testClient = new IotcOpcuaTestClient();

        server.log(['startup', 'info'], `Starting server initialization`);
        const deviceConfig = await server.initialize();

        server.log(['startup', 'info'], `Starting server`);
        await server.start();

        server.log(['startup', 'info'], `Server started ( press CTRL+C to stop)`);

        server.log(['startup', 'info'], `Server endpoint: ${server.getEndpoint()}`);

        await testClient.startTests(deviceConfig);
    }
    catch (ex) {
        // tslint:disable-next-line:no-console
        console.log(`['startup', 'error'], 👹 Error starting server: ${ex.message}`);
    }
}

forget(start);
