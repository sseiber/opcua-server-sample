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
    dataType: DataType;
    value: any;
    lowValue: any;
    highValue: any;
}

export class IotcOpcuaTestServer {
    private app: IAppConfig;
    private systemConfig: any;
    private opcuaServer: OPCUAServer;
    private addressSpace: AddressSpace;
    private localServerNamespace: Namespace;
    private opcDeviceMap: Map<string, IOpcDeviceInfo> = new Map<string, IOpcDeviceInfo>();

    constructor(app: IAppConfig) {
        this.app = app;
    }

    public async initialize(): Promise<any> {

        return this.opcDeviceMap;
    }

    public async start(): Promise<void> {
        this.app.log(['IotcOpcuaTestServer', 'info'], `Instantiating opcua server`);

        this.opcuaServer = new OPCUAServer(this.systemConfig.server);

        await new Promise((resolve) => {
            this.opcuaServer.initialize(() => {
                return resolve();
            });
        });

        await this.configureDevices();

        await new Promise((resolve) => {
            this.opcuaServer.start(() => {
                return resolve();
            });
        });

        this.app.log(['IotcOpcuaTestServer', 'info'], `Server started listening on port: ${this.opcuaServer.endpoints[0].port}`);
    }

    public async stop(): Promise<void> {
        await this.opcuaServer.shutdown(10 * 1000);
    }

    public getEndpoint(): string {
        return this.opcuaServer.endpoints[0].endpointDescriptions()[0].endpointUrl;
    }

    private async configureDevices(): Promise<void> {
        this.addressSpace = this.opcuaServer.engine.addressSpace;
        this.localServerNamespace = this.addressSpace.getOwnNamespace();

        for (const deviceConfig of this.systemConfig.devices) {
            const deviceConfigPath = pathResolve(process.env.CONTENT_ROOT, deviceConfig.configName);
            const deviceConfigData = fse.readJSONSync(deviceConfigPath);
            const deviceVariables: Map<string, IOpcVariable> = new Map<string, IOpcVariable>();

            const opcDevice = await this.addDevice(deviceConfigData.name);

            for (const tag of deviceConfigData.tags) {
                const opcVariable: IOpcVariable = {
                    variable: undefined,
                    dataType: tag.dataType,
                    value: tag.value,
                    lowValue: tag.lowValue,
                    highValue: tag.highValue
                };

                opcVariable.variable = await this.createDeviceVariable(opcDevice, tag.name, tag.dataType, opcVariable.value);

                deviceVariables.set(tag.name, opcVariable);
            }

            const opcDeviceInfo: IOpcDeviceInfo = {
                device: opcDevice,
                variables: deviceVariables
            };

            this.opcDeviceMap.set(deviceConfigData.name, opcDeviceInfo);
        }
    }

    private async addDevice(deviceName: string): Promise<UAObject> {
        return this.localServerNamespace.addObject({
            organizedBy: this.addressSpace.rootFolder.objects,
            browseName: deviceName
        });
    }

    private async createDeviceVariable(device: UAObject, name: string, dataType: DataType, varRef: any): Promise<UAVariable> {
        return this.localServerNamespace.addVariable({
            componentOf: device,
            browseName: name,
            dataType,
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
