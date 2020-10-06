import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    ClientSession,
    AttributeIds,
    DataType,
    WriteValueOptions,
    NodeId,
    NodeIdType
} from 'node-opcua';
import { IOpcDeviceInfo } from './iotcOpcuaServer';

export class IotcOpcuaTestClient {
    private client: OPCUAClient;
    private session: ClientSession;
    private testInterval: NodeJS.Timeout;

    public log(tags: any, message: any) {
        const tagsMessage = (tags && Array.isArray(tags)) ? `[${tags.join(', ')}]` : '[]';

        // tslint:disable-next-line:no-console
        console.log(`[${new Date().toTimeString()}] [${tagsMessage}] ${message}`);
    }

    public async initialize(): Promise<void> {
        this.log(['IotcOpcuaTestClient', 'info'], `Instantiating opcua client`);

        // this.client = new OPCUAClient();
    }

    public async connect(): Promise<void> {
        const options = {
            applicationName: 'Woodshop',
            connectionStrategy: {
                initialDelay: 1000,
                maxRetry: 1
            },
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            endpoint_must_exist: false
        };

        this.client = OPCUAClient.create(options);

        await this.client.connect('opc.tcp://Scotts-MBPro16.local:4334/UA/Factory_001');
    }

    public async createSession(): Promise<void> {
        this.session = await this.client.createSession();
    }

    public async browseServer(): Promise<any> {
        const browseResult = await this.session.browse('RootFolder');
        for (const reference of browseResult.references) {
            this.log(['IotcOpcuaTestClient', 'info'], `  -> ${reference.browseName.toString()}`);
        }

        // const browseResult2 = await this.session.browse({
        //     nodeId: new NodeId(NodeIdType.NUMERIC, 2253, 0),
        //     nodeClassMask: NodeClass.Variable,
        //     resultMask: 63
        // });

        return browseResult;
    }

    public async readValue(nodeId: string): Promise<any> {
        const dataValue2 = await this.session.read({
            nodeId,
            attributeId: AttributeIds.Value
        });

        return dataValue2;
    }

    public async writeValue(nodeId: number, dataType: DataType, newValue: any): Promise<void> {
        this.log(['IotcOpcuaTestClient', 'info'], `Write value: ${newValue}`);

        const writeOptions: WriteValueOptions = {
            nodeId: new NodeId(NodeIdType.NUMERIC, nodeId, 1),
            attributeId: AttributeIds.Value,
            value: {
                value: {
                    dataType,
                    value: newValue
                }
            }
        };

        const status = await this.session.write(writeOptions);
    }

    public async startTests(opcDeviceMap: Map<string, IOpcDeviceInfo>): Promise<void> {
        this.log(['IotcOpcuaServer', 'info'], `Starting device simulated data generation`);

        const options = {
            applicationName: 'Woodshop',
            connectionStrategy: {
                initialDelay: 1000,
                maxRetry: 1
            },
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            endpoint_must_exist: false
        };

        const client = OPCUAClient.create(options);

        await client.connect('opc.tcp://Scotts-MBPro16.local:4334/UA/Factory_001');
        const clientSession = await client.createSession();

        // const foo = await client.readValue('ns=1;g=191da776-a38b-45cc-88fe-cb17f39d8944');
        // const foo = await client.readValue('ns=1;i=1002');
        // await client.writeValue('ns=1;i=1011', 50.1);
        // const bar = await client.readValue('ns=1;i=1011');

        this.testInterval = setInterval(async () => {
            for (const deviceItem of opcDeviceMap) {
                for (const variableItem of deviceItem[1].variables) {
                    const variableInfo = variableItem[1];
                    const step = Math.abs(variableInfo.highValue - variableInfo.lowValue) * 0.000133333;

                    if (variableInfo.dataType >= DataType.Int16 && variableInfo.dataType <= DataType.Double) {
                        const newValue = (Math.abs(variableInfo.highValue - variableInfo.lowValue) / 2) * Math.sin(Date.now() + step);

                        const foo = await variableInfo.variable.readValueAsync(null);
                        this.log(['IotcOpcuaServer', 'info'], `readValue result: ${foo.value.value}`);

                        this.log(['IotcOpcuaServer', 'info'], `setValueFromSource: ${newValue}`);
                        variableInfo.value = newValue;
                        // variableInfo.variable.setValueFromSource(
                        //     {
                        //         dataType: variableInfo.dataType,
                        //         value: newValue
                        //     },
                        //     StatusCodes.Good,
                        //     new Date()
                        // );
                        const writeOptions: WriteValueOptions = {
                            nodeId: new NodeId(NodeIdType.NUMERIC, variableInfo.variable.nodeId.value, 1),
                            attributeId: AttributeIds.Value,
                            value: {
                                value: {
                                    dataType: variableInfo.dataType,
                                    value: newValue
                                }
                            }
                        };

                        const status = await clientSession.write(writeOptions);

                        const foo2 = await variableInfo.variable.readValueAsync(null);
                        this.log(['IotcOpcuaServer', 'info'], `re-readValue result: ${foo2.value.value}`);

                        this.log(['IotcOpcuaServer', 'info'], `New variable id: ${variableInfo.variable.nodeId.value}, value: ${newValue}`);
                    }
                }
            }
        }, 3 * 1000);
    }

    public async stopTests() {
        this.log(['IotcOpcuaServer', 'info'], `Stopping device simulated data generation`);

        clearTimeout(this.testInterval);
    }
}
