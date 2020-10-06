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

export class IotcOpcuaServer {
    private systemConfig: any;
    private server: OPCUAServer;
    private addressSpace: AddressSpace;
    private localServerNamespace: Namespace;

    private opcDeviceMap: Map<string, IOpcDeviceInfo> = new Map<string, IOpcDeviceInfo>();

    public log(tags: any, message: any) {
        const tagsMessage = (tags && Array.isArray(tags)) ? `[${tags.join(', ')}]` : '[]';

        // tslint:disable-next-line:no-console
        console.log(`[${new Date().toTimeString()}] [${tagsMessage}] ${message}`);
    }

    public async initialize(): Promise<any> {
        this.log(['IotcOpcuaServer', 'info'], `Instantiating opcua server`);

        const systemConfigPath = pathResolve(process.env.CONTENT_ROOT, 'systemConfig.json');
        this.systemConfig = fse.readJSONSync(systemConfigPath);

        this.server = new OPCUAServer(this.systemConfig.server);

        await new Promise((resolve) => {
            this.server.initialize(() => {
                return resolve();
            });
        });

        await this.configureDevices();

        return this.opcDeviceMap;
    }

    public async start(): Promise<void> {
        await new Promise((resolve) => {
            this.server.start(() => {
                return resolve();
            });
        });

        this.log(['IotcOpcuaServer', 'info'], `Server started listening on port: ${this.server.endpoints[0].port}`);
    }

    public getEndpoint(): string {
        return this.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
    }

    private async configureDevices(): Promise<void> {
        this.addressSpace = this.server.engine.addressSpace;
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
