import {
    AddressSpace,
    DataType,
    Namespace,
    OPCUAServer,
    StatusCodes,
    UAObject,
    UAVariable,
    Variant
} from 'node-opcua';
import * as fse from 'fs-extra';
import { resolve as pathResolve } from 'path';
import { IAppConfig } from '..';

export interface IOpcDeviceInfo {
    device: UAObject;
    variables: Map<string, IOpcVariable>;
}

export interface IOpcVariable {
    variable: UAVariable;
    sampleInterval: number;
    value: any;
    lowValue: any;
    highValue: any;
}

export class IotcOpcuaTestServer {
    private app: IAppConfig;
    private opcuaServer: OPCUAServer;
    private addressSpace: AddressSpace;
    private localServerNamespace: Namespace;
    private opcDeviceMap: Map<string, IOpcDeviceInfo> = new Map<string, IOpcDeviceInfo>();
    private opcVariableMap: Map<string, IOpcVariable> = new Map<string, IOpcVariable>();

    constructor(app: IAppConfig) {
        this.app = app;
    }

    public get GetOpcDeviceMap() {
        return this.opcDeviceMap;
    }

    public get GetOpcVariableMap() {
        return this.opcVariableMap;
    }

    public async start(): Promise<void> {
        this.app.log(['IotcOpcuaTestServer', 'info'], `Instantiating opcua server`);

        try {
            this.opcuaServer = new OPCUAServer(this.app.serverConfig.server);

            await new Promise((resolve) => {
                this.opcuaServer.initialize(() => {
                    return resolve('');
                });
            });

            this.addressSpace = this.opcuaServer.engine.addressSpace;
            this.localServerNamespace = this.addressSpace.getOwnNamespace();

            this.app.log(['IotcOpcuaTestServer', 'info'], `Processing server configuration...`);
            await this.configureDevices();

            this.app.log(['IotcOpcuaTestServer', 'info'], `Starting server...`);
            await new Promise((resolve) => {
                this.opcuaServer.start(() => {
                    return resolve('');
                });
            });

            this.app.log(['IotcOpcuaTestServer', 'info'], `Server started listening on port: ${this.opcuaServer.endpoints[0].port}`);
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestServer', 'error'], `Error during server startup: ${ex.message}`);
        }
    }

    public async stop(): Promise<void> {
        await this.opcuaServer.shutdown(10 * 1000);
    }

    public getEndpoint(): string {
        let endpoint = '';

        try {
            endpoint = this.opcuaServer?.endpoints[0]?.endpointDescriptions()[0]?.endpointUrl;
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestServer', 'error'], `Error getting server endpoint - may be another running instance at this port: ${this.app.serverConfig?.server?.port}`);
        }

        return endpoint;
    }

    private async configureDevices(): Promise<void> {
        try {
            this.addressSpace = this.opcuaServer.engine.addressSpace;
            this.localServerNamespace = this.addressSpace.getOwnNamespace();

            for (const deviceConfig of this.app.serverConfig.devices) {
                const deviceConfigPath = pathResolve(this.app.storageRootDirectory, deviceConfig.configName);
                const deviceConfigData = fse.readJSONSync(deviceConfigPath);
                const deviceVariables: Map<string, IOpcVariable> = new Map<string, IOpcVariable>();

                const opcDevice = await this.addDevice(deviceConfigData.name);

                for (const tag of deviceConfigData.tags) {
                    const opcVariable: IOpcVariable = {
                        variable: undefined,
                        sampleInterval: tag.sampleInterval || 0,
                        value: tag.value,
                        lowValue: tag.lowValue,
                        highValue: tag.highValue
                    };

                    opcVariable.variable = await this.createDeviceVariable(opcDevice, tag.name, tag.description, tag.dataType, tag.sampleInterval, opcVariable.value);

                    deviceVariables.set(tag.name, opcVariable);
                    this.opcVariableMap.set(opcVariable.variable.nodeId.value.toString(), opcVariable);
                }

                const opcDeviceInfo: IOpcDeviceInfo = {
                    device: opcDevice,
                    variables: deviceVariables
                };

                this.opcDeviceMap.set(deviceConfigData.name, opcDeviceInfo);
            }
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestServer', 'error'], `Error while processing server configuration (adding variables): ${ex.message}`);
        }
    }

    private async addDevice(deviceName: string): Promise<UAObject> {
        return this.localServerNamespace.addObject({
            organizedBy: this.addressSpace.rootFolder.objects,
            browseName: deviceName,
            displayName: deviceName
        });
    }

    private async createDeviceVariable(device: UAObject, name: string, description: string, dataType: DataType, sampleInterval: number, varRef: any): Promise<UAVariable> {
        return this.localServerNamespace.addVariable({
            componentOf: device,
            browseName: name,
            displayName: name,
            description,
            dataType,
            minimumSamplingInterval: sampleInterval,
            value: {
                get: () => {
                    return new Variant({ dataType, value: varRef });
                },
                set: (variant) => {
                    varRef = parseFloat(variant.value);
                    return StatusCodes.Good;
                }
            }
        });
    }
}
