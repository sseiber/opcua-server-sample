import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    ClientSession,
    AttributeIds,
    DataType,
    WriteValueOptions,
    NodeId,
    NodeIdType,
    BrowseDirection,
    NodeClass
} from 'node-opcua';
import { IAppConfig } from '..';
import { bind } from '../utils';

interface NodeInfo {
    browseName: string;
    nodeId: NodeId;
    nodeClass: NodeClass;
}

export class IotcOpcuaTestClient {
    private app: IAppConfig;
    private opcuaClient: OPCUAClient;
    private session: ClientSession;
    private testIntervalId: NodeJS.Timeout;
    private testInterval: number = 3 * 1000;
    private allAssetVariableNodes: NodeInfo[] = [];

    constructor(app: IAppConfig) {
        this.app = app;
    }

    public async connect(): Promise<void> {
        try {
            const options = {
                applicationName: this.app.serverConfig?.server?.buildInfo?.productName || '',
                connectionStrategy: {
                    initialDelay: 1000,
                    maxRetry: 1
                },
                securityMode: MessageSecurityMode.None,
                securityPolicy: SecurityPolicy.None,
                endpoint_must_exist: false
            };

            this.opcuaClient = OPCUAClient.create(options);

            const opcuaEndpoint = `opc.tcp://localhost:${this.app.serverConfig?.server?.port || 4334}${this.app.serverConfig?.server?.resourcePath || '/'}`;

            this.app.log(['IotcOpcuaTestClient', 'info'], `Connecting client to test server endpoint: ${opcuaEndpoint}`);
            await this.opcuaClient.connect(opcuaEndpoint);

            this.app.log(['IotcOpcuaTestClient', 'info'], `Creating client session...`);
            this.session = await this.opcuaClient.createSession();
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestClient', 'error'], `Error while creating client connection to test server endpoing: ${ex.message}`);
        }
    }

    public async readValue(nodeId: string): Promise<any> {
        const dataValue2 = await this.session.read({
            nodeId,
            attributeId: AttributeIds.Value
        });

        return dataValue2;
    }

    public async writeValue(nodeId: number, dataType: DataType, newValue: any): Promise<void> {
        this.app.log(['IotcOpcuaTestClient', 'info'], `Write value: ${newValue}`);

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

        await this.session.write(writeOptions);
    }

    public async startTests(): Promise<void> {
        try {
            // const foo = await client.readValue('ns=1;g=191da776-a38b-45cc-88fe-cb17f39d8944');
            // const foo = await client.readValue('ns=1;i=1002');
            // await client.writeValue('ns=1;i=1011', 50.1);
            // const bar = await client.readValue('ns=1;i=1011');
            // const foo = await variableInfo.variable.readValueAsync(null);

            this.app.log(['IotcOpcuaTestServer', 'info'], `Reading node tree from RootFolder/Objects/...`);
            this.allAssetVariableNodes = await this.getAllAssetVariables();

            this.app.log(['IotcOpcuaTestServer', 'info'], `Starting test intervals with frequency: ${this.testInterval} milliseconds`);
            // await this.updateVariables();
            this.testIntervalId = setInterval(this.updateVariables, this.testInterval);
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestServer', 'error'], `Error while configuring client tests: ${ex.message}`);
        }
    }

    public async stopTests() {
        this.app.log(['IotcOpcuaTestServer', 'info'], `Stopping device simulated data generation`);

        clearTimeout(this.testIntervalId);
    }

    @bind
    private async updateVariables() {
        try {
            for (const variableNode of this.allAssetVariableNodes) {
                const variableDataType = await this.session.getBuiltInDataType(variableNode.nodeId);

                if (variableDataType >= DataType.Int16 && variableDataType <= DataType.Double) {
                    const variableInfo = this.app.server.GetOpcVariableMap.get(variableNode.nodeId.value.toString());
                    // const currentValue = await this.session.readVariableValue(variableNode.nodeId);
                    const newValue = Math.abs(variableInfo.highValue - variableInfo.lowValue) * Math.cos(Date.now());

                    this.app.log(['IotcOpcuaTestServer', 'info'], `Set new value: Node: ${variableNode.nodeId.value}, value: ${newValue}`);

                    // Instead of using the setValueFromSource method above, this code uses it's own
                    // Client interface to set the values. This seems to work.
                    const writeOptions: WriteValueOptions = {
                        nodeId: variableNode.nodeId,
                        attributeId: AttributeIds.Value,
                        value: {
                            value: {
                                dataType: variableDataType,
                                value: newValue
                            }
                        }
                    };

                    await this.session.write(writeOptions);
                }
            }
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestServer', 'error'], `Error during test interval: ${ex.message}`);
        }
    }

    private async getAllAssetVariables(): Promise<NodeInfo[]> {
        let allAssetVariableNodes = [];

        try {
            const objectNodeInfo = {
                browseName: 'Objects',
                nodeId: new NodeId(NodeIdType.NUMERIC, 85, 0),
                nodeClass: 1
            };

            const assetNodes: NodeInfo[] = [];
            const objectNodes = await this.expandNode(objectNodeInfo.nodeId);
            for (const objectNode of objectNodes) {
                if (objectNode.browseName === 'Aliases' || objectNode.browseName === 'Server') {
                    continue;
                }

                assetNodes.push(objectNode);
            }

            allAssetVariableNodes = await this.enumerateAssetNodes(assetNodes);
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestClient', 'error'], `Exception while reading NodeId: ${ex.message}`);
        }

        return allAssetVariableNodes;
    }

    private async enumerateAssetNodes(nodes: NodeInfo[]): Promise<NodeInfo[]> {
        this.app.log(['IotcOpcuaTestClient', 'info'], `nodes: ${nodes.length}`);

        let newNodes: NodeInfo[] = [];

        for (const node of nodes) {
            newNodes = newNodes.concat(await this.expandNode(node.nodeId));
        }

        if (newNodes.length > 0) {
            return newNodes.concat(await this.enumerateAssetNodes(newNodes));
        }

        return newNodes;
    }

    private async expandNode(rootNodeId: NodeId): Promise<NodeInfo[]> {
        const childNodes: NodeInfo[] = [];

        try {
            const nodesToBrowse = [
                {
                    nodeId: rootNodeId,
                    referenceTypeId: 'Organizes',
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 0x3f
                },
                {
                    nodeId: rootNodeId,
                    referenceTypeId: 'Aggregates',
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 0x3f

                },
                {
                    nodeId: rootNodeId,
                    referenceTypeId: 'HasSubtype',
                    includeSubtypes: true,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 0x3f
                }
            ];

            const browseRefs = await this.session.browse(nodesToBrowse);

            for (const ref of browseRefs[0]?.references) {
                childNodes.push({
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    nodeClass: ref.nodeClass as number
                });
            }

            for (const ref of browseRefs[1]?.references) {
                childNodes.push({
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    nodeClass: ref.nodeClass as number
                });
            }

            for (const ref of browseRefs[2]?.references) {
                childNodes.push({
                    browseName: ref.browseName.toString(),
                    nodeId: ref.nodeId,
                    nodeClass: ref.nodeClass as number
                });
            }
        }
        catch (ex) {
            this.app.log(['IotcOpcuaTestClient', 'error'], `Exception while reading NodeId: ${ex.message}`);
        }

        return childNodes;
    }
}
